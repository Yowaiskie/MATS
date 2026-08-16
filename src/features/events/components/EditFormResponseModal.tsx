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
    <div className="fixed inset-0 z-70 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white max-w-2xl w-full rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Admin Action</span>
            <h3 className="text-base font-black text-slate-900">Edit Form Response ({response.trackingNumber || 'Submission'})</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 font-bold px-2 py-1 rounded-md cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-xl font-bold border border-red-200">
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
                          {opt}
                        </option>
                      ))}
                    </select>
                  )}

                  {/* Multiple Choice (Checkboxes) */}
                  {(q.type === 'multiple_choice' || q.type === 'checkbox') && (
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
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-xs disabled:opacity-50"
            >
              {saving ? 'Saving Changes...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
