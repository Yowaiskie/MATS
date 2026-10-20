import React, { useState, useEffect } from 'react'
import { Modal } from '@/components/Modal'
import { Button } from '@/components/Button'
import type { MemberRank } from '@/types/member'
import { MEMBER_RANKS } from '@/types/member'
import { getFullName } from '@/utils/member'
import type { RenewalMembershipWithMember, RenewalMembershipStatus } from '@/types/renewal'
import { RENEWAL_STATUS_OPTIONS, normalizeCycleRank } from '@/types/renewal'
import { renewalService } from '@/services/renewalService'

interface EditCycleMembershipModalProps {
  isOpen: boolean
  onClose: () => void
  membership: RenewalMembershipWithMember | null
  cycleName: string
  onSaveSuccess: () => Promise<void>
  actor: string
}

export const EditCycleMembershipModal: React.FC<EditCycleMembershipModalProps> = ({
  isOpen,
  onClose,
  membership,
  cycleName,
  onSaveSuccess,
  actor
}) => {
  const [cycleRank, setCycleRank] = useState<MemberRank>('Paladins')
  const [membershipStatus, setMembershipStatus] = useState<RenewalMembershipStatus>('active')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (membership) {
      setCycleRank(normalizeCycleRank(membership.cycleRank))
      setMembershipStatus(membership.membershipStatus)
      setNotes(membership.notes || '')
      setError(null)
    }
  }, [membership])

  if (!isOpen || !membership) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      await renewalService.updateMembership(
        membership.cycleId,
        membership.memberId,
        {
          cycleRank,
          membershipStatus,
          notes: notes.trim() || undefined
        },
        actor
      )
      await onSaveSuccess()
      onClose()
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Failed to update cycle membership.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Cycle Classification & Status"
      subtitle={`Manage ${getFullName(membership.member)}'s enrollment details in ${cycleName}.`}
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
            <svg className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="font-medium">{error}</span>
          </div>
        )}

        {/* Member identity banner */}
        <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between text-xs">
          <div>
            <div className="font-bold text-slate-900 text-sm">{getFullName(membership.member)}</div>
            <div className="text-slate-500 mt-0.5">
              Permanent Rank: <strong className="text-slate-700">{membership.member.rank}</strong>
            </div>
          </div>
          <div className="text-right">
            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
              Enrolled: {membership.renewalDate || 'Active'}
            </span>
          </div>
        </div>

        {/* Cycle Rank */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Cycle Classification (Rank)
          </label>
          <select
            value={cycleRank}
            onChange={e => setCycleRank(e.target.value as MemberRank)}
            className="w-full text-xs font-medium rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-800 focus:outline-none focus:border-blue-500"
          >
            {MEMBER_RANKS.map(rank => (
              <option key={rank} value={rank}>
                {rank}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-slate-500">
            Designate member as Chevalier, Paladin, or Squire specifically for this renewal cycle.
          </p>
        </div>

        {/* Cycle Status */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Cycle Membership Status
          </label>
          <select
            value={membershipStatus}
            onChange={e => setMembershipStatus(e.target.value as RenewalMembershipStatus)}
            className="w-full text-xs font-medium rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-800 focus:outline-none focus:border-blue-500"
          >
            {RENEWAL_STATUS_OPTIONS.map(s => (
              <option key={s.value} value={s.value}>
                {s.label} — {s.description}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-slate-500">
            Cycle status governs participation in this cycle without overwriting permanent profile status.
          </p>
        </div>

        {/* Cycle Notes */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Renewal Notes (Optional)
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="e.g. Granted honorary status for 2026 cycle; reclassified as Chevalier."
            className="w-full text-xs font-medium rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-800 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Data Integrity Notice */}
        <div className="p-2.5 bg-blue-50/70 border border-blue-200/80 rounded-xl text-[11px] text-blue-900 flex items-start gap-2">
          <svg className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>
            Changes here are isolated to <strong>{cycleName}</strong>. Historical cycles and the permanent member identity remain completely protected.
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Save Cycle Changes'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
