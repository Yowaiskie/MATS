import React, { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { scheduleService } from '@/services/scheduleService'
import { memberService } from '@/services/memberService'
import type { Schedule } from '@/types/schedule'
import type { Member } from '@/types/member'
import { getScheduleStatus } from '@/utils/scheduleUtils'
import { Loading } from '@/components/Loading'

export const SchedulePreviewPage: React.FC = () => {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const [schedData, memberData] = await Promise.all([
          scheduleService.getSchedules(),
          memberService.getMembers()
        ])
        setSchedules(schedData)
        setMembers(memberData)
      } catch (err) {
        console.error('Failed to load schedule preview data:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  // Format 12-hour time format helper
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

  const filteredSchedules = useMemo(() => {
    return schedules.filter(s => {
      const matchesSearch = s.title.toLowerCase().includes(searchQuery.toLowerCase()) || s.date.includes(searchQuery)
      const status = getScheduleStatus(s)
      const matchesStatus = statusFilter === 'all' || status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [schedules, searchQuery, statusFilter])

  if (loading) {
    return (
      <div className="py-24 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
        <Loading variant="spinner" label="Loading Clean Card Schedule Preview..." />
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-indigo-50/80 border border-indigo-200/80 rounded-2xl">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-indigo-600 text-white shadow-xs">
            Clean Card Grid
          </span>
          <p className="text-xs font-semibold text-indigo-900">
            Perfect Alignment Card Grid Layout for Schedule Management
          </p>
        </div>
        <Link 
          to="/schedules"
          className="text-xs font-extrabold text-indigo-700 hover:text-indigo-900 bg-white px-3 py-1.5 rounded-xl border border-indigo-200 shadow-2xs hover:bg-indigo-50 transition-colors"
        >
          ← Switch to Live Schedules Page
        </Link>
      </div>

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">Schedule Management</h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Organize mass services and assign from {members.length} active altar servers.
          </p>
        </div>

        <button className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-extrabold text-xs text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-500/20 active:scale-95 transition-all cursor-pointer">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          <span>Add Schedule</span>
        </button>
      </div>

      {/* Control Bar: Search & Status Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            placeholder="Search schedule or date (YYYY-MM-DD)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/40 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none"
          />
          <svg className="w-4 h-4 text-slate-400 absolute left-3 top-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
          {['all', 'upcoming', 'ongoing', 'completed', 'cancelled'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold capitalize transition-all cursor-pointer ${
                statusFilter === st
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-50 border border-slate-200/80 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* PERFECT ALIGNMENT CARD GRID */}
      {filteredSchedules.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredSchedules.map((schedule) => {
            const status = getScheduleStatus(schedule)
            const badgeClass = {
              upcoming: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
              ongoing: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
              completed: 'bg-slate-100 text-slate-600 border-slate-200/80',
              cancelled: 'bg-rose-50 text-rose-700 border-rose-200/80',
            }[status]

            const assignedCount = schedule.assignedMembers?.length || 0

            return (
              <div 
                key={schedule.id}
                className="group bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs hover:shadow-md hover:border-indigo-200 transition-all flex flex-col justify-between h-full"
              >
                <div className="space-y-3.5">
                  {/* Top Bar: Date & Status */}
                  <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-slate-500 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200/60">
                      📅 {schedule.date}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${badgeClass}`}>
                      {status}
                    </span>
                  </div>

                  {/* Title Area with fixed min height for perfect row alignment */}
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900 group-hover:text-indigo-600 transition-colors leading-snug line-clamp-2 h-10 flex items-center">
                      {schedule.title}
                    </h3>
                  </div>

                  {/* Metadata Stack */}
                  <div className="space-y-2 text-xs font-semibold text-slate-500 bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Time Range:</span>
                      <span className="font-extrabold text-slate-800">
                        {formatTime12(schedule.startTime)} - {formatTime12(schedule.endTime)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Servers Assigned:</span>
                      <span className="font-extrabold text-indigo-600">
                        {assignedCount} Servers
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bottom Action Footer: Perfectly Aligned Buttons */}
                <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button className="flex-1 px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-extrabold border border-slate-200/80 transition-all cursor-pointer text-center">
                    Assign Servers
                  </button>

                  <Link 
                    to={`/attendance?scheduleId=${schedule.id}`}
                    className="flex-1 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold shadow-xs transition-all cursor-pointer text-center"
                  >
                    Attendance
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="py-16 text-center text-xs font-semibold text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">
          No schedules match your search filters.
        </div>
      )}
    </div>
  )
}
