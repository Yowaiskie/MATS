import React, { useState, useEffect } from 'react'
import { eventAssignmentService } from '@/services/eventAssignmentService'
import { memberService } from '@/services/memberService'
import { useAuth } from '@/features/authentication/AuthContext'
import type { Member } from '@/types/member'
import type { EventRole } from '@/types/event'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
  eventId: string
}

export const AssignmentFormModal: React.FC<Props> = ({ isOpen, onClose, onSaved, eventId }) => {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(false)
  const [members, setMembers] = useState<Member[]>([])
  const [roles, setRoles] = useState<EventRole[]>([])
  const [error, setError] = useState('')

  const [selectedMemberId, setSelectedMemberId] = useState('')
  const [roleInput, setRoleInput] = useState('')
  const [isHead, setIsHead] = useState(false)

  useEffect(() => {
    if (isOpen) {
      loadData()
      setSelectedMemberId('')
      setRoleInput('')
      setIsHead(false)
      setError('')
    }
  }, [isOpen])

  const loadData = async () => {
    try {
      const [membersData, rolesData] = await Promise.all([
        memberService.getMembers(), // only active members
        eventAssignmentService.getRoles(eventId)
      ])
      setMembers(membersData)
      setRoles(rolesData)
    } catch (err) {
      console.error('Failed to load members or roles:', err)
      setError('Failed to load necessary data.')
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedMemberId || !roleInput.trim()) {
      setError('Please select a member and specify a role.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const member = members.find(m => m.id === selectedMemberId)
      if (!member) throw new Error('Member not found')

      let roleId = ''
      let roleName = roleInput.trim()

      const existingRole = roles.find(r => r.name.toLowerCase() === roleName.toLowerCase())
      if (existingRole) {
        roleId = existingRole.id
        roleName = existingRole.name
      } else {
        // Create new event-specific role
        roleId = await eventAssignmentService.createRole({
          eventId,
          name: roleName,
          description: `Custom role created during assignment for ${roleName}`
        }, profile?.displayName || 'System')
      }

      await eventAssignmentService.createAssignment({
        eventId,
        memberUid: member.id,
        memberName: `${member.firstName} ${member.lastName}`,
        eventRoleId: roleId,
        eventRoleName: roleName,
        isHead,
        assignedByUid: profile?.uid || 'system',
        assignedByName: profile?.displayName || 'System'
      }, profile?.displayName || 'System')

      onSaved()
    } catch (err: any) {
      console.error('Failed to assign member:', err)
      setError(err.message || 'An error occurred while saving the assignment.')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={loading ? undefined : onClose} />
      
      <div className="relative w-full max-w-md rounded-2xl border border-gray-200 bg-white shadow-xl z-10 flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">Assign Team Member</h3>
          <button onClick={onClose} disabled={loading} className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100 disabled:opacity-50 cursor-pointer">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm mb-4">
              {error}
            </div>
          )}

          <form id="assignmentForm" onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Member</label>
              <select
                required
                className="w-full border border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2"
                value={selectedMemberId}
                onChange={(e) => setSelectedMemberId(e.target.value)}
              >
                <option value="">-- Choose a Member --</option>
                {members.map(m => (
                  <option key={m.id} value={m.id}>{m.lastName}, {m.firstName}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <input
                type="text"
                required
                list="roles-list"
                className="w-full border border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2"
                value={roleInput}
                onChange={(e) => setRoleInput(e.target.value)}
                placeholder="e.g. Coordinator, Logistics, Registration"
              />
              <datalist id="roles-list">
                {roles.map(r => (
                  <option key={r.id} value={r.name} />
                ))}
              </datalist>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="isHead"
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                checked={isHead}
                onChange={(e) => setIsHead(e.target.checked)}
              />
              <label htmlFor="isHead" className="ml-2 block text-sm text-gray-900 font-medium cursor-pointer">
                Is Head / Leader for this Role
              </label>
            </div>
          </form>
        </div>

        <div className="p-4 border-t border-gray-100 flex justify-end gap-2 bg-gray-50 rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 focus:outline-none disabled:opacity-50 shadow-sm transition-colors cursor-pointer"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="assignmentForm"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 focus:outline-none disabled:opacity-50 flex items-center shadow-sm transition-colors cursor-pointer"
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Assign Member'}
          </button>
        </div>
      </div>
    </div>
  )
}
