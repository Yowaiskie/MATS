import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  query,
  where,
  runTransaction,
  writeBatch
} from 'firebase/firestore'
import { db } from '@/firebase/config'
import { auditService } from '@/services/auditService'
import { eventFormQuestionService } from '@/services/eventFormQuestionService'
import type { EventForm, EventFormQuestion, EventFormResponse, EventFormSlotCount } from '@/types/eventForm'
import {
  buildSlotCountMapKey,
  computeSlotDeltas,
  extractLimitedSelections,
  SlotFullError
} from '@/utils/eventFormSlots'

const RESPONSES_COLLECTION = 'eventFormResponses'
const SLOT_COUNTS_COLLECTION = 'eventFormSlotCounts'
const BATCH_SIZE_LIMIT = 450
const MAX_CONTENTION_RETRIES = 4

function isTransactionContentionError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const code = String((error as any).code || '').toLowerCase()
  const message = String((error as any).message || '').toLowerCase()
  return (
    code.includes('aborted') ||
    code.includes('failed-precondition') ||
    message.includes('contention') ||
    message.includes('aborted') ||
    message.includes('cross-transaction')
  )
}

async function runTransactionWithJitteredRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = MAX_CONTENTION_RETRIES
): Promise<T> {
  let attempt = 0
  while (true) {
    try {
      return await operation()
    } catch (err) {
      if (err instanceof SlotFullError || !isTransactionContentionError(err) || attempt >= maxRetries) {
        throw err
      }
      attempt += 1
      const baseDelayMs = 150 * Math.pow(1.6, attempt - 1)
      const jitterMs = Math.floor(Math.random() * 250)
      await new Promise(resolve => setTimeout(resolve, baseDelayMs + jitterMs))
    }
  }
}

