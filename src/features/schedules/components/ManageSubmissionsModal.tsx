import React, { useState, useEffect } from 'react'
import type { SchedulePublication } from '@/types/publication'
import type { Member } from '@/types/member'
import { publicationService } from '@/services/publicationService'
import { scheduleService } from '@/services/scheduleService'

import { memberService } from '@/services/memberService'

interface ManageSubmissionsModalProps {
  isOpen: boolean
  onClose: () => void
  publication: SchedulePublication | null
  onSuccess: () => void
}

export const ManageSubmissionsModal: React.FC<ManageSubmissionsModalProps> = ({
  isOpen,
  onClose,
  publication,
  onSuccess
}) => {
  const [members, setMembers] = useState<Member[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  useEffect(() => {
    if (isOpen) {
      setSelectedIds(new Set())
      setMessage(null)
      loadMembers()
    }
  }, [isOpen])

  const loadMembers = async () => {
    setIsLoading(true)
    try {
      const allMembers = await memberService.getMembers()
      setMembers(allMembers)
    } catch (err) {
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen || !publication) return null

  // Get only members who have submitted
  const submittedMembers = members.filter(m => publication.submittedMembers?.includes(m.id))

  const handleToggle = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleToggleAll = () => {
    if (selectedIds.size === submittedMembers.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(submittedMembers.map(m => m.id)))
    }
  }

  const handleReset = async () => {
    if (selectedIds.size === 0) return
    setIsSubmitting(true)
    setMessage(null)

    try {
      const ids = Array.from(selectedIds)
      
      // 1. Remove from schedules
      await scheduleService.removeMembersFromSchedules(publication.startDate, publication.endDate, ids)
      
      // 2. Remove from publication submissions
      await publicationService.resetMembersSubmission(publication.id, ids)

      setMessage({ type: 'success', text: `Successfully reset submissions for ${ids.length} member(s).` })
      setTimeout(() => {
        onSuccess()
      }, 1500)
    } catch (err: any) {
      console.error(err)
      setMessage({ type: 'error', text: err.message || 'Failed to reset submissions.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Manage Submissions</h2>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mt-0.5">{publication.name}</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          <p className="text-sm text-slate-600 mb-4">
            Select members to <strong>RESET</strong> their submissions. This will erase their schedules for this publication period and allow them to pick again in the public link.
          </p>

          {message && (
            <div className={`p-3 rounded-lg text-xs font-bold mb-4 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
              {message.text}
            </div>
          )}

          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <label className="flex items-center gap-3 cursor-pointer text-xs font-bold text-slate-700">
                <input
                  type="checkbox"
                  checked={submittedMembers.length > 0 && selectedIds.size === submittedMembers.length}
                  onChange={handleToggleAll}
                  className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
                />
                SELECT ALL
              </label>
              <span className="text-xs font-bold text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">
                {submittedMembers.length} Submitted
              </span>
            </div>
            
            <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
              {isLoading ? (
                <div className="p-6 text-center text-sm text-slate-500">Loading...</div>
              ) : submittedMembers.length === 0 ? (
                <div className="p-6 text-center text-sm text-slate-500">
                  No members have submitted their schedules yet.
                </div>
              ) : (
                submittedMembers.map(member => (
                  <label key={member.id} className="flex items-center gap-3 p-4 hover:bg-slate-50 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(member.id)}
                      onChange={() => handleToggle(member.id)}
                      className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
                    />
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-slate-800">{member.lastName}, {member.firstName}</span>
                      {member.rank && <span className="text-[10px] font-bold text-slate-400">{member.rank}</span>}
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2 text-sm font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleReset}
            disabled={isSubmitting || selectedIds.size === 0}
            className="px-5 py-2 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors flex items-center gap-2 shadow-xs"
          >
            {isSubmitting ? 'Resetting...' : `Reset Selected (${selectedIds.size})`}
          </button>
        </div>
      </div>
    </div>
  )
}
