import React, { useState, useEffect } from 'react'
import { Modal } from '@/components/Modal'
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
  const [purposes, setPurposes] = useState<EventContributionPurpose[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)

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

  const handleArchive = async (id: string) => {
    if (!profile) return
    if (!window.confirm('Are you sure you want to archive this contribution purpose? New contributions cannot select archived purposes.')) return
    try {
      await eventContributionService.archivePurpose(id, eventId, profile.displayName || profile.email)
      await fetchPurposes()
      onSuccess()
    } catch (err: any) {
      setError(err.message || 'Failed to archive purpose.')
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Manage Contribution Purposes" maxWidth="md">
      <div className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            {editingId ? 'Edit Purpose' : 'Create New Purpose'}
          </h4>
          <div>
            <label className="block text-[10px] font-extrabold uppercase text-slate-500 mb-1">Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Food Contribution"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-[10px] font-extrabold uppercase text-slate-500 mb-1">Description (Optional)</label>
            <input
              type="text"
              placeholder="e.g. Budget contribution from parents"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="px-3 py-1.5 border border-slate-200 hover:bg-slate-100 rounded-lg text-[11px] font-bold text-slate-600 cursor-pointer"
              >
                Cancel Edit
              </button>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-bold disabled:opacity-50 cursor-pointer"
            >
              {submitting ? 'Saving...' : editingId ? 'Update Purpose' : 'Add Purpose'}
            </button>
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
                        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[9px] font-bold uppercase rounded">
                          Archived
                        </span>
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
                          onClick={() => handleArchive(p.id)}
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
    </Modal>
  )
}
