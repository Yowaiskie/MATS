import React, { useState, useEffect, useCallback, useRef } from 'react'
import { memberService } from '@/services/memberService'
import { renewalService } from '@/services/renewalService'
import { Card } from '@/components/Card'
import { ConfirmModal, PasswordConfirmModal } from '@/components/Dialog'
import { authService } from '@/services/authService'
import { Loading } from '@/components/Loading'
import { MemberTable } from '../components/MemberTable'
import { MemberFormModal } from '../components/MemberFormModal'
import { MemberImportModal } from '../components/MemberImportModal'
import { MemberPDFImportModal } from '../components/MemberPDFImportModal'
import { BulkRankEditModal } from '../components/BulkRankEditModal'
import { BulkOrderEditModal } from '../components/BulkOrderEditModal'
import { MemberExportModal } from '../components/MemberExportModal'
import { CreateRenewalCycleModal } from '../components/CreateRenewalCycleModal'
import { EnrollMemberModal } from '../components/EnrollMemberModal'
import { EditCycleMembershipModal } from '../components/EditCycleMembershipModal'
import type { Member, MemberInput } from '@/types/member'
import type { RenewalCycle, RenewalMembership, RenewalMembershipWithMember } from '@/types/renewal'
import { useAuth } from '@/features/authentication/AuthContext'
import { useToast } from '@/context/ToastContext'

