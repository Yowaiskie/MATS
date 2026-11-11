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
  | 'contact_number'
  | 'multiple_choice'
  | 'dropdown'
  | 'checkbox'
  | 'yes_no'
  | 'number'
  | 'date'
  | 'time'
  | 'appointment_slots'
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

export interface AppointmentTimeSlot {
  id: string
  startTime: string // e.g. "09:00 AM" or "09:00"
  endTime: string   // e.g. "10:00 AM" or "10:00"
  label?: string    // e.g. "Batch 1 (Morning Session)"
  maxCapacity?: number // 0 or undefined = unlimited
}

export interface AppointmentDateConfig {
  id: string
  date: string // YYYY-MM-DD
  label?: string // e.g. "Day 1 - Pax Tecum Retreat"
  slots: AppointmentTimeSlot[]
}

export interface AppointmentSlotAnswer {
  date: string       // "2026-12-10"
  dateLabel?: string // "Day 1 - Pax Tecum Retreat"
  slotId: string     // "slot_1"
  timeRange: string  // "09:00 AM - 10:00 AM"
  slotLabel?: string // "Batch 1"
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
  placeholder?: string
  required: boolean
  order: number
  options?: string[]
  hasOtherOption?: boolean
  otherOptionLabel?: string
  otherOptionPlaceholder?: string
  optionLimits?: Record<string, number>
  fullOptionBehavior?: 'disable' | 'hide'
  appointmentConfig?: AppointmentDateConfig[]
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
