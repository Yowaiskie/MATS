import React, { useState, useEffect, useMemo } from 'react'
import { auditService } from '@/services/auditService'
import { scheduleService } from '@/services/scheduleService'
import type { AuditLog, AuditCategory, AuditAction } from '@/types/audit'
import type { Schedule } from '@/types/schedule'
import { Card } from '@/components/Card'
import { Pagination } from '@/components/Pagination'
import { Loading } from '@/components/Loading'

export const AuditPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [schedulesMap, setSchedulesMap] = useState<Record<string, Schedule>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [actionFilter, setActionFilter] = useState<string>('all')

  // Selected details modal
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)
  const [showRawJson, setShowRawJson] = useState(false)

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [logsData, schedulesData] = await Promise.all([
        auditService.getLogs(150),
        scheduleService.getSchedules()
      ])
      setLogs(logsData)

      const map: Record<string, Schedule> = {}
      schedulesData.forEach(s => {
        map[s.id] = s
      })
      setSchedulesMap(map)
    } catch (err: any) {
      console.error(err)
      setError('Failed to load system audit logs.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, categoryFilter, actionFilter])

  // Format firestore timestamp
  const formatTimestamp = (ts: any) => {
    if (!ts) return 'Just now'
    try {
      const date = ts.toDate ? ts.toDate() : new Date(ts)
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })
    } catch {
      return 'N/A'
    }
  }

  // Helper date formatter
  const formatReadableDate = (dateStr: string): string => {
    if (!dateStr) return ''
    const parts = dateStr.split('-')
    if (parts.length !== 3) return dateStr
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ]
    const m = months[parseInt(parts[1], 10) - 1] || parts[1]
    const d = parseInt(parts[2], 10)
    return `${m} ${d}, ${parts[0]}`
  }

  // Helper time 12h clock
  const formatTime12 = (timeStr: string): string => {
    if (!timeStr) return ''
    const parts = timeStr.split(':')
    if (parts.length < 2) return timeStr
    let h = parseInt(parts[0], 10)
    const m = parts[1].padStart(2, '0')
    const ampm = h >= 12 ? 'PM' : 'AM'
    h = h % 12 || 12
    return `${h}:${m} ${ampm}`
  }

  // Clean & format description with specific Title, Date, and Time info
  const formatAuditDescription = (log: AuditLog): string => {
    if (!log.description) return ''
    let desc = log.description

    const schedId = log.details?.scheduleId
    const scheduleObj = schedId ? schedulesMap[schedId] : null
    const title = log.details?.scheduleTitle || scheduleObj?.title
    const dateStr = log.details?.date || scheduleObj?.date
    const formattedDate = dateStr ? formatReadableDate(dateStr) : ''
    const timeStr = scheduleObj ? `${formatTime12(scheduleObj.startTime)} - ${formatTime12(scheduleObj.endTime)}` : ''

    let fullScheduleInfo = ''
    if (title) {
      fullScheduleInfo = `'${title}'`
      if (formattedDate && timeStr) {
        fullScheduleInfo += ` (${formattedDate}, ${timeStr})`
      } else if (formattedDate) {
        fullScheduleInfo += ` (${formattedDate})`
      }
    } else if (formattedDate) {
      fullScheduleInfo = `schedule on ${formattedDate}`
    }

    if (fullScheduleInfo) {
      desc = desc.replace(/schedule ID:\s*([a-zA-Z0-9_-]+)/gi, fullScheduleInfo)
      desc = desc.replace(/session \(ID:\s*([a-zA-Z0-9_-]+)\)/gi, `session for ${fullScheduleInfo}`)
      desc = desc.replace(/with ID:\s*([a-zA-Z0-9_-]+)/gi, fullScheduleInfo)
      desc = desc.replace(/schedule:\s*([a-zA-Z0-9_-]+)/gi, fullScheduleInfo)
      desc = desc.replace(/for schedule$/gi, `for ${fullScheduleInfo}`)
    } else {
      desc = desc.replace(/for schedule ID:\s*[a-zA-Z0-9_-]{10,}/gi, 'for schedule')
      desc = desc.replace(/attendance session \(ID:\s*[a-zA-Z0-9_-]{10,}\)/gi, 'attendance session')
      desc = desc.replace(/with ID:\s*[a-zA-Z0-9_-]{10,}/gi, '')
      desc = desc.replace(/schedule ID:\s*[a-zA-Z0-9_-]{10,}/gi, 'schedule')
    }

    return desc.trim()
  }

  // Filter logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Category filter
      if (categoryFilter !== 'all' && log.category !== categoryFilter) return false
      
      // Action filter
      if (actionFilter !== 'all' && log.action !== actionFilter) return false

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const desc = formatAuditDescription(log).toLowerCase()
        const actor = log.performedBy?.toLowerCase() || ''
        const action = log.action?.toLowerCase() || ''
        if (!desc.includes(q) && !actor.includes(q) && !action.includes(q)) {
          return false
        }
      }

      return true
    })
  }, [logs, categoryFilter, actionFilter, searchQuery, schedulesMap])

  // Get distinct categories & actions for filter selectors
  const categories: AuditCategory[] = ['member', 'schedule', 'attendance', 'settings', 'system', 'excuse', 'finance', 'events']
  
  const actions: AuditAction[] = [
    'MEMBER_CREATE', 'MEMBER_UPDATE', 'MEMBER_DELETE', 'MEMBER_ARCHIVE', 'MEMBER_IMPORT',
    'SCHEDULE_CREATE', 'SCHEDULE_UPDATE', 'SCHEDULE_DELETE', 'SCHEDULE_ASSIGN',
    'ATTENDANCE_SAVE', 'ATTENDANCE_LOCK', 'ATTENDANCE_UNLOCK', 'SETTINGS_UPDATE',
    'USER_PASSWORD_CHANGE', 'USER_LOGIN', 'EXCUSE_SUBMITTED', 'EXCUSE_APPROVED',
    'EXCUSE_REJECTED', 'EXCUSE_CANCELLED', 'CATEGORY_CREATE', 'CATEGORY_UPDATE', 'CATEGORY_ARCHIVE', 'CATEGORY_RESTORE', 'CATEGORY_DELETE',
    'INCOME_ADD', 'INCOME_UPDATE', 'INCOME_ARCHIVE', 'INCOME_RESTORE', 'INCOME_DELETE', 'EXPENSE_RECORD', 'EXPENSE_UPDATE',
    'EXPENSE_ARCHIVE', 'EXPENSE_RESTORE', 'EXPENSE_DELETE', 'REQUEST_SUBMIT', 'REQUEST_APPROVE', 'REQUEST_REJECT',
    'REQUEST_CANCEL', 'REQUEST_VOID', 'FUNDS_RELEASE', 'LIQUIDATION_SUBMIT', 'LIQUIDATION_APPROVE', 'REQUEST_ARCHIVE', 'REQUEST_RESTORE', 'REQUEST_DELETE',
    'PERIOD_CLOSE', 'PERIOD_REOPEN', 'EVENT_CREATE', 'EVENT_UPDATE', 'EVENT_ARCHIVE',
    'EVENT_DELETE', 'EVENT_TASK_CREATE', 'EVENT_TASK_UPDATE', 'EVENT_TASK_DELETE', 'EVENT_CHECKLIST_CREATE',
    'EVENT_CHECKLIST_UPDATE', 'EVENT_ASSIGN_MEMBER', 'EVENT_ASSIGNMENT_UPDATE',
    'EVENT_ASSIGNMENT_REMOVE', 'EVENT_ROLE_CREATE'
  ]

  // Badges color mapping
  const categoryBadgeColors: Record<AuditCategory, string> = {
    member: 'bg-indigo-50 border-indigo-200 text-indigo-700',
    schedule: 'bg-blue-50 border-blue-200 text-blue-700',
    attendance: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    settings: 'bg-amber-50 border-amber-200 text-amber-700',
    system: 'bg-purple-50 border-purple-200 text-purple-700',
    excuse: 'bg-teal-50 border-teal-200 text-teal-700',
    finance: 'bg-rose-50 border-rose-200 text-rose-700',
    events: 'bg-blue-50 border-blue-200 text-blue-700'
  }

  const actionColors: Record<AuditAction, string> = {
    MEMBER_CREATE: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    MEMBER_UPDATE: 'bg-blue-100 text-blue-800 border-blue-200',
    MEMBER_DELETE: 'bg-red-100 text-red-800 border-red-200',
    MEMBER_ARCHIVE: 'bg-amber-100 text-amber-800 border-amber-200',
    MEMBER_IMPORT: 'bg-purple-100 text-purple-800 border-purple-200',
    SCHEDULE_CREATE: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    SCHEDULE_UPDATE: 'bg-blue-100 text-blue-800 border-blue-200',
    SCHEDULE_DELETE: 'bg-red-100 text-red-800 border-red-200',
    SCHEDULE_ASSIGN: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    ATTENDANCE_SAVE: 'bg-blue-100 text-blue-800 border-blue-200',
    ATTENDANCE_LOCK: 'bg-purple-100 text-purple-800 border-purple-200',
    ATTENDANCE_UNLOCK: 'bg-orange-100 text-orange-800 border-orange-200',
    SETTINGS_UPDATE: 'bg-pink-100 text-pink-800 border-pink-200',
    USER_PASSWORD_CHANGE: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    USER_LOGIN: 'bg-teal-100 text-teal-800 border-teal-200',
    EXCUSE_SUBMITTED: 'bg-teal-100 text-teal-800 border-teal-200',
    EXCUSE_APPROVED: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    EXCUSE_REJECTED: 'bg-rose-100 text-rose-800 border-rose-200',
    EXCUSE_CANCELLED: 'bg-slate-100 text-slate-800 border-slate-200',
    CATEGORY_CREATE: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    CATEGORY_UPDATE: 'bg-blue-100 text-blue-800 border-blue-200',
    CATEGORY_ARCHIVE: 'bg-amber-100 text-amber-800 border-amber-200',
    CATEGORY_RESTORE: 'bg-teal-100 text-teal-800 border-teal-200',
    CATEGORY_DELETE: 'bg-red-100 text-red-800 border-red-200',
    INCOME_ADD: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    INCOME_UPDATE: 'bg-blue-100 text-blue-800 border-blue-200',
    INCOME_ARCHIVE: 'bg-amber-100 text-amber-800 border-amber-200',
    INCOME_RESTORE: 'bg-teal-100 text-teal-800 border-teal-200',
    INCOME_DELETE: 'bg-red-100 text-red-800 border-red-200',
    EXPENSE_RECORD: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    EXPENSE_UPDATE: 'bg-blue-100 text-blue-800 border-blue-200',
    EXPENSE_ARCHIVE: 'bg-amber-100 text-amber-800 border-amber-200',
    EXPENSE_RESTORE: 'bg-teal-100 text-teal-800 border-teal-200',
    EXPENSE_DELETE: 'bg-red-100 text-red-800 border-red-200',
    REQUEST_SUBMIT: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    REQUEST_APPROVE: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    REQUEST_REJECT: 'bg-rose-100 text-rose-800 border-rose-200',
    REQUEST_CANCEL: 'bg-slate-100 text-slate-800 border-slate-200',
    REQUEST_VOID: 'bg-red-100 text-red-800 border-red-200',
    FUNDS_RELEASE: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    LIQUIDATION_SUBMIT: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    LIQUIDATION_APPROVE: 'bg-teal-100 text-teal-800 border-teal-200',
    REQUEST_ARCHIVE: 'bg-amber-100 text-amber-800 border-amber-200',
    REQUEST_RESTORE: 'bg-teal-100 text-teal-800 border-teal-200',
    REQUEST_DELETE: 'bg-red-100 text-red-800 border-red-200',
    PERIOD_CLOSE: 'bg-purple-100 text-purple-800 border-purple-200',
    PERIOD_REOPEN: 'bg-orange-100 text-orange-800 border-orange-200',
    EVENT_CREATE: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    EVENT_UPDATE: 'bg-blue-100 text-blue-800 border-blue-200',
    EVENT_ARCHIVE: 'bg-amber-100 text-amber-800 border-amber-200',
    EVENT_DELETE: 'bg-red-100 text-red-800 border-red-200',
    EVENT_TASK_CREATE: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    EVENT_TASK_UPDATE: 'bg-blue-100 text-blue-800 border-blue-200',
    EVENT_TASK_DELETE: 'bg-red-100 text-red-800 border-red-200',
    EVENT_CHECKLIST_CREATE: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    EVENT_CHECKLIST_UPDATE: 'bg-blue-100 text-blue-800 border-blue-200',
    EVENT_ASSIGN_MEMBER: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    EVENT_ASSIGNMENT_UPDATE: 'bg-blue-100 text-blue-800 border-blue-200',
    EVENT_ASSIGNMENT_REMOVE: 'bg-red-100 text-red-800 border-red-200',
    EVENT_ROLE_CREATE: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    EVENT_INCOME_ADD: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    EVENT_INCOME_UPDATE: 'bg-blue-100 text-blue-800 border-blue-200',
    EVENT_INCOME_DELETE: 'bg-red-100 text-red-800 border-red-200',
    EVENT_EXPENSE_ADD: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    EVENT_EXPENSE_UPDATE: 'bg-blue-100 text-blue-800 border-blue-200',
    EVENT_EXPENSE_DELETE: 'bg-red-100 text-red-800 border-red-200',
    EVENT_TRANSFER_CREATE: 'bg-purple-100 text-purple-800 border-purple-200',
    EVENT_TRANSFER_REVERSE: 'bg-orange-100 text-orange-800 border-orange-200',
    EVENT_FINANCE_CATEGORY_CREATE: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    EVENT_FINANCE_CATEGORY_UPDATE: 'bg-blue-100 text-blue-800 border-blue-200',
    EVENT_FINANCE_CATEGORY_ARCHIVE: 'bg-amber-100 text-amber-800 border-amber-200',
    FORM_CREATE: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    FORM_UPDATE: 'bg-blue-100 text-blue-800 border-blue-200',
    FORM_PUBLISH: 'bg-purple-100 text-purple-800 border-purple-200',
    FORM_UNPUBLISH: 'bg-amber-100 text-amber-800 border-amber-200',
    FORM_CLOSE: 'bg-slate-100 text-slate-800 border-slate-200',
    FORM_ARCHIVE: 'bg-rose-100 text-rose-800 border-rose-200',
    FORM_DUPLICATE: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    FORM_RESPONSE_VIEW: 'bg-blue-100 text-blue-800 border-blue-200',
    FORM_RESPONSE_EXPORT: 'bg-teal-100 text-teal-800 border-teal-200',
    FORM_RESPONSE_SUBMIT: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    FORM_RESPONSE_UPDATE: 'bg-amber-100 text-amber-800 border-amber-200',
    FORM_RESPONSE_DELETE: 'bg-red-100 text-red-800 border-red-200',
    CONTRIBUTION_PURPOSE_CREATE: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    CONTRIBUTION_PURPOSE_UPDATE: 'bg-blue-100 text-blue-800 border-blue-200',
    CONTRIBUTION_PURPOSE_ARCHIVE: 'bg-amber-100 text-amber-800 border-amber-200',
    EVENT_CONTRIBUTION_ADD: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    EVENT_CONTRIBUTION_UPDATE: 'bg-blue-100 text-blue-800 border-blue-200',
    EVENT_CONTRIBUTION_VOID: 'bg-amber-100 text-amber-800 border-amber-200',
    EVENT_CONTRIBUTION_ARCHIVE: 'bg-orange-100 text-orange-800 border-orange-200',
    EVENT_CONTRIBUTION_RESTORE: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    EVENT_CONTRIBUTION_DELETE: 'bg-red-100 text-red-800 border-red-200',
    EVENT_CONTRIBUTION_LINK_FINANCE: 'bg-teal-100 text-teal-800 border-teal-200',
    EVENT_CONTRIBUTION_EXPORT: 'bg-purple-100 text-purple-800 border-purple-200'
  }

  // Friendly human-readable property key dictionary
  const keyLabels: Record<string, string> = {
    scheduleTitle: 'Schedule Title',
    scheduleId: 'Schedule ID',
    sessionId: 'Session ID',
    date: 'Schedule Date',
    recordCount: 'Records Saved',
    memberIds: 'Assigned Members',
    lockState: 'Session Lock Status',
    template: 'Report Template Layout',
    updates: 'Updated Parameters',
    input: 'Form Inputs',
    firstName: 'First Name',
    lastName: 'Last Name',
    rank: 'Rank / Designation',
    status: 'Status',
    phoneNumber: 'Phone Number'
  }

  const renderDetailValue = (val: any): React.ReactNode => {
    if (val === null || val === undefined) return <span className="text-gray-400 italic">None</span>
    if (typeof val === 'boolean') return <span className="font-semibold text-blue-600">{val ? 'Yes' : 'No'}</span>
    if (typeof val === 'number') return <span className="font-semibold text-gray-800">{val}</span>
    if (Array.isArray(val)) {
      return (
        <span className="font-semibold text-gray-700 bg-gray-100 px-2 py-0.5 rounded text-[11px]">
          {val.length} item{val.length === 1 ? '' : 's'}
        </span>
      )
    }
    if (typeof val === 'object') {
      return (
        <div className="mt-1 space-y-1 bg-gray-50 p-2 rounded-lg border border-gray-200 text-xs">
          {Object.entries(val).map(([k, v]) => (
            <div key={k} className="flex items-start justify-between gap-2">
              <span className="text-[11px] font-semibold text-gray-500 capitalize">{keyLabels[k] || k}:</span>
              <span className="text-[11px] font-medium text-gray-800 text-right">{String(v)}</span>
            </div>
          ))}
        </div>
      )
    }
    const str = String(val)
    if (str.includes('\n')) {
      return (
        <div className="mt-1 bg-gray-50 p-2 rounded-lg border border-gray-200 font-mono text-[11px] text-gray-700 whitespace-pre-wrap max-h-40 overflow-y-auto">
          {str}
        </div>
      )
    }
    return <span className="font-medium text-gray-800">{str}</span>
  }

  // Format details object into structured human-readable items
  const getFormattedDetailsList = (log: AuditLog) => {
    const details = log.details || {}
    const list: { label: string; value: React.ReactNode }[] = []

    const schedId = details.scheduleId
    const scheduleObj = schedId ? schedulesMap[schedId] : null
    const title = details.scheduleTitle || scheduleObj?.title
    const dateStr = details.date || scheduleObj?.date
    const formattedDate = dateStr ? formatReadableDate(dateStr) : ''
    const timeStr = scheduleObj ? `${formatTime12(scheduleObj.startTime)} - ${formatTime12(scheduleObj.endTime)}` : ''

    if (title) {
      list.push({ label: 'Schedule Title', value: <span className="font-bold text-gray-900 text-xs">{title}</span> })
    }
    if (formattedDate) {
      list.push({ label: 'Schedule Date', value: <span className="font-semibold text-gray-800 text-xs">{formattedDate}</span> })
    }
    if (timeStr) {
      list.push({ label: 'Schedule Time', value: <span className="font-semibold text-blue-600 font-mono text-[11px] bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-md">{timeStr}</span> })
    }
    if (details.recordCount !== undefined) {
      list.push({ label: 'Total Records Saved', value: <span className="font-bold text-emerald-700 font-mono bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-md text-[11px]">{details.recordCount}</span> })
    }
    if (details.lockState) {
      list.push({ label: 'Session Lock Status', value: <span className="font-semibold text-purple-700 bg-purple-50 border border-purple-100 px-2 py-0.5 rounded-md text-[11px]">{details.lockState}</span> })
    }

    // Include other non-ID keys
    Object.entries(details).forEach(([key, val]) => {
      if (['scheduleId', 'sessionId', 'scheduleTitle', 'date', 'recordCount', 'lockState'].includes(key)) {
        return // skip already formatted or raw ID keys
      }
      const label = keyLabels[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())
      list.push({ label, value: renderDetailValue(val) })
    })

    return list
  }

  if (loading) {
    return (
      <div className="py-24 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
        <Loading variant="spinner" label="Loading System Audit Trail..." />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl font-sans">System Audit Trail</h1>
        <p className="text-sm text-gray-500 mt-1">Track and audit administrative activities and record updates.</p>
      </div>

      {/* Filter Control Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 p-4 rounded-xl border border-gray-200 bg-white shadow-xs">
        {/* Search */}
        <div className="flex flex-col space-y-1 flex-1">
          <label htmlFor="audit-search" className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Search Audit Trail
          </label>
          <input
            id="audit-search"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-shadow duration-150"
            placeholder="Search activity description or admin email..."
          />
        </div>

        {/* Category Filter */}
        <div className="flex flex-col space-y-1 flex-1">
          <label htmlFor="audit-category" className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Category
          </label>
          <select
            id="audit-category"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="block w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 focus:outline-none focus:border-blue-500 transition-colors"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c} className="capitalize">{c}</option>
            ))}
          </select>
        </div>

        {/* Action Filter */}
        <div className="flex flex-col space-y-1 flex-1">
          <label htmlFor="audit-action" className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Action Type
          </label>
          <select
            id="audit-action"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="block w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 focus:outline-none focus:border-blue-500 transition-colors"
          >
            <option value="all">All Actions</option>
            {actions.map((a) => (
              <option key={a} value={a}>{a.replace('_', ' ')}</option>
            ))}
          </select>
        </div>

        {/* Reset Filters Button */}
        {(categoryFilter !== 'all' || actionFilter !== 'all' || searchQuery) && (
          <div className="flex items-end justify-start">
            <button
              onClick={() => {
                setCategoryFilter('all')
                setActionFilter('all')
                setSearchQuery('')
              }}
              className="text-xs text-blue-600 hover:text-blue-700 font-bold py-2 px-3 transition-colors cursor-pointer"
            >
              Clear Filters
            </button>
          </div>
        )}
      </div>

      {/* Main Audit Data Table */}
      <Card className="p-0 overflow-hidden border border-gray-200 shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="px-6 py-3.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 w-40">
                  Timestamp
                </th>
                <th className="px-6 py-3.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 w-44">
                  Admin
                </th>
                <th className="px-6 py-3.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 w-28">
                  Category
                </th>
                <th className="px-6 py-3.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 w-36">
                  Action
                </th>
                <th className="px-6 py-3.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  Activity Description
                </th>
                <th className="px-6 py-3.5 text-right text-[10px] font-bold uppercase tracking-wider text-gray-400 w-28">
                  Details
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
                      <span className="text-xs text-gray-500">Retrieving audit trail...</span>
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-red-600 font-medium">
                    {error}
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-xs text-gray-400 italic">
                    No system activities found matching the filter criteria.
                  </td>
                </tr>
              ) : (
                filteredLogs.slice((currentPage - 1) * 10, currentPage * 10).map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50/30 transition-colors">
                    {/* Timestamp */}
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500 font-medium">
                      {formatTimestamp(log.timestamp)}
                    </td>

                    {/* Actor */}
                    <td className="px-6 py-4 whitespace-nowrap text-xs font-semibold text-gray-700">
                      {log.performedBy}
                    </td>

                    {/* Category */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${categoryBadgeColors[log.category] || 'bg-gray-50 text-gray-500'}`}>
                        {log.category}
                      </span>
                    </td>

                    {/* Action */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-block px-2 py-0.5 rounded-md text-[9px] font-bold tracking-tight uppercase border ${actionColors[log.action] || 'bg-gray-50 text-gray-500'}`}>
                        {log.action.replace('_', ' ')}
                      </span>
                    </td>

                    {/* Description (Formatted & Clean) */}
                    <td className="px-6 py-4 text-xs text-gray-700 font-medium leading-relaxed">
                      {formatAuditDescription(log)}
                    </td>

                    {/* Action Details Toggle */}
                    <td className="px-6 py-4 whitespace-nowrap text-right text-xs">
                      {log.details ? (
                        <button
                          onClick={() => {
                            setSelectedLog(log)
                            setShowRawJson(false)
                          }}
                          className="text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-md transition-colors cursor-pointer"
                        >
                          View Details
                        </button>
                      ) : (
                        <span className="text-[10px] text-gray-400 italic">None</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          currentPage={currentPage}
          totalItems={filteredLogs.length}
          pageSize={10}
          onPageChange={setCurrentPage}
        />
      </Card>

      {/* Human-Friendly Details Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity" 
            onClick={() => setSelectedLog(null)}
          ></div>

          {/* Modal Container */}
          <div className="relative w-full max-w-lg rounded-xl border border-gray-200 bg-white p-6 shadow-xl z-10 text-gray-800 flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Activity Details</h3>
                <p className="text-[10px] text-gray-500 mt-0.5">{selectedLog.action.replace('_', ' ')} • {selectedLog.performedBy}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                aria-label="Close details window"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Description Summary */}
            <div className="my-3 text-xs font-medium text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-200 leading-relaxed">
              <span className="font-bold text-gray-900">Activity Summary: </span>
              {formatAuditDescription(selectedLog)}
            </div>

            {/* View Mode Toggle (Friendly Details vs Technical JSON) */}
            <div className="flex items-center justify-between pb-2">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                {showRawJson ? 'Technical JSON View' : 'Formatted Activity Data'}
              </span>
              <button
                type="button"
                onClick={() => setShowRawJson(!showRawJson)}
                className="text-[11px] font-semibold text-blue-600 hover:underline cursor-pointer"
              >
                {showRawJson ? '← Switch to Formatted View' : 'Show Raw JSON'}
              </button>
            </div>

            {/* Content Container */}
            <div className="flex-1 overflow-y-auto min-h-[150px] max-h-[350px] pr-1">
              {showRawJson ? (
                <div className="bg-[#0f172a] rounded-lg p-4 font-mono text-[10px] text-emerald-400 border border-slate-800">
                  <pre className="whitespace-pre-wrap">{JSON.stringify(selectedLog.details, null, 2)}</pre>
                </div>
              ) : (
                <div className="space-y-2 border border-gray-200 rounded-xl p-3.5 bg-white">
                  {getFormattedDetailsList(selectedLog).length > 0 ? (
                    getFormattedDetailsList(selectedLog).map((item, idx) => (
                      <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between py-1.5 border-b border-gray-100 last:border-0 gap-1">
                        <span className="text-xs font-semibold text-gray-500 shrink-0">
                          {item.label}:
                        </span>
                        <div className="text-xs text-right">
                          {item.value}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-gray-500 italic">No additional details recorded.</p>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end pt-3 border-t border-gray-100 mt-4">
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="rounded-lg border border-gray-200 bg-white hover:bg-gray-50 px-4 py-2 text-xs font-bold text-gray-700 transition-colors cursor-pointer shadow-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
