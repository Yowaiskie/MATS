import React, { useState, useEffect } from 'react'
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
import { getScheduleStatus } from '@/utils/scheduleUtils'

export const SchedulesPage: React.FC = () => {
  const [schedules, setSchedules] = useState<Schedule[]>(null as unknown as Schedule[]) // Initialize as null to handle initial load
  const [activeMembers, setActiveMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filter states
  const [statusFilter, setStatusFilter] = useState<'all' | 'upcoming' | 'ongoing' | 'completed' | 'cancelled'>('all')
  const [dateFilter, setDateFilter] = useState('')

  // Modals state
  const [formOpen, setFormOpen] = useState(false)
  const [assignmentOpen, setAssignmentOpen] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const [csvImportOpen, setCsvImportOpen] = useState(false)
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null)
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list')
  const [allMembersProfiles, setAllMembersProfiles] = useState<Member[]>([])

  // Dialog state
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [alertModal, setAlertModal] = useState<{ title: string; message: string } | null>(null)

  // Initialize schedules array on mount
  useEffect(() => {
    setSchedules([])
  }, [])

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

  // Callbacks
  const handleAddOrEditSubmit = async (input: ScheduleInput) => {
    if (selectedSchedule) {
      await scheduleService.updateSchedule(selectedSchedule.id, input)
    } else {
      await scheduleService.addSchedule(input)
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
      await scheduleService.deleteSchedule(id)
      await loadData()
    } catch (err: any) {
      console.error(err)
      setAlertModal({ title: 'Delete Failed', message: err.message || 'Failed to delete schedule.' })
    }
  }

  const handleSaveAssignments = async (scheduleId: string, assignedIds: string[]) => {
    await scheduleService.assignMembers(scheduleId, assignedIds)
    await loadData()
  }

  // Filter list of schedules
  const filteredSchedules = (schedules || []).filter((s) => {
    const matchesDate = !dateFilter || s.date === dateFilter
    
    const computedStatus = getScheduleStatus(s)
    const matchesStatus = statusFilter === 'all' || computedStatus === statusFilter

    return matchesDate && matchesStatus
  })

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

          <button
            onClick={() => setTemplatesOpen(true)}
            className="rounded-lg border border-gray-200 bg-white hover:bg-gray-550 px-3.5 py-2.5 text-xs font-semibold text-gray-700 hover:text-gray-900 transition-colors cursor-pointer shadow-sm"
          >
            Templates
          </button>

          <button
            onClick={() => setCsvImportOpen(true)}
            className="rounded-lg border border-gray-200 bg-white hover:bg-gray-550 px-3.5 py-2.5 text-xs font-semibold text-gray-700 hover:text-gray-900 transition-colors cursor-pointer shadow-sm"
          >
            Import CSV
          </button>

          <button
            onClick={() => {
              setSelectedSchedule(null)
              setFormOpen(true)
            }}
            className="rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-2.5 text-xs font-bold text-white transition-colors w-full sm:w-auto cursor-pointer shadow-sm"
          >
            Create Schedule
          </button>
        </div>
      </div>

      {/* Filters bar */}
      <div className="flex flex-col sm:flex-row gap-4 p-4 rounded-xl border border-gray-200 bg-white shadow-xs">
        {/* Date filter */}
        <div className="flex flex-col space-y-1 flex-1">
          <label htmlFor="filter-date" className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Filter by Date
          </label>
          <input
            id="filter-date"
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="block w-full rounded-lg border border-gray-250 bg-white px-3 py-1.5 text-xs text-gray-750 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-shadow duration-150"
          />
        </div>

        {/* Status filter */}
        <div className="flex flex-col space-y-1 flex-1">
          <label htmlFor="filter-status" className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Filter by Status
          </label>
          <select
            id="filter-status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="block w-full rounded-lg border border-gray-250 bg-white px-3 py-1.5 text-xs text-gray-700 focus:outline-none focus:border-blue-500 transition-colors"
          >
            <option value="all">All Statuses</option>
            <option value="upcoming">Upcoming</option>
            <option value="ongoing">Ongoing</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {/* Clear filters */}
        {(dateFilter || statusFilter !== 'all') && (
          <div className="flex items-end justify-start">
            <button
              onClick={() => {
                setDateFilter('')
                setStatusFilter('all')
              }}
              className="text-xs text-blue-600 hover:text-blue-700 font-bold py-2 px-3 transition-colors cursor-pointer"
            >
              Clear Filters
            </button>
          </div>
        )}
      </div>

      {/* Error Panel */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-650">
          {error}
        </div>
      )}

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
        />
      ) : filteredSchedules.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSchedules.map((schedule) => (
            <ScheduleCard
              key={schedule.id}
              schedule={schedule}
              totalAssigned={schedule.assignedMembers?.length || 0}
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
      ) : (
        <div className="py-16 text-center rounded-xl border border-gray-200 bg-white shadow-xs">
          <svg className="mx-auto h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <h3 className="mt-2 text-sm font-bold text-gray-900">No schedules found</h3>
          <p className="mt-1 text-xs text-gray-500">Create a schedule or check active filter values.</p>
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
          setSelectedSchedule(null)
        }}
        schedule={selectedSchedule}
        activeMembers={allMembersProfiles}
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

      {/* Delete Confirm Dialog */}
      <ConfirmModal
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDeleteConfirmed}
        variant="danger"
        title="Delete Schedule"
        message="Are you sure you want to permanently delete this schedule? This action cannot be undone."
        confirmLabel="Delete"
      />

      {/* Alert Dialog */}
      <AlertModal
        isOpen={!!alertModal}
        onClose={() => setAlertModal(null)}
        variant="error"
        title={alertModal?.title ?? ''}
        message={alertModal?.message ?? ''}
      />
    </div>
  )
}
