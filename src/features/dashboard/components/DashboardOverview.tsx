import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '@/components/Card'
import { dashboardService, type ActivityLog, type BirthdayCelebrant } from '@/services/dashboardService'
import type { Schedule } from '@/types/schedule'
import { getScheduleStatus } from '@/utils/scheduleUtils'
import { getOrderBadgeStyle } from '@/types/member'
import { DashboardCharts } from './DashboardCharts'
import { nativeWidgetService } from '@/services/nativeWidgetService'

const statIcons: { [key: string]: React.ReactNode } = {
  'Active Members': (
    <svg className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  'Suspended (This Month)': (
    <svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
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

import { useAuth } from '@/features/authentication/AuthContext'
import { Loading } from '@/components/Loading'

// Order Theme Palette Mapping
const ORDER_THEMES: Record<string, {
  bannerGradient: string
  accentGlow: string
  cardBg: string
  cardBorder: string
  iconBg: string
  iconBorder: string
  iconColor: string
  labelColor: string
  accentText: string
}> = {
  'Order of San Pedro': {
    bannerGradient: 'from-rose-950 via-red-900 to-slate-950 border-rose-800/40',
    accentGlow: 'bg-rose-500/20',
    cardBg: 'bg-rose-500/15',
    cardBorder: 'border-rose-400/30',
    iconBg: 'bg-rose-500/25',
    iconBorder: 'border-rose-400/40',
    iconColor: 'text-rose-300',
    labelColor: 'text-rose-200',
    accentText: 'text-rose-200',
  },
  'Order of San Juan': {
    bannerGradient: 'from-blue-950 via-indigo-900 to-slate-950 border-blue-800/40',
    accentGlow: 'bg-blue-500/20',
    cardBg: 'bg-blue-500/15',
    cardBorder: 'border-blue-400/30',
    iconBg: 'bg-blue-500/25',
    iconBorder: 'border-blue-400/40',
    iconColor: 'text-blue-300',
    labelColor: 'text-blue-200',
    accentText: 'text-blue-200',
  },
  'Order of San Tiago': {
    bannerGradient: 'from-emerald-950 via-teal-900 to-slate-950 border-emerald-800/40',
    accentGlow: 'bg-emerald-500/20',
    cardBg: 'bg-emerald-500/15',
    cardBorder: 'border-emerald-400/30',
    iconBg: 'bg-emerald-500/25',
    iconBorder: 'border-emerald-400/40',
    iconColor: 'text-emerald-300',
    labelColor: 'text-emerald-200',
    accentText: 'text-emerald-200',
  },
  'Order of San Andres': {
    bannerGradient: 'from-amber-950 via-yellow-900 to-slate-950 border-amber-800/40',
    accentGlow: 'bg-amber-500/20',
    cardBg: 'bg-amber-500/15',
    cardBorder: 'border-amber-400/30',
    iconBg: 'bg-amber-500/25',
    iconBorder: 'border-amber-400/40',
    iconColor: 'text-amber-300',
    labelColor: 'text-amber-200',
    accentText: 'text-amber-200',
  },
  'Officers': {
    bannerGradient: 'from-purple-950 via-indigo-950 to-slate-950 border-purple-800/40',
    accentGlow: 'bg-purple-500/20',
    cardBg: 'bg-purple-500/15',
    cardBorder: 'border-purple-400/30',
    iconBg: 'bg-purple-500/25',
    iconBorder: 'border-purple-400/40',
    iconColor: 'text-purple-300',
    labelColor: 'text-purple-200',
    accentText: 'text-purple-200',
  },
  'Squires': {
    bannerGradient: 'from-cyan-950 via-teal-950 to-slate-950 border-cyan-800/40',
    accentGlow: 'bg-cyan-500/20',
    cardBg: 'bg-cyan-500/15',
    cardBorder: 'border-cyan-400/30',
    iconBg: 'bg-cyan-500/25',
    iconBorder: 'border-cyan-400/40',
    iconColor: 'text-cyan-300',
    labelColor: 'text-cyan-200',
    accentText: 'text-cyan-200',
  }
}

// Default fallback theme
const DEFAULT_THEME = {
  bannerGradient: 'from-indigo-900 via-indigo-800 to-slate-900 border-indigo-100',
  accentGlow: 'bg-indigo-500/20',
  cardBg: 'bg-white/10',
  cardBorder: 'border-white/15',
  iconBg: 'bg-indigo-500/20',
  iconBorder: 'border-indigo-400/30',
  iconColor: 'text-indigo-200',
  labelColor: 'text-indigo-200',
  accentText: 'text-indigo-200',
}

export const DashboardOverview: React.FC = () => {
  const { profile } = useAuth()
  const userOrder = profile?.assignedOrder
  const orderTheme = (userOrder && ORDER_THEMES[userOrder]) ? ORDER_THEMES[userOrder] : DEFAULT_THEME

  const [data, setData] = useState<{
    stats: any
    todaySchedules: Schedule[]
    activities: ActivityLog[]
    monthBirthdays: BirthdayCelebrant[]
  } | null>(null)
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        setLoading(true)
        const dashboardData = await dashboardService.getDashboardData(userOrder)
        setData(dashboardData)
        nativeWidgetService.syncUpcomingMassesWidget(undefined, undefined, profile).catch(() => {})
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
    const dateStr = dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    const timeStr = dateObj.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    return `${dateStr} at ${timeStr}`
  }

  if (loading) {
    return (
      <div className="py-24 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
        <Loading variant="spinner" label="Loading Dashboard Overview..." />
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
    { 
      name: userOrder ? `Warning (${userOrder})` : (data.stats.operatingCycleTitle ? `Warning (${data.stats.operatingCycleTitle})` : 'Warning for Suspension'), 
      value: String(userOrder ? (data.stats.userOrderWarningCount ?? 0) : (data.stats.warningMembersCount ?? 0)), 
      color: 'text-amber-600', 
      bg: 'bg-amber-50/50', 
      border: 'border-amber-100', 
      desc: userOrder 
        ? `${data.stats.userOrderWarningCount ?? 0} servers under warning in ${userOrder}` 
        : 'Servers with active attendance warning' 
    },
    { 
      name: userOrder ? `Suspended (${userOrder})` : (data.stats.operatingCycleTitle ? `Suspended (${data.stats.operatingCycleTitle})` : 'Suspended (This Month)'), 
      value: String(userOrder ? data.stats.userOrderSuspendedCount : data.stats.suspendedMembersCount), 
      color: 'text-red-600', 
      bg: 'bg-red-50/50', 
      border: 'border-red-100', 
      desc: userOrder 
        ? `${data.stats.userOrderSuspendedCount} suspended in ${userOrder}` 
        : (data.stats.operatingCycleMonths && data.stats.operatingCycleMonths > 1
            ? `Total suspended profiles in ${data.stats.operatingCycleMonths}-month operating cycle`
            : 'Total suspended profiles for current cycle')
    },
  ]

  // Helper for clean user greeting display
  const getUserGreetingName = () => {
    if (!profile) return 'Server'
    
    if (profile.role === 'order_leader') {
      const shortName = userOrder ? userOrder.replace(/^Order of\s*/i, '') : ''
      return shortName ? `Leader of ${shortName}` : 'Order Leader'
    }

    if (profile.email) {
      const prefix = profile.email.split('@')[0]
      return prefix.charAt(0).toUpperCase() + prefix.slice(1)
    }

    return 'Server'
  }

  return (
    <div className="space-y-6">
      {/* Dynamic Role & User Welcome Banner */}
      <div className={`relative overflow-hidden rounded-3xl border bg-gradient-to-r ${orderTheme.bannerGradient} p-6 text-white shadow-xl transition-all duration-300`}>
        <div className={`absolute -top-12 -right-12 h-48 w-48 rounded-full ${orderTheme.accentGlow} blur-3xl pointer-events-none`}></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs font-bold uppercase tracking-wider ${orderTheme.labelColor}`}>
                {new Date().getHours() < 12 ? 'Good Morning' : new Date().getHours() < 18 ? 'Good Afternoon' : 'Good Evening'}
              </span>
              <span className="h-1.5 w-1.5 rounded-full bg-white/40"></span>
              {(profile?.role as string) === 'coordinator' && (
                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                  System Coordinator
                </span>
              )}
              {profile?.role === 'admin' && (
                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-slate-700/60 text-slate-200 border border-slate-600/50">
                  Administrator
                </span>
              )}
              {profile?.role === 'user' && (
                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-sky-500/30 text-sky-200 border border-sky-400/30">
                  Altar Server
                </span>
              )}
            </div>
            
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Welcome back, <span className={orderTheme.accentText}>{getUserGreetingName()}</span>!
            </h1>
            
            <p className="text-xs text-white/80 max-w-xl">
              {userOrder 
                ? `You are managing the ${userOrder} group. Here is your order's service overview and member activity.`
                : "Here is your real-time overview of ministry schedules, server attendance, and active operations."}
            </p>

            {data.monthBirthdays.filter(b => b.isToday).length > 0 && (
              <div className="pt-1 flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-400/20 text-amber-200 border border-amber-400/40 backdrop-blur-md">
                  <svg className="w-3.5 h-3.5 text-amber-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                  <span>Today's Birthday:</span>
                  <span className="text-white font-extrabold">
                    {data.monthBirthdays.filter(b => b.isToday).map(b => b.fullName).join(', ')}
                  </span>
                </span>
              </div>
            )}
          </div>

          {userOrder && (
            <div className={`shrink-0 ${orderTheme.cardBg} backdrop-blur-md border ${orderTheme.cardBorder} p-3.5 rounded-2xl flex items-center gap-3 shadow-lg`}>
              <div className={`h-10 w-10 rounded-xl ${orderTheme.iconBg} border ${orderTheme.iconBorder} flex items-center justify-center ${orderTheme.iconColor} font-black shrink-0`}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div>
                <div className={`text-[10px] font-extrabold uppercase tracking-wider ${orderTheme.labelColor}`}>Assigned Ministry Group</div>
                <div className="text-sm font-extrabold text-white">{userOrder}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Real-time Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cardStats.map((stat) => (
          <Card key={stat.name} className={`${stat.bg} ${stat.border} hover:shadow-md transition-shadow duration-250 flex flex-col justify-between`}>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 leading-tight">
                  {stat.name}
                </span>
                <span className="shrink-0">
                  {stat.name.startsWith('Suspended') ? (
                    <svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                  ) : stat.name.startsWith('Warning') ? (
                    <svg className="h-5 w-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  ) : statIcons[stat.name]}
                </span>
              </div>
              <span className={`font-extrabold leading-none ${stat.color} text-3xl block`}>
                {stat.value}
              </span>
            </div>
            <p className="text-[10px] text-gray-400 leading-tight mt-3">{stat.desc}</p>
          </Card>
        ))}
      </div>

      <DashboardCharts stats={data.stats} />

      {/* Main Grid: Today's Schedule & Recent Activity (col-span-2) + Quick Actions (col-span-1) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          
          {/* Today's Schedule */}
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

          {/* Recent Activity Feed */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs">
            <div className="pb-4 border-b border-slate-100">
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight">Recent Activity Stream</h3>
              <p className="text-xs text-slate-500 mt-0.5 font-medium font-sans">Real-time audit log feed across all operations</p>
            </div>

            <div className="pt-5">
              {data.activities.length > 0 ? (
                <div className="relative border-l-2 border-slate-100 ml-3.5 space-y-6">
                  {data.activities.map((activity) => (
                    <div key={activity.id} className="relative pl-6">
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

        {/* Right Column: Birthdays & Quick Actions */}
        <div className="space-y-6">
          {/* Birthday Celebrants This Month Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-pink-50 border border-pink-100 flex items-center justify-center text-pink-600 shrink-0">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 15.546c-.523 0-1.046.151-1.5.454a2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.701 2.701 0 00-1.5-.454M9 6v2m3-2v2m3-2v2M9 3h.01M12 3h.01M15 3h.01M3 21h18M4 21V10a2 2 0 012-2h12a2 2 0 012 2v11" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                    {new Date().toLocaleString('en-US', { month: 'long' })} Birthdays
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">Monthly server celebrants</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-pink-50 text-pink-700 border border-pink-200/60">
                {data.monthBirthdays.length} {data.monthBirthdays.length === 1 ? 'Celebrant' : 'Celebrants'}
              </span>
            </div>

            {/* List of Celebrants */}
            <div className="space-y-2.5 pt-1 max-h-[380px] overflow-y-auto pr-0.5">
              {data.monthBirthdays.length > 0 ? (
                data.monthBirthdays.map((b) => {
                  const isToday = b.isToday
                  const isTomorrow = b.daysRemaining === 1
                  const isUpcoming = b.daysRemaining > 1
                  const isPassed = b.daysRemaining < 0

                  return (
                    <div
                      key={b.id}
                      className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                        isToday
                          ? 'bg-gradient-to-r from-amber-50/90 via-rose-50/70 to-pink-50/90 border-amber-300 shadow-xs'
                          : 'bg-slate-50/50 hover:bg-slate-50 border-slate-200/70'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                          isToday
                            ? 'bg-rose-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}>
                          {b.birthDay}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-slate-900 truncate">
                            {b.fullName}
                            {b.nickname && <span className="text-slate-400 font-normal ml-1">({b.nickname})</span>}
                          </h4>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span className="text-[10px] text-slate-500 font-medium">{b.rank}</span>
                            {b.order && (
                              <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold border ${getOrderBadgeStyle(b.order)}`}>
                                {b.order}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Birthday Status Badge */}
                      <div className="shrink-0 text-right">
                        {isToday ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-600 text-white shadow-xs">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>Today</span>
                          </span>
                        ) : isTomorrow ? (
                          <div className="flex flex-col items-end">
                            <span className="text-xs font-bold text-amber-700">{b.formattedDate}</span>
                            <span className="text-[9.5px] font-bold text-amber-600">Tomorrow</span>
                          </div>
                        ) : isUpcoming ? (
                          <div className="flex flex-col items-end">
                            <span className="text-xs font-bold text-slate-800">{b.formattedDate}</span>
                            <span className="text-[9.5px] font-semibold text-emerald-600">In {b.daysRemaining} days</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-end opacity-60">
                            <span className="text-xs font-medium text-slate-600">{b.formattedDate}</span>
                            <span className="text-[9px] text-slate-400">Passed</span>
                          </div>
                        )}
                        {b.turningAge && (
                          <span className="text-[9px] text-slate-400 block font-medium">
                            {isPassed ? `Turned ${b.turningAge}` : `Turns ${b.turningAge}`}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="py-8 text-center text-xs font-semibold text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200 flex flex-col items-center justify-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <span>No member birthdays recorded for {new Date().toLocaleString('en-US', { month: 'long' })}.</span>
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions Panel */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-4">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight">Quick Tasks & Actions</h3>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">Fast shortcuts for common ministry operations</p>
            </div>

            <div className="space-y-3 pt-2">
              <Link
                to="/members"
                className="group flex items-start gap-3.5 p-3.5 rounded-xl border border-slate-200/80 bg-white hover:bg-indigo-50/40 hover:border-indigo-200 transition-all shadow-2xs hover:shadow-xs"
              >
                <div className="p-2.5 rounded-xl border bg-indigo-50 text-indigo-600 border-indigo-100 shrink-0">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-extrabold text-slate-900 group-hover:text-indigo-600 transition-colors">Add New Member</h4>
                    <span className="text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all text-xs font-bold">→</span>
                  </div>
                  <p className="text-[11px] font-medium text-slate-500 mt-0.5 line-clamp-1">Register a server to the ministry</p>
                </div>
              </Link>

              <Link
                to="/schedules"
                className="group flex items-start gap-3.5 p-3.5 rounded-xl border border-slate-200/80 bg-white hover:bg-indigo-50/40 hover:border-indigo-200 transition-all shadow-2xs hover:shadow-xs"
              >
                <div className="p-2.5 rounded-xl border bg-emerald-50 text-emerald-600 border-emerald-100 shrink-0">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-extrabold text-slate-900 group-hover:text-indigo-600 transition-colors">Create Schedule</h4>
                    <span className="text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all text-xs font-bold">→</span>
                  </div>
                  <p className="text-[11px] font-medium text-slate-500 mt-0.5 line-clamp-1">Plan a service or mass schedule</p>
                </div>
              </Link>

              <Link
                to="/reports"
                className="group flex items-start gap-3.5 p-3.5 rounded-xl border border-slate-200/80 bg-white hover:bg-indigo-50/40 hover:border-indigo-200 transition-all shadow-2xs hover:shadow-xs"
              >
                <div className="p-2.5 rounded-xl border bg-amber-50 text-amber-600 border-amber-100 shrink-0">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-extrabold text-slate-900 group-hover:text-indigo-600 transition-colors">View Reports</h4>
                    <span className="text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all text-xs font-bold">→</span>
                  </div>
                  <p className="text-[11px] font-medium text-slate-500 mt-0.5 line-clamp-1">Export summary analytics & PDF</p>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
