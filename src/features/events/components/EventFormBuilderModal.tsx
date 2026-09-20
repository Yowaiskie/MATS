import React, { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type {
  EventForm,
  EventFormQuestion,
  QuestionType,
  ConditionOperator,
  FormPurposeTag,
  FormContactItem,
  ContactType
} from '@/types/eventForm'
import { eventFormService } from '@/services/eventFormService'
import { eventFormQuestionService } from '@/services/eventFormQuestionService'
import { useAuth } from '@/features/authentication/AuthContext'
import { ConfirmModal, FormattedText, RichTextEditor, CustomSelect, Button, useToast } from '@/components'

interface EventFormBuilderModalProps {
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
  eventId: string
  formToEdit?: EventForm | null
}

const QUESTION_TYPES: { type: QuestionType; label: string; group: string; description: string }[] = [
  { type: 'short_text', label: 'Short Text', group: 'Text & Input', description: 'Single line text answer' },
  { type: 'long_text', label: 'Long Text (Paragraph)', group: 'Text & Input', description: 'Multi-line detailed answer' },
  { type: 'multiple_choice', label: 'Multiple Choice', group: 'Choices', description: 'Select 1 option from a list' },
  { type: 'checkbox', label: 'Checkboxes', group: 'Choices', description: 'Select 1 or more options' },
  { type: 'dropdown', label: 'Dropdown', group: 'Choices', description: 'Select 1 option from a menu' },
  { type: 'yes_no', label: 'Yes / No', group: 'Choices', description: 'Binary choice' },
  { type: 'number', label: 'Number', group: 'Text & Input', description: 'Numeric value or age' },
  { type: 'date', label: 'Date', group: 'Date & Time', description: 'Date selection input' },
  { type: 'time', label: 'Time', group: 'Date & Time', description: 'Time selection input' },
  { type: 'name_selector', label: 'Participant Name', group: 'MATS Selectors', description: 'Full name of respondent' },
  { type: 'member_selector', label: 'Member Selector', group: 'MATS Selectors', description: 'Select active member from MATS DB' },
  { type: 'relationship_selector', label: 'Relationship Selector', group: 'MATS Selectors', description: 'Relationship to participant' },
  { type: 'companion_repeater', label: 'Companions / Group List', group: 'MATS Selectors', description: 'Register multiple family members' },
  { type: 'section_header', label: 'Section Header / Divider', group: 'Layout', description: 'Add section title or visual divider' }
]

const CONTACT_PRESETS: { type: ContactType; label: string; placeholder: string; defaultLabel: string }[] = [
  { type: 'phone', label: 'Phone / Mobile', placeholder: 'e.g. 0917-123-4567', defaultLabel: 'Phone / Mobile' },
  { type: 'coordinator', label: 'Coordinator Name', placeholder: 'e.g. Bro. Mark Santos', defaultLabel: 'Coordinator' },
  { type: 'email', label: 'Email Address', placeholder: 'e.g. youth@parish.org', defaultLabel: 'Email' },
  { type: 'messenger', label: 'Messenger / FB', placeholder: 'e.g. m.me/MATSYouth or FB Page link', defaultLabel: 'Messenger' },
  { type: 'custom', label: 'Custom Contact', placeholder: 'e.g. Parish Office Room 204', defaultLabel: 'Contact Info' }
]

const ORDER_GROUP_OPTIONS = [
  'Order of San Pedro',
  'Order of San Juan',
  'Order of San Tiago',
  'Order of San Andres',
  'Officers',
  'Squires'
]

const RANK_OPTIONS = ['Chevaliers', 'Paladins', 'Squires']

// Clean SVG Icons (Zero Emojis)
const QuestionTypeIcon: React.FC<{ type: QuestionType; className?: string }> = ({ type, className = 'w-4 h-4' }) => {
  switch (type) {
    case 'short_text':
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h10M4 18h7" />
        </svg>
      )
    case 'long_text':
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h10" />
        </svg>
      )
    case 'multiple_choice':
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="4" fill="currentColor" />
        </svg>
      )
    case 'checkbox':
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <rect x="3" y="3" width="18" height="18" rx="4" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12l3 3 5-6" />
        </svg>
      )
    case 'dropdown':
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l4 4 4-4m-8 6l4 4 4-4" />
        </svg>
      )
    case 'yes_no':
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
      )
    case 'number':
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
        </svg>
      )
    case 'date':
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      )
    case 'time':
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    case 'name_selector':
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      )
    case 'member_selector':
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      )
    case 'relationship_selector':
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
      )
    case 'companion_repeater':
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
        </svg>
      )
    case 'section_header':
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16m-7 6h7" />
        </svg>
      )
    default:
      return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
  }
}

