import React, { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { dashboardService, type ActivityLog, type BirthdayCelebrant } from '@/services/dashboardService'
import type { Schedule } from '@/types/schedule'
import type { Member } from '@/types/member'
import { getScheduleStatus } from '@/utils/scheduleUtils'
import { getOrderBadgeStyle } from '@/types/member'
import { nativeWidgetService } from '@/services/nativeWidgetService'
import { FilterDropdown } from '@/components'
import { useAuth } from '@/features/authentication/AuthContext'
import { Loading } from '@/components/Loading'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'

// Order Theme Palette Mapping matching MATS Design System
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
    bannerGradient: 'from-pink-950 via-rose-950 to-slate-950 border-pink-800/40',
    accentGlow: 'bg-pink-500/20',
    cardBg: 'bg-pink-500/15',
    cardBorder: 'border-pink-400/30',
    iconBg: 'bg-pink-500/25',
    iconBorder: 'border-pink-400/40',
    iconColor: 'text-pink-300',
    labelColor: 'text-pink-200',
    accentText: 'text-pink-200',
  },
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

// Group Colors mapping for charts
const GROUP_COLORS: Record<string, string> = {
  'Order of San Pedro': '#ef4444',
  'San Pedro': '#ef4444',
  'Order of San Juan': '#3b82f6',
  'San Juan': '#3b82f6',
  'Order of San Tiago': '#10b981',
  'San Tiago': '#10b981',
  'Order of San Andres': '#f59e0b',
  'San Andres': '#f59e0b',
  'Officers': '#8b5cf6',
  'Squires': '#ec4899',
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
    members?: Member[]
  } | null>(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sideTab, setSideTab] = useState<'birthdays' | 'activity'>('birthdays')

  const currentMonthNumber = useMemo(() => new Date().getMonth() + 1, [])
  const currentYearNumber = useMemo(() => new Date().getFullYear(), [])
  const [selectedBirthdayMonth, setSelectedBirthdayMonth] = useState<number>(currentMonthNumber)

  const monthFilterOptions = useMemo(() => [
    { key: '1', label: 1 === currentMonthNumber ? 'January (Current Month)' : 'January', dot: 1 === currentMonthNumber ? 'bg-pink-500' : 'bg-slate-400' },
    { key: '2', label: 2 === currentMonthNumber ? 'February (Current Month)' : 'February', dot: 2 === currentMonthNumber ? 'bg-pink-500' : 'bg-slate-400' },
    { key: '3', label: 3 === currentMonthNumber ? 'March (Current Month)' : 'March', dot: 3 === currentMonthNumber ? 'bg-pink-500' : 'bg-slate-400' },
    { key: '4', label: 4 === currentMonthNumber ? 'April (Current Month)' : 'April', dot: 4 === currentMonthNumber ? 'bg-pink-500' : 'bg-slate-400' },
    { key: '5', label: 5 === currentMonthNumber ? 'May (Current Month)' : 'May', dot: 5 === currentMonthNumber ? 'bg-pink-500' : 'bg-slate-400' },
    { key: '6', label: 6 === currentMonthNumber ? 'June (Current Month)' : 'June', dot: 6 === currentMonthNumber ? 'bg-pink-500' : 'bg-slate-400' },
    { key: '7', label: 7 === currentMonthNumber ? 'July (Current Month)' : 'July', dot: 7 === currentMonthNumber ? 'bg-pink-500' : 'bg-slate-400' },
    { key: '8', label: 8 === currentMonthNumber ? 'August (Current Month)' : 'August', dot: 8 === currentMonthNumber ? 'bg-pink-500' : 'bg-slate-400' },
    { key: '9', label: 9 === currentMonthNumber ? 'September (Current Month)' : 'September', dot: 9 === currentMonthNumber ? 'bg-pink-500' : 'bg-slate-400' },
    { key: '10', label: 10 === currentMonthNumber ? 'October (Current Month)' : 'October', dot: 10 === currentMonthNumber ? 'bg-pink-500' : 'bg-slate-400' },
    { key: '11', label: 11 === currentMonthNumber ? 'November (Current Month)' : 'November', dot: 11 === currentMonthNumber ? 'bg-pink-500' : 'bg-slate-400' },
    { key: '12', label: 12 === currentMonthNumber ? 'December (Current Month)' : 'December', dot: 12 === currentMonthNumber ? 'bg-pink-500' : 'bg-slate-400' },
  ], [currentMonthNumber])

  const pureMonthNames = useMemo(() => [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ], [])

  const selectedMonthLabel = pureMonthNames[selectedBirthdayMonth - 1] || 'Selected Month'

  const displayedBirthdays = useMemo(() => {
    if (!data?.members) {
      return data?.monthBirthdays || []
    }
    return dashboardService.calculateBirthdaysForMonth(
      data.members,
      selectedBirthdayMonth,
      currentYearNumber,
      'day'
    )
  }, [data?.members, data?.monthBirthdays, selectedBirthdayMonth, currentYearNumber])

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
  }, [userOrder, profile])

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

  // Group Performance / Attendance Participation Data
  const groupPerformanceData = useMemo(() => [
    { name: 'San Pedro', value: 35, percentage: '35%' },
    { name: 'San Juan', value: 28, percentage: '28%' },
    { name: 'San Tiago', value: 22, percentage: '22%' },
    { name: 'San Andres', value: 18, percentage: '18%' },
    { name: 'Officers', value: 15, percentage: '15%' },
    { name: 'Squires', value: 12, percentage: '12%' },
  ], [])

  // Monthly Attendance Trend
  const attendanceTrendData = useMemo(() => [
    { name: 'Feb', attendees: 45 },
    { name: 'Mar', attendees: 52 },
    { name: 'Apr', attendees: 48 },
    { name: 'May', attendees: 61 },
    { name: 'Jun', attendees: 55 },
    { name: 'Jul', attendees: Math.max(30, (data?.stats.activeMembers || 35) - 5) },
  ], [data?.stats.activeMembers])

  if (loading) {
    return (
      <div className="py-24 bg-white rounded-3xl border border-slate-200/80 shadow-2xs">
        <Loading variant="spinner" label="Loading Pro Master Controller..." />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-600 font-medium">
        {error || 'Failed to load dashboard data.'}
      </div>
    )
  }

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
      <div className={`relative overflow-hidden rounded-3xl border bg-gradient-to-r ${orderTheme.bannerGradient} p-6 sm:p-8 text-white shadow-xl transition-all duration-300`}>
        <div className={`absolute -top-12 -right-12 h-48 w-48 rounded-full ${orderTheme.accentGlow} blur-3xl pointer-events-none`}></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
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
              {profile?.role === 'order_leader' && (
                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-amber-500/30 text-amber-200 border border-amber-400/30">
                  Order Leader
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Welcome back, <span className={orderTheme.accentText}>{getUserGreetingName()}</span>!
            </h1>

            <p className="text-xs text-white/80 max-w-xl font-medium leading-relaxed">
              {userOrder
                ? `You are managing the ${userOrder} group. Here is your real-time master controller for ministry schedules, server attendance, and active operations.`
                : 'Here is your real-time master controller for ministry schedules, server attendance, and active operations.'}
            </p>

            {data.monthBirthdays.filter((b) => b.isToday).length > 0 && (
              <div className="pt-1 flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-400/20 text-amber-200 border border-amber-400/40 backdrop-blur-md">
                  <svg className="w-3.5 h-3.5 text-amber-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                  <span>Today's Birthday:</span>
                  <span className="text-white font-extrabold">
                    {data.monthBirthdays.filter((b) => b.isToday).map((b) => b.fullName).join(', ')}
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

      {/* High-Density 3-Column Compact Controller */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Column 1: Today's Duty Roster */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-2xs space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">Today's Duty Roster</h3>
                <p className="text-[11px] text-slate-400 font-medium">Active and upcoming mass services</p>
              </div>
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                {data.todaySchedules.length} {data.todaySchedules.length === 1 ? 'Service' : 'Services'}
              </span>
            </div>

            <div className="space-y-3 pt-3 max-h-[380px] overflow-y-auto pr-1">
              {data.todaySchedules.length > 0 ? (
                data.todaySchedules.map((schedule) => {
                  const status = getScheduleStatus(schedule)
                  const badgeClass = {
                    upcoming: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
                    ongoing: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
                    completed: 'bg-slate-100 text-slate-600 border-slate-200/80',
                    cancelled: 'bg-rose-50 text-rose-700 border-rose-200/80',
                  }[status]

                  const assignedCount = schedule.assignedMembers?.length || 0

                  return (
                    <div key={schedule.id} className="p-3.5 rounded-2xl border border-slate-200/80 bg-slate-50/50 hover:bg-slate-50 transition-all space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">
                          {formatTime12(schedule.startTime)} - {formatTime12(schedule.endTime)}
                        </span>
                        <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${badgeClass}`}>
                          {status}
                        </span>
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 leading-snug">{schedule.title}</h4>
                        <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                          {assignedCount} Servers assigned
                        </p>
                      </div>
                      <Link
                        to={`/attendance?scheduleId=${schedule.id}`}
                        className="block w-full py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold text-center transition-colors shadow-2xs"
                      >
                        Take Attendance
                      </Link>
                    </div>
                  )
                })
              ) : (
                <div className="py-12 text-center text-xs font-medium text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  No active mass duties scheduled for today.
                </div>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-400">Schedule Engine</span>
            <Link to="/schedules" className="text-xs font-bold text-indigo-600 hover:underline">
              Open Schedule Manager &rarr;
            </Link>
          </div>
        </div>

        {/* Column 2: Ministry Health Monitor & Operations */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-2xs space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">Ministry Health Monitor</h3>
                <p className="text-[11px] text-slate-400 font-medium">Member status and policy metrics</p>
              </div>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Active
              </span>
            </div>

            <div className="space-y-3 pt-3">
              <div className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-100/80 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-emerald-900 block">Active Servers</span>
                  <span className="text-[10px] text-emerald-700/80 font-medium">Ready for roster assignments</span>
                </div>
                <span className="text-2xl font-black text-emerald-700">{data.stats.activeMembers}</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-100/80 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-amber-900 block">Warning Threshold</span>
                  <span className="text-[10px] text-amber-700/80 font-medium">Servers nearing absence limit</span>
                </div>
                <span className="text-2xl font-black text-amber-700">
                  {userOrder ? (data.stats.userOrderWarningCount ?? 0) : (data.stats.warningMembersCount ?? 0)}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-rose-50/60 border border-rose-100/80 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-rose-900 block">Suspended Profiles</span>
                  <span className="text-[10px] text-rose-700/80 font-medium">Exceeded 2-month absence rule</span>
                </div>
                <span className="text-2xl font-black text-rose-700">
                  {userOrder ? (data.stats.userOrderSuspendedCount ?? 0) : (data.stats.suspendedMembersCount ?? 0)}
                </span>
              </div>

              {/* Quick Operation Buttons */}
              <div className="pt-1 grid grid-cols-2 gap-2">
                <Link
                  to="/members"
                  className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-indigo-50/60 hover:border-indigo-200 text-slate-800 text-[11px] font-bold text-center transition-all"
                >
                  + Add Member
                </Link>
                <Link
                  to="/schedules"
                  className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-emerald-50/60 hover:border-emerald-200 text-slate-800 text-[11px] font-bold text-center transition-all"
                >
                  + Create Schedule
                </Link>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-400">Attendance Policies</span>
            <Link to="/reports" className="text-xs font-bold text-slate-600 hover:underline">
              View Full Analytics &rarr;
            </Link>
          </div>
        </div>

        {/* Column 3: Tabbed Celebrants / Audit Feed */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-2xs space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setSideTab('birthdays')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                    sideTab === 'birthdays'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Birthdays ({displayedBirthdays.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSideTab('activity')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                    sideTab === 'activity'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Audit Feed
                </button>
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase">Live Feed</span>
            </div>

            {sideTab === 'birthdays' ? (
              <div className="space-y-2.5 pt-2 max-h-[380px] overflow-y-auto pr-1 text-xs">
                <FilterDropdown
                  value={String(selectedBirthdayMonth)}
                  onChange={(val) => setSelectedBirthdayMonth(Number(val))}
                  options={monthFilterOptions}
                  allLabel="Select Month"
                />

                {selectedBirthdayMonth !== currentMonthNumber && (
                  <div className="flex items-center justify-between pt-0.5">
                    <span className="text-[10px] font-semibold text-slate-400">
                      Viewing {selectedMonthLabel}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedBirthdayMonth(currentMonthNumber)}
                      className="text-[10px] font-bold text-pink-600 hover:text-pink-700 hover:underline cursor-pointer inline-flex items-center gap-1"
                    >
                      <span>&larr; Back to current month</span>
                    </button>
                  </div>
                )}

                {displayedBirthdays.length > 0 ? (
                  displayedBirthdays.map((b) => (
                    <div
                      key={b.id}
                      className={`p-2.5 rounded-2xl border flex items-center justify-between gap-2 transition-all ${
                        b.isToday
                          ? 'bg-gradient-to-r from-rose-50 to-pink-50 border-rose-300 shadow-2xs'
                          : 'bg-slate-50/50 hover:bg-slate-50 border-slate-100'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="font-bold text-slate-800 truncate">
                          {b.fullName}
                          {b.nickname && <span className="text-slate-400 font-normal ml-1">({b.nickname})</span>}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] text-slate-400">{b.rank}</span>
                          {b.order && (
                            <span className={`px-1.5 py-0.2 rounded text-[8.5px] font-bold border ${getOrderBadgeStyle(b.order)}`}>
                              {b.order}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-bold text-pink-600 block text-xs">
                          {b.birthDay} {pureMonthNames[selectedBirthdayMonth - 1]?.slice(0, 3)}
                        </span>
                        {b.isToday ? (
                          <span className="text-[9px] font-bold text-rose-600">Today</span>
                        ) : (
                          <span className="text-[9px] font-medium text-slate-400">
                            {b.daysRemaining > 0 ? `In ${b.daysRemaining}d` : 'Passed'}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center text-xs font-medium text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    No celebrants found for {selectedMonthLabel}.
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2 pt-2 max-h-[380px] overflow-y-auto pr-1 text-xs">
                {data.activities.length > 0 ? (
                  data.activities.slice(0, 8).map((act) => (
                    <div key={act.id} className="p-2.5 rounded-2xl border border-slate-100 bg-slate-50/50 space-y-0.5">
                      <p className="font-bold text-slate-800 leading-snug">{act.description}</p>
                      <p className="text-[10px] text-slate-400">{formatActivityTime(act.timestamp)}</p>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center text-xs font-medium text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    No recent audit activity recorded.
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="pt-3 text-center text-xs font-bold text-slate-400 border-t border-slate-100">
            Pro Master Controller
          </div>
        </div>
      </div>

      {/* High-Density Micro Analytics Row (Concept 6 Charts) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Attendance Volume Compact Trend Area Chart */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">Attendance Volume (6-Month Trend)</h3>
              <p className="text-[11px] text-slate-400 font-medium">Historical server duty counts across months</p>
            </div>
            <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/60 px-2.5 py-1 rounded-full">
              6mo Velocity
            </span>
          </div>
          <div className="h-44 w-full pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={attendanceTrendData} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="overviewAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 2" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                <Tooltip
                  formatter={(v: any) => [`${v} Servers`, 'Attendees']}
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                    color: '#0f172a',
                    fontWeight: 600,
                    fontSize: '11px',
                  }}
                />
                <Area type="monotone" dataKey="attendees" stroke="#4f46e5" strokeWidth={2.5} fillOpacity={1} fill="url(#overviewAreaGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Order Participation Split Micro Bar Chart */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">Order Participation Split</h3>
              <p className="text-[11px] text-slate-400 font-medium">Real-time attendance ratio across ministry groups</p>
            </div>
            <span className="text-[10px] font-bold text-slate-600 bg-slate-100 border border-slate-200/60 px-2.5 py-1 rounded-full">
              Micro Ratio
            </span>
          </div>
          <div className="h-44 w-full pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={groupPerformanceData} layout="vertical" margin={{ top: 5, right: 20, left: 30, bottom: 0 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#475569', fontWeight: 600 }} />
                <Tooltip
                  formatter={(v: any) => [`${v} Services`, 'Count']}
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                    color: '#0f172a',
                    fontWeight: 600,
                    fontSize: '11px',
                  }}
                />
                <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                  {groupPerformanceData.map((entry) => (
                    <Cell key={`bar-master-${entry.name}`} fill={GROUP_COLORS[entry.name] || '#4f46e5'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}
