import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { eventFormService } from '@/services/eventFormService'
import { eventFormQuestionService } from '@/services/eventFormQuestionService'
import { eventFormResponseService } from '@/services/eventFormResponseService'
import { eventService } from '@/services/eventService'
import { memberService } from '@/services/memberService'
import { useAuth } from '@/features/authentication/AuthContext'
import type { EventForm, EventFormQuestion, EventFormResponse, CompanionEntry } from '@/types/eventForm'
import type { Event } from '@/types/event'
import type { Member } from '@/types/member'
import { AlertModal } from '@/components/Dialog'
import { Loading } from '@/components/Loading'
import { FormattedText } from '@/components/FormattedText'

export const PublicEventFormPage: React.FC = () => {
  const { formId } = useParams<{ eventId: string; formId: string }>()
  const { profile, user } = useAuth()
  const queryClient = useQueryClient()

  const [form, setForm] = useState<EventForm | null>(null)
  const [linkedEvent, setLinkedEvent] = useState<Event | null>(null)
  const [questions, setQuestions] = useState<EventFormQuestion[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [formResponses, setFormResponses] = useState<EventFormResponse[]>([])
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
  const [otherTextAnswers, setOtherTextAnswers] = useState<Record<string, string>>({})

  // Helper to compute used and remaining open slots for an option/category
  const getOptionSlotInfo = (q: EventFormQuestion, opt: string) => {
    const maxLimit = q.optionLimits?.[opt]
    if (!maxLimit || maxLimit <= 0) {
      return { hasLimit: false, maxSlots: 0, usedSlots: 0, openSlots: 0, isFull: false }
    }

    const usedSlots = formResponses.reduce((count, r) => {
      // Exclude current respondent's previous answer ONLY if actively editing that specific submission
      if (existingTrackingNumber && r.trackingNumber === existingTrackingNumber) return count
      const ans = r.answers?.[q.id]
      if (Array.isArray(ans)) {
        return ans.includes(opt) ? count + 1 : count
      }
      return ans === opt ? count + 1 : count
    }, 0)

    const openSlots = Math.max(0, maxLimit - usedSlots)
    const isFull = openSlots <= 0

    return {
      hasLimit: true,
      maxSlots: maxLimit,
      usedSlots,
      openSlots,
      isFull
    }
  }

  useEffect(() => {
    async function loadFormAndQuestions() {
      if (!formId) {
        setPageLoadError('Invalid form link.')
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        const formData = await queryClient.fetchQuery({
          queryKey: ['public-event-form', formId],
          queryFn: () => eventFormService.getFormById(formId),
          staleTime: 0
        })
        if (!formData || !formData.id) {
          setPageLoadError('Event form not found.')
          setLoading(false)
          return
        }

        setForm(formData)

        // Load linked event details if available
        if (formData.eventId) {
          try {
            const ev = await queryClient.fetchQuery({
              queryKey: ['event-details-public', formData.eventId],
              queryFn: () => eventService.getEventById(formData.eventId),
              staleTime: 1000 * 60 * 5
            })
            setLinkedEvent(ev)
          } catch (err) {
            console.error('Failed to load linked event for banner:', err)
          }
        }

        if (formData.status !== 'published') {
          setPageLoadError(formData.status === 'draft' ? 'draft' : 'closed')
          setLoading(false)
          return
        }

        if (!formData.isPublic && !user) {
          setPageLoadError('auth_required')
          setLoading(false)
          return
        }

        const realFormId: string = formData.id
        const qs = await queryClient.fetchQuery({
          queryKey: ['event-form-questions', realFormId],
          queryFn: () => eventFormQuestionService.getQuestionsByFormId(realFormId),
          staleTime: 0
        })
        setQuestions(qs)

        // Load all existing submissions to calculate member uniqueness & category slot limits
        let existingResponses: EventFormResponse[] = []
        try {
          existingResponses = await queryClient.fetchQuery({
            queryKey: ['public-form-submissions', realFormId],
            queryFn: () => eventFormResponseService.getResponsesByFormId(realFormId),
            staleTime: 0
          })
          setFormResponses(existingResponses)
        } catch (err) {
          console.error('Failed to load responses for slot limits:', err)
        }

        // If form contains a member selector, load active members list and exclude already submitted members
        if (qs.some(q => q.type === 'member_selector')) {
          try {
            const allMembers = await queryClient.fetchQuery({
              queryKey: ['members', 'active-for-public-form'],
              queryFn: () => memberService.getMembers(),
              staleTime: 1000 * 60 * 10 // 10 minutes cache
            })
            const activeMembers = allMembers.filter(m => m.status === 'active')

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
  }, [formId, user, queryClient])

  // Do not automatically load previous tracking number on mount to ensure new entries are separate
  useEffect(() => {
    // Clean slate on initial page load
    setExistingTrackingNumber(null)
  }, [form?.id])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Loading variant="spinner" label="Loading registration form..." />
      </div>
    )
  }

  if (!form || pageLoadError || form.status !== 'published') {
    const isTempClosed = form?.status === 'temporary_closed' || form?.status === 'draft' || pageLoadError === 'draft'
    const isAuthRequired = pageLoadError === 'auth_required'

    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4 font-sans relative overflow-hidden">
        {/* Background glow accents */}
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="bg-white max-w-lg w-full rounded-3xl shadow-xl p-8 sm:p-10 border border-slate-200/80 text-center relative z-10 animate-in fade-in zoom-in-95 duration-200">
          {/* Logo Header */}
          <div className="w-20 h-20 rounded-3xl overflow-hidden border-2 border-indigo-100 shadow-md flex items-center justify-center bg-white mx-auto mb-6 p-1">
            <img src="/favicon/favicon.png" alt="Ministry Logo" className="w-full h-full object-cover rounded-2xl" />
          </div>

          {/* Status Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider mb-4 border shadow-xs">
            {isTempClosed ? (
              <span className="bg-amber-50 text-amber-800 border-amber-200 flex items-center gap-1.5 px-3 py-1 rounded-full">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                Temporary Closed
              </span>
            ) : isAuthRequired ? (
              <span className="bg-indigo-50 text-indigo-800 border-indigo-200 flex items-center gap-1.5 px-3 py-1 rounded-full">
                <span className="w-2 h-2 rounded-full bg-indigo-500" />
                Authentication Required
              </span>
            ) : (
              <span className="bg-rose-50 text-rose-800 border-rose-200 flex items-center gap-1.5 px-3 py-1 rounded-full">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                Totally Closed / Link Unavailable
              </span>
            )}
          </div>

          {/* Title */}
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mb-3">
            {isTempClosed
              ? 'Event Form Temporarily Closed'
              : isAuthRequired
              ? 'Login Required to Access Form'
              : 'Event Form Closed'}
          </h2>

          {/* Description & Explanation */}
          <div className="bg-slate-50 border border-slate-200/80 p-5 rounded-2xl text-left space-y-2 mb-6">
            {form?.title && (
              <div className="text-xs font-black text-blue-600 mb-1 uppercase tracking-wide">
                {form.title}
              </div>
            )}
            <p className="text-xs font-medium text-slate-600 leading-relaxed">
              {isTempClosed ? (
                <>
                  Ang form na ito ay <strong>pansamantalang sarado (Temporary Closed)</strong> dahil kasalukuyan pa itong inihahanda at nasa <strong>Draft stage</strong> ng administrator.
                  <br /><br />
                  Mangyaring maghintay hanggang sa opisyal itong i-publish.
                </>
              ) : isAuthRequired ? (
                <>
                  Ang form na ito ay eksklusibo lamang para sa mga rehistradong miyembro. Mangyaring mag-login muna sa iyong account upang mabuksan ang form.
                </>
              ) : (
                <>
                  Ang form na ito ay <strong>lubusan nang sarado (Totally Closed)</strong> o hindi na tumatanggap ng mga bagong tugon. Maaaring tapos na ang registration period o in-archive na ito.
                </>
              )}
            </p>
          </div>

          {/* Actions / Info footer */}
          <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400 font-bold">
            <span>Ministry of Altar Servers</span>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl transition cursor-pointer"
            >
              Refresh Page
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Check if current user already submitted on a single-response form
  const userPreviousResponse =
    user?.uid && form && !form.allowMultipleResponses
      ? formResponses.find(r => r.respondentMemberUid === user.uid)
      : null

  if (userPreviousResponse && !existingTrackingNumber && !submittedTrackingNumber) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4 font-sans relative overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="bg-white max-w-md w-full rounded-3xl shadow-xl p-8 sm:p-10 border border-slate-200/80 text-center relative z-10 animate-in fade-in zoom-in-95 duration-200 space-y-6">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mx-auto shadow-xs border border-blue-100">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">You've Already Responded</h2>
            <p className="text-xs text-slate-600 leading-relaxed max-w-sm mx-auto">
              Nakasagot ka na sa form na ito (<strong>{form.title}</strong>). Ang form na ito ay may limitasyon na 1 response lamang bawat kalahok.
            </p>
          </div>

          <div className="pt-2 flex flex-col gap-2.5">
            {form.allowEditResponse ? (
              <button
                type="button"
                onClick={() => {
                  const prevAns = userPreviousResponse.answers || {}
                  setAnswers(prevAns)
                  const initOther: Record<string, string> = {}
                  Object.entries(prevAns).forEach(([qId, val]) => {
                    if (typeof val === 'string' && val.startsWith('Other: ')) {
                      initOther[qId] = val.replace(/^Other:\s*/, '')
                    } else if (Array.isArray(val)) {
                      const otherItem = val.find(v => typeof v === 'string' && v.startsWith('Other: '))
                      if (otherItem) {
                        initOther[qId] = otherItem.replace(/^Other:\s*/, '')
                      }
                    }
                  })
                  setOtherTextAnswers(initOther)
                  setExistingTrackingNumber(userPreviousResponse.trackingNumber)
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
                className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-md shadow-amber-500/20 flex items-center justify-center space-x-1.5"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <span>Edit Your Response</span>
              </button>
            ) : (
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-500 font-medium">
                Ang mga sagot ay pinal na at hindi na maaaring baguhin. Kung may kailangang iwasto, mangyaring makipag-ugnayan sa administrator.
              </div>
            )}
          </div>
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

      // Validate option slot limits
      if (q.optionLimits && Object.keys(q.optionLimits).length > 0) {
        const val = answers[q.id]
        if (val) {
          const selectedOpts = Array.isArray(val) ? val : [val]
          for (const selOpt of selectedOpts) {
            if (typeof selOpt === 'string') {
              const slotInfo = getOptionSlotInfo(q, selOpt)
              if (slotInfo.isFull) {
                errorsMap[q.id] = `The category / option "${selOpt}" is already full (${slotInfo.maxSlots} max slots reached). Please select another option.`
              }
            }
          }
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
        <div className="bg-white max-w-md w-full rounded-3xl shadow-xl p-8 border border-slate-200 text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
          {/* Sleek Modern Success Checkmark */}
          <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-2xs border border-emerald-100">
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

          <div className="pt-2 flex flex-col gap-2.5">
            {/* Show Edit Button ONLY if allowEditResponse is ON */}
            {form.allowEditResponse && (
              <button
                type="button"
                onClick={() => {
                  setExistingTrackingNumber(submittedTrackingNumber)
                  setSubmittedTrackingNumber(null)
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
                className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-md shadow-amber-500/20 flex items-center justify-center space-x-1.5"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <span>Edit Your Response</span>
              </button>
            )}

            {/* Submit Another Response Button (ONLY if allowMultipleResponses is ON!) */}
            {form.allowMultipleResponses ? (
              <button
                type="button"
                onClick={async () => {
                  setAnswers({})
                  setSubmittedTrackingNumber(null)
                  setExistingTrackingNumber(null)
                  setValidationErrors({})

                  // Re-fetch existing responses so member list and slot counts are updated immediately!
                  if (form?.id) {
                    try {
                      const rs = await eventFormResponseService.getResponsesByFormId(form.id)
                      setFormResponses(rs)

                      if (questions.some(q => q.type === 'member_selector')) {
                        const allMembers = await memberService.getMembers()
                        const activeMembers = allMembers.filter(m => m.status === 'active')
                        const submittedSet = new Set<string>()
                        rs.forEach(r => {
                          if (r.respondentMemberUid) submittedSet.add(r.respondentMemberUid)
                          Object.values(r.answers).forEach(val => {
                            if (typeof val === 'string' && val.startsWith('mem_')) {
                              submittedSet.add(val)
                            }
                          })
                        })
                        setMembers(activeMembers.filter(m => !submittedSet.has(m.id)))
                      }
                    } catch (err) {
                      console.error('Failed to reload form responses after submission:', err)
                    }
                  }
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-md shadow-blue-500/20 flex items-center justify-center space-x-1.5"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                <span>Submit Another Response</span>
              </button>
            ) : (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
                <span className="text-[11px] font-medium text-slate-500">
                  This form is limited to 1 response per respondent.
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  const visibleQuestions = questions.filter(isQuestionVisible)

  const checkQuestionFilled = (q: EventFormQuestion): boolean => {
    if (q.type === 'section_header') return true
    const val = answers[q.id]
    if (q.type === 'companion_repeater' && Array.isArray(val) && val.length > 0) {
      const allNamed = val.every((c: any) => c && typeof c.name === 'string' && c.name.trim().length > 0)
      if (!allNamed) return false
    }
    if (!q.required) return true
    if (val === undefined || val === null || val === '') return false
    if (val === '__other__') return false // User chose Other but didn't specify text
    if (typeof val === 'string' && val.startsWith('Other:') && !val.replace(/^Other:\s*/, '').trim()) return false
    if (Array.isArray(val)) {
      if (val.length === 0) return false
      // Filter out empty '__other__' items
      const validItems = val.filter(v => v !== '__other__' && !(typeof v === 'string' && v.startsWith('Other:') && !v.replace(/^Other:\s*/, '').trim()))
      if (validItems.length === 0) return false
    }
    return true
  }

  const missingRequiredQuestions = visibleQuestions.filter(q => !checkQuestionFilled(q))
  const isFormComplete = missingRequiredQuestions.length === 0

  const purposeLabels: Record<string, { label: string; bg: string }> = {
    registration: { label: 'Event Registration / RSVP', bg: 'bg-blue-100 text-blue-800 border-blue-200' },
    survey: { label: 'Survey & Feedback', bg: 'bg-purple-100 text-purple-800 border-purple-200' },
    consent: { label: 'Consent / Permission Slip', bg: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
    order: { label: 'Order / Merchandise Form', bg: 'bg-amber-100 text-amber-800 border-amber-200' },
    general: { label: 'General Information Form', bg: 'bg-slate-100 text-slate-700 border-slate-200' }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center py-4 px-3 sm:py-8 sm:px-4 font-sans">
      <div className="max-w-2xl w-full space-y-4 sm:space-y-6">
        
        {/* Form Header Card */}
        <div className="bg-white rounded-2xl sm:rounded-3xl shadow-lg sm:shadow-xl p-5 sm:p-8 border border-slate-200 relative overflow-hidden space-y-4">
          <div className="h-2.5 sm:h-3 bg-blue-600 absolute top-0 left-0 right-0" />
          
          <div className="flex items-start justify-between gap-3 pt-1">
            <div className="flex items-center space-x-3">
              <img src="/favicon/favicon.png" alt="MATS" className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl border border-slate-200 shadow-xs" />
              <div>
                <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400">MATS Online Forms</span>
                <h1 className="text-lg sm:text-2xl font-black text-slate-900 leading-tight">{form.title}</h1>
              </div>
            </div>

            {/* Purpose Category Tag Badge */}
            {form.purposeTag && (
              <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] sm:text-xs font-bold border shrink-0 ${purposeLabels[form.purposeTag]?.bg || 'bg-blue-100 text-blue-800 border-blue-200'}`}>
                {purposeLabels[form.purposeTag]?.label || form.purposeTag}
              </span>
            )}
          </div>

          {/* Linked Event Info Banner */}
          {form.showEventBanner !== false && linkedEvent && (
            <div className="p-3.5 bg-blue-50/70 border border-blue-200/80 rounded-2xl space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-blue-950 flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-blue-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {linkedEvent.title}
                </span>
                {linkedEvent.stage && (
                  <span className="text-[10px] font-bold uppercase text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded-md border border-blue-200">
                    {linkedEvent.stage}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-blue-900/80 pt-1 border-t border-blue-100">
                {(linkedEvent.startDate || linkedEvent.startTime) && (
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-blue-950">Schedule:</span>
                    <span>{linkedEvent.startDate} {linkedEvent.startTime && `• ${linkedEvent.startTime}`}</span>
                  </div>
                )}
                {linkedEvent.location && (
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-blue-950">Location:</span>
                    <span className="line-clamp-1">{linkedEvent.location}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Form Purpose & Objective Description */}
          {form.description && (
            <div className="text-xs sm:text-sm text-slate-700 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
              <FormattedText text={form.description} />
            </div>
          )}

          {/* Guidelines & Important Reminders Box */}
          {form.guidelines && (
            <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-2xl space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>Important Guidelines & Reminders</span>
              </div>
              <div className="text-xs text-amber-950">
                <FormattedText text={form.guidelines} />
              </div>
            </div>
          )}

          {/* Dynamic Contacts & Inquiry Information */}
          {((form.contacts && form.contacts.length > 0) || form.contactPerson || form.contactInfo) && (
            <div className="pt-3 border-t border-slate-100 space-y-2">
              <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
                </svg>
                <span>For Inquiries & Questions:</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {(form.contacts && form.contacts.length > 0
                  ? form.contacts
                  : [
                      ...(form.contactPerson ? [{ id: '1', type: 'coordinator' as const, label: 'Coordinator', value: form.contactPerson }] : []),
                      ...(form.contactInfo ? [{ id: '2', type: 'phone' as const, label: 'Contact', value: form.contactInfo }] : [])
                    ]
                ).map((c, idx) => {
                  const isPhone = c.type === 'phone' || /^[0-9\+\-\s\(\)]+$/.test(c.value)
                  const isEmail = c.type === 'email' || c.value.includes('@')
                  const isUrl = c.type === 'messenger' || c.value.startsWith('http') || c.value.startsWith('m.me') || c.value.startsWith('fb.com')

                  return (
                    <div key={c.id || idx} className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-100 rounded-xl">
                      <div className="flex items-center space-x-2 overflow-hidden">
                        {c.type === 'coordinator' && (
                          <svg className="w-4 h-4 text-blue-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        )}
                        {c.type === 'phone' && (
                          <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                        )}
                        {c.type === 'email' && (
                          <svg className="w-4 h-4 text-purple-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                        )}
                        {c.type === 'messenger' && (
                          <svg className="w-4 h-4 text-sky-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                        )}
                        {c.type === 'custom' && (
                          <svg className="w-4 h-4 text-slate-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )}
                        <span className="text-[11px] font-semibold text-slate-500 truncate">{c.label}:</span>
                      </div>

                      <div className="font-bold text-slate-900 ml-2 truncate">
                        {isPhone ? (
                          <a href={`tel:${c.value.replace(/[^0-9\+]/g, '')}`} className="text-blue-600 hover:underline">
                            {c.value}
                          </a>
                        ) : isEmail ? (
                          <a href={`mailto:${c.value}`} className="text-blue-600 hover:underline">
                            {c.value}
                          </a>
                        ) : isUrl ? (
                          <a href={c.value.startsWith('http') ? c.value : `https://${c.value}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                            {c.value}
                          </a>
                        ) : (
                          <span>{c.value}</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Active Edit Mode Banner */}
        {existingTrackingNumber && (
          <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start sm:items-center space-x-3">
              <div className="p-2 bg-amber-100 text-amber-800 rounded-xl shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <div>
                <span className="text-xs font-black text-amber-950 block">Currently Editing Previous Submission</span>
                <span className="text-[11px] font-semibold text-amber-800">
                  Saving will update your previously submitted response.
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setExistingTrackingNumber(null)
                setAnswers({})
                setValidationErrors({})
              }}
              className="px-3.5 py-2 bg-white hover:bg-amber-100 text-amber-900 text-xs font-bold rounded-xl border border-amber-300 transition cursor-pointer shadow-2xs self-end sm:self-auto shrink-0"
            >
              Cancel Edit / Start Fresh
            </button>
          </div>
        )}

        {/* Public Form Form Element */}
        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
          {/* Dynamic Questions Rendering */}
          {visibleQuestions.map((q, idx) => {
            const hasError = !!validationErrors[q.id]
            const isSectionHeader = q.type === 'section_header'

            if (isSectionHeader) {
              return (
                <div
                  key={q.id}
                  id={`q_card_${q.id}`}
                  className="bg-indigo-50/70 border border-indigo-200 rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-sm space-y-1 relative overflow-hidden"
                >
                  <div className="h-1.5 bg-indigo-600 absolute top-0 left-0 right-0" />
                  <div className="text-base sm:text-lg font-black text-indigo-950 flex items-center gap-2">
                    <svg className="w-5 h-5 text-indigo-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <FormattedText text={q.question} as="span" />
                  </div>
                  {q.description && (
                    <div className="text-xs sm:text-sm text-indigo-900/80 leading-relaxed pt-1">
                      <FormattedText text={q.description} />
                    </div>
                  )}
                </div>
              )
            }

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
                  <div className="space-y-0.5">
                    <label className="text-sm font-bold text-slate-900 inline-flex flex-wrap items-baseline gap-1">
                      <span className="shrink-0">{idx + 1}.</span>
                      <FormattedText text={q.question} as="span" />
                      {q.required && <span className="text-red-500 ml-1 shrink-0">*</span>}
                    </label>
                    {hasError && (
                      <span className="block text-[11px] font-bold text-red-600 animate-pulse">
                        {validationErrors[q.id]}
                      </span>
                    )}
                  </div>
                </div>

                {q.description && (
                  <div className="text-xs text-slate-500">
                    <FormattedText text={q.description} />
                  </div>
                )}

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
                    {(q.options || []).map((opt, oIdx) => {
                      const slotInfo = getOptionSlotInfo(q, opt)
                      if (slotInfo.isFull && q.fullOptionBehavior === 'hide') {
                        return null
                      }
                      const isOptionFull = slotInfo.isFull
                      const isSelected = answers[q.id] === opt

                      return (
                        <label
                          key={oIdx}
                          className={`flex items-center justify-between p-3.5 border rounded-2xl transition ${
                            isOptionFull
                              ? 'opacity-50 bg-slate-100/90 border-slate-200 cursor-not-allowed select-none'
                              : isSelected
                              ? 'bg-blue-50/80 border-blue-400 shadow-2xs cursor-pointer'
                              : 'border-slate-200 hover:bg-slate-50 cursor-pointer'
                          }`}
                        >
                          <div className="flex items-center space-x-3">
                            <input
                              type="radio"
                              name={`q_${q.id}`}
                              disabled={isOptionFull}
                              checked={isSelected}
                              onChange={() => !isOptionFull && handleInputChange(q.id, opt)}
                              className={`h-4 w-4 text-blue-600 focus:ring-blue-500 ${isOptionFull ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                            />
                            <span className={`text-xs font-semibold ${isOptionFull ? 'text-slate-500 line-through decoration-slate-400' : 'text-slate-800'}`}>
                              {opt}
                            </span>
                          </div>

                          {slotInfo.hasLimit && (
                            <div className="shrink-0 ml-2">
                              {isOptionFull ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-700 border border-rose-200 uppercase tracking-wide">
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                  FULL (0 Slots Left)
                                </span>
                              ) : (
                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                  slotInfo.openSlots <= 3
                                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                                    : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                }`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${slotInfo.openSlots <= 3 ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                                  {slotInfo.openSlots} open {slotInfo.openSlots === 1 ? 'slot' : 'slots'} left ({slotInfo.usedSlots}/{slotInfo.maxSlots})
                                </span>
                              )}
                            </div>
                          )}
                        </label>
                      )
                    })}

                    {/* "Other" Option Radio with expanding input */}
                    {q.hasOtherOption && (() => {
                      const isOtherSelected = answers[q.id] === '__other__' || (typeof answers[q.id] === 'string' && (answers[q.id].startsWith('Other:') || !q.options?.includes(answers[q.id])))
                      const customText = otherTextAnswers[q.id] ?? (typeof answers[q.id] === 'string' && answers[q.id].startsWith('Other:') ? answers[q.id].replace(/^Other:\s*/, '') : (typeof answers[q.id] === 'string' && !q.options?.includes(answers[q.id]) && answers[q.id] !== '__other__' ? answers[q.id] : ''))

                      return (
                        <div
                          className={`p-3.5 border rounded-2xl transition space-y-2.5 ${
                            isOtherSelected
                              ? 'bg-blue-50/80 border-blue-400 shadow-2xs'
                              : 'border-slate-200 hover:bg-slate-50 cursor-pointer'
                          }`}
                          onClick={() => {
                            if (!isOtherSelected) {
                              const text = customText
                              const nextVal = text.trim() ? `Other: ${text.trim()}` : '__other__'
                              handleInputChange(q.id, nextVal)
                            }
                          }}
                        >
                          <div className="flex items-center space-x-3">
                            <input
                              type="radio"
                              name={`q_${q.id}`}
                              checked={isOtherSelected}
                              onChange={() => {
                                const text = customText
                                const nextVal = text.trim() ? `Other: ${text.trim()}` : '__other__'
                                handleInputChange(q.id, nextVal)
                              }}
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
                            />
                            <span className="text-xs font-semibold text-slate-800">
                              {q.otherOptionLabel || 'Other'}:
                            </span>
                          </div>

                          {isOtherSelected && (
                            <div className="pl-7 animate-in fade-in slide-in-from-top-1" onClick={e => e.stopPropagation()}>
                              <input
                                type="text"
                                value={customText}
                                onChange={e => {
                                  const val = e.target.value
                                  setOtherTextAnswers(prev => ({ ...prev, [q.id]: val }))
                                  handleInputChange(q.id, val.trim() ? `Other: ${val.trim()}` : '__other__')
                                }}
                                placeholder={q.otherOptionPlaceholder || 'Please specify...'}
                                autoFocus
                                className="w-full h-10 px-3.5 bg-white border border-blue-300 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 placeholder:text-slate-400 placeholder:font-normal placeholder:italic focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 shadow-2xs transition"
                              />
                            </div>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                )}

                {q.type === 'dropdown' && (() => {
                  const isOtherSelected = answers[q.id] === '__other__' || (typeof answers[q.id] === 'string' && (answers[q.id].startsWith('Other:') || !q.options?.includes(answers[q.id])))
                  const customText = otherTextAnswers[q.id] ?? (typeof answers[q.id] === 'string' && answers[q.id].startsWith('Other:') ? answers[q.id].replace(/^Other:\s*/, '') : (typeof answers[q.id] === 'string' && !q.options?.includes(answers[q.id]) && answers[q.id] !== '__other__' ? answers[q.id] : ''))

                  return (
                    <div className="space-y-2">
                      <div className="relative">
                        <select
                          value={isOtherSelected ? '__other__' : (answers[q.id] || '')}
                          onChange={e => {
                            const val = e.target.value
                            if (val === '__other__') {
                              const text = customText
                              handleInputChange(q.id, text.trim() ? `Other: ${text.trim()}` : '__other__')
                            } else {
                              handleInputChange(q.id, val)
                            }
                          }}
                          className="w-full h-11 pl-3.5 pr-10 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold bg-white text-slate-800 appearance-none focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 shadow-2xs transition cursor-pointer"
                        >
                          <option value="">Select an option...</option>
                          {(q.options || []).map((opt, oIdx) => {
                            const slotInfo = getOptionSlotInfo(q, opt)
                            if (slotInfo.isFull && q.fullOptionBehavior === 'hide') {
                              return null
                            }
                            return (
                              <option
                                key={oIdx}
                                value={opt}
                                disabled={slotInfo.isFull}
                                className={slotInfo.isFull ? 'text-slate-400 bg-slate-100' : ''}
                              >
                                {opt}
                                {slotInfo.hasLimit
                                  ? slotInfo.isFull
                                    ? ' — [FULL / No Slots Left]'
                                    : ` (${slotInfo.openSlots} / ${slotInfo.maxSlots} open slots)`
                                  : ''}
                              </option>
                            )
                          })}
                          {q.hasOtherOption && (
                            <option value="__other__">
                              {q.otherOptionLabel || 'Other (Please specify...)'}
                            </option>
                          )}
                        </select>
                        <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                          </svg>
                        </div>
                      </div>

                      {isOtherSelected && (
                        <div className="animate-in fade-in slide-in-from-top-1">
                          <input
                            type="text"
                            value={customText}
                            onChange={e => {
                              const val = e.target.value
                              setOtherTextAnswers(prev => ({ ...prev, [q.id]: val }))
                              handleInputChange(q.id, val.trim() ? `Other: ${val.trim()}` : '__other__')
                            }}
                            placeholder={q.otherOptionPlaceholder || 'Please specify...'}
                            autoFocus
                            className="w-full h-10 px-3.5 bg-white border border-blue-300 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 placeholder:text-slate-400 placeholder:font-normal placeholder:italic focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 shadow-2xs transition"
                          />
                        </div>
                      )}
                    </div>
                  )
                })()}

                {q.type === 'checkbox' && (() => {
                  const currentArray: string[] = Array.isArray(answers[q.id]) ? answers[q.id] : []
                  const hasOtherChecked = currentArray.some(v => v === '__other__' || (typeof v === 'string' && (v.startsWith('Other:') || !q.options?.includes(v))))
                  const otherItem = currentArray.find(v => typeof v === 'string' && (v.startsWith('Other:') || !q.options?.includes(v) && v !== '__other__'))
                  const customText = otherTextAnswers[q.id] ?? (otherItem ? (otherItem.startsWith('Other:') ? otherItem.replace(/^Other:\s*/, '') : otherItem) : '')

                  return (
                    <div className="space-y-2">
                      {(q.options || []).map((opt, oIdx) => {
                        const slotInfo = getOptionSlotInfo(q, opt)
                        if (slotInfo.isFull && q.fullOptionBehavior === 'hide') {
                          return null
                        }
                        const isOptionFull = slotInfo.isFull
                        const isChecked = currentArray.includes(opt)

                        return (
                          <label
                            key={oIdx}
                            className={`flex items-center justify-between p-3.5 border rounded-2xl transition ${
                              isOptionFull && !isChecked
                                ? 'opacity-50 bg-slate-100/90 border-slate-200 cursor-not-allowed select-none'
                                : isChecked
                                ? 'bg-blue-50/80 border-blue-400 shadow-2xs cursor-pointer'
                                : 'border-slate-200 hover:bg-slate-50 cursor-pointer'
                            }`}
                          >
                            <div className="flex items-center space-x-3">
                              <input
                                type="checkbox"
                                disabled={isOptionFull && !isChecked}
                                checked={isChecked}
                                onChange={e => {
                                  if (isOptionFull && !isChecked) return
                                  handleCheckboxChange(q.id, opt, e.target.checked)
                                }}
                                className={`h-4 w-4 text-blue-600 rounded-md focus:ring-blue-500 ${
                                  isOptionFull && !isChecked ? 'cursor-not-allowed' : 'cursor-pointer'
                                }`}
                              />
                              <span className={`text-xs font-semibold ${isOptionFull && !isChecked ? 'text-slate-500 line-through decoration-slate-400' : 'text-slate-800'}`}>
                                {opt}
                              </span>
                            </div>

                            {slotInfo.hasLimit && (
                              <div className="shrink-0 ml-2">
                                {isOptionFull ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-700 border border-rose-200 uppercase tracking-wide">
                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                    FULL (0 Slots Left)
                                  </span>
                                ) : (
                                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                    slotInfo.openSlots <= 3
                                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                                      : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  }`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${slotInfo.openSlots <= 3 ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                                    {slotInfo.openSlots} open {slotInfo.openSlots === 1 ? 'slot' : 'slots'} left ({slotInfo.usedSlots}/{slotInfo.maxSlots})
                                  </span>
                                )}
                              </div>
                            )}
                          </label>
                        )
                      })}

                      {/* "Other" Option Checkbox with expanding input */}
                      {q.hasOtherOption && (
                        <div
                          className={`p-3.5 border rounded-2xl transition space-y-2.5 ${
                            hasOtherChecked
                              ? 'bg-blue-50/80 border-blue-400 shadow-2xs'
                              : 'border-slate-200 hover:bg-slate-50 cursor-pointer'
                          }`}
                          onClick={() => {
                            if (!hasOtherChecked) {
                              const text = customText
                              const nextVal = text.trim() ? `Other: ${text.trim()}` : '__other__'
                              setAnswers(prev => {
                                const list = Array.isArray(prev[q.id]) ? prev[q.id] : []
                                return { ...prev, [q.id]: [...list, nextVal] }
                              })
                            }
                          }}
                        >
                          <div className="flex items-center space-x-3">
                            <input
                              type="checkbox"
                              checked={hasOtherChecked}
                              onChange={e => {
                                const checked = e.target.checked
                                setAnswers(prev => {
                                  const list: string[] = Array.isArray(prev[q.id]) ? prev[q.id] : []
                                  const filtered = list.filter(v => v !== '__other__' && !(typeof v === 'string' && (v.startsWith('Other:') || !q.options?.includes(v))))
                                  if (checked) {
                                    const text = customText
                                    const nextVal = text.trim() ? `Other: ${text.trim()}` : '__other__'
                                    return { ...prev, [q.id]: [...filtered, nextVal] }
                                  }
                                  return { ...prev, [q.id]: filtered }
                                })
                              }}
                              className="h-4 w-4 text-blue-600 rounded-md focus:ring-blue-500 cursor-pointer shrink-0"
                            />
                            <span className="text-xs font-semibold text-slate-800">
                              {q.otherOptionLabel || 'Other'}:
                            </span>
                          </div>

                          {hasOtherChecked && (
                            <div className="pl-7 animate-in fade-in slide-in-from-top-1" onClick={e => e.stopPropagation()}>
                              <input
                                type="text"
                                value={customText}
                                onChange={e => {
                                  const val = e.target.value
                                  setOtherTextAnswers(prev => ({ ...prev, [q.id]: val }))
                                  setAnswers(prev => {
                                    const list: string[] = Array.isArray(prev[q.id]) ? prev[q.id] : []
                                    const filtered = list.filter(v => v !== '__other__' && !(typeof v === 'string' && (v.startsWith('Other:') || !q.options?.includes(v))))
                                    const nextVal = val.trim() ? `Other: ${val.trim()}` : '__other__'
                                    return { ...prev, [q.id]: [...filtered, nextVal] }
                                  })
                                }}
                                placeholder={q.otherOptionPlaceholder || 'Please specify...'}
                                autoFocus
                                className="w-full h-10 px-3.5 bg-white border border-blue-300 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 placeholder:text-slate-400 placeholder:font-normal placeholder:italic focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 shadow-2xs transition"
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })()}

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

                {q.type === 'companion_repeater' && (() => {
                  const companionsList: CompanionEntry[] = Array.isArray(answers[q.id]) ? answers[q.id] : []

                  const handleAddCompanion = () => {
                    const newComp: CompanionEntry = {
                      id: `comp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                      name: '',
                      relationship: 'Parent',
                      notes: ''
                    }
                    handleInputChange(q.id, [...companionsList, newComp])
                  }

                  const handleUpdateCompanion = (cId: string, updates: Partial<CompanionEntry>) => {
                    const updated = companionsList.map(c => (c.id === cId ? { ...c, ...updates } : c))
                    handleInputChange(q.id, updated)
                  }

                  const handleRemoveCompanion = (cId: string) => {
                    const updated = companionsList.filter(c => c.id !== cId)
                    handleInputChange(q.id, updated)
                  }

                  return (
                    <div className="space-y-4">
                      {companionsList.length === 0 ? (
                        <div className="p-4 bg-slate-50 border border-dashed border-slate-300 rounded-2xl text-center space-y-2">
                          <p className="text-xs font-semibold text-slate-500">No companions added yet.</p>
                          <p className="text-[11px] text-slate-400">If you are bringing family members, companions, or guests, add them here.</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {companionsList.map((comp, cIdx) => (
                            <div key={comp.id} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 shadow-2xs relative">
                              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                                <div className="flex items-center space-x-2">
                                  <span className="w-5 h-5 bg-blue-100 text-blue-700 font-black rounded-full flex items-center justify-center text-[10px]">
                                    {cIdx + 1}
                                  </span>
                                  <span className="text-xs font-bold text-slate-800">Companion / Kasama #{cIdx + 1}</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveCompanion(comp.id)}
                                  className="text-xs font-bold text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded-lg transition cursor-pointer"
                                >
                                  Remove ✕
                                </button>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Companion Full Name</label>
                                  <input
                                    type="text"
                                    value={comp.name}
                                    onChange={e => handleUpdateCompanion(comp.id, { name: e.target.value })}
                                    placeholder="Full Name (e.g. Maria Dela Cruz)"
                                    className="w-full p-2.5 border border-slate-300 rounded-xl text-xs bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-semibold"
                                  />
                                </div>

                                <div>
                                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Relationship</label>
                                  <select
                                    value={comp.relationship || 'Parent'}
                                    onChange={e => handleUpdateCompanion(comp.id, { relationship: e.target.value })}
                                    className="w-full p-2.5 border border-slate-300 rounded-xl text-xs bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                                  >
                                    <option value="Guardian">Guardian</option>
                                    <option value="Parent">Parent</option>
                                    <option value="Sibling">Sibling</option>
                                  </select>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={handleAddCompanion}
                        className="w-full py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-xl border border-blue-200 transition cursor-pointer flex items-center justify-center space-x-1.5 shadow-2xs"
                      >
                        <span>+ Add Companion / Dagdag Kasama</span>
                      </button>
                    </div>
                  )
                })()}
              </div>
            </div>
          )})}

          {/* Live Completion Alert & Submit Button */}
          <div className="pt-2 space-y-3">
            {!isFormComplete ? (
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between text-xs text-amber-800 shadow-2xs">
                <div className="flex items-center space-x-2 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping shrink-0" />
                  <span>Please complete all required fields (*) before submitting.</span>
                </div>
                <span className="font-bold bg-amber-100/80 px-2.5 py-1 rounded-xl text-amber-900 shrink-0 text-[11px]">
                  {missingRequiredQuestions.length} required left
                </span>
              </div>
            ) : (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center space-x-2 text-xs text-emerald-800 font-semibold shadow-2xs">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                <span>All required fields completed! You can now submit your response.</span>
              </div>
            )}

            <button
              type="submit"
              disabled={!isFormComplete || submitting}
              className={`w-full py-4 font-black text-sm rounded-3xl transition-all shadow-xl flex items-center justify-center space-x-2 ${
                isFormComplete && !submitting
                  ? existingTrackingNumber
                    ? 'bg-amber-600 hover:bg-amber-700 text-white cursor-pointer shadow-amber-500/25'
                    : 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer shadow-blue-500/25'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300 shadow-none'
              }`}
            >
              <span>
                {submitting
                  ? existingTrackingNumber
                    ? 'Saving Changes...'
                    : 'Submitting Response...'
                  : isFormComplete
                  ? existingTrackingNumber
                    ? 'Save Changes'
                    : 'Submit Response'
                  : `Fill all required fields to submit (${missingRequiredQuestions.length} remaining)`}
              </span>
            </button>
          </div>
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
