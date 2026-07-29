import React, { useState, useEffect } from 'react'
import { publicationService } from '@/services/publicationService'
import { recurringService } from '@/services/recurringService'
import { scheduleService } from '@/services/scheduleService'
import type { SchedulePublication, SchedulePublicationInput } from '@/types/publication'
import { AlertModal, ConfirmModal } from '@/components/Dialog'
import { PublicationFormModal } from './PublicationFormModal'
import { ManageSubmissionsModal } from './ManageSubmissionsModal'

export const PublicationsTab: React.FC = () => {
  const [publications, setPublications] = useState<SchedulePublication[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [formOpen, setFormOpen] = useState(false)
  const [selectedPublication, setSelectedPublication] = useState<SchedulePublication | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [confirmStatusAction, setConfirmStatusAction] = useState<{
    pub: SchedulePublication;
    targetStatus: 'published' | 'archived';
    isLocked: boolean;
    title: string;
    message: string;
    confirmLabel: string;
  } | null>(null)
  const [manageSubmissionsPub, setManageSubmissionsPub] = useState<SchedulePublication | null>(null)
  const [alertModal, setAlertModal] = useState<{ title: string; message: string; type?: 'success' | 'error' } | null>(null)

  const loadData = async () => {
    setLoading(true)
    try {
      const data = await publicationService.getPublications()
      setPublications(data)
    } catch (err: any) {
      console.error(err)
      setError('Failed to load publications.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleCopyLink = (pubId: string) => {
    const url = `${window.location.origin}/public/schedule/${pubId}`
    navigator.clipboard.writeText(url)
    setAlertModal({ title: 'Link Copied', message: 'Public link copied to clipboard!', type: 'success' })
  }

  const handleDelete = (id: string) => {
    setConfirmDelete(id)
  }

  const handleDeleteConfirmed = async () => {
    if (!confirmDelete) return
    const id = confirmDelete
    setConfirmDelete(null)
    try {
      await publicationService.deletePublication(id)
      await loadData()
      setAlertModal({ title: 'Deleted', message: 'Publication has been deleted.', type: 'success' })
    } catch (err: any) {
      console.error(err)
      setAlertModal({ title: 'Delete Failed', message: err.message || 'Failed to delete publication.', type: 'error' })
    }
  }

  const handlePublish = async (pub: SchedulePublication) => {
    try {
      await publicationService.updatePublication(pub.id, { status: 'published' })
      await loadData()
      setAlertModal({ 
        title: 'Published', 
        message: 'Publication is now open for scheduling.',
        type: 'success'
      })
    } catch (err: any) {
      setAlertModal({ title: 'Error', message: 'Failed to update status.', type: 'error' })
    }
  }

  const handleStatusActionConfirmed = async () => {
    if (!confirmStatusAction) return
    const { pub, targetStatus, isLocked } = confirmStatusAction
    setConfirmStatusAction(null)
    setLoading(true)
    try {
      const lockedCount = await scheduleService.bulkLockSchedules(pub.startDate, pub.endDate, isLocked)
      await publicationService.updatePublication(pub.id, { status: targetStatus })
      await loadData()
      setAlertModal({ 
        title: targetStatus === 'archived' ? 'Publication Finalized' : 'Publication Unfinalized', 
        message: `Successfully ${isLocked ? 'locked' : 'unlocked'} ${lockedCount} schedule(s) for the month and set publication to ${targetStatus}.`,
        type: 'success'
      })
    } catch (err: any) {
      console.error(err)
      setAlertModal({ title: 'Error', message: err.message || 'Failed to finalize publication.', type: 'error' })
      setLoading(false)
    }
  }

  const handleSave = async (input: SchedulePublicationInput, generateSchedules: boolean, selectedTemplateIds?: string[]) => {
    if (selectedPublication) {
      await publicationService.updatePublication(selectedPublication.id, input)
    } else {
      await publicationService.addPublication(input)
      
      if (generateSchedules && selectedTemplateIds) {
        try {
          const activeTemplates = (await recurringService.getTemplates())
            .filter(t => t.active && selectedTemplateIds.includes(t.id))
            
          if (activeTemplates.length > 0) {
            const report = await recurringService.generateSchedules(
              input.startDate,
              input.endDate,
              activeTemplates
            )
            setAlertModal({ 
              title: 'Publication Created', 
              message: `Created successfully! Generated ${report.created} schedule(s) from templates. (Skipped: ${report.skipped}, Duplicates: ${report.duplicates})`, 
              type: 'success' 
            })
          } else {
            setAlertModal({ title: 'Publication Created', message: 'Created successfully, but no active templates were found to generate schedules.', type: 'success' })
          }
        } catch (err: any) {
          console.error(err)
          setAlertModal({ title: 'Warning', message: `Publication created, but failed to generate schedules: ${err.message}`, type: 'error' })
        }
        await loadData()
        return // Return early since alert modal is already set
      }
    }
    await loadData()
    if (!generateSchedules) {
      setAlertModal({ title: 'Success', message: 'Publication saved successfully.', type: 'success' })
    }
  }

  const stats = {
    total: publications.length,
    active: publications.filter(p => p.status === 'published').length,
    draft: publications.filter(p => p.status === 'draft').length,
    archived: publications.filter(p => p.status === 'archived').length,
  }

  if (loading) {
    return (
      <div className="py-16 flex flex-col items-center justify-center space-y-3 bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
        <span className="text-xs text-gray-500">Loading publications...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Publications</h2>
          <p className="text-xs text-gray-500">Manage batched schedules for public access.</p>
        </div>
        <button
          onClick={() => {
            setSelectedPublication(null)
            setFormOpen(true)
          }}
          className="rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-2.5 text-xs font-bold text-white shadow-sm"
        >
          Create Publication
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <p className="text-[10px] uppercase font-bold text-gray-400">Total</p>
          <p className="text-2xl font-black text-gray-900">{stats.total}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <p className="text-[10px] uppercase font-bold text-green-500">Published</p>
          <p className="text-2xl font-black text-gray-900">{stats.active}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <p className="text-[10px] uppercase font-bold text-amber-500">Draft</p>
          <p className="text-2xl font-black text-gray-900">{stats.draft}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <p className="text-[10px] uppercase font-bold text-gray-400">Archived</p>
          <p className="text-2xl font-black text-gray-900">{stats.archived}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-6 py-4 text-[10px] font-extrabold uppercase text-gray-500">Name</th>
              <th className="px-6 py-4 text-[10px] font-extrabold uppercase text-gray-500">Date Range</th>
              <th className="px-6 py-4 text-[10px] font-extrabold uppercase text-gray-500">Status</th>
              <th className="px-6 py-4 text-[10px] font-extrabold uppercase text-gray-500 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {publications.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-10 text-center text-xs text-gray-500">
                  No publications found.
                </td>
              </tr>
            ) : (
              publications.map(pub => (
                <tr key={pub.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4 font-bold text-gray-900">{pub.name}</td>
                  <td className="px-6 py-4 text-xs text-gray-500">
                    {pub.startDate} to {pub.endDate}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2.5 py-1 rounded-md text-[10px] font-black uppercase ${
                      pub.status === 'published' ? 'bg-green-100 text-green-700' :
                      pub.status === 'archived' ? 'bg-gray-100 text-gray-600' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {pub.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end items-center gap-3">
                      
                      {/* Link Actions */}
                      <div className="flex items-center gap-1 pr-3 border-r border-gray-200">
                        <button
                          onClick={() => handleCopyLink(pub.id)}
                          title="Copy Public Link"
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                          </svg>
                        </button>
                        <a
                          href={`/public/schedule/${pub.id}`}
                          target="_blank"
                          rel="noreferrer"
                          title="Preview"
                          className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                        </a>
                      </div>

                      {/* Status Actions */}
                      <div className="flex items-center gap-1 pr-3 border-r border-gray-200">
                        {pub.status === 'draft' && (
                          <button
                            onClick={() => handlePublish(pub)}
                            title="Publish (Open for Scheduling)"
                            className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polygon points="5 3 19 12 5 21 5 3"/>
                            </svg>
                          </button>
                        )}
                        {pub.status === 'published' && (
                          <button
                            onClick={() => setConfirmStatusAction({
                              pub,
                              targetStatus: 'archived',
                              isLocked: true,
                              title: 'Finalize & Lock Schedules',
                              message: `Are you sure you want to finalize "${pub.name}"? This will lock all schedules in its date range (${pub.startDate} to ${pub.endDate}) and prevent members from submitting or changing their schedules via the public link.`,
                              confirmLabel: 'Finalize & Lock'
                            })}
                            title="Finalize & Lock Schedules"
                            className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                          </button>
                        )}
                        {pub.status === 'archived' && (
                          <button
                            onClick={() => setConfirmStatusAction({
                              pub,
                              targetStatus: 'published',
                              isLocked: false,
                              title: 'Unfinalize & Unlock Schedules',
                              message: `Are you sure you want to unfinalize "${pub.name}"? This will unlock all schedules in its date range and re-open the public link so members can submit again.`,
                              confirmLabel: 'Unfinalize & Unlock'
                            })}
                            title="Unfinalize & Unlock Schedules"
                            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/><path d="M10.5 7h4v4"/></svg>
                          </button>
                        )}
                      </div>

                      {/* Management Actions */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setManageSubmissionsPub(pub)}
                          title="Manage Submissions / Reset Users"
                          className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                        </button>
                        <button
                          onClick={() => {
                            setSelectedPublication(pub)
                            setFormOpen(true)
                          }}
                          title="Edit"
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                        </button>
                        <button
                          onClick={() => handleDelete(pub.id)}
                          title="Delete"
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <PublicationFormModal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSave}
        publication={selectedPublication}
      />

      <ConfirmModal
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDeleteConfirmed}
        variant="danger"
        title="Delete Publication"
        message="Are you sure you want to delete this publication? This does not delete any schedules."
        confirmLabel="Delete"
      />

      <ConfirmModal
        isOpen={!!confirmStatusAction}
        onClose={() => setConfirmStatusAction(null)}
        onConfirm={handleStatusActionConfirmed}
        title={confirmStatusAction?.title || ''}
        message={confirmStatusAction?.message || ''}
        confirmLabel={confirmStatusAction?.confirmLabel || 'Confirm'}
      />

      <ManageSubmissionsModal
        isOpen={!!manageSubmissionsPub}
        onClose={() => setManageSubmissionsPub(null)}
        publication={manageSubmissionsPub}
        onSuccess={() => {
          setManageSubmissionsPub(null)
          loadData()
        }}
      />

      <AlertModal
        isOpen={!!alertModal || !!error}
        onClose={() => {
          setAlertModal(null)
          setError(null)
        }}
        variant={alertModal?.type === 'success' ? 'success' : 'error'}
        title={alertModal?.title ?? 'Error'}
        message={alertModal?.message ?? error ?? ''}
      />
    </div>
  )
}
