import React, { useState, useEffect } from 'react'
import { Modal, Button, StatusBadge, useToast } from '@/components'
import { ConfirmModal } from '@/components/Dialog'
import { useAuth } from '@/features/authentication/AuthContext'
import { eventContributionService } from '@/services/eventContributionService'
import type { EventContributionPurpose } from '@/types/eventContribution'

interface Props {
  isOpen: boolean
  onClose: () => void
  eventId: string
  onSuccess: () => void
}

export const ContributionPurposeModal: React.FC<Props> = ({ isOpen, onClose, eventId, onSuccess }) => {
  const { profile } = useAuth()
  const { toast } = useToast()
  const [purposes, setPurposes] = useState<EventContributionPurpose[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [archiveTargetId, setArchiveTargetId] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      fetchPurposes()
      resetForm()
    }
  }, [isOpen])

  const fetchPurposes = async () => {
    try {
      setLoading(true)
      const data = await eventContributionService.getPurposesByEventId(eventId)
      setPurposes(data)
    } catch (err) {
      console.error('Failed to load purposes:', err)
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setName('')
    setDescription('')
    setEditingId(null)
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return
    if (!name.trim()) {
      setError('Purpose name is required.')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      if (editingId) {
        await eventContributionService.updatePurpose(
          editingId,
          { name: name.trim(), description: description.trim() },
          eventId,
          profile.displayName || profile.email
        )
        toast.success('Purpose Updated', `Contribution purpose "${name.trim()}" updated successfully.`)
      } else {
        await eventContributionService.createPurpose(
          {
            eventId,
            name: name.trim(),
            description: description.trim()
          },
          profile.uid,
          profile.displayName || profile.email
        )
        toast.success('Purpose Created', `Contribution purpose "${name.trim()}" created successfully.`)
      }
      resetForm()
      await fetchPurposes()
      onSuccess()
    } catch (err: any) {
      setError(err.message || 'Failed to save contribution purpose.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleEditClick = (p: EventContributionPurpose) => {
    setEditingId(p.id)
    setName(p.name)
    setDescription(p.description || '')
    setError(null)
  }

  const handleArchiveConfirm = async () => {
    if (!profile || !archiveTargetId) return
    try {
      await eventContributionService.archivePurpose(archiveTargetId, eventId, profile.displayName || profile.email)
      toast.success('Purpose Archived', 'Contribution purpose has been archived.')
      setArchiveTargetId(null)
      await fetchPurposes()
      onSuccess()
    } catch (err: any) {
      setError(err.message || 'Failed to archive purpose.')
      setArchiveTargetId(null)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Manage Contribution Purposes"
      subtitle="Categorize and configure event contributions categories"
      badge="Purpose Categories"
      icon={
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
        </svg>
      }
      maxWidth="xl"
    >
      <div className="space-y-4">
        {error && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-2xl animate-fade-in">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-3">
          <div className="flex items-center justify-between pb-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
              {editingId ? 'Edit Mode' : 'New Entry'}
            </span>
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight">
              {editingId ? 'Edit Purpose' : 'Create New Purpose'}
            </h4>
          </div>
          <div>
            <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1">Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Food Contribution"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full text-xs font-bold border border-slate-200 rounded-xl px-3.5 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1">Description (Optional)</label>
            <input
              type="text"
              placeholder="e.g. Budget contribution from parents"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-xs font-bold border border-slate-200 rounded-xl px-3.5 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            {editingId && (
              <Button
                type="button"
                variant="outline"
                size="dense"
                onClick={resetForm}
              >
                Cancel Edit
              </Button>
            )}
            <Button
              type="submit"
              variant="primary"
              size="dense"
              loading={submitting}
            >
              {editingId ? 'Update Purpose' : 'Add Purpose'}
            </Button>
          </div>
        </form>

        <div className="space-y-2">
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Existing Purposes</h4>
          {loading ? (
            <div className="py-8 text-center text-xs text-slate-500">Loading purposes...</div>
          ) : purposes.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400 italic">No purposes created for this event yet.</div>
          ) : (
            <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-2xl divide-y divide-slate-100">
              {purposes.map((p) => (
                <div key={p.id} className="p-3 flex items-center justify-between gap-3 hover:bg-slate-50/50">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-900 truncate">{p.name}</span>
                      {p.isArchived && (
                        <StatusBadge status="archived" size="sm" />
                      )}
                    </div>
                    {p.description && (
                      <p className="text-[10px] text-slate-500 truncate mt-0.5">{p.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {!p.isArchived && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleEditClick(p)}
                          className="px-2 py-1 text-[10px] font-bold text-blue-600 hover:bg-blue-50 rounded cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setArchiveTargetId(p.id)}
                          className="px-2 py-1 text-[10px] font-bold text-red-600 hover:bg-red-50 rounded cursor-pointer"
                        >
                          Archive
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={!!archiveTargetId}
        onClose={() => setArchiveTargetId(null)}
        onConfirm={handleArchiveConfirm}
        title="Archive Contribution Purpose"
        message="Are you sure you want to archive this contribution purpose? New contributions cannot select archived purposes."
        confirmLabel="Archive"
        variant="warning"
      />
    </Modal>
  )
}
