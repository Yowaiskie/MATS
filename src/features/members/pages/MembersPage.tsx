import React, { useState, useEffect, useCallback } from 'react'
import { memberService } from '@/services/memberService'
import { Card } from '@/components/Card'
import { AlertModal, ConfirmModal, PasswordConfirmModal } from '@/components/Dialog'
import { authService } from '@/services/authService'
import { Loading } from '@/components/Loading'
import { MemberTable } from '../components/MemberTable'
import { MemberFormModal } from '../components/MemberFormModal'
import { MemberImportModal } from '../components/MemberImportModal'
import { MemberPDFImportModal } from '../components/MemberPDFImportModal'
import { BulkRankEditModal } from '../components/BulkRankEditModal'
import { BulkOrderEditModal } from '../components/BulkOrderEditModal'
import { MemberExportModal } from '../components/MemberExportModal'
import type { Member, MemberInput } from '@/types/member'
import { useAuth } from '@/features/authentication/AuthContext'
import { useToast } from '@/context/ToastContext'

export const MembersPage: React.FC = () => {
  const { profile, isAdmin, canAction } = useAuth()
  const { toast } = useToast()
  const canManage = isAdmin || canAction('canManageMembers')
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // List settings
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
  const [alertModal, setAlertModal] = useState<{ title: string; message: string; variant: 'error' | 'success' } | null>(null)

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkArchiveOpen, setBulkArchiveOpen] = useState(false)
  const [bulkRestoreOpen, setBulkRestoreOpen] = useState(false)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkRankEditOpen, setBulkRankEditOpen] = useState(false)
  const [bulkOrderEditOpen, setBulkOrderEditOpen] = useState(false)
  const [bulkProcessing, setBulkProcessing] = useState(false)

  const importMenuRef = React.useRef<HTMLDivElement>(null)

  // Close import menu on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (importMenuRef.current && !importMenuRef.current.contains(event.target as Node)) {
        setImportMenuOpen(false)
      }
    }
    if (importMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [importMenuOpen])

  // Set default modals state correctly
  useEffect(() => {
    setImportOpen(false)
  }, [])

  // Clear selection when switching tabs
  useEffect(() => {
    setSelectedIds(new Set())
  }, [showArchived])

  const loadMembers = async (showSpinner = true) => {
    if (showSpinner) setLoading(true)
    setError(null)
    try {
      const data = await memberService.getMembers(showArchived ? 'archived_only' : false)
      setMembers(data)
    } catch (err: any) {
      console.error(err)
      setError('Failed to load member records.')
    } finally {
      if (showSpinner) setLoading(false)
    }
  }

  useEffect(() => {
    loadMembers()
  }, [showArchived])

  // ── Single-record callbacks ───────────────────────────────────
  const handleAddOrEditSubmit = async (input: MemberInput) => {
    const actor = profile?.email || 'Admin'
    try {
      if (editingMember) {
        await memberService.updateMember(editingMember.id, input, actor)
        toast.success('Profile Updated', `Successfully updated profile for ${input.firstName} ${input.lastName}.`)
      } else {
        await memberService.addMember(input, actor)
        toast.success('Member Added', `Successfully added ${input.firstName} ${input.lastName} to member directory.`)
      }
      await loadMembers(false)
    } catch (err: any) {
      console.error(err)
      toast.error('Save Failed', err.message || 'Failed to save member profile.')
    }
  }

  const handleArchive = (id: string) => {
    const member = members.find(m => m.id === id)
    setConfirmArchive({ id, name: member ? `${member.firstName} ${member.lastName}` : 'this member' })
  }

  const handleArchiveConfirmed = async () => {
    if (!confirmArchive) return
    const { id, name } = confirmArchive
    setConfirmArchive(null)
    try {
      await memberService.deleteMember(id, profile?.email || 'Admin')
      await loadMembers(false)
      toast.success('Member Deleted', `${name} was permanently removed.`)
    } catch (err: any) {
      console.error(err)
      toast.error('Delete Failed', err.message || 'Failed to delete member.')
    }
  }

  const handleDelete = (id: string) => {
    const member = members.find(m => m.id === id)
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

  // "Select all" in table context means: trigger bulk action dialog
  // We reuse onSelectAll prop slot as the bulk-action button handler in MemberTable
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

  // Bulk delete confirmed
  const handleBulkArchiveConfirmed = async () => {
    setBulkProcessing(true)
    try {
      const ids = Array.from(selectedIds)
      await memberService.bulkDeleteMembers(ids, profile?.email || 'Admin')
      setBulkArchiveOpen(false)
      setSelectedIds(new Set())
      await loadMembers(false)
      toast.success('Bulk Delete Complete', `${ids.length} member(s) have been permanently deleted.`)
    } catch (err: any) {
      console.error(err)
      toast.error('Bulk Delete Failed', err.message || 'Failed to delete selected members.')
    } finally {
      setBulkProcessing(false)
    }
  }

  // Bulk restore confirmed
  const handleBulkRestoreConfirmed = async () => {
    setBulkProcessing(true)
    try {
      const ids = Array.from(selectedIds)
      await memberService.bulkRestoreMembers(ids, profile?.email || 'Admin')
      setBulkRestoreOpen(false)
      setSelectedIds(new Set())
      await loadMembers(false)
      toast.success('Bulk Restore Complete', `${ids.length} member(s) have been restored to active.`)
    } catch (err: any) {
      console.error(err)
      toast.error('Bulk Restore Failed', err.message || 'Failed to restore selected members.')
    } finally {
      setBulkProcessing(false)
    }
  }

  // Bulk delete confirmed
  const handleBulkDeleteConfirmed = async (password: string) => {
    setBulkProcessing(true)
    try {
      await authService.verifyPassword(password)
      const ids = Array.from(selectedIds)
      await memberService.bulkDeleteMembers(ids, profile?.email || 'Admin')
      setBulkDeleteOpen(false)
      setSelectedIds(new Set())
      await loadMembers(false)
      toast.success('Bulk Delete Complete', `${ids.length} member(s) have been permanently deleted.`)
    } catch (err: any) {
      console.error(err)
      throw new Error(err.message || 'Verification failed. Password may be incorrect.')
    } finally {
      setBulkProcessing(false)
    }
  }

  // Bulk rank edit confirmed
  const handleBulkRankEditConfirmed = async (newRank: string) => {
    setBulkProcessing(true)
    try {
      const ids = Array.from(selectedIds)
      await memberService.bulkUpdateRank(ids, newRank, profile?.email || 'Admin')
      setBulkRankEditOpen(false)
      setSelectedIds(new Set())
      await loadMembers(false)
      toast.success('Bulk Rank Update Complete', `Successfully updated rank to '${newRank}' for ${ids.length} member(s).`)
    } catch (err: any) {
      console.error(err)
      toast.error('Bulk Rank Update Failed', err.message || 'Failed to update rank for selected members.')
    } finally {
      setBulkProcessing(false)
    }
  }

  // Bulk order edit confirmed
  const handleBulkOrderEditConfirmed = async (newOrder: string) => {
    setBulkProcessing(true)
    try {
      const ids = Array.from(selectedIds)
      await memberService.bulkUpdateOrder(ids, newOrder, profile?.email || 'Admin')
      setBulkOrderEditOpen(false)
      setSelectedIds(new Set())
      await loadMembers(false)
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

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl font-sans">Member Management</h1>
          <p className="text-sm text-gray-500 mt-1">Manage ministry members, profile records, and bulk imports.</p>
        </div>

        {/* Action Buttons Toolbar */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Export Button (Available for masterlist export) */}
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

      {/* Subnavigation tab toggle */}
      <div className="flex border-b border-gray-200 space-x-6">
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
            members={members}
            onEdit={(m) => {
              setEditingMember(m)
              setFormOpen(true)
            }}
            onArchive={handleArchive}
            onRestore={handleRestore}
            onDelete={handleDelete}
            showArchived={showArchived}
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
          />
        )}
      </Card>

      {/* Modals Container */}
      <MemberFormModal
        isOpen={formOpen}
        onClose={() => {
          setFormOpen(false)
          setEditingMember(null)
        }}
        onSubmit={handleAddOrEditSubmit}
        member={editingMember}
        existingMembers={members}
      />

      <MemberImportModal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={handleImport}
        existingMembers={members}
      />

      <MemberPDFImportModal
        isOpen={pdfImportOpen}
        onClose={() => setPdfImportOpen(false)}
        onImport={handleImport}
        existingMembers={members}
      />

      <MemberExportModal
        isOpen={exportOpen}
        onClose={() => setExportOpen(false)}
        members={members}
        selectedMemberIds={selectedIds}
        showArchived={showArchived}
        initialScope={exportScope}
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

      {/* Alert Dialog */}
      <AlertModal
        isOpen={!!alertModal || !!error}
        onClose={() => {
          setAlertModal(null)
          setError(null)
        }}
        variant={alertModal?.variant ?? 'error'}
        title={alertModal?.title ?? 'Error'}
        message={alertModal?.message ?? error ?? ''}
      />
    </div>
  )
}
