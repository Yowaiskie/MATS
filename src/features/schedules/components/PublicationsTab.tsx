import React, { useState, useEffect, useMemo } from 'react'
import { publicationService } from '@/services/publicationService'
import { recurringService } from '@/services/recurringService'
import { scheduleService } from '@/services/scheduleService'
import { memberService } from '@/services/memberService'
import { submissionService } from '@/services/submissionService'
import { isMemberEligibleForPublication, isPublicationDeadlinePassed, isHistoricalScheduleOccurrence } from '@/utils/scheduleUtils'
import { getOccurrenceContext } from '@/utils/scheduleIntegrity'
import type { SchedulePublication, SchedulePublicationInput } from '@/types/publication'
import type { CycleConflictItem } from '@/types/submission'
import { ConfirmModal } from '@/components/Dialog'
import { ActionMenu, Pagination } from '@/components'
import { PublicationFormModal, type CustomEventSlotInput } from './PublicationFormModal'
import { ManageSubmissionsModal } from './ManageSubmissionsModal'
import { SchedulePdfExportModal } from './SchedulePdfExportModal'
import { DuplicateScheduleReportModal } from './DuplicateScheduleReportModal'
import { useToast } from '@/context/ToastContext'
import { useAuth } from '@/features/authentication/AuthContext'

const PAGE_SIZE = 8

export interface PublicationMemberStats {
  scheduled: number
  total: number
}

