import React, { useState, useEffect, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { scheduleService } from '@/services/scheduleService'
import { memberService } from '@/services/memberService'
import { ScheduleCard } from '../components/ScheduleCard'
import { ScheduleFormModal } from '../components/ScheduleFormModal'
import { AssignmentModal } from '../components/AssignmentModal'
import { CalendarView } from '../components/CalendarView'
import { ScheduleDetailsModal } from '../components/ScheduleDetailsModal'
import { TemplateManagerModal } from '../components/TemplateManagerModal'
import { PublicationsTab } from '../components/PublicationsTab'
import { BulkDeleteMonthModal } from '../components/BulkDeleteMonthModal'
import { SchedulePdfExportModal } from '../components/SchedulePdfExportModal'
import { AlertModal, ConfirmModal } from '@/components/Dialog'
import { Pagination } from '@/components/Pagination'
import { Loading } from '@/components/Loading'
import type { Schedule, ScheduleInput } from '@/types/schedule'
import type { Member } from '@/types/member'
import type { AttendanceSession, ScheduleAttendanceState } from '@/types/attendance'
import { attendanceService } from '@/services/attendanceService'
import { getScheduleStatus } from '@/utils/scheduleUtils'
import { useAuth } from '@/features/authentication/AuthContext'

const PAGE_SIZE = 12

const getTodayString = () => {
  const today = new Date()
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
}

const getThisWeekRange = (): { start: string; end: string } => {
  const now = new Date()
  const day = now.getDay()
  const diffToSun = now.getDate() - day
  const sun = new Date(now.getFullYear(), now.getMonth(), diffToSun)
  const sat = new Date(now.getFullYear(), now.getMonth(), diffToSun + 6)
  const formatD = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return { start: formatD(sun), end: formatD(sat) }
}

const getThisMonthRange = (): { start: string; end: string } => {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const lastDay = new Date(y, now.getMonth() + 1, 0).getDate()
  return { start: `${y}-${m}-01`, end: `${y}-${m}-${String(lastDay).padStart(2, '0')}` }
}

const getNext7DaysRange = (): { start: string; end: string } => {
  const now = new Date()
  const next7 = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 6)
  const formatD = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return { start: getTodayString(), end: formatD(next7) }
}

