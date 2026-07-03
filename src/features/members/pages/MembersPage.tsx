import React, { useState, useEffect } from 'react'
import { memberService } from '@/services/memberService'
import { Card } from '@/components/Card'
import { AlertModal, ConfirmModal } from '@/components/Dialog'
import { MemberTable } from '../components/MemberTable'
import { MemberFormModal } from '../components/MemberFormModal'
import { MemberImportModal } from '../components/MemberImportModal'
import type { Member, MemberInput } from '@/types/member'

export const MembersPage: React.FC = () => {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // List settings
  const [showArchived, setShowArchived] = useState(false)

  // Modals state
  const [formOpen, setFormOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(true)
  const [editingMember, setEditingMember] = useState<Member | null>(null)

  // Dialog state
  const [confirmArchive, setConfirmArchive] = useState<{ id: string; name: string } | null>(null)
  const [alertModal, setAlertModal] = useState<{ title: string; message: string; variant: 'error' | 'success' } | null>(null)

  // Set default modals state correctly
  useEffect(() => {
    setImportOpen(false)
  }, [])

  const loadMembers = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await memberService.getMembers(showArchived)
      setMembers(data)
    } catch (err: any) {
      console.error(err)
      setError('Failed to load member records.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMembers()
  }, [showArchived])

  // Callbacks
  const handleAddOrEditSubmit = async (input: MemberInput) => {
    if (editingMember) {
      await memberService.updateMember(editingMember.id, input)
    } else {
      await memberService.addMember(input)
    }
    await loadMembers()
  }

  const handleArchive = (id: string) => {
    const member = members.find(m => m.id === id)
    setConfirmArchive({ id, name: member ? `${member.firstName} ${member.lastName}` : 'this member' })
  }

  const handleArchiveConfirmed = async () => {
    if (!confirmArchive) return
    const { id } = confirmArchive
    setConfirmArchive(null)
    try {
      await memberService.archiveMember(id)
      await loadMembers()
    } catch (err) {
      console.error(err)
      setAlertModal({ variant: 'error', title: 'Archive Failed', message: 'Failed to archive member. Please try again.' })
    }
  }

  const handleRestore = async (id: string) => {
    try {
      await memberService.restoreMember(id)
      await loadMembers()
    } catch (err) {
      console.error(err)
      setAlertModal({ variant: 'error', title: 'Restore Failed', message: 'Failed to restore member. Please try again.' })
    }
  }

  const handleImport = async (inputs: MemberInput[]) => {
    await memberService.importMembersBatch(inputs)
    await loadMembers()
  }

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl font-sans">Member Management</h1>
          <p className="text-sm text-gray-500 mt-1">Manage ministry members, profile records, and bulk imports.</p>
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => {
              setEditingMember(null)
              setFormOpen(true)
            }}
            className="rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-2 text-xs font-bold text-white transition-colors cursor-pointer shadow-sm"
          >
            Add Member
          </button>
          <button
            onClick={() => setImportOpen(true)}
            className="rounded-lg border border-gray-200 bg-white hover:bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-700 hover:text-gray-900 transition-colors cursor-pointer shadow-sm"
          >
            Import CSV
          </button>
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

      {/* Error display */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          {error}
        </div>
      )}

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
            showArchived={showArchived}
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

      {/* Archive Confirm Dialog */}
      <ConfirmModal
        isOpen={!!confirmArchive}
        onClose={() => setConfirmArchive(null)}
        onConfirm={handleArchiveConfirmed}
        variant="warning"
        title="Archive Member"
        message={`Are you sure you want to archive ${confirmArchive?.name}? They will be deactivated from scheduling.`}
        confirmLabel="Archive"
      />

      {/* Alert Dialog */}
      <AlertModal
        isOpen={!!alertModal}
        onClose={() => setAlertModal(null)}
        variant={alertModal?.variant ?? 'error'}
        title={alertModal?.title ?? ''}
        message={alertModal?.message ?? ''}
      />
    </div>
  )
}
