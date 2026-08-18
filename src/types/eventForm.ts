import type { Timestamp, FieldValue } from 'firebase/firestore'

export type FormStatus = 'draft' | 'published' | 'temporary_closed' | 'closed' | 'archived'

export type FormPurposeTag = 'registration' | 'survey' | 'consent' | 'order' | 'general'

export type ContactType = 'coordinator' | 'phone' | 'email' | 'messenger' | 'custom'

export interface FormContactItem {
  id: string
  type: ContactType
  label: string
  value: string
}

export interface EventForm {
  id?: string
  eventId: string
  title: string
  slug?: string
  description?: string
  purposeTag?: FormPurposeTag
  guidelines?: string
  contactPerson?: string
  contactInfo?: string
  contacts?: FormContactItem[]
  showEventBanner?: boolean
  status: FormStatus
  isPublic: boolean
  startAt?: string
  closeAt?: string
  confirmationMessage?: string
  allowEditResponse: boolean
  allowMultipleResponses: boolean
  createdByUid: string
  createdByName?: string
  createdAt?: Timestamp | FieldValue | string
  updatedAt?: Timestamp | FieldValue | string
  responsesCount?: number
}

export type QuestionType =
  | 'short_text'
  | 'long_text'
  | 'multiple_choice'
  | 'dropdown'
  | 'checkbox'
  | 'yes_no'
  | 'number'
  | 'date'
  | 'time'
  | 'name_selector'
  | 'member_selector'
  | 'relationship_selector'
  | 'companion_repeater'
  | 'section_header'

export interface CompanionEntry {
  id: string
  name: string
  memberId?: string
  relationship?: string
  notes?: string
}

export type ConditionOperator = 'equals' | 'not_equals' | 'is_filled' | 'is_empty' | 'contains'

export interface VisibilityCondition {
  questionId: string
  operator: ConditionOperator
  value: string
}

export interface EventFormQuestion {
  id: string
  formId: string
  eventId: string
  type: QuestionType
  question: string
  description?: string
  required: boolean
  order: number
  options?: string[]
  optionLimits?: Record<string, number>
  fullOptionBehavior?: 'disable' | 'hide'
  visibilityCondition?: VisibilityCondition
  memberFilterType?: 'all' | 'order' | 'rank'
  memberFilterValue?: string | string[]
  createdAt?: Timestamp | FieldValue | string
  updatedAt?: Timestamp | FieldValue | string
}

export type ResponseStatus = 'submitted' | 'draft'

export interface EventFormResponse {
  id?: string
  formId: string
  eventId: string
  trackingNumber: string
  respondentMemberUid?: string
  respondentMemberName?: string
  respondentEmail?: string
  answers: Record<string, string | string[] | number | boolean>
  status: ResponseStatus
  submittedAt?: Timestamp | FieldValue | string
  updatedAt?: Timestamp | FieldValue | string
}