export const PublicationsTab: React.FC = () => {
  const { toast } = useToast()
  const { user, profile } = useAuth()
  const [publications, setPublications] = useState<SchedulePublication[]>([])
  const [pubStatsById, setPubStatsById] = useState<Record<string, PublicationMemberStats>>({})
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)

  const [formOpen, setFormOpen] = useState(false)
  const [duplicateReportOpen, setDuplicateReportOpen] = useState(false)
  const [selectedPublication, setSelectedPublication] = useState<SchedulePublication | null>(null)
  const [exportPdfPub, setExportPdfPub] = useState<SchedulePublication | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [confirmCloseSubmissionsPub, setConfirmCloseSubmissionsPub] = useState<SchedulePublication | null>(null)
  const [cycleFinalizePub, setCycleFinalizePub] = useState<SchedulePublication | null>(null)
  const [cycleConflicts, setCycleConflicts] = useState<CycleConflictItem[] | null>(null)
  const [isFinalizingCycle, setIsFinalizingCycle] = useState(false)
  const [confirmStatusAction, setConfirmStatusAction] = useState<{
    pub: SchedulePublication;
    targetStatus: 'draft' | 'published' | 'archived';
    isLocked?: boolean;
    title: string;
    message: string;
    confirmLabel: string;
  } | null>(null)
  const [manageSubmissionsPub, setManageSubmissionsPub] = useState<SchedulePublication | null>(null)

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

            const validScheds = await scheduleService.getSchedulesForPublication(pub)
            
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
      toast.error('Error', 'Failed to load publications.')
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
    toast.success('Link Copied', 'Public link copied to clipboard!')
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
      toast.success('Deleted', 'Publication has been deleted.')
    } catch (err: any) {
      console.error(err)
      toast.error('Publication Preserved', err.message || 'Unable to verify this publication is empty. Archive it instead.')
    }
  }

  const handlePublish = async (pub: SchedulePublication) => {
    try {
      await publicationService.updatePublication(pub.id, { status: 'published' })
      await scheduleService.bulkLockSchedules(pub.startDate, pub.endDate, false, 'System', pub)
      await loadData()
      toast.success('Published', 'Publication is now open for scheduling.')
    } catch (err: any) {
      console.error(err)
      toast.error('Error', 'Failed to update status.')
    }
  }

  const handleExtendDeadline = async (pub: SchedulePublication, days = 3) => {
    try {
      const targetDate = new Date()
      targetDate.setDate(targetDate.getDate() + days)
      targetDate.setHours(23, 59, 0, 0)
      const newDeadlineIso = new Date(targetDate.getTime() - targetDate.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
      
      await publicationService.updatePublication(pub.id, {
        submissionDeadline: newDeadlineIso,
        status: 'published'
      })
      await scheduleService.bulkLockSchedules(pub.startDate, pub.endDate, false, 'System', pub)
      await loadData()
      toast.success('Deadline Extended', `Publication deadline extended by ${days} days and reopened for scheduling.`)
    } catch (err: any) {
      console.error(err)
      toast.error('Error', 'Failed to extend deadline.')
    }
  }

  const handleClearDeadline = async (pub: SchedulePublication) => {
    try {
      await publicationService.updatePublication(pub.id, {
        submissionDeadline: '',
        status: 'published'
      })
      await scheduleService.bulkLockSchedules(pub.startDate, pub.endDate, false, 'System', pub)
      await loadData()
      toast.success('Deadline Removed', 'Deadline cleared and publication kept open for scheduling.')
    } catch (err: any) {
      console.error(err)
      toast.error('Error', 'Failed to remove deadline.')
    }
  }

  const handleCloseSubmissionsConfirmed = async () => {
    if (!confirmCloseSubmissionsPub) return
    const pub = confirmCloseSubmissionsPub
    setConfirmCloseSubmissionsPub(null)
    setLoading(true)
    try {
      await publicationService.closeSubmissionsEarly(pub.id, user?.email || 'Admin')
      await loadData()
      toast.success('Submissions Closed', `Submissions for "${pub.name}" are now closed. No new selections will be accepted.`)
    } catch (err: any) {
      console.error(err)
      toast.error('Error', err.message || 'Failed to close submissions.')
      setLoading(false)
    }
  }

  const handleExecuteCycleFinalize = async () => {
    if (!cycleFinalizePub) return
    setIsFinalizingCycle(true)
    setCycleConflicts(null)

    try {
      const result = await submissionService.finalizePublicationCycle(cycleFinalizePub.id, {
        adminUser: {
          email: user?.email || '',
          uid: user?.uid || 'admin',
          role: profile?.role || 'admin',
          permissions: {
            canManageSchedules: true
          }
        }
      })

      setCycleFinalizePub(null)
      toast.success(
        'Cycle Finalized & Approved',
        `Approved ${result.approvedSubmissionsCount} submission(s) and committed assignments across ${result.updatedSchedulesCount} future schedule(s).`
      )
      await loadData()
    } catch (err: any) {
      console.error('Cycle finalization failed:', err)
      if (err.details?.conflicts) {
        setCycleConflicts(err.details.conflicts)
      } else {
        toast.error('Finalization Failed', err.message || 'Failed to finalize scheduling cycle.')
      }
    } finally {
      setIsFinalizingCycle(false)
    }
  }

  const handleStatusChange = async (pub: SchedulePublication, newStatus: 'draft' | 'published' | 'archived') => {
    if (pub.status === newStatus) return

    if (newStatus === 'archived') {
      setConfirmStatusAction({
        pub,
        targetStatus: 'archived',
        isLocked: true,
        title: 'Archive Publication (Lock History)',
        message: `Archiving "${pub.name}" will lock all underlying schedules in its date range (${pub.startDate} to ${pub.endDate}) for historical preservation and prevent members from making further selections. Are you sure you want to proceed?`,
        confirmLabel: 'Yes, Archive & Lock'
      })
      return
    }

    if (pub.status === 'archived' && newStatus === 'published') {
      setConfirmStatusAction({
        pub,
        targetStatus: 'published',
        isLocked: false,
        title: 'Unarchive & Re-Open Publication',
        message: `Unarchiving "${pub.name}" will unlock all schedules in its date range (${pub.startDate} to ${pub.endDate}) and reopen the public link for member sign-ups. Are you sure you want to proceed?`,
        confirmLabel: 'Yes, Unlock & Publish'
      })
      return
    }

    try {
      await publicationService.updatePublication(pub.id, { status: newStatus })
      if (newStatus === 'published') {
        await scheduleService.bulkLockSchedules(pub.startDate, pub.endDate, false, 'System', pub)
      }
      await loadData()
      toast.success('Status Updated', `Publication status changed to ${newStatus.toUpperCase()}.`)
    } catch (err: any) {
      console.error(err)
      toast.error('Error', 'Failed to update publication status.')
    }
  }

  const handleStatusActionConfirmed = async () => {
    if (!confirmStatusAction) return
    const { pub, targetStatus, isLocked } = confirmStatusAction
    setConfirmStatusAction(null)
    setLoading(true)
    try {
      let lockedCount = 0
      // Validate reactivation before any unlock; a rejected overlap must leave
      // the archived publication's schedule locks untouched.
      if (isLocked === false) await publicationService.updatePublication(pub.id, { status: targetStatus })
      if (isLocked !== undefined) {
        lockedCount = await scheduleService.bulkLockSchedules(pub.startDate, pub.endDate, isLocked, 'System', pub)
      }
      if (isLocked !== false) await publicationService.updatePublication(pub.id, { status: targetStatus })
      await loadData()
      toast.success(
        targetStatus === 'archived' ? 'Publication Finalized' : 'Publication Updated',
        isLocked !== undefined
          ? `Successfully ${isLocked ? 'locked' : 'unlocked'} ${lockedCount} schedule(s) for the month and set publication to ${targetStatus}.`
          : `Publication status set to ${targetStatus}.`
      )
    } catch (err: any) {
      console.error(err)
      toast.error('Error', err.message || 'Failed to update publication.')
      setLoading(false)
    }
  }

  const handleSave = async (
    input: SchedulePublicationInput,
    generateSchedules: boolean,
    selectedTemplateIds?: string[],
    customEventSlots?: CustomEventSlotInput[]
  ) => {
    let pubId = selectedPublication?.id
    if (selectedPublication) {
      await publicationService.updatePublication(selectedPublication.id, input)
    } else {
      pubId = await publicationService.addPublication(input)
    }

    // Saving settings or retrying generation must not unlock existing schedules.
    // Unlocking remains an explicit publication lifecycle action.
    
    // 1. If custom event / street mass slots are provided to generate, update, or remove
    if (customEventSlots !== undefined && (input.publicationType === 'special_event' || input.enableStreetLocation || (input.includedDaysOfWeek && input.includedDaysOfWeek.length > 0) || customEventSlots.length > 0)) {
      try {
        const { schedules: existingSchedules } = await scheduleService.prepareGeneration(input.startDate, input.endDate, pubId)
        let createdCount = 0
        let updatedCount = 0
        let retainedCount = 0

        for (const slot of customEventSlots) {
          const slotInput = {
            ...slot, publicationId: pubId, title: slot.title || input.name || 'Special Mass',
            category: input.publicationType === 'special_event' ? 'special_event' as const : undefined
          }
          const existing = existingSchedules.find(schedule => slot.scheduleId
            ? schedule.id === slot.scheduleId
            : schedule.publicationId === pubId && getOccurrenceContext(schedule) === getOccurrenceContext(slotInput))

          if (slot.scheduleId && !existing) throw new Error('A selected schedule is outside this range or no longer exists. Reload before saving.')

          if (existing) {
            if (existing.publicationId !== pubId) throw new Error(`Schedule ${existing.id} requires an ownership review. No record was reassigned.`)
            if (existing.isLocked || existing.status === 'completed' || isHistoricalScheduleOccurrence(existing)) {
              // Saving publication settings must not rewrite historical occurrences.
              retainedCount++
              continue
            }
            // Update existing schedule location and details
            const updated = await scheduleService.updatePublicationSchedule(pubId!, existing.id, {
              title: slot.title || input.name || existing.title,
              date: slot.date || existing.date,
              startTime: slot.startTime || existing.startTime,
              endTime: slot.endTime || existing.endTime,
              location: slot.location !== undefined ? slot.location.trim() : (existing.location || ''),
              liturgicalColor: slot.liturgicalColor || input.liturgicalColor || '',
              category: input.publicationType === 'special_event' ? 'special_event' : existing.category
            })
            if (updated) updatedCount++
            else retainedCount++
          } else {
            // Add new schedule only if it doesn't already exist
            const legacyMatch = existingSchedules.find(schedule => !schedule.publicationId && getOccurrenceContext(schedule) === getOccurrenceContext(slotInput))
            if (legacyMatch) throw new Error(`Legacy schedule ${legacyMatch.id} needs an ownership review. No record was reassigned.`)
            const saved = await scheduleService.createGeneratedSchedule({
              publicationId: pubId,
              title: slot.title || input.name || 'Special Mass',
              date: slot.date,
              startTime: slot.startTime || '18:00',
              endTime: slot.endTime || '19:00',
              location: slot.location ? slot.location.trim() : '',
              liturgicalColor: slot.liturgicalColor || input.liturgicalColor || '',
              category: input.publicationType === 'special_event' ? 'special_event' : undefined,
              status: 'upcoming',
              assignedMembers: []
            })
            if (saved.created) createdCount++
          }
        }

        // Removing a slot from this form never deletes persisted schedules/history.

        let msg = 'Publication saved successfully.'
        if (createdCount > 0 || updatedCount > 0 || retainedCount > 0) {
          const parts: string[] = []
          if (createdCount > 0) parts.push(`generated ${createdCount} new slot(s)`)
          if (updatedCount > 0) parts.push(`updated ${updatedCount} slot(s)`)
          if (retainedCount > 0) parts.push(`retained ${retainedCount} slot(s) without changes`)
          msg = `Saved! ${parts.join(', ')}.`
        }

        toast.success(
          selectedPublication ? 'Publication Updated' : 'Publication Created', 
          msg
        )
      } catch (err: any) {
        console.error(err)
        toast.error('Warning', `Publication saved, but some schedule slots failed to process: ${err.message}`)
      }
      await loadData()
      return
    }

    // 2. Regular template-based generation
    if (generateSchedules && selectedTemplateIds && pubId) {
      try {
        const activeTemplates = (await recurringService.getTemplates())
          .filter(t => t.active && selectedTemplateIds.includes(t.id))
          
        if (activeTemplates.length > 0) {
          const report = await recurringService.generateSchedules(
            input.startDate,
            input.endDate,
            activeTemplates,
            { publicationId: pubId }
          )
          toast.success(
            selectedPublication ? 'Publication Updated' : 'Publication Created',
            `Generated ${report.created} schedule(s) from templates. (Skipped: ${report.skipped}, Duplicates: ${report.duplicates})`
          )
          if (report.validationErrors.length > 0) toast.error('Schedules Need Review', report.validationErrors.join('\n'))
        } else {
          toast.success('Publication Saved', 'No active templates were found to generate schedules.')
        }
      } catch (err: any) {
        console.error(err)
        toast.error('Warning', `Publication saved, but failed to generate schedules: ${err.message}`)
      }
      await loadData()
      return
    }

    await loadData()
    toast.success('Success', 'Publication saved successfully.')
  }

  const totalPages = Math.ceil(publications.length / PAGE_SIZE)
  const paginatedPublications = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return publications.slice(start, start + PAGE_SIZE)
  }, [publications, currentPage])

  useEffect(() => {
    if (currentPage > 1 && currentPage > Math.ceil(publications.length / PAGE_SIZE)) {
      setCurrentPage(Math.max(1, Math.ceil(publications.length / PAGE_SIZE)))
    }
  }, [publications.length, currentPage])

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
          <button type="button" onClick={() => setDuplicateReportOpen(true)} className="mt-2 text-xs font-bold text-indigo-700 hover:underline">Review duplicate schedules</button>
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
          <div className="flex items-center justify-between gap-1">
            <p className="text-[10px] uppercase font-bold text-emerald-600">Published</p>
            {publications.some(p => p.status === 'published' && isPublicationDeadlinePassed(p)) && (
              <span className="text-[8px] font-black uppercase text-rose-700 bg-rose-50 border border-rose-200 px-1 py-0.2 rounded">
                Deadline Passed
              </span>
            )}
          </div>
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
          <>
            {paginatedPublications.map(pub => (
            <div key={pub.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="font-bold text-sm text-gray-900">{pub.name}</h3>
                    {pub.publicationType === 'special_event' && (
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-200">
                        Special Occasion
                      </span>
                    )}
                    {pub.includedDaysOfWeek && pub.includedDaysOfWeek.length > 0 && (
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 border border-indigo-200">
                        Every {pub.includedDaysOfWeek.join(', ')}
                      </span>
                    )}
                    {pub.enableStreetLocation && (
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                        <svg className="w-2.5 h-2.5 text-amber-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Street / Venue
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {pub.startDate} to {pub.endDate}
                  </p>
                  {pub.submissionDeadline && (
                    <p className="text-[11px] font-bold mt-1 text-purple-700 flex items-center gap-1">
                      <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Deadline: {new Date(pub.submissionDeadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                      {isPublicationDeadlinePassed(pub) && (
                        <span className="text-[9px] font-black bg-rose-100 text-rose-800 px-1.5 py-0.2 rounded">Passed</span>
                      )}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className="relative inline-flex items-center">
                    <select
                      value={pub.status}
                      onChange={(e) => handleStatusChange(pub, e.target.value as 'draft' | 'published' | 'archived')}
                      className={`appearance-none font-black text-[10px] uppercase tracking-wider pl-2.5 pr-6 py-1 rounded-lg border cursor-pointer transition-all shadow-2xs focus:outline-none focus:ring-2 ${
                        pub.status === 'published'
                          ? isPublicationDeadlinePassed(pub)
                            ? 'bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100 hover:border-rose-400 focus:ring-rose-400'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100 hover:border-emerald-400 focus:ring-emerald-400'
                          : pub.status === 'archived'
                          ? 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200 hover:border-slate-400 focus:ring-slate-400'
                          : 'bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100 hover:border-amber-400 focus:ring-amber-400'
                      }`}
                      title="Quick change publication status"
                    >
                      <option value="draft" className="bg-white text-amber-800 font-bold">DRAFT</option>
                      <option value="published" className="bg-white text-emerald-800 font-bold">PUBLISHED</option>
                      <option value="archived" className="bg-white text-slate-800 font-bold">ARCHIVED</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-1.5 text-current opacity-70">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>

                  {pub.status === 'published' && (
                    isPublicationDeadlinePassed(pub) ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-rose-100 text-rose-800 border border-rose-200 shadow-2xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                        Closed (Deadline Passed)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Open for Sign-ups
                      </span>
                    )
                  )}
                  {pub.isCycleFinalized && (
                    <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded shadow-2xs">
                      <svg className="w-2.5 h-2.5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      Cycle Finalized
                    </span>
                  )}
                  {pub.status === 'draft' && (
                    <span className="text-[9px] font-bold text-amber-700">
                      Draft (Hidden)
                    </span>
                  )}
                  {pub.status === 'archived' && (
                    <span className="text-[9px] font-bold text-slate-500">
                      Archived (Locked)
                    </span>
                  )}

                  {(() => {
                    const stats = pubStatsById[pub.id]
                    if (stats && stats.total > 0) {
                      return (
                        <span className="text-[10px] font-extrabold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full mt-0.5">
                          {stats.scheduled} / {stats.total} Scheduled
                        </span>
                      )
                    }
                    return (
                      <span className="text-[10px] font-extrabold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full mt-0.5">
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
                        ...(pub.status === 'published' && isPublicationDeadlinePassed(pub) ? [{
                          label: 'Extend Deadline (+3 Days)',
                          variant: 'success' as const,
                          icon: (
                            <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          ),
                          onClick: () => handleExtendDeadline(pub, 3)
                        }] : []),
                        ...(pub.status === 'published' && pub.submissionDeadline ? [{
                          label: 'Remove Deadline (Keep Open)',
                          variant: 'primary' as const,
                          icon: (
                            <svg className="w-3.5 h-3.5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          ),
                          onClick: () => handleClearDeadline(pub)
                        }] : []),
                        ...(pub.status === 'published' && !isPublicationDeadlinePassed(pub) ? [{
                          label: 'Close Submissions (Stop Intake)',
                          variant: 'warning' as const,
                          icon: (
                            <svg className="w-3.5 h-3.5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          ),
                          onClick: () => setConfirmCloseSubmissionsPub(pub)
                        }] : []),
                        ...(pub.status === 'published' ? [{
                          label: 'Apply to Official Schedules',
                          variant: 'success' as const,
                          icon: (
                            <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          ),
                          onClick: () => {
                            setCycleConflicts(null)
                            setCycleFinalizePub(pub)
                          }
                        }] : []),
                        ...(pub.status === 'published' ? [{
                          label: 'Archive Publication (Lock History)',
                          variant: 'warning' as const,
                          icon: (
                            <svg className="w-3.5 h-3.5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
                              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                            </svg>
                          ),
                          onClick: () => setConfirmStatusAction({
                            pub,
                            targetStatus: 'archived',
                            isLocked: true,
                            title: 'Archive Publication (Lock History)',
                            message: `Are you sure you want to archive "${pub.name}"? This will lock all schedules in its date range (${pub.startDate} to ${pub.endDate}) for historical preservation.`,
                            confirmLabel: 'Archive & Lock'
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
                          label: 'Delete Empty Draft',
                          disabled: pub.status !== 'draft',
                          title: 'Publications with schedules or history must be archived instead.',
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
          ))}
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={publications.length}
            pageSize={PAGE_SIZE}
            onPageChange={setCurrentPage}
            className="bg-white rounded-xl border border-gray-200"
          />
        </>
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
                paginatedPublications.map(pub => (
                  <tr key={pub.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-gray-900">{pub.name}</span>
                        {pub.publicationType === 'special_event' && (
                          <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-200">
                            Special Occasion
                          </span>
                        )}
                      </div>
                      {pub.submissionDeadline ? (
                        <div className="text-[11px] font-bold text-purple-700 mt-0.5 flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
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
                      <div className="flex flex-col items-start gap-1">
                        <div className="relative inline-flex items-center">
                          <select
                            value={pub.status}
                            onChange={(e) => handleStatusChange(pub, e.target.value as 'draft' | 'published' | 'archived')}
                            className={`appearance-none font-black text-[10px] uppercase tracking-wider pl-2.5 pr-6 py-1 rounded-lg border cursor-pointer transition-all shadow-2xs focus:outline-none focus:ring-2 ${
                              pub.status === 'published'
                                ? isPublicationDeadlinePassed(pub)
                                  ? 'bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100 hover:border-rose-400 focus:ring-rose-400'
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100 hover:border-emerald-400 focus:ring-emerald-400'
                                : pub.status === 'archived'
                                ? 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200 hover:border-slate-400 focus:ring-slate-400'
                                : 'bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100 hover:border-amber-400 focus:ring-amber-400'
                            }`}
                            title="Quick change publication status"
                          >
                            <option value="draft" className="bg-white text-amber-800 font-bold">DRAFT</option>
                            <option value="published" className="bg-white text-emerald-800 font-bold">PUBLISHED</option>
                            <option value="archived" className="bg-white text-slate-800 font-bold">ARCHIVED</option>
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-1.5 text-current opacity-70">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>

                        {pub.status === 'published' && (
                          isPublicationDeadlinePassed(pub) ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-rose-100 text-rose-800 border border-rose-200 shadow-2xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                              Closed (Deadline Passed)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-700">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              Open for Sign-ups
                            </span>
                          )
                        )}
                        {pub.status === 'draft' && (
                          <span className="text-[9px] font-bold text-amber-700">
                            Draft (Hidden)
                          </span>
                        )}
                        {pub.status === 'archived' && (
                          <span className="text-[9px] font-bold text-slate-500">
                            Finalized (Locked)
                          </span>
                        )}
                      </div>
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
                                ...(pub.status === 'published' && isPublicationDeadlinePassed(pub) ? [{
                                  label: 'Extend Deadline (+3 Days)',
                                  variant: 'success' as const,
                                  icon: (
                                    <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                  ),
                                  onClick: () => handleExtendDeadline(pub, 3)
                                }] : []),
                                ...(pub.status === 'published' && pub.submissionDeadline ? [{
                                  label: 'Remove Deadline (Keep Open)',
                                  variant: 'primary' as const,
                                  icon: (
                                    <svg className="w-3.5 h-3.5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  ),
                                  onClick: () => handleClearDeadline(pub)
                                }] : []),
                                ...(pub.status === 'published' && !isPublicationDeadlinePassed(pub) ? [{
                                  label: 'Close Submissions (Stop Intake)',
                                  variant: 'warning' as const,
                                  icon: (
                                    <svg className="w-3.5 h-3.5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                  ),
                                  onClick: () => setConfirmCloseSubmissionsPub(pub)
                                }] : []),
                                ...(pub.status === 'published' ? [{
                                  label: 'Apply to Official Schedules',
                                  variant: 'success' as const,
                                  icon: (
                                    <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                  ),
                                  onClick: () => {
                                    setCycleConflicts(null)
                                    setCycleFinalizePub(pub)
                                  }
                                }] : []),
                                ...(pub.status === 'published' ? [{
                                  label: 'Archive Publication (Lock History)',
                                  variant: 'warning' as const,
                                  icon: (
                                    <svg className="w-3.5 h-3.5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
                                      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                                    </svg>
                                  ),
                                  onClick: () => setConfirmStatusAction({
                                    pub,
                                    targetStatus: 'archived',
                                    isLocked: true,
                                    title: 'Archive Publication (Lock History)',
                                    message: `Are you sure you want to archive "${pub.name}"? This will lock all schedules in its date range (${pub.startDate} to ${pub.endDate}) for historical preservation.`,
                                    confirmLabel: 'Archive & Lock'
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
                                  label: 'Delete Empty Draft',
                                  disabled: pub.status !== 'draft',
                                  title: 'Publications with schedules or history must be archived instead.',
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
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={publications.length}
          pageSize={PAGE_SIZE}
          onPageChange={setCurrentPage}
        />
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
        message="Only an empty future draft can be deleted. Publications with schedules or history must be archived instead. No schedules will be deleted."
        confirmLabel="Delete"
      />

      {duplicateReportOpen && <DuplicateScheduleReportModal onClose={() => setDuplicateReportOpen(false)} />}

      <ConfirmModal
        isOpen={!!confirmCloseSubmissionsPub}
        onClose={() => setConfirmCloseSubmissionsPub(null)}
        onConfirm={handleCloseSubmissionsConfirmed}
        variant="warning"
        title="Close Submissions Early"
        message={`Stop accepting new selections for "${confirmCloseSubmissionsPub?.name}"? The public schedule link will be closed immediately. Official schedule assignments will not be modified.`}
        confirmLabel="Close Submissions"
      />

      <ConfirmModal
        isOpen={!!confirmStatusAction}
        onClose={() => setConfirmStatusAction(null)}
        onConfirm={handleStatusActionConfirmed}
        title={confirmStatusAction?.title || ''}
        message={confirmStatusAction?.message || ''}
        confirmLabel={confirmStatusAction?.confirmLabel || 'Confirm'}
      />

      {/* Confirmation & Conflict Dialog for Cycle Finalization */}
      {cycleFinalizePub && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 max-w-lg w-full shadow-2xl border border-slate-200 space-y-3 sm:space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center gap-3">
              <div className="p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-600 shrink-0">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-900">Apply to Official Schedules</h3>
                <p className="text-[10px] sm:text-xs font-semibold text-slate-500 mt-0.5">Commit Sign-ups to Mass Schedules</p>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs text-slate-700 space-y-2">
              <div className="flex justify-between items-center font-bold">
                <span className="text-slate-500">Publication:</span>
                <span className="text-slate-900">{cycleFinalizePub.name}</span>
              </div>
              <div className="flex justify-between items-center font-bold">
                <span className="text-slate-500">Date Range:</span>
                <span className="text-slate-900">{cycleFinalizePub.startDate} to {cycleFinalizePub.endDate}</span>
              </div>
            </div>

            <p className="text-[11px] text-slate-600 leading-relaxed">
              Applying will validate server capacities, slot positions, and date boundaries, then commit all sign-up selections directly to official Mass schedules. Past historical occurrences are strictly preserved.
            </p>

            {/* Conflict Alert Box if validation failed */}
            {cycleConflicts && cycleConflicts.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 space-y-2 animate-fade-in">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-rose-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span className="text-xs font-black">
                    Finalization Aborted: {cycleConflicts.length} Conflict(s) Detected
                  </span>
                </div>
                <p className="text-[10px] text-rose-700">
                  Zero changes were made. Please resolve the following conflicts before approving:
                </p>
                <div className="max-h-40 overflow-y-auto space-y-1.5 text-[11px] bg-white/80 p-2.5 rounded-xl border border-rose-100 divide-y divide-rose-100">
                  {cycleConflicts.map((c, i) => (
                    <div key={i} className="pt-1 first:pt-0">
                      <span className="font-bold text-rose-950">{c.memberName || 'Server'}: </span>
                      <span className="text-rose-800">{c.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setCycleFinalizePub(null)
                  setCycleConflicts(null)
                }}
                disabled={isFinalizingCycle}
                className="px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteCycleFinalize}
                disabled={isFinalizingCycle}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 sm:px-5 sm:py-2 text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-md shadow-indigo-600/25 active:scale-95 transition cursor-pointer"
              >
                <span>{isFinalizingCycle ? 'Applying to Schedules...' : 'Apply to Official Schedules'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

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
    </div>
  )
}
