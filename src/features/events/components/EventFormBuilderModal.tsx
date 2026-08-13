import React, { useState, useEffect } from 'react'
import type { EventForm, EventFormQuestion, QuestionType, ConditionOperator } from '@/types/eventForm'
import { eventFormService } from '@/services/eventFormService'
import { eventFormQuestionService } from '@/services/eventFormQuestionService'
import { useAuth } from '@/features/authentication/AuthContext'
import { AlertModal } from '@/components/Dialog'

interface EventFormBuilderModalProps {
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
  eventId: string
  formToEdit?: EventForm | null
}

const QUESTION_TYPES: { type: QuestionType; label: string; description: string }[] = [
  { type: 'short_text', label: 'Short Text', description: 'Single line text input' },
  { type: 'long_text', label: 'Long Text', description: 'Multi-line paragraph text input' },
  { type: 'multiple_choice', label: 'Multiple Choice', description: 'Select one option from a list' },
  { type: 'dropdown', label: 'Dropdown', description: 'Select one option from a dropdown menu' },
  { type: 'checkbox', label: 'Checkbox', description: 'Select one or more options' },
  { type: 'yes_no', label: 'Yes / No', description: 'Simple binary choice' },
  { type: 'number', label: 'Number', description: 'Numeric value input' },
  { type: 'date', label: 'Date', description: 'Date selection input' },
  { type: 'time', label: 'Time', description: 'Time selection input' },
  { type: 'name_selector', label: 'Name Selector', description: 'Input for participant full name' },
  { type: 'member_selector', label: 'Member Selector', description: 'Select active member from MATS database' },
  { type: 'relationship_selector', label: 'Relationship Selector', description: 'Select relationship to participant' }
]

