import React, { useState, useEffect } from 'react'
import { eventAssignmentService } from '@/services/eventAssignmentService'
import { memberService } from '@/services/memberService'
import { useAuth } from '@/features/authentication/AuthContext'
import type { Member } from '@/types/member'
import { ORDER_GROUPS, getMemberOrders } from '@/types/member'
import type { EventRole, EventAssignment } from '@/types/event'
import { Button, useToast } from '@/components'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
  eventId: string
  editItem?: EventAssignment
}

export const AssignmentFormModal: React.FC<Props> = ({ isOpen, onClose, onSaved, eventId, editItem }) => {
  const { profile } = useAuth()
  const { toast } = useToast()
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
        memberService.getMembers(),
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
        toast.success('Assignment Updated', 'Event member assignment updated successfully.')
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
        toast.success('Member Assigned', `${selectedMemberIds.length} member(s) assigned to event successfully.`)
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
    const membersToSelect = members.filter(m => getMemberOrders(m.order).includes(groupName) || m.rank === groupName)
    
    if (membersToSelect.length === 0) {
      setError(`No active members found for category: ${groupName}`)
      return
    }

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md transition-opacity" onClick={loading ? undefined : onClose} />
      
      <div className="relative w-full max-w-xl max-h-[88vh] rounded-3xl border border-slate-200/80 bg-white shadow-2xl z-10 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-extrabold text-sm shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100 inline-block mb-0.5">
                Committee & Roles
              </span>
              <h3 className="text-base font-black text-slate-900 tracking-tight">{editItem ? 'Edit Assignment' : 'Assign Team Member'}</h3>
            </div>
          </div>
          <button onClick={onClose} disabled={loading} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors disabled:opacity-50 cursor-pointer">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 text-xs">
          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3.5 rounded-2xl font-bold mb-4 animate-fade-in">
              {error}
            </div>
          )}

          <form id="assignmentForm" onSubmit={handleSave} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                  Select Members ({selectedMemberIds.length} selected)
                </label>
                {!editItem && selectedMemberIds.length > 0 && (
                  <button type="button" onClick={() => setSelectedMemberIds([])} className="text-xs text-indigo-600 hover:underline font-bold cursor-pointer">Clear</button>
                )}
              </div>

              {/* Quick Search Input */}
              <div className="mb-2">
                <input
                  type="text"
                  placeholder="Search member name or order..."
                  value={memberSearchTerm}
                  onChange={e => setMemberSearchTerm(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs font-bold border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-slate-50 text-slate-900 focus:bg-white transition-all shadow-2xs"
                />
              </div>

              <div className="border border-slate-200 rounded-2xl h-44 overflow-y-auto p-2 bg-slate-50 space-y-1">
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
                    return <div className="text-center py-6 text-slate-400 italic">No members found matching "{memberSearchTerm}".</div>
                  }

                  return filteredMembers.map(m => {
                    const isSelected = selectedMemberIds.includes(m.id)
                    const isAssigned = !editItem && existingAssignments.some(a => a.memberUid === m.id)
                    return (
                      <label 
                        key={m.id} 
                        className={`flex items-center gap-2 p-2 rounded-xl text-xs font-bold cursor-pointer transition-colors border ${
                          isAssigned 
                            ? 'opacity-40 bg-slate-100 border-transparent cursor-not-allowed' 
                            : isSelected 
                            ? 'bg-indigo-50/80 border-indigo-200 text-indigo-900 shadow-2xs' 
                            : 'hover:bg-white border-transparent text-slate-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          disabled={isAssigned || loading}
                          checked={isSelected}
                          onChange={(e) => {
                            if (editItem) {
                              setSelectedMemberIds([m.id])
                            } else {
                              if (e.target.checked) {
                                setSelectedMemberIds(prev => [...prev, m.id])
                              } else {
                                setSelectedMemberIds(prev => prev.filter(id => id !== m.id))
                              }
                            }
                          }}
                          className="h-4 w-4 rounded-md border-slate-300 text-indigo-600 focus:ring-indigo-500 accent-indigo-600"
                        />
                        <div className="flex-1 truncate">
                          <span className="font-extrabold text-slate-900">{m.lastName}, {m.firstName}</span>
                          {m.order && <span className="ml-1 text-[10px] text-slate-400 font-mono">({m.order})</span>}
                          {isAssigned && <span className="ml-1.5 text-[9px] font-black uppercase text-amber-600 bg-amber-50 px-1 py-0.5 rounded border border-amber-200">Already Assigned</span>}
                        </div>
                      </label>
                    )
                  })
                })()}
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">Committee / Group</label>
              <input
                type="text"
                value={committeeInput}
                onChange={e => setCommitteeInput(e.target.value)}
                placeholder="e.g. Program & Liturgy, Logistics"
                className="w-full px-3.5 py-2.5 text-xs font-bold border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-slate-50 text-slate-900 focus:bg-white transition-all shadow-2xs"
              />
            </div>

            <div>
              <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">Event Role Name *</label>
              <input
                type="text"
                required
                value={roleInput}
                onChange={e => setRoleInput(e.target.value)}
                placeholder="e.g. Committee Head, Member"
                className="w-full px-3.5 py-2.5 text-xs font-bold border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-slate-50 text-slate-900 focus:bg-white transition-all shadow-2xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <label className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-all ${
                isOverallHead ? 'bg-indigo-50 border-indigo-200 text-indigo-900 shadow-2xs font-black' : 'bg-slate-50 border-slate-200 text-slate-600 font-bold'
              }`}>
                <input
                  type="checkbox"
                  checked={isOverallHead}
                  onChange={e => {
                    setIsOverallHead(e.target.checked)
                    if (e.target.checked) setIsSubLeader(false)
                  }}
                  className="rounded text-indigo-600 focus:ring-indigo-500 accent-indigo-600"
                />
                <span className="text-[11px]">Overall Head</span>
              </label>

              <label className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-all ${
                isSubLeader ? 'bg-indigo-50 border-indigo-200 text-indigo-900 shadow-2xs font-black' : 'bg-slate-50 border-slate-200 text-slate-600 font-bold'
              }`}>
                <input
                  type="checkbox"
                  checked={isSubLeader}
                  onChange={e => {
                    setIsSubLeader(e.target.checked)
                    if (e.target.checked) setIsOverallHead(false)
                  }}
                  className="rounded text-indigo-600 focus:ring-indigo-500 accent-indigo-600"
                />
                <span className="text-[11px]">Sub-Leader</span>
              </label>
            </div>
          </form>

          {!editItem && (
            <div className="mt-6 pt-4 border-t border-slate-100">
              <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2">Quick Bulk Select</h4>
              <div className="flex flex-wrap gap-1.5">
                {ORDER_GROUPS.map(group => (
                  <button
                    key={group}
                    type="button"
                    disabled={loading}
                    onClick={() => handleBulkSelect(group)}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold rounded-lg transition-all border border-slate-200 disabled:opacity-50 cursor-pointer active:scale-95"
                  >
                    + {group}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-100 flex justify-end gap-2.5 bg-white sticky bottom-0">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="assignmentForm"
            variant="primary"
            loading={loading}
          >
            {editItem ? 'Save Changes' : `Assign ${selectedMemberIds.length > 0 ? selectedMemberIds.length : ''} Members`}
          </Button>
        </div>
      </div>
    </div>
  )
}
