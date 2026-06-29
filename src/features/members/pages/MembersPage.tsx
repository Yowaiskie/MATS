import React, { useState, useEffect } from 'react'
import { memberService } from '@/services/memberService'
import { Card } from '@/components/Card'
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
  const [importOpen, setImportOpen] = useState(true) // Keep set default or let trigger open
  const [editingMember, setEditingMember] = useState<Member | null>(null)

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

  const handleArchive = async (id: string) => {
    if (!window.confirm('Are you sure you want to archive this member? They will be deactivated from scheduling.')) return
    try {
      await memberService.archiveMember(id)
      await loadMembers()
    } catch (err) {
      console.error(err)
      alert('Failed to archive member.')
    }
  }

  const handleRestore = async (id: string) => {
    try {
      await memberService.restoreMember(id)
      await loadMembers()
    } catch (err) {
      console.error(err)
      alert('Failed to restore member.')
    }
  }

  const handleImport = async (inputs: MemberInput[]) => {
    await memberService.importMembersBatch(inputs)
    await loadMembers()
  }

  // Exports all loaded members to CSV (UTF-8) including split name columns
  const handleExportCSV = () => {
    if (members.length === 0) {
      alert('No member records available to export.')
      return
    }

    const headers = ['First Name', 'Last Name', 'Middle Name', 'Suffix', 'Nickname', 'Rank', 'Status', 'Phone Number']
    const csvRows = [headers.join(',')]

    members.forEach(m => {
      const row = [
        `"${m.firstName.replace(/"/g, '""')}"`,
        `"${m.lastName.replace(/"/g, '""')}"`,
        m.middleName ? `"${m.middleName.replace(/"/g, '""')}"` : '',
        m.suffix ? `"${m.suffix.replace(/"/g, '""')}"` : '',
        m.nickname ? `"${m.nickname.replace(/"/g, '""')}"` : '',
        `"${m.rank.replace(/"/g, '""')}"`,
        m.status,
        m.phoneNumber ? `"${m.phoneNumber}"` : ''
      ]
      csvRows.push(row.join(','))
    })

    const csvContent = '\uFEFF' + csvRows.join('\n') // UTF-8 BOM prefix
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `mats_members_${showArchived ? 'archived' : 'active'}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Member Management</h1>
          <p className="text-sm text-gray-400 mt-1">Manage ministry members, profile records, and bulk imports.</p>
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => {
              setEditingMember(null)
              setFormOpen(true)
            }}
            className="rounded bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-xs font-semibold text-white transition-colors"
          >
            Add Member
          </button>
          <button
            onClick={() => setImportOpen(true)}
            className="rounded border border-gray-800 bg-gray-950 hover:bg-gray-900 px-4 py-2 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            Import CSV
          </button>
          <button
            onClick={handleExportCSV}
            className="rounded border border-gray-800 bg-gray-950 hover:bg-gray-900 px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white transition-colors"
            disabled={members.length === 0}
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Subnavigation tab toggle */}
      <div className="flex border-b border-gray-800 space-x-4">
        <button
          onClick={() => setShowArchived(false)}
          className={`pb-3 text-sm font-semibold tracking-wide border-b-2 transition-colors ${
            !showArchived
              ? 'border-indigo-500 text-white'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          Active Members ({showArchived ? '--' : members.length})
        </button>
        <button
          onClick={() => setShowArchived(true)}
          className={`pb-3 text-sm font-semibold tracking-wide border-b-2 transition-colors ${
            showArchived
              ? 'border-indigo-500 text-white'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          Archived Members ({showArchived ? members.length : '--'})
        </button>
      </div>

      {/* Error display */}
      {error && (
        <div className="rounded border border-red-900 bg-red-950/40 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Members List table card */}
      <Card>
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center space-y-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
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
    </div>
  )
}