export const EventFormBuilderModal: React.FC<EventFormBuilderModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  eventId,
  formToEdit
}) => {
  const { profile } = useAuth()
  const [activeTab, setActiveTab] = useState<'builder' | 'settings'>('builder')
  const [saving, setSaving] = useState(false)
  const [alertMessage, setAlertMessage] = useState<string | null>(null)

  // Form Metadata State
  const [title, setTitle] = useState(formToEdit?.title || 'New Event Registration Form')
  const [description, setDescription] = useState(formToEdit?.description || '')
  const [status, setStatus] = useState<EventForm['status']>(formToEdit?.status || 'draft')
  const [isPublic, setIsPublic] = useState(formToEdit?.isPublic ?? true)
  const [startAt, setStartAt] = useState(formToEdit?.startAt || '')
  const [closeAt, setCloseAt] = useState(formToEdit?.closeAt || '')
  const [confirmationMessage, setConfirmationMessage] = useState(formToEdit?.confirmationMessage || 'Thank you for submitting your response.')
  const [allowEditResponse, setAllowEditResponse] = useState(formToEdit?.allowEditResponse ?? false)
  const [allowMultipleResponses, setAllowMultipleResponses] = useState(formToEdit?.allowMultipleResponses ?? true)

  // Questions State
  const [questions, setQuestions] = useState<EventFormQuestion[]>([])
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null)

  useEffect(() => {
    if (formToEdit?.id) {
      eventFormQuestionService.getQuestionsByFormId(formToEdit.id).then(qs => {
        setQuestions(qs)
        if (qs.length > 0) setSelectedQuestionId(qs[0].id)
      })
    } else {
      // Default questions setup
      const defaultQ: EventFormQuestion = {
        id: 'q_init_1',
        formId: '',
        eventId,
        type: 'member_selector',
        question: 'Select Participant Name',
        description: 'Please select your registered MATS member profile',
        required: true,
        order: 0
      }
      setQuestions([defaultQ])
      setSelectedQuestionId('q_init_1')
    }
  }, [formToEdit, eventId])

  if (!isOpen) return null

  const handleAddQuestion = (type: QuestionType) => {
    const newId = `q_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`
    const defaultOptions =
      type === 'relationship_selector'
        ? ['Parent', 'Sibling', 'Relative', 'Friend', 'Guardian', 'Other']
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

    setQuestions([...questions, newQuestion])
    setSelectedQuestionId(newId)
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
    setQuestions([...questions, dup])
    setSelectedQuestionId(newId)
  }

  const handleDeleteQuestion = (id: string) => {
    if (questions.length <= 1) {
      setAlertMessage('A form must contain at least one question.')
      return
    }
    const filtered = questions.filter(q => q.id !== id)
    setQuestions(filtered.map((q, i) => ({ ...q, order: i })))
    if (selectedQuestionId === id) {
      setSelectedQuestionId(filtered[0]?.id || null)
    }
  }

  const handleUpdateQuestion = (id: string, updates: Partial<EventFormQuestion>) => {
    setQuestions(questions.map(q => (q.id === id ? { ...q, ...updates } : q)))
  }

  const selectedQuestion = questions.find(q => q.id === selectedQuestionId)

  const handleSave = async () => {
    if (!title.trim()) {
      setAlertMessage('Please enter a form title.')
      return
    }

    setSaving(true)
    try {
      let formId = formToEdit?.id
      const formPayload: Omit<EventForm, 'id' | 'createdAt' | 'updatedAt'> = {
        eventId,
        title: title.trim(),
        description: description.trim(),
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
      } else {
        formId = await eventFormService.createForm(formPayload, profile?.email || 'Organizer')
      }

      // Save questions
      await eventFormQuestionService.saveQuestions(formId, eventId, questions, profile?.email || 'Organizer')

      onSaved()
      onClose()
    } catch (err) {
      console.error('Failed to save form:', err)
      setAlertMessage('Failed to save form. Please check permissions and try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center sm:p-4">
      <div className="bg-white w-full max-w-6xl h-[100dvh] sm:h-[90vh] rounded-none sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden border-0 sm:border border-slate-200">
        
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-xl font-bold text-slate-900">{formToEdit ? 'Edit Form Builder' : 'Create Event Registration Form'}</h2>
            <p className="text-[11px] sm:text-xs text-slate-500 line-clamp-1">Configure questions, metadata, availability, and visibility conditions.</p>
          </div>
          <div className="flex items-center justify-between sm:justify-end space-x-2 w-full sm:w-auto">
            <div className="flex bg-slate-200 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setActiveTab('builder')}
                className={`px-3 sm:px-4 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  activeTab === 'builder' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Builder
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('settings')}
                className={`px-3 sm:px-4 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  activeTab === 'settings' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Settings
              </button>
            </div>

            <div className="flex items-center space-x-1.5">
              <button
                type="button"
                onClick={onClose}
                className="px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-3.5 sm:px-5 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {saving ? 'Saving...' : 'Save Form'}
              </button>
            </div>
          </div>
        </div>

        {/* Tab 1: Form Builder */}
        {activeTab === 'builder' && (
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            {/* Desktop Left Column: Question Types Palette */}
            <div className="hidden md:block w-64 bg-slate-50 border-r border-slate-200 p-4 overflow-y-auto space-y-3">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Add Question</h3>
              <div className="space-y-1.5">
                {QUESTION_TYPES.map(qt => (
                  <button
                    key={qt.type}
                    type="button"
                    onClick={() => handleAddQuestion(qt.type)}
                    className="w-full text-left p-2.5 bg-white border border-slate-200 rounded-xl hover:border-blue-400 hover:shadow-xs transition-all flex items-center justify-between cursor-pointer group"
                  >
                    <div>
                      <p className="text-xs font-bold text-slate-800 group-hover:text-blue-600">{qt.label}</p>
                      <p className="text-[10px] text-slate-400 line-clamp-1">{qt.description}</p>
                    </div>
                    <span className="text-xs font-extrabold text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">+</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Center Column: Questions Canvas / Preview */}
            <div className="flex-1 bg-slate-100/50 p-3 sm:p-6 overflow-y-auto space-y-3 sm:space-y-4">
              
              {/* Mobile Question Type Palette Chips */}
              <div className="md:hidden space-y-1.5 mb-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Add Question</span>
                <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-none">
                  {QUESTION_TYPES.map(qt => (
                    <button
                      key={qt.type}
                      type="button"
                      onClick={() => handleAddQuestion(qt.type)}
                      className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 hover:border-blue-500 whitespace-nowrap shrink-0 shadow-2xs"
                    >
                      + {qt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs mb-3 sm:mb-4">
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Form Title"
                  className="w-full text-lg sm:text-xl font-black text-slate-900 border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-hidden pb-1 transition-colors"
                />
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Form description / instructions..."
                  className="w-full mt-2 text-xs sm:text-sm text-slate-600 border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-hidden resize-none h-14 sm:h-16 transition-colors"
                />
              </div>

              {questions.map((q, idx) => {
                const isSelected = q.id === selectedQuestionId
                const typeObj = QUESTION_TYPES.find(t => t.type === q.type)

                return (
                  <div
                    key={q.id}
                    onClick={() => setSelectedQuestionId(q.id)}
                    className={`p-5 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-white border-blue-500 shadow-md ring-2 ring-blue-500/20'
                        : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md">
                          #{idx + 1}
                        </span>
                        <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                          {typeObj?.label || q.type}
                        </span>
                        {q.required && <span className="text-xs font-bold text-red-500">* Required</span>}
                      </div>

                      <div className="flex items-center space-x-1">
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); handleMoveQuestion(idx, 'up') }}
                          disabled={idx === 0}
                          className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer font-bold text-xs"
                          title="Move Up"
                        >
                          Up
                        </button>
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); handleMoveQuestion(idx, 'down') }}
                          disabled={idx === questions.length - 1}
                          className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer font-bold text-xs"
                          title="Move Down"
                        >
                          Down
                        </button>
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); handleDuplicateQuestion(q) }}
                          className="p-1 text-slate-400 hover:text-blue-600 cursor-pointer text-xs font-bold"
                          title="Duplicate"
                        >
                          Copy
                        </button>
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); handleDeleteQuestion(q.id) }}
                          className="p-1 text-slate-400 hover:text-red-600 cursor-pointer text-xs font-bold"
                          title="Delete"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    <h4 className="text-sm font-bold text-slate-900">{q.question || 'Untitled Question'}</h4>
                    {q.description && <p className="text-xs text-slate-500 mt-1">{q.description}</p>}

                    {/* Preview controls */}
                    <div className="mt-3 pointer-events-none opacity-80">
                      {q.type === 'short_text' && (
                        <input type="text" placeholder="Short answer text" className="w-full p-2 border rounded-xl text-xs bg-slate-50" readOnly />
                      )}
                      {q.type === 'long_text' && (
                        <textarea placeholder="Long answer text" className="w-full p-2 border rounded-xl text-xs bg-slate-50 h-16" readOnly />
                      )}
                      {(q.type === 'multiple_choice' || q.type === 'relationship_selector') && (
                        <div className="space-y-1">
                          {(q.options || ['Option 1', 'Option 2']).map((opt, oIdx) => (
                            <div key={oIdx} className="flex items-center space-x-2">
                              <input type="radio" disabled className="h-3 w-3" />
                              <span className="text-xs text-slate-700">{opt}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {q.type === 'checkbox' && (
                        <div className="space-y-1">
                          {(q.options || ['Option 1', 'Option 2']).map((opt, oIdx) => (
                            <div key={oIdx} className="flex items-center space-x-2">
                              <input type="checkbox" disabled className="h-3 w-3" />
                              <span className="text-xs text-slate-700">{opt}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {q.type === 'dropdown' && (
                        <select className="w-full p-2 border rounded-xl text-xs bg-slate-50" disabled>
                          <option>Select an option...</option>
                        </select>
                      )}
                      {q.type === 'yes_no' && (
                        <div className="flex items-center space-x-4">
                          <label className="flex items-center space-x-1.5 text-xs"><input type="radio" disabled /><span>Yes</span></label>
                          <label className="flex items-center space-x-1.5 text-xs"><input type="radio" disabled /><span>No</span></label>
                        </div>
                      )}
                      {q.type === 'member_selector' && (
                        <div className="p-3 border rounded-xl bg-slate-50 space-y-1.5">
                          <span className="text-[11px] font-bold text-slate-500 block border-b pb-1">
                            Single Member Selection ({q.memberFilterType && q.memberFilterType !== 'all' ? `${q.memberFilterType}: ${q.memberFilterValue}` : 'All Active Members'})
                          </span>
                          <div className="flex items-center space-x-2 opacity-60">
                            <input type="radio" disabled className="h-3 w-3" />
                            <span className="text-xs text-slate-700">LastName, FirstName (Order Group)</span>
                          </div>
                        </div>
                      )}
                      {q.type === 'date' && <input type="date" className="p-2 border rounded-xl text-xs bg-slate-50" disabled />}
                      {q.type === 'time' && <input type="time" className="p-2 border rounded-xl text-xs bg-slate-50" disabled />}
                      {q.type === 'number' && <input type="number" placeholder="0" className="p-2 border rounded-xl text-xs bg-slate-50" disabled />}
                      {q.type === 'name_selector' && <input type="text" placeholder="Participant Full Name" className="w-full p-2 border rounded-xl text-xs bg-slate-50" disabled />}
                    </div>

                    {q.visibilityCondition?.questionId && (
                      <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-800 flex items-center space-x-1">
                        <span>Visibility Condition: Shows if question #{questions.findIndex(x => x.id === q.visibilityCondition?.questionId) + 1} {q.visibilityCondition.operator} "{q.visibilityCondition.value}"</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Right Column: Question Settings Inspector */}
            <div className="w-full md:w-80 bg-slate-50 border-t md:border-t-0 md:border-l border-slate-200 p-4 sm:p-5 overflow-y-auto space-y-4 max-h-[45vh] md:max-h-none shrink-0">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Question Settings</h3>

              {selectedQuestion ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Question Label</label>
                    <input
                      type="text"
                      value={selectedQuestion.question}
                      onChange={e => handleUpdateQuestion(selectedQuestion.id, { question: e.target.value })}
                      className="w-full p-2 border border-slate-300 rounded-xl text-xs bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Description / Help Text</label>
                    <textarea
                      value={selectedQuestion.description || ''}
                      onChange={e => handleUpdateQuestion(selectedQuestion.id, { description: e.target.value })}
                      className="w-full p-2 border border-slate-300 rounded-xl text-xs bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden h-16"
                      placeholder="Optional instructions for respondent..."
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl">
                    <span className="text-xs font-bold text-slate-800">Required Field</span>
                    <input
                      type="checkbox"
                      checked={selectedQuestion.required}
                      onChange={e => handleUpdateQuestion(selectedQuestion.id, { required: e.target.checked })}
                      className="h-4 w-4 text-blue-600 rounded-md border-slate-300"
                    />
                  </div>

                  {/* Options editor for choice types */}
                  {(selectedQuestion.type === 'multiple_choice' ||
                    selectedQuestion.type === 'dropdown' ||
                    selectedQuestion.type === 'checkbox' ||
                    selectedQuestion.type === 'relationship_selector') && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold text-slate-700">Options</label>
                        <button
                          type="button"
                          onClick={() => {
                            const opts = selectedQuestion.options || []
                            handleUpdateQuestion(selectedQuestion.id, { options: [...opts, `Option ${opts.length + 1}`] })
                          }}
                          className="text-[11px] font-bold text-blue-600 hover:underline cursor-pointer"
                        >
                          + Add Option
                        </button>
                      </div>
                      <div className="space-y-1.5">
                        {(selectedQuestion.options || []).map((opt, oIdx) => (
                          <div key={oIdx} className="flex items-center space-x-1.5">
                            <input
                              type="text"
                              value={opt}
                              onChange={e => {
                                const newOpts = [...(selectedQuestion.options || [])]
                                newOpts[oIdx] = e.target.value
                                handleUpdateQuestion(selectedQuestion.id, { options: newOpts })
                              }}
                              className="flex-1 p-1.5 border border-slate-300 rounded-lg text-xs bg-white"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const newOpts = (selectedQuestion.options || []).filter((_, i) => i !== oIdx)
                                handleUpdateQuestion(selectedQuestion.id, { options: newOpts })
                              }}
                              className="text-red-500 hover:text-red-700 text-xs px-1"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Member Selector Filter Config */}
                  {selectedQuestion.type === 'member_selector' && (
                    <div className="border-t border-slate-200 pt-4 space-y-3">
                      <div>
                        <h4 className="text-xs font-bold text-slate-700">Member List Filter</h4>
                        <p className="text-[11px] text-slate-500">Choose which members appear in the member list.</p>
                      </div>

                      <select
                        value={selectedQuestion.memberFilterType || 'all'}
                        onChange={e => {
                          const filterType = e.target.value as 'all' | 'order' | 'rank'
                          const defaultVals = filterType === 'order' ? ['Order of San Pedro'] : filterType === 'rank' ? ['Chevaliers'] : []
                          handleUpdateQuestion(selectedQuestion.id, {
                            memberFilterType: filterType,
                            memberFilterValue: defaultVals
                          })
                        }}
                        className="w-full p-2 border border-slate-300 rounded-xl text-xs bg-white"
                      >
                        <option value="all">All Active Members</option>
                        <option value="order">By Order Groups (Checkboxes)</option>
                        <option value="rank">By Member Ranks (Checkboxes)</option>
                      </select>

                      {selectedQuestion.memberFilterType === 'order' && (() => {
                        const currentVals: string[] = Array.isArray(selectedQuestion.memberFilterValue)
                          ? selectedQuestion.memberFilterValue
                          : selectedQuestion.memberFilterValue
                          ? [selectedQuestion.memberFilterValue]
                          : ['Order of San Pedro']

                        const orderOptions = [
                          'Order of San Pedro',
                          'Order of San Juan',
                          'Order of San Tiago',
                          'Order of San Andres',
                          'Officers',
                          'Squires'
                        ]

                        return (
                          <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2">
                            <label className="block text-[11px] font-bold text-slate-700">Select Order Groups to Include:</label>
                            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                              {orderOptions.map(og => {
                                const isChecked = currentVals.includes(og)
                                return (
                                  <label key={og} className="flex items-center space-x-2 text-xs text-slate-800 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={e => {
                                        let updated: string[]
                                        if (e.target.checked) {
                                          updated = [...currentVals, og]
                                        } else {
                                          updated = currentVals.filter(v => v !== og)
                                        }
                                        handleUpdateQuestion(selectedQuestion.id, { memberFilterValue: updated })
                                      }}
                                      className="h-3.5 w-3.5 text-blue-600 rounded-md border-slate-300"
                                    />
                                    <span>{og}</span>
                                  </label>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })()}

                      {selectedQuestion.memberFilterType === 'rank' && (() => {
                        const currentVals: string[] = Array.isArray(selectedQuestion.memberFilterValue)
                          ? selectedQuestion.memberFilterValue
                          : selectedQuestion.memberFilterValue
                          ? [selectedQuestion.memberFilterValue]
                          : ['Chevaliers']

                        const rankOptions = ['Chevaliers', 'Paladins', 'Squires']

                        return (
                          <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2">
                            <label className="block text-[11px] font-bold text-slate-700">Select Ranks to Include:</label>
                            <div className="space-y-1.5">
                              {rankOptions.map(r => {
                                const isChecked = currentVals.includes(r)
                                return (
                                  <label key={r} className="flex items-center space-x-2 text-xs text-slate-800 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={e => {
                                        let updated: string[]
                                        if (e.target.checked) {
                                          updated = [...currentVals, r]
                                        } else {
                                          updated = currentVals.filter(v => v !== r)
                                        }
                                        handleUpdateQuestion(selectedQuestion.id, { memberFilterValue: updated })
                                      }}
                                      className="h-3.5 w-3.5 text-blue-600 rounded-md border-slate-300"
                                    />
                                    <span>{r}</span>
                                  </label>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                  )}

                  {/* Single Conditional Visibility Rule Builder */}
                  <div className="border-t border-slate-200 pt-4 space-y-2">
                    <h4 className="text-xs font-bold text-slate-700">Conditional Visibility</h4>
                    <p className="text-[11px] text-slate-500">Show this question dynamically based on an earlier answer.</p>

                    <div className="space-y-2">
                      <select
                        value={selectedQuestion.visibilityCondition?.questionId || ''}
                        onChange={e => {
                          const val = e.target.value
                          if (!val) {
                            handleUpdateQuestion(selectedQuestion.id, { visibilityCondition: undefined })
                          } else {
                            handleUpdateQuestion(selectedQuestion.id, {
                              visibilityCondition: {
                                questionId: val,
                                operator: selectedQuestion.visibilityCondition?.operator || 'equals',
                                value: selectedQuestion.visibilityCondition?.value || ''
                              }
                            })
                          }
                        }}
                        className="w-full p-2 border border-slate-300 rounded-xl text-xs bg-white"
                      >
                        <option value="">-- Always Visible --</option>
                        {questions
                          .filter(q => q.id !== selectedQuestion.id && q.order < selectedQuestion.order)
                          .map(q => (
                            <option key={q.id} value={q.id}>
                              Depends on: #{q.order + 1} {q.question}
                            </option>
                          ))}
                      </select>

                      {selectedQuestion.visibilityCondition?.questionId && (
                        <>
                          <select
                            value={selectedQuestion.visibilityCondition.operator}
                            onChange={e =>
                              handleUpdateQuestion(selectedQuestion.id, {
                                visibilityCondition: {
                                  ...selectedQuestion.visibilityCondition!,
                                  operator: e.target.value as ConditionOperator
                                }
                              })
                            }
                            className="w-full p-2 border border-slate-300 rounded-xl text-xs bg-white"
                          >
                            <option value="equals">Equals (Exact Match)</option>
                            <option value="not_equals">Does Not Equal</option>
                            <option value="is_filled">Is Filled (Has Any Answer)</option>
                            <option value="is_empty">Is Empty (Unanswered / Blank)</option>
                            <option value="contains">Contains Text</option>
                          </select>

                          {selectedQuestion.visibilityCondition.operator !== 'is_filled' &&
                            selectedQuestion.visibilityCondition.operator !== 'is_empty' && (
                              <input
                                type="text"
                                placeholder="Expected Value (e.g. Yes)"
                                value={selectedQuestion.visibilityCondition.value}
                                onChange={e =>
                                  handleUpdateQuestion(selectedQuestion.id, {
                                    visibilityCondition: {
                                      ...selectedQuestion.visibilityCondition!,
                                      value: e.target.value
                                    }
                                  })
                                }
                                className="w-full p-2 border border-slate-300 rounded-xl text-xs bg-white"
                              />
                            )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">Select a question on the canvas to configure its properties.</p>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Form Settings */}
        {activeTab === 'settings' && (
          <div className="flex-1 p-8 overflow-y-auto max-w-3xl mx-auto w-full space-y-6">
            <h3 className="text-lg font-bold text-slate-900 border-b pb-2">Form Availability & Access Settings</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Form Status</label>
                <select
                  value={status}
                  onChange={e => setStatus(e.target.value as EventForm['status'])}
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-sm bg-white"
                >
                  <option value="draft">Draft (Private, not accepting responses)</option>
                  <option value="published">Published (Live & accepting responses)</option>
                  <option value="closed">Closed (Submissions locked)</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Public Access Link</label>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="isPublicCheck"
                    checked={isPublic}
                    onChange={e => setIsPublic(e.target.checked)}
                    className="h-4 w-4 text-blue-600 rounded-md border-slate-300"
                  />
                  <label htmlFor="isPublicCheck" className="text-xs font-semibold text-slate-800">
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
                  className="h-4 w-4 text-blue-600 rounded-md border-slate-300"
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 border rounded-xl">
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Allow Edit Response</h4>
                  <p className="text-[11px] text-slate-500">Allow respondents to edit their response after initial submission.</p>
                </div>
                <input
                  type="checkbox"
                  checked={allowEditResponse}
                  onChange={e => setAllowEditResponse(e.target.checked)}
                  className="h-4 w-4 text-blue-600 rounded-md border-slate-300"
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

      <AlertModal
        isOpen={!!alertMessage}
        onClose={() => setAlertMessage(null)}
        title="Form Builder"
        message={alertMessage || ''}
      />
    </div>
  )
}