export const eventFormResponseService = {
  /**
   * Fetch lightweight per-slot capacity counts for a form (zero PII).
   * Returns a map of `${questionId}::${slotType}::${slotKey}` -> booked count.
   */
  async getSlotCountsByFormId(formId: string): Promise<Record<string, number>> {
    try {
      const q = query(
        collection(db, SLOT_COUNTS_COLLECTION),
        where('formId', '==', formId)
      )
      const snapshot = await getDocs(q)
      const countsMap: Record<string, number> = {}
      snapshot.docs.forEach(d => {
        const data = d.data() as EventFormSlotCount
        if (data.questionId && data.slotType && data.slotKey) {
          const mapKey = buildSlotCountMapKey(data.questionId, data.slotType, data.slotKey)
          countsMap[mapKey] = typeof data.count === 'number' ? data.count : 0
        }
      })
      return countsMap
    } catch (error) {
      console.error('Error fetching slot counts for form:', error)
      throw new Error('Failed to load available slot counts.')
    }
  },

  /**
   * Submit a new response (or edit an existing authenticated response) for a form.
   * Uses atomic Firestore transactions on per-slot counter documents to prevent overbooking
   * and avoid scanning all existing responses.
   */
  async submitResponse(
    form: EventForm,
    answers: Record<string, string | string[] | number | boolean>,
    respondentInfo?: { memberUid?: string; memberName?: string; email?: string },
    existingTrackingNumber?: string,
    preloadedQuestions?: EventFormQuestion[]
  ): Promise<string> {
    try {
      if (!form.id) throw new Error('Invalid form ID.')
      const formId = form.id
      if (form.status !== 'published') throw new Error('Form is not open for responses.')

      // Check date bounds if configured
      const now = new Date()
      if (form.startAt && new Date(form.startAt) > now) {
        throw new Error('Form submission window has not started yet.')
      }
      if (form.closeAt && new Date(form.closeAt) < now) {
        throw new Error('Form submission window has closed.')
      }

      const questions =
        preloadedQuestions && preloadedQuestions.length > 0
          ? preloadedQuestions
          : await eventFormQuestionService.getQuestionsByFormId(formId)

      const newTargets = extractLimitedSelections(formId, questions, answers)

      // --- Explicit edit path (authenticated): re-submit via provided tracking number ---
      if (existingTrackingNumber) {
        const existingByTracking = query(
          collection(db, RESPONSES_COLLECTION),
          where('trackingNumber', '==', existingTrackingNumber),
          where('formId', '==', formId)
        )
        const existingSnap = await getDocs(existingByTracking)
        if (!existingSnap.empty) {
          const existingDoc = existingSnap.docs[0]
          const existingRef = doc(db, RESPONSES_COLLECTION, existingDoc.id)

          await runTransaction(db, async (tx) => {
            const freshSnap = await tx.get(existingRef)
            if (!freshSnap.exists()) {
              throw new Error('Original response not found.')
            }
            const oldData = freshSnap.data() as EventFormResponse
            const oldTargets = extractLimitedSelections(formId, questions, oldData.answers || {})
            const { toIncrement, toDecrement } = computeSlotDeltas(oldTargets, newTargets)

            // Read all affected counter docs before any writes
            const incSnaps = await Promise.all(
              toIncrement.map(t => tx.get(doc(db, SLOT_COUNTS_COLLECTION, t.docId)))
            )
            const decSnaps = await Promise.all(
              toDecrement.map(t => tx.get(doc(db, SLOT_COUNTS_COLLECTION, t.docId)))
            )

            // Validate capacity for newly selected slots
            toIncrement.forEach((target, idx) => {
              const snap = incSnaps[idx]
              const currentCount = snap.exists() ? Number(snap.data().count || 0) : 0
              if (currentCount + 1 > target.maxCapacity) {
                throw new SlotFullError(target)
              }
            })

            // Apply increments
            toIncrement.forEach((target, idx) => {
              const snap = incSnaps[idx]
              const currentCount = snap.exists() ? Number(snap.data().count || 0) : 0
              const slotRef = doc(db, SLOT_COUNTS_COLLECTION, target.docId)
              tx.set(slotRef, {
                formId,
                questionId: target.questionId,
                slotType: target.slotType,
                slotKey: target.slotKey,
                count: currentCount + 1,
                maxCapacity: target.maxCapacity,
                updatedAt: serverTimestamp()
              })
            })

            // Apply decrements
            toDecrement.forEach((target, idx) => {
              const snap = decSnaps[idx]
              if (snap.exists()) {
                const currentCount = Number(snap.data().count || 0)
                const slotRef = doc(db, SLOT_COUNTS_COLLECTION, target.docId)
                tx.update(slotRef, {
                  count: Math.max(0, currentCount - 1),
                  maxCapacity: target.maxCapacity,
                  updatedAt: serverTimestamp()
                })
              }
            })

            tx.update(existingRef, {
              answers,
              respondentMemberUid: respondentInfo?.memberUid || '',
              respondentMemberName: respondentInfo?.memberName || '',
              respondentEmail: respondentInfo?.email || '',
              status: 'submitted',
              updatedAt: serverTimestamp()
            })
          })

          auditService
            .logAction(
              'FORM_RESPONSE_SUBMIT',
              'events',
              `Updated existing response ${existingTrackingNumber} for form "${form.title}"`,
              respondentInfo?.memberName || respondentInfo?.email || 'Public User',
              { formId, eventId: form.eventId, trackingNumber: existingTrackingNumber }
            )
            .catch(console.error)

          return existingTrackingNumber
        }
      }

      // --- Authenticated single-response check ---
      if (respondentInfo?.memberUid && form.allowMultipleResponses === false) {
        try {
          const existingQ = query(
            collection(db, RESPONSES_COLLECTION),
            where('formId', '==', formId),
            where('respondentMemberUid', '==', respondentInfo.memberUid)
          )
          const existingSnap = await getDocs(existingQ)
          if (!existingSnap.empty) {
            if (form.allowEditResponse) {
              const existingDoc = existingSnap.docs[0]
              const foundTrackingNumber = existingDoc.data().trackingNumber as string
              return await this.submitResponse(form, answers, respondentInfo, foundTrackingNumber, questions)
            } else {
              throw new Error('You have already submitted a response for this form. Multiple responses are not allowed.')
            }
          }
        } catch (err) {
          // If unauthenticated public user has a memberUid from member_selector, read is intentionally blocked by rules;
          // rethrow only explicit duplicate error
          if (err instanceof Error && err.message.includes('already submitted')) {
            throw err
          }
        }
      }

      // --- Atomic New Submission (1 slot read + 1 slot write + 1 response write) ---
      const date = new Date()
      const yearMonth = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}`
      const randomSuffix = Math.floor(10000 + Math.random() * 90000)
      const generatedTrackingNumber = `FR-${yearMonth}-${randomSuffix}`
      const responseRef = doc(collection(db, RESPONSES_COLLECTION))

      await runTransactionWithJitteredRetry(() =>
        runTransaction(db, async (tx) => {
          // 1. Read only the selected slot counter doc(s)
          const slotSnaps = await Promise.all(
            newTargets.map(t => tx.get(doc(db, SLOT_COUNTS_COLLECTION, t.docId)))
          )

          // 2. Verify capacity atomically
          newTargets.forEach((target, idx) => {
            const snap = slotSnaps[idx]
            const currentCount = snap.exists() ? Number(snap.data().count || 0) : 0
            if (currentCount + 1 > target.maxCapacity) {
              throw new SlotFullError(target)
            }
          })

          // 3. Increment each selected slot counter
          newTargets.forEach((target, idx) => {
            const snap = slotSnaps[idx]
            const currentCount = snap.exists() ? Number(snap.data().count || 0) : 0
            const slotRef = doc(db, SLOT_COUNTS_COLLECTION, target.docId)
            if (snap.exists()) {
              tx.update(slotRef, {
                formId,
                questionId: target.questionId,
                slotType: target.slotType,
                slotKey: target.slotKey,
                count: currentCount + 1,
                maxCapacity: target.maxCapacity,
                updatedAt: serverTimestamp()
              })
            } else {
              tx.set(slotRef, {
                formId,
                questionId: target.questionId,
                slotType: target.slotType,
                slotKey: target.slotKey,
                count: 1,
                maxCapacity: target.maxCapacity,
                updatedAt: serverTimestamp()
              })
            }
          })

          // 4. Write the response document inside the same atomic transaction
          tx.set(responseRef, {
            formId,
            eventId: form.eventId,
            trackingNumber: generatedTrackingNumber,
            respondentMemberUid: respondentInfo?.memberUid || '',
            respondentMemberName: respondentInfo?.memberName || '',
            respondentEmail: respondentInfo?.email || '',
            answers,
            status: 'submitted',
            submittedAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          })
        })
      )

      auditService
        .logAction(
          'FORM_RESPONSE_SUBMIT',
          'events',
          `Submitted response ${generatedTrackingNumber} for form "${form.title}"`,
          respondentInfo?.memberName || respondentInfo?.email || 'Public User',
          { formId, eventId: form.eventId, trackingNumber: generatedTrackingNumber }
        )
        .catch(console.error)

      return generatedTrackingNumber
    } catch (error) {
      console.error('Error submitting form response:', error)
      if (error instanceof SlotFullError) {
        throw error
      }
      throw new Error(error instanceof Error ? error.message : 'Failed to submit form response.')
    }
  },

  /**
   * Fetch all responses for a form.
   */
  async getResponsesByFormId(formId: string): Promise<EventFormResponse[]> {
    try {
      const q = query(
        collection(db, RESPONSES_COLLECTION),
        where('formId', '==', formId)
      )
      const snapshot = await getDocs(q)
      const responses = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      })) as EventFormResponse[]

      return responses.sort((a, b) => {
        const timeA = typeof a.submittedAt === 'object' && a.submittedAt && 'seconds' in a.submittedAt ? (a.submittedAt as any).seconds : 0
        const timeB = typeof b.submittedAt === 'object' && b.submittedAt && 'seconds' in b.submittedAt ? (b.submittedAt as any).seconds : 0
        return timeB - timeA
      })
    } catch (error) {
      console.error('Error fetching responses:', error)
      throw new Error('Failed to fetch form responses.')
    }
  },

  /**
   * Fetch response count for a single form safely.
   */
  async getResponseCountByFormId(formId: string): Promise<number> {
    try {
      const q = query(
        collection(db, RESPONSES_COLLECTION),
        where('formId', '==', formId)
      )
      const snapshot = await getDocs(q)
      return snapshot.size
    } catch (error) {
      console.warn('Error fetching response count:', error)
      return 0
    }
  },

  /**
   * Fetch response counts for multiple forms in batched queries.
   */
  async getResponseCountsByFormIds(formIds: string[]): Promise<Record<string, number>> {
    const ids = Array.from(new Set(formIds.filter(Boolean)))
    if (ids.length === 0) return {}

    const counts: Record<string, number> = {}
    ids.forEach(id => { counts[id] = 0 })

    try {
      const BATCH_SIZE = 30
      for (let i = 0; i < ids.length; i += BATCH_SIZE) {
        const batchIds = ids.slice(i, i + BATCH_SIZE)
        const q = query(
          collection(db, RESPONSES_COLLECTION),
          where('formId', 'in', batchIds)
        )
        const snapshot = await getDocs(q)
        snapshot.docs.forEach(d => {
          const fid = d.data().formId
          if (fid && counts[fid] !== undefined) {
            counts[fid]++
          }
        })
      }
      return counts
    } catch (error) {
      console.warn('Failed to batch count form responses (using fallback 0):', error)
      return counts
    }
  },

  /**
   * Get response by tracking number.
   */
  async getResponseByTrackingNumber(trackingNumber: string): Promise<EventFormResponse | null> {
    try {
      const q = query(
        collection(db, RESPONSES_COLLECTION),
        where('trackingNumber', '==', trackingNumber)
      )
      const snapshot = await getDocs(q)
      if (snapshot.empty) return null
      const d = snapshot.docs[0]
      return { id: d.id, ...d.data() } as EventFormResponse
    } catch (error) {
      console.error('Error fetching response by tracking number:', error)
      throw new Error('Failed to fetch response.')
    }
  },

  /**
   * Update an existing response document in Firestore and keep slot counters synchronized atomically.
   */
  async updateResponse(
    responseId: string,
    answers: Record<string, string | string[] | number | boolean>,
    respondentInfo?: { memberUid?: string; memberName?: string; email?: string },
    performedBy: string = 'Admin'
  ): Promise<void> {
    try {
      const ref = doc(db, RESPONSES_COLLECTION, responseId)
      const initialSnap = await getDoc(ref)
      if (!initialSnap.exists()) {
        throw new Error('Response not found.')
      }
      const initialData = initialSnap.data() as EventFormResponse
      const questions = initialData.formId
        ? await eventFormQuestionService.getQuestionsByFormId(initialData.formId)
        : []

      const updateData: Record<string, any> = {
        answers,
        updatedAt: serverTimestamp()
      }
      if (respondentInfo?.memberName !== undefined) {
        updateData.respondentMemberName = respondentInfo.memberName
      }
      if (respondentInfo?.email !== undefined) {
        updateData.respondentEmail = respondentInfo.email
      }
      if (respondentInfo?.memberUid !== undefined) {
        updateData.respondentMemberUid = respondentInfo.memberUid
      }

      await runTransaction(db, async (tx) => {
        const freshSnap = await tx.get(ref)
        if (!freshSnap.exists()) {
          throw new Error('Response not found.')
        }
        const currentData = freshSnap.data() as EventFormResponse
        const formId = currentData.formId

        if (formId && questions.length > 0) {
          const oldTargets = extractLimitedSelections(formId, questions, currentData.answers || {})
          const newTargets = extractLimitedSelections(formId, questions, answers)
          const { toIncrement, toDecrement } = computeSlotDeltas(oldTargets, newTargets)

          const incSnaps = await Promise.all(
            toIncrement.map(t => tx.get(doc(db, SLOT_COUNTS_COLLECTION, t.docId)))
          )
          const decSnaps = await Promise.all(
            toDecrement.map(t => tx.get(doc(db, SLOT_COUNTS_COLLECTION, t.docId)))
          )

          toIncrement.forEach((target, idx) => {
            const snap = incSnaps[idx]
            const currentCount = snap.exists() ? Number(snap.data().count || 0) : 0
            if (currentCount + 1 > target.maxCapacity) {
              throw new SlotFullError(target)
            }
          })

          toIncrement.forEach((target, idx) => {
            const snap = incSnaps[idx]
            const currentCount = snap.exists() ? Number(snap.data().count || 0) : 0
            tx.set(doc(db, SLOT_COUNTS_COLLECTION, target.docId), {
              formId,
              questionId: target.questionId,
              slotType: target.slotType,
              slotKey: target.slotKey,
              count: currentCount + 1,
              maxCapacity: target.maxCapacity,
              updatedAt: serverTimestamp()
            })
          })

          toDecrement.forEach((target, idx) => {
            const snap = decSnaps[idx]
            if (snap.exists()) {
              const currentCount = Number(snap.data().count || 0)
              tx.update(doc(db, SLOT_COUNTS_COLLECTION, target.docId), {
                count: Math.max(0, currentCount - 1),
                maxCapacity: target.maxCapacity,
                updatedAt: serverTimestamp()
              })
            }
          })
        }

        tx.update(ref, updateData)
      })

      auditService
        .logAction(
          'FORM_RESPONSE_UPDATE',
          'events',
          `Updated response ID ${responseId}`,
          performedBy,
          { responseId }
        )
        .catch(console.error)
    } catch (error) {
      console.error('Error updating response:', error)
      if (error instanceof SlotFullError) {
        throw error
      }
      throw new Error(error instanceof Error ? error.message : 'Failed to update form response.')
    }
  },

  /**
   * Delete a response document from Firestore and decrement its slot counters atomically.
   */
  async deleteResponse(responseId: string): Promise<void> {
    try {
      const ref = doc(db, RESPONSES_COLLECTION, responseId)
      const initialSnap = await getDoc(ref)
      if (!initialSnap.exists()) return

      const initialData = initialSnap.data() as EventFormResponse
      const questions = initialData.formId
        ? await eventFormQuestionService.getQuestionsByFormId(initialData.formId)
        : []

      await runTransaction(db, async (tx) => {
        const freshSnap = await tx.get(ref)
        if (!freshSnap.exists()) return
        const currentData = freshSnap.data() as EventFormResponse
        const formId = currentData.formId

        if (formId && questions.length > 0) {
          const targets = extractLimitedSelections(formId, questions, currentData.answers || {})
          const snaps = await Promise.all(
            targets.map(t => tx.get(doc(db, SLOT_COUNTS_COLLECTION, t.docId)))
          )

          targets.forEach((target, idx) => {
            const snap = snaps[idx]
            if (snap.exists()) {
              const currentCount = Number(snap.data().count || 0)
              tx.update(doc(db, SLOT_COUNTS_COLLECTION, target.docId), {
                count: Math.max(0, currentCount - 1),
                maxCapacity: target.maxCapacity,
                updatedAt: serverTimestamp()
              })
            }
          })
        }

        tx.delete(ref)
      })

      auditService
        .logAction(
          'FORM_RESPONSE_DELETE',
          'events',
          `Deleted response ID ${responseId}`,
          'Admin',
          { responseId }
        )
        .catch(console.error)
    } catch (error) {
      console.error('Error deleting response:', error)
      throw new Error('Failed to delete form response.')
    }
  },

  /**
   * Delete all response documents and slot counter documents for a form in 450-op batches.
   */
  async deleteAllResponsesByFormId(formId: string, performedBy: string = 'Admin'): Promise<void> {
    try {
      const [responsesSnap, slotCountsSnap] = await Promise.all([
        getDocs(query(collection(db, RESPONSES_COLLECTION), where('formId', '==', formId))),
        getDocs(query(collection(db, SLOT_COUNTS_COLLECTION), where('formId', '==', formId)))
      ])

      const allRefs = [
        ...responsesSnap.docs.map(d => doc(db, RESPONSES_COLLECTION, d.id)),
        ...slotCountsSnap.docs.map(d => doc(db, SLOT_COUNTS_COLLECTION, d.id))
      ]

      for (let i = 0; i < allRefs.length; i += BATCH_SIZE_LIMIT) {
        const chunk = allRefs.slice(i, i + BATCH_SIZE_LIMIT)
        const batch = writeBatch(db)
        chunk.forEach(ref => batch.delete(ref))
        await batch.commit()
      }

      auditService
        .logAction(
          'FORM_RESPONSE_DELETE',
          'events',
          `Deleted all ${responsesSnap.docs.length} responses for form ID ${formId}`,
          performedBy,
          { formId, count: responsesSnap.docs.length }
        )
        .catch(console.error)
    } catch (error) {
      console.error('Error deleting all responses:', error)
      throw new Error('Failed to delete all form responses.')
    }
  },

  /**
   * Admin utility: recompute exact eventFormSlotCounts from all existing responses for a form.
   */
  async reconcileSlotCountsForForm(formId: string): Promise<{ syncedSlots: number; totalResponses: number }> {
    try {
      const [questions, responses, existingSlotsSnap] = await Promise.all([
        eventFormQuestionService.getQuestionsByFormId(formId),
        this.getResponsesByFormId(formId),
        getDocs(query(collection(db, SLOT_COUNTS_COLLECTION), where('formId', '==', formId)))
      ])

      const computedMap = new Map<
        string,
        {
          formId: string
          questionId: string
          slotType: 'appointment' | 'option'
          slotKey: string
          count: number
          maxCapacity: number
        }
      >()

      responses.forEach(r => {
        const targets = extractLimitedSelections(formId, questions, r.answers || {})
        targets.forEach(target => {
          const existing = computedMap.get(target.docId)
          if (existing) {
            existing.count += 1
          } else {
            computedMap.set(target.docId, {
              formId,
              questionId: target.questionId,
              slotType: target.slotType,
              slotKey: target.slotKey,
              count: 1,
              maxCapacity: target.maxCapacity
            })
          }
        })
      })

      type BatchOp =
        | { type: 'set'; id: string; data: Record<string, any> }
        | { type: 'delete'; id: string }

      const ops: BatchOp[] = []

      computedMap.forEach((data, docId) => {
        ops.push({
          type: 'set',
          id: docId,
          data: {
            ...data,
            updatedAt: serverTimestamp()
          }
        })
      })

      existingSlotsSnap.docs.forEach(d => {
        if (!computedMap.has(d.id)) {
          ops.push({ type: 'delete', id: d.id })
        }
      })

      for (let i = 0; i < ops.length; i += BATCH_SIZE_LIMIT) {
        const chunk = ops.slice(i, i + BATCH_SIZE_LIMIT)
        const batch = writeBatch(db)
        chunk.forEach(op => {
          const ref = doc(db, SLOT_COUNTS_COLLECTION, op.id)
          if (op.type === 'set') {
            batch.set(ref, op.data)
          } else {
            batch.delete(ref)
          }
        })
        await batch.commit()
      }

      return { syncedSlots: computedMap.size, totalResponses: responses.length }
    } catch (error) {
      console.error('Error reconciling slot counts:', error)
      throw new Error('Failed to synchronize slot counts.')
    }
  },

  /**
   * Export responses to a dynamically generated CSV file.
   */
  exportResponsesToCSV(
    form: EventForm,
    questions: EventFormQuestion[],
    responses: EventFormResponse[]
  ): void {
    const sortedQuestions = [...questions].sort((a, b) => a.order - b.order)
    
    // Headers: Tracking # | Respondent | Respondent Email | Question 1 | Question 2 | ... | Submitted At
    const headers = [
      'Tracking Number',
      'Respondent Name',
      'Respondent Email',
      ...sortedQuestions.map(q => `"${q.question.replace(/"/g, '""')}"`),
      'Submitted At'
    ]

    const sanitizeCsvCell = (str: string): string => {
      let cleaned = str.replace(/"/g, '""')
      if (/^[=+\-@\t\r]/.test(cleaned)) {
        cleaned = "'" + cleaned
      }
      return `"${cleaned}"`
    }

    const rows = responses.map(r => {
      const submittedDateStr = r.submittedAt && typeof r.submittedAt === 'object' && 'seconds' in r.submittedAt
        ? new Date((r.submittedAt as any).seconds * 1000).toLocaleString()
        : String(r.submittedAt || '')

      const questionAnswers = sortedQuestions.map(q => {
        const val = r.answers[q.id]
        if (val === undefined || val === null) return '""'
        if (Array.isArray(val)) {
          if (q.type === 'companion_repeater') {
            const formattedCompanions = (val as any[])
              .map(c => typeof c === 'object' && c && c.name ? `${c.name}${c.relationship ? ` (${c.relationship})` : ''}${c.notes ? ` - ${c.notes}` : ''}` : String(c))
              .join('; ')
            return sanitizeCsvCell(formattedCompanions)
          }
          return sanitizeCsvCell(val.join(', '))
        }
        if (typeof val === 'object' && val !== null) {
          if (q.type === 'appointment_slots' || 'timeRange' in val) {
            const appt = val as any
            const formattedAppt = `${appt.date || ''} • ${appt.timeRange || ''}${appt.slotLabel ? ` (${appt.slotLabel})` : ''}`.trim()
            return sanitizeCsvCell(formattedAppt)
          }
        }
        return sanitizeCsvCell(String(val))
      })

      return [
        sanitizeCsvCell(r.trackingNumber || ''),
        sanitizeCsvCell(r.respondentMemberName || ''),
        sanitizeCsvCell(r.respondentEmail || ''),
        ...questionAnswers,
        sanitizeCsvCell(submittedDateStr)
      ].join(',')
    })

    const blob = new Blob(['\uFEFF' + [headers.join(','), ...rows].join('\n')], {
      type: 'text/csv;charset=utf-8;'
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    const sanitizedTitle = form.title.toLowerCase().replace(/[^a-z0-9]/g, '_')
    link.setAttribute('download', `${sanitizedTitle}_responses.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }
}
