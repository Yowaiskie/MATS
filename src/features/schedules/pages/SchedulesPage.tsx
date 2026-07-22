import React, { useState, useEffect, useMemo } from 'react'
import { scheduleService } from '@/services/scheduleService'
import { memberService } from '@/services/memberService'
import { ScheduleCard } from '../components/ScheduleCard'
import { ScheduleFormModal } from '../components/ScheduleFormModal'
import { AssignmentModal } from '../components/AssignmentModal'
import { CalendarView } from '../components/CalendarView'
import { ScheduleDetailsModal } from '../components/ScheduleDetailsModal'
import { TemplateManagerModal } from '../components/TemplateManagerModal'
import { CSVImporterModal } from '../components/CSVImporterModal'
import { AlertModal, ConfirmModal } from '@/components/Dialog'
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

export const SchedulesPage: React.FC = () => {
  const { profile, isAdmin } = useAuth()
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [activeMembers, setActiveMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filter states
  const [dateFilter, setDateFilter] = useState(getTodayString())
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

  // Modals state
  const [formOpen, setFormOpen] = useState(false)
  const [assignmentOpen, setAssignmentOpen] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const [csvImportOpen, setCsvImportOpen] = useState(false)
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null)
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list')
  const [allMembersProfiles, setAllMembersProfiles] = useState<Member[]>([])

  // Dialog state
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [alertModal, setAlertModal] = useState<{ title: string; message: string } | null>(null)

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const scheduleData = await scheduleService.getSchedules()
      setSchedules(scheduleData)

      // Fetch all member profiles (including archived to warn during imports)
      const memberData = await memberService.getMembers(true)
      setAllMembersProfiles(memberData)
      setActiveMembers(memberData.filter(m => m.status === 'active'))

      const sessionsData = await attendanceService.getAllSessions()
      setAttendanceSessions(sessionsData)
    } catch (err: any) {
      console.error(err)
      setError('Failed to load schedule or member records.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [dateFilter, timeFilter, searchQuery])

  // Reset time filter when date filter changes
  useEffect(() => {
    setTimeFilter('')
  }, [dateFilter])

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
    await loadData()
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
      await loadData()
    } catch (err: any) {
      console.error(err)
      setAlertModal({ title: 'Delete Failed', message: err.message || 'Failed to delete schedule.' })
    }
  }

  const handleSaveAssignments = async (scheduleId: string, assignedIds: string[]) => {
    await scheduleService.assignMembers(scheduleId, assignedIds, profile?.email || 'Admin')
    await loadData()
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
      await loadData()

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
    if (!dateFilter) return []
    return schedules
      .filter((s) => s.date === dateFilter)
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
  }, [schedules, dateFilter])

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
      const matchesDate = !dateFilter || s.date === dateFilter
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
  }, [schedules, dateFilter, timeFilter, attendanceFilter, searchQuery, attendanceSessions])

  const totalPages = Math.max(1, Math.ceil(filteredSchedules.length / PAGE_SIZE))
  const safePage = Math.min(currentPage, totalPages)
  const currentPageItems = filteredSchedules.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const allFilteredSelected = filteredSchedules.length > 0 && selectedIds.size === filteredSchedules.length
  const someSelected = selectedIds.size > 0

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl font-sans">Schedule Management</h1>
          <p className="text-sm text-gray-500 mt-1">Create weekly service schedules and assign altar servers.</p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap w-full sm:w-auto">
          {/* Segmented View Mode Toggle */}
          <div className="flex border border-gray-200 bg-white rounded-lg p-1 shadow-xs">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-blue-600 text-white font-bold'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              List View
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                viewMode === 'calendar'
                  ? 'bg-blue-600 text-white font-bold'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Calendar View
            </button>
          </div>

          {isAdmin && (
            <>
              <button
                onClick={() => setTemplatesOpen(true)}
                className="rounded-lg border border-gray-200 bg-white hover:bg-gray-50 px-3.5 py-2.5 text-xs font-semibold text-gray-700 hover:text-gray-900 transition-colors cursor-pointer shadow-sm"
              >
                Templates
              </button>

              <button
                onClick={() => setCsvImportOpen(true)}
                className="rounded-lg border border-gray-200 bg-white hover:bg-gray-50 px-3.5 py-2.5 text-xs font-semibold text-gray-700 hover:text-gray-900 transition-colors cursor-pointer shadow-sm"
              >
                Import CSV
              </button>

              <button
                onClick={() => {
                  setSelectedSchedule(null)
                  setSelectedDate('')
                  setFormOpen(true)
                }}
                className="rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-2.5 text-xs font-bold text-white transition-colors w-full sm:w-auto cursor-pointer shadow-sm"
              >
                Create Schedule
              </button>
            </>
          )}
        </div>
      </div>

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

        {/* Date filter */}
        <div className="flex flex-col space-y-1 flex-1">
          <label htmlFor="filter-date" className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Filter by Date
          </label>
          <div className="flex gap-1.5">
            <input
              id="filter-date"
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="block w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-shadow duration-150"
            />
            <button
              type="button"
              onClick={() => setDateFilter(getTodayString())}
              className="shrink-0 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors cursor-pointer min-h-[36px]"
            >
              Today
            </button>
          </div>
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
            disabled={!dateFilter}
            className="block w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-50 disabled:bg-gray-50"
          >
            <option value="">{dateFilter ? 'All Times' : 'Select Date First'}</option>
            {availableSchedulesForSelectedDate.map((s) => (
              <option key={s.id} value={s.startTime}>
                {formatTime12(s.startTime)} - {s.title}
              </option>
            ))}
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
        {(dateFilter || timeFilter || searchQuery || attendanceFilter !== 'all') && (
          <div className="flex items-end justify-start">
            <button
              onClick={() => {
                setDateFilter(getTodayString())
                setTimeFilter('')
                setSearchQuery('')
                setAttendanceFilter('all')
              }}
              className="text-xs text-blue-600 hover:text-blue-700 font-bold py-2 px-3 transition-colors cursor-pointer"
            >
              Clear Filters
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
          onSelectSchedule={(s) => {
            setSelectedSchedule(s)
            setDetailsOpen(true)
          }}
          onDateClick={(dateStr) => {
            if (!isAdmin) return
            setSelectedSchedule(null)
            setSelectedDate(dateStr)
            setFormOpen(true)
          }}
          getAttendanceState={getAttendanceState}
        />
      ) : filteredSchedules.length > 0 ? (
        <>
          {/* Bulk actions toolbar */}
          {isAdmin && (
            <div className="flex items-center justify-between gap-3 px-1">
              <div className="flex items-center gap-3">
                {/* Bulk select toggle */}
                <button
                  onClick={() => setBulkSelectMode(v => !v)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                    bulkSelectMode
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-gray-200 bg-white text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  {bulkSelectMode ? 'Cancel Selection' : 'Select'}
                </button>

              {bulkSelectMode && (
                <>
                  {/* Select / deselect all across ALL pages */}
                  <button
                    onClick={handleSelectAll}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer transition-colors"
                  >
                    {allFilteredSelected ? 'Deselect All' : 'Select All'}
                  </button>

                  {someSelected && (
                    <span className="text-xs text-gray-500">
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
                className="flex items-center gap-1.5 rounded-lg bg-red-600 hover:bg-red-700 px-3.5 py-1.5 text-xs font-bold text-white transition-colors cursor-pointer shadow-sm"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete {selectedIds.size} Selected
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
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-gray-500">
                Showing{' '}
                <span className="font-semibold text-gray-700">
                  {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filteredSchedules.length)}
                </span>{' '}
                of{' '}
                <span className="font-semibold text-gray-700">{filteredSchedules.length}</span>{' '}
                schedules
              </p>

              <div className="flex items-center gap-1">
                {/* Previous */}
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                  className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 hover:text-gray-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  ‹ Prev
                </button>

                {/* Page numbers */}
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                  // Show first, last, current ±1, with ellipsis
                  const show =
                    page === 1 ||
                    page === totalPages ||
                    Math.abs(page - safePage) <= 1
                  const isEllipsisBefore = page === 2 && safePage > 3
                  const isEllipsisAfter = page === totalPages - 1 && safePage < totalPages - 2

                  if (isEllipsisBefore || isEllipsisAfter) {
                    return (
                      <span key={page} className="px-1 text-xs text-gray-400 select-none">…</span>
                    )
                  }
                  if (!show) return null

                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                        page === safePage
                          ? 'bg-blue-600 text-white border border-blue-600'
                          : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      {page}
                    </button>
                  )
                })}

                {/* Next */}
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                  className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 hover:text-gray-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  Next ›
                </button>
              </div>
            </div>
          )}
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
          {isAdmin && dateFilter === getTodayString() && (
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
        activeMembers={activeMembers}
        allMembers={allMembersProfiles}
        onGenerateSuccess={loadData}
      />

      <CSVImporterModal
        isOpen={csvImportOpen}
        onClose={() => setCsvImportOpen(false)}
        activeMembers={allMembersProfiles}
        onImportSuccess={loadData}
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
        variant="error"
        title={alertModal?.title ?? 'Error'}
        message={alertModal?.message ?? error ?? ''}
      />
    </div>
  )
}
