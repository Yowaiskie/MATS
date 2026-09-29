import React, { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
  AreaChart,
  Area,
} from 'recharts'
import { dashboardService, type ActivityLog, type BirthdayCelebrant, type DashboardStats } from '@/services/dashboardService'
import type { Schedule } from '@/types/schedule'
import type { Member } from '@/types/member'
import { getScheduleStatus } from '@/utils/scheduleUtils'
import { CustomSelect } from '@/components/CustomSelect'
import { useAuth } from '@/features/authentication/AuthContext'
import { Loading } from '@/components/Loading'
import { Card } from '@/components/Card'

// Order Theme Palette Mapping
const ORDER_THEMES: Record<string, {
  name: string
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
    name: 'San Pedro (Red)',
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
    name: 'San Juan (Blue)',
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
    name: 'San Tiago (Green)',
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
    name: 'San Andres (Amber)',
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
    name: 'Officers (Purple)',
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
}

const DEFAULT_THEME = {
  name: 'Default Indigo',
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

const GROUP_COLORS: Record<string, string> = {
  'San Pedro': '#ef4444',
  'San Juan': '#3b82f6',
  'San Tiago': '#10b981',
  'San Andres': '#f59e0b',
  'Officers': '#8b5cf6',
  'Squires': '#ec4899',
}

type ConceptMode = 'concept1' | 'concept2' | 'concept3' | 'concept4' | 'concept5' | 'concept6'

export const DashboardRedesignLabPage: React.FC = () => {
  const { profile } = useAuth()
  const [activeConcept, setActiveConcept] = useState<ConceptMode>('concept1')
  const [previewOrder, setPreviewOrder] = useState<string>(profile?.assignedOrder || 'Order of San Pedro')

  const orderTheme = ORDER_THEMES[previewOrder] || DEFAULT_THEME

  const [data, setData] = useState<{
    stats: DashboardStats
    todaySchedules: Schedule[]
    activities: ActivityLog[]
    monthBirthdays: BirthdayCelebrant[]
    members?: Member[]
  } | null>(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Interactive Tab inside Concept 6
  const [c6SideTab, setC6SideTab] = useState<'birthdays' | 'activity'>('birthdays')

  const currentMonthNumber = useMemo(() => new Date().getMonth() + 1, [])
  const currentYearNumber = useMemo(() => new Date().getFullYear(), [])
  const [selectedBirthdayMonth, setSelectedBirthdayMonth] = useState<number>(currentMonthNumber)

  const monthOptions = useMemo(() => [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' },
  ], [])

  const pureMonthNames = useMemo(() => [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
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

  // Shared chart datasets
  const groupPerformanceData = useMemo(() => [
    { name: 'San Pedro', value: 35 },
    { name: 'San Juan', value: 28 },
    { name: 'San Tiago', value: 22 },
    { name: 'San Andres', value: 18 },
    { name: 'Officers', value: 15 },
    { name: 'Squires', value: 12 },
  ], [])

  const attendanceTrendData = useMemo(() => [
    { name: 'Feb', attendees: 42, rate: 84 },
    { name: 'Mar', attendees: 50, rate: 88 },
    { name: 'Apr', attendees: 46, rate: 82 },
    { name: 'May', attendees: 58, rate: 91 },
    { name: 'Jun', attendees: 52, rate: 86 },
    { name: 'Jul', attendees: Math.max(32, (data?.stats.activeMembers || 45) - 4), rate: 92 },
  ], [data?.stats.activeMembers])

  const scheduleStatusData = useMemo(() => [
    { name: 'Completed', count: data?.stats.completedSchedules || 24, fill: '#6366f1' },
    { name: 'Ongoing', count: data?.stats.ongoingSchedules || 2, fill: '#3b82f6' },
    { name: 'Upcoming', count: data?.stats.upcomingSchedules || 12, fill: '#10b981' },
  ], [data?.stats])

  const shiftRunwayData = useMemo(() => [
    { shift: '6:00 AM Mass', attendees: 8, capacity: 8 },
    { shift: '8:00 AM Mass', attendees: 7, capacity: 8 },
    { shift: '10:30 AM Binyag', attendees: 6, capacity: 6 },
    { shift: '4:00 PM Youth', attendees: 9, capacity: 10 },
    { shift: '6:00 PM Mass', attendees: 8, capacity: 8 },
  ], [])

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        setLoading(true)
        const dashboardData = await dashboardService.getDashboardData(previewOrder)
        setData(dashboardData)
      } catch (err: any) {
        console.error(err)
        setError('Failed to fetch real-time dashboard data.')
      } finally {
        setLoading(false)
      }
    }

    loadDashboard()
  }, [previewOrder])

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

  const formatActivityTime = (dateObj: Date) => {
    if (!dateObj) return ''
    const dateStr = dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    const timeStr = dateObj.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    return `${dateStr} at ${timeStr}`
  }

  const getUserGreetingName = () => {
    if (!profile) return 'Server'
    if (profile.role === 'order_leader') {
      const shortName = previewOrder ? previewOrder.replace(/^Order of\s*/i, '') : ''
      return shortName ? `Leader of ${shortName}` : 'Order Leader'
    }
    if (profile.email) {
      const prefix = profile.email.split('@')[0]
      return prefix.charAt(0).toUpperCase() + prefix.slice(1)
    }
    return 'Server'
  }

  if (loading) {
    return (
      <div className="py-24 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
        <Loading variant="spinner" label="Loading Dashboard Redesign Lab..." />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
        {error || 'Failed to load dashboard preview data.'}
      </div>
    )
  }

  // Common Welcome Back Card Component (Preserved across all 6 concepts)
  const renderWelcomeBackCard = () => (
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
            {previewOrder 
              ? `You are managing the ${previewOrder} group. Here is your order's service overview and member activity.`
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

        {previewOrder && (
          <div className={`shrink-0 ${orderTheme.cardBg} backdrop-blur-md border ${orderTheme.cardBorder} p-3.5 rounded-2xl flex items-center gap-3 shadow-lg`}>
            <div className={`h-10 w-10 rounded-xl ${orderTheme.iconBg} border ${orderTheme.iconBorder} flex items-center justify-center ${orderTheme.iconColor} font-black shrink-0`}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <div className={`text-[10px] font-extrabold uppercase tracking-wider ${orderTheme.labelColor}`}>Assigned Ministry Group</div>
              <div className="text-sm font-extrabold text-white">{previewOrder}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )

  const cardStats = [
    { 
      name: 'Active Members', 
      value: String(data.stats.activeMembers), 
      color: 'text-emerald-600', 
      bg: 'bg-emerald-50/50', 
      border: 'border-emerald-100', 
      desc: 'Registered and active servers' 
    },
    { 
      name: previewOrder ? `Warning (${previewOrder})` : 'Warning for Suspension', 
      value: String(previewOrder ? (data.stats.userOrderWarningCount ?? 0) : (data.stats.warningMembersCount ?? 0)), 
      color: 'text-amber-600', 
      bg: 'bg-amber-50/50', 
      border: 'border-amber-100', 
      desc: 'Servers with active attendance warning' 
    },
    { 
      name: previewOrder ? `Suspended (${previewOrder})` : 'Suspended (This Month)', 
      value: String(previewOrder ? data.stats.userOrderSuspendedCount : data.stats.suspendedMembersCount), 
      color: 'text-rose-600', 
      bg: 'bg-rose-50/50', 
      border: 'border-rose-100', 
      desc: 'Total suspended profiles in current cycle' 
    },
  ]

  return (
    <div className="space-y-6">
      {/* CONCEPT SWITCHER CONTROL BAR (Preview Lab Only) */}
      <div className="bg-slate-900 text-white p-4 rounded-2xl border border-slate-800 shadow-xl flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-indigo-500 text-white">
              Design Lab
            </span>
            <h2 className="text-sm font-bold text-slate-100">Dashboard Redesign Concepts & Custom Charts</h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Each concept features tailored graph styles (Gradients, Glass Donut, Bento Radial, Shift Wave, and Pro Sparklines).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Concept Tabs */}
          <div className="bg-slate-800/90 p-1 rounded-xl border border-slate-700/80 flex flex-wrap items-center gap-1">
            {[
              { id: 'concept1', label: '1. Operations Hub' },
              { id: 'concept2', label: '2. Bento Grid' },
              { id: 'concept3', label: '3. Executive Agenda' },
              { id: 'concept4', label: '4. Frosted Glass' },
              { id: 'concept5', label: '5. Service Runway' },
              { id: 'concept6', label: '6. Compact Master' },
            ].map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setActiveConcept(c.id as ConceptMode)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeConcept === c.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* Order Theme Switcher */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-400">Order:</span>
            <select
              value={previewOrder}
              onChange={(e) => setPreviewOrder(e.target.value)}
              className="bg-slate-800 text-xs font-bold text-slate-200 border border-slate-700 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500"
            >
              {Object.keys(ORDER_THEMES).map((orderKey) => (
                <option key={orderKey} value={orderKey}>
                  {ORDER_THEMES[orderKey].name}
                </option>
              ))}
            </select>
          </div>

          <Link
            to="/"
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-all border border-slate-700 shrink-0"
          >
            &larr; Back to Current
          </Link>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* CONCEPT 1: MODERN OPERATIONS COMMAND HUB                                  */}
      {/* ========================================================================= */}
      {activeConcept === 'concept1' && (
        <div className="space-y-6">
          {renderWelcomeBackCard()}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {cardStats.map((stat) => (
              <Card key={stat.name} className={`${stat.bg} ${stat.border} hover:shadow-md transition-shadow duration-250 flex flex-col justify-between`}>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 leading-tight">
                      {stat.name}
                    </span>
                    <span className="shrink-0 p-1.5 rounded-lg bg-white/80 border border-slate-200/50">
                      <span className={`w-2 h-2 rounded-full inline-block ${stat.color.replace('text-', 'bg-')}`} />
                    </span>
                  </div>
                  <span className={`font-extrabold leading-none ${stat.color} text-3xl block`}>
                    {stat.value}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-medium leading-tight mt-3">{stat.desc}</p>
              </Card>
            ))}
          </div>

          {/* CONCEPT 1 BESPOKE CHARTS: Sleek Smooth Area Wave + Donut */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">Attendance Wave</h3>
                  <p className="text-[11px] text-slate-400 font-medium">Monthly server participation trend</p>
                </div>
                <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                  92% Avg
                </span>
              </div>
              <div className="h-56 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={attendanceTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="c1IndigoGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.35}/>
                        <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                    <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }} />
                    <Area type="monotone" dataKey="attendees" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#c1IndigoGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">Order Participation</h3>
                  <p className="text-[11px] text-slate-400 font-medium">Service share by Order Group</p>
                </div>
                <span className="text-[10px] font-bold text-slate-500">6 Groups</span>
              </div>
              <div className="h-56 w-full pt-1">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={groupPerformanceData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={75}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {groupPerformanceData.map((entry) => (
                        <Cell key={`cell-c1-${entry.name}`} fill={GROUP_COLORS[entry.name] || '#6366f1'} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: any) => [`${v} Services`, 'Total']} contentStyle={{ borderRadius: '12px' }} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">Schedule Volumes</h3>
                  <p className="text-[11px] text-slate-400 font-medium">Completed, Ongoing & Upcoming</p>
                </div>
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                  {data.stats.completedSchedules + data.stats.upcomingSchedules} Total
                </span>
              </div>
              <div className="h-56 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={scheduleStatusData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                    <Tooltip contentStyle={{ borderRadius: '12px' }} />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                      {scheduleStatusData.map((entry) => (
                        <Cell key={`bar-c1-${entry.name}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 tracking-tight">Today's Schedule Operations</h3>
                    <p className="text-xs text-slate-500 mt-0.5 font-medium">Active and upcoming services scheduled for today</p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    {data.todaySchedules.length} Services
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
                                <span>{formatTime12(schedule.startTime)} - {formatTime12(schedule.endTime)}</span>
                                <span>{schedule.assignedMembers?.length || 0} Servers Assigned</span>
                              </div>
                            </div>

                            <Link
                              to={`/attendance?scheduleId=${schedule.id}`}
                              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-4 py-2 text-xs font-bold text-white shadow-xs hover:shadow-md active:scale-95 transition-all"
                            >
                              <span>Take Attendance</span>
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

              <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs">
                <div className="pb-4 border-b border-slate-100">
                  <h3 className="text-base font-extrabold text-slate-900 tracking-tight">Recent Activity Stream</h3>
                  <p className="text-xs text-slate-500 mt-0.5 font-medium">Real-time audit log feed across all operations</p>
                </div>

                <div className="pt-5">
                  {data.activities.length > 0 ? (
                    <div className="relative border-l-2 border-slate-100 ml-3.5 space-y-5">
                      {data.activities.map((activity) => (
                        <div key={activity.id} className="relative pl-6">
                          <span className="absolute -left-[9px] top-0.5 h-4 w-4 rounded-full border-2 border-white bg-indigo-600 shadow-2xs" />
                          <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:border-slate-200 transition-all">
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

            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 tracking-tight">Birthday Celebrants</h3>
                    <p className="text-xs text-slate-500 font-medium">{selectedMonthLabel} birthdays</p>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-pink-50 text-pink-700 border border-pink-200/60">
                    {displayedBirthdays.length} Total
                  </span>
                </div>

                <CustomSelect
                  id="bday-c1"
                  value={selectedBirthdayMonth}
                  onChange={(e) => setSelectedBirthdayMonth(Number(e.target.value))}
                  options={monthOptions}
                />

                <div className="space-y-2.5 pt-1 max-h-[360px] overflow-y-auto pr-0.5">
                  {displayedBirthdays.map((b) => (
                    <div
                      key={b.id}
                      className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                        b.isToday ? 'bg-rose-50/80 border-rose-300 shadow-xs' : 'bg-slate-50/50 border-slate-200/70'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                          b.isToday ? 'bg-rose-600 text-white' : 'bg-slate-200 text-slate-700'
                        }`}>
                          {b.birthDay}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-slate-900 truncate">{b.fullName}</h4>
                          <span className="text-[10px] text-slate-500 font-medium">{b.rank}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-bold text-slate-700 block">{b.formattedDate}</span>
                        <span className="text-[10px] font-semibold text-pink-600">{b.daysRemaining === 0 ? 'Today' : `In ${b.daysRemaining}d`}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-3">
                <h3 className="text-base font-extrabold text-slate-900 tracking-tight">Quick Operations</h3>
                <div className="grid grid-cols-1 gap-2.5 pt-1">
                  <Link to="/members" className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-indigo-50/50 transition-all flex items-center justify-between text-xs font-bold text-slate-800">
                    <span>Register New Member</span>
                    <span className="text-indigo-600">&rarr;</span>
                  </Link>
                  <Link to="/schedules" className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-emerald-50/50 transition-all flex items-center justify-between text-xs font-bold text-slate-800">
                    <span>Create New Schedule</span>
                    <span className="text-emerald-600">&rarr;</span>
                  </Link>
                  <Link to="/reports" className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-amber-50/50 transition-all flex items-center justify-between text-xs font-bold text-slate-800">
                    <span>Export Attendance Reports</span>
                    <span className="text-amber-600">&rarr;</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CONCEPT 2: BENTO MINISTRY SPACE                                           */}
      {/* ========================================================================= */}
      {activeConcept === 'concept2' && (
        <div className="space-y-6">
          {renderWelcomeBackCard()}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-2 bg-gradient-to-br from-slate-900 to-indigo-950 rounded-3xl p-6 text-white border border-slate-800 shadow-lg flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
                  Active Ministry Track
                </span>
                <span className="text-xs font-bold text-slate-400">Rotation 2026</span>
              </div>
              <div className="my-6">
                <span className="text-xs font-medium text-slate-400">Current Assigned Order:</span>
                <h3 className="text-2xl sm:text-3xl font-black text-white mt-1">{previewOrder}</h3>
                <p className="text-xs text-indigo-200 mt-2">Serving Baptism, Holy Hour Adorations, and Feast Celebrations.</p>
              </div>
              <div className="flex items-center gap-3 pt-3 border-t border-white/10 text-xs font-bold">
                <span>{data.stats.activeMembers} Members</span>
                <span className="text-slate-500">•</span>
                <span className="text-emerald-400">100% Operational</span>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-2xs flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Attendance Compliance</span>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-4xl font-black text-slate-900">92%</span>
                  <span className="text-xs font-bold text-emerald-600">+4% vs last cycle</span>
                </div>
              </div>
              <div className="space-y-2 mt-4">
                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                  <div className="bg-indigo-600 h-2.5 rounded-full" style={{ width: '92%' }}></div>
                </div>
                <p className="text-[11px] text-slate-500 font-medium">Completed mass sessions</p>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-2xs flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Absence Policy Monitor</span>
                <div className="mt-3 flex items-center justify-between">
                  <div>
                    <span className="text-3xl font-black text-amber-600">{data.stats.warningMembersCount || 0}</span>
                    <span className="text-xs font-semibold text-slate-500 block">Warning</span>
                  </div>
                  <div className="text-right">
                    <span className="text-3xl font-black text-rose-600">{data.stats.suspendedMembersCount || 0}</span>
                    <span className="text-xs font-semibold text-slate-500 block">Suspended</span>
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 mt-4">Automated 2-month absence rule</p>
            </div>

            {/* Bento Chart 1: Clean Integrated Order Share Radar Card */}
            <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">Order Share Radar</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Participation breakdown across ministries</p>
                </div>
                <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/60 px-2.5 py-1 rounded-full">
                  Real-time Share
                </span>
              </div>
              <div className="h-52 w-full pt-1">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={groupPerformanceData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {groupPerformanceData.map((entry) => (
                        <Cell key={`cell-bento-${entry.name}`} fill={GROUP_COLORS[entry.name] || '#6366f1'} stroke="#ffffff" strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: any) => [`${v} Services`, 'Count']}
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                        color: '#0f172a',
                        fontWeight: 600,
                        fontSize: '12px',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', color: '#475569', fontWeight: 500 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Bento Chart 2: Emerald Gradient Attendance Curve */}
            <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">Attendance Velocity</h3>
                  <p className="text-[11px] text-slate-400">Weekly active service counts</p>
                </div>
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                  +12% Trend
                </span>
              </div>
              <div className="h-52 w-full pt-1">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={attendanceTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="bentoEmeraldGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                    <Tooltip contentStyle={{ borderRadius: '12px' }} />
                    <Area type="monotone" dataKey="attendees" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#bentoEmeraldGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="lg:col-span-3 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 tracking-tight">Today's Liturgical Schedule</h3>
                  <p className="text-xs text-slate-500 font-medium">Mass and service assignments</p>
                </div>
                <Link to="/schedules" className="text-xs font-bold text-indigo-600 hover:underline">
                  View Full Calendar &rarr;
                </Link>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {data.todaySchedules.length > 0 ? (
                  data.todaySchedules.map((schedule) => (
                    <div key={schedule.id} className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/60 flex flex-col justify-between gap-3">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">
                            {formatTime12(schedule.startTime)}
                          </span>
                          <span className="text-[10px] font-extrabold uppercase text-slate-500">
                            {getScheduleStatus(schedule)}
                          </span>
                        </div>
                        <h4 className="text-sm font-extrabold text-slate-900 mt-2">{schedule.title}</h4>
                      </div>
                      <Link
                        to={`/attendance?scheduleId=${schedule.id}`}
                        className="w-full py-2 rounded-xl bg-slate-900 hover:bg-indigo-600 text-white text-xs font-bold text-center transition-colors"
                      >
                        Record Attendance
                      </Link>
                    </div>
                  ))
                ) : (
                  <div className="sm:col-span-2 py-8 text-center text-xs font-medium text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    No active mass services scheduled for today.
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-slate-900">Celebrants Radar</h3>
                <span className="text-xs font-bold text-pink-600">{displayedBirthdays.length}</span>
              </div>
              <CustomSelect
                id="bday-c2"
                value={selectedBirthdayMonth}
                onChange={(e) => setSelectedBirthdayMonth(Number(e.target.value))}
                options={monthOptions}
              />
              <div className="space-y-2 max-h-[160px] overflow-y-auto pt-1 pr-1">
                {displayedBirthdays.slice(0, 5).map((b) => (
                  <div key={b.id} className="flex items-center justify-between text-xs py-1 border-b border-slate-100 last:border-0">
                    <span className="font-bold text-slate-800 truncate pr-2">{b.fullName}</span>
                    <span className="text-[10px] font-bold text-pink-600 shrink-0">{b.birthDay} {pureMonthNames[selectedBirthdayMonth - 1]?.slice(0, 3)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CONCEPT 3: STREAMLINED EXECUTIVE AGENDA                                    */}
      {/* ========================================================================= */}
      {activeConcept === 'concept3' && (
        <div className="space-y-6">
          {renderWelcomeBackCard()}

          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-8 flex-wrap">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Active</span>
                <p className="text-xl font-black text-slate-900">{data.stats.activeMembers} Servers</p>
              </div>
              <div className="h-8 w-px bg-slate-200 hidden sm:block" />
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Warning Threshold</span>
                <p className="text-xl font-black text-amber-600">{data.stats.warningMembersCount || 0} Profiles</p>
              </div>
              <div className="h-8 w-px bg-slate-200 hidden sm:block" />
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Suspended</span>
                <p className="text-xl font-black text-rose-600">{data.stats.suspendedMembersCount || 0} Profiles</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link to="/members" className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 transition-colors">
                Server Directory
              </Link>
              <Link to="/reports" className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-indigo-600 text-xs font-bold text-white transition-colors">
                Export Reports
              </Link>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Today's Schedule Agenda</h3>
                <p className="text-xs text-slate-500 font-medium">Chronological roster of liturgical celebrations</p>
              </div>
              <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full">
                {data.todaySchedules.length} Assigned Today
              </span>
            </div>

            <div className="divide-y divide-slate-100">
              {data.todaySchedules.length > 0 ? (
                data.todaySchedules.map((schedule) => (
                  <div key={schedule.id} className="p-4 sm:px-6 hover:bg-slate-50/60 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-20 text-center py-1.5 bg-slate-100 rounded-lg shrink-0">
                        <span className="text-xs font-black text-slate-800 block">{formatTime12(schedule.startTime)}</span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase">{getScheduleStatus(schedule)}</span>
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">{schedule.title}</h4>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {schedule.assignedMembers?.length || 0} Altar Servers assigned
                        </p>
                      </div>
                    </div>
                    <Link
                      to={`/attendance?scheduleId=${schedule.id}`}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold text-center transition-colors shrink-0"
                    >
                      Record Attendance
                    </Link>
                  </div>
                ))
              ) : (
                <div className="py-12 text-center text-xs font-medium text-slate-400">
                  No scheduled masses or services found for today.
                </div>
              )}
            </div>
          </div>

          {/* CONCEPT 3 CHARTS: Editorial Minimalist Monochrome Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Attendance Trajectory</h3>
                <span className="text-xs font-semibold text-slate-400">6 Months</span>
              </div>
              <div className="h-48 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={attendanceTrendData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="2 2" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" axisLine={{ stroke: '#cbd5e1' }} tickLine={false} tick={{ fontSize: 10, fill: '#475569' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#475569' }} />
                    <Tooltip contentStyle={{ border: '1px solid #cbd5e1', borderRadius: '8px' }} />
                    <Line type="linear" dataKey="attendees" stroke="#0f172a" strokeWidth={2.5} dot={{ r: 3, fill: '#0f172a' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Schedule Status Breakdown</h3>
                <span className="text-xs font-semibold text-slate-400">Distribution</span>
              </div>
              <div className="h-48 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={scheduleStatusData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="2 2" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" axisLine={{ stroke: '#cbd5e1' }} tickLine={false} tick={{ fontSize: 10, fill: '#475569' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#475569' }} />
                    <Tooltip contentStyle={{ border: '1px solid #cbd5e1', borderRadius: '8px' }} />
                    <Bar dataKey="count" fill="#334155" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">Birthday Celebrants</h3>
                  <p className="text-xs text-slate-500 font-medium">Viewing {selectedMonthLabel}</p>
                </div>
                <div className="w-40">
                  <CustomSelect
                    id="bday-c3"
                    value={selectedBirthdayMonth}
                    onChange={(e) => setSelectedBirthdayMonth(Number(e.target.value))}
                    options={monthOptions}
                  />
                </div>
              </div>

              <div className="space-y-2 pt-1 max-h-[220px] overflow-y-auto pr-1">
                {displayedBirthdays.map((b) => (
                  <div key={b.id} className="p-2.5 rounded-xl border border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800">{b.fullName} ({b.rank})</span>
                    <span className="font-bold text-pink-600">{b.formattedDate}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-3">
              <h3 className="text-sm font-extrabold text-slate-900">System Activity Stream</h3>
              <div className="space-y-2.5 max-h-[220px] overflow-y-auto pt-1 pr-1">
                {data.activities.slice(0, 5).map((act) => (
                  <div key={act.id} className="p-2.5 rounded-xl border border-slate-100 bg-slate-50/50 text-xs">
                    <p className="font-bold text-slate-800 leading-snug">{act.description}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{formatActivityTime(act.timestamp)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CONCEPT 4: LITURGICAL FROSTED GLASS & DYNAMIC WIDGETS                     */}
      {/* ========================================================================= */}
      {activeConcept === 'concept4' && (
        <div className="space-y-6">
          {renderWelcomeBackCard()}

          {/* Frosted Glass Telemetry Widgets */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-white/80 backdrop-blur-xl p-5 rounded-3xl border border-indigo-100/80 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700">Liturgical Clock</span>
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              </div>
              <div className="my-3">
                <div className="text-2xl font-black text-slate-900">
                  {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
                <p className="text-xs font-semibold text-slate-500 mt-0.5">
                  {data.todaySchedules.length} Mass {data.todaySchedules.length === 1 ? 'Service' : 'Services'} on Deck Today
                </p>
              </div>
              <div className="pt-2 border-t border-indigo-100/60 flex items-center justify-between text-[11px] font-bold text-indigo-900">
                <span>Active Duty: {previewOrder}</span>
                <span className="text-emerald-600">On Schedule</span>
              </div>
            </div>

            <div className="bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-white/80 backdrop-blur-xl p-5 rounded-3xl border border-emerald-100/80 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700">Active Roster Strength</span>
                <span className="text-xs font-bold text-emerald-600">Healthy</span>
              </div>
              <div className="my-3 flex items-baseline gap-2">
                <span className="text-3xl font-black text-slate-900">{data.stats.activeMembers}</span>
                <span className="text-xs text-slate-500 font-semibold">Altar Servers</span>
              </div>
              <div className="pt-2 border-t border-emerald-100/60 flex items-center justify-between text-[11px] text-slate-600 font-medium">
                <span>Ready for assignment</span>
                <Link to="/members" className="font-bold text-emerald-700 hover:underline">Manage &rarr;</Link>
              </div>
            </div>

            <div className="bg-gradient-to-br from-amber-500/10 via-rose-500/5 to-white/80 backdrop-blur-xl p-5 rounded-3xl border border-amber-100/80 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-700">Attendance Safeguard</span>
                <span className="text-xs font-bold text-amber-600">Active Monitoring</span>
              </div>
              <div className="my-3 flex items-center gap-4">
                <div>
                  <span className="text-2xl font-black text-amber-600">{data.stats.warningMembersCount || 0}</span>
                  <span className="text-[10px] text-slate-500 block font-bold">Warnings</span>
                </div>
                <div className="h-6 w-px bg-slate-200"></div>
                <div>
                  <span className="text-2xl font-black text-rose-600">{data.stats.suspendedMembersCount || 0}</span>
                  <span className="text-[10px] text-slate-500 block font-bold">Suspensions</span>
                </div>
              </div>
              <div className="pt-2 border-t border-amber-100/60 text-[11px] text-slate-500 font-medium">
                Automatic suspension policies active
              </div>
            </div>
          </div>

          {/* CONCEPT 4 CHARTS: Frosted Glass Violet/Rose Wave + Glowing Donut */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white/80 backdrop-blur-xl rounded-3xl border border-purple-100/80 p-6 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-slate-900">Attendance Aurora Wave</h3>
                  <p className="text-[11px] text-slate-400">Server presence across active cycles</p>
                </div>
                <span className="text-xs font-bold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-full">
                  Aurora Flow
                </span>
              </div>
              <div className="h-56 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={attendanceTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="c4AuroraGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.45}/>
                        <stop offset="95%" stopColor="#ec4899" stopOpacity={0.0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                    <Tooltip contentStyle={{ borderRadius: '16px', backdropFilter: 'blur(8px)', backgroundColor: 'rgba(255,255,255,0.9)', border: '1px solid #e2e8f0' }} />
                    <Area type="natural" dataKey="attendees" stroke="#8b5cf6" strokeWidth={3.5} fillOpacity={1} fill="url(#c4AuroraGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white/80 backdrop-blur-xl rounded-3xl border border-indigo-100/80 p-6 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-slate-900">Order Ministry Distribution</h3>
                  <p className="text-[11px] text-slate-400">Proportional altar server share</p>
                </div>
                <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full">
                  Ring Radar
                </span>
              </div>
              <div className="h-56 w-full pt-1">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={groupPerformanceData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {groupPerformanceData.map((entry) => (
                        <Cell key={`cell-c4-${entry.name}`} fill={GROUP_COLORS[entry.name] || '#8b5cf6'} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '16px' }} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Glass Schedule Deck (Horizontal Cards) */}
          <div className="bg-white/80 backdrop-blur-xl rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Today's Mass Carousel Deck</h3>
                <p className="text-xs text-slate-500 font-medium">Horizontal glass cards for live schedule tracking</p>
              </div>
              <span className="text-xs font-bold text-slate-400">Swipe or Scroll</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
              {data.todaySchedules.length > 0 ? (
                data.todaySchedules.map((schedule) => (
                  <div
                    key={schedule.id}
                    className="p-5 rounded-2xl border border-indigo-100/80 bg-gradient-to-b from-indigo-50/40 via-white to-white shadow-xs hover:shadow-md transition-all flex flex-col justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-indigo-600 text-white shadow-2xs">
                          {formatTime12(schedule.startTime)}
                        </span>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                          {getScheduleStatus(schedule)}
                        </span>
                      </div>
                      <h4 className="text-sm font-extrabold text-slate-900 mt-3">{schedule.title}</h4>
                      <p className="text-xs text-slate-500 mt-1">
                        {schedule.assignedMembers?.length || 0} Servers Assigned
                      </p>
                    </div>

                    <Link
                      to={`/attendance?scheduleId=${schedule.id}`}
                      className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold text-center shadow-xs transition-all active:scale-98"
                    >
                      Take Attendance
                    </Link>
                  </div>
                ))
              ) : (
                <div className="col-span-3 py-10 text-center text-xs font-medium text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                  No active masses or liturgical services today.
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white/80 backdrop-blur-xl rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-pink-500/10 border border-pink-200 flex items-center justify-center text-pink-600 font-black">
                    CAL
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">Celebrant Spotlight</h3>
                    <p className="text-xs text-slate-500 font-medium">Server birthdays for {selectedMonthLabel}</p>
                  </div>
                </div>
                <div className="w-44">
                  <CustomSelect
                    id="bday-c4"
                    value={selectedBirthdayMonth}
                    onChange={(e) => setSelectedBirthdayMonth(Number(e.target.value))}
                    options={monthOptions}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 max-h-[260px] overflow-y-auto pr-1">
                {displayedBirthdays.map((b) => (
                  <div
                    key={b.id}
                    className={`p-3 rounded-2xl border flex items-center justify-between gap-3 ${
                      b.isToday
                        ? 'bg-gradient-to-r from-rose-50 to-pink-50 border-rose-300 shadow-xs'
                        : 'bg-slate-50/60 border-slate-200/70'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate">{b.fullName}</p>
                      <span className="text-[10px] text-slate-500 font-medium">{b.rank}</span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs font-bold text-slate-800 block">{b.birthDay} {pureMonthNames[selectedBirthdayMonth - 1]?.slice(0, 3)}</span>
                      <span className="text-[10px] font-semibold text-pink-600">{b.daysRemaining === 0 ? 'Today' : `In ${b.daysRemaining}d`}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white/80 backdrop-blur-xl rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-4">
              <h3 className="text-base font-extrabold text-slate-900">Live Activity Feed</h3>
              <div className="space-y-3 max-h-[260px] overflow-y-auto pr-1 text-xs">
                {data.activities.slice(0, 5).map((act) => (
                  <div key={act.id} className="p-3 rounded-xl border border-slate-100 bg-slate-50/50">
                    <p className="font-bold text-slate-800">{act.description}</p>
                    <p className="text-[10px] text-slate-400 mt-1">{formatActivityTime(act.timestamp)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CONCEPT 5: MINISTRY RUNWAY & LIVE SHIFT TIMELINE                          */}
      {/* ========================================================================= */}
      {activeConcept === 'concept5' && (
        <div className="space-y-6">
          {renderWelcomeBackCard()}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Liturgical Runway Timeline */}
            <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200/80 p-6 shadow-2xs space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Today's Service Runway</h3>
                  <p className="text-xs text-slate-500 font-medium">Linear shift-driven view of today's schedule</p>
                </div>
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-700">
                  {data.todaySchedules.length} Total Services
                </span>
              </div>

              {/* Vertical Connected Runway */}
              {data.todaySchedules.length > 0 ? (
                <div className="relative pl-6 space-y-8 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
                  {data.todaySchedules.map((schedule, idx) => {
                    const status = getScheduleStatus(schedule)
                    const isOngoing = status === 'ongoing'
                    const isUpcoming = status === 'upcoming'

                    return (
                      <div key={schedule.id} className="relative">
                        <div className={`absolute -left-6 top-1.5 h-5 w-5 rounded-full border-4 border-white flex items-center justify-center ${
                          isOngoing ? 'bg-indigo-600 shadow-sm animate-ping' : isUpcoming ? 'bg-emerald-500 shadow-sm' : 'bg-slate-400'
                        }`} />

                        <div className="p-5 rounded-2xl border border-slate-200/80 bg-slate-50/50 hover:bg-white hover:border-indigo-200 hover:shadow-xs transition-all space-y-3">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black px-2.5 py-1 rounded-lg bg-slate-900 text-white">
                                {formatTime12(schedule.startTime)} - {formatTime12(schedule.endTime)}
                              </span>
                              <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                                Shift #{idx + 1}
                              </span>
                            </div>
                            <span className="text-xs font-extrabold text-slate-600 uppercase">
                              Status: {status}
                            </span>
                          </div>

                          <div>
                            <h4 className="text-base font-extrabold text-slate-900">{schedule.title}</h4>
                            <p className="text-xs text-slate-500 font-medium mt-0.5">
                              Assigned Roster: {schedule.assignedMembers?.length || 0} Altar Servers
                            </p>
                          </div>

                          <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                            <span className="text-xs text-slate-400 font-medium">
                              Order Rotation: {previewOrder}
                            </span>
                            <Link
                              to={`/attendance?scheduleId=${schedule.id}`}
                              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-2xs"
                            >
                              Open Attendance Sheet &rarr;
                            </Link>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="py-12 text-center text-xs font-medium text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  No scheduled masses for today's runway.
                </div>
              )}
            </div>

            {/* Right Stack */}
            <div className="space-y-6">
              <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-2xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="text-sm font-extrabold text-slate-900">Celebrant Runway</h3>
                  <span className="text-xs font-bold text-pink-600">{displayedBirthdays.length} Total</span>
                </div>
                <CustomSelect
                  id="bday-c5"
                  value={selectedBirthdayMonth}
                  onChange={(e) => setSelectedBirthdayMonth(Number(e.target.value))}
                  options={monthOptions}
                />
                <div className="space-y-2 pt-1 max-h-[300px] overflow-y-auto pr-1">
                  {displayedBirthdays.map((b) => (
                    <div key={b.id} className="p-3 rounded-xl border border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-bold text-slate-800">{b.fullName}</p>
                        <span className="text-[10px] text-slate-400">{b.rank}</span>
                      </div>
                      <span className="font-bold text-pink-600">{b.birthDay} {pureMonthNames[selectedBirthdayMonth - 1]?.slice(0, 3)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-2xs space-y-3">
                <h3 className="text-sm font-extrabold text-slate-900">Recent Ministry Logs</h3>
                <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1 text-xs">
                  {data.activities.slice(0, 4).map((act) => (
                    <div key={act.id} className="p-3 rounded-xl border border-slate-100 bg-slate-50/50">
                      <p className="font-bold text-slate-800 leading-snug">{act.description}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{formatActivityTime(act.timestamp)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* CONCEPT 5 CHARTS: Shift-by-Shift Capacity Wave & Donut */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">Shift Headcount Capacity</h3>
                  <p className="text-[11px] text-slate-400">Server presence per mass timeslot</p>
                </div>
                <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full">
                  Shift Analytics
                </span>
              </div>
              <div className="h-52 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={shiftRunwayData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="shift" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                    <Tooltip contentStyle={{ borderRadius: '12px' }} />
                    <Bar dataKey="attendees" fill="#4f46e5" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">Ministry Group Deployment</h3>
                  <p className="text-[11px] text-slate-400">Share of rotation services</p>
                </div>
                <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">
                  Active Rotation
                </span>
              </div>
              <div className="h-52 w-full pt-1">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={groupPerformanceData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={68}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {groupPerformanceData.map((entry) => (
                        <Cell key={`cell-c5-${entry.name}`} fill={GROUP_COLORS[entry.name] || '#4f46e5'} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '12px' }} />
                    <Legend wrapperStyle={{ fontSize: '10px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CONCEPT 6: PRO COMPACT MASTER CONTROLLER (3-Column Dense View)           */}
      {/* ========================================================================= */}
      {activeConcept === 'concept6' && (
        <div className="space-y-6">
          {renderWelcomeBackCard()}

          {/* High-density 3-column equal grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Column 1: Today's Operations */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="text-sm font-extrabold text-slate-900">Today's Duty Roster</h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                    {data.todaySchedules.length}
                  </span>
                </div>
                <div className="space-y-2.5 pt-3 max-h-[380px] overflow-y-auto pr-1">
                  {data.todaySchedules.length > 0 ? (
                    data.todaySchedules.map((schedule) => (
                      <div key={schedule.id} className="p-3 rounded-xl border border-slate-200/80 bg-slate-50/50 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-black text-indigo-700">{formatTime12(schedule.startTime)}</span>
                          <span className="text-[9px] font-extrabold uppercase text-slate-500">{getScheduleStatus(schedule)}</span>
                        </div>
                        <h4 className="text-xs font-bold text-slate-900">{schedule.title}</h4>
                        <Link
                          to={`/attendance?scheduleId=${schedule.id}`}
                          className="block w-full py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold text-center transition-colors"
                        >
                          Take Attendance
                        </Link>
                      </div>
                    ))
                  ) : (
                    <div className="py-8 text-center text-xs text-slate-400">No duties scheduled today.</div>
                  )}
                </div>
              </div>
              <Link to="/schedules" className="text-xs font-bold text-indigo-600 hover:underline pt-2 block text-center border-t border-slate-100">
                Open Schedule Manager &rarr;
              </Link>
            </div>

            {/* Column 2: Health & Attendance Policies */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="text-sm font-extrabold text-slate-900">Ministry Health Monitor</h3>
                  <span className="text-[10px] font-bold text-emerald-600">Active</span>
                </div>
                <div className="space-y-3 pt-3">
                  <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-100 flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-900">Active Servers</span>
                    <span className="text-lg font-black text-emerald-700">{data.stats.activeMembers}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-100 flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-900">Warning Threshold</span>
                    <span className="text-lg font-black text-amber-700">{data.stats.warningMembersCount || 0}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-rose-50/60 border border-rose-100 flex items-center justify-between">
                    <span className="text-xs font-bold text-rose-900">Suspended Profiles</span>
                    <span className="text-lg font-black text-rose-700">{data.stats.suspendedMembersCount || 0}</span>
                  </div>
                </div>
              </div>
              <Link to="/reports" className="text-xs font-bold text-slate-600 hover:underline pt-2 block text-center border-t border-slate-100">
                View Full Attendance Analytics &rarr;
              </Link>
            </div>

            {/* Column 3: Tabbed Celebrants / Logs */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setC6SideTab('birthdays')}
                      className={`px-2.5 py-1 rounded-md transition-all ${c6SideTab === 'birthdays' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'}`}
                    >
                      Birthdays ({displayedBirthdays.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setC6SideTab('activity')}
                      className={`px-2.5 py-1 rounded-md transition-all ${c6SideTab === 'activity' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'}`}
                    >
                      Audit Feed
                    </button>
                  </div>
                </div>

                {c6SideTab === 'birthdays' ? (
                  <div className="space-y-2 pt-3 max-h-[380px] overflow-y-auto pr-1 text-xs">
                    <CustomSelect
                      id="bday-c6"
                      value={selectedBirthdayMonth}
                      onChange={(e) => setSelectedBirthdayMonth(Number(e.target.value))}
                      options={monthOptions}
                    />
                    {displayedBirthdays.map((b) => (
                      <div key={b.id} className="p-2 rounded-xl border border-slate-100 bg-slate-50/50 flex items-center justify-between">
                        <span className="font-bold text-slate-800 truncate pr-2">{b.fullName}</span>
                        <span className="font-bold text-pink-600 shrink-0">{b.birthDay} {pureMonthNames[selectedBirthdayMonth - 1]?.slice(0, 3)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2 pt-3 max-h-[380px] overflow-y-auto pr-1 text-xs">
                    {data.activities.slice(0, 6).map((act) => (
                      <div key={act.id} className="p-2.5 rounded-xl border border-slate-100 bg-slate-50/50">
                        <p className="font-bold text-slate-800 leading-snug">{act.description}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{formatActivityTime(act.timestamp)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-2 text-center text-xs font-bold text-slate-400 border-t border-slate-100">
                Pro Master View
              </div>
            </div>
          </div>

          {/* CONCEPT 6 CHARTS: High-Density Micro Sparkline & Donut Bar */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-slate-900">Attendance Volume (Compact Trend)</span>
                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">6mo Velocity</span>
              </div>
              <div className="h-36 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={attendanceTrendData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                    <defs>
                      <linearGradient id="c6Grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="2 2" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                    <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '11px' }} />
                    <Area type="monotone" dataKey="attendees" stroke="#4f46e5" strokeWidth={2} fillOpacity={1} fill="url(#c6Grad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-slate-900">Order Participation Split</span>
                <span className="text-[10px] font-bold text-slate-400">Micro Ratio</span>
              </div>
              <div className="h-36 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={groupPerformanceData} layout="vertical" margin={{ top: 5, right: 15, left: 20, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#475569' }} />
                    <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '11px' }} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {groupPerformanceData.map((entry) => (
                        <Cell key={`bar-c6-${entry.name}`} fill={GROUP_COLORS[entry.name] || '#4f46e5'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
