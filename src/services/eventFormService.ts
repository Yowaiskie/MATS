import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  where
} from 'firebase/firestore'
import { db } from '@/firebase/config'
import { auditService } from '@/services/auditService'
import type { EventForm, EventFormQuestion, FormStatus } from '@/types/eventForm'
import { eventFormQuestionService } from '@/services/eventFormQuestionService'

const FORMS_COLLECTION = 'eventForms'

export const eventFormService = {
  /**
   * Get all forms associated with a specific event ID.
   */
  async getFormsByEventId(eventId: string): Promise<EventForm[]> {
    try {
      const q = query(
        collection(db, FORMS_COLLECTION),
        where('eventId', '==', eventId)
      )
      const snapshot = await getDocs(q)
      const forms = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      })) as EventForm[]

      // Sort in memory by createdAt descending
      return forms.sort((a, b) => {
        const timeA = typeof a.createdAt === 'object' && a.createdAt && 'seconds' in a.createdAt ? (a.createdAt as any).seconds : 0
        const timeB = typeof b.createdAt === 'object' && b.createdAt && 'seconds' in b.createdAt ? (b.createdAt as any).seconds : 0
        return timeB - timeA
      })
    } catch (error) {
      console.error('Error fetching forms by event ID:', error)
      throw new Error('Failed to fetch event forms.')
    }
  },

  /**
   * Get a single form by ID or custom URL slug.
   */
  async getFormById(formIdOrSlug: string): Promise<EventForm | null> {
    try {
      // 1. Try querying by custom URL slug
      const q = query(
        collection(db, FORMS_COLLECTION),
        where('slug', '==', formIdOrSlug.toLowerCase().trim())
      )
      const snapshot = await getDocs(q)
      if (!snapshot.empty) {
        const d = snapshot.docs[0]
        return { id: d.id, ...d.data() } as EventForm
      }

      // 2. Fallback to document ID
      const docRef = doc(db, FORMS_COLLECTION, formIdOrSlug)
      const docSnap = await getDoc(docRef)
      if (!docSnap.exists()) return null
      return { id: docSnap.id, ...docSnap.data() } as EventForm
    } catch (error) {
      console.error('Error fetching form by ID or slug:', error)
      return null
    }
  },

  /**
   * Create a new form.
   */
  async createForm(
    formData: Omit<EventForm, 'id' | 'createdAt' | 'updatedAt'>,
    performedBy: string = 'System'
  ): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, FORMS_COLLECTION), {
        ...formData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      })

      await auditService.logAction(
        'FORM_CREATE',
        'events',
        `Created event form "${formData.title}"`,
        performedBy,
        { formId: docRef.id, eventId: formData.eventId, title: formData.title }
      )

      return docRef.id
    } catch (error) {
      console.error('Error creating form:', error)
      throw new Error('Failed to create form.')
    }
  },

  /**
   * Update an existing form.
   */
  async updateForm(
    formId: string,
    updates: Partial<EventForm>,
    performedBy: string = 'System'
  ): Promise<void> {
    try {
      const docRef = doc(db, FORMS_COLLECTION, formId)
      await updateDoc(docRef, {
        ...updates,
        updatedAt: serverTimestamp()
      })

      await auditService.logAction(
        'FORM_UPDATE',
        'events',
        `Updated event form ${formId}`,
        performedBy,
        { formId, ...updates }
      )
    } catch (error) {
      console.error('Error updating form:', error)
      throw new Error('Failed to update form.')
    }
  },

  /**
   * Change form status (draft, published, closed, archived).
   */
  async updateFormStatus(
    formId: string,
    status: FormStatus,
    performedBy: string = 'System'
  ): Promise<void> {
    try {
      const docRef = doc(db, FORMS_COLLECTION, formId)
      await updateDoc(docRef, {
        status,
        updatedAt: serverTimestamp()
      })

      const actionMap: Record<FormStatus, any> = {
        published: 'FORM_PUBLISH',
        draft: 'FORM_UNPUBLISH',
        closed: 'FORM_CLOSE',
        archived: 'FORM_ARCHIVE'
      }

      await auditService.logAction(
        actionMap[status] || 'FORM_UPDATE',
        'events',
        `Changed form status to ${status}`,
        performedBy,
        { formId, status }
      )
    } catch (error) {
      console.error('Error updating form status:', error)
      throw new Error('Failed to update form status.')
    }
  },

  /**
   * Duplicate an existing form along with its questions.
   */
  async duplicateForm(
    formId: string,
    performedBy: string = 'System'
  ): Promise<string> {
    try {
      const originalForm = await this.getFormById(formId)
      if (!originalForm) throw new Error('Original form not found.')

      const originalQuestions = await eventFormQuestionService.getQuestionsByFormId(formId)

      // Create new form in draft status
      const newFormId = await this.createForm(
        {
          eventId: originalForm.eventId,
          title: `${originalForm.title} (Copy)`,
          description: originalForm.description || '',
          status: 'draft',
          isPublic: originalForm.isPublic,
          startAt: originalForm.startAt || '',
          closeAt: originalForm.closeAt || '',
          confirmationMessage: originalForm.confirmationMessage || '',
          allowEditResponse: originalForm.allowEditResponse,
          allowMultipleResponses: originalForm.allowMultipleResponses,
          createdByUid: originalForm.createdByUid,
          createdByName: originalForm.createdByName || ''
        },
        performedBy
      )

      // Duplicate questions mapping old question IDs to new ones
      if (originalQuestions.length > 0) {
        const idMap: Record<string, string> = {}
        const clonedQuestions: EventFormQuestion[] = originalQuestions.map(q => {
          const newQId = `q_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
          if (q.id) idMap[q.id] = newQId
          return {
            ...q,
            id: newQId,
            formId: newFormId
          }
        })

        // Remap visibilityCondition questionId if referenced
        clonedQuestions.forEach(cq => {
          if (cq.visibilityCondition && cq.visibilityCondition.questionId && idMap[cq.visibilityCondition.questionId]) {
            cq.visibilityCondition = {
              ...cq.visibilityCondition,
              questionId: idMap[cq.visibilityCondition.questionId]
            }
          }
        })

        await eventFormQuestionService.saveQuestions(newFormId, originalForm.eventId, clonedQuestions, performedBy)
      }

      await auditService.logAction(
        'FORM_DUPLICATE',
        'events',
        `Duplicated form ${formId} to ${newFormId}`,
        performedBy,
        { sourceFormId: formId, newFormId }
      )

      return newFormId
    } catch (error) {
      console.error('Error duplicating form:', error)
      throw new Error('Failed to duplicate form.')
    }
  },

  /**
   * Delete a form.
   */
  async deleteForm(formId: string, performedBy: string = 'System'): Promise<void> {
    try {
      const docRef = doc(db, FORMS_COLLECTION, formId)
      await deleteDoc(docRef)

      await auditService.logAction(
        'FORM_ARCHIVE',
        'events',
        `Deleted form ${formId}`,
        performedBy,
        { formId }
      )
    } catch (error) {
      console.error('Error deleting form:', error)
      throw new Error('Failed to delete form.')
    }
  }
}
