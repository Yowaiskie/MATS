import React, { useState, useMemo } from 'react'
import type { ReportRawData, ServiceServerStat, ScheduleCategorySelection } from '@/services/reportService'
import { reportService } from '@/services/reportService'
import { Card, Pagination, CustomSelect } from '@/components'
import { HolyHourServiceHistoryModal } from './HolyHourServiceHistoryModal'
import { getOrderBadgeStyle, ORDER_GROUPS } from '@/types/member'

interface Props {
  data: ReportRawData | null
  loading: boolean
}

export const HolyHourAnalyticsTab: React.FC<Props> = ({ data, loading }) => {
  // Category Checkbox Selection state
  const [includeSundays, setIncludeSundays] = useState(true)
  const [includeWeekdays, setIncludeWeekdays] = useState(true)
  const [includeHolyHour, setIncludeHolyHour] = useState(true)
  const [includeMeetings, setIncludeMeetings] = useState(false)
  const [customKeyword, setCustomKeyword] = useState('')

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedOrder, setSelectedOrder] = useState('all')
  const [servedFilter, setServedFilter] = useState<'all' | 'served' | 'zero'>('all')
  const [sortBy, setSortBy] = useState<'most_served' | 'rate' | 'name'>('most_served')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  // History modal state
  const [selectedServer, setSelectedServer] = useState<ServiceServerStat | null>(null)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)

  // Compute report data dynamically based on category checkboxes
  const categorySelection: ScheduleCategorySelection = useMemo(() => ({
    includeSundays,
    includeWeekdays,
    includeHolyHour,
    includeMeetings
  }), [includeSundays, includeWeekdays, includeHolyHour, includeMeetings])

  const reportSummary = useMemo(() => {
    if (!data) return null
    return reportService.generateServiceLeaderboardReport(
      data,
      categorySelection,
      customKeyword || undefined
    )
  }, [data, categorySelection, customKeyword])

  // Count active selected categories
  const activeCategoriesCount = useMemo(() => {
    return [includeSundays, includeWeekdays, includeHolyHour, includeMeetings].filter(Boolean).length
  }, [includeSundays, includeWeekdays, includeHolyHour, includeMeetings])

  // Filter and sort servers list
  const filteredServers = useMemo(() => {
    if (!reportSummary) return []
    let list = [...reportSummary.servers]

    // 1. Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      list = list.filter(s => s.name.toLowerCase().includes(q) || s.rank.toLowerCase().includes(q))
    }

    // 2. Order Group Filter
    if (selectedOrder !== 'all') {
      list = list.filter(s => s.order?.toLowerCase().trim() === selectedOrder.toLowerCase().trim())
    }

    // 3. Served Filter
    if (servedFilter === 'served') {
      list = list.filter(s => s.totalServed > 0)
    } else if (servedFilter === 'zero') {
      list = list.filter(s => s.totalServed === 0)
    }

    // 4. Sort
    list.sort((a, b) => {
      if (sortBy === 'most_served') {
        if (b.totalServed !== a.totalServed) return b.totalServed - a.totalServed
        if (b.rate !== a.rate) return b.rate - a.rate
        return a.name.localeCompare(b.name)
      } else if (sortBy === 'rate') {
        if (b.rate !== a.rate) return b.rate - a.rate
        if (b.totalServed !== a.totalServed) return b.totalServed - a.totalServed
        return a.name.localeCompare(b.name)
      } else {
        return a.name.localeCompare(b.name)
      }
    })

    return list
  }, [reportSummary, searchQuery, selectedOrder, servedFilter, sortBy])

  // Top 3 Podium
  const topThreeServers = useMemo(() => {
    if (!reportSummary) return []
    return reportSummary.servers.filter(s => s.totalServed > 0).slice(0, 3)
  }, [reportSummary])

  const handleOpenHistory = (server: ServiceServerStat) => {
    setSelectedServer(server)
    setIsHistoryOpen(true)
  }

  const handleApplyPreset = (preset: 'sundays' | 'weekdays' | 'holyhour' | 'masses' | 'all') => {
    setCurrentPage(1)
    if (preset === 'sundays') {
      setIncludeSundays(true)
      setIncludeWeekdays(false)
      setIncludeHolyHour(false)
      setIncludeMeetings(false)
    } else if (preset === 'weekdays') {
      setIncludeSundays(false)
      setIncludeWeekdays(true)
      setIncludeHolyHour(false)
      setIncludeMeetings(false)
    } else if (preset === 'holyhour') {
      setIncludeSundays(false)
      setIncludeWeekdays(false)
      setIncludeHolyHour(true)
      setIncludeMeetings(false)
    } else if (preset === 'masses') {
      setIncludeSundays(true)
      setIncludeWeekdays(true)
      setIncludeHolyHour(false)
      setIncludeMeetings(false)
    } else if (preset === 'all') {
      setIncludeSundays(true)
      setIncludeWeekdays(true)
      setIncludeHolyHour(true)
      setIncludeMeetings(true)
    }
  }

  if (loading) {
    return (
      <div className="py-16 text-center text-xs font-bold text-slate-400">
        Compiling schedule participation and server analytics...
      </div>
    )
  }

  if (!reportSummary) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Category Checkbox & Filter Card */}
      <div className="p-4 sm:p-5 bg-white rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
        {/* Header with Title & Quick Presets */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200/70 shrink-0">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wider">
                  Filter by Schedule Categories
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 border border-blue-200 text-blue-700">
                  {activeCategoriesCount === 4 ? 'All Categories Active' : `${activeCategoriesCount} Active`}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Piliin ang mga schedule na nais isama sa leaderboard at ranking.
              </p>
            </div>
          </div>

          {/* Quick Presets Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1 hidden sm:inline">
              Quick Presets:
            </span>
            <button
              type="button"
              onClick={() => handleApplyPreset('sundays')}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                includeSundays && !includeWeekdays && !includeHolyHour && !includeMeetings
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              Sundays
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset('weekdays')}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                !includeSundays && includeWeekdays && !includeHolyHour && !includeMeetings
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              Weekdays
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset('holyhour')}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                !includeSundays && !includeWeekdays && includeHolyHour && !includeMeetings
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              Holy Hour
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset('masses')}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                includeSundays && includeWeekdays && !includeHolyHour && !includeMeetings
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              All Masses
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset('all')}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                includeSundays && includeWeekdays && includeHolyHour && includeMeetings
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              Select All
            </button>
          </div>
        </div>

        {/* 4 Interactive Category Toggle Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Sunday Mass Card */}
          <label className={`relative flex items-center justify-between p-3.5 rounded-2xl border transition-all duration-200 cursor-pointer select-none ${
            includeSundays
              ? 'bg-blue-50/70 border-blue-400 ring-2 ring-blue-500/20 text-blue-950 shadow-xs'
              : 'bg-slate-50/50 border-slate-200/80 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                includeSundays ? 'bg-blue-600 text-white' : 'bg-slate-200/80 text-slate-500'
              }`}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <span className="text-xs font-black block text-slate-900">Sunday & Anticipated</span>
                <span className="text-[10px] text-slate-500 block">Linggo at Sabado 5PM+</span>
              </div>
            </div>

            <input
              type="checkbox"
              checked={includeSundays}
              onChange={(e) => {
                setIncludeSundays(e.target.checked)
                setCurrentPage(1)
              }}
              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
            />
          </label>

          {/* Weekday Mass Card */}
          <label className={`relative flex items-center justify-between p-3.5 rounded-2xl border transition-all duration-200 cursor-pointer select-none ${
            includeWeekdays
              ? 'bg-amber-50/70 border-amber-400 ring-2 ring-amber-500/20 text-amber-950 shadow-xs'
              : 'bg-slate-50/50 border-slate-200/80 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                includeWeekdays ? 'bg-amber-500 text-white' : 'bg-slate-200/80 text-slate-500'
              }`}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <span className="text-xs font-black block text-slate-900">Weekday Masses</span>
                <span className="text-[10px] text-slate-500 block">Lunes hanggang Sabado</span>
              </div>
            </div>

            <input
              type="checkbox"
              checked={includeWeekdays}
              onChange={(e) => {
                setIncludeWeekdays(e.target.checked)
                setCurrentPage(1)
              }}
              className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-slate-300 cursor-pointer"
            />
          </label>

          {/* Holy Hour Card */}
          <label className={`relative flex items-center justify-between p-3.5 rounded-2xl border transition-all duration-200 cursor-pointer select-none ${
            includeHolyHour
              ? 'bg-purple-50/70 border-purple-400 ring-2 ring-purple-500/20 text-purple-950 shadow-xs'
              : 'bg-slate-50/50 border-slate-200/80 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                includeHolyHour ? 'bg-purple-600 text-white' : 'bg-slate-200/80 text-slate-500'
              }`}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <div>
                <span className="text-xs font-black block text-slate-900">Holy Hour & Adoration</span>
                <span className="text-[10px] text-slate-500 block">Hora Santa at Adorasyon</span>
              </div>
            </div>

            <input
              type="checkbox"
              checked={includeHolyHour}
              onChange={(e) => {
                setIncludeHolyHour(e.target.checked)
                setCurrentPage(1)
              }}
              className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 border-slate-300 cursor-pointer"
            />
          </label>

          {/* Meetings & Formation Card */}
          <label className={`relative flex items-center justify-between p-3.5 rounded-2xl border transition-all duration-200 cursor-pointer select-none ${
            includeMeetings
              ? 'bg-emerald-50/70 border-emerald-400 ring-2 ring-emerald-500/20 text-emerald-950 shadow-xs'
              : 'bg-slate-50/50 border-slate-200/80 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                includeMeetings ? 'bg-emerald-600 text-white' : 'bg-slate-200/80 text-slate-500'
              }`}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div>
                <span className="text-xs font-black block text-slate-900">Meetings & Formation</span>
                <span className="text-[10px] text-slate-500 block">Pulong, Assembly at Ensayo</span>
              </div>
            </div>

            <input
              type="checkbox"
              checked={includeMeetings}
              onChange={(e) => {
                setIncludeMeetings(e.target.checked)
                setCurrentPage(1)
              }}
              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer"
            />
          </label>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Total Schedules */}
        <div className="p-4 bg-white border border-slate-200/90 rounded-2xl shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Schedules Count</span>
            <div className="p-2 bg-blue-50 rounded-xl text-blue-600 border border-blue-200/60">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{reportSummary.totalSchedules}</span>
            <span className="text-xs text-slate-500 font-medium">Services Recorded</span>
          </div>
        </div>

        {/* Total Serves Logged */}
        <div className="p-4 bg-white border border-slate-200/90 rounded-2xl shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Serves Logged</span>
            <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600 border border-emerald-200/60">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-600">{reportSummary.totalServed}</span>
            <span className="text-xs text-slate-500 font-medium">Present + Late</span>
          </div>
        </div>

        {/* Participating Servers */}
        <div className="p-4 bg-white border border-slate-200/90 rounded-2xl shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Participating Servers</span>
            <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600 border border-indigo-200/60">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-indigo-600">{reportSummary.uniqueServersCount}</span>
            <span className="text-xs text-slate-500 font-medium">Unique Servers</span>
          </div>
        </div>

        {/* Overall Attendance Rate */}
        <div className="p-4 bg-white border border-slate-200/90 rounded-2xl shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Category Rate</span>
            <div className="p-2 bg-purple-50 rounded-xl text-purple-600 border border-purple-200/60">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-purple-600">{reportSummary.overallRate}%</span>
            <span className="text-xs text-slate-500 font-medium">Average Attendance</span>
          </div>
        </div>
      </div>

      {/* Top 3 Frequent Servers Podium */}
      {topThreeServers.length > 0 && (
        <div className="p-5 bg-gradient-to-br from-blue-50/60 via-slate-50/80 to-white border border-blue-200/70 rounded-3xl space-y-4 shadow-xs">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                </div>
                <span className="text-sm sm:text-base font-black text-slate-900">
                  Top Frequent Servers — {reportSummary.categoryLabel}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800">
                  Leaderboard
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Altar servers na may pinakamaraming completed services sa napiling categories.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {topThreeServers.map((server, idx) => {
              const medalBadge =
                idx === 0
                  ? 'bg-amber-400 text-amber-950 ring-4 ring-amber-300/40 border-amber-500'
                  : idx === 1
                  ? 'bg-slate-300 text-slate-800 ring-4 ring-slate-200/50 border-slate-400'
                  : 'bg-amber-700 text-white ring-4 ring-amber-600/30 border-amber-800'

              const rankTitle = idx === 0 ? '1st Most Frequent' : idx === 1 ? '2nd Most Frequent' : '3rd Most Frequent'

              return (
                <div
                  key={server.memberId}
                  className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-xs flex flex-col justify-between space-y-3 relative overflow-hidden group hover:border-blue-300 transition"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-xl font-black text-xs flex items-center justify-center border shrink-0 ${medalBadge}`}>
                        #{idx + 1}
                      </div>
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 block">
                          {rankTitle}
                        </span>
                        <h4 className="text-sm font-black text-slate-900 group-hover:text-blue-600 transition">
                          {server.name}
                        </h4>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">Times Served</span>
                      <span className="text-base font-black text-blue-600">{server.totalServed} times</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">Attendance Rate</span>
                      <span className="text-sm font-black text-slate-800">{server.rate}%</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOpenHistory(server)}
                    className="w-full py-1.5 px-3 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 rounded-xl text-[11px] font-bold transition cursor-pointer flex items-center justify-center gap-1"
                  >
                    <span>View Service Dates ({server.serviceHistory.length})</span>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search Member Name */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
              Search Server
            </label>
            <input
              type="text"
              placeholder="e.g. Dela Cruz, Juan..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setCurrentPage(1)
              }}
              className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:border-blue-500 font-medium"
            />
          </div>

          {/* Order Group Filter */}
          <div>
            <CustomSelect
              label="Order / Group"
              value={selectedOrder}
              onChange={(e) => {
                setSelectedOrder(e.target.value)
                setCurrentPage(1)
              }}
              options={[
                { value: 'all', label: 'All Orders / Groups' },
                ...ORDER_GROUPS.map(og => ({ value: og, label: og }))
              ]}
            />
          </div>

          {/* Serving Activity Filter */}
          <div>
            <CustomSelect
              label="Participation"
              value={servedFilter}
              onChange={(e) => {
                setServedFilter(e.target.value as any)
                setCurrentPage(1)
              }}
              options={[
                { value: 'all', label: `All Members (${reportSummary.servers.length})` },
                { value: 'served', label: `Served at least once (${reportSummary.uniqueServersCount})` },
                { value: 'zero', label: `Zero Serves (${reportSummary.servers.length - reportSummary.uniqueServersCount})` }
              ]}
            />
          </div>

          {/* Sort By */}
          <div>
            <CustomSelect
              label="Sort Ranking By"
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value as any)
                setCurrentPage(1)
              }}
              options={[
                { value: 'most_served', label: 'Most Services Completed' },
                { value: 'rate', label: 'Highest Attendance Rate %' },
                { value: 'name', label: 'Server Name (A to Z)' }
              ]}
            />
          </div>

          {/* Title Keyword Matcher */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
              Custom Title Match
            </label>
            <input
              type="text"
              placeholder="e.g. First Friday, Fiesta..."
              value={customKeyword}
              onChange={(e) => {
                setCustomKeyword(e.target.value)
                setCurrentPage(1)
              }}
              className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:border-blue-500 font-medium"
            />
          </div>
        </div>
      </div>

      {/* Frequent Servers Table */}
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-3.5 py-3.5 text-center w-12">Rank</th>
                <th className="px-4 py-3.5">Server Name</th>
                <th className="px-3 py-3.5">Rank & Order</th>
                <th className="px-3 py-3.5 text-center">Total Served</th>
                <th className="px-3 py-3.5 text-center">Assigned</th>
                <th className="px-3 py-3.5 text-center">Present</th>
                <th className="px-3 py-3.5 text-center">Late</th>
                <th className="px-3 py-3.5 text-center">Absent</th>
                <th className="px-3 py-3.5 text-center">Excused</th>
                <th className="px-3 py-3.5 text-right">Attendance Rate</th>
                <th className="px-4 py-3.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredServers.length > 0 ? (
                filteredServers
                  .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                  .map((server, idx) => {
                    const rankNum = (currentPage - 1) * pageSize + idx + 1
                    return (
                      <tr key={server.memberId} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-3.5 py-3 text-center">
                          <span
                            className={`inline-flex items-center justify-center w-6 h-6 rounded-lg text-xs font-black ${
                              rankNum === 1
                                ? 'bg-amber-400 text-amber-950 font-black ring-2 ring-amber-300'
                                : rankNum === 2
                                ? 'bg-slate-300 text-slate-800 font-black'
                                : rankNum === 3
                                ? 'bg-amber-700 text-white font-black'
                                : 'text-slate-400'
                            }`}
                          >
                            {rankNum}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-900">{server.name}</div>
                          {server.status !== 'active' && (
                            <span className="text-[10px] text-slate-400 capitalize">{server.status}</span>
                          )}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-slate-600 font-medium">{server.rank}</span>
                            {server.order && (
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${getOrderBadgeStyle(server.order)}`}>
                                {server.order}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-center whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-black ${
                            server.totalServed > 0
                              ? 'bg-blue-50 text-blue-800 border border-blue-200'
                              : 'bg-slate-100 text-slate-400'
                          }`}>
                            <span>{server.totalServed}</span>
                            <span className="text-[10px] font-bold opacity-75">serves</span>
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center font-semibold text-slate-700">{server.totalAssigned}</td>
                        <td className="px-3 py-3 text-center font-bold text-emerald-600">{server.present}</td>
                        <td className="px-3 py-3 text-center font-bold text-amber-600">{server.late}</td>
                        <td className="px-3 py-3 text-center font-bold text-rose-600">{server.absent}</td>
                        <td className="px-3 py-3 text-center text-slate-500">{server.excused}</td>
                        <td className="px-3 py-3 text-right whitespace-nowrap">
                          <span className="font-black text-slate-900">{server.rate}%</span>
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          {server.serviceHistory.length > 0 ? (
                            <button
                              type="button"
                              onClick={() => handleOpenHistory(server)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-lg text-xs font-bold transition cursor-pointer"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                              <span>Dates ({server.serviceHistory.length})</span>
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-300 font-medium">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })
              ) : (
                <tr>
                  <td colSpan={11} className="px-6 py-12 text-center text-xs text-slate-400 font-medium">
                    No server attendance records found for {reportSummary.categoryLabel}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          currentPage={currentPage}
          totalItems={filteredServers.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
        />
      </Card>

      {/* Service History Modal */}
      <HolyHourServiceHistoryModal
        isOpen={isHistoryOpen}
        onClose={() => {
          setIsHistoryOpen(false)
          setSelectedServer(null)
        }}
        serverStat={selectedServer}
        categoryLabel={reportSummary.categoryLabel}
      />
    </div>
  )
}