export const EventFormBuilderModal: React.FC<EventFormBuilderModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  eventId,
  formToEdit
}) => {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState<'questions' | 'settings'>('questions')
  const [saving, setSaving] = useState(false)
  const [showSaveConfirm, setShowSaveConfirm] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [showConditionEditorId, setShowConditionEditorId] = useState<string | null>(null)

  // Form Metadata State
  const [title, setTitle] = useState(formToEdit?.title || 'New Event Registration Form')
  const [slug, setSlug] = useState(formToEdit?.slug || '')
  const [description, setDescription] = useState(formToEdit?.description || '')
  const [purposeTag, setPurposeTag] = useState<FormPurposeTag>(formToEdit?.purposeTag || 'registration')
  const [guidelines, setGuidelines] = useState(formToEdit?.guidelines || '')
  const [contacts, setContacts] = useState<FormContactItem[]>(() => {
    if (formToEdit?.contacts && formToEdit.contacts.length > 0) {
      return formToEdit.contacts
    }
    const initial: FormContactItem[] = []
    if (formToEdit?.contactPerson) {
      initial.push({
        id: 'init_1',
        type: 'coordinator',
        label: 'Coordinator',
        value: formToEdit.contactPerson
      })
    }
    if (formToEdit?.contactInfo) {
      initial.push({
        id: 'init_2',
        type: 'phone',
        label: 'Phone / Mobile',
        value: formToEdit.contactInfo
      })
    }
    return initial
  })
  const [showEventBanner, setShowEventBanner] = useState(formToEdit?.showEventBanner ?? true)
  const [status, setStatus] = useState<EventForm['status']>(formToEdit?.status || 'draft')
  const [isPublic, setIsPublic] = useState(formToEdit?.isPublic ?? true)
  const [startAt, setStartAt] = useState(formToEdit?.startAt || '')
  const [closeAt, setCloseAt] = useState(formToEdit?.closeAt || '')
  const [confirmationMessage, setConfirmationMessage] = useState(
    formToEdit?.confirmationMessage || 'Thank you for submitting your response.'
  )
  const [allowEditResponse, setAllowEditResponse] = useState(formToEdit?.allowEditResponse ?? false)
  const [allowMultipleResponses, setAllowMultipleResponses] = useState(formToEdit?.allowMultipleResponses ?? true)

  // Questions State
  const [questions, setQuestions] = useState<EventFormQuestion[]>([])
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null)

  useEffect(() => {
    if (formToEdit?.id) {
      queryClient
        .fetchQuery({
          queryKey: ['event-form-questions', formToEdit.id],
          queryFn: () => eventFormQuestionService.getQuestionsByFormId(formToEdit.id!),
          staleTime: 1000 * 60 * 3
        })
        .then(qs => {
          setQuestions(qs)
          if (qs.length > 0) setActiveQuestionId(qs[0].id)
        })
    } else {
      const initQId = `q_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
      const defaultQ: EventFormQuestion = {
        id: initQId,
        formId: '',
        eventId,
        type: 'member_selector',
        question: 'Select Participant Name',
        description: 'Please select your registered MATS member profile',
        required: true,
        order: 0
      }
      setQuestions([defaultQ])
      setActiveQuestionId(initQId)
    }
  }, [formToEdit, eventId, queryClient])

  if (!isOpen) return null

  const handleAddContact = (type: ContactType = 'phone') => {
    const preset = CONTACT_PRESETS.find(p => p.type === type) || CONTACT_PRESETS[0]
    setContacts(prev => [
      ...prev,
      {
        id: 'cnt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        type,
        label: preset.defaultLabel,
        value: ''
      }
    ])
  }

  const handleUpdateContact = (id: string, updates: Partial<FormContactItem>) => {
    setContacts(prev => prev.map(c => (c.id === id ? { ...c, ...updates } : c)))
  }

  const handleDeleteContact = (id: string) => {
    setContacts(prev => prev.filter(c => c.id !== id))
  }

  const handleAddQuestion = (type: QuestionType = 'short_text', afterIndex?: number) => {
    const newId = `q_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`
    const defaultOptions =
      type === 'relationship_selector'
        ? ['Guardian', 'Parent', 'Sibling', 'Relative']
        : type === 'multiple_choice' || type === 'dropdown' || type === 'checkbox'
        ? ['Option 1', 'Option 2']
        : undefined

    const newQuestion: EventFormQuestion = {
      id: newId,
      formId: formToEdit?.id || '',
      eventId,
      type,
      question: `New ${QUESTION_TYPES.find(t => t.type === type)?.label || 'Question'}`,
      description: '',
      required: false,
      order: questions.length,
      options: defaultOptions
    }

    if (afterIndex !== undefined && afterIndex >= 0 && afterIndex < questions.length) {
      const updated = [...questions]
      updated.splice(afterIndex + 1, 0, newQuestion)
      setQuestions(updated.map((q, i) => ({ ...q, order: i })))
    } else {
      setQuestions([...questions, newQuestion])
    }

    setActiveQuestionId(newId)
  }

  const handleMoveQuestion = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= questions.length) return
    const updated = [...questions]
    const temp = updated[index]
    updated[index] = updated[targetIndex]
    updated[targetIndex] = temp
    setQuestions(updated.map((q, i) => ({ ...q, order: i })))
  }

  const handleDuplicateQuestion = (q: EventFormQuestion) => {
    const newId = `q_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`
    const dup: EventFormQuestion = {
      ...q,
      id: newId,
      question: `${q.question} (Copy)`,
      order: questions.length
    }
    const idx = questions.findIndex(item => item.id === q.id)
    if (idx !== -1) {
      const updated = [...questions]
      updated.splice(idx + 1, 0, dup)
      setQuestions(updated.map((item, i) => ({ ...item, order: i })))
    } else {
      setQuestions([...questions, dup])
    }
    setActiveQuestionId(newId)
  }

  const handleDeleteQuestion = (id: string) => {
    if (questions.length <= 1) {
      toast.warning('Form Validation', 'A form must contain at least one question.')
      return
    }
    const filtered = questions.filter(q => q.id !== id)
    setQuestions(filtered.map((q, i) => ({ ...q, order: i })))
    if (activeQuestionId === id) {
      setActiveQuestionId(filtered[0]?.id || null)
    }
  }

  const handleUpdateQuestion = (id: string, updates: Partial<EventFormQuestion>) => {
    setQuestions(questions.map(q => (q.id === id ? { ...q, ...updates } : q)))
  }

  const handleSave = async () => {
    if (!title.trim()) {
      toast.warning('Form Title Required', 'Please enter a title for this form.')
      return
    }

    setSaving(true)
    try {
      let formId = formToEdit?.id
      const cleanSlug = (slug.trim() || title.trim())
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')

      if (cleanSlug) {
        const existingFormWithSlug = await eventFormService.getFormById(cleanSlug)
        if (existingFormWithSlug && existingFormWithSlug.id !== formId) {
          toast.error(
            'Slug Unavailable',
            `The custom link URL slug "${cleanSlug}" is already in use by another form. Please choose a different link or title.`
          )
          setSaving(false)
          return
        }
      }

      const validContacts = contacts
        .map(c => ({ ...c, label: c.label.trim(), value: c.value.trim() }))
        .filter(c => c.value.length > 0)

      const firstCoord = validContacts.find(c => c.type === 'coordinator')?.value || ''
      const firstPhone = validContacts.find(c => c.type === 'phone' || c.type === 'email')?.value || ''

      const formPayload: Omit<EventForm, 'id' | 'createdAt' | 'updatedAt'> = {
        eventId,
        title: title.trim(),
        slug: cleanSlug,
        description: description.trim(),
        purposeTag,
        guidelines: guidelines.trim(),
        contactPerson: firstCoord,
        contactInfo: firstPhone,
        contacts: validContacts,
        showEventBanner,
        status,
        isPublic,
        startAt,
        closeAt,
        confirmationMessage: confirmationMessage.trim(),
        allowEditResponse,
        allowMultipleResponses,
        createdByUid: profile?.uid || 'system',
        createdByName: profile?.displayName || profile?.email || 'Organizer'
      }

      if (formId) {
        await eventFormService.updateForm(formId, formPayload, profile?.email || 'Organizer')
        toast.success('Form Updated', `"${title.trim()}" has been updated successfully.`)
      } else {
        formId = await eventFormService.createForm(formPayload, profile?.email || 'Organizer')
        toast.success('Form Created', `"${title.trim()}" has been created successfully.`)
      }

      // Save questions
      await eventFormQuestionService.saveQuestions(formId, eventId, questions, profile?.email || 'Organizer')
      await queryClient.invalidateQueries({ queryKey: ['event-forms', eventId] })
      await queryClient.invalidateQueries({ queryKey: ['event-form-questions', formId] })
      await queryClient.invalidateQueries({ queryKey: ['event-form-response-counts', eventId] })

      onSaved()
      onClose()
    } catch (err) {
      console.error('Failed to save form:', err)
      toast.error('Save Failed', 'Failed to save form. Please check permissions and try again.')
    } finally {
      setSaving(false)
    }
  }

  const activeIndex = questions.findIndex(q => q.id === activeQuestionId)

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-md flex items-center justify-center sm:p-4 animate-in fade-in duration-200">
      <div className="bg-slate-100 w-full max-w-5xl h-[100dvh] sm:h-[92vh] rounded-none sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden border-0 sm:border border-slate-200/80">
        
        {/* ========================================================================= */}
        {/* TOP NAVIGATION BAR (GOOGLE FORMS SIGNATURE HEADER) */}
        {/* ========================================================================= */}
        <header className="px-3 sm:px-6 py-2.5 sm:py-3 bg-white border-b border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shrink-0 shadow-2xs">
          
          {/* Top Row on Mobile: Form Info + Actions */}
          <div className="flex items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-1.5 sm:px-2 py-0.5 rounded-md border border-indigo-100">
                    Form Builder
                  </span>
                  <span className="text-[10px] font-bold text-slate-400">
                    {formToEdit ? 'Edit' : 'Draft'}
                  </span>
                </div>
                <h2 className="text-xs sm:text-base font-black text-slate-900 truncate">
                  {title || 'Untitled Form'}
                </h2>
              </div>
            </div>

            {/* Right Action Buttons */}
            <div className="flex items-center space-x-2 shrink-0">
              <Button
                type="button"
                variant="secondary"
                size="dense"
                onClick={() => setShowCancelConfirm(true)}
              >
                Cancel
              </Button>

              <Button
                type="button"
                variant="primary"
                size="dense"
                onClick={() => setShowSaveConfirm(true)}
                loading={saving}
                icon={
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                }
              >
                Save
              </Button>
            </div>
          </div>

          {/* Center Tabs: Questions & Settings */}
          <div className="flex items-center justify-center bg-slate-100 p-1 rounded-xl border border-slate-200 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setActiveTab('questions')}
              className={`flex-1 sm:flex-initial px-3 sm:px-5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'questions'
                  ? 'bg-white text-indigo-600 shadow-xs font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Questions</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className={`flex-1 sm:flex-initial px-3 sm:px-5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'settings'
                  ? 'bg-white text-indigo-600 shadow-xs font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>Settings</span>
            </button>
          </div>

        </header>

        {/* ========================================================================= */}
        {/* TAB 1: QUESTIONS CANVAS (CENTERED WORKSPACE + FLOATING ACTIONS) */}
        {/* ========================================================================= */}
        {activeTab === 'questions' && (
          <div className="flex-1 overflow-y-auto p-3 sm:p-6 pb-28 sm:pb-12">
            <div className="max-w-4xl mx-auto flex items-start gap-4">
              
              {/* Form Cards Column */}
              <div className="flex-1 space-y-4">
                
                {/* 1. TOP FORM HEADER CARD */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden border-t-8 border-t-indigo-600 p-5 sm:p-7 space-y-5">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                      Form Title
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      placeholder="e.g. Parish Youth Pilgrimage 2026 Registration"
                      className="w-full text-xl sm:text-2xl font-black text-slate-900 border-b border-transparent hover:border-slate-300 focus:border-indigo-600 focus:outline-hidden pb-1 transition-colors"
                    />
                  </div>

                  {/* Purpose Category Tags */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Purpose / Form Category
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { key: 'registration', label: 'Registration / RSVP' },
                        { key: 'survey', label: 'Survey / Feedback' },
                        { key: 'consent', label: 'Consent / Permission' },
                        { key: 'order', label: 'Order / Merchandise' },
                        { key: 'general', label: 'General Form' }
                      ].map(tag => (
                        <button
                          key={tag.key}
                          type="button"
                          onClick={() => setPurposeTag(tag.key as FormPurposeTag)}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                            purposeTag === tag.key
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {tag.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Custom URL Slug */}
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500">
                      Custom Public Link URL
                    </label>
                    <div className="flex items-center text-xs font-mono text-slate-500 overflow-x-auto">
                      <span className="shrink-0 text-slate-400 font-semibold select-none">.../public/forms/</span>
                      <input
                        type="text"
                        value={slug}
                        onChange={e => setSlug(e.target.value)}
                        placeholder={(title || 'form-title').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}
                        className="flex-1 p-1 bg-white border border-slate-300 rounded-md text-xs font-bold text-indigo-600 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden min-w-[140px]"
                      />
                    </div>
                  </div>

                  {/* Description & Objective */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500">
                      Form Purpose & Description
                    </label>
                    <RichTextEditor
                      value={description}
                      onChange={setDescription}
                      placeholder="Explain what this form is for (e.g. Schedule, Venue, Required items)..."
                      minHeight="min-h-[4.5rem]"
                    />
                  </div>

                  {/* Guidelines Box */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black uppercase tracking-wider text-amber-800">
                      Guidelines & Important Reminders
                    </label>
                    <RichTextEditor
                      value={guidelines}
                      onChange={setGuidelines}
                      placeholder="Enter guidelines or important reminders (e.g. attire, deadlines, what to bring)..."
                      minHeight="min-h-[4.5rem]"
                      className="border-amber-200 bg-amber-50/20"
                    />
                  </div>

                  {/* Event Banner & Dynamic Contacts */}
                  <div className="pt-2 border-t border-slate-100 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-slate-800">Show Event Date & Venue Banner</span>
                        <p className="text-[10px] text-slate-400">Displays event schedule and venue on public form header.</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={showEventBanner}
                        onChange={e => setShowEventBanner(e.target.checked)}
                        className="h-4 w-4 text-indigo-600 rounded-md border-slate-300 cursor-pointer"
                      />
                    </div>

                    {/* Contacts List */}
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center justify-between">
                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500">
                          Contact & Coordinator Details
                        </label>
                        <button
                          type="button"
                          onClick={() => handleAddContact('phone')}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold rounded-lg transition cursor-pointer"
                        >
                          + Add Contact
                        </button>
                      </div>

                      {contacts.length === 0 ? (
                        <div className="p-3 bg-slate-50/70 border border-dashed border-slate-200 rounded-xl text-center">
                          <p className="text-xs text-slate-400">No contact info added yet.</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {contacts.map((c, cIdx) => {
                            const currentPreset = CONTACT_PRESETS.find(p => p.type === c.type)
                            return (
                              <div key={c.id || cIdx} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center space-x-1.5 flex-1">
                                    <div className="w-44 shrink-0">
                                      <CustomSelect
                                        value={c.type}
                                        onChange={e => {
                                          const nextType = e.target.value as ContactType
                                          const pr = CONTACT_PRESETS.find(p => p.type === nextType)
                                          handleUpdateContact(c.id, {
                                            type: nextType,
                                            label: pr ? pr.defaultLabel : c.label
                                          })
                                        }}
                                        options={CONTACT_PRESETS.map(p => ({ value: p.type, label: p.label }))}
                                        className="!h-8 text-xs font-semibold"
                                      />
                                    </div>

                                    <input
                                      type="text"
                                      value={c.label}
                                      onChange={e => handleUpdateContact(c.id, { label: e.target.value })}
                                      placeholder="Label"
                                      className="w-28 p-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-700 focus:outline-hidden"
                                    />
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => handleDeleteContact(c.id)}
                                    className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition cursor-pointer"
                                    title="Remove Contact"
                                  >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </div>

                                <input
                                  type="text"
                                  value={c.value}
                                  onChange={e => handleUpdateContact(c.id, { value: e.target.value })}
                                  placeholder={currentPreset?.placeholder || 'Enter contact info...'}
                                  className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                                />
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 2. QUESTION CARDS LIST */}
                {questions.map((q, idx) => {
                  const isActive = q.id === activeQuestionId
                  const typeObj = QUESTION_TYPES.find(t => t.type === q.type)
                  const isSectionHeader = q.type === 'section_header'

                  // =========================================================
                  // ACTIVE QUESTION CARD (IN-PLACE GOOGLE FORMS EDITING)
                  // =========================================================
                  if (isActive) {
                    return (
                      <div
                        key={q.id}
                        className="bg-white rounded-2xl border-2 border-indigo-500 border-l-8 border-l-indigo-600 shadow-xl p-5 sm:p-6 space-y-5 transition-all relative"
                      >
                        {/* Top Grip & Move Bar */}
                        <div className="flex items-center justify-between -mt-2">
                          <div className="text-slate-400 text-[11px] font-black uppercase tracking-wider flex items-center gap-2">
                            <span className="w-5 h-5 rounded-md bg-indigo-50 text-indigo-600 flex items-center justify-center font-extrabold text-[10px]">
                              {idx + 1}
                            </span>
                            <span className="text-slate-700">{typeObj?.label}</span>
                          </div>

                          <div className="flex items-center space-x-1">
                            <button
                              type="button"
                              onClick={() => handleMoveQuestion(idx, 'up')}
                              disabled={idx === 0}
                              className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20 cursor-pointer text-xs font-bold"
                              title="Move Up"
                            >
                              Up
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveQuestion(idx, 'down')}
                              disabled={idx === questions.length - 1}
                              className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20 cursor-pointer text-xs font-bold"
                              title="Move Down"
                            >
                              Down
                            </button>
                          </div>
                        </div>

                        {/* Question Title & Inline Type Dropdown */}
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                          <div className="flex-1 w-full">
                            <input
                              type="text"
                              value={q.question}
                              onChange={e => handleUpdateQuestion(q.id, { question: e.target.value })}
                              placeholder={isSectionHeader ? 'Section Title (e.g. Part 1: Participant Info)' : 'Question Title...'}
                              className="w-full text-base sm:text-lg font-black text-slate-900 bg-slate-50 hover:bg-slate-100 focus:bg-white border-b-2 border-indigo-600 focus:outline-hidden p-2 rounded-t-lg transition"
                            />
                          </div>

                          {/* Inline Question Type Selector with Uniform MATS UI */}
                          <div className="w-full sm:w-64 shrink-0">
                            <CustomSelect
                              value={q.type}
                              onChange={e => {
                                const nextType = e.target.value as QuestionType
                                let newOpts = q.options
                                if (
                                  ['multiple_choice', 'checkbox', 'dropdown', 'relationship_selector'].includes(nextType) &&
                                  (!newOpts || newOpts.length === 0)
                                ) {
                                  newOpts = nextType === 'relationship_selector'
                                    ? ['Guardian', 'Parent', 'Sibling', 'Relative']
                                    : ['Option 1', 'Option 2']
                                }
                                handleUpdateQuestion(q.id, { type: nextType, options: newOpts })
                              }}
                              options={QUESTION_TYPES.map(t => ({
                                value: t.type,
                                label: t.label,
                                description: t.description,
                                icon: <QuestionTypeIcon type={t.type} className="w-4 h-4 text-indigo-600" />
                              }))}
                              icon={<QuestionTypeIcon type={q.type} className="w-4 h-4 text-indigo-600" />}
                              className="!h-10 text-xs font-bold"
                            />
                          </div>
                        </div>

                        {/* Description / Instructions */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                            {isSectionHeader ? 'Section Description / Instructions' : 'Description / Helper Text'}
                          </label>
                          <RichTextEditor
                            value={q.description || ''}
                            onChange={(val: string) => handleUpdateQuestion(q.id, { description: val })}
                            placeholder={isSectionHeader ? 'Optional section instructions...' : 'Optional help text for respondents...'}
                            minHeight="min-h-[3.5rem]"
                            compact
                          />
                        </div>

                        {/* TYPE SPECIFIC IN-CARD EDITORS */}
                        {/* Choice Types & Slot Limits */}
                        {['multiple_choice', 'checkbox', 'dropdown', 'relationship_selector'].includes(q.type) && (
                          <div className="space-y-2.5 pt-1">
                            <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
                              <span>Options & Slot Limits</span>
                              <span className="text-[10px] text-slate-400">Leave Max blank for unlimited</span>
                            </div>

                            <div className="space-y-2">
                              {(q.options || []).map((opt, oIdx) => {
                                const currentLimit = q.optionLimits?.[opt]
                                return (
                                  <div key={oIdx} className="flex flex-wrap sm:flex-nowrap items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
                                    <div className="flex items-center gap-2 flex-1 min-w-[160px]">
                                      <span className="text-slate-400 text-xs px-1 select-none shrink-0">
                                        {q.type === 'checkbox' ? '□' : q.type === 'dropdown' ? `${oIdx + 1}.` : '○'}
                                      </span>
                                      <input
                                        type="text"
                                        value={opt}
                                        onChange={e => {
                                          const newOpts = [...(q.options || [])]
                                          const oldVal = newOpts[oIdx]
                                          const newVal = e.target.value
                                          newOpts[oIdx] = newVal
                                          const newLimits = { ...(q.optionLimits || {}) }
                                          if (oldVal && oldVal !== newVal && newLimits[oldVal] !== undefined) {
                                            newLimits[newVal] = newLimits[oldVal]
                                            delete newLimits[oldVal]
                                          }
                                          handleUpdateQuestion(q.id, { options: newOpts, optionLimits: newLimits })
                                        }}
                                        placeholder="Option name / Category"
                                        className="flex-1 min-w-0 p-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                                      />
                                    </div>

                                    <div className="flex items-center justify-end gap-2 ml-auto shrink-0">
                                      {/* Slot Limit Input */}
                                      <div className="flex items-center gap-1 bg-indigo-50/80 border border-indigo-200 rounded-lg px-2 py-1" title="Max slots allowed for this option">
                                        <span className="text-[9px] font-black uppercase text-indigo-700">Max:</span>
                                        <input
                                          type="number"
                                          min="1"
                                          value={currentLimit ?? ''}
                                          onChange={e => {
                                            const val = e.target.value.trim() === '' ? undefined : parseInt(e.target.value, 10)
                                            const newLimits = { ...(q.optionLimits || {}) }
                                            if (val === undefined || isNaN(val) || val <= 0) {
                                              delete newLimits[opt]
                                            } else {
                                              newLimits[opt] = val
                                            }
                                            handleUpdateQuestion(q.id, { optionLimits: newLimits })
                                          }}
                                          placeholder="∞"
                                          className="w-9 text-xs font-black text-indigo-900 bg-transparent text-center focus:outline-hidden"
                                        />
                                      </div>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          const optToDelete = (q.options || [])[oIdx]
                                          const newOpts = (q.options || []).filter((_, i) => i !== oIdx)
                                          const newLimits = { ...(q.optionLimits || {}) }
                                          if (optToDelete && newLimits[optToDelete] !== undefined) {
                                            delete newLimits[optToDelete]
                                          }
                                          handleUpdateQuestion(q.id, { options: newOpts, optionLimits: newLimits })
                                        }}
                                        className="p-1 text-slate-400 hover:text-red-600 rounded-md transition cursor-pointer"
                                        title="Remove option"
                                      >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                      </button>
                                    </div>
                                  </div>
                                )
                              })}

                              {/* "Other" Option Row in Builder */}
                              {q.hasOtherOption && (
                                <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 bg-indigo-50/60 p-2 rounded-xl border border-indigo-200 animate-in fade-in duration-150">
                                  <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                                    <span className="text-indigo-500 font-bold text-xs px-1 select-none shrink-0">
                                      {q.type === 'checkbox' ? '□' : q.type === 'dropdown' ? `${(q.options || []).length + 1}.` : '○'}
                                    </span>
                                    <div className="flex items-center gap-1.5 flex-1">
                                      <input
                                        type="text"
                                        value={q.otherOptionLabel ?? 'Other'}
                                        onChange={e => handleUpdateQuestion(q.id, { otherOptionLabel: e.target.value })}
                                        placeholder="Other"
                                        className="w-28 p-1.5 bg-white border border-indigo-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 shadow-2xs"
                                        title="Option label shown to respondents"
                                      />
                                      <span className="text-slate-400 font-bold text-xs">:</span>
                                      <input
                                        type="text"
                                        value={q.otherOptionPlaceholder ?? ''}
                                        onChange={e => handleUpdateQuestion(q.id, { otherOptionPlaceholder: e.target.value })}
                                        placeholder="Please specify... (custom placeholder / prompt)"
                                        className="flex-1 min-w-0 p-1.5 bg-white border border-indigo-300 rounded-lg text-xs font-medium text-slate-700 placeholder:italic placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 shadow-2xs"
                                        title="Custom prompt / placeholder for specify field"
                                      />
                                    </div>
                                  </div>

                                  <div className="flex items-center justify-end gap-2 ml-auto shrink-0">
                                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100/80 px-2 py-0.5 rounded-md">
                                      Custom Input
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        handleUpdateQuestion(q.id, {
                                          hasOtherOption: false,
                                          otherOptionLabel: undefined,
                                          otherOptionPlaceholder: undefined
                                        })
                                      }}
                                      className="p-1 text-slate-400 hover:text-red-600 rounded-md transition cursor-pointer"
                                      title="Remove 'Other' option"
                                    >
                                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => {
                                  const opts = q.options || []
                                  handleUpdateQuestion(q.id, { options: [...opts, `Option ${opts.length + 1}`] })
                                }}
                                className="text-xs font-bold text-indigo-600 hover:underline cursor-pointer inline-flex items-center gap-1"
                              >
                                + Add Option
                              </button>

                              {!q.hasOtherOption && (
                                <>
                                  <span className="text-xs text-slate-400 select-none">or</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleUpdateQuestion(q.id, {
                                        hasOtherOption: true,
                                        otherOptionLabel: 'Other',
                                        otherOptionPlaceholder: 'Please specify...'
                                      })
                                    }}
                                    className="text-xs font-bold text-indigo-600 hover:underline cursor-pointer inline-flex items-center gap-1"
                                  >
                                    add &quot;Other&quot;
                                  </button>
                                </>
                              )}
                            </div>

                            {/* Full Option Behavior */}
                            {q.optionLimits && Object.keys(q.optionLimits).length > 0 && (
                              <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl space-y-2 mt-2">
                                <label className="text-[11px] font-bold text-slate-700 block">
                                  When Option Reaches Max Limit:
                                </label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  <label
                                    className={`flex items-center gap-1.5 p-2 rounded-lg border text-xs cursor-pointer transition ${
                                      (q.fullOptionBehavior || 'disable') === 'disable'
                                        ? 'bg-indigo-100/80 border-indigo-400 text-indigo-900 font-bold'
                                        : 'bg-white border-slate-200 text-slate-600'
                                    }`}
                                  >
                                    <input
                                      type="radio"
                                      name={`full_behavior_${q.id}`}
                                      checked={(q.fullOptionBehavior || 'disable') === 'disable'}
                                      onChange={() => handleUpdateQuestion(q.id, { fullOptionBehavior: 'disable' })}
                                      className="h-3.5 w-3.5 text-indigo-600"
                                    />
                                    <span>Disable Option (Show "FULL")</span>
                                  </label>

                                  <label
                                    className={`flex items-center gap-1.5 p-2 rounded-lg border text-xs cursor-pointer transition ${
                                      q.fullOptionBehavior === 'hide'
                                        ? 'bg-indigo-100/80 border-indigo-400 text-indigo-900 font-bold'
                                        : 'bg-white border-slate-200 text-slate-600'
                                    }`}
                                  >
                                    <input
                                      type="radio"
                                      name={`full_behavior_${q.id}`}
                                      checked={q.fullOptionBehavior === 'hide'}
                                      onChange={() => handleUpdateQuestion(q.id, { fullOptionBehavior: 'hide' })}
                                      className="h-3.5 w-3.5 text-indigo-600"
                                    />
                                    <span>Hide Option Completely</span>
                                  </label>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Member Selector Filter Config */}
                        {q.type === 'member_selector' && (
                          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                            <div>
                              <h4 className="text-xs font-bold text-slate-800">Member Database Filter</h4>
                              <p className="text-[11px] text-slate-500">Filter which active member profiles can be selected.</p>
                            </div>

                            <CustomSelect
                              value={q.memberFilterType || 'all'}
                              onChange={e => {
                                const filterType = e.target.value as 'all' | 'order' | 'rank'
                                const defaultVals = filterType === 'order' ? ['Order of San Pedro'] : filterType === 'rank' ? ['Chevaliers'] : []
                                handleUpdateQuestion(q.id, {
                                  memberFilterType: filterType,
                                  memberFilterValue: defaultVals
                                })
                              }}
                              options={[
                                { value: 'all', label: 'All Active Members' },
                                { value: 'order', label: 'Filter by Order Groups (Checkboxes)' },
                                { value: 'rank', label: 'Filter by Member Ranks (Checkboxes)' }
                              ]}
                              icon={<QuestionTypeIcon type="member_selector" className="w-4 h-4 text-slate-400" />}
                              className="!h-9 text-xs font-bold"
                            />

                            {q.memberFilterType === 'order' && (() => {
                              const currentVals: string[] = Array.isArray(q.memberFilterValue)
                                ? q.memberFilterValue
                                : q.memberFilterValue
                                ? [q.memberFilterValue]
                                : ['Order of San Pedro']

                              return (
                                <div className="p-2.5 bg-white border border-slate-200 rounded-xl space-y-1.5">
                                  <label className="block text-[11px] font-bold text-slate-700">Select Order Groups to Include:</label>
                                  <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                                    {ORDER_GROUP_OPTIONS.map(og => (
                                      <label key={og} className="flex items-center space-x-2 text-xs text-slate-800 cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={currentVals.includes(og)}
                                          onChange={e => {
                                            let updated: string[]
                                            if (e.target.checked) {
                                              updated = [...currentVals, og]
                                            } else {
                                              updated = currentVals.filter(v => v !== og)
                                            }
                                            handleUpdateQuestion(q.id, { memberFilterValue: updated })
                                          }}
                                          className="h-3.5 w-3.5 text-indigo-600 rounded-md border-slate-300"
                                        />
                                        <span>{og}</span>
                                      </label>
                                    ))}
                                  </div>
                                </div>
                              )
                            })()}

                            {q.memberFilterType === 'rank' && (() => {
                              const currentVals: string[] = Array.isArray(q.memberFilterValue)
                                ? q.memberFilterValue
                                : q.memberFilterValue
                                ? [q.memberFilterValue]
                                : ['Chevaliers']

                              return (
                                <div className="p-2.5 bg-white border border-slate-200 rounded-xl space-y-1.5">
                                  <label className="block text-[11px] font-bold text-slate-700">Select Ranks to Include:</label>
                                  <div className="space-y-1">
                                    {RANK_OPTIONS.map(r => (
                                      <label key={r} className="flex items-center space-x-2 text-xs text-slate-800 cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={currentVals.includes(r)}
                                          onChange={e => {
                                            let updated: string[]
                                            if (e.target.checked) {
                                              updated = [...currentVals, r]
                                            } else {
                                              updated = currentVals.filter(v => v !== r)
                                            }
                                            handleUpdateQuestion(q.id, { memberFilterValue: updated })
                                          }}
                                          className="h-3.5 w-3.5 text-indigo-600 rounded-md border-slate-300"
                                        />
                                        <span>{r}</span>
                                      </label>
                                    ))}
                                  </div>
                                </div>
                              )
                            })()}
                          </div>
                        )}

                        {/* Conditional Visibility Flyout Editor */}
                        {showConditionEditorId === q.id && (
                          <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-amber-900">Conditional Visibility Logic</span>
                              <button
                                type="button"
                                onClick={() => setShowConditionEditorId(null)}
                                className="text-amber-700 hover:text-amber-900 text-xs font-bold"
                              >
                                Close
                              </button>
                            </div>
                            <CustomSelect
                              value={q.visibilityCondition?.questionId || ''}
                              onChange={e => {
                                const val = e.target.value
                                if (!val) {
                                  handleUpdateQuestion(q.id, { visibilityCondition: undefined })
                                } else {
                                  handleUpdateQuestion(q.id, {
                                    visibilityCondition: {
                                      questionId: val,
                                      operator: q.visibilityCondition?.operator || 'equals',
                                      value: q.visibilityCondition?.value || ''
                                    }
                                  })
                                }
                              }}
                              options={[
                                { value: '', label: '-- Always Visible --' },
                                ...questions
                                  .filter(other => other.id !== q.id && other.order < q.order)
                                  .map(other => ({
                                    value: other.id,
                                    label: `Depends on Question #${other.order + 1}: ${other.question}`
                                  }))
                              ]}
                              className="!h-9 text-xs font-semibold"
                            />

                            {q.visibilityCondition?.questionId && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                                <CustomSelect
                                  value={q.visibilityCondition.operator}
                                  onChange={e =>
                                    handleUpdateQuestion(q.id, {
                                      visibilityCondition: {
                                        ...q.visibilityCondition!,
                                        operator: e.target.value as ConditionOperator
                                      }
                                    })
                                  }
                                  options={[
                                    { value: 'equals', label: 'Equals (Exact Match)' },
                                    { value: 'not_equals', label: 'Does Not Equal' },
                                    { value: 'is_filled', label: 'Is Filled (Has Any Answer)' },
                                    { value: 'is_empty', label: 'Is Empty (Unanswered)' },
                                    { value: 'contains', label: 'Contains Text' }
                                  ]}
                                  className="!h-9 text-xs font-semibold"
                                />

                                {q.visibilityCondition.operator !== 'is_filled' &&
                                  q.visibilityCondition.operator !== 'is_empty' && (
                                    <input
                                      type="text"
                                      placeholder="Expected Value (e.g. Yes)"
                                      value={q.visibilityCondition.value}
                                      onChange={e =>
                                        handleUpdateQuestion(q.id, {
                                          visibilityCondition: {
                                            ...q.visibilityCondition!,
                                            value: e.target.value
                                          }
                                        })
                                      }
                                      className="p-2 border border-slate-300 rounded-xl text-xs bg-white"
                                    />
                                  )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* BOTTOM ACTION BAR (SIGNATURE GFORMS FOOTER) */}
                        <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                          
                          {/* Visibility Condition Button */}
                          <div>
                            <button
                              type="button"
                              onClick={() => setShowConditionEditorId(showConditionEditorId === q.id ? null : q.id)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer flex items-center gap-1.5 ${
                                q.visibilityCondition?.questionId
                                  ? 'bg-amber-100 text-amber-900 border-amber-300 font-extrabold'
                                  : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                              }`}
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                              <span>
                                {q.visibilityCondition?.questionId
                                  ? `Condition: Depends on #${questions.findIndex(x => x.id === q.visibilityCondition?.questionId) + 1}`
                                  : 'Add Visibility Logic'}
                              </span>
                            </button>
                          </div>

                          {/* Action Buttons: Duplicate, Delete, Required Toggle */}
                          <div className="flex items-center space-x-3">
                            <button
                              type="button"
                              onClick={() => handleDuplicateQuestion(q)}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition cursor-pointer"
                              title="Duplicate Question"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteQuestion(q.id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition cursor-pointer"
                              title="Delete Question"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>

                            {!isSectionHeader && (
                              <>
                                <div className="h-5 w-px bg-slate-200" />
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                  <span className="text-xs font-bold text-slate-700">Required</span>
                                  <input
                                    type="checkbox"
                                    checked={q.required}
                                    onChange={e => handleUpdateQuestion(q.id, { required: e.target.checked })}
                                    className="h-4 w-4 text-indigo-600 rounded-md border-slate-300"
                                  />
                                </label>
                              </>
                            )}
                          </div>

                        </div>
                      </div>
                    )
                  }

                  // =========================================================
                  // INACTIVE QUESTION CARD (CLEAN PREVIEW MODE)
                  // =========================================================
                  return (
                    <div
                      key={q.id}
                      onClick={() => setActiveQuestionId(q.id)}
                      className={`rounded-2xl border p-5 transition-all cursor-pointer hover:shadow-md ${
                        isSectionHeader
                          ? 'bg-indigo-50/40 border-indigo-200 hover:border-indigo-300 shadow-xs'
                          : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1.5 flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-[10px]">
                              {idx + 1}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                              isSectionHeader
                                ? 'bg-indigo-100 text-indigo-800 border-indigo-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}>
                              <QuestionTypeIcon type={q.type} className="w-3 h-3" />
                              <span>{typeObj?.label || q.type}</span>
                            </span>
                            {!isSectionHeader && q.required && (
                              <span className="text-[10px] font-bold text-red-500">* Required</span>
                            )}
                          </div>

                          <div className={`font-bold text-slate-900 ${isSectionHeader ? 'text-base text-indigo-950 font-black' : 'text-sm'}`}>
                            <FormattedText text={q.question || (isSectionHeader ? 'Untitled Section' : 'Untitled Question')} as="span" />
                          </div>

                          {q.description && (
                            <FormattedText text={q.description} className="text-xs text-slate-500" />
                          )}
                        </div>

                        <span className="text-xs text-indigo-600 font-bold bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100 shrink-0">
                          Click to edit
                        </span>
                      </div>

                      {/* Mock Input Previews */}
                      <div className="mt-3 pointer-events-none opacity-70">
                        {q.type === 'short_text' && (
                          <div className="p-2 border rounded-xl text-xs bg-slate-50 text-slate-400">Short answer text...</div>
                        )}
                        {q.type === 'long_text' && (
                          <div className="p-2 border rounded-xl text-xs bg-slate-50 text-slate-400 h-12">Paragraph text...</div>
                        )}
                        {['multiple_choice', 'checkbox', 'relationship_selector'].includes(q.type) && (
                          <div className="space-y-1">
                            {(q.options || ['Option 1', 'Option 2']).map((opt, oIdx) => {
                              const limit = q.optionLimits?.[opt]
                              return (
                                <div key={oIdx} className="flex items-center justify-between text-xs text-slate-700">
                                  <div className="flex items-center space-x-2">
                                    <span>{q.type === 'checkbox' ? '□' : '○'}</span>
                                    <span>{opt}</span>
                                  </div>
                                  {limit && limit > 0 ? (
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded-md border border-indigo-200">
                                      Limit: {limit} slots
                                    </span>
                                  ) : null}
                                </div>
                              )
                            })}
                            {q.hasOtherOption && (
                              <div className="flex items-center space-x-2 text-xs text-indigo-600 font-semibold italic pt-0.5">
                                <span>{q.type === 'checkbox' ? '□' : '○'}</span>
                                <span>{q.otherOptionLabel || 'Other'}: _________________</span>
                              </div>
                            )}
                          </div>
                        )}
                        {q.type === 'dropdown' && (
                          <div className="w-full h-9 pl-3.5 pr-9 border border-slate-200 rounded-xl text-xs bg-slate-50 text-slate-500 flex items-center justify-between shadow-2xs">
                            <span>Select an option... {q.hasOtherOption ? `(${q.otherOptionLabel || 'Other'} included)` : ''}</span>
                            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                            </svg>
                          </div>
                        )}
                        {q.type === 'member_selector' && (
                          <div className="p-2.5 border rounded-xl bg-slate-50 text-xs text-slate-600">
                            Member Profile Selection ({q.memberFilterType === 'all' || !q.memberFilterType ? 'All Active Members' : `${q.memberFilterType}: ${Array.isArray(q.memberFilterValue) ? q.memberFilterValue.join(', ') : q.memberFilterValue}`})
                          </div>
                        )}
                        {q.type === 'companion_repeater' && (
                          <div className="p-2.5 border rounded-xl bg-slate-50 text-xs text-slate-600 flex justify-between">
                            <span>Dynamic Companions List</span>
                            <span className="text-indigo-600 font-bold">+ Add Companion</span>
                          </div>
                        )}
                      </div>

                      {q.visibilityCondition?.questionId && (
                        <div className="mt-2 text-[11px] text-amber-800 font-semibold flex items-center space-x-1">
                          <span>Visible if #{questions.findIndex(x => x.id === q.visibilityCondition?.questionId) + 1} {q.visibilityCondition.operator} "{q.visibilityCondition.value}"</span>
                        </div>
                      )}
                    </div>
                  )
                })}

              </div>

              {/* FLOATING ACTION TOOLBAR (RIGHT PINNED ON DESKTOP) */}
              <div className="hidden md:flex flex-col gap-2 sticky top-4 bg-white p-2 rounded-2xl border border-slate-200 shadow-xl shrink-0">
                <button
                  type="button"
                  onClick={() => handleAddQuestion('short_text', activeIndex)}
                  className="w-10 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center transition shadow-md shadow-indigo-500/20 cursor-pointer group relative"
                  title="Add Question"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="absolute left-12 whitespace-nowrap bg-slate-900 text-white text-[11px] font-bold px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition pointer-events-none shadow-sm">
                    Add Question
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleAddQuestion('section_header', activeIndex)}
                  className="w-10 h-10 rounded-xl bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 flex items-center justify-center transition border border-slate-200 cursor-pointer group relative"
                  title="Add Section Header"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16m-7 6h7" />
                  </svg>
                  <span className="absolute left-12 whitespace-nowrap bg-slate-900 text-white text-[11px] font-bold px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition pointer-events-none shadow-sm">
                    Add Section Header
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleAddQuestion('member_selector', activeIndex)}
                  className="w-10 h-10 rounded-xl bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 flex items-center justify-center transition border border-slate-200 cursor-pointer group relative"
                  title="Add Member Selector"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="absolute left-12 whitespace-nowrap bg-slate-900 text-white text-[11px] font-bold px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition pointer-events-none shadow-sm">
                    Add Member Selector
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleAddQuestion('companion_repeater', activeIndex)}
                  className="w-10 h-10 rounded-xl bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 flex items-center justify-center transition border border-slate-200 cursor-pointer group relative"
                  title="Add Companions List"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                  <span className="absolute left-12 whitespace-nowrap bg-slate-900 text-white text-[11px] font-bold px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition pointer-events-none shadow-sm">
                    Add Companions List
                  </span>
                </button>
              </div>

            </div>

            {/* FLOATING MOBILE BOTTOM ACTIONS BAR (MOBILE ONLY) */}
            <div className="md:hidden fixed bottom-4 left-3 right-3 z-30 flex items-center justify-between bg-slate-900/95 backdrop-blur-md text-white px-3.5 py-2.5 rounded-2xl shadow-2xl border border-slate-700/60">
              <span className="text-[11px] font-black tracking-wider text-slate-300 uppercase select-none">Add:</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleAddQuestion('short_text', activeIndex)}
                  className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-bold rounded-xl flex items-center gap-1 cursor-pointer transition shadow-xs"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Question</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleAddQuestion('section_header', activeIndex)}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 text-xs font-bold rounded-xl flex items-center gap-1 cursor-pointer transition border border-slate-700"
                  title="Add Section Header"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16m-7 6h7" />
                  </svg>
                  <span>Section</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleAddQuestion('member_selector', activeIndex)}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 text-xs font-bold rounded-xl flex items-center gap-1 cursor-pointer transition border border-slate-700"
                  title="Add Member Selector"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>Member</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleAddQuestion('companion_repeater', activeIndex)}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 text-xs font-bold rounded-xl flex items-center justify-center cursor-pointer transition border border-slate-700"
                  title="Add Companions List"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: FORM SETTINGS */}
        {/* ========================================================================= */}
        {activeTab === 'settings' && (
          <div className="flex-1 p-6 sm:p-8 overflow-y-auto max-w-3xl mx-auto w-full space-y-6">
            <h3 className="text-lg font-bold text-slate-900 border-b pb-2">
              Form Availability & Access Settings
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <CustomSelect
                  label="Form Status"
                  id="form-status-select"
                  options={[
                    { value: 'draft', label: 'Draft (Private / In Preparation)' },
                    { value: 'published', label: 'Published (Live & accepting responses)' },
                    { value: 'temporary_closed', label: 'Temporary Closed (Pansamantalang Sarado)' },
                    { value: 'closed', label: 'Closed (Totally Closed - Submissions locked)' },
                    { value: 'archived', label: 'Archived (Totally Closed & Stored)' }
                  ]}
                  value={status}
                  onChange={e => setStatus(e.target.value as EventForm['status'])}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Public Access Link</label>
                <div className="flex items-center space-x-2 pt-2">
                  <input
                    type="checkbox"
                    id="isPublicCheck"
                    checked={isPublic}
                    onChange={e => setIsPublic(e.target.checked)}
                    className="h-4 w-4 text-indigo-600 rounded-md border-slate-300"
                  />
                  <label htmlFor="isPublicCheck" className="text-xs font-semibold text-slate-800 cursor-pointer">
                    Accessible via shareable link without login
                  </label>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Open Date / Time (Optional)</label>
                <input
                  type="datetime-local"
                  value={startAt}
                  onChange={e => setStartAt(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-sm bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Close Date / Time (Optional)</label>
                <input
                  type="datetime-local"
                  value={closeAt}
                  onChange={e => setCloseAt(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-sm bg-white"
                />
              </div>
            </div>

            <div className="border-t pt-4 space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-50 border rounded-xl">
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Allow Multiple Responses</h4>
                  <p className="text-[11px] text-slate-500">Allow a single person/user to submit this form more than once.</p>
                </div>
                <input
                  type="checkbox"
                  checked={allowMultipleResponses}
                  onChange={e => setAllowMultipleResponses(e.target.checked)}
                  className="h-4 w-4 text-indigo-600 rounded-md border-slate-300"
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 border rounded-xl">
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Allow Edit Response</h4>
                  <p className="text-[11px] text-slate-500">Allow respondents to edit their response using their tracking number.</p>
                </div>
                <input
                  type="checkbox"
                  checked={allowEditResponse}
                  onChange={e => setAllowEditResponse(e.target.checked)}
                  className="h-4 w-4 text-indigo-600 rounded-md border-slate-300"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Submission Confirmation Message</label>
                <textarea
                  value={confirmationMessage}
                  onChange={e => setConfirmationMessage(e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-xl text-sm bg-white h-24"
                  placeholder="Thank you for registering!"
                />
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Confirm Save */}
      <ConfirmModal
        isOpen={showSaveConfirm}
        onClose={() => setShowSaveConfirm(false)}
        onConfirm={() => {
          setShowSaveConfirm(false)
          handleSave()
        }}
        title={formToEdit ? 'Save Changes' : 'Create Form'}
        message={
          formToEdit
            ? `Save changes to "${title}"? This will update the form and all its questions.`
            : `Create the form "${title}"? It will be saved as a draft.`
        }
        confirmLabel={formToEdit ? 'Save Changes' : 'Create Form'}
        variant="info"
      />

      {/* Confirm Cancel / Close */}
      <ConfirmModal
        isOpen={showCancelConfirm}
        onClose={() => setShowCancelConfirm(false)}
        onConfirm={() => {
          setShowCancelConfirm(false)
          onClose()
        }}
        title="Discard Changes"
        message="Are you sure you want to close the form builder? Any unsaved changes will be lost."
        confirmLabel="Discard & Close"
        variant="danger"
      />
    </div>
  )
}
