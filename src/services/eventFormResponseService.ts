import {
  collection,
  doc,
  getDocs,
  deleteDoc,
  serverTimestamp,
  runTransaction,
  query,
  where
} from 'firebase/firestore'
import { db } from '@/firebase/config'
import { auditService } from '@/services/auditService'
import type { EventForm, EventFormQuestion, EventFormResponse } from '@/types/eventForm'

const RESPONSES_COLLECTION = 'eventFormResponses'
const COUNTERS_COLLECTION = 'counters'
const COUNTER_DOC = 'eventFormResponseSequence'

export const eventFormResponseService = {
  /**
   * Submit a new response for a form.
   * Generates a safe tracking number via transactional sequence counter.
   */
  async submitResponse(
    form: EventForm,
    answers: Record<string, string | string[] | number | boolean>,
    respondentInfo?: { memberUid?: string; memberName?: string; email?: string }
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

      const trackingNumber = await runTransaction(db, async (transaction) => {
        const counterRef = doc(db, COUNTERS_COLLECTION, COUNTER_DOC)
        const counterDoc = await transaction.get(counterRef)

        let currentCount = 0
        if (counterDoc.exists()) {
          currentCount = counterDoc.data().currentSeq || 0
        }

        const newCount = currentCount + 1
        const date = new Date()
        const yearMonth = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}`
        const paddedCount = newCount.toString().padStart(5, '0')
        const generatedTrackingNumber = `FR-${yearMonth}-${paddedCount}`

        if (counterDoc.exists()) {
          transaction.update(counterRef, { currentSeq: newCount })
        } else {
          transaction.set(counterRef, { currentSeq: newCount })
        }

        const responseRef = doc(collection(db, RESPONSES_COLLECTION))
        transaction.set(responseRef, {
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

        return generatedTrackingNumber
      })

      await auditService.logAction(
        'FORM_RESPONSE_SUBMIT',
        'events',
        `Submitted response ${trackingNumber} for form "${form.title}"`,
        respondentInfo?.memberName || respondentInfo?.email || 'Public User',
        { formId: form.id, eventId: form.eventId, trackingNumber }
      )

      return trackingNumber
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
          return `"${val.join(', ').replace(/"/g, '""')}"`
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
