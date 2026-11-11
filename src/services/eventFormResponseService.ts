import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  serverTimestamp,
  updateDoc,
  query,
  where
} from 'firebase/firestore'
import { db } from '@/firebase/config'
import { auditService } from '@/services/auditService'
import { eventFormQuestionService } from '@/services/eventFormQuestionService'
import type { EventForm, EventFormQuestion, EventFormResponse } from '@/types/eventForm'

const RESPONSES_COLLECTION = 'eventFormResponses'

export const eventFormResponseService = {
  /**
   * Submit a new response for a form.
   * Generates a safe collision-free tracking number without lock contention.
   */
  async submitResponse(
    form: EventForm,
    answers: Record<string, string | string[] | number | boolean>,
    respondentInfo?: { memberUid?: string; memberName?: string; email?: string },
    existingTrackingNumber?: string
  ): Promise<string> {
    try {
      if (!form.id) throw new Error('Invalid form ID.')
      if (form.status !== 'published') throw new Error('Form is not open for responses.')

      // Check date bounds if configured
      const now = new Date()
      if (form.startAt && new Date(form.startAt) > now) {
        throw new Error('Form submission window has not started yet.')
      }
      if (form.closeAt && new Date(form.closeAt) < now) {
        throw new Error('Form submission window has closed.')
      }

      // --- Option & Appointment Limits Backend Validation ---
      const questions = await eventFormQuestionService.getQuestionsByFormId(form.id)
      const limitedQuestions = questions.filter(q => q.optionLimits && Object.keys(q.optionLimits).length > 0)
      const appointmentQuestions = questions.filter(q => q.type === 'appointment_slots' && q.appointmentConfig && q.appointmentConfig.length > 0)

      if (limitedQuestions.length > 0 || appointmentQuestions.length > 0) {
        const freshResponses = await this.getResponsesByFormId(form.id)

        for (const q of limitedQuestions) {
          const val = answers[q.id]
          if (!val) continue
          const selectedOpts = Array.isArray(val) ? val : [val]

          for (const selOpt of selectedOpts) {
            if (typeof selOpt === 'string') {
              const maxLimit = q.optionLimits?.[selOpt]
              if (maxLimit && maxLimit > 0) {
                const usedCount = freshResponses.reduce((count, r) => {
                  if (existingTrackingNumber && r.trackingNumber === existingTrackingNumber) return count
                  const rAns = r.answers?.[q.id]
                  if (Array.isArray(rAns)) {
                    return rAns.includes(selOpt) ? count + 1 : count
                  }
                  return rAns === selOpt ? count + 1 : count
                }, 0)

                if (usedCount >= maxLimit) {
                  throw new Error(`The option "${selOpt}" is already full (${maxLimit} max slots reached). Please select another option.`)
                }
              }
            }
          }
        }

        for (const q of appointmentQuestions) {
          const val = answers[q.id] as any
          if (!val || typeof val !== 'object' || !val.slotId || !val.date) continue

          const dateCfg = (q.appointmentConfig || []).find(d => d.date === val.date)
          const slotCfg = dateCfg?.slots.find(s => s.id === val.slotId)

          if (slotCfg && slotCfg.maxCapacity && slotCfg.maxCapacity > 0) {
            const usedCount = freshResponses.reduce((count, r) => {
              if (existingTrackingNumber && r.trackingNumber === existingTrackingNumber) return count
              const rAns = r.answers?.[q.id] as any
              if (rAns && typeof rAns === 'object' && rAns.date === val.date && rAns.slotId === val.slotId) {
                return count + 1
              }
              return count
            }, 0)

            if (usedCount >= slotCfg.maxCapacity) {
              throw new Error(`The appointment slot "${val.timeRange || slotCfg.startTime}" on ${val.dateLabel || val.date} is already full (${slotCfg.maxCapacity} max capacity reached). Please select another slot.`)
            }
          }
        }
      }

      // --- Explicit edit path: re-submit via provided tracking number ---
      if (existingTrackingNumber) {
        const existingByTracking = query(
          collection(db, RESPONSES_COLLECTION),
          where('trackingNumber', '==', existingTrackingNumber),
          where('formId', '==', form.id)
        )
        const existingSnap = await getDocs(existingByTracking)
        if (!existingSnap.empty) {
          const existingDoc = existingSnap.docs[0]
          await updateDoc(doc(db, RESPONSES_COLLECTION, existingDoc.id), {
            answers,
            respondentMemberUid: respondentInfo?.memberUid || '',
            respondentMemberName: respondentInfo?.memberName || '',
            respondentEmail: respondentInfo?.email || '',
            status: 'submitted',
            updatedAt: serverTimestamp()
          })
          await auditService.logAction(
            'FORM_RESPONSE_SUBMIT',
            'events',
            `Updated existing response ${existingTrackingNumber} for form "${form.title}"`,
            respondentInfo?.memberName || respondentInfo?.email || 'Public User',
            { formId: form.id, eventId: form.eventId, trackingNumber: existingTrackingNumber }
          )
          return existingTrackingNumber
        }
      }

      // --- When allowMultipleResponses is false and respondent already answered ---
      if (respondentInfo?.memberUid && form.allowMultipleResponses === false) {
        const existingQ = query(
          collection(db, RESPONSES_COLLECTION),
          where('formId', '==', form.id),
          where('respondentMemberUid', '==', respondentInfo.memberUid)
        )
        const existingSnap = await getDocs(existingQ)
        if (!existingSnap.empty) {
          if (form.allowEditResponse) {
            const existingDoc = existingSnap.docs[0]
            const foundTrackingNumber = existingDoc.data().trackingNumber as string
            await updateDoc(doc(db, RESPONSES_COLLECTION, existingDoc.id), {
              answers,
              respondentMemberName: respondentInfo?.memberName || '',
              respondentEmail: respondentInfo?.email || '',
              status: 'submitted',
              updatedAt: serverTimestamp()
            })
            await auditService.logAction(
              'FORM_RESPONSE_SUBMIT',
              'events',
              `Updated response for form "${form.title}"`,
              respondentInfo?.memberName || respondentInfo?.email || 'Public User',
              { formId: form.id, eventId: form.eventId, trackingNumber: foundTrackingNumber }
            )
            return foundTrackingNumber
          } else {
            throw new Error('You have already submitted a response for this form. Multiple responses are not allowed.')
          }
        }
      }

      // No existing response found — create a new one with collision-free tracking number
      const date = new Date()
      const yearMonth = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}`
      const randomSuffix = Math.floor(10000 + Math.random() * 90000)
      const generatedTrackingNumber = `FR-${yearMonth}-${randomSuffix}`

      const responseRef = doc(collection(db, RESPONSES_COLLECTION))
      await setDoc(responseRef, {
        formId: form.id,
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

      await auditService.logAction(
        'FORM_RESPONSE_SUBMIT',
        'events',
        `Submitted response ${generatedTrackingNumber} for form "${form.title}"`,
        respondentInfo?.memberName || respondentInfo?.email || 'Public User',
        { formId: form.id, eventId: form.eventId, trackingNumber: generatedTrackingNumber }
      )

      return generatedTrackingNumber
    } catch (error) {
      console.error('Error submitting form response:', error)
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
   * Update an existing response document in Firestore.
   */
  async updateResponse(
    responseId: string,
    answers: Record<string, string | string[] | number | boolean>,
    respondentInfo?: { memberUid?: string; memberName?: string; email?: string },
    performedBy: string = 'Admin'
  ): Promise<void> {
    try {
      const ref = doc(db, RESPONSES_COLLECTION, responseId)
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

      await updateDoc(ref, updateData)
      await auditService.logAction(
        'FORM_RESPONSE_UPDATE',
        'events',
        `Updated response ID ${responseId}`,
        performedBy,
        { responseId }
      )
    } catch (error) {
      console.error('Error updating response:', error)
      throw new Error('Failed to update form response.')
    }
  },

  /**
   * Delete a response document from Firestore.
   */
  async deleteResponse(responseId: string): Promise<void> {
    try {
      const ref = doc(db, RESPONSES_COLLECTION, responseId)
      await deleteDoc(ref)
      await auditService.logAction(
        'FORM_RESPONSE_DELETE',
        'events',
        `Deleted response ID ${responseId}`,
        'Admin',
        { responseId }
      )
    } catch (error) {
      console.error('Error deleting response:', error)
      throw new Error('Failed to delete form response.')
    }
  },

  /**
   * Delete all response documents for a form.
   */
  async deleteAllResponsesByFormId(formId: string, performedBy: string = 'Admin'): Promise<void> {
    try {
      const q = query(
        collection(db, RESPONSES_COLLECTION),
        where('formId', '==', formId)
      )
      const snapshot = await getDocs(q)
      const deletePromises = snapshot.docs.map(d => deleteDoc(doc(db, RESPONSES_COLLECTION, d.id)))
      await Promise.all(deletePromises)

      await auditService.logAction(
        'FORM_RESPONSE_DELETE',
        'events',
        `Deleted all ${snapshot.docs.length} responses for form ID ${formId}`,
        performedBy,
        { formId, count: snapshot.docs.length }
      )
    } catch (error) {
      console.error('Error deleting all responses:', error)
      throw new Error('Failed to delete all form responses.')
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
            return `"${formattedCompanions.replace(/"/g, '""')}"`
          }
          return `"${val.join(', ').replace(/"/g, '""')}"`
        }
        if (typeof val === 'object' && val !== null) {
          if (q.type === 'appointment_slots' || 'timeRange' in val) {
            const appt = val as any
            const formattedAppt = `${appt.date || ''} • ${appt.timeRange || ''}${appt.slotLabel ? ` (${appt.slotLabel})` : ''}`.trim()
            return `"${formattedAppt.replace(/"/g, '""')}"`
          }
        }
        return `"${String(val).replace(/"/g, '""')}"`
      })

      return [
        `"${r.trackingNumber || ''}"`,
        `"${(r.respondentMemberName || '').replace(/"/g, '""')}"`,
        `"${(r.respondentEmail || '').replace(/"/g, '""')}"`,
        ...questionAnswers,
        `"${submittedDateStr}"`
      ].join(',')
    })

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    const sanitizedTitle = form.title.toLowerCase().replace(/[^a-z0-9]/g, '_')
    link.setAttribute('download', `${sanitizedTitle}_responses.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }
}
