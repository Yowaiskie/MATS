import React, { useState, useEffect } from 'react'
import { publicationService } from '@/services/publicationService'
import { recurringService } from '@/services/recurringService'
import { scheduleService } from '@/services/scheduleService'
import { memberService } from '@/services/memberService'
import { isScheduleIncludedInPublication, isMemberEligibleForPublication } from '@/utils/scheduleUtils'
import type { SchedulePublication, SchedulePublicationInput } from '@/types/publication'
import { AlertModal, ConfirmModal } from '@/components/Dialog'
import { ActionMenu } from '@/components'
import { PublicationFormModal } from './PublicationFormModal'
import { ManageSubmissionsModal } from './ManageSubmissionsModal'
import { SchedulePdfExportModal } from './SchedulePdfExportModal'

export interface PublicationMemberStats {
  scheduled: number
  total: number
}

export const PublicationsTab: React.FC = () => {
  const [publications, setPublications] = useState<SchedulePublication[]>([])
  const [pubStatsById, setPubStatsById] = useState<Record<string, PublicationMemberStats>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [formOpen, setFormOpen] = useState(false)
  const [selectedPublication, setSelectedPublication] = useState<SchedulePublication | null>(null)
  const [exportPdfPub, setExportPdfPub] = useState<SchedulePublication | null>(null)
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
      const [data, allMembers] = await Promise.all([
        publicationService.getPublications(),
        memberService.getMembers()
      ])
      setPublications(data)

      // Compute actual scheduled and eligible members count per publication
      const statsMap: Record<string, PublicationMemberStats> = {}
      await Promise.all(
        data.map(async pub => {
          try {
            const eligibleMembers = allMembers.filter(m => isMemberEligibleForPublication(m, pub))
            const eligibleIdSet = new Set(eligibleMembers.map(m => m.id))

            const schedList = await scheduleService.getSchedulesByDateRange(pub.startDate, pub.endDate)
            const validScheds = schedList.filter(s => isScheduleIncludedInPublication(s, pub))
            
            const assignedIds = new Set<string>()
            validScheds.forEach(s => {
              s.assignedMembers?.forEach(id => {
                if (eligibleIdSet.has(id)) assignedIds.add(id)
              })
            })
            pub.submittedMembers?.forEach(id => {
              if (eligibleIdSet.has(id)) assignedIds.add(id)
            })

            statsMap[pub.id] = {
              scheduled: assignedIds.size,
              total: eligibleMembers.length
            }
          } catch {
            const eligibleMembers = allMembers.filter(m => isMemberEligibleForPublication(m, pub))
            statsMap[pub.id] = {
              scheduled: pub.submittedMembers?.length || 0,
              total: eligibleMembers.length
            }
          }
        })
      )
      setPubStatsById(statsMap)
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Publications</h2>
          <p className="text-xs text-gray-500">Manage batched schedules for public access.</p>
        </div>
        <button
          onClick={() => {
            setSelectedPublication(null)
            setFormOpen(true)
          }}
          className="w-full sm:w-auto inline-flex items-center justify-center rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-colors"
        >
          + Create Publication
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-gray-200 shadow-sm">
          <p className="text-[10px] uppercase font-bold text-gray-400">Total</p>
          <p className="text-xl sm:text-2xl font-black text-gray-900">{stats.total}</p>
        </div>
        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-gray-200 shadow-sm">
          <p className="text-[10px] uppercase font-bold text-green-500">Published</p>
          <p className="text-xl sm:text-2xl font-black text-gray-900">{stats.active}</p>
        </div>
        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-gray-200 shadow-sm">
          <p className="text-[10px] uppercase font-bold text-amber-500">Draft</p>
          <p className="text-xl sm:text-2xl font-black text-gray-900">{stats.draft}</p>
        </div>
        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-gray-200 shadow-sm">
          <p className="text-[10px] uppercase font-bold text-gray-400">Archived</p>
          <p className="text-xl sm:text-2xl font-black text-gray-900">{stats.archived}</p>
        </div>
      </div>

      {/* Mobile Card List View (< md) */}
      <div className="md:hidden space-y-3">
        {publications.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-xs text-gray-500">
            No publications found.
          </div>
        ) : (
          publications.map(pub => (
            <div key={pub.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-bold text-sm text-gray-900">{pub.name}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {pub.startDate} to {pub.endDate}
                  </p>
                  {pub.submissionDeadline && (
                    <p className="text-[11px] font-bold mt-1 text-purple-700 flex items-center gap-1">
                      <span>⏰ Deadline:</span>
                      <span>{new Date(pub.submissionDeadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                      {new Date() > new Date(pub.submissionDeadline) && (
                        <span className="text-[9px] font-black bg-rose-100 text-rose-800 px-1.5 py-0.2 rounded">Passed</span>
                      )}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-black uppercase shrink-0 ${
                    pub.status === 'published' ? 'bg-green-100 text-green-700' :
                    pub.status === 'archived' ? 'bg-gray-100 text-gray-600' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {pub.status}
                  </span>
                  {(() => {
                    const stats = pubStatsById[pub.id]
                    if (stats && stats.total > 0) {
                      return (
                        <span className="text-[10px] font-extrabold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full">
                          {stats.scheduled} / {stats.total} Scheduled
                        </span>
                      )
                    }
                    return (
                      <span className="text-[10px] font-extrabold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full">
                        {pub.submittedMembers?.length || 0} Scheduled
                      </span>
                    )
                  })()}
                </div>
              </div>

              {/* Actions Grid */}
              <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <a
                    href={`/public/schedule/${pub.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200 rounded-xl transition-all shadow-2xs"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                    <span>Preview</span>
                  </a>
                  <button
                    onClick={() => handleCopyLink(pub.id)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-blue-50 hover:text-blue-700 border border-slate-200 rounded-xl transition-all shadow-2xs cursor-pointer"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                    </svg>
                    <span>Copy</span>
                  </button>
                </div>

                <ActionMenu
                  triggerVariant="meatball"
                  tooltip="Publication Options"
                  menuWidth="w-56"
                  groups={[
                    {
                      title: 'Access & Export',
                      items: [
                        {
                          label: 'Copy Public Link',
                          icon: (
                            <svg className="w-3.5 h-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                              <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                            </svg>
                          ),
                          onClick: () => handleCopyLink(pub.id)
                        },
                        {
                          label: 'Preview Public Portal',
                          href: `/public/schedule/${pub.id}`,
                          target: '_blank',
                          icon: (
                            <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
                              <circle cx="12" cy="12" r="3"/>
                            </svg>
                          )
                        },
                        {
                          label: 'Export Schedule PDF',
                          icon: (
                            <svg className="w-3.5 h-3.5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                              <polyline points="14 2 14 8 20 8"/>
                              <line x1="16" y1="13" x2="8" y2="13"/>
                              <line x1="16" y1="17" x2="8" y2="17"/>
                            </svg>
                          ),
                          onClick: () => setExportPdfPub(pub)
                        }
                      ]
                    },
                    {
                      title: 'Workflow & Submissions',
                      items: [
                        ...(pub.status === 'draft' ? [{
                          label: 'Publish (Open Scheduling)',
                          variant: 'success' as const,
                          icon: (
                            <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <polygon points="5 3 19 12 5 21 5 3"/>
                            </svg>
                          ),
                          onClick: () => handlePublish(pub)
                        }] : []),
                        ...(pub.status === 'published' ? [{
                          label: 'Finalize & Lock Schedules',
                          variant: 'warning' as const,
                          icon: (
                            <svg className="w-3.5 h-3.5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
                              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                            </svg>
                          ),
                          onClick: () => setConfirmStatusAction({
                            pub,
                            targetStatus: 'archived',
                            isLocked: true,
                            title: 'Finalize & Lock Schedules',
                            message: `Are you sure you want to finalize "${pub.name}"? This will lock all schedules in its date range (${pub.startDate} to ${pub.endDate}) and prevent members from submitting or changing their schedules via the public link.`,
                            confirmLabel: 'Finalize & Lock'
                          })
                        }] : []),
                        ...(pub.status === 'archived' ? [{
                          label: 'Unfinalize & Unlock Schedules',
                          variant: 'primary' as const,
                          icon: (
                            <svg className="w-3.5 h-3.5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
                              <path d="M7 11V7a5 5 0 0 1 9.9-1"/>
                              <path d="M10.5 7h4v4"/>
                            </svg>
                          ),
                          onClick: () => setConfirmStatusAction({
                            pub,
                            targetStatus: 'published',
                            isLocked: false,
                            title: 'Unfinalize & Unlock Schedules',
                            message: `Are you sure you want to unfinalize "${pub.name}"? This will unlock all schedules in its date range and re-open the public link so members can submit again.`,
                            confirmLabel: 'Unfinalize & Unlock'
                          })
                        }] : []),
                        {
                          label: 'Manage Submissions / Auto-Assign',
                          icon: (
                            <svg className="w-3.5 h-3.5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                              <circle cx="9" cy="7" r="4"/>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M22 21v-2a4 4 0 0 0-3-3.87"/>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16 3.13a4 4 0 0 1 0 7.75"/>
                            </svg>
                          ),
                          onClick: () => setManageSubmissionsPub(pub)
                        }
                      ]
                    },
                    {
                      title: 'Management',
                      items: [
                        {
                          label: 'Edit Publication',
                          icon: (
                            <svg className="w-3.5 h-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                            </svg>
                          ),
                          onClick: () => {
                            setSelectedPublication(pub)
                            setFormOpen(true)
                          }
                        },
                        {
                          label: 'Delete Publication',
                          variant: 'danger' as const,
                          icon: (
                            <svg className="w-3.5 h-3.5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18"/>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                            </svg>
                          ),
                          onClick: () => handleDelete(pub.id)
                        }
                      ]
                    }
                  ]}
                />
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop Table View (hidden on mobile, visible on md+) */}
      <div className="hidden md:block bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-6 py-4 text-[10px] font-extrabold uppercase text-gray-500">Name & Deadline</th>
                <th className="px-6 py-4 text-[10px] font-extrabold uppercase text-gray-500">Date Range</th>
                <th className="px-6 py-4 text-[10px] font-extrabold uppercase text-gray-500">Submissions</th>
                <th className="px-6 py-4 text-[10px] font-extrabold uppercase text-gray-500">Status</th>
                <th className="px-6 py-4 text-[10px] font-extrabold uppercase text-gray-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {publications.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-xs text-gray-500">
                    No publications found.
                  </td>
                </tr>
              ) : (
                publications.map(pub => (
                  <tr key={pub.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-900">{pub.name}</div>
                      {pub.submissionDeadline ? (
                        <div className="text-[11px] font-bold text-purple-700 mt-0.5 flex items-center gap-1.5">
                          <span>Deadline: {new Date(pub.submissionDeadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                          {new Date() > new Date(pub.submissionDeadline) && (
                            <span className="text-[9px] font-black bg-rose-100 text-rose-800 px-1.5 py-0.2 rounded">Passed</span>
                          )}
                        </div>
                      ) : (
                        <div className="text-[11px] text-gray-400 font-medium mt-0.5">No deadline configured</div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-500 font-medium">
                      {pub.startDate} to {pub.endDate}
                    </td>
                    <td className="px-6 py-4">
                      {(() => {
                        const stats = pubStatsById[pub.id]
                        if (stats && stats.total > 0) {
                          const pct = Math.round((stats.scheduled / stats.total) * 100)
                          return (
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-800 border border-purple-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-purple-600" />
                                {stats.scheduled} / {stats.total} Scheduled
                              </span>
                              <span className="text-[11px] font-bold text-slate-500">
                                ({pct}%)
                              </span>
                            </div>
                          )
                        }
                        return (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-800 border border-purple-200">
                            {pub.submittedMembers?.length || 0} Scheduled
                          </span>
                        )
                      })()}
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
                      <div className="flex justify-end items-center gap-2">
                        <a
                          href={`/public/schedule/${pub.id}`}
                          target="_blank"
                          rel="noreferrer"
                          title="Preview Public Portal"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200 rounded-xl transition-all shadow-2xs"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                          <span>Preview</span>
                        </a>

                        <ActionMenu
                          triggerVariant="meatball"
                          tooltip="Publication Options"
                          menuWidth="w-56"
                          groups={[
                            {
                              title: 'Access & Export',
                              items: [
                                {
                                  label: 'Copy Public Link',
                                  icon: (
                                    <svg className="w-3.5 h-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                                      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                                    </svg>
                                  ),
                                  onClick: () => handleCopyLink(pub.id)
                                },
                                {
                                  label: 'Export Schedule PDF',
                                  icon: (
                                    <svg className="w-3.5 h-3.5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                      <polyline points="14 2 14 8 20 8"/>
                                      <line x1="16" y1="13" x2="8" y2="13"/>
                                      <line x1="16" y1="17" x2="8" y2="17"/>
                                    </svg>
                                  ),
                                  onClick: () => setExportPdfPub(pub)
                                }
                              ]
                            },
                            {
                              title: 'Workflow & Submissions',
                              items: [
                                ...(pub.status === 'draft' ? [{
                                  label: 'Publish (Open Scheduling)',
                                  variant: 'success' as const,
                                  icon: (
                                    <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <polygon points="5 3 19 12 5 21 5 3"/>
                                    </svg>
                                  ),
                                  onClick: () => handlePublish(pub)
                                }] : []),
                                ...(pub.status === 'published' ? [{
                                  label: 'Finalize & Lock Schedules',
                                  variant: 'warning' as const,
                                  icon: (
                                    <svg className="w-3.5 h-3.5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
                                      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                                    </svg>
                                  ),
                                  onClick: () => setConfirmStatusAction({
                                    pub,
                                    targetStatus: 'archived',
                                    isLocked: true,
                                    title: 'Finalize & Lock Schedules',
                                    message: `Are you sure you want to finalize "${pub.name}"? This will lock all schedules in its date range (${pub.startDate} to ${pub.endDate}) and prevent members from submitting or changing their schedules via the public link.`,
                                    confirmLabel: 'Finalize & Lock'
                                  })
                                }] : []),
                                ...(pub.status === 'archived' ? [{
                                  label: 'Unfinalize & Unlock Schedules',
                                  variant: 'primary' as const,
                                  icon: (
                                    <svg className="w-3.5 h-3.5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
                                      <path d="M7 11V7a5 5 0 0 1 9.9-1"/>
                                      <path d="M10.5 7h4v4"/>
                                    </svg>
                                  ),
                                  onClick: () => setConfirmStatusAction({
                                    pub,
                                    targetStatus: 'published',
                                    isLocked: false,
                                    title: 'Unfinalize & Unlock Schedules',
                                    message: `Are you sure you want to unfinalize "${pub.name}"? This will unlock all schedules in its date range and re-open the public link so members can submit again.`,
                                    confirmLabel: 'Unfinalize & Unlock'
                                  })
                                }] : []),
                                {
                                  label: 'Manage Submissions / Auto-Assign',
                                  icon: (
                                    <svg className="w-3.5 h-3.5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                                      <circle cx="9" cy="7" r="4"/>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M22 21v-2a4 4 0 0 0-3-3.87"/>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 3.13a4 4 0 0 1 0 7.75"/>
                                    </svg>
                                  ),
                                  onClick: () => setManageSubmissionsPub(pub)
                                }
                              ]
                            },
                            {
                              title: 'Management',
                              items: [
                                {
                                  label: 'Edit Publication Details',
                                  icon: (
                                    <svg className="w-3.5 h-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                                    </svg>
                                  ),
                                  onClick: () => {
                                    setSelectedPublication(pub)
                                    setFormOpen(true)
                                  }
                                },
                                {
                                  label: 'Delete Publication',
                                  variant: 'danger' as const,
                                  icon: (
                                    <svg className="w-3.5 h-3.5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18"/>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                                    </svg>
                                  ),
                                  onClick: () => handleDelete(pub.id)
                                }
                              ]
                            }
                          ]}
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
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

      <SchedulePdfExportModal
        isOpen={!!exportPdfPub}
        onClose={() => setExportPdfPub(null)}
        publication={exportPdfPub}
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
