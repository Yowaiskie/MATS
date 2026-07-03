import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '@/components/Card'
import { dashboardService, type ActivityLog } from '@/services/dashboardService'
import type { Schedule } from '@/types/schedule'
import { getScheduleStatus } from '@/utils/scheduleUtils'

const statIcons: { [key: string]: React.ReactNode } = {
  'Active Members': (
    <svg className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  'Archived Members': (
    <svg className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
    </svg>
  ),
  'Upcoming Schedules': (
    <svg className="h-5 w-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  'Ongoing Schedule': (
    <svg className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  'Completed Schedules': (
    <svg className="h-5 w-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  'Attendance Sessions': (
    <svg className="h-5 w-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  )
}

export const DashboardOverview: React.FC = () => {
  const [data, setData] = useState<{
    stats: any
    todaySchedules: Schedule[]
    activities: ActivityLog[]
  } | null>(null)
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        setLoading(true)
        const dashboardData = await dashboardService.getDashboardData()
        setData(dashboardData)
      } catch (err: any) {
        console.error(err)
        setError('Failed to fetch real-time dashboard data.')
      } finally {
        setLoading(false)
      }
    }

    loadDashboard()
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

  // Format activity timestamp helper
  const formatActivityTime = (dateObj: Date) => {
    if (!dateObj) return ''
    const dateStr = dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    const timeStr = dateObj.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    return `${dateStr} at ${timeStr}`
  }

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center space-y-3 bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
        <span className="text-xs text-gray-500">Loading dashboard overview...</span>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
        {error || 'Failed to load dashboard data.'}
      </div>
    )
  }

  const cardStats = [
    { name: 'Active Members', value: String(data.stats.activeMembers), color: 'text-green-600', bg: 'bg-green-50/50', border: 'border-green-100', desc: 'Registered and active servers' },
    { name: 'Archived Members', value: String(data.stats.archivedMembers), color: 'text-gray-600', bg: 'bg-gray-50/50', border: 'border-gray-150', desc: 'Inactive or retired profiles' },
    { name: 'Upcoming Schedules', value: String(data.stats.upcomingSchedules), color: 'text-emerald-600', bg: 'bg-emerald-50/50', border: 'border-emerald-100', desc: 'Future services planned' },
    { 
      name: 'Ongoing Schedule', 
      value: data.stats.ongoingSchedules > 0 ? String(data.stats.ongoingSchedules) : 'No ongoing schedule', 
      color: 'text-blue-600', 
      bg: 'bg-blue-50/50', 
      border: 'border-blue-100',
      isText: data.stats.ongoingSchedules === 0,
      desc: 'Schedules currently active now'
    },
    { name: 'Completed Schedules', value: String(data.stats.completedSchedules), color: 'text-purple-600', bg: 'bg-purple-50/50', border: 'border-purple-100', desc: 'Schedules already served' },
    { name: 'Attendance Sessions', value: String(data.stats.attendanceSessionsCount), color: 'text-amber-600', bg: 'bg-amber-50/50', border: 'border-amber-100', desc: 'Schedules attendance recorded' },
  ]

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          Welcome back. Here is an overview of today's ministry services.
        </p>
      </div>

      {/* Real-time Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {cardStats.map((stat) => (
          <Card key={stat.name} className={`${stat.bg} ${stat.border} hover:shadow-md transition-shadow duration-250 flex flex-col justify-between`}>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 leading-tight">
                  {stat.name}
                </span>
                <span className="shrink-0">{statIcons[stat.name]}</span>
              </div>
              <span className={`font-extrabold leading-none ${stat.color} ${stat.isText ? 'text-xs font-semibold block leading-tight' : 'text-3xl block'}`}>
                {stat.value}
              </span>
            </div>
            <p className="text-[10px] text-gray-400 leading-tight mt-3">{stat.desc}</p>
          </Card>
        ))}
      </div>

      {/* Main Grid: Today's Schedule & Recent Activity (col-span-2) + Quick Actions (col-span-1) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          
          {/* Today's Schedule */}
          <Card title="Today's Schedule" description="Active services scheduled for today.">
            {data.todaySchedules.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {data.todaySchedules.map((schedule) => {
                  const status = getScheduleStatus(schedule)
                  const badgeClass = {
                    upcoming: 'bg-green-50 border border-green-100 text-green-600',
                    ongoing: 'bg-blue-50 border border-blue-100 text-blue-600',
                    completed: 'bg-gray-100 border border-gray-200 text-gray-600',
                    cancelled: 'bg-red-50 border border-red-100 text-red-600',
                  }[status]

                  return (
                    <div key={schedule.id} className="py-4 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className="text-sm font-bold text-gray-900 leading-tight">{schedule.title}</h4>
                          <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase ${badgeClass}`}>
                            {status}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          🕒 {formatTime12(schedule.startTime)} - {formatTime12(schedule.endTime)}
                        </p>
                      </div>
                      <Link
                        to={`/attendance?scheduleId=${schedule.id}`}
                        className="rounded-lg bg-blue-600 hover:bg-blue-500 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors cursor-pointer select-none shadow-sm"
                      >
                        Quick Attendance
                      </Link>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="py-8 text-center text-sm text-gray-400 italic">
                No schedules today.
              </div>
            )}
          </Card>

          {/* Recent Activity Feed */}
          <Card title="Recent Activity" description="Latest updates across members and schedules.">
            {data.activities.length > 0 ? (
              <div className="space-y-4">
                {data.activities.map((activity) => (
                  <div key={activity.id} className="flex items-start space-x-3 text-sm">
                    <span className="text-blue-500 mt-1 font-bold h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
                    <div className="flex-1">
                      <p className="text-gray-700 font-medium leading-tight">{activity.description}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{formatActivityTime(activity.timestamp)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-sm text-gray-400 italic">
                No recent activity.
              </div>
            )}
          </Card>
        </div>

        {/* Quick Actions Panel */}
        <div>
          <Card title="Quick Tasks" description="Quick access shortcuts.">
            <div className="space-y-2">
              <Link
                to="/members"
                className="flex items-center justify-between rounded-lg bg-gray-50 border border-gray-200/60 hover:bg-gray-100/60 px-4 py-3 text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                <span className="font-medium">Add New Member</span>
                <span className="text-gray-400">→</span>
              </Link>
              <Link
                to="/schedules"
                className="flex items-center justify-between rounded-lg bg-gray-50 border border-gray-200/60 hover:bg-gray-100/60 px-4 py-3 text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                <span className="font-medium">Create Schedule</span>
                <span className="text-gray-400">→</span>
              </Link>
              <Link
                to="/reports"
                className="flex items-center justify-between rounded-lg bg-gray-50 border border-gray-200/60 hover:bg-gray-100/60 px-4 py-3 text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                <span className="font-medium">View Reports</span>
                <span className="text-gray-400">→</span>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
