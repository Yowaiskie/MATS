import React from 'react'
import { Link } from 'react-router-dom'
import { Card } from '@/components/Card'

export const DashboardOverview: React.FC = () => {
  // Static mock stats placeholders for Phase 2
  const stats = [
    { name: 'Present', value: '--', color: 'text-green-500', bg: 'bg-green-500/10', border: 'border-green-500/20' },
    { name: 'Late', value: '--', color: 'text-yellow-500', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
    { name: 'Absent', value: '--', color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20' },
    { name: 'Excused', value: '--', color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
  ]

  // Static mock schedule placeholders for Phase 2
  const todaySchedules = [
    { id: '1', title: 'Sunday Morning Worship', time: '09:00 AM', date: 'Today' },
    { id: '2', title: 'Sunday Evening Service', time: '06:00 PM', date: 'Today' },
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

      {/* Attendance Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.name} className={`${stat.bg} ${stat.border}`}>
            <div className="flex flex-col">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                {stat.name}
              </span>
              <span className={`text-3xl font-extrabold mt-2 ${stat.color}`}>
                {stat.value}
              </span>
            </div>
          </Card>
        ))}
      </div>

      {/* Today's Schedule and Main Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's Schedule */}
        <div className="lg:col-span-2">
          <Card title="Today's Schedule" description="Active services scheduled for today.">
            {todaySchedules.length > 0 ? (
              <div className="divide-y divide-gray-800">
                {todaySchedules.map((schedule) => (
                  <div key={schedule.id} className="py-4 first:pt-0 last:pb-0 flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-white">{schedule.title}</h4>
                      <p className="text-xs text-gray-400 mt-0.5">{schedule.time} • {schedule.date}</p>
                    </div>
                    <Link
                      to={`/attendance?scheduleId=${schedule.id}`}
                      className="rounded bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors"
                    >
                      Quick Attendance
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-sm text-gray-500">
                No services scheduled for today.
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
