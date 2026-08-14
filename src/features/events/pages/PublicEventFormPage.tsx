import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { eventFormService } from '@/services/eventFormService'
import { eventFormQuestionService } from '@/services/eventFormQuestionService'
import { eventFormResponseService } from '@/services/eventFormResponseService'
import { memberService } from '@/services/memberService'
import { useAuth } from '@/features/authentication/AuthContext'
import type { EventForm, EventFormQuestion, EventFormResponse } from '@/types/eventForm'
import type { Member } from '@/types/member'
import { AlertModal } from '@/components/Dialog'
import { Loading } from '@/components/Loading'

export const PublicEventFormPage: React.FC = () => {
  const { formId } = useParams<{ eventId: string; formId: string }>()
  const { profile, user } = useAuth()

  const [form, setForm] = useState<EventForm | null>(null)
  const [questions, setQuestions] = useState<EventFormQuestion[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [openMemberPickerQuestionId, setOpenMemberPickerQuestionId] = useState<string | null>(null)
  const [memberSearchQuery, setMemberSearchQuery] = useState('')
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [pageLoadError, setPageLoadError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submittedTrackingNumber, setSubmittedTrackingNumber] = useState<string | null>(null)
  const [existingTrackingNumber, setExistingTrackingNumber] = useState<string | null>(null)

  // Answers State: maps questionId -> value
  const [answers, setAnswers] = useState<Record<string, any>>({})



  useEffect(() => {
    async function loadFormAndQuestions() {
      if (!formId) return
      setLoading(true)
      try {
        const formData = await eventFormService.getFormById(formId)
        if (!formData) {
          setPageLoadError('Event form not found.')
          setLoading(false)
          return
        }

        if (formData.status !== 'published') {
          setPageLoadError('This form is currently closed or unpublished.')
          setLoading(false)
          return
        }

        if (!formData.isPublic && !user) {
          setPageLoadError('This form requires authentication to view.')
          setLoading(false)
          return
        }

        setForm(formData)

        const qs = await eventFormQuestionService.getQuestionsByFormId(formId)
        setQuestions(qs)

        // If form contains a member selector, load active members list and exclude already submitted members
        if (qs.some(q => q.type === 'member_selector')) {
          try {
            const allMembers = await memberService.getMembers()
            const activeMembers = allMembers.filter(m => m.status === 'active')

            let existingResponses: EventFormResponse[] = []
            try {
              existingResponses = await eventFormResponseService.getResponsesByFormId(formId)
            } catch {
              // Ignore if unauthenticated or read permissions fail
            }

            // Build set of member IDs who already submitted a response for this form
            const submittedSet = new Set<string>()
            existingResponses.forEach(r => {
              if (r.respondentMemberUid) submittedSet.add(r.respondentMemberUid)
              // Also check any member_selector answer in previous responses
              Object.values(r.answers).forEach(val => {
                if (typeof val === 'string' && val.startsWith('mem_')) {
                  submittedSet.add(val)
                }
              })
            })

            // Store active members who have NOT submitted yet
            setMembers(activeMembers.filter(m => !submittedSet.has(m.id)))
          } catch (err) {
            console.error('Failed to load members for selector:', err)
          }
        }
      } catch (err) {
        console.error('Error loading public form:', err)
        setPageLoadError('Failed to load form.')
      } finally {
        setLoading(false)
      }
    }

    loadFormAndQuestions()
  }, [formId, user])

  // On mount, check localStorage for a previous anonymous tracking number for this form
  useEffect(() => {
    if (!formId) return
    const storedTracking = localStorage.getItem(`mats_form_response_${formId}`)
    if (storedTracking) setExistingTrackingNumber(storedTracking)
  }, [formId])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Loading variant="spinner" label="Loading registration form..." />
      </div>
    )
  }

  if (pageLoadError || !form) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
        <div className="bg-white max-w-md w-full rounded-3xl shadow-xl p-8 border border-slate-200 text-center">
          <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 text-xs font-bold uppercase tracking-wider">
            Notice
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Form Unavailable</h2>
          <p className="text-slate-500 text-xs mb-6">{pageLoadError || 'Form is not accessible.'}</p>
          <button
            type="button"
            onClick={() => {
              try {
                window.close()
              } catch {
                window.location.href = 'about:blank'
              }
            }}
            className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition cursor-pointer"
          >
            Close Window
          </button>
        </div>
      </div>
    )
  }

  // Check question visibility based on condition
  const isQuestionVisible = (q: EventFormQuestion): boolean => {
    if (!q.visibilityCondition || !q.visibilityCondition.questionId) return true
    const { questionId, operator, value } = q.visibilityCondition
    const targetAnswer = answers[questionId]

    const hasAnswer =
      targetAnswer !== undefined &&
      targetAnswer !== null &&
      targetAnswer !== '' &&
      (!Array.isArray(targetAnswer) || targetAnswer.length > 0)

    if (operator === 'is_filled') return hasAnswer
    if (operator === 'is_empty') return !hasAnswer

    if (!hasAnswer) return false

    if (Array.isArray(targetAnswer)) {
      const hasMatch = targetAnswer.some(val =>
        operator === 'contains'
          ? String(val).toLowerCase().includes(String(value || '').trim().toLowerCase())
          : String(val).trim().toLowerCase() === String(value || '').trim().toLowerCase()
      )
      return operator === 'equals' || operator === 'contains' ? hasMatch : !hasMatch
    }

    const targetStr = String(targetAnswer).trim().toLowerCase()
    const expectedStr = String(value || '').trim().toLowerCase()

    if (operator === 'equals') return targetStr === expectedStr
    if (operator === 'not_equals') return targetStr !== expectedStr
    if (operator === 'contains') return targetStr.includes(expectedStr)

    return true
  }

  const handleInputChange = (questionId: string, val: any) => {
    // Clear validation error for this question when answered
    if (validationErrors[questionId]) {
      setValidationErrors(prev => {
        const updated = { ...prev }
        delete updated[questionId]
        return updated
      })
    }

    setAnswers(prev => {
      const nextAnswers = { ...prev, [questionId]: val }
      
      // Calculate updated visible questions with the new answer
      setTimeout(() => {
        const updatedVisible = questions.filter(q => {
          if (!q.visibilityCondition || !q.visibilityCondition.questionId) return true
          const { questionId: parentId, operator, value: condVal } = q.visibilityCondition
          const parentAns = nextAnswers[parentId]
          const hasAns = parentAns !== undefined && parentAns !== null && parentAns !== ''
          if (operator === 'is_filled') return hasAns
          if (operator === 'is_empty') return !hasAns
          if (!hasAns) return false

          const targetStr = String(parentAns).trim().toLowerCase()
          const expectedStr = String(condVal || '').trim().toLowerCase()
          if (operator === 'equals') return targetStr === expectedStr
          if (operator === 'not_equals') return targetStr !== expectedStr
          if (operator === 'contains') return targetStr.includes(expectedStr)
          return true
        })

        const currentIdx = updatedVisible.findIndex(q => q.id === questionId)
        if (currentIdx !== -1 && currentIdx < updatedVisible.length - 1) {
          const nextQ = updatedVisible[currentIdx + 1]
          const nextElem = document.getElementById(`q_card_${nextQ.id}`)
          if (nextElem) {
            nextElem.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }
        }
      }, 100)

      return nextAnswers
    })
  }

  const handleCheckboxChange = (questionId: string, option: string, checked: boolean) => {
    if (validationErrors[questionId]) {
      setValidationErrors(prev => {
        const updated = { ...prev }
        delete updated[questionId]
        return updated
      })
    }

    const currentList: string[] = Array.isArray(answers[questionId]) ? answers[questionId] : []
    let updated: string[]
    if (checked) {
      updated = [...currentList, option]
    } else {
      updated = currentList.filter(o => o !== option)
    }
    setAnswers(prev => ({ ...prev, [questionId]: updated }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate required questions among visible questions
    const visibleQuestions = questions.filter(isQuestionVisible)
    const errorsMap: Record<string, string> = {}

    for (const q of visibleQuestions) {
      if (q.required) {
        const val = answers[q.id]
        if (
          val === undefined ||
          val === null ||
          val === '' ||
          (Array.isArray(val) && val.length === 0)
        ) {
          errorsMap[q.id] = 'This field is required. Please provide an answer.'
        }
      }
    }

    if (Object.keys(errorsMap).length > 0) {
      setValidationErrors(errorsMap)

      // Auto-scroll to the first missing required question
      const firstMissingQ = visibleQuestions.find(q => errorsMap[q.id])
      if (firstMissingQ) {
        setTimeout(() => {
          const firstElem = document.getElementById(`q_card_${firstMissingQ.id}`)
          if (firstElem) {
            firstElem.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }
        }, 50)
      }
      return
    }

    setSubmitting(true)
    setSubmitError(null)

    try {
      // Determine respondent info
      let respMemberUid = user?.uid || profile?.uid || ''
      let respMemberName = profile?.displayName || profile?.email || ''
      let respEmail = profile?.email || ''

      // If there is a member_selector question answered, record that member name as well
      const memberSelQ = questions.find(q => q.type === 'member_selector')
      if (memberSelQ && answers[memberSelQ.id]) {
        respMemberUid = answers[memberSelQ.id]
        const selectedMem = members.find(m => m.id === answers[memberSelQ.id])
        if (selectedMem) {
          respMemberName = `${selectedMem.lastName}, ${selectedMem.firstName}`
        }
      }

      const trackingNumber = await eventFormResponseService.submitResponse(
        form,
        answers,
        {
          memberUid: respMemberUid,
          memberName: respMemberName,
          email: respEmail
        },
        existingTrackingNumber || undefined
      )

      // For anonymous submissions (no logged-in user, no member_selector chosen),
      // store the tracking number in localStorage so re-submits overwrite instead of duplicate
      if (!user && !respMemberUid && formId) {
        localStorage.setItem(`mats_form_response_${formId}`, trackingNumber)
        setExistingTrackingNumber(trackingNumber)
      }

      setSubmittedTrackingNumber(trackingNumber)
    } catch (err) {
      console.error('Failed to submit form response:', err)
      setSubmitError(err instanceof Error ? err.message : 'Failed to submit form response.')
    } finally {
      setSubmitting(false)
    }
  }

  // Submission Confirmation Screen
  if (submittedTrackingNumber) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
        <div className="bg-white max-w-md w-full rounded-3xl shadow-xl p-8 border border-slate-200 text-center space-y-6">
          {/* Sleek Modern Success Checkmark */}
          <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto shadow-2xs border border-blue-100">
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-black text-slate-900 leading-tight">Response Submitted!</h2>
            <p className="text-xs text-slate-600 leading-relaxed max-w-sm mx-auto">
              {form.confirmationMessage || 'Thank you for submitting your registration response.'}
            </p>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                setAnswers({})
                setSubmittedTrackingNumber(null)
                setValidationErrors({})
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
              className="w-full py-3.5 px-6 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-2xl shadow-md transition-all cursor-pointer"
            >
              Submit Again
            </button>
          </div>
        </div>
      </div>
    )
  }

  const visibleQuestions = questions.filter(isQuestionVisible)

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center py-4 px-3 sm:py-8 sm:px-4 font-sans">
      <div className="max-w-2xl w-full space-y-4 sm:space-y-6">
        
        {/* Form Header Card */}
        <div className="bg-white rounded-2xl sm:rounded-3xl shadow-lg sm:shadow-xl p-5 sm:p-8 border border-slate-200 relative overflow-hidden">
          <div className="h-2.5 sm:h-3 bg-blue-600 absolute top-0 left-0 right-0" />
          <div className="flex items-center space-x-3 mb-3 sm:mb-4">
            <img src="/favicon/favicon.png" alt="MATS" className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl border border-slate-200 shadow-xs" />
            <div>
              <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400">MATS Event Registration</span>
              <h1 className="text-lg sm:text-2xl font-black text-slate-900 leading-tight">{form.title}</h1>
            </div>
          </div>
          {form.description && <p className="text-xs text-slate-600 mt-1.5 sm:mt-2 leading-relaxed">{form.description}</p>}
        </div>

        {/* Public Form Form Element */}
        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
          


          {/* Dynamic Questions Rendering */}
          {visibleQuestions.map((q, idx) => {
            const hasError = !!validationErrors[q.id]

            return (
              <div
                key={q.id}
                id={`q_card_${q.id}`}
                className={`rounded-2xl sm:rounded-3xl p-5 sm:p-6 border space-y-3 transition-all scroll-mt-12 ${
                  hasError
                    ? 'bg-red-50/50 border-red-400 shadow-md ring-2 ring-red-400/20'
                    : 'bg-white border-slate-200 shadow-md sm:shadow-lg'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <label className="text-sm font-bold text-slate-900">
                      {idx + 1}. {q.question}
                      {q.required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    {hasError && (
                      <span className="block text-[11px] font-bold text-red-600 mt-1 animate-pulse">
                        {validationErrors[q.id]}
                      </span>
                    )}
                  </div>
                </div>

                {q.description && <p className="text-xs text-slate-500">{q.description}</p>}

              {/* Render Question Control */}
              <div className="pt-1">
                {q.type === 'short_text' && (
                  <input
                    type="text"
                    required={q.required}
                    value={answers[q.id] || ''}
                    onChange={e => handleInputChange(q.id, e.target.value)}
                    className="w-full p-3 border border-slate-300 rounded-xl text-xs bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    placeholder="Your answer"
                  />
                )}

                {q.type === 'long_text' && (
                  <textarea
                    required={q.required}
                    value={answers[q.id] || ''}
                    onChange={e => handleInputChange(q.id, e.target.value)}
                    className="w-full p-3 border border-slate-300 rounded-xl text-xs bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden h-24"
                    placeholder="Your answer"
                  />
                )}

                {(q.type === 'multiple_choice' || q.type === 'relationship_selector') && (
                  <div className="space-y-2">
                    {(q.options || []).map((opt, oIdx) => (
                      <label key={oIdx} className="flex items-center space-x-3 p-3 border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer transition">
                        <input
                          type="radio"
                          name={`q_${q.id}`}
                          required={q.required}
                          checked={answers[q.id] === opt}
                          onChange={() => handleInputChange(q.id, opt)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-xs font-semibold text-slate-800">{opt}</span>
                      </label>
                    ))}
                  </div>
                )}

                {q.type === 'dropdown' && (
                  <select
                    required={q.required}
                    value={answers[q.id] || ''}
                    onChange={e => handleInputChange(q.id, e.target.value)}
                    className="w-full p-3 border border-slate-300 rounded-xl text-xs bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  >
                    <option value="">Select an option...</option>
                    {(q.options || []).map((opt, oIdx) => (
                      <option key={oIdx} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                )}

                {q.type === 'checkbox' && (
                  <div className="space-y-2">
                    {(q.options || []).map((opt, oIdx) => {
                      const isChecked = Array.isArray(answers[q.id]) && answers[q.id].includes(opt)
                      return (
                        <label key={oIdx} className="flex items-center space-x-3 p-3 border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer transition">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={e => handleCheckboxChange(q.id, opt, e.target.checked)}
                            className="h-4 w-4 text-blue-600 rounded-md focus:ring-blue-500"
                          />
                          <span className="text-xs font-semibold text-slate-800">{opt}</span>
                        </label>
                      )
                    })}
                  </div>
                )}

                {q.type === 'yes_no' && (
                  <div className="flex items-center space-x-4">
                    <label className="flex-1 flex items-center justify-center space-x-2 p-3 border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer transition">
                      <input
                        type="radio"
                        name={`q_${q.id}`}
                        required={q.required}
                        checked={answers[q.id] === 'Yes'}
                        onChange={() => handleInputChange(q.id, 'Yes')}
                        className="h-4 w-4 text-blue-600"
                      />
                      <span className="text-xs font-bold text-slate-800">Yes</span>
                    </label>
                    <label className="flex-1 flex items-center justify-center space-x-2 p-3 border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer transition">
                      <input
                        type="radio"
                        name={`q_${q.id}`}
                        required={q.required}
                        checked={answers[q.id] === 'No'}
                        onChange={() => handleInputChange(q.id, 'No')}
                        className="h-4 w-4 text-blue-600"
                      />
                      <span className="text-xs font-bold text-slate-800">No</span>
                    </label>
                  </div>
                )}

                {q.type === 'member_selector' && (() => {
                  const filteredMembers = members.filter(m => {
                    if (q.memberFilterType === 'order' && q.memberFilterValue) {
                      const allowed = Array.isArray(q.memberFilterValue) ? q.memberFilterValue : [q.memberFilterValue]
                      return !!m.order && allowed.includes(m.order)
                    }
                    if (q.memberFilterType === 'rank' && q.memberFilterValue) {
                      const allowed = Array.isArray(q.memberFilterValue) ? q.memberFilterValue : [q.memberFilterValue]
                      return !!m.rank && allowed.includes(m.rank)
                    }
                    return true
                  })

                  const selectedMemberId = typeof answers[q.id] === 'string' ? answers[q.id] : ''
                  const selectedMember = members.find(m => m.id === selectedMemberId)
                  const isOpen = openMemberPickerQuestionId === q.id

                  const searchFiltered = filteredMembers.filter(m => {
                    if (!memberSearchQuery.trim()) return true
                    const full = `${m.lastName} ${m.firstName} ${m.order || ''} ${m.rank || ''}`.toLowerCase()
                    return full.includes(memberSearchQuery.toLowerCase().trim())
                  })

                  return (
                    <div className="space-y-3">
                      {filteredMembers.length === 0 ? (
                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs font-semibold text-slate-500">
                          All eligible members in this group have already submitted their response.
                        </div>
                      ) : (
                        <div>
                          {/* Trigger Button / Selected Box */}
                          {!isOpen ? (
                            <button
                              type="button"
                              onClick={() => {
                                setOpenMemberPickerQuestionId(q.id)
                                setMemberSearchQuery('')
                              }}
                              className={`w-full p-3.5 border rounded-2xl flex items-center justify-between text-left transition cursor-pointer ${
                                selectedMember
                                  ? 'bg-blue-50/80 border-blue-400 text-blue-900 shadow-2xs'
                                  : 'bg-slate-50 border-slate-300 hover:border-blue-400 text-slate-600'
                              }`}
                            >
                              {selectedMember ? (
                                <div className="flex items-center justify-between w-full">
                                  <div>
                                    <span className="block text-xs font-bold text-slate-900">
                                      {selectedMember.lastName}, {selectedMember.firstName}
                                    </span>
                                    {selectedMember.order && (
                                      <span className="text-[10px] text-blue-700 font-semibold">{selectedMember.order}</span>
                                    )}
                                  </div>
                                  <span className="text-[11px] font-bold text-blue-600 bg-white px-2.5 py-1 rounded-lg border border-blue-200 shadow-2xs">
                                    Change Member
                                  </span>
                                </div>
                              ) : (
                                <div className="flex items-center justify-between w-full">
                                  <span className="text-xs font-semibold text-slate-500">
                                    Click to select member / participant...
                                  </span>
                                  <span className="text-xs text-slate-400 font-bold">▼</span>
                                </div>
                              )}
                            </button>
                          ) : (
                            /* Expanded Picker Card with Search Input */
                            <div className="p-4 bg-white border-2 border-blue-500 rounded-2xl shadow-lg space-y-3">
                              <div className="flex items-center justify-between border-b pb-2">
                                <span className="text-xs font-bold text-slate-800">Select Participant Name</span>
                                <button
                                  type="button"
                                  onClick={() => setOpenMemberPickerQuestionId(null)}
                                  className="text-xs font-bold text-slate-400 hover:text-slate-700 px-2 py-0.5 rounded-md"
                                >
                                  Close ✕
                                </button>
                              </div>

                              <input
                                type="text"
                                autoFocus
                                value={memberSearchQuery}
                                onChange={e => setMemberSearchQuery(e.target.value)}
                                placeholder="Type to search member name or order..."
                                className="w-full p-2.5 border border-slate-300 rounded-xl text-xs bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                              />

                              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                                {searchFiltered.length === 0 ? (
                                  <div className="p-3 text-center text-xs text-slate-400 italic">
                                    No matching active members found.
                                  </div>
                                ) : (
                                  searchFiltered
                                    .sort((a, b) => a.lastName.localeCompare(b.lastName))
                                    .map(m => {
                                      const isSelected = selectedMemberId === m.id
                                      return (
                                        <div
                                          key={m.id}
                                          onClick={() => {
                                            handleInputChange(q.id, m.id)
                                            setOpenMemberPickerQuestionId(null)
                                          }}
                                          className={`flex items-center space-x-3 p-2.5 border rounded-xl cursor-pointer transition ${
                                            isSelected
                                              ? 'bg-blue-50 border-blue-500 text-blue-900 shadow-2xs font-bold'
                                              : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-800'
                                          }`}
                                        >
                                          <input
                                            type="radio"
                                            name={`member_select_${q.id}`}
                                            checked={isSelected}
                                            readOnly
                                            className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                                          />
                                          <div className="flex flex-col">
                                            <span className="text-xs font-bold">
                                              {m.lastName}, {m.firstName}
                                            </span>
                                            {m.order && <span className="text-[10px] text-slate-500">{m.order}</span>}
                                          </div>
                                        </div>
                                      )
                                    })
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })()}

                {q.type === 'name_selector' && (
                  <input
                    type="text"
                    required={q.required}
                    value={answers[q.id] || ''}
                    onChange={e => handleInputChange(q.id, e.target.value)}
                    placeholder="Full Name"
                    className="w-full p-3 border border-slate-300 rounded-xl text-xs bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                )}

                {q.type === 'date' && (
                  <input
                    type="date"
                    required={q.required}
                    value={answers[q.id] || ''}
                    onChange={e => handleInputChange(q.id, e.target.value)}
                    className="w-full p-3 border border-slate-300 rounded-xl text-xs bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                )}

                {q.type === 'time' && (
                  <input
                    type="time"
                    required={q.required}
                    value={answers[q.id] || ''}
                    onChange={e => handleInputChange(q.id, e.target.value)}
                    className="w-full p-3 border border-slate-300 rounded-xl text-xs bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                )}

                {q.type === 'number' && (
                  <input
                    type="number"
                    required={q.required}
                    value={answers[q.id] || ''}
                    onChange={e => handleInputChange(q.id, e.target.value)}
                    placeholder="0"
                    className="w-full p-3 border border-slate-300 rounded-xl text-xs bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                )}
              </div>
            </div>
          )})}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-black text-sm rounded-3xl shadow-xl transition-all disabled:opacity-50 cursor-pointer"
          >
            {submitting ? 'Submitting Response...' : 'Submit Form'}
          </button>
        </form>
      </div>

      <AlertModal
        isOpen={!!submitError}
        onClose={() => setSubmitError(null)}
        title="Form Submission Error"
        message={submitError || ''}
      />
    </div>
  )
}