export const SchedulesPage: React.FC = () => {
  const queryClient = useQueryClient()
  const { profile, isAdmin, canAction } = useAuth()
  const canManage = isAdmin || canAction('canManageSchedules')
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [activeMembers, setActiveMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [activeTab, setActiveTab] = useState<'schedules' | 'publications'>('schedules')

  // Selected Month State for Scoped Firestore Reads
  const [selectedMonthDate, setSelectedMonthDate] = useState<Date>(() => new Date())

  // Filter states (Single Date vs Date Range)
  const [dateFilterMode, setDateFilterMode] = useState<'single' | 'range'>('single')
  const [dateFilter, setDateFilter] = useState(getTodayString())
  const [startDateFilter, setStartDateFilter] = useState('')
  const [endDateFilter, setEndDateFilter] = useState('')
  const [timeFilter, setTimeFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [attendanceSessions, setAttendanceSessions] = useState<AttendanceSession[]>([])

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)

  // Bulk select
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkSelectMode, setBulkSelectMode] = useState(false)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [bulkDeleteMonthOpen, setBulkDeleteMonthOpen] = useState(false)

  // Modals state
  const [formOpen, setFormOpen] = useState(false)
  const [assignmentOpen, setAssignmentOpen] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const [exportPdfOpen, setExportPdfOpen] = useState(false)
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null)
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list')
  const [allMembersProfiles, setAllMembersProfiles] = useState<Member[]>([])

  // Dialog state
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [alertModal, setAlertModal] = useState<{ title: string; message: string; variant?: 'success' | 'error' | 'warning' | 'info' } | null>(null)

  const loadData = async (showSpinner = true, targetMonthDate?: Date) => {
    if (showSpinner) setLoading(true)
    setError(null)
    try {
      let scheduleData: Schedule[] = []
      if (dateFilterMode === 'range' && startDateFilter && endDateFilter) {
        scheduleData = await scheduleService.getSchedulesByDateRange(startDateFilter, endDateFilter)
      } else {
        const monthDate = targetMonthDate || selectedMonthDate
        const y = monthDate.getFullYear()
        const m = String(monthDate.getMonth() + 1).padStart(2, '0')
        const startDate = `${y}-${m}-01`
        const endDate = `${y}-${m}-31`
        scheduleData = await scheduleService.getSchedulesByDateRange(startDate, endDate)
      }

      const [memberData, sessionsData] = await Promise.all([
        queryClient.fetchQuery({
          queryKey: ['members', 'all-with-archived'],
          queryFn: () => memberService.getMembers(true),
          staleTime: 1000 * 60 * 5 // 5-minute memory cache
        }),
        attendanceService.getAllSessions()
      ])

      setSchedules(scheduleData)
      setAllMembersProfiles(memberData)
      setActiveMembers(memberData.filter(m => m.status === 'active'))
      setAttendanceSessions(sessionsData)
    } catch (err: any) {
      console.error(err)
      setError('Failed to load schedule or member records.')
    } finally {
      if (showSpinner) setLoading(false)
    }
  }

  // Load data whenever selectedMonthDate or date range changes
  useEffect(() => {
    if (dateFilterMode === 'range' && startDateFilter && endDateFilter) {
      loadData(true)
    } else {
      loadData(true, selectedMonthDate)
    }
  }, [selectedMonthDate, dateFilterMode, startDateFilter, endDateFilter])

  const handleDateFilterChange = (newDateStr: string) => {
    setDateFilter(newDateStr)
    if (newDateStr) {
      const [yStr, mStr] = newDateStr.split('-')
      const y = parseInt(yStr, 10)
      const m = parseInt(mStr, 10)
      if (!isNaN(y) && !isNaN(m)) {
        if (selectedMonthDate.getFullYear() !== y || selectedMonthDate.getMonth() !== (m - 1)) {
          setSelectedMonthDate(new Date(y, m - 1, 1))
        }
      }
    }
  }

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [dateFilterMode, dateFilter, startDateFilter, endDateFilter, timeFilter, searchQuery])

  // Reset time filter when date filter changes
  useEffect(() => {
    setTimeFilter('')
  }, [dateFilterMode, dateFilter, startDateFilter, endDateFilter])

  // Clear selection when exiting bulk mode
  useEffect(() => {
    if (!bulkSelectMode) {
      setSelectedIds(new Set())
    }
  }, [bulkSelectMode])

  // Callbacks
  const handleAddOrEditSubmit = async (input: ScheduleInput) => {
    const actor = profile?.email || 'Admin'
    if (selectedSchedule) {
      await scheduleService.updateSchedule(selectedSchedule.id, input, actor)
    } else {
      await scheduleService.addSchedule(input, actor)
    }
    await loadData(false)
  }

  const handleDelete = (id: string) => {
    setConfirmDelete(id)
  }

  const handleDeleteConfirmed = async () => {
    if (!confirmDelete) return
    const id = confirmDelete
    setConfirmDelete(null)
    try {
      await scheduleService.deleteSchedule(id, profile?.email || 'Admin')
      await loadData(false)
    } catch (err: any) {
      console.error(err)
      setAlertModal({ title: 'Delete Failed', message: err.message || 'Failed to delete schedule.' })
    }
  }

  const handleSaveAssignments = async (scheduleId: string, assignedIds: string[], applyToMonth: boolean) => {
    const actor = profile?.email || 'Admin'
    if (applyToMonth) {
      const sourceSchedule = schedules.find(s => s.id === scheduleId)
      if (sourceSchedule) {
        // e.g. "2026-08-05" -> targetMonth is "2026-08"
        const targetMonth = sourceSchedule.date.substring(0, 7)
        // Find all schedules in the same month with the same title and start time
        const matchingSchedules = schedules.filter(s => 
          s.date.startsWith(targetMonth) && 
          s.title === sourceSchedule.title && 
          s.startTime === sourceSchedule.startTime
        )
        
        // Update all matching schedules
        for (const s of matchingSchedules) {
          await scheduleService.assignMembers(s.id, assignedIds, actor)
        }
        
        setAlertModal({
          title: 'Bulk Assignment Successful',
          message: `Successfully applied assignments to ${matchingSchedules.length} "${sourceSchedule.title}" schedules in this month.`,
          variant: 'success'
        })
      }
    } else {
      await scheduleService.assignMembers(scheduleId, assignedIds, actor)
    }
    
    await loadData(false)
  }

  // ── Bulk select helpers ───────────────────────────────────────
  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleSelectAll = () => {
    // Selects / deselects ALL filtered schedules across every page
    if (selectedIds.size === filteredSchedules.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredSchedules.map(s => s.id)))
    }
  }

  const handleBulkDeleteConfirmed = async () => {
    setBulkDeleting(true)
    try {
      const ids = Array.from(selectedIds)
      const { deletedCount, skippedIds } = await scheduleService.bulkDeleteSchedules(ids, profile?.email || 'Admin')
      setBulkDeleteOpen(false)
      setSelectedIds(new Set())
      setBulkSelectMode(false)
      await loadData(false)

      if (skippedIds.length > 0) {
        setAlertModal({
          title: 'Partial Deletion',
          message: `${deletedCount} schedule(s) deleted. ${skippedIds.length} schedule(s) could not be deleted because they have attendance records.`,
        })
      }
    } catch (err: any) {
      console.error(err)
      setAlertModal({ title: 'Bulk Delete Failed', message: err.message || 'Failed to delete selected schedules.' })
    } finally {
      setBulkDeleting(false)
    }
  }

  const handleToggleLock = async (s: Schedule) => {
    try {
      const nextLocked = !s.isLocked
      await scheduleService.toggleLockSchedule(s.id, nextLocked, profile?.email || 'Admin')
      await loadData(false)
      setAlertModal({
        title: nextLocked ? 'Schedule Locked' : 'Schedule Unlocked',
        message: nextLocked ? `Schedule "${s.title}" has been finalized & locked.` : `Schedule "${s.title}" is now unlocked.`
      })
    } catch (err: any) {
      setAlertModal({ title: 'Lock Error', message: err.message || 'Failed to update schedule lock state.' })
    }
  }

  // ── Filter & paginate ─────────────────────────────────────────
  const formatTime12 = (timeStr: string) => {
    if (!timeStr) return ''
    const parts = timeStr.split(':')
    if (parts.length < 2) return timeStr
    let h = parseInt(parts[0], 10)
    const m = parts[1].padStart(2, '0')
    const ampm = h >= 12 ? 'PM' : 'AM'
    h = h % 12
    h = h ? h : 12
    return `${h}:${m} ${ampm}`
  }

  const availableSchedulesForSelectedDate = useMemo(() => {
    if (dateFilterMode === 'single') {
      if (!dateFilter) return []
      return schedules
        .filter((s) => s.date === dateFilter)
        .sort((a, b) => a.startTime.localeCompare(b.startTime))
    } else {
      let rangeSchedules = schedules
      if (startDateFilter) rangeSchedules = rangeSchedules.filter((s) => s.date >= startDateFilter)
      if (endDateFilter) rangeSchedules = rangeSchedules.filter((s) => s.date <= endDateFilter)
      return rangeSchedules.sort((a, b) => a.startTime.localeCompare(b.startTime))
    }
  }, [schedules, dateFilterMode, dateFilter, startDateFilter, endDateFilter])

  const [attendanceFilter, setAttendanceFilter] = useState<'all' | ScheduleAttendanceState>('all')

  const getAttendanceState = (scheduleId: string, status: string): ScheduleAttendanceState => {
    if (status === 'upcoming' || status === 'cancelled') return 'none'
    const session = attendanceSessions.find((sess) => sess.scheduleId === scheduleId)
    if (!session) return 'untaken'
    if (session.locked) return 'finalized'
    if (session.hasRecords === true) return 'in_progress'
    return 'untaken'
  }

  const filteredSchedules = useMemo(() => {
    const getFullMonthName = (dateStr: string) => {
      if (!dateStr) return ''
      const parts = dateStr.split('-')
      if (parts.length !== 3) return dateStr
      const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ]
      const m = months[parseInt(parts[1], 10) - 1] || parts[1]
      const d = parseInt(parts[2], 10)
      return `${m} ${d} ${parts[0]}`
    }

    return schedules.filter((s) => {
      // In Calendar View, display all month schedules without restricting to single dateFilter or range
      let matchesDate = true
      if (viewMode === 'calendar') {
        matchesDate = true
      } else if (dateFilterMode === 'single') {
        matchesDate = !dateFilter || s.date === dateFilter
      } else {
        if (startDateFilter && endDateFilter) {
          matchesDate = s.date >= startDateFilter && s.date <= endDateFilter
        } else if (startDateFilter) {
          matchesDate = s.date >= startDateFilter
        } else if (endDateFilter) {
          matchesDate = s.date <= endDateFilter
        }
      }

      const matchesTime = !timeFilter || s.startTime === timeFilter

      if (!matchesDate || !matchesTime) return false

      if (attendanceFilter !== 'all') {
        const attState = getAttendanceState(s.id, getScheduleStatus(s))
        if (attState !== attendanceFilter) return false
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const words = q.split(/\s+/)
        return words.every((word) => {
          const formattedDate = getFullMonthName(s.date).toLowerCase()
          const formattedTime = (formatTime12(s.startTime) + ' ' + formatTime12(s.endTime)).toLowerCase()
          return (
            s.title.toLowerCase().includes(word) ||
            s.date.toLowerCase().includes(word) ||
            formattedDate.includes(word) ||
            formattedTime.includes(word)
          )
        })
      }

      return true
    })
  }, [schedules, dateFilterMode, dateFilter, startDateFilter, endDateFilter, timeFilter, attendanceFilter, searchQuery, attendanceSessions, viewMode])

  const totalPages = Math.max(1, Math.ceil(filteredSchedules.length / PAGE_SIZE))
  const safePage = Math.min(currentPage, totalPages)
  const currentPageItems = filteredSchedules.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const allFilteredSelected = filteredSchedules.length > 0 && selectedIds.size === filteredSchedules.length
  const someSelected = selectedIds.size > 0

  if (loading) {
    return (
      <div className="py-24 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
        <Loading variant="spinner" label="Loading Schedules..." />
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl font-sans">Schedule Management</h1>
          <div className="bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-1.5 mt-3 w-fit">
            {[
              { 
                key: 'schedules', 
                label: 'Schedules',
                icon: (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                )
              },
              { 
                key: 'publications', 
                label: 'Publications',
                icon: (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                )
              }
            ].map((t) => {
              const isActive = activeTab === t.key
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setActiveTab(t.key as any)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all duration-200 cursor-pointer ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/25 ring-1 ring-blue-700/20'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
                  }`}
                >
                  {t.icon}
                  <span className="whitespace-nowrap">{t.label}</span>
                </button>
              )
            })}
          </div>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap w-full sm:w-auto">
          {activeTab === 'schedules' && (
            <>
              {/* Segmented View Mode Toggle */}
              <div className="flex border border-gray-200 bg-white rounded-xl p-1 shadow-2xs">
                <button
                  onClick={() => setViewMode('list')}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                    viewMode === 'list'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                  <span>List</span>
                </button>
                <button
                  onClick={() => setViewMode('calendar')}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                    viewMode === 'calendar'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>Calendar</span>
                </button>
              </div>

              {canManage && (
                <>
                  <button
                    onClick={() => setTemplatesOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-purple-200 bg-purple-50/60 hover:bg-purple-100 text-purple-700 px-3.5 py-2 text-xs font-bold transition-all cursor-pointer shadow-2xs"
                  >
                    <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                    </svg>
                    <span>Templates</span>
                  </button>

                  <button
                    onClick={() => setExportPdfOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100 text-emerald-700 px-3.5 py-2 text-xs font-bold transition-all cursor-pointer shadow-2xs"
                    title="Export Month Schedule as PDF (Long Landscape)"
                  >
                    <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span>Export PDF</span>
                  </button>

                  <button
                    onClick={() => setBulkDeleteMonthOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50/60 hover:bg-rose-100 text-rose-700 px-3.5 py-2 text-xs font-bold transition-all cursor-pointer shadow-2xs"
                    title="Delete all schedules for a specific month"
                  >
                    <svg className="w-4 h-4 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    <span>Bulk Delete Month</span>
                  </button>

                  <button
                    onClick={() => {
                      setSelectedSchedule(null)
                      setSelectedDate('')
                      setFormOpen(true)
                    }}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-xs font-bold transition-all w-full sm:w-auto cursor-pointer shadow-md shadow-blue-600/20"
                  >
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Create Schedule</span>
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {activeTab === 'publications' ? (
        <PublicationsTab />
      ) : (
        <>
      {/* Filters bar */}
      <div className="flex flex-col sm:flex-row gap-4 p-4 rounded-xl border border-gray-200 bg-white shadow-xs">
        {/* Search filter */}
        <div className="flex flex-col space-y-1 flex-1">
          <label htmlFor="filter-search" className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Search Schedules
          </label>
          <input
            id="filter-search"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-shadow duration-150"
            placeholder="e.g. July 5 4 PM Mass"
          />
        </div>

        {/* Date Filter (Single Date vs Date Range) */}
        <div className="flex flex-col space-y-1 flex-1 min-w-[280px]">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              {dateFilterMode === 'single' ? 'Filter by Date' : 'Filter by Date Range'}
            </label>
            <div className="flex items-center gap-1 border border-gray-200 bg-slate-50 rounded-lg p-0.5 text-[10px] font-bold">
              <button
                type="button"
                onClick={() => setDateFilterMode('single')}
                className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                  dateFilterMode === 'single'
                    ? 'bg-white text-blue-600 shadow-2xs font-extrabold'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                Single
              </button>
              <button
                type="button"
                onClick={() => {
                  setDateFilterMode('range')
                  if (!startDateFilter && !endDateFilter) {
                    const thisWeek = getThisWeekRange()
                    setStartDateFilter(thisWeek.start)
                    setEndDateFilter(thisWeek.end)
                  }
                }}
                className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                  dateFilterMode === 'range'
                    ? 'bg-white text-blue-600 shadow-2xs font-extrabold'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                Range
              </button>
            </div>
          </div>

          {dateFilterMode === 'single' ? (
            <div className="flex gap-1.5">
              <input
                id="filter-date"
                type="date"
                value={dateFilter}
                onChange={(e) => handleDateFilterChange(e.target.value)}
                className="block w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-shadow duration-150"
              />
              <button
                type="button"
                onClick={() => {
                  const today = new Date()
                  setSelectedMonthDate(today)
                  setDateFilter(getTodayString())
                }}
                className="shrink-0 inline-flex items-center gap-1 rounded-xl border border-blue-200 bg-blue-50/70 hover:bg-blue-100 px-3 py-1.5 text-xs font-bold text-blue-700 transition-colors cursor-pointer min-h-[36px] shadow-2xs"
              >
                <svg className="w-3.5 h-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>Today</span>
              </button>
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={startDateFilter}
                  onChange={(e) => setStartDateFilter(e.target.value)}
                  className="block w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-shadow duration-150"
                  title="Start Date (From)"
                />
                <span className="text-xs font-bold text-gray-400 shrink-0">to</span>
                <input
                  type="date"
                  value={endDateFilter}
                  onChange={(e) => setEndDateFilter(e.target.value)}
                  className="block w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-shadow duration-150"
                  title="End Date (To)"
                />
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    const r = getThisWeekRange()
                    setStartDateFilter(r.start)
                    setEndDateFilter(r.end)
                  }}
                  className="px-2 py-0.5 text-[10px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md border border-blue-200 transition-colors cursor-pointer"
                >
                  This Week
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const r = getThisMonthRange()
                    setStartDateFilter(r.start)
                    setEndDateFilter(r.end)
                  }}
                  className="px-2 py-0.5 text-[10px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-md border border-indigo-200 transition-colors cursor-pointer"
                >
                  This Month
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const r = getNext7DaysRange()
                    setStartDateFilter(r.start)
                    setEndDateFilter(r.end)
                  }}
                  className="px-2 py-0.5 text-[10px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md border border-slate-200 transition-colors cursor-pointer"
                >
                  Next 7 Days
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Time / Schedule filter */}
        <div className="flex flex-col space-y-1 flex-1">
          <label htmlFor="filter-time" className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Select Time
          </label>
          <select
            id="filter-time"
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value)}
            disabled={dateFilterMode === 'single' && !dateFilter}
            className="block w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-50 disabled:bg-gray-50"
          >
            <option value="">
              {dateFilterMode === 'single'
                ? (dateFilter ? 'All Times' : 'Select Date First')
                : (startDateFilter || endDateFilter ? 'All Times in Range' : 'All Times')}
            </option>
            {Array.from(new Set(availableSchedulesForSelectedDate.map((s) => s.startTime))).map((startTime) => {
              const matched = availableSchedulesForSelectedDate.find((s) => s.startTime === startTime)
              return (
                <option key={startTime} value={startTime}>
                  {formatTime12(startTime)} {matched?.title ? `- ${matched.title}` : ''}
                </option>
              )
            })}
          </select>
        </div>

        {/* Attendance Status Filter */}
        <div className="flex flex-col space-y-1 flex-1">
          <label htmlFor="filter-attendance" className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Attendance Tracking
          </label>
          <select
            id="filter-attendance"
            value={attendanceFilter}
            onChange={(e) => setAttendanceFilter(e.target.value as any)}
            className="block w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 focus:outline-none focus:border-blue-500 transition-colors"
          >
            <option value="all">All Tracking Statuses</option>
            <option value="untaken">Untaken (Not Started)</option>
            <option value="in_progress">In Progress (Unfinalized)</option>
            <option value="finalized">Finalized (Locked)</option>
          </select>
        </div>

        {/* Clear filters */}
        {(dateFilter || startDateFilter || endDateFilter || timeFilter || searchQuery || attendanceFilter !== 'all') && (
          <div className="flex items-end justify-start">
            <button
              onClick={() => {
                const today = new Date()
                setSelectedMonthDate(today)
                setDateFilterMode('single')
                setDateFilter(getTodayString())
                setStartDateFilter('')
                setEndDateFilter('')
                setTimeFilter('')
                setSearchQuery('')
                setAttendanceFilter('all')
              }}
              className="inline-flex items-center gap-1.5 text-xs text-blue-700 hover:text-blue-800 font-bold py-2 px-3 bg-blue-50/60 hover:bg-blue-100/80 border border-blue-200/80 rounded-xl transition-all cursor-pointer shadow-2xs"
            >
              <svg className="w-3.5 h-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Clear Filters</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Grid content */}
      {loading ? (
        <div className="py-16 flex flex-col items-center justify-center space-y-3 bg-white rounded-xl border border-gray-205 shadow-sm">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
          <span className="text-xs text-gray-500">Loading schedules...</span>
        </div>
      ) : viewMode === 'calendar' ? (
        <CalendarView
          schedules={filteredSchedules}
          currentDate={selectedMonthDate}
          onMonthChange={(newMonthDate) => setSelectedMonthDate(newMonthDate)}
          onSelectSchedule={(s) => {
            setSelectedSchedule(s)
            setDetailsOpen(true)
          }}
          onDateClick={(dateStr) => {
            if (!canManage) return
            setSelectedSchedule(null)
            setSelectedDate(dateStr)
            setFormOpen(true)
          }}
          getAttendanceState={getAttendanceState}
        />
      ) : filteredSchedules.length > 0 ? (
        <>
          {/* Bulk actions toolbar */}
          {canManage && (
            <div className="flex items-center justify-between gap-3 px-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                {/* Bulk select toggle */}
                <button
                  onClick={() => setBulkSelectMode(v => !v)}
                  className={`inline-flex items-center gap-1.5 text-xs font-bold px-3.5 py-1.5 rounded-xl border transition-all cursor-pointer shadow-2xs ${
                    bulkSelectMode
                      ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/20'
                      : 'border-slate-200 bg-white text-slate-700 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <span>{bulkSelectMode ? 'Cancel Selection' : 'Select'}</span>
                </button>

                {bulkSelectMode && (
                  <>
                    {/* Select / deselect all across ALL pages */}
                    <button
                      onClick={handleSelectAll}
                      className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 hover:text-blue-800 bg-blue-50/80 hover:bg-blue-100 border border-blue-200/80 px-3 py-1.5 rounded-xl cursor-pointer transition-all shadow-2xs"
                    >
                      <svg className="w-3.5 h-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      <span>{allFilteredSelected ? 'Deselect All' : 'Select All'}</span>
                    </button>

                    {someSelected && (
                      <span className="text-xs font-bold text-slate-600 px-2 py-1 bg-slate-100 rounded-lg">
                        {selectedIds.size}{totalPages > 1 ? ` / ${filteredSchedules.length}` : ''} selected
                      </span>
                    )}
                  </>
                )}
              </div>

              {/* Bulk delete button */}
              {bulkSelectMode && selectedIds.size > 0 && (
                <button
                  onClick={() => setBulkDeleteOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 px-3.5 py-1.5 text-xs font-bold text-white transition-all cursor-pointer shadow-md shadow-rose-600/20"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  <span>Delete {selectedIds.size} Selected</span>
                </button>
              )}
            </div>
          )}

          {/* Cards grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {currentPageItems.map((schedule) => (
          <ScheduleCard
            key={schedule.id}
            schedule={schedule}
            totalAssigned={schedule.assignedMembers?.length || 0}
            isSelected={selectedIds.has(schedule.id)}
            onToggleSelect={bulkSelectMode ? handleToggleSelect : undefined}
            attendanceState={getAttendanceState(schedule.id, getScheduleStatus(schedule))}
            session={attendanceSessions.find((sess) => sess.scheduleId === schedule.id)}
            onToggleLock={handleToggleLock}
            onEdit={(s) => {
              setSelectedSchedule(s)
              setFormOpen(true)
            }}
            onDelete={handleDelete}
            onManageAssignments={(s) => {
              setSelectedSchedule(s)
              setAssignmentOpen(true)
            }}
            onView={(s) => {
              setSelectedSchedule(s)
              setDetailsOpen(true)
            }}
          />
        ))}
      </div>

          {/* Pagination */}
          <Pagination
            currentPage={safePage}
            totalItems={filteredSchedules.length}
            pageSize={PAGE_SIZE}
            onPageChange={setCurrentPage}
            className="mt-4"
          />
        </>
      ) : (
        <div className="py-16 text-center rounded-xl border border-gray-200 bg-white shadow-xs">
          <svg className="mx-auto h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <h3 className="mt-2 text-sm font-bold text-gray-900">
            {dateFilter === getTodayString() ? 'No schedule yet' : 'No schedules found'}
          </h3>
          <p className="mt-1 text-xs text-gray-500">
            {dateFilter === getTodayString()
              ? 'There are no schedules scheduled for today.'
              : 'No schedules match the selected date. Try a different date.'}
          </p>
          {canManage && dateFilter === getTodayString() && (
            <button
              onClick={() => {
                setSelectedSchedule(null)
                setSelectedDate(getTodayString())
                setFormOpen(true)
              }}
              className="mt-4 rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-2.5 text-xs font-bold text-white transition-colors cursor-pointer shadow-sm"
            >
              Create Schedule for Today
            </button>
          )}
        </div>
      )}

      {/* Modals */}
      <ScheduleFormModal
        isOpen={formOpen}
        onClose={() => {
          setFormOpen(false)
          setSelectedSchedule(null)
        }}
        onSubmit={handleAddOrEditSubmit}
        schedule={selectedSchedule}
        defaultDate={selectedDate}
      />

      <AssignmentModal
        isOpen={assignmentOpen}
        onClose={() => {
          setAssignmentOpen(false)
          setSelectedSchedule(null)
        }}
        schedule={selectedSchedule}
        activeMembers={activeMembers}
        allSchedules={schedules || []}
        onSave={handleSaveAssignments}
      />

      <ScheduleDetailsModal
        isOpen={detailsOpen}
        onClose={() => {
          setDetailsOpen(false)
        }}
        schedule={selectedSchedule}
        activeMembers={allMembersProfiles}
        attendanceState={selectedSchedule ? getAttendanceState(selectedSchedule.id, getScheduleStatus(selectedSchedule)) : 'none'}
        onEdit={(s) => {
          setSelectedSchedule(s)
          setFormOpen(true)
        }}
        onDelete={handleDelete}
        onManageAssignments={(s) => {
          setSelectedSchedule(s)
          setAssignmentOpen(true)
        }}
      />

      <TemplateManagerModal
        isOpen={templatesOpen}
        onClose={() => setTemplatesOpen(false)}
        onGenerateSuccess={() => loadData(false)}
      />


      <BulkDeleteMonthModal
        isOpen={bulkDeleteMonthOpen}
        onClose={() => setBulkDeleteMonthOpen(false)}
        onSuccess={() => loadData(false)}
      />

      <SchedulePdfExportModal
        isOpen={exportPdfOpen}
        onClose={() => setExportPdfOpen(false)}
        defaultMonth={`${selectedMonthDate.getFullYear()}-${String(selectedMonthDate.getMonth() + 1).padStart(2, '0')}`}
      />

      {/* Single Delete Confirm Dialog */}
      <ConfirmModal
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDeleteConfirmed}
        variant="danger"
        title="Delete Schedule"
        message="Are you sure you want to permanently delete this schedule? This action cannot be undone."
        confirmLabel="Delete"
      />

      {/* Bulk Delete Confirm Dialog */}
      <ConfirmModal
        isOpen={bulkDeleteOpen}
        onClose={() => setBulkDeleteOpen(false)}
        onConfirm={handleBulkDeleteConfirmed}
        variant="danger"
        title={`Delete ${selectedIds.size} Schedule${selectedIds.size > 1 ? 's' : ''}`}
        message={`Are you sure you want to permanently delete ${selectedIds.size} selected schedule${selectedIds.size > 1 ? 's' : ''}? Schedules with attendance records will be skipped. This action cannot be undone.`}
        confirmLabel={`Delete ${selectedIds.size} Schedule${selectedIds.size > 1 ? 's' : ''}`}
        loading={bulkDeleting}
      />

      {/* Alert Dialog */}
      <AlertModal
        isOpen={!!alertModal || !!error}
        onClose={() => {
          setAlertModal(null)
          setError(null)
        }}
        variant={alertModal?.variant ?? (error ? 'error' : 'error')}
        title={alertModal?.title ?? 'Error'}
        message={alertModal?.message ?? error ?? ''}
      />
      </>
      )}
    </div>
  )
}
