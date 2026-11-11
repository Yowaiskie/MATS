import React, { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/Button'
import { DatePicker } from '@/components/DatePicker'
import { CustomSelect } from '@/components/CustomSelect'
import { Modal } from '@/components/Modal'
import { ConfirmModal } from '@/components/Dialog'

interface MockSession {
  id: string
  title: string
  date: string
  time: string
  order: string
  totalServers: number
  recordedCount: number
  statusCounts: { present: number; late: number; excused: number; absent: number }
  unmarkedServers: string[]
  isFinalized: boolean
  finalizedBy?: string
  finalizedAt?: string
}

const INITIAL_SESSIONS: MockSession[] = [
  {
    id: 'sess-1',
    title: '28th Sunday in Ordinary Time (Parish Mass)',
    date: '2026-10-12',
    time: '06:00 - 07:15',
    order: 'Order of San Pedro',
    totalServers: 8,
    recordedCount: 8,
    statusCounts: { present: 6, late: 1, excused: 1, absent: 0 },
    unmarkedServers: [],
    isFinalized: false
  },
  {
    id: 'sess-2',
    title: '28th Sunday in Ordinary Time (Youth Mass)',
    date: '2026-10-12',
    time: '08:00 - 09:15',
    order: 'Order of San Juan',
    totalServers: 6,
    recordedCount: 6,
    statusCounts: { present: 5, late: 0, excused: 0, absent: 1 },
    unmarkedServers: [],
    isFinalized: false
  },
  {
    id: 'sess-3',
    title: 'Anticipated Sunday Mass',
    date: '2026-10-11',
    time: '18:00 - 19:00',
    order: 'Officers',
    totalServers: 4,
    recordedCount: 4,
    statusCounts: { present: 4, late: 0, excused: 0, absent: 0 },
    unmarkedServers: [],
    isFinalized: false
  },
  {
    id: 'sess-4',
    title: '27th Sunday in Ordinary Time (Evening Mass)',
    date: '2026-10-05',
    time: '17:00 - 18:15',
    order: 'Order of San Tiago',
    totalServers: 6,
    recordedCount: 4,
    statusCounts: { present: 3, late: 1, excused: 0, absent: 0 },
    unmarkedServers: ['Juan Dela Cruz', 'Mark Angelo Santos'],
    isFinalized: false
  },
  {
    id: 'sess-5',
    title: 'Altar Servers General Assembly',
    date: '2026-10-04',
    time: '16:00 - 17:30',
    order: 'All Orders',
    totalServers: 12,
    recordedCount: 0,
    statusCounts: { present: 0, late: 0, excused: 0, absent: 0 },
    unmarkedServers: ['Entire roster unmarked (Untaken session)'],
    isFinalized: false
  },
  {
    id: 'sess-6',
    title: '26th Sunday in Ordinary Time (Dawn Mass)',
    date: '2026-09-28',
    time: '05:00 - 06:00',
    order: 'Order of San Andres',
    totalServers: 5,
    recordedCount: 5,
    statusCounts: { present: 4, late: 1, excused: 0, absent: 0 },
    unmarkedServers: [],
    isFinalized: true,
    finalizedBy: 'admin@mats.org',
    finalizedAt: 'Sep 28, 2026, 07:15'
  }
]

const DATE_RANGE_OPTIONS = [
  { value: 'all', label: 'All Available Past Dates' },
  { value: 'this_week', label: 'This Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_30_days', label: 'Last 30 Days' },
  { value: 'custom', label: 'Custom Range...' }
]

export const BulkFinalizeShowcasePage: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(true)
  const [sessions, setSessions] = useState<MockSession[]>(INITIAL_SESSIONS)
  const [activeTab, setActiveTab] = useState<'ready' | 'incomplete' | 'finalized'>('ready')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(['sess-1', 'sess-2', 'sess-3']))
  const [searchQuery, setSearchQuery] = useState('')

  // Date Range Filter States
  const [dateRangePreset, setDateRangePreset] = useState<string>('all')
  const [startDate, setStartDate] = useState('2026-10-01')
  const [endDate, setEndDate] = useState('2026-10-31')

  // Processing state for Progressive Progress Bar
  const [isProcessing, setIsProcessing] = useState(false)
  const [progressPercent, setProgressPercent] = useState(0)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [currentStepLabel, setCurrentStepLabel] = useState('')
  const [processingStatuses, setProcessingStatuses] = useState<Record<string, 'pending' | 'processing' | 'done' | 'failed'>>({})
  const [isFinished, setIsFinished] = useState(false)
  const [confirmModalOpen, setConfirmModalOpen] = useState(false)

  // Filter sessions by date range & search
  const filteredSessions = useMemo(() => {
    return sessions.filter(session => {
      // 1. Date Range
      if (dateRangePreset === 'this_week') {
        if (session.date < '2026-10-11' || session.date > '2026-10-17') return false
      } else if (dateRangePreset === 'this_month') {
        if (!session.date.startsWith('2026-10')) return false
      } else if (dateRangePreset === 'last_30_days') {
        if (session.date < '2026-09-17') return false
      } else if (dateRangePreset === 'custom') {
        if (startDate && session.date < startDate) return false
        if (endDate && session.date > endDate) return false
      }

      // 2. Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim()
        const matches =
          session.title.toLowerCase().includes(query) ||
          session.order.toLowerCase().includes(query) ||
          session.date.includes(query)
        if (!matches) return false
      }

      return true
    })
  }, [sessions, dateRangePreset, startDate, endDate, searchQuery])

  const readySessions = useMemo(() => filteredSessions.filter(s => !s.isFinalized && s.unmarkedServers.length === 0), [filteredSessions])
  const incompleteSessions = useMemo(() => filteredSessions.filter(s => !s.isFinalized && s.unmarkedServers.length > 0), [filteredSessions])
  const finalizedSessions = useMemo(() => filteredSessions.filter(s => s.isFinalized), [filteredSessions])

  const displayedList =
    activeTab === 'ready' ? readySessions :
    activeTab === 'incomplete' ? incompleteSessions :
    finalizedSessions

  const allReadySelected = readySessions.length > 0 && readySessions.every(s => selectedIds.has(s.id))

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAllReady = () => {
    if (allReadySelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(readySessions.map(s => s.id)))
    }
  }

  const handleAutoMarkAbsent = (id: string) => {
    setSessions(prev => prev.map(s => {
      if (s.id !== id) return s
      const unmarkedCount = s.totalServers - s.recordedCount
      return {
        ...s,
        recordedCount: s.totalServers,
        statusCounts: {
          ...s.statusCounts,
          absent: s.statusCounts.absent + unmarkedCount
        },
        unmarkedServers: []
      }
    }))
    setSelectedIds(prev => new Set([...prev, id]))
  }

  const startFinalization = async () => {
    setConfirmModalOpen(false)
    setIsProcessing(true)
    setIsFinished(false)
    setProgressPercent(0)

    const targetList = readySessions.filter(s => selectedIds.has(s.id))
    const total = targetList.length

    const initialStatuses: Record<string, 'pending' | 'processing' | 'done' | 'failed'> = {}
    targetList.forEach(s => { initialStatuses[s.id] = 'pending' })
    setProcessingStatuses(initialStatuses)

    for (let i = 0; i < total; i++) {
      const item = targetList[i]
      setCurrentStepIndex(i + 1)
      setCurrentStepLabel(`Locking "${item.title}" (${item.time})...`)

      setProcessingStatuses(p => ({ ...p, [item.id]: 'processing' }))

      // Smooth simulated tick
      await new Promise(r => setTimeout(r, 650))

      const currentPct = Math.round(((i + 1) / total) * 100)
      setProgressPercent(currentPct)
      setProcessingStatuses(p => ({ ...p, [item.id]: 'done' }))
    }

    await new Promise(r => setTimeout(r, 400))
    setIsProcessing(false)
    setIsFinished(true)

    setSessions(prev => prev.map(s => {
      if (selectedIds.has(s.id)) {
        return {
          ...s,
          isFinalized: true,
          finalizedBy: 'admin@mats.org',
          finalizedAt: 'Just now'
        }
      }
      return s
    }))
    setSelectedIds(new Set())
  }

  const resetDemo = () => {
    setSessions(INITIAL_SESSIONS)
    setSelectedIds(new Set(['sess-1', 'sess-2', 'sess-3']))
    setIsProcessing(false)
    setIsFinished(false)
    setProgressPercent(0)
    setActiveTab('ready')
    setDateRangePreset('all')
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 md:p-8">
      {/* Top Banner Notice */}
      <div className="max-w-6xl mx-auto mb-6 bg-slate-800/90 border border-slate-700 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-6.75 6.75h13.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H4.5A2.25 2.25 0 002.25 6.75v11.25A2.25 2.25 0 004.5 18z" />
            </svg>
          </div>
          <div>
            <h1 className="font-bold text-sm text-slate-200">Bulk Finalize Attendance - Design System Integrated</h1>
            <p className="text-xs text-slate-400">Using standard MATS Modal, Button, CustomSelect, and DatePicker components.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={resetDemo}>
            Reset Demo Data
          </Button>
          {!isModalOpen && (
            <Button variant="primary" size="sm" onClick={() => setIsModalOpen(true)}>
              Open Modal
            </Button>
          )}
          <Link
            to="/schedules"
            className="px-3 py-1.5 text-xs font-semibold text-blue-400 hover:text-blue-300 underline"
          >
            Back to Schedules
          </Link>
        </div>
      </div>

      {/* Main Container / Background */}
      <div className="max-w-6xl mx-auto bg-slate-800/40 border border-slate-800 rounded-2xl p-8 text-center text-slate-400">
        <p className="text-sm">Click "Open Modal" if closed. Notice the MATS native DatePicker and CustomSelect dropdowns below.</p>
      </div>

      {/* STANDARD MATS MODAL COMPONENT */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => { if (!isProcessing) setIsModalOpen(false) }}
        title="Bulk Finalize Attendance"
        subtitle="Verify and finalize completed service schedules across specific date ranges."
        badge="Attendance Security"
        maxWidth="4xl"
        icon={
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
        }
      >
        {isProcessing ? (
          /* PROCESSING STATE: PROGRESSIVE PROGRESS BAR */
          <div className="py-8 px-4 flex flex-col items-center justify-center my-auto">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 mb-5 relative">
              <svg className="w-7 h-7 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>

            <h3 className="text-base font-bold text-slate-900 tracking-tight">Finalizing Selected Attendance Sessions</h3>
            <p className="text-xs text-slate-500 mt-1 text-center max-w-md">
              Verifying records and applying database locks. Please keep this modal open.
            </p>

            {/* PROGRESSIVE BAR CONTAINER */}
            <div className="w-full max-w-lg mt-7">
              <div className="flex items-center justify-between text-xs font-semibold mb-2">
                <span className="text-blue-600 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
                  Processing {currentStepIndex} of {readySessions.filter(s => selectedIds.has(s.id)).length} sessions
                </span>
                <span className="text-slate-900 font-bold text-sm">{progressPercent}%</span>
              </div>

              {/* The Animated Bar */}
              <div className="w-full h-3.5 bg-slate-100 rounded-full p-0.5 border border-slate-200 overflow-hidden shadow-inner">
                <div
                  className="h-full bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-600 rounded-full transition-all duration-500 ease-out relative overflow-hidden"
                  style={{ width: `${progressPercent}%` }}
                >
                  <div className="absolute inset-0 bg-white/25 w-full animate-[shimmer_1.5s_infinite] -skew-x-12"></div>
                </div>
              </div>

              {/* Current Active Step Ticker */}
              <p className="text-xs text-center font-medium text-slate-600 mt-2.5 truncate px-2">
                {currentStepLabel}
              </p>
            </div>

            {/* Real-time Checklist Cards */}
            <div className="w-full max-w-lg mt-5 divide-y divide-slate-100 border border-slate-200 rounded-xl bg-slate-50/50 p-1 max-h-48 overflow-y-auto">
              {readySessions.filter(s => selectedIds.has(s.id)).map(item => {
                const status = processingStatuses[item.id] || 'pending'
                return (
                  <div key={item.id} className="p-2.5 flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700 truncate pr-2">{item.title}</span>
                    {status === 'done' ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                        Locked
                      </span>
                    ) : status === 'processing' ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200 animate-pulse">
                        <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Locking...
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-400">Queued</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ) : isFinished ? (
          /* SUCCESS SUMMARY SCREEN */
          <div className="py-8 px-4 flex flex-col items-center justify-center my-auto text-center animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mb-4 shadow-sm">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-slate-900 tracking-tight">Bulk Finalization Completed</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md">
              All selected attendance sessions have been verified, finalized, and locked against unauthorized modifications.
            </p>

            <div className="w-full max-w-md mt-6 p-4 rounded-xl bg-slate-50 border border-slate-200 text-left space-y-2 text-xs">
              <div className="font-semibold text-slate-800 mb-1 flex items-center justify-between">
                <span>Summary of Finalized Schedules:</span>
                <span className="text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded text-[11px]">
                  {sessions.filter(s => s.finalizedAt === 'Just now').length} sessions locked
                </span>
              </div>
              <div className="divide-y divide-slate-100">
                {sessions.filter(s => s.finalizedAt === 'Just now').map(s => (
                  <div key={s.id} className="py-1.5 flex items-center justify-between text-slate-600">
                    <span className="truncate pr-2 font-medium">{s.title}</span>
                    <span className="text-slate-400 font-mono text-[11px]">{s.totalServers} servers</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6">
              <Button
                variant="primary"
                onClick={() => { setIsFinished(false); setActiveTab('finalized') }}
              >
                View Finalized Records
              </Button>
            </div>
          </div>
        ) : (
          /* REGULAR TABBED VIEW */
          <div className="space-y-4">
            {/* Top Controls: 3 Status Tabs */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <button
                onClick={() => setActiveTab('ready')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  activeTab === 'ready'
                    ? 'border-emerald-500 bg-emerald-50/40 ring-1 ring-emerald-500 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Ready to Lock
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-md font-bold bg-emerald-100 text-emerald-800">
                    {readySessions.length}
                  </span>
                </div>
                <div className="text-base sm:text-lg font-bold text-slate-900 mt-1">Ready</div>
                <p className="text-[11px] text-slate-500 mt-0.5 hidden sm:block">100% attendance recorded</p>
              </button>

              <button
                onClick={() => setActiveTab('incomplete')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  activeTab === 'incomplete'
                    ? 'border-amber-500 bg-amber-50/40 ring-1 ring-amber-500 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                    Needs Attention
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-md font-bold bg-amber-100 text-amber-800">
                    {incompleteSessions.length}
                  </span>
                </div>
                <div className="text-base sm:text-lg font-bold text-slate-900 mt-1">Incomplete</div>
                <p className="text-[11px] text-slate-500 mt-0.5 hidden sm:block">Unmarked servers exist</p>
              </button>

              <button
                onClick={() => setActiveTab('finalized')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  activeTab === 'finalized'
                    ? 'border-blue-500 bg-blue-50/40 ring-1 ring-blue-500 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                    Finalized
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-md font-bold bg-blue-100 text-blue-800">
                    {finalizedSessions.length}
                  </span>
                </div>
                <div className="text-base sm:text-lg font-bold text-slate-900 mt-1">Locked</div>
                <p className="text-[11px] text-slate-500 mt-0.5 hidden sm:block">Archived and finalized</p>
              </button>
            </div>

            {/* FILTER BAR: MATS CUSTOMSELECT & DATEPICKER */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              {/* Date Range Selector with MATS CustomSelect & DatePicker */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="w-52">
                  <CustomSelect
                    options={DATE_RANGE_OPTIONS}
                    value={dateRangePreset}
                    onChange={(e: any) => setDateRangePreset(String(e.target.value))}
                    placeholder="Select Date Range"
                    icon={
                      <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                      </svg>
                    }
                  />
                </div>

                {dateRangePreset === 'custom' && (
                  <div className="flex items-center gap-1.5 animate-in fade-in duration-150">
                    <div className="w-36">
                      <DatePicker
                        value={startDate}
                        onChange={setStartDate}
                        placeholder="Start Date"
                        size="dense"
                      />
                    </div>
                    <span className="text-xs text-slate-400 font-medium">to</span>
                    <div className="w-36">
                      <DatePicker
                        value={endDate}
                        onChange={setEndDate}
                        placeholder="End Date"
                        size="dense"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Search Field */}
              <div className="relative flex-1 max-w-xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                  </svg>
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search mass, date, or order..."
                  className="w-full text-xs pl-8 pr-3 h-10 rounded-xl border border-slate-200/80 bg-white focus:outline-none focus:border-blue-600 shadow-2xs"
                />
              </div>
            </div>

            {/* Ready Selection Bar */}
            {activeTab === 'ready' && readySessions.length > 0 && (
              <div className="flex items-center justify-between text-xs px-1">
                <Button
                  variant="secondary"
                  size="dense"
                  onClick={toggleSelectAllReady}
                  icon={
                    <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  }
                >
                  {allReadySelected ? 'Deselect All' : 'Select All Ready'}
                </Button>
                <span className="font-bold text-blue-700 px-3 py-1.5 bg-blue-50 rounded-xl border border-blue-100">
                  {readySessions.filter(s => selectedIds.has(s.id)).length} of {readySessions.length} selected
                </span>
              </div>
            )}

            {/* Items List Body */}
            <div className="max-h-[380px] overflow-y-auto space-y-3 pr-1">
              {displayedList.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200 p-6">
                  <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center mb-2">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                  </div>
                  <p className="text-xs text-slate-500 font-medium">No sessions found matching current filters.</p>
                </div>
              ) : (
                displayedList.map(session => {
                  const isSelected = selectedIds.has(session.id)
                  const isReady = activeTab === 'ready'

                  return (
                    <div
                      key={session.id}
                      className={`p-4 rounded-xl border transition-all ${
                        isReady && isSelected
                          ? 'border-blue-400 bg-blue-50/30 ring-1 ring-blue-300 shadow-xs'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {isReady && (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(session.id)}
                            className="mt-1 h-4 w-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                          />
                        )}

                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1">
                            <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              {session.date} • {session.time}
                            </span>
                            {session.isFinalized ? (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 flex items-center gap-1">
                                <svg className="w-3 h-3 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                                </svg>
                                Finalized by {session.finalizedBy} ({session.finalizedAt})
                              </span>
                            ) : session.unmarkedServers.length === 0 ? (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                                <svg className="w-3 h-3 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                </svg>
                                100% Recorded ({session.totalServers}/{session.totalServers})
                              </span>
                            ) : (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                                <svg className="w-3 h-3 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                                </svg>
                                Unfinished: {session.recordedCount}/{session.totalServers} Recorded
                              </span>
                            )}
                          </div>

                          <h4 className="font-bold text-sm text-slate-900 truncate">
                            {session.title}
                          </h4>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Assigned Ministry Order: <span className="font-medium text-slate-700">{session.order}</span>
                          </p>

                          {/* Breakdown Pills */}
                          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                              Present: {session.statusCounts.present}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                              Late: {session.statusCounts.late}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                              Absent: {session.statusCounts.absent}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                              Excused: {session.statusCounts.excused}
                            </span>
                          </div>

                          {/* INCOMPLETE SECTION: SHOW MISSING SERVERS & AUTO-MARK ACTION */}
                          {session.unmarkedServers.length > 0 && (
                            <div className="mt-3 p-3 rounded-xl bg-amber-50/70 border border-amber-200/70">
                              <div className="text-[11px] font-semibold text-amber-900 mb-1 flex items-center gap-1.5">
                                <svg className="w-3.5 h-3.5 text-amber-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                                </svg>
                                <span>Unmarked Servers ({session.unmarkedServers.length}):</span>
                              </div>
                              <div className="text-xs text-amber-900 flex flex-wrap gap-1 font-medium">
                                {session.unmarkedServers.map((name, i) => (
                                  <span key={i} className="bg-amber-100 px-2 py-0.5 rounded border border-amber-200">
                                    {name}
                                  </span>
                                ))}
                              </div>

                              <div className="mt-2.5">
                                <Button
                                  variant="danger"
                                  size="xs"
                                  onClick={() => handleAutoMarkAbsent(session.id)}
                                  icon={
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                                    </svg>
                                  }
                                >
                                  Mark Remaining as Absent & Move to Ready
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-[11px] text-slate-500 text-center sm:text-left flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                </svg>
                <span>Finalizing locks duty records and writes to the audit log.</span>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <Button
                  variant="secondary"
                  size="dense"
                  onClick={() => setIsModalOpen(false)}
                >
                  Close
                </Button>
                {activeTab === 'ready' && (
                  <Button
                    variant="primary"
                    size="dense"
                    disabled={selectedIds.size === 0}
                    onClick={() => setConfirmModalOpen(true)}
                    icon={
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                      </svg>
                    }
                  >
                    Finalize {selectedIds.size} Selected Sessions
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* CONFIRMATION POPUP WITH MATS CONFIRM MODAL */}
      <ConfirmModal
        isOpen={confirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
        onConfirm={startFinalization}
        title="Confirm Bulk Attendance Finalization"
        message={`Are you sure you want to finalize and lock ${selectedIds.size} attendance sessions? Once finalized, records cannot be modified unless unlocked with administrator verification.`}
        confirmLabel="Confirm & Lock Sessions"
        variant="primary"
      />
    </div>
  )
}
