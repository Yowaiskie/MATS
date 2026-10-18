import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/Button'
import { DatePicker } from '@/components/DatePicker'
import { CustomSelect } from '@/components/CustomSelect'
import { Modal } from '@/components/Modal'
import { ConfirmModal } from '@/components/Dialog'
import { bulkAttendanceService, type BulkAttendanceItem } from '@/services/bulkAttendanceService'
import { useAuth } from '@/features/authentication/AuthContext'
import { useToast } from '@/context/ToastContext'

interface BulkFinalizeAttendanceModalProps {
  scheduleIds?: string[]
  onClose: () => void
  onCompleted: () => Promise<void>
}

const DATE_RANGE_OPTIONS = [
  { value: 'this_month', label: 'This Month' },
  { value: 'this_week', label: 'This Week' },
  { value: 'last_30_days', label: 'Last 30 Days' },
  { value: 'custom', label: 'Custom Range...' },
  { value: 'all', label: 'All Available Past Dates' }
]

const ROTATING_SCAN_TEXTS = [
  'Scanning completed schedules...',
  'Checking assigned server rosters...',
  'Verifying recorded attendance statuses...',
  'Evaluating lock requirements...',
  'Finalizing evaluation preview...'
]

export const BulkFinalizeAttendanceModal: React.FC<BulkFinalizeAttendanceModalProps> = ({
  scheduleIds,
  onClose,
  onCompleted
}) => {
  const { user } = useAuth()
  const { toast } = useToast()
  // Stable ref for toast so loadPreviewData doesn't re-create when toast reference changes
  const toastRef = useRef(toast)
  useEffect(() => { toastRef.current = toast }, [toast])

  // Data states
  const [items, setItems] = useState<BulkAttendanceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingProgress, setLoadingProgress] = useState(15)
  const [loadingTextIndex, setLoadingTextIndex] = useState(0)

  // Tab & Filters
  const [activeTab, setActiveTab] = useState<'ready' | 'incomplete' | 'finalized'>('ready')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')

  // Date Range filter - Default to 'this_month' to protect Firebase reads quota
  const [dateRangePreset, setDateRangePreset] = useState<string>('this_month')
  const [startDate, setStartDate] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  })
  const [endDate, setEndDate] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })

  // Finalizing execution states
  const [isFinalizing, setIsFinalizing] = useState(false)
  const [finalizePercent, setFinalizePercent] = useState(0)
  const [currentFinalizeStep, setCurrentFinalizeStep] = useState(0)
  const [currentFinalizeLabel, setCurrentFinalizeLabel] = useState('')
  const [executionStatuses, setExecutionStatuses] = useState<Record<string, 'pending' | 'processing' | 'done' | 'failed'>>({})
  const [isFinished, setIsFinished] = useState(false)
  const [finalizedSummary, setFinalizedSummary] = useState<BulkAttendanceItem[]>([])
  // Stable ref: total sessions in the current finalization run — never changes mid-loop
  const finalizeTotalRef = useRef(0)

  // Modal dialog confirm
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [resolvingScheduleId, setResolvingScheduleId] = useState<string | null>(null)

  // Rotating loading texts for initial scan
  useEffect(() => {
    if (!loading) return
    const textInterval = setInterval(() => {
      setLoadingTextIndex(prev => (prev + 1) % ROTATING_SCAN_TEXTS.length)
    }, 1200)

    const barInterval = setInterval(() => {
      setLoadingProgress(prev => {
        if (prev >= 90) return prev
        return prev + Math.floor(Math.random() * 8) + 3
      })
    }, 180)

    return () => {
      clearInterval(textInterval)
      clearInterval(barInterval)
    }
  }, [loading])

  // Load preview data from service
  const loadPreviewData = useCallback(async () => {
    setLoading(true)
    setLoadingProgress(20)
    try {
      const results = await bulkAttendanceService.previewSessions({
        scheduleIds,
        onProgress: (processed, total) => {
          if (total > 0) {
            // Use Math.max so real progress never pushes the bar BACKWARD past
            // what the fake animation interval has already advanced it to
            setLoadingProgress(prev => Math.max(prev, Math.min(95, Math.round((processed / total) * 100))))
          }
        }
      })
      setItems(results)

      // Auto-select all ready sessions by default
      const readyIds = results.filter(i => i.eligible && !i.isFinalized).map(i => i.scheduleId)
      setSelectedIds(new Set(readyIds))
    } catch (err: any) {
      console.error(err)
      // Use the ref so this callback never re-creates just because toast changed reference
      toastRef.current.error('Preview Error', err.message || 'Failed to analyze attendance sessions.')
    } finally {
      setLoadingProgress(100)
      setTimeout(() => setLoading(false), 250)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleIds]) // intentionally omit `toast` — see toastRef below

  // Run exactly once on mount — NOT every time toast gets a new reference
  // (toast.success/error calls update ToastContext state → new toast ref → old dep would re-trigger loadPreviewData)
  useEffect(() => {
    loadPreviewData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Filter items by date range and search query
  const filteredItems = useMemo(() => {
    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

    return items.filter(item => {
      // 1. Date Range
      if (dateRangePreset === 'this_week') {
        const d = new Date()
        const day = d.getDay()
        const diffToSunday = d.getDate() - day
        const sunday = new Date(d.setDate(diffToSunday))
        const sunStr = `${sunday.getFullYear()}-${String(sunday.getMonth() + 1).padStart(2, '0')}-${String(sunday.getDate()).padStart(2, '0')}`
        if (item.date < sunStr || item.date > todayStr) return false
      } else if (dateRangePreset === 'this_month') {
        const ym = todayStr.substring(0, 7)
        if (!item.date.startsWith(ym)) return false
      } else if (dateRangePreset === 'last_30_days') {
        const past30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        const past30Str = `${past30.getFullYear()}-${String(past30.getMonth() + 1).padStart(2, '0')}-${String(past30.getDate()).padStart(2, '0')}`
        if (item.date < past30Str) return false
      } else if (dateRangePreset === 'custom') {
        if (startDate && item.date < startDate) return false
        if (endDate && item.date > endDate) return false
      }

      // 2. Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim()
        const matches =
          item.title.toLowerCase().includes(query) ||
          (item.order && item.order.toLowerCase().includes(query)) ||
          item.date.includes(query)
        if (!matches) return false
      }

      return true
    })
  }, [items, dateRangePreset, startDate, endDate, searchQuery])

  const readyItems = useMemo(() => filteredItems.filter(i => !i.isFinalized && i.eligible), [filteredItems])
  const incompleteItems = useMemo(() => filteredItems.filter(i => !i.isFinalized && !i.eligible), [filteredItems])
  const finalizedItems = useMemo(() => filteredItems.filter(i => i.isFinalized), [filteredItems])

  const displayedList =
    activeTab === 'ready' ? readyItems :
    activeTab === 'incomplete' ? incompleteItems :
    finalizedItems

  const allReadySelected = readyItems.length > 0 && readyItems.every(i => selectedIds.has(i.scheduleId))

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
      setSelectedIds(new Set(readyItems.map(i => i.scheduleId)))
    }
  }

  // Quick Resolver: Auto-mark absent for incomplete session
  const handleAutoMarkAbsent = async (scheduleId: string) => {
    setResolvingScheduleId(scheduleId)
    try {
      const actor = user?.email || 'Admin'
      await bulkAttendanceService.autoMarkUnmarkedAsAbsent(scheduleId, actor)

      // Optimistic in-place update — no full reload so the modal never shows the loading screen again
      setItems(prev => prev.map(item => {
        if (item.scheduleId !== scheduleId) return item
        const newAbsent = item.statusCounts.absent + item.unmarkedMemberIds.length
        return {
          ...item,
          recordedCount: item.totalServers,
          statusCounts: { ...item.statusCounts, absent: newAbsent },
          unmarkedMemberIds: [],
          unmarkedMemberNames: [],
          eligible: item.totalServers > 0,
          reason: 'Ready to finalize.'
        }
      }))
      // Auto-select the newly resolved session for when they view the Ready tab later
      setSelectedIds(prev => new Set([...prev, scheduleId]))

      toastRef.current.success('Roster Updated', 'Unmarked servers have been marked as absent. Session moved to Ready.')
    } catch (err: any) {
      console.error(err)
      toastRef.current.error('Update Failed', err.message || 'Could not auto-mark servers.')
    } finally {
      setResolvingScheduleId(null)
    }
  }

  // Execute Finalization
  const executeFinalize = async () => {
    setConfirmOpen(false)
    setIsFinalizing(true)
    setIsFinished(false)
    setFinalizePercent(0)

    const candidates = readyItems.filter(i => selectedIds.has(i.scheduleId))
    const total = candidates.length
    // Write to ref BEFORE clearing selectedIds so JSX always reads the stable value
    finalizeTotalRef.current = total

    const statuses: Record<string, 'pending' | 'processing' | 'done' | 'failed'> = {}
    candidates.forEach(c => { statuses[c.scheduleId] = 'pending' })
    setExecutionStatuses(statuses)

    const actor = user?.email || 'Admin'
    const lockedRecords: BulkAttendanceItem[] = []

    for (let i = 0; i < total; i++) {
      const item = candidates[i]
      setCurrentFinalizeStep(i + 1)
      setCurrentFinalizeLabel(`Locking "${item.title}" (${item.time})...`)
      setExecutionStatuses(s => ({ ...s, [item.scheduleId]: 'processing' }))

      try {
        const finalizedItem = await bulkAttendanceService.finalize(item.scheduleId, actor)
        lockedRecords.push(finalizedItem)
        setExecutionStatuses(s => ({ ...s, [item.scheduleId]: 'done' }))
      } catch (err: any) {
        console.error(`Failed to finalize schedule ${item.scheduleId}:`, err)
        setExecutionStatuses(s => ({ ...s, [item.scheduleId]: 'failed' }))
      }

      const pct = Math.round(((i + 1) / total) * 100)
      setFinalizePercent(pct)
      await new Promise(r => setTimeout(r, 120))
    }

    setFinalizedSummary(lockedRecords)
    setIsFinalizing(false)
    setIsFinished(true)
    setSelectedIds(new Set())

    try {
      await onCompleted()
    } catch (e) {
      console.error('onCompleted callback error:', e)
    }
  }

  return (
    <>
      <Modal
        isOpen
        onClose={() => { if (!isFinalizing) onClose() }}
        title="Bulk Finalize Attendance"
        subtitle="Verify and finalize completed service schedules across specific date ranges."
        badge="Attendance Security"
        maxWidth="4xl"
        icon={
          <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
        }
      >
        {loading ? (
          /* INITIAL LOADING STATE: LOGO SPINNER + PROGRESSIVE PROGRESS BAR */
          <div className="py-12 px-6 flex flex-col items-center justify-center my-auto select-none">
            {/* Spinning Church/Ministry Logo */}
            <div className="relative flex items-center justify-center h-20 w-20 mb-6">
              <div className="absolute inset-0 rounded-full border-4 border-blue-100 border-t-blue-600 animate-spin" />
              <div className="h-12 w-12 rounded-full bg-white p-1 shadow-md border border-slate-100 overflow-hidden z-10 flex items-center justify-center">
                <img
                  src="/favicon/favicon.png"
                  alt="MATS Logo"
                  className="h-full w-full object-contain"
                  onError={(e) => {
                    // Fallback to ministry logo
                    (e.target as HTMLImageElement).src = '/ministy_logo.jpg'
                  }}
                />
              </div>
            </div>

            <h3 className="text-base font-bold text-slate-900 tracking-tight">Analyzing Attendance Records</h3>
            <p className="text-xs text-slate-500 mt-1 text-center max-w-sm">
              Verifying past mass schedules, assigned servers, and recorded duty statuses.
            </p>

            {/* Progressive Bar */}
            <div className="w-full max-w-md mt-6">
              <div className="flex items-center justify-between text-xs font-semibold mb-2">
                <span className="text-blue-600 animate-in fade-in transition-all duration-300">
                  {ROTATING_SCAN_TEXTS[loadingTextIndex]}
                </span>
                <span className="text-slate-800 font-mono font-bold">{loadingProgress}%</span>
              </div>

              <div className="w-full h-3 bg-slate-100 rounded-full p-0.5 border border-slate-200 overflow-hidden shadow-inner">
                <div
                  className="h-full bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-500 rounded-full transition-all duration-300 ease-out relative overflow-hidden"
                  style={{ width: `${loadingProgress}%` }}
                >
                  <div className="absolute inset-0 bg-white/30 w-full animate-[shimmer_1.5s_infinite] -skew-x-12"></div>
                </div>
              </div>
            </div>
          </div>
        ) : isFinalizing ? (
          /* FINALIZING EXECUTION STATE: LOGO SPINNER + LIVE PROGRESSIVE PROGRESS BAR */
          <div className="py-10 px-6 flex flex-col items-center justify-center my-auto select-none">
            {/* Logo Spinner */}
            <div className="relative flex items-center justify-center h-16 w-16 mb-5">
              <div className="absolute inset-0 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin" />
              <div className="h-10 w-10 rounded-full bg-white p-1 shadow-sm border border-slate-100 overflow-hidden z-10 flex items-center justify-center">
                <img
                  src="/favicon/favicon.png"
                  alt="MATS Logo"
                  className="h-full w-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/ministy_logo.jpg'
                  }}
                />
              </div>
            </div>

            <h3 className="text-base font-bold text-slate-900 tracking-tight">Finalizing Selected Attendance Sessions</h3>
            <p className="text-xs text-slate-500 mt-1 text-center max-w-md">
              Applying cryptographic security locks and writing to the audit registry. Please do not close this window.
            </p>

            {/* Progressive Bar */}
            <div className="w-full max-w-lg mt-6">
              <div className="flex items-center justify-between text-xs font-semibold mb-2">
                <span className="text-blue-600 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
                  Processing {currentFinalizeStep} of {finalizeTotalRef.current} sessions
                </span>
                <span className="text-slate-900 font-bold text-sm">{finalizePercent}%</span>
              </div>

              <div className="w-full h-3.5 bg-slate-100 rounded-full p-0.5 border border-slate-200 overflow-hidden shadow-inner">
                <div
                  className="h-full bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-600 rounded-full transition-all duration-300 ease-out relative overflow-hidden"
                  style={{ width: `${finalizePercent}%` }}
                >
                  <div className="absolute inset-0 bg-white/25 w-full animate-[shimmer_1.5s_infinite] -skew-x-12"></div>
                </div>
              </div>

              <p className="text-xs text-center font-medium text-slate-600 mt-2.5 truncate px-2">
                {currentFinalizeLabel}
              </p>
            </div>

            {/* Checklist — derived from executionStatuses, not from selectedIds, so it stays stable when selectedIds is cleared */}
            <div className="w-full max-w-lg mt-5 divide-y divide-slate-100 border border-slate-200 rounded-xl bg-slate-50/50 p-1 max-h-44 overflow-y-auto">
              {Object.entries(executionStatuses).map(([scheduleId, status]) => {
                const item = items.find(it => it.scheduleId === scheduleId)
                return (
                  <div key={scheduleId} className="p-2.5 flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700 truncate pr-2">{item?.title ?? scheduleId}</span>
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
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4}></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Locking...
                      </span>
                    ) : status === 'failed' ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                        Failed
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
              {finalizedSummary.length} attendance session(s) were successfully finalized and locked against unauthorized edits.
            </p>

            <div className="w-full max-w-md mt-6 p-4 rounded-xl bg-slate-50 border border-slate-200 text-left space-y-2 text-xs">
              <div className="font-semibold text-slate-800 mb-1 flex items-center justify-between">
                <span>Summary of Finalized Schedules:</span>
                <span className="text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded text-[11px]">
                  {finalizedSummary.length} locked
                </span>
              </div>
              <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
                {finalizedSummary.map(s => (
                  <div key={s.scheduleId} className="py-2 flex items-center justify-between text-slate-600">
                    <span className="truncate pr-2 font-medium">{s.title}</span>
                    <span className="text-slate-400 font-mono text-[11px] shrink-0">{s.totalServers} servers</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 flex items-center gap-2">
              <Button
                variant="primary"
                onClick={() => { setIsFinished(false); setActiveTab('finalized'); loadPreviewData() }}
              >
                View Finalized Records
              </Button>
              <Button
                variant="secondary"
                onClick={onClose}
              >
                Done & Close
              </Button>
            </div>
          </div>
        ) : (
          /* REGULAR TABBED VIEW */
          <div className="space-y-4">
            {/* Top 3 KPI Tabs */}
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
                    {readyItems.length}
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
                    {incompleteItems.length}
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
                    {finalizedItems.length}
                  </span>
                </div>
                <div className="text-base sm:text-lg font-bold text-slate-900 mt-1">Locked</div>
                <p className="text-[11px] text-slate-500 mt-0.5 hidden sm:block">Archived and locked</p>
              </button>
            </div>

            {/* Filter Bar */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
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
            {activeTab === 'ready' && readyItems.length > 0 && (
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
                  {readyItems.filter(i => selectedIds.has(i.scheduleId)).length} of {readyItems.length} selected
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
                displayedList.map(item => {
                  const isSelected = selectedIds.has(item.scheduleId)
                  const isReady = activeTab === 'ready'

                  return (
                    <div
                      key={item.scheduleId}
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
                            onChange={() => toggleSelect(item.scheduleId)}
                            className="mt-1 h-4 w-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                          />
                        )}

                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1">
                            <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              {item.date} • {item.time}
                            </span>
                            {item.isFinalized ? (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 flex items-center gap-1">
                                <svg className="w-3 h-3 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                                </svg>
                                Finalized by {item.finalizedBy || 'Admin'}{item.finalizedAt ? ` (${item.finalizedAt})` : ''}
                              </span>
                            ) : item.eligible ? (
                              item.totalServers === 0 ? (
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1">
                                  <svg className="w-3 h-3 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                                  </svg>
                                  No Servers Assigned (0/0)
                                </span>
                              ) : (
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                                  <svg className="w-3 h-3 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                  </svg>
                                  100% Recorded ({item.totalServers}/{item.totalServers})
                                </span>
                              )
                            ) : (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                                <svg className="w-3 h-3 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                                </svg>
                                Unfinished: {item.recordedCount}/{item.totalServers} Recorded
                              </span>
                            )}
                          </div>

                          <div className="flex items-center justify-between gap-2">
                            <h4 className="font-bold text-sm text-slate-900 truncate">
                              {item.title}
                            </h4>
                            <Link
                              to={`/attendance?scheduleId=${encodeURIComponent(item.scheduleId)}`}
                              className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 shrink-0"
                            >
                              <span>Open Attendance</span>
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                              </svg>
                            </Link>
                          </div>

                          <p className="text-xs text-slate-500 mt-0.5">
                            Assigned Ministry Order: <span className="font-medium text-slate-700">{item.order}</span>
                          </p>

                          {/* Breakdown Pills */}
                          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                              Present: {item.statusCounts.present}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                              Late: {item.statusCounts.late}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                              Absent: {item.statusCounts.absent}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                              Excused: {item.statusCounts.excused}
                            </span>
                          </div>

                          {/* INCOMPLETE SECTION: SHOW MISSING SERVERS & AUTO-MARK ACTION */}
                          {!item.isFinalized && !item.eligible && item.unmarkedMemberNames.length > 0 && (
                            <div className="mt-3 p-3 rounded-xl bg-amber-50/70 border border-amber-200/70">
                              <div className="text-[11px] font-semibold text-amber-900 mb-1 flex items-center gap-1.5">
                                <svg className="w-3.5 h-3.5 text-amber-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                                </svg>
                                <span>Unmarked Servers ({item.unmarkedMemberNames.length}):</span>
                              </div>
                              <div className="text-xs text-amber-900 flex flex-wrap gap-1 font-medium">
                                {item.unmarkedMemberNames.map((name, i) => (
                                  <span key={i} className="bg-amber-100 px-2 py-0.5 rounded border border-amber-200">
                                    {name}
                                  </span>
                                ))}
                              </div>

                              <div className="mt-2.5">
                                <Button
                                  variant="danger"
                                  size="xs"
                                  loading={resolvingScheduleId === item.scheduleId}
                                  loadingText="Updating Roster..."
                                  onClick={() => handleAutoMarkAbsent(item.scheduleId)}
                                  icon={
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                                    </svg>
                                  }
                                >
                                  Mark Remaining as Absent
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
                  onClick={onClose}
                >
                  Close
                </Button>
                {activeTab === 'ready' && (
                  <Button
                    variant="primary"
                    size="dense"
                    disabled={selectedIds.size === 0}
                    onClick={() => setConfirmOpen(true)}
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

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={executeFinalize}
        title="Confirm Bulk Attendance Finalization"
        message={`Are you sure you want to finalize and lock ${selectedIds.size} attendance sessions? Once finalized, records cannot be modified unless unlocked with administrator password verification.`}
        confirmLabel="Confirm & Lock Sessions"
        variant="primary"
      />
    </>
  )
}
