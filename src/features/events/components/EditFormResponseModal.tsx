import React, { useState, useEffect } from 'react'
import type { EventForm, EventFormQuestion, EventFormResponse, CompanionEntry, AppointmentSlotAnswer } from '@/types/eventForm'
import type { Member } from '@/types/member'
import { eventFormResponseService } from '@/services/eventFormResponseService'
import { useAuth } from '@/features/authentication/AuthContext'
import { Button, MemberSearchDropdown, CustomSelect } from '@/components'
import { useToast } from '@/context/ToastContext'
import { formatContactNumber, detectContactType, getRawContactDigits } from '@/utils/contactNumberHelper'

interface EditFormResponseModalProps {
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
  form: EventForm
  questions: EventFormQuestion[]
  response: EventFormResponse
  membersList: Member[]
  membersMap: Record<string, string>
}

export const EditFormResponseModal: React.FC<EditFormResponseModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  questions,
  response,
  membersList,
  membersMap
}) => {
  const { profile } = useAuth()
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Edit fields state
  const [respondentName, setRespondentName] = useState('')
  const [respondentEmail, setRespondentEmail] = useState('')
  const [respondentMemberUid, setRespondentMemberUid] = useState('')
  const [answers, setAnswers] = useState<Record<string, any>>({})

  useEffect(() => {
    if (response) {
      setRespondentName(response.respondentMemberName || '')
      setRespondentEmail(response.respondentEmail || '')
      setRespondentMemberUid(response.respondentMemberUid || '')
      setAnswers(JSON.parse(JSON.stringify(response.answers || {})))
    }
  }, [response])

  if (!isOpen) return null

  const handleAnswerChange = (questionId: string, val: any) => {
    setAnswers(prev => ({ ...prev, [questionId]: val }))
  }

  const handleCheckboxToggle = (questionId: string, option: string, checked: boolean) => {
    const currentList: string[] = Array.isArray(answers[questionId]) ? answers[questionId] : []
    let updated: string[]
    if (checked) {
      updated = [...currentList, option]
    } else {
      updated = currentList.filter(o => o !== option)
    }
    setAnswers(prev => ({ ...prev, [questionId]: updated }))
  }

  const handleCompanionChange = (questionId: string, index: number, field: keyof CompanionEntry, value: string) => {
    const currentCompanions: CompanionEntry[] = Array.isArray(answers[questionId])
      ? [...answers[questionId]]
      : []
    if (currentCompanions[index]) {
      currentCompanions[index] = { ...currentCompanions[index], [field]: value }
      setAnswers(prev => ({ ...prev, [questionId]: currentCompanions }))
    }
  }

  const handleAddCompanion = (questionId: string) => {
    const currentCompanions: CompanionEntry[] = Array.isArray(answers[questionId])
      ? [...answers[questionId]]
      : []
    currentCompanions.push({ id: `comp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`, name: '', relationship: '', notes: '' })
    setAnswers(prev => ({ ...prev, [questionId]: currentCompanions }))
  }

  const handleRemoveCompanion = (questionId: string, index: number) => {
    const currentCompanions: CompanionEntry[] = Array.isArray(answers[questionId])
      ? [...answers[questionId]]
      : []
    currentCompanions.splice(index, 1)
    setAnswers(prev => ({ ...prev, [questionId]: currentCompanions }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!response.id) return
    setSaving(true)
    setError(null)
    try {
      let updatedName = respondentName
      if (respondentMemberUid && membersMap[respondentMemberUid]) {
        updatedName = membersMap[respondentMemberUid]
      }

      await eventFormResponseService.updateResponse(
        response.id,
        answers,
        {
          memberUid: respondentMemberUid,
          memberName: updatedName,
          email: respondentEmail
        },
        profile?.displayName || profile?.email || 'Admin'
      )
      toast.success('Response Updated', 'Form response has been successfully updated.')
      onSaved()
      onClose()
    } catch (err: any) {
      console.error('Failed to update form response:', err)
      const msg = err instanceof Error ? err.message : 'Failed to update response.'
      setError(msg)
      toast.error('Update Failed', msg)
    } finally {
      setSaving(false)
    }
  }

  const sortedQuestions = [...questions].sort((a, b) => a.order - b.order)

  return (
    <div className="fixed inset-0 z-70 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white max-w-2xl w-full rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200/80 h-[92vh] sm:h-[88vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-4 py-3 sm:px-6 sm:py-4 bg-white border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl sm:rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-extrabold text-sm shrink-0">
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100 inline-block mb-0.5">
                Admin Response Editor
              </span>
              <h3 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">Edit Form Response</h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-5 text-xs">
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs font-bold animate-fade-in">
              {error}
            </div>
          )}

          {/* Respondent Metadata */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">Respondent Information</h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Associated Member (Optional)</label>
                <MemberSearchDropdown
                  members={membersList}
                  value={respondentMemberUid}
                  mode="id"
                  title="Associate Altar Server"
                  placeholder="Guest / Non-Member"
                  onChange={(val: string, item?: any) => {
                    setRespondentMemberUid(val)
                    if (val && item?.rawMember) {
                      setRespondentName(`${item.rawMember.firstName} ${item.rawMember.lastName}`.trim())
                    }
                  }}
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Respondent Name</label>
                <input
                  type="text"
                  value={respondentName}
                  onChange={e => setRespondentName(e.target.value)}
                  placeholder="Full Name"
                  className="w-full p-2.5 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Respondent Email</label>
              <input
                type="email"
                value={respondentEmail}
                onChange={e => setRespondentEmail(e.target.value)}
                placeholder="Email Address"
                className="w-full p-2.5 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-medium"
              />
            </div>
          </div>

          {/* Dynamic Questions Answers */}
          <div className="space-y-4">
            <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">Form Answers</h4>

            {sortedQuestions.map((q, idx) => {
              const currentVal = answers[q.id]

              return (
                <div key={q.id} className="p-4 border border-slate-200 rounded-xl bg-white space-y-2">
                  <label className="block font-bold text-slate-900">
                    #{idx + 1}. {q.question} {q.required && <span className="text-red-500">*</span>}
                  </label>

                  {/* Text Inputs */}
                  {(q.type === 'short_text' || q.type === 'number') && (
                    <input
                      type={q.type === 'number' ? 'number' : 'text'}
                      value={currentVal !== undefined && currentVal !== null ? String(currentVal) : ''}
                      onChange={e => handleAnswerChange(q.id, e.target.value)}
                      className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-medium"
                    />
                  )}

                  {/* Contact Number (Mobile / Landline) */}
                  {q.type === 'contact_number' && (() => {
                    const strVal = currentVal !== undefined && currentVal !== null ? String(currentVal) : ''
                    const rawDigits = getRawContactDigits(strVal)
                    const detected = detectContactType(strVal)

                    return (
                      <div className="space-y-1.5">
                        <div className="relative flex items-center">
                          <div className="absolute left-3 text-slate-400 pointer-events-none">
                            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                          </div>
                          <input
                            type="tel"
                            value={strVal}
                            onChange={e => handleAnswerChange(q.id, formatContactNumber(e.target.value))}
                            placeholder="e.g. 0917-123-4567 or (02) 8123-4567"
                            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-mono text-xs font-semibold"
                          />
                        </div>
                        <div className="flex items-center justify-between text-[11px] px-1">
                          <div className="flex items-center gap-1.5">
                            {detected === 'mobile' && (
                              <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                                Mobile Number (11 Digits)
                              </span>
                            )}
                            {detected === 'landline' && (
                              <span className="px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 font-bold border border-sky-200">
                                Landline Number
                              </span>
                            )}
                          </div>
                          <span className={`font-mono font-bold ${rawDigits.length === 11 ? 'text-emerald-600' : 'text-slate-400'}`}>
                            {rawDigits.length} / 11 digits
                          </span>
                        </div>
                      </div>
                    )
                  })()}

                  {q.type === 'long_text' && (
                    <textarea
                      rows={3}
                      value={currentVal !== undefined && currentVal !== null ? String(currentVal) : ''}
                      onChange={e => handleAnswerChange(q.id, e.target.value)}
                      className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-medium"
                    />
                  )}

                  {/* Date Input */}
                  {q.type === 'date' && (
                    <input
                      type="date"
                      value={currentVal !== undefined && currentVal !== null ? String(currentVal) : ''}
                      onChange={e => handleAnswerChange(q.id, e.target.value)}
                      className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-medium"
                    />
                  )}

                  {/* Dropdown */}
                  {q.type === 'dropdown' && (() => {
                    const isKnownOpt = (q.options || []).includes(String(currentVal))
                    const isOther = currentVal !== undefined && currentVal !== null && currentVal !== '' && (!isKnownOpt || String(currentVal).startsWith('Other:'))

                    return (
                      <div className="space-y-2">
                        <CustomSelect
                          value={isOther ? '__other__' : (currentVal !== undefined && currentVal !== null ? String(currentVal) : '')}
                          onChange={e => {
                            if (e.target.value === '__other__') {
                              handleAnswerChange(q.id, 'Other: ')
                            } else {
                              handleAnswerChange(q.id, e.target.value)
                            }
                          }}
                          options={[
                            { value: '', label: '-- Select option --' },
                            ...(q.options || []).map(opt => ({
                              value: opt,
                              label: `${opt}${q.optionLimits?.[opt] ? ` (Limit: ${q.optionLimits[opt]} slots)` : ''}`
                            })),
                            ...(q.hasOtherOption ? [{ value: '__other__', label: q.otherOptionLabel || 'Other' }] : [])
                          ]}
                        />

                        {isOther && (
                          <input
                            type="text"
                            value={String(currentVal).startsWith('Other: ') ? String(currentVal).replace(/^Other:\s*/, '') : String(currentVal)}
                            onChange={e => handleAnswerChange(q.id, e.target.value ? `Other: ${e.target.value}` : '')}
                            placeholder={q.otherOptionPlaceholder || "Specify other answer..."}
                            className="w-full p-2.5 border border-blue-300 rounded-xl bg-blue-50/30 text-xs font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                          />
                        )}
                      </div>
                    )
                  })()}

                  {/* Multiple Choice (Radio) */}
                  {q.type === 'multiple_choice' && (() => {
                    const isKnownOpt = (q.options || []).includes(String(currentVal))
                    const isOther = currentVal !== undefined && currentVal !== null && currentVal !== '' && (!isKnownOpt || String(currentVal).startsWith('Other:'))

                    return (
                      <div className="space-y-2 pt-1">
                        {(q.options || []).map((opt, oIdx) => {
                          const isChecked = currentVal === opt
                          return (
                            <label key={oIdx} className="flex items-center space-x-2 text-slate-700 cursor-pointer">
                              <input
                                type="radio"
                                name={`mc_${q.id}`}
                                checked={isChecked}
                                onChange={() => handleAnswerChange(q.id, opt)}
                                className="text-blue-600 focus:ring-blue-500 h-4 w-4"
                              />
                              <span className="font-medium">{opt}</span>
                              {q.optionLimits?.[opt] ? (
                                <span className="text-[10px] text-slate-400 font-bold ml-1">
                                  (Limit: {q.optionLimits[opt]} slots)
                                </span>
                              ) : null}
                            </label>
                          )
                        })}

                        {q.hasOtherOption && (
                          <div className="space-y-1.5 pt-1 border-t border-slate-100">
                            <label className="flex items-center space-x-2 text-slate-700 cursor-pointer">
                              <input
                                type="radio"
                                name={`mc_${q.id}`}
                                checked={isOther}
                                onChange={() => handleAnswerChange(q.id, 'Other: ')}
                                className="text-blue-600 focus:ring-blue-500 h-4 w-4"
                              />
                              <span className="font-medium">{q.otherOptionLabel || 'Other'}:</span>
                            </label>
                            {isOther && (
                              <input
                                type="text"
                                value={String(currentVal).startsWith('Other: ') ? String(currentVal).replace(/^Other:\s*/, '') : String(currentVal)}
                                onChange={e => handleAnswerChange(q.id, e.target.value ? `Other: ${e.target.value}` : 'Other: ')}
                                placeholder={q.otherOptionPlaceholder || "Specify other answer..."}
                                className="w-full p-2 border border-blue-300 rounded-xl bg-blue-50/30 text-xs font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-hidden ml-6"
                              />
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })()}

                  {/* Checkbox */}
                  {q.type === 'checkbox' && (() => {
                    const currentArr: string[] = Array.isArray(currentVal) ? currentVal : []
                    const otherItem = currentArr.find(v => typeof v === 'string' && (v.startsWith('Other:') || !(q.options || []).includes(v)))
                    const isOtherChecked = !!otherItem

                    return (
                      <div className="space-y-2 pt-1">
                        {(q.options || []).map((opt, oIdx) => {
                          const isChecked = currentArr.includes(opt)
                          return (
                            <label key={oIdx} className="flex items-center space-x-2 text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={e => handleCheckboxToggle(q.id, opt, e.target.checked)}
                                className="rounded-md text-blue-600 focus:ring-blue-500 h-4 w-4"
                              />
                              <span className="font-medium">{opt}</span>
                              {q.optionLimits?.[opt] ? (
                                <span className="text-[10px] text-slate-400 font-bold ml-1">
                                  (Limit: {q.optionLimits[opt]} slots)
                                </span>
                              ) : null}
                            </label>
                          )
                        })}

                        {q.hasOtherOption && (
                          <div className="space-y-1.5 pt-1 border-t border-slate-100">
                            <label className="flex items-center space-x-2 text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isOtherChecked}
                                onChange={e => {
                                  if (e.target.checked) {
                                    handleAnswerChange(q.id, [...currentArr, 'Other: '])
                                  } else {
                                    handleAnswerChange(q.id, currentArr.filter(v => v !== otherItem))
                                  }
                                }}
                                className="rounded-md text-blue-600 focus:ring-blue-500 h-4 w-4"
                              />
                              <span className="font-medium">{q.otherOptionLabel || 'Other'}:</span>
                            </label>
                            {isOtherChecked && (
                              <input
                                type="text"
                                value={otherItem.startsWith('Other: ') ? otherItem.replace(/^Other:\s*/, '') : otherItem}
                                onChange={e => {
                                  const text = e.target.value
                                  const filtered = currentArr.filter(v => v !== otherItem)
                                  const updated = text ? [...filtered, `Other: ${text}`] : [...filtered, 'Other: ']
                                  handleAnswerChange(q.id, updated)
                                }}
                                placeholder={q.otherOptionPlaceholder || "Specify other answer..."}
                                className="w-full p-2 border border-blue-300 rounded-xl bg-blue-50/30 text-xs font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-hidden ml-6"
                              />
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })()}

                  {/* Yes / No */}
                  {q.type === 'yes_no' && (
                    <div className="flex space-x-4 pt-1">
                      <label className="flex items-center space-x-2 cursor-pointer font-medium text-slate-700">
                        <input
                          type="radio"
                          name={`yn_${q.id}`}
                          value="Yes"
                          checked={currentVal === 'Yes'}
                          onChange={() => handleAnswerChange(q.id, 'Yes')}
                          className="text-blue-600 focus:ring-blue-500"
                        />
                        <span>Yes</span>
                      </label>
                      <label className="flex items-center space-x-2 cursor-pointer font-medium text-slate-700">
                        <input
                          type="radio"
                          name={`yn_${q.id}`}
                          value="No"
                          checked={currentVal === 'No'}
                          onChange={() => handleAnswerChange(q.id, 'No')}
                          className="text-blue-600 focus:ring-blue-500"
                        />
                        <span>No</span>
                      </label>
                    </div>
                  )}

                  {/* Member Selector */}
                  {q.type === 'member_selector' && (
                    <CustomSelect
                      value={currentVal !== undefined && currentVal !== null ? String(currentVal) : ''}
                      onChange={e => handleAnswerChange(q.id, e.target.value)}
                      options={[
                        { value: '', label: '-- Select Member --' },
                        ...membersList.map(m => ({
                          value: m.id,
                          label: `${m.lastName}, ${m.firstName}${m.order ? ` (${m.order})` : ''}`
                        }))
                      ]}
                    />
                  )}

                  {/* Appointment & Time Slots */}
                  {q.type === 'appointment_slots' && (
                    <div className="space-y-3 pt-1">
                      {/* Current Selection summary */}
                      {currentVal && typeof currentVal === 'object' && currentVal.slotId ? (
                        <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center justify-between">
                          <div className="text-xs">
                            <span className="font-bold text-indigo-900 flex items-center gap-2 flex-wrap">
                              <span className="inline-flex items-center gap-1">
                                <svg className="w-3.5 h-3.5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <span>{currentVal.dateLabel || currentVal.date}</span>
                              </span>
                              <span>•</span>
                              <span className="inline-flex items-center gap-1">
                                <svg className="w-3.5 h-3.5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span>{currentVal.timeRange}</span>
                              </span>
                            </span>
                            {currentVal.slotLabel && (
                              <span className="text-[11px] text-indigo-700 font-medium">
                                Slot Label: {currentVal.slotLabel}
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleAnswerChange(q.id, null)}
                            className="text-xs font-bold text-rose-600 hover:text-rose-800 underline cursor-pointer"
                          >
                            Clear Slot
                          </button>
                        </div>
                      ) : (
                        <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500 italic">
                          No appointment slot currently booked.
                        </div>
                      )}

                      {/* Configured Slots Selector */}
                      {q.appointmentConfig && q.appointmentConfig.length > 0 && (
                        <div className="space-y-2 pt-1">
                          <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                            Reassign Date & Time Slot:
                          </label>
                          <div className="space-y-3 max-h-56 overflow-y-auto border border-slate-200 rounded-xl p-2.5 bg-slate-50/70">
                            {q.appointmentConfig.map(dateCfg => (
                              <div key={dateCfg.id} className="space-y-1.5 bg-white p-2.5 rounded-lg border border-slate-200">
                                <div className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                                  <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                  <span>{dateCfg.label ? `${dateCfg.label} (${dateCfg.date})` : dateCfg.date}</span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                                  {dateCfg.slots.map(slot => {
                                    const timeRange = `${slot.startTime} - ${slot.endTime}`
                                    const isSelected =
                                      currentVal?.date === dateCfg.date && currentVal?.slotId === slot.id
                                    return (
                                      <button
                                        key={slot.id}
                                        type="button"
                                        onClick={() => {
                                          const slotAns: AppointmentSlotAnswer = {
                                            date: dateCfg.date,
                                            dateLabel: dateCfg.label || undefined,
                                            slotId: slot.id,
                                            timeRange,
                                            slotLabel: slot.label || undefined
                                          }
                                          handleAnswerChange(q.id, slotAns)
                                        }}
                                        className={`p-2 rounded-lg border text-left text-xs transition cursor-pointer flex flex-col justify-between ${
                                          isSelected
                                            ? 'bg-indigo-600 text-white border-indigo-700 font-bold shadow-xs'
                                            : 'bg-slate-50 text-slate-800 border-slate-200 hover:border-indigo-300 hover:bg-white'
                                        }`}
                                      >
                                        <div className="font-semibold">{timeRange}</div>
                                        {slot.label && (
                                          <div className={`text-[10px] truncate mt-0.5 ${isSelected ? 'text-indigo-100' : 'text-slate-500'}`}>
                                            {slot.label}
                                          </div>
                                        )}
                                      </button>
                                    )
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Companion Repeater */}
                  {q.type === 'companion_repeater' && (
                    <div className="space-y-3 pt-1">
                      {Array.isArray(currentVal) && currentVal.map((comp: CompanionEntry, cIdx: number) => (
                        <div key={cIdx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 relative">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-700 text-[11px]">Companion #{cIdx + 1}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveCompanion(q.id, cIdx)}
                              className="text-red-500 hover:text-red-700 text-[11px] font-bold cursor-pointer"
                            >
                              Remove
                            </button>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <input
                              type="text"
                              placeholder="Full Name"
                              value={comp.name || ''}
                              onChange={e => handleCompanionChange(q.id, cIdx, 'name', e.target.value)}
                              className="p-2 border border-slate-300 rounded-lg bg-white font-medium text-xs"
                            />
                            <input
                              type="text"
                              placeholder="Relationship / Category"
                              value={comp.relationship || ''}
                              onChange={e => handleCompanionChange(q.id, cIdx, 'relationship', e.target.value)}
                              className="p-2 border border-slate-300 rounded-lg bg-white font-medium text-xs"
                            />
                          </div>
                          <input
                            type="text"
                            placeholder="Notes / Remarks"
                            value={comp.notes || ''}
                            onChange={e => handleCompanionChange(q.id, cIdx, 'notes', e.target.value)}
                            className="w-full p-2 border border-slate-300 rounded-lg bg-white font-medium text-xs"
                          />
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={() => handleAddCompanion(q.id)}
                        className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold rounded-lg transition-colors cursor-pointer text-xs"
                      >
                        + Add Companion
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Footer buttons inside form for submit */}
          <div className="pt-3 border-t border-slate-100 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sticky bottom-0 bg-white">
            <Button
              variant="secondary"
              size="sm"
              className="w-full sm:w-auto"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              className="w-full sm:w-auto"
              type="submit"
              loading={saving}
              disabled={saving}
            >
              Save Changes
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