export const MembersPage: React.FC = () => {
  const { profile, isAdmin, canAction } = useAuth()
  const { toast } = useToast()
  const canManage = isAdmin || canAction('canManageMembers')
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)

  // Renewal Cycle State
  const [cycles, setCycles] = useState<RenewalCycle[]>([])
  const [selectedCycleId, setSelectedCycleId] = useState<string>('directory')
  const [cycleMembers, setCycleMembers] = useState<Member[]>([])
  const [cycleMembershipMap, setCycleMembershipMap] = useState<Map<string, RenewalMembership>>(new Map())
  const [allPermanentMembers, setAllPermanentMembers] = useState<Member[]>([])
  const [cycleMenuOpen, setCycleMenuOpen] = useState(false)
  const cycleMenuRef = useRef<HTMLDivElement>(null)

  // Renewal Cycle Modals
  const [createCycleOpen, setCreateCycleOpen] = useState(false)
  const [enrollOpen, setEnrollOpen] = useState(false)
  const [editingCycleMembership, setEditingCycleMembership] = useState<RenewalMembershipWithMember | null>(null)
  const [confirmRemoveFromCycle, setConfirmRemoveFromCycle] = useState<{ memberId: string; memberName: string } | null>(null)
  const [confirmArchiveCycle, setConfirmArchiveCycle] = useState<RenewalCycle | null>(null)

  // List settings (Permanent directory mode)
  const [showArchived, setShowArchived] = useState(false)

  // Modals state
  const [formOpen, setFormOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [pdfImportOpen, setPdfImportOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [exportScope, setExportScope] = useState<'all' | 'selected' | 'order'>('all')
  const [importMenuOpen, setImportMenuOpen] = useState(false)
  const [editingMember, setEditingMember] = useState<Member | null>(null)

  // Dialog state
  const [confirmArchive, setConfirmArchive] = useState<{ id: string; name: string } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null)

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkArchiveOpen, setBulkArchiveOpen] = useState(false)
  const [bulkRestoreOpen, setBulkRestoreOpen] = useState(false)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkRankEditOpen, setBulkRankEditOpen] = useState(false)
  const [bulkOrderEditOpen, setBulkOrderEditOpen] = useState(false)
  const [bulkProcessing, setBulkProcessing] = useState(false)

  const importMenuRef = useRef<HTMLDivElement>(null)

  const isCycleMode = selectedCycleId !== 'directory'
  const selectedCycle = cycles.find(c => c.id === selectedCycleId) || null

  // Close menus on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (importMenuRef.current && !importMenuRef.current.contains(event.target as Node)) {
        setImportMenuOpen(false)
      }
      if (cycleMenuRef.current && !cycleMenuRef.current.contains(event.target as Node)) {
        setCycleMenuOpen(false)
      }
    }
    if (importMenuOpen || cycleMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [importMenuOpen, cycleMenuOpen])

  // Clear selection when switching tabs or cycles
  useEffect(() => {
    setSelectedIds(new Set())
  }, [showArchived, selectedCycleId])

  const loadCycles = async () => {
    try {
      const data = await renewalService.getCycles()
      setCycles(data)
      return data
    } catch (err: any) {
      console.error('Failed to load renewal cycles:', err)
      toast.error('Cycle Error', err?.message || 'Failed to load renewal cycles.')
      return []
    }
  }

  const loadCycleMemberships = async (cycleId: string) => {
    try {
      const memberships = await renewalService.getMembershipsForCycle(cycleId)
      const map = new Map<string, RenewalMembership>()
      const membersList: Member[] = []
      memberships.forEach(m => {
        map.set(m.memberId, m)
        membersList.push(m.member)
      })
      setCycleMembershipMap(map)
      setCycleMembers(membersList)
    } catch (err: any) {
      console.error(err)
      toast.error('Load Error', 'Failed to load cycle members.')
    }
  }

  const loadAllPermanent = async () => {
    try {
      const all = await memberService.getMembers(false)
      setAllPermanentMembers(all)
    } catch (err) {
      console.error(err)
    }
  }

  const loadMembers = async (showSpinner = true) => {
    if (showSpinner) setLoading(true)
    try {
      const data = await memberService.getMembers(showArchived ? 'archived_only' : false)
      setMembers(data)
    } catch (err: any) {
      console.error(err)
      toast.error('Load Error', 'Failed to load member records.')
    } finally {
      if (showSpinner) setLoading(false)
    }
  }

  // Initial load
  useEffect(() => {
    const init = async () => {
      setLoading(true)
      const loadedCycles = await loadCycles()
      await loadAllPermanent()
      await loadMembers(false)

      // Default to current active cycle if one exists
      const current = loadedCycles.find(c => c.isCurrent)
      if (current) {
        setSelectedCycleId(current.id)
        await loadCycleMemberships(current.id)
      } else if (loadedCycles.length > 0) {
        setSelectedCycleId(loadedCycles[0].id)
        await loadCycleMemberships(loadedCycles[0].id)
      } else {
        setSelectedCycleId('directory')
      }
      setLoading(false)
    }
    init()
  }, [])

  // When selectedCycleId changes
  useEffect(() => {
    if (selectedCycleId !== 'directory') {
      loadCycleMemberships(selectedCycleId)
    } else {
      loadMembers(false)
    }
  }, [selectedCycleId, showArchived])

  // ── Cycle actions ─────────────────────────────────────────────
  const handleSetCurrentCycle = async (cycleId: string) => {
    const actor = profile?.email || 'Admin'
    try {
      await renewalService.setCurrentCycle(cycleId, actor)
      toast.success('Active Cycle Updated', 'Selected cycle is now the active current renewal cycle.')
      await loadCycles()
    } catch (err: any) {
      console.error(err)
      toast.error('Update Failed', err.message || 'Failed to set active cycle.')
    }
  }

  const handleArchiveCycleConfirmed = async () => {
    if (!confirmArchiveCycle) return
    const actor = profile?.email || 'Admin'
    try {
      await renewalService.archiveCycle(confirmArchiveCycle.id, actor)
      toast.success('Cycle Archived', `${confirmArchiveCycle.name} is now archived and locked.`)
      setConfirmArchiveCycle(null)
      await loadCycles()
    } catch (err: any) {
      console.error(err)
      toast.error('Archive Failed', err.message || 'Failed to archive cycle.')
    }
  }

  const handleUnarchiveCycle = async (cycleId: string) => {
    const actor = profile?.email || 'Admin'
    try {
      await renewalService.unarchiveCycle(cycleId, actor)
      toast.success('Cycle Unlocked', 'Cycle has been unarchived and can now receive updates.')
      await loadCycles()
    } catch (err: any) {
      console.error(err)
      toast.error('Unlock Failed', err.message || 'Failed to unarchive cycle.')
    }
  }

  const handleRemoveFromCycleConfirmed = async () => {
    if (!confirmRemoveFromCycle || !selectedCycle) return
    const actor = profile?.email || 'Admin'
    try {
      await renewalService.removeMembership(
        selectedCycle.id,
        confirmRemoveFromCycle.memberId,
        actor
      )
      toast.success(
        'Removed from Cycle',
        `${confirmRemoveFromCycle.memberName} was removed from ${selectedCycle.name}. Permanent record remains intact.`
      )
      setConfirmRemoveFromCycle(null)
      await loadCycleMemberships(selectedCycle.id)
      await loadCycles()
    } catch (err: any) {
      console.error(err)
      toast.error('Removal Failed', err.message || 'Failed to remove member from cycle.')
    }
  }

  // ── Single-record callbacks ───────────────────────────────────
  const handleAddOrEditSubmit = async (input: MemberInput) => {
    const actor = profile?.email || 'Admin'
    try {
      if (editingMember) {
        await memberService.updateMember(editingMember.id, input, actor)
        toast.success('Profile Updated', `Successfully updated profile for ${input.firstName} ${input.lastName}.`)
      } else {
        const newMemberId = await memberService.addMember(input, actor)
        // If an active cycle is currently selected, auto-enroll the newly registered member
        if (selectedCycle && !selectedCycle.isArchived) {
          try {
            await renewalService.enrollMemberInCycle(
              selectedCycle.id,
              newMemberId,
              {
                cycleRank: input.rank,
                membershipStatus: 'active',
                notes: 'Auto-enrolled upon registration'
              },
              actor
            )
            toast.success(
              'Member Registered & Enrolled',
              `Added ${input.firstName} ${input.lastName} to permanent directory and enrolled into ${selectedCycle.name}.`
            )
          } catch (enrollErr: any) {
            console.error(enrollErr)
            toast.success('Member Added', `Successfully added ${input.firstName} ${input.lastName} to member directory.`)
          }
        } else {
          toast.success('Member Added', `Successfully added ${input.firstName} ${input.lastName} to member directory.`)
        }
      }
      await loadMembers(false)
      await loadAllPermanent()
      if (selectedCycle) {
        await loadCycleMemberships(selectedCycle.id)
        await loadCycles()
      }
    } catch (err: any) {
      console.error(err)
      toast.error('Save Failed', err.message || 'Failed to save member profile.')
    }
  }

  const handleArchive = (id: string) => {
    const member = members.find(m => m.id === id) || cycleMembers.find(m => m.id === id)
    setConfirmArchive({ id, name: member ? `${member.firstName} ${member.lastName}` : 'this member' })
  }

  const handleArchiveConfirmed = async () => {
    if (!confirmArchive) return
    const { id, name } = confirmArchive
    setConfirmArchive(null)
    try {
      await memberService.deleteMember(id, profile?.email || 'Admin')
      await loadMembers(false)
      await loadAllPermanent()
      if (selectedCycle) {
        await loadCycleMemberships(selectedCycle.id)
      }
      toast.success('Member Deleted', `${name} was permanently removed.`)
    } catch (err: any) {
      console.error(err)
      toast.error('Delete Failed', err.message || 'Failed to delete member.')
    }
  }

  const handleDelete = (id: string) => {
    const member = members.find(m => m.id === id) || cycleMembers.find(m => m.id === id)
    setConfirmDelete({ id, name: member ? `${member.firstName} ${member.lastName}` : 'this member' })
  }

  const handleDeleteConfirmed = async (password: string) => {
    if (!confirmDelete) return
    const { id, name } = confirmDelete
    try {
      await authService.verifyPassword(password)
      await memberService.deleteMember(id, profile?.email || 'Admin')
      setConfirmDelete(null)
      await loadMembers(false)
      await loadAllPermanent()
      if (selectedCycle) {
        await loadCycleMemberships(selectedCycle.id)
      }
      toast.success('Member Deleted', `${name} was permanently removed.`)
    } catch (err: any) {
      console.error(err)
      throw new Error(err.message || 'Verification failed. Password may be incorrect.')
    }
  }

  const handleRestore = async (id: string) => {
    try {
      const member = members.find(m => m.id === id)
      await memberService.restoreMember(id, profile?.email || 'Admin')
      await loadMembers(false)
      await loadAllPermanent()
      toast.success('Member Restored', `${member ? member.firstName + ' ' + member.lastName : 'Member'} has been restored to active.`)
    } catch (err: any) {
      console.error(err)
      toast.error('Restore Failed', err.message || 'Failed to restore member.')
    }
  }

  const handleImport = async (inputs: MemberInput[]) => {
    try {
      await memberService.importMembersBatch(inputs, profile?.email || 'Admin')
      await loadMembers(false)
      await loadAllPermanent()
      toast.success('Import Successful', `Successfully imported ${inputs.length} member records.`)
    } catch (err: any) {
      console.error(err)
      toast.error('Import Failed', err.message || 'Failed to import member records.')
    }
  }

  // ── Bulk selection helpers ────────────────────────────────────
  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleBulkActionButton = () => {
    if (showArchived) {
      setBulkRestoreOpen(true)
    } else {
      setBulkArchiveOpen(true)
    }
  }

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const handleBulkArchiveConfirmed = async () => {
    setBulkProcessing(true)
    try {
      const ids = Array.from(selectedIds)
      await memberService.bulkDeleteMembers(ids, profile?.email || 'Admin')
      setBulkArchiveOpen(false)
      setSelectedIds(new Set())
      await loadMembers(false)
      await loadAllPermanent()
      toast.success('Bulk Delete Complete', `${ids.length} member(s) have been permanently deleted.`)
    } catch (err: any) {
      console.error(err)
      toast.error('Bulk Delete Failed', err.message || 'Failed to delete selected members.')
    } finally {
      setBulkProcessing(false)
    }
  }

  const handleBulkRestoreConfirmed = async () => {
    setBulkProcessing(true)
    try {
      const ids = Array.from(selectedIds)
      await memberService.bulkRestoreMembers(ids, profile?.email || 'Admin')
      setBulkRestoreOpen(false)
      setSelectedIds(new Set())
      await loadMembers(false)
      await loadAllPermanent()
      toast.success('Bulk Restore Complete', `${ids.length} member(s) have been restored to active.`)
    } catch (err: any) {
      console.error(err)
      toast.error('Bulk Restore Failed', err.message || 'Failed to restore selected members.')
    } finally {
      setBulkProcessing(false)
    }
  }

  const handleBulkDeleteConfirmed = async (password: string) => {
    setBulkProcessing(true)
    try {
      await authService.verifyPassword(password)
      const ids = Array.from(selectedIds)
      await memberService.bulkDeleteMembers(ids, profile?.email || 'Admin')
      setBulkDeleteOpen(false)
      setSelectedIds(new Set())
      await loadMembers(false)
      await loadAllPermanent()
      toast.success('Bulk Delete Complete', `${ids.length} member(s) have been permanently deleted.`)
    } catch (err: any) {
      console.error(err)
      throw new Error(err.message || 'Verification failed. Password may be incorrect.')
    } finally {
      setBulkProcessing(false)
    }
  }

  const handleBulkRankEditConfirmed = async (newRank: string) => {
    setBulkProcessing(true)
    try {
      const ids = Array.from(selectedIds)
      await memberService.bulkUpdateRank(ids, newRank, profile?.email || 'Admin')
      setBulkRankEditOpen(false)
      setSelectedIds(new Set())
      await loadMembers(false)
      await loadAllPermanent()
      toast.success('Bulk Rank Update Complete', `Successfully updated rank to '${newRank}' for ${ids.length} member(s).`)
    } catch (err: any) {
      console.error(err)
      toast.error('Bulk Rank Update Failed', err.message || 'Failed to update rank for selected members.')
    } finally {
      setBulkProcessing(false)
    }
  }

  const handleBulkOrderEditConfirmed = async (newOrder: string) => {
    setBulkProcessing(true)
    try {
      const ids = Array.from(selectedIds)
      await memberService.bulkUpdateOrder(ids, newOrder, profile?.email || 'Admin')
      setBulkOrderEditOpen(false)
      setSelectedIds(new Set())
      await loadMembers(false)
      await loadAllPermanent()
      toast.success('Bulk Order Update Complete', `Successfully updated order to '${newOrder || 'Unassigned'}' for ${ids.length} member(s).`)
    } catch (err: any) {
      console.error(err)
      toast.error('Bulk Order Update Failed', err.message || 'Failed to update order for selected members.')
    } finally {
      setBulkProcessing(false)
    }
  }

  if (loading) {
    return (
      <div className="py-24 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
        <Loading variant="spinner" label="Loading Members Directory..." />
      </div>
    )
  }

  const membersToDisplay = isCycleMode ? cycleMembers : members

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl font-sans">Member Management</h1>
          <p className="text-sm text-gray-500 mt-1">Manage annual renewal cycles, cycle-specific rosters, and ministry records.</p>
        </div>

        {/* Action Buttons Toolbar */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Export Button */}
          <button
            type="button"
            onClick={() => {
              setExportScope(selectedIds.size > 0 ? 'selected' : 'all')
              setExportOpen(true)
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-700 transition-all cursor-pointer shadow-2xs active:scale-95"
            title="Export Members (CSV / PDF)"
          >
            <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>Export</span>
          </button>

          {canManage && (
            <>
              {/* Import Dropdown Menu */}
              <div className="relative" ref={importMenuRef}>
                <button
                  type="button"
                  onClick={() => setImportMenuOpen(prev => !prev)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/80 hover:bg-slate-100 px-3.5 py-2 text-xs font-bold text-slate-700 transition-all cursor-pointer shadow-2xs active:scale-95"
                >
                  <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  <span>Import</span>
                  <svg className={`w-3.5 h-3.5 text-slate-400 transition-transform ${importMenuOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {importMenuOpen && (
                  <div className="absolute right-0 mt-1.5 w-48 rounded-xl bg-white border border-slate-200 shadow-xl py-1 z-30 animate-in fade-in zoom-in-95 duration-100">
                    <button
                      type="button"
                      onClick={() => {
                        setImportMenuOpen(false)
                        setImportOpen(true)
                      }}
                      className="w-full flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 transition cursor-pointer text-left"
                    >
                      <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      <span>Import CSV (.csv)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setImportMenuOpen(false)
                        setPdfImportOpen(true)
                      }}
                      className="w-full flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold text-slate-700 hover:bg-rose-50 hover:text-rose-800 transition cursor-pointer text-left"
                    >
                      <svg className="w-4 h-4 text-rose-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span>Import PDF (.pdf)</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Add Member Button (Primary) */}
              <button
                type="button"
                onClick={() => {
                  setEditingMember(null)
                  setFormOpen(true)
                }}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2 text-xs font-bold text-white transition-all cursor-pointer shadow-md shadow-blue-600/20 active:scale-95"
              >
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                <span>Add Member</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Renewal Cycle Selector & Management Bar ───────────── */}
      <div className="p-3.5 sm:p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Cycle:
              </span>
              <select
                value={selectedCycleId}
                onChange={(e) => setSelectedCycleId(e.target.value)}
                className="text-xs font-bold text-slate-800 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-500 shadow-2xs cursor-pointer min-w-[220px]"
              >
                {cycles.length > 0 && (
                  <optgroup label="Annual Renewal Cycles">
                    {cycles.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.year}){c.isCurrent ? ' • Current' : ''}{c.isArchived ? ' • Archived' : ''}
                      </option>
                    ))}
                  </optgroup>
                )}
                <optgroup label="Masterlist">
                  <option value="directory">All Permanent Members (Directory)</option>
                </optgroup>
              </select>
            </div>

            {/* Cycle Status Badges */}
            {selectedCycle && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {selectedCycle.isCurrent && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Active Current Cycle
                  </span>
                )}
                {selectedCycle.isArchived ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                    Archived (Locked)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                    {cycleMembers.length} Enrolled
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Cycle Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {canManage && selectedCycle && !selectedCycle.isArchived && (
              <button
                type="button"
                onClick={() => setEnrollOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-3.5 py-2 text-xs font-bold text-white transition-all cursor-pointer shadow-md shadow-indigo-600/20 active:scale-95"
              >
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                <span>Enroll Member</span>
              </button>
            )}

            {canManage && (
              <button
                type="button"
                onClick={() => setCreateCycleOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 transition-all cursor-pointer shadow-2xs active:scale-95"
              >
                <svg className="w-3.5 h-3.5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                <span>New Cycle</span>
              </button>
            )}

            {/* Cycle Management Dropdown */}
            {canManage && selectedCycle && (
              <div className="relative" ref={cycleMenuRef}>
                <button
                  type="button"
                  onClick={() => setCycleMenuOpen(prev => !prev)}
                  className="p-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-600 transition cursor-pointer shadow-2xs"
                  title="Cycle Options"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                  </svg>
                </button>

                {cycleMenuOpen && (
                  <div className="absolute right-0 mt-1.5 w-48 rounded-xl bg-white border border-slate-200 shadow-xl py-1 z-30 animate-in fade-in zoom-in-95">
                    {!selectedCycle.isCurrent && !selectedCycle.isArchived && (
                      <button
                        type="button"
                        onClick={() => {
                          setCycleMenuOpen(false)
                          handleSetCurrentCycle(selectedCycle.id)
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-700 text-left cursor-pointer"
                      >
                        <svg className="w-3.5 h-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Set as Current Active</span>
                      </button>
                    )}
                    {!selectedCycle.isArchived ? (
                      <button
                        type="button"
                        onClick={() => {
                          setCycleMenuOpen(false)
                          setConfirmArchiveCycle(selectedCycle)
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-amber-700 hover:bg-amber-50 text-left cursor-pointer"
                      >
                        <svg className="w-3.5 h-3.5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                        </svg>
                        <span>Archive & Lock Cycle</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setCycleMenuOpen(false)
                          handleUnarchiveCycle(selectedCycle.id)
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50 text-left cursor-pointer"
                      >
                        <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        <span>Unlock / Unarchive</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Archived Warning Banner */}
        {selectedCycle && selectedCycle.isArchived && (
          <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
            <svg className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <span className="font-bold">Historical Record:</span> This renewal cycle is archived and locked. Roster records and classifications are preserved for reporting and cannot be altered unless unarchived.
            </div>
          </div>
        )}
      </div>

      {/* Subnavigation tab toggle */}
      <div className="flex border-b border-gray-200 space-x-6">
        {isCycleMode ? (
          <>
            <button
              onClick={() => {}}
              className="pb-3 text-sm font-bold tracking-wide border-b-2 border-blue-600 text-blue-600 cursor-default"
            >
              Cycle Roster ({cycleMembers.length} enrolled)
            </button>
            <button
              onClick={() => setSelectedCycleId('directory')}
              className="pb-3 text-sm font-semibold tracking-wide border-b-2 border-transparent text-gray-400 hover:text-gray-600 cursor-pointer"
            >
              View Permanent Directory ({allPermanentMembers.length})
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => setShowArchived(false)}
              className={`pb-3 text-sm font-semibold tracking-wide border-b-2 transition-all duration-150 cursor-pointer ${
                !showArchived
                  ? 'border-blue-600 text-blue-600 font-bold'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              Active Members ({showArchived ? '--' : members.length})
            </button>
            <button
              onClick={() => setShowArchived(true)}
              className={`pb-3 text-sm font-semibold tracking-wide border-b-2 transition-all duration-150 cursor-pointer ${
                showArchived
                  ? 'border-blue-600 text-blue-600 font-bold'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              Archived Members ({showArchived ? members.length : '--'})
            </button>
          </>
        )}
      </div>

      {/* Members List table card */}
      <Card>
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center space-y-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
            <span className="text-xs text-gray-500">Loading member records...</span>
          </div>
        ) : (
          <MemberTable
            members={membersToDisplay}
            onEdit={(m) => {
              setEditingMember(m)
              setFormOpen(true)
            }}
            onArchive={handleArchive}
            onRestore={handleRestore}
            onDelete={handleDelete}
            showArchived={!isCycleMode && showArchived}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onSelectAll={handleBulkActionButton}
            onBulkDelete={() => setBulkDeleteOpen(true)}
            onBulkEditRank={() => setBulkRankEditOpen(true)}
            onBulkEditOrder={() => setBulkOrderEditOpen(true)}
            onClearSelection={handleClearSelection}
            onExportSelected={() => {
              setExportScope('selected')
              setExportOpen(true)
            }}
            bulkProcessing={bulkProcessing}
            isCycleMode={isCycleMode}
            isCycleArchived={selectedCycle?.isArchived}
            cycleMembershipMap={cycleMembershipMap}
            onEditCycleMembership={(m) => setEditingCycleMembership(m)}
            onRemoveFromCycle={(memberId, memberName) => setConfirmRemoveFromCycle({ memberId, memberName })}
          />
        )}
      </Card>

      {/* ── Modals Container ──────────────────────────────────── */}
      <MemberFormModal
        isOpen={formOpen}
        onClose={() => {
          setFormOpen(false)
          setEditingMember(null)
        }}
        onSubmit={handleAddOrEditSubmit}
        member={editingMember}
        existingMembers={allPermanentMembers.length > 0 ? allPermanentMembers : members}
      />

      <CreateRenewalCycleModal
        isOpen={createCycleOpen}
        onClose={() => setCreateCycleOpen(false)}
        onSubmit={async (input) => {
          const actor = profile?.email || 'Admin'
          const newCycle = await renewalService.createCycle(input, actor)
          toast.success('Renewal Cycle Created', `Created ${input.name}. Starts with an empty roster.`)
          await loadCycles()
          setSelectedCycleId(newCycle.id)
        }}
      />

      {selectedCycle && (
        <EnrollMemberModal
          isOpen={enrollOpen}
          onClose={() => setEnrollOpen(false)}
          cycle={selectedCycle}
          availableMembers={allPermanentMembers.filter(m => m.status !== 'archived' && !cycleMembershipMap.has(m.id))}
          onEnrollSuccess={async () => {
            toast.success('Enrollment Complete', `Members successfully enrolled in ${selectedCycle.name}.`)
            await loadCycleMemberships(selectedCycle.id)
            await loadCycles()
          }}
          actor={profile?.email || 'Admin'}
        />
      )}

      <EditCycleMembershipModal
        isOpen={!!editingCycleMembership}
        onClose={() => setEditingCycleMembership(null)}
        membership={editingCycleMembership}
        cycleName={selectedCycle?.name || 'Cycle'}
        onSaveSuccess={async () => {
          toast.success('Classification Updated', 'Cycle membership details successfully updated.')
          if (selectedCycle) {
            await loadCycleMemberships(selectedCycle.id)
          }
        }}
        actor={profile?.email || 'Admin'}
      />

      <MemberImportModal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={handleImport}
        existingMembers={allPermanentMembers.length > 0 ? allPermanentMembers : members}
      />

      <MemberPDFImportModal
        isOpen={pdfImportOpen}
        onClose={() => setPdfImportOpen(false)}
        onImport={handleImport}
        existingMembers={allPermanentMembers.length > 0 ? allPermanentMembers : members}
      />

      <MemberExportModal
        isOpen={exportOpen}
        onClose={() => setExportOpen(false)}
        members={membersToDisplay}
        selectedMemberIds={selectedIds}
        showArchived={!isCycleMode && showArchived}
        initialScope={exportScope}
      />

      {/* Remove from Cycle Confirm Dialog */}
      <ConfirmModal
        isOpen={!!confirmRemoveFromCycle}
        onClose={() => setConfirmRemoveFromCycle(null)}
        onConfirm={handleRemoveFromCycleConfirmed}
        variant="danger"
        title="Remove Member from Renewal Cycle"
        message={`Are you sure you want to remove ${confirmRemoveFromCycle?.memberName} from ${selectedCycle?.name}? Note: Their permanent member profile and records in other cycles will NOT be deleted.`}
        confirmLabel="Remove from Cycle"
      />

      {/* Archive Cycle Confirm Dialog */}
      <ConfirmModal
        isOpen={!!confirmArchiveCycle}
        onClose={() => setConfirmArchiveCycle(null)}
        onConfirm={handleArchiveCycleConfirmed}
        variant="warning"
        title="Archive Renewal Cycle"
        message={`Are you sure you want to archive ${confirmArchiveCycle?.name}? Enrolled member rosters and classifications will become locked and read-only to preserve historical records.`}
        confirmLabel="Archive & Lock Cycle"
      />

      {/* Single Delete Confirm Dialog */}
      <ConfirmModal
        isOpen={!!confirmArchive}
        onClose={() => setConfirmArchive(null)}
        onConfirm={handleArchiveConfirmed}
        variant="danger"
        title="Permanently Delete Member"
        message={`Are you sure you want to delete ${confirmArchive?.name}? This document will be permanently removed from the system.`}
        confirmLabel="Delete Permanently"
      />

      {/* Bulk Delete Confirm Dialog */}
      <ConfirmModal
        isOpen={bulkArchiveOpen}
        onClose={() => setBulkArchiveOpen(false)}
        onConfirm={handleBulkArchiveConfirmed}
        variant="danger"
        title={`Delete ${selectedIds.size} Member${selectedIds.size > 1 ? 's' : ''}`}
        message={`Are you sure you want to permanently delete ${selectedIds.size} selected member${selectedIds.size > 1 ? 's' : ''}? This action cannot be undone.`}
        confirmLabel={`Delete ${selectedIds.size} Member${selectedIds.size > 1 ? 's' : ''} Permanently`}
        loading={bulkProcessing}
      />

      {/* Bulk Restore Confirm Dialog */}
      <ConfirmModal
        isOpen={bulkRestoreOpen}
        onClose={() => setBulkRestoreOpen(false)}
        onConfirm={handleBulkRestoreConfirmed}
        variant="info"
        title={`Restore ${selectedIds.size} Member${selectedIds.size > 1 ? 's' : ''}`}
        message={`Are you sure you want to restore ${selectedIds.size} selected member${selectedIds.size > 1 ? 's' : ''} back to active?`}
        confirmLabel={`Restore ${selectedIds.size} Member${selectedIds.size > 1 ? 's' : ''}`}
        loading={bulkProcessing}
      />

      {/* Single Delete Confirm Dialog */}
      <PasswordConfirmModal
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDeleteConfirmed}
        title="Permanently Delete Member"
        message={`Are you sure you want to permanently delete ${confirmDelete?.name}? This action cannot be undone. Please enter your password to confirm.`}
        confirmLabel="Delete Permanently"
      />

      {/* Bulk Delete Confirm Dialog */}
      <PasswordConfirmModal
        isOpen={bulkDeleteOpen}
        onClose={() => setBulkDeleteOpen(false)}
        onConfirm={handleBulkDeleteConfirmed}
        title={`Permanently Delete ${selectedIds.size} Member${selectedIds.size > 1 ? 's' : ''}`}
        message={`Are you sure you want to permanently delete ${selectedIds.size} selected member${selectedIds.size > 1 ? 's' : ''}? This action cannot be undone. Please enter your password to confirm.`}
        confirmLabel={`Delete ${selectedIds.size} Member${selectedIds.size > 1 ? 's' : ''} Permanently`}
      />

      {/* Bulk Rank Edit Modal */}
      <BulkRankEditModal
        isOpen={bulkRankEditOpen}
        onClose={() => setBulkRankEditOpen(false)}
        onConfirm={handleBulkRankEditConfirmed}
        selectedCount={selectedIds.size}
      />

      {/* Bulk Order Edit Modal */}
      <BulkOrderEditModal
        isOpen={bulkOrderEditOpen}
        onClose={() => setBulkOrderEditOpen(false)}
        onConfirm={handleBulkOrderEditConfirmed}
        selectedCount={selectedIds.size}
      />
    </div>
  )
}
