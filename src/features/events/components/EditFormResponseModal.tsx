import React, { useState, useEffect } from 'react'
import type { EventForm, EventFormQuestion, EventFormResponse, CompanionEntry } from '@/types/eventForm'
import type { Member } from '@/types/member'
import { eventFormResponseService } from '@/services/eventFormResponseService'
import { useAuth } from '@/features/authentication/AuthContext'

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
      onSaved()
      onClose()
    } catch (err) {
      console.error('Failed to update form response:', err)
      setError(err instanceof Error ? err.message : 'Failed to update response.')
    } finally {
      setSaving(false)
    }
  }

  const sortedQuestions = [...questions].sort((a, b) => a.order - b.order)

  return (
    <div className="fixed inset-0 z-70 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white max-w-2xl w-full rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200/80 h-[88vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-white border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-extrabold text-sm shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100 inline-block mb-0.5">
                Admin Response Editor
              </span>
              <h3 className="text-base font-black text-slate-900 tracking-tight">Edit Form Response</h3>
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
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
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
                <select
                  value={respondentMemberUid}
                  onChange={e => {
                    setRespondentMemberUid(e.target.value)
                    if (e.target.value && membersMap[e.target.value]) {
                      setRespondentName(membersMap[e.target.value])
                    }
                  }}
                  className="w-full p-2.5 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-medium"
                >
                  <option value="">Guest / Non-Member</option>
                  {membersList.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.lastName}, {m.firstName} {m.order ? `(${m.order})` : ''}
                    </option>
                  ))}
                </select>
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
                  {q.type === 'dropdown' && (
                    <select
                      value={currentVal !== undefined && currentVal !== null ? String(currentVal) : ''}
                      onChange={e => handleAnswerChange(q.id, e.target.value)}
                      className="w-full p-2.5 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-medium"
                    >
                      <option value="">-- Select option --</option>
                      {(q.options || []).map((opt, oIdx) => (
                        <option key={oIdx} value={opt}>
                          {opt} {q.optionLimits?.[opt] ? `(Limit: ${q.optionLimits[opt]} slots)` : ''}
                        </option>
                      ))}
                    </select>
                  )}

                  {/* Multiple Choice (Radio) */}
                  {q.type === 'multiple_choice' && (
                    <div className="space-y-1.5 pt-1">
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
                    </div>
                  )}

                  {/* Checkbox */}
                  {q.type === 'checkbox' && (
                    <div className="space-y-1.5 pt-1">
                      {(q.options || []).map((opt, oIdx) => {
                        const isChecked = Array.isArray(currentVal) && currentVal.includes(opt)
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
                    </div>
                  )}

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
                    <select
                      value={currentVal !== undefined && currentVal !== null ? String(currentVal) : ''}
                      onChange={e => handleAnswerChange(q.id, e.target.value)}
                      className="w-full p-2.5 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-medium"
                    >
                      <option value="">-- Select Member --</option>
                      {membersList.map(m => (
                        <option key={m.id} value={m.id}>
                          {m.lastName}, {m.firstName} {m.order ? `(${m.order})` : ''}
                        </option>
                      ))}
                    </select>
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
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-3 sticky bottom-0 bg-white">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl transition cursor-pointer shadow-md shadow-indigo-500/20 active:scale-95 disabled:opacity-50"
            >
              {saving ? 'Saving Changes...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
