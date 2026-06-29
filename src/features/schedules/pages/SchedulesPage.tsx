import React, { useState, useEffect } from 'react'
import { scheduleService } from '@/services/scheduleService'
import { memberService } from '@/services/memberService'
import { ScheduleCard } from '../components/ScheduleCard'
import { ScheduleFormModal } from '../components/ScheduleFormModal'
import { AssignmentModal } from '../components/AssignmentModal'
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
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null)

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

      // Fetch active members for the assignment list
      const memberData = await memberService.getMembers(false) // exclude archived
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

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to permanently delete this schedule? This action cannot be undone.')) return
    try {
      await scheduleService.deleteSchedule(id)
      await loadData()
    } catch (err: any) {
      console.error(err)
      alert(err.message || 'Failed to delete schedule.')
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
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Schedule Management</h1>
          <p className="text-sm text-gray-400 mt-1">Create weekly service schedules and assign altar servers.</p>
        </div>
        <div>
          <button
            onClick={() => {
              setSelectedSchedule(null)
              setFormOpen(true)
            }}
            className="rounded bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-xs font-semibold text-white transition-colors w-full sm:w-auto"
          >
            Create Schedule
          </button>
        </div>
      </div>

      {/* Filters bar */}
      <div className="flex flex-col sm:flex-row gap-4 p-4 rounded-lg border border-gray-800 bg-gray-950/40">
        {/* Date filter */}
        <div className="flex flex-col space-y-1.5 flex-1">
          <label htmlFor="filter-date" className="text-xxs font-semibold uppercase tracking-wider text-gray-400">
            Filter by Date
          </label>
          <input
            id="filter-date"
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="block w-full rounded border border-gray-800 bg-gray-950 px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Status filter */}
        <div className="flex flex-col space-y-1.5 flex-1">
          <label htmlFor="filter-status" className="text-xxs font-semibold uppercase tracking-wider text-gray-400">
            Filter by Status
          </label>
          <select
            id="filter-status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="block w-full rounded border border-gray-800 bg-gray-950 px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
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
          <div className="flex items-end">
            <button
              onClick={() => {
                setDateFilter('')
                setStatusFilter('all')
              }}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold py-2 px-3 transition-colors"
            >
              Clear Filters
            </button>
          </div>
        )}
      </div>

      {/* Error Panel */}
      {error && (
        <div className="rounded border border-red-900 bg-red-950/40 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Main Grid content */}
      {loading ? (
        <div className="py-16 flex flex-col items-center justify-center space-y-3 bg-gray-950/10 rounded-lg border border-gray-800">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
          <span className="text-xs text-gray-500">Loading schedules...</span>
        </div>
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
        <div className="py-16 text-center rounded-lg border border-gray-800 bg-gray-950/20">
          <svg className="mx-auto h-10 w-10 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <h3 className="mt-2 text-sm font-bold text-white">No schedules found</h3>
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
    </div>
  )
}
