import React, { useState, useEffect } from 'react'
import { Modal } from '@/components/Modal'
import { useAuth } from '@/features/authentication/AuthContext'
import { eventContributionService } from '@/services/eventContributionService'
import { memberService } from '@/services/memberService'
import type { EventContributionPurpose, ContributionPaymentMethod } from '@/types/eventContribution'
import type { Member } from '@/types/member'
import { getFullName } from '@/utils/member'
import { Timestamp } from 'firebase/firestore'

interface Props {
  isOpen: boolean
  onClose: () => void
  eventId: string
  onSuccess: () => void
}

export const EventContributionModal: React.FC<Props> = ({ isOpen, onClose, eventId, onSuccess }) => {
  const { profile } = useAuth()
  const [purposes, setPurposes] = useState<EventContributionPurpose[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form State
  const [contributorUid, setContributorUid] = useState('')
  const [contributorName, setContributorName] = useState('')
  const [purposeId, setPurposeId] = useState('')
  const [amount, setAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<ContributionPaymentMethod>('cash')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [contributedDate, setContributedDate] = useState(new Date().toISOString().split('T')[0])
  const [collectedByName, setCollectedByName] = useState('')
  const [notes, setNotes] = useState('')

  // Member Search State
  const [searchQuery, setSearchQuery] = useState('')
  const [showMemberDropdown, setShowMemberDropdown] = useState(false)

  useEffect(() => {
    if (isOpen) {
      fetchInitialData()
      resetForm()
    }
  }, [isOpen])

  const fetchInitialData = async () => {
    try {
      setLoading(true)
      const [purposesData, membersData] = await Promise.all([
        eventContributionService.getPurposesByEventId(eventId),
        memberService.getMembers(false) // active members only
      ])
      setPurposes(purposesData.filter(p => !p.isArchived))
      setMembers(membersData)
    } catch (err) {
      console.error('Failed to load modal data:', err)
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setContributorUid('')
    setContributorName('')
    setPurposeId('')
    setAmount('')
    setPaymentMethod('cash')
    setReferenceNumber('')
    setContributedDate(new Date().toISOString().split('T')[0])
    setCollectedByName(profile?.displayName || profile?.email || '')
    setNotes('')
    setSearchQuery('')
    setShowMemberDropdown(false)
    setError(null)
  }

  const filteredMembers = searchQuery.trim() === ''
    ? []
    : members.filter(m => {
        const fullName = getFullName(m, true).toLowerCase()
        return fullName.includes(searchQuery.toLowerCase())
      }).slice(0, 5)

  const handleSelectMember = (m: Member) => {
    const fullName = getFullName(m, false)
    setContributorUid(m.id)
    setContributorName(fullName)
    setSearchQuery(fullName)
    setShowMemberDropdown(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return

    const numAmount = Number(amount.replace(/,/g, ''))
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Amount must be a positive number.')
      return
    }

    const finalContributorName = contributorName || searchQuery.trim()
    if (!finalContributorName) {
      setError('Contributor name is required.')
      return
    }

    if (!purposeId) {
      setError('Purpose category is required.')
      return
    }

    const selectedPurpose = purposes.find(p => p.id === purposeId)
    if (!selectedPurpose) {
      setError('Invalid purpose selected.')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const parts = contributedDate.split('-').map(Number)
      const contributedAtDate = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0)
      const contributedAt = Timestamp.fromDate(contributedAtDate)

      await eventContributionService.addContribution(
        {
          eventId,
          contributorUid: contributorUid || undefined,
          contributorName: finalContributorName,
          purposeId,
          purposeName: selectedPurpose.name,
          amount: numAmount,
          paymentMethod,
          referenceNumber: (paymentMethod === 'gcash' || paymentMethod === 'bank_transfer') ? referenceNumber.trim() : '',
          collectedByName: collectedByName.trim() || profile.displayName || profile.email || 'N/A',
          notes: notes.trim(),
          contributedAt
        },
        profile.uid,
        profile.displayName || profile.email
      )
      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to save contribution.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Record Event Contribution" maxWidth="md">
      {loading ? (
        <div className="py-12 text-center text-xs text-slate-500">Loading form parameters...</div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl">
              {error}
            </div>
          )}

          {/* Contributor Search/Input */}
          <div className="relative">
            <label className="block text-[10px] font-extrabold uppercase text-slate-500 mb-1">Contributor Name *</label>
            <input
              type="text"
              required
              placeholder="Search MATS member or enter contributor name..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setShowMemberDropdown(true)
                setContributorUid('')
                setContributorName('')
              }}
              onFocus={() => setShowMemberDropdown(true)}
              className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:border-blue-500"
            />

            {/* Member Dropdown */}
            {showMemberDropdown && filteredMembers.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-40 overflow-y-auto divide-y divide-slate-100">
                {filteredMembers.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleSelectMember(m)}
                    className="w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 cursor-pointer block"
                  >
                    {getFullName(m)} ({m.rank || 'Server'})
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Purpose category selection */}
          <div>
            <label className="block text-[10px] font-extrabold uppercase text-slate-500 mb-1">Contribution Purpose *</label>
            <select
              required
              value={purposeId}
              onChange={(e) => setPurposeId(e.target.value)}
              className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:border-blue-500"
            >
              <option value="">-- Select Purpose category --</option>
              {purposes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Amount */}
            <div>
              <label className="block text-[10px] font-extrabold uppercase text-slate-500 mb-1">Amount (PHP) *</label>
              <input
                type="text"
                required
                placeholder="500.00"
                value={amount}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9.]/g, '')
                  setAmount(val)
                }}
                className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Contributed Date */}
            <div>
              <label className="block text-[10px] font-extrabold uppercase text-slate-500 mb-1">Contribution Date *</label>
              <input
                type="date"
                required
                value={contributedDate}
                onChange={(e) => setContributedDate(e.target.value)}
                className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Payment Method */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-extrabold uppercase text-slate-500 mb-1">Payment Method *</label>
              <select
                required
                value={paymentMethod}
                onChange={(e) => {
                  setPaymentMethod(e.target.value as ContributionPaymentMethod)
                  setReferenceNumber('')
                }}
                className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:border-blue-500"
              >
                <option value="cash">Cash</option>
                <option value="gcash">GCash</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Conditional Reference Number */}
            {(paymentMethod === 'gcash' || paymentMethod === 'bank_transfer') && (
              <div>
                <label className="block text-[10px] font-extrabold uppercase text-slate-500 mb-1">Reference Number (Numbers Only) *</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="e.g. 100293847561"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value.replace(/[^0-9]/g, ''))}
                  className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
            )}
          </div>

          {/* Held By Field */}
          <div>
            <label className="block text-[10px] font-extrabold uppercase text-slate-500 mb-1">Held By (Hawak ni / Inabot kay)</label>
            <input
              type="text"
              placeholder="e.g. Bro. Matthew Romney / Treasurer"
              value={collectedByName}
              onChange={(e) => setCollectedByName(e.target.value)}
              className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:border-blue-500"
            />
            <p className="text-[10px] text-slate-400 mt-0.5">Defaults to your name. Update if money was handed to or held by another officer.</p>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-[10px] font-extrabold uppercase text-slate-500 mb-1">Notes / Remarks</label>
            <textarea
              placeholder="Add optional notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:border-blue-500 h-16 resize-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-bold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold disabled:opacity-50 cursor-pointer"
            >
              {submitting ? 'Saving...' : 'Save Contribution'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}
