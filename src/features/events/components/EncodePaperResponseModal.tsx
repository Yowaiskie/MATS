import React, { useState, useEffect, useMemo } from 'react'
import type {
  AppointmentSlotAnswer,
  EventForm,
  EventFormQuestion,
  SlotCounterType
} from '@/types/eventForm'
import {
  eventFormResponseService,
  type SlotCountDetail
} from '@/services/eventFormResponseService'
import { useAuth } from '@/features/authentication/AuthContext'
import { Modal, Button, useToast } from '@/components'
import {
  formatContactNumber,
  isValidContactNumber,
  getRawContactDigits
} from '@/utils/contactNumberHelper'

export interface PaperEncodeTarget {
  questionId: string
  slotType: SlotCounterType
  slotKey: string
  maxCapacity: number
  label: string
  pendingCount: number
  lockedAnswer: AppointmentSlotAnswer | string
}

interface EncodePaperResponseModalProps {
  isOpen: boolean
  onClose: () => void
  form: EventForm
  questions: EventFormQuestion[]
  target: PaperEncodeTarget
  onEncoded: (updatedSlot: SlotCountDetail) => void
}

export const EncodePaperResponseModal: React.FC<EncodePaperResponseModalProps> = ({
  isOpen,
  onClose,
  form,
  questions,
  target,
  onEncoded
}) => {
  const { user, profile } = useAuth()
  const { toast } = useToast()

  const [answers, setAnswers] = useState<Record<string, any>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [remainingHolds, setRemainingHolds] = useState(target.pendingCount)
  const [encodedSessionCount, setEncodedSessionCount] = useState(0)

  const sortedQuestions = useMemo(
    () => [...questions].sort((a, b) => a.order - b.order),
    [questions]
  )

  useEffect(() => {
    if (!isOpen) return
    setAnswers({ [target.questionId]: target.lockedAnswer })
    setErrors({})
    setRemainingHolds(target.pendingCount)
    setEncodedSessionCount(0)
  }, [isOpen, target.questionId, target.lockedAnswer, target.pendingCount])

  const handleFieldChange = (qId: string, val: any) => {
    setAnswers(prev => ({ ...prev, [qId]: val }))
    if (errors[qId]) {
      setErrors(prev => {
        const next = { ...prev }
        delete next[qId]
        return next
      })
    }
  }

  const handleCheckboxToggle = (qId: string, opt: string, checked: boolean) => {
    const current: string[] = Array.isArray(answers[qId]) ? answers[qId] : []
    const next = checked ? [...current, opt] : current.filter(v => v !== opt)
    handleFieldChange(qId, next)
  }

  const validate = (): boolean => {
    const nextErrors: Record<string, string> = {}
    for (const q of sortedQuestions) {
      if (q.type === 'section_header' || q.id === target.questionId) continue
      const val = answers[q.id]
      if (q.required) {
        if (
          val === undefined ||
          val === null ||
          val === '' ||
          (Array.isArray(val) && val.length === 0)
        ) {
          nextErrors[q.id] = 'This field is required.'
          continue
        }
      }
      if (q.type === 'contact_number' && val) {
        if (!isValidContactNumber(String(val), q.required)) {
          const raw = getRawContactDigits(String(val))
          nextErrors[q.id] =
            raw.startsWith('09') && raw.length !== 11
              ? 'Enter a complete 11-digit mobile number (e.g. 0917-123-4567).'
              : 'Enter a valid contact number (7-11 digits).'
        }
      }
    }
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSave = async (encodeNext: boolean) => {
    if (saving) return
    if (!validate()) return

    setSaving(true)
    try {
      const payloadAnswers = {
        ...answers,
        [target.questionId]: target.lockedAnswer
      }

      const { trackingNumber, updatedSlot } = await eventFormResponseService.encodePaperResponse(
        form,
        payloadAnswers,
        {
          questionId: target.questionId,
          slotType: target.slotType,
          slotKey: target.slotKey,
          maxCapacity: target.maxCapacity,
          label: target.label
        },
        {
          uid: user?.uid || profile?.uid || '',
          name: profile?.displayName || profile?.memberName || profile?.email || 'Officer',
          email: profile?.email || user?.email || ''
        },
        sortedQuestions
      )

      onEncoded(updatedSlot)
      setRemainingHolds(updatedSlot.paperReservedCount)
      setEncodedSessionCount(prev => prev + 1)

      toast.success(
        'Paper Form Encoded',
        `Saved ${trackingNumber} and converted 1 paper hold (zero double-count).`
      )

      if (encodeNext && updatedSlot.paperReservedCount > 0) {
        setAnswers({ [target.questionId]: target.lockedAnswer })
        setErrors({})
      } else {
        onClose()
      }
    } catch (err) {
      console.error('Failed to encode paper response:', err)
      toast.error(
        'Encoding Failed',
        err instanceof Error ? err.message : 'Could not save paper registration.'
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Encode Paper Registration"
      subtitle={form.title}
      badge={`${remainingHolds} paper hold${remainingHolds === 1 ? '' : 's'} pending`}
      maxWidth="2xl"
      icon={
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
        </svg>
      }
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2 w-full">
          <div className="text-[11px] font-semibold text-slate-500">
            {encodedSessionCount > 0
              ? `Encoded ${encodedSessionCount} in this session`
              : 'Converts 1 paper hold to a full record'}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="dense"
              className="min-h-11"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </Button>
            {remainingHolds > 1 && (
              <Button
                type="button"
                variant="secondary"
                size="dense"
                className="min-h-11"
                onClick={() => handleSave(true)}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save & Encode Next'}
              </Button>
            )}
            <Button
              type="button"
              variant="primary"
              size="dense"
              className="min-h-11"
              onClick={() => handleSave(false)}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save & Close'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Locked Target Slot Banner */}
        <div className="p-3.5 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-black uppercase tracking-wider text-indigo-700">
              Locked Schedule / Slot
            </div>
            <div className="text-sm font-black text-indigo-950 mt-0.5">{target.label}</div>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-white border border-indigo-200 text-[11px] font-bold text-indigo-700 shrink-0">
            Paper Hold
          </span>
        </div>

        {/* Dynamic Questions */}
        <div className="space-y-4">
          {sortedQuestions.map(q => {
            if (q.id === target.questionId) return null

            if (q.type === 'section_header') {
              return (
                <div key={q.id} className="pt-2 border-t border-slate-100">
                  <h4 className="text-sm font-black text-slate-900">{q.question}</h4>
                  {q.description && <p className="text-xs text-slate-500 mt-0.5">{q.description}</p>}
                </div>
              )
            }

            const val = answers[q.id] ?? ''
            const err = errors[q.id]

            return (
              <div key={q.id} className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800">
                  {q.question}
                  {q.required && <span className="text-rose-600 ml-1">*</span>}
                </label>

                {q.type === 'long_text' ? (
                  <textarea
                    rows={3}
                    value={String(val)}
                    onChange={e => handleFieldChange(q.id, e.target.value)}
                    placeholder={q.placeholder || 'Enter answer...'}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500 focus:outline-hidden"
                  />
                ) : q.type === 'contact_number' ? (
                  <input
                    type="tel"
                    value={String(val)}
                    onChange={e => handleFieldChange(q.id, formatContactNumber(e.target.value))}
                    placeholder={q.placeholder || '0917-123-4567'}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500 focus:outline-hidden"
                  />
                ) : q.type === 'dropdown' ? (
                  <select
                    value={String(val)}
                    onChange={e => handleFieldChange(q.id, e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500 focus:outline-hidden"
                  >
                    <option value="">Select an option...</option>
                    {(q.options || []).map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : q.type === 'multiple_choice' || q.type === 'yes_no' ? (
                  <div className="flex flex-wrap gap-2">
                    {(q.type === 'yes_no' ? ['Yes', 'No'] : q.options || []).map(opt => {
                      const active = val === opt
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => handleFieldChange(q.id, opt)}
                          className={`min-h-10 px-3.5 py-2 rounded-xl border text-xs font-bold transition cursor-pointer ${
                            active
                              ? 'bg-indigo-600 border-indigo-600 text-white'
                              : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-white'
                          }`}
                        >
                          {opt}
                        </button>
                      )
                    })}
                  </div>
                ) : q.type === 'checkbox' ? (
                  <div className="flex flex-wrap gap-2">
                    {(q.options || []).map(opt => {
                      const checked = Array.isArray(val) && val.includes(opt)
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => handleCheckboxToggle(q.id, opt, !checked)}
                          className={`min-h-10 px-3.5 py-2 rounded-xl border text-xs font-bold transition cursor-pointer ${
                            checked
                              ? 'bg-indigo-600 border-indigo-600 text-white'
                              : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-white'
                          }`}
                        >
                          {opt}
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <input
                    type={q.type === 'number' ? 'number' : q.type === 'date' ? 'date' : q.type === 'time' ? 'time' : 'text'}
                    value={String(val)}
                    onChange={e => handleFieldChange(q.id, e.target.value)}
                    placeholder={q.placeholder || 'Enter answer...'}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500 focus:outline-hidden"
                  />
                )}

                {err && <p className="text-xs font-semibold text-rose-600">{err}</p>}
              </div>
            )
          })}
        </div>
      </div>
    </Modal>
  )
}
