import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  serverTimestamp,
  query,
  where
} from 'firebase/firestore'
import { db } from '@/firebase/config'
import type { EventFormQuestion } from '@/types/eventForm'

const QUESTIONS_COLLECTION = 'eventFormQuestions'

export const eventFormQuestionService = {
  /**
   * Get all questions for a specific form.
   */
  async getQuestionsByFormId(formId: string): Promise<EventFormQuestion[]> {
    try {
      const q = query(
        collection(db, QUESTIONS_COLLECTION),
        where('formId', '==', formId)
      )
      const snapshot = await getDocs(q)
      const questions = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      })) as EventFormQuestion[]

      // Sort by order ascending
      return questions.sort((a, b) => a.order - b.order)
    } catch (error) {
      console.error('Error fetching questions for form:', error)
      throw new Error('Failed to fetch form questions.')
    }
  },

  /**
   * Batch save / update questions for a form.
   * Compares existing questions to new set and deletes removed ones.
   */
  async saveQuestions(
    formId: string,
    eventId: string,
    questions: EventFormQuestion[],
    _performedBy: string = 'System'
  ): Promise<void> {
    try {
      const existing = await this.getQuestionsByFormId(formId)
      const newIds = new Set(questions.map(q => q.id).filter(Boolean))

      // Delete questions no longer present
      for (const ex of existing) {
        if (!newIds.has(ex.id)) {
          await deleteDoc(doc(db, QUESTIONS_COLLECTION, ex.id))
        }
      }

      // Save/Update questions
      for (let index = 0; index < questions.length; index++) {
        const q = questions[index]
        let qId = q.id
        if (!qId || qId === 'q_init_1') {
          qId = doc(collection(db, QUESTIONS_COLLECTION)).id
        }
        const docRef = doc(db, QUESTIONS_COLLECTION, qId)

        const fullQuestionData: Record<string, any> = {
          formId,
          eventId,
          type: q.type,
          question: q.question,
          description: q.description || '',
          required: q.required,
          order: index,
          options: q.options || [],
          updatedAt: serverTimestamp()
        }

        if (q.visibilityCondition && q.visibilityCondition.questionId) {
          fullQuestionData.visibilityCondition = q.visibilityCondition
        }
        if (q.memberFilterType) {
          fullQuestionData.memberFilterType = q.memberFilterType
          fullQuestionData.memberFilterValue = q.memberFilterValue || ''
        }
        if (q.optionLimits) {
          fullQuestionData.optionLimits = q.optionLimits
        }
        if (q.fullOptionBehavior) {
          fullQuestionData.fullOptionBehavior = q.fullOptionBehavior
        }
        if (q.appointmentConfig) {
          fullQuestionData.appointmentConfig = q.appointmentConfig
        }
        if (q.hasOtherOption !== undefined) {
          fullQuestionData.hasOtherOption = q.hasOtherOption
        }
        if (q.otherOptionLabel !== undefined) {
          fullQuestionData.otherOptionLabel = q.otherOptionLabel
        }
        if (q.otherOptionPlaceholder !== undefined) {
          fullQuestionData.otherOptionPlaceholder = q.otherOptionPlaceholder
        }
        if (q.placeholder !== undefined) {
          fullQuestionData.placeholder = q.placeholder
        }

        // Set complete document without merge so deleted/updated conditions overwrite cleanly
        await setDoc(docRef, fullQuestionData)
      }
    } catch (error) {
      console.error('Error saving form questions:', error)
      throw new Error('Failed to save form questions.')
    }
  }
}
