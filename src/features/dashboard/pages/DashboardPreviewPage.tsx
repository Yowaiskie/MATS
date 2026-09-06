import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { dashboardService, type ActivityLog, type BirthdayCelebrant } from '@/services/dashboardService'
import type { Schedule } from '@/types/schedule'
import { getScheduleStatus } from '@/utils/scheduleUtils'
import { DashboardCharts } from '../components/DashboardCharts'
import { useAuth } from '@/features/authentication/AuthContext'

export const DashboardPreviewPage: React.FC = () => {
  const { profile } = useAuth()
  const userOrder = profile?.assignedOrder

  const [data, setData] = useState<{
    stats: any
    todaySchedules: Schedule[]
    activities: ActivityLog[]
    myEventAssignments: any[]
    monthBirthdays?: BirthdayCelebrant[]
  } | null>(null)
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        setLoading(true)
        const [dashboardData, myAssignments] = await Promise.all([
          dashboardService.getDashboardData(userOrder),
          dashboardService.getMyEventAssignments(profile?.displayName || '')
        ])
        setData({ ...dashboardData, myEventAssignments: myAssignments })
      } catch (err: any) {
        console.error(err)
        setError('Failed to fetch real-time dashboard data.')
      } finally {
        setLoading(false)
      }
    }

    loadDashboard()
  }, [userOrder])

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

  // Format activity timestamp helper
  const formatActivityTime = (dateObj: Date) => {
    if (!dateObj) return ''
    const dateStr = dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    const timeStr = dateObj.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    return `${dateStr} • ${timeStr}`
  }

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center space-y-3 bg-white rounded-2xl border border-slate-200 shadow-2xs">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
        <span className="text-xs font-semibold text-slate-500">Loading new dashboard preview...</span>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600 font-medium">
        {error || 'Failed to load dashboard data.'}
      </div>
    )
  }

  const cardStats = [
    { 
      name: 'Active Members', 
      value: String(data.stats.activeMembers), 
      color: 'text-emerald-600', 
      bg: 'bg-emerald-50/60', 
      border: 'border-emerald-100', 
      desc: 'Registered and active servers',
      icon: (
        <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )
    },
    { 
      name: userOrder ? `Suspended (${userOrder})` : 'Suspended (This Month)', 
      value: String(userOrder ? data.stats.userOrderSuspendedCount : data.stats.suspendedMembersCount), 
      color: 'text-rose-600', 
      bg: 'bg-rose-50/60', 
      border: 'border-rose-100', 
      desc: userOrder ? `${data.stats.userOrderSuspendedCount} suspended in ${userOrder}` : 'Total suspended this month',
      icon: (
        <svg className="h-5 w-5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      )
    },
    { 
      name: 'Upcoming Schedules', 
      value: String(data.stats.upcomingSchedules), 
      color: 'text-indigo-600', 
      bg: 'bg-indigo-50/60', 
      border: 'border-indigo-100', 
      desc: 'Future services planned',
      icon: (
        <svg className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      )
    },
  ]

  const quickTasks = [
    {
      title: 'Add New Member',
      desc: 'Register a server to the ministry',
      href: '/members',
      iconBg: 'bg-indigo-50 text-indigo-600 border-indigo-100',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
        </svg>
      )
    },
    {
      title: 'Create Schedule',
      desc: 'Plan a service or mass schedule',
      href: '/schedules',
      iconBg: 'bg-emerald-50 text-emerald-600 border-emerald-100',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      )
    },
    {
      title: 'View Reports',
      desc: 'Export summary analytics & PDF',
      href: '/reports',
      iconBg: 'bg-amber-50 text-amber-600 border-amber-100',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
    }
  ]

  return (
    <div className="space-y-6">
      {/* Comparison Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-indigo-50/80 border border-indigo-200/80 rounded-2xl">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-indigo-600 text-white shadow-xs">
            Preview Route
          </span>
          <p className="text-xs font-semibold text-indigo-900">
            Comparing Layout Enhancements (Today's Schedule, Recent Activity, Quick Tasks)
          </p>
        </div>
        <Link 
          to="/"
          className="text-xs font-extrabold text-indigo-700 hover:text-indigo-900 bg-white px-3 py-1.5 rounded-xl border border-indigo-200 shadow-2xs hover:bg-indigo-50 transition-colors"
        >
          ← Switch to Original Dashboard
        </Link>
      </div>

      {/* Welcome Header */}
      <div>
        <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">Dashboard (Enhanced Layout)</h1>
        <p className="text-sm font-medium text-slate-500 mt-1">
          Enhanced layout preview for Today's Schedule, Activity Stream, and Quick Task Shortcuts.
        </p>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cardStats.map((stat) => (
          <div key={stat.name} className={`p-5 rounded-2xl border ${stat.border} ${stat.bg} transition-all duration-200 hover:shadow-xs flex flex-col justify-between`}>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  {stat.name}
                </span>
                <span className="p-2 rounded-xl bg-white/80 shadow-2xs border border-white">
                  {stat.icon}
                </span>
              </div>
              <span className={`font-black tracking-tight leading-none ${stat.color} text-3xl block`}>
                {stat.value}
              </span>
            </div>
            <p className="text-[11px] font-semibold text-slate-400 mt-3">{stat.desc}</p>
          </div>
        ))}
      </div>

      <DashboardCharts stats={data.stats} />

      {/* Main Grid: Re-laid out Today's Schedule & Recent Activity + Enhanced Quick Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column (2 Cols): Today's Schedule & Recent Activity */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* ENHANCED: Today's Schedule */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 tracking-tight">Today's Schedule</h3>
                <p className="text-xs text-slate-500 mt-0.5 font-medium">Active services scheduled for today</p>
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                {data.todaySchedules.length} {data.todaySchedules.length === 1 ? 'Service' : 'Services'}
              </span>
            </div>

            <div className="pt-4">
              {data.todaySchedules.length > 0 ? (
                <div className="space-y-3">
                  {data.todaySchedules.map((schedule) => {
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
                        className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/40 hover:bg-slate-50 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-extrabold text-slate-900">{schedule.title}</h4>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${badgeClass}`}>
                              {status}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-xs font-semibold text-slate-500">
                            <span className="flex items-center gap-1">
                              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              {formatTime12(schedule.startTime)} - {formatTime12(schedule.endTime)}
                            </span>
                            <span className="flex items-center gap-1 text-slate-400">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                              {assignedCount} Assigned
                            </span>
                          </div>
                        </div>

                        <Link
                          to={`/attendance?scheduleId=${schedule.id}`}
                          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-4 py-2 text-xs font-bold text-white shadow-xs hover:shadow-md active:scale-95 transition-all cursor-pointer select-none"
                        >
                          <span>Take Attendance</span>
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                          </svg>
                        </Link>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="py-10 text-center text-sm font-semibold text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                  No active schedules for today.
                </div>
              )}
            </div>
          </div>

          {/* ENHANCED: Recent Activity Stream */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs">
            <div className="pb-4 border-b border-slate-100">
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight">Recent Activity Stream</h3>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">Real-time audit log feed across all operations</p>
            </div>

            <div className="pt-5">
              {data.activities.length > 0 ? (
                <div className="relative border-l-2 border-slate-100 ml-3.5 space-y-6">
                  {data.activities.map((activity) => (
                    <div key={activity.id} className="relative pl-6">
                      {/* Timeline Indicator Badge */}
                      <span className="absolute -left-[9px] top-0.5 h-4 w-4 rounded-full border-2 border-white bg-indigo-600 shadow-2xs" />
                      
                      <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:border-slate-200 hover:shadow-2xs transition-all">
                        <p className="text-xs font-bold text-slate-800 leading-snug">{activity.description}</p>
                        <p className="text-[10px] font-semibold text-slate-400 mt-1">
                          {formatActivityTime(activity.timestamp)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-10 text-center text-sm font-semibold text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                  No recent activity recorded.
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Right Column (1 Col): My Event Roles & Quick Tasks */}
        <div className="space-y-6">
          
          {/* My Event Roles Widget */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs">
            <div className="pb-4 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 tracking-tight">My Event Roles</h3>
                <p className="text-xs text-slate-500 mt-0.5 font-medium">Your tasks & responsibilities in active events</p>
              </div>
              <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full text-xs font-bold">
                {data.myEventAssignments.length}
              </span>
            </div>

            <div className="pt-4 space-y-3">
              {data.myEventAssignments.length > 0 ? (
                data.myEventAssignments.map(assignment => (
                  <Link 
                    key={assignment.id}
                    to={`/events?eventId=${assignment.eventId}`}
                    className="block p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-200 transition-all shadow-2xs"
                  >
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="text-xs font-extrabold text-slate-900 line-clamp-1">{assignment.eventTitle}</h4>
                      {assignment.isOverallHead ? (
                        <span className="shrink-0 ml-2 px-2 py-0.5 bg-rose-100 text-rose-700 rounded text-[9px] font-bold uppercase tracking-wider">Overall Head</span>
                      ) : assignment.isSubLeader ? (
                        <span className="shrink-0 ml-2 px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-[9px] font-bold uppercase tracking-wider">Sub Leader</span>
                      ) : (
                        <span className="shrink-0 ml-2 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[9px] font-bold uppercase tracking-wider">Member</span>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 text-[11px] font-medium text-slate-500 mt-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-700">Role:</span> {assignment.eventRoleName}
                      </div>
                      {assignment.committeeName && (
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-slate-700">Committee:</span> {assignment.committeeName}
                        </div>
                      )}
                    </div>
                  </Link>
                ))
              ) : (
                <div className="py-6 text-center text-xs font-semibold text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                  You have no event assignments yet.
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-4">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight">Quick Tasks & Actions</h3>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">Fast shortcuts for common ministry operations</p>
            </div>

            <div className="space-y-3 pt-2">
              {quickTasks.map((task) => (
                <Link
                  key={task.title}
                  to={task.href}
                  className="group flex items-start gap-3.5 p-3.5 rounded-xl border border-slate-200/80 bg-white hover:bg-indigo-50/40 hover:border-indigo-200 transition-all shadow-2xs hover:shadow-xs"
                >
                  <div className={`p-2.5 rounded-xl border ${task.iconBg} shrink-0`}>
                    {task.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-extrabold text-slate-900 group-hover:text-indigo-600 transition-colors">{task.title}</h4>
                      <span className="text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all text-xs font-bold">→</span>
                    </div>
                    <p className="text-[11px] font-medium text-slate-500 mt-0.5 line-clamp-1">{task.desc}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
