import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '@/components/Card'
import { dashboardService, type ActivityLog } from '@/services/dashboardService'
import type { Schedule } from '@/types/schedule'
import { getScheduleStatus } from '@/utils/scheduleUtils'

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
      <div className="py-24 flex flex-col items-center justify-center space-y-3 bg-gray-950/10 rounded-lg border border-gray-800">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
        <span className="text-xs text-gray-500">Loading dashboard overview...</span>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="rounded border border-red-900 bg-red-950/40 p-4 text-sm text-red-400">
        {error || 'Failed to load dashboard data.'}
      </div>
    )
  }

  const cardStats = [
    { name: 'Active Members', value: String(data.stats.activeMembers), color: 'text-green-400', bg: 'bg-green-950/10', border: 'border-green-900/20' },
    { name: 'Archived Members', value: String(data.stats.archivedMembers), color: 'text-gray-400', bg: 'bg-gray-950/10', border: 'border-gray-900/20' },
    { name: 'Upcoming Schedules', value: String(data.stats.upcomingSchedules), color: 'text-emerald-400', bg: 'bg-emerald-950/10', border: 'border-emerald-900/20' },
    { 
      name: 'Ongoing Schedule', 
      value: data.stats.ongoingSchedules > 0 ? String(data.stats.ongoingSchedules) : 'No ongoing schedule', 
      color: 'text-blue-400', 
      bg: 'bg-blue-950/10', 
      border: 'border-blue-900/20',
      isText: data.stats.ongoingSchedules === 0
    },
    { name: 'Completed Schedules', value: String(data.stats.completedSchedules), color: 'text-purple-400', bg: 'bg-purple-950/10', border: 'border-purple-900/20' },
    { name: 'Attendance Sessions', value: String(data.stats.attendanceSessionsCount), color: 'text-amber-400', bg: 'bg-amber-950/10', border: 'border-amber-900/20' },
  ]

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Dashboard</h1>
        <p className="text-sm text-gray-400 mt-1">
          Welcome back. Here is an overview of today's ministry services.
        </p>
      </div>

      {/* Real-time Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {cardStats.map((stat) => (
          <Card key={stat.name} className={`${stat.bg} ${stat.border}`}>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 leading-tight">
                {stat.name}
              </span>
              <span className={`font-extrabold mt-2 leading-none ${stat.color} ${stat.isText ? 'text-xs whitespace-normal font-semibold' : 'text-3xl'}`}>
                {stat.value}
              </span>
            </div>
          </Card>
        ))}
      </div>

      {/* Main Grid: Today's Schedule & Recent Activity (col-span-2) + Quick Actions (col-span-1) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          
          {/* Today's Schedule */}
          <Card title="Today's Schedule" description="Active services scheduled for today.">
            {data.todaySchedules.length > 0 ? (
              <div className="divide-y divide-gray-800">
                {data.todaySchedules.map((schedule) => {
                  const status = getScheduleStatus(schedule)
                  const badgeClass = {
                    upcoming: 'bg-green-500/10 border border-green-500/20 text-green-400',
                    ongoing: 'bg-blue-500/10 border border-blue-500/20 text-blue-400',
                    completed: 'bg-gray-500/10 border border-gray-500/20 text-gray-400',
                    cancelled: 'bg-red-500/10 border border-red-500/20 text-red-400',
                  }[status]

                  return (
                    <div key={schedule.id} className="py-4 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className="text-sm font-bold text-white leading-tight">{schedule.title}</h4>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${badgeClass}`}>
                            {status}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                          {formatTime12(schedule.startTime)} - {formatTime12(schedule.endTime)}
                        </p>
                      </div>
                      <Link
                        to={`/attendance?scheduleId=${schedule.id}`}
                        className="rounded bg-indigo-600 hover:bg-indigo-500 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors cursor-pointer select-none"
                      >
                        Quick Attendance
                      </Link>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="py-8 text-center text-sm text-gray-500 italic">
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
                    <span className="text-indigo-500 mt-0.5 font-bold">•</span>
                    <div className="flex-1">
                      <p className="text-gray-200 font-medium leading-tight">{activity.description}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">{formatActivityTime(activity.timestamp)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-sm text-gray-500 italic">
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
                className="flex items-center justify-between rounded bg-gray-900 border border-gray-800 hover:bg-gray-800/80 px-4 py-3 text-sm text-gray-300 hover:text-white transition-colors"
              >
                <span>Add New Member</span>
                <span className="text-gray-500">→</span>
              </Link>
              <Link
                to="/schedules"
                className="flex items-center justify-between rounded bg-gray-900 border border-gray-800 hover:bg-gray-800/80 px-4 py-3 text-sm text-gray-300 hover:text-white transition-colors"
              >
                <span>Create Schedule</span>
                <span className="text-gray-500">→</span>
              </Link>
              <Link
                to="/reports"
                className="flex items-center justify-between rounded bg-gray-900 border border-gray-800 hover:bg-gray-800/80 px-4 py-3 text-sm text-gray-300 hover:text-white transition-colors"
              >
                <span>View Reports</span>
                <span className="text-gray-500">→</span>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
