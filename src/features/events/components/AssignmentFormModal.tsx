import React, { useState, useEffect } from 'react'
import { eventAssignmentService } from '@/services/eventAssignmentService'
import { memberService } from '@/services/memberService'
import { useAuth } from '@/features/authentication/AuthContext'
import type { Member } from '@/types/member'
import { ORDER_GROUPS, getMemberOrders } from '@/types/member'
import type { EventRole, EventAssignment } from '@/types/event'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
  eventId: string
  editItem?: EventAssignment
}

export const AssignmentFormModal: React.FC<Props> = ({ isOpen, onClose, onSaved, eventId, editItem }) => {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(false)
  const [members, setMembers] = useState<Member[]>([])
  const [roles, setRoles] = useState<EventRole[]>([])
  const [existingAssignments, setExistingAssignments] = useState<EventAssignment[]>([])
  const [error, setError] = useState('')

  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([])
  const [memberSearchTerm, setMemberSearchTerm] = useState('')
  const [roleInput, setRoleInput] = useState('')
  const [committeeInput, setCommitteeInput] = useState('')
  const [isOverallHead, setIsOverallHead] = useState(false)
  const [isSubLeader, setIsSubLeader] = useState(false)

  useEffect(() => {
    if (isOpen) {
      loadData()
      if (editItem) {
        setSelectedMemberIds([editItem.memberUid])
        setRoleInput(editItem.eventRoleName)
        setCommitteeInput(editItem.committeeName || '')
        setIsOverallHead(!!editItem.isOverallHead || (editItem.isHead && editItem.eventRoleName.toLowerCase() === 'head'))
        setIsSubLeader(!!editItem.isSubLeader || (editItem.isHead && editItem.eventRoleName.toLowerCase() !== 'head'))
      } else {
        setSelectedMemberIds([])
        setMemberSearchTerm('')
        setRoleInput('')
        setCommitteeInput('')
        setIsOverallHead(false)
        setIsSubLeader(false)
      }
      setError('')
    }
  }, [isOpen, editItem])

  const loadData = async () => {
    try {
      const [membersData, rolesData, assignmentsData] = await Promise.all([
        memberService.getMembers(), // only active members
        eventAssignmentService.getRoles(eventId),
        eventAssignmentService.getAssignmentsByEventId(eventId)
      ])
      setMembers(membersData)
      setRoles(rolesData)
      setExistingAssignments(assignmentsData)
    } catch (err) {
      console.error('Failed to load members or roles:', err)
      setError('Failed to load necessary data.')
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedMemberIds.length === 0 || !roleInput.trim()) {
      setError('Please select at least one member and specify a role.')
      return
    }

    setLoading(true)
    setError('')

    try {
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

      if (isOverallHead) {
        const existingHead = existingAssignments.find(a => a.isOverallHead && (!editItem || a.id !== editItem.id))
        if (existingHead && selectedMemberIds.length > 0) {
          setError(`There is already an Overall Event Head: ${existingHead.memberName}. Only one overall head is allowed.`)
          setLoading(false)
          return
        }
      }

      if (editItem) {
        await eventAssignmentService.updateAssignment(
          editItem.id,
          {
            eventRoleId: roleId,
            eventRoleName: roleName,
            committeeName: committeeInput.trim(),
            isHead: isOverallHead || isSubLeader,
            isOverallHead,
            isSubLeader
          },
          profile?.displayName || 'System'
        )
      } else {
        await Promise.all(selectedMemberIds.map(async (memberId) => {
          const member = members.find(m => m.id === memberId)
          if (!member) return

          await eventAssignmentService.createAssignment({
            eventId,
            memberUid: member.id,
            memberName: `${member.firstName} ${member.lastName}`,
            eventRoleId: roleId,
            eventRoleName: roleName,
            committeeName: committeeInput.trim(),
            isHead: isOverallHead || isSubLeader,
            isOverallHead,
            isSubLeader,
            assignedByUid: profile?.uid || 'system',
            assignedByName: profile?.displayName || 'System'
          }, profile?.displayName || 'System')
        }))
      }

      onSaved()
    } catch (err: any) {
      console.error('Failed to assign members:', err)
      setError(err.message || 'An error occurred while saving the assignments.')
    } finally {
      setLoading(false)
    }
  }

  const handleBulkSelect = (groupName: string) => {
    // Find members belonging to this order/group or rank
    const membersToSelect = members.filter(m => getMemberOrders(m.order).includes(groupName) || m.rank === groupName)
    
    if (membersToSelect.length === 0) {
      setError(`No active members found for category: ${groupName}`)
      return
    }

    // Filter out those already assigned
    const unassignedIds = membersToSelect
      .filter(m => !existingAssignments.some(a => a.memberUid === m.id))
      .map(m => m.id)
    
    if (unassignedIds.length === 0) {
      setError(`All members in ${groupName} are already assigned to this event.`)
      return
    }

    setSelectedMemberIds(prev => Array.from(new Set([...prev, ...unassignedIds])))
    setError('')
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={loading ? undefined : onClose} />
      
      <div className="relative w-full max-w-sm max-h-[85vh] rounded-2xl border border-gray-200 bg-white shadow-xl z-10 flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">{editItem ? 'Edit Assignment' : 'Assign Team Member'}</h3>
          <button onClick={onClose} disabled={loading} className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100 disabled:opacity-50 cursor-pointer">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm mb-4">
              {error}
            </div>
          )}

          <form id="assignmentForm" onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex justify-between">
                <span>Select Members ({selectedMemberIds.length} selected)</span>
                {!editItem && selectedMemberIds.length > 0 && (
                  <button type="button" onClick={() => setSelectedMemberIds([])} className="text-xs text-blue-600 hover:underline">Clear</button>
                )}
              </label>

              {/* Quick Search Input */}
              <div className="mb-2">
                <input
                  type="text"
                  placeholder="Search member name or order..."
                  value={memberSearchTerm}
                  onChange={e => setMemberSearchTerm(e.target.value)}
                  className="w-full p-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden bg-white"
                />
              </div>

              <div className="border border-gray-300 rounded-md h-40 overflow-y-auto p-2 bg-gray-50 space-y-1">
                {(() => {
                  const filteredMembers = members.filter(m => {
                    if (!memberSearchTerm.trim()) return true
                    const query = memberSearchTerm.toLowerCase().trim()
                    const fullName = `${m.lastName}, ${m.firstName}`.toLowerCase()
                    const orderName = (m.order || '').toLowerCase()
                    const rankName = (m.rank || '').toLowerCase()
                    return fullName.includes(query) || orderName.includes(query) || rankName.includes(query)
                  })

                  if (filteredMembers.length === 0) {
                    return (
                      <div className="text-xs text-gray-500 text-center py-4">
                        {memberSearchTerm.trim() ? 'No members matching search.' : 'No active members found.'}
                      </div>
                    )
                  }

                  return filteredMembers.map(m => {
                    const isAssigned = existingAssignments.some(a => a.memberUid === m.id && (!editItem || a.id !== editItem.id))
                    return (
                      <label key={m.id} className={`flex items-center space-x-2 p-1.5 rounded cursor-pointer transition-colors ${isAssigned ? 'opacity-50 grayscale' : 'hover:bg-gray-100'}`}>
                        <input 
                          type="checkbox"
                          disabled={isAssigned || !!editItem}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50 cursor-pointer"
                          checked={selectedMemberIds.includes(m.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedMemberIds(prev => [...prev, m.id])
                            } else {
                              setSelectedMemberIds(prev => prev.filter(id => id !== m.id))
                            }
                          }}
                        />
                        <span className="text-sm font-bold text-gray-700">{m.lastName}, {m.firstName}</span>
                        {m.order && <span className="text-[10px] text-gray-400 font-medium">({m.order})</span>}
                        {isAssigned && <span className="text-[10px] text-red-500 italic ml-auto">Already assigned</span>}
                      </label>
                    )
                  })
                })()}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Committee / Team (Optional)</label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 mb-4"
                value={committeeInput}
                onChange={(e) => setCommitteeInput(e.target.value)}
                placeholder="e.g. Logistics, Liturgy, Secretariat"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role in Committee</label>
              <input
                type="text"
                required
                list="roles-list"
                className="w-full border border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2"
                value={roleInput}
                onChange={(e) => setRoleInput(e.target.value)}
                placeholder="e.g. Lead, Member, Usher"
              />
              <datalist id="roles-list">
                {roles.map(r => (
                  <option key={r.id} value={r.name} />
                ))}
              </datalist>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isOverallHead"
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  checked={isOverallHead}
                  onChange={(e) => {
                    setIsOverallHead(e.target.checked)
                    if (e.target.checked) setIsSubLeader(false)
                  }}
                />
                <label htmlFor="isOverallHead" className="ml-2 block text-sm text-gray-900 font-medium cursor-pointer">
                  Is Overall Event Head
                </label>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isSubLeader"
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  checked={isSubLeader}
                  onChange={(e) => {
                    setIsSubLeader(e.target.checked)
                    if (e.target.checked) setIsOverallHead(false)
                  }}
                />
                <label htmlFor="isSubLeader" className="ml-2 block text-sm text-gray-900 font-medium cursor-pointer">
                  Is Sub-Team Leader (e.g., Head of Logistics)
                </label>
              </div>
            </div>
          </form>

          {!editItem && (
            <div className="mt-6 pt-4 border-t border-gray-100">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Quick Bulk Assign</h4>
              <p className="text-[11px] text-gray-400 mb-2">Click a category to instantly check all its members.</p>
              <div className="flex flex-wrap gap-2">
                {ORDER_GROUPS.map(group => (
                  <button
                    key={group}
                    type="button"
                    disabled={loading}
                    onClick={() => handleBulkSelect(group)}
                    className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-bold rounded-full transition-colors border border-indigo-200 disabled:opacity-50 cursor-pointer shadow-xs active:scale-95"
                  >
                    + Select All {group}
                  </button>
                ))}
              </div>
            </div>
          )}
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
            {loading ? 'Saving...' : (editItem ? 'Save Changes' : `Assign ${selectedMemberIds.length > 0 ? selectedMemberIds.length : ''} Members`)}
          </button>
        </div>
      </div>
    </div>
  )
}
