import React, { useState, useEffect, useMemo } from 'react'
import { auditService } from '@/services/auditService'
import type { AuditLog, AuditCategory, AuditAction } from '@/types/audit'
import { Card } from '@/components/Card'

export const AuditPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [actionFilter, setActionFilter] = useState<string>('all')

  // Selected details modal
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await auditService.getLogs(150)
      setLogs(data)
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
        const desc = log.description?.toLowerCase() || ''
        const actor = log.performedBy?.toLowerCase() || ''
        const action = log.action?.toLowerCase() || ''
        if (!desc.includes(q) && !actor.includes(q) && !action.includes(q)) {
          return false
        }
      }

      return true
    })
  }, [logs, categoryFilter, actionFilter, searchQuery])

  // Get distinct categories & actions for filter selectors
  const categories: AuditCategory[] = ['member', 'schedule', 'attendance', 'settings', 'system']
  
  const actions: AuditAction[] = [
    'MEMBER_CREATE', 'MEMBER_UPDATE', 'MEMBER_DELETE', 'MEMBER_ARCHIVE', 'MEMBER_IMPORT',
    'SCHEDULE_CREATE', 'SCHEDULE_UPDATE', 'SCHEDULE_DELETE', 'SCHEDULE_ASSIGN',
    'ATTENDANCE_SAVE', 'ATTENDANCE_LOCK', 'ATTENDANCE_UNLOCK', 'SETTINGS_UPDATE'
  ]

  // Badges color mapping
  const categoryBadgeColors: Record<AuditCategory, string> = {
    member: 'bg-indigo-50 border-indigo-200 text-indigo-700',
    schedule: 'bg-blue-50 border-blue-200 text-blue-700',
    attendance: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    settings: 'bg-amber-50 border-amber-200 text-amber-700',
    system: 'bg-purple-50 border-purple-200 text-purple-700'
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
    SETTINGS_UPDATE: 'bg-pink-100 text-pink-800 border-pink-200'
  }

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl font-sans">System Audit Trail</h1>
          <p className="text-sm text-gray-500 mt-1">Track and audit administrative activities and record updates.</p>
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 px-3.5 py-2 text-xs font-bold text-gray-700 transition-colors shadow-sm cursor-pointer"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89M9 11l3 3L22 4" />
          </svg>
          Refresh Logs
        </button>
      </div>

      {/* Filter panel */}
      <div className="flex flex-col md:flex-row gap-4 p-4 rounded-xl border border-gray-200 bg-white shadow-xs">
        {/* Search */}
        <div className="flex flex-col space-y-1 flex-1">
          <label htmlFor="audit-search" className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Search Activity
          </label>
          <input
            id="audit-search"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-shadow duration-150"
            placeholder="Search by description, actor email, or action..."
          />
        </div>

        {/* Category Filter */}
        <div className="flex flex-col space-y-1 w-full md:w-48">
          <label htmlFor="audit-category" className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Filter by Category
          </label>
          <select
            id="audit-category"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="block w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 focus:outline-none focus:border-blue-500 transition-colors"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c} className="capitalize">
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* Action Filter */}
        <div className="flex flex-col space-y-1 w-full md:w-56">
          <label htmlFor="audit-action" className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Filter by Action
          </label>
          <select
            id="audit-action"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="block w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 focus:outline-none focus:border-blue-500 transition-colors"
          >
            <option value="all">All Actions</option>
            {actions.map((a) => (
              <option key={a} value={a}>
                {a.replace('_', ' ')}
              </option>
            ))}
          </select>
        </div>

        {/* Clear Filter Button */}
        {(categoryFilter !== 'all' || actionFilter !== 'all' || searchQuery) && (
          <div className="flex items-end">
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

      {/* Main logs list card */}
      <Card className="p-0 overflow-hidden border-gray-200/80 shadow-xs">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-150">
            <thead className="bg-gray-50/70">
              <tr>
                <th className="px-6 py-3.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 w-1/5">
                  Timestamp
                </th>
                <th className="px-6 py-3.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 w-1/6">
                  Admin
                </th>
                <th className="px-6 py-3.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 w-1/12">
                  Category
                </th>
                <th className="px-6 py-3.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 w-1/6">
                  Action
                </th>
                <th className="px-6 py-3.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  Activity Description
                </th>
                <th className="px-6 py-3.5 text-right text-[10px] font-bold uppercase tracking-wider text-gray-400 w-24">
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
                filteredLogs.map((log) => (
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

                    {/* Description */}
                    <td className="px-6 py-4 text-xs text-gray-600 font-medium break-all">
                      {log.description}
                    </td>

                    {/* Action Details Toggle */}
                    <td className="px-6 py-4 whitespace-nowrap text-right text-xs">
                      {log.details ? (
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="text-xs font-bold text-blue-600 hover:text-blue-700 cursor-pointer"
                        >
                          View JSON
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
      </Card>

      {/* JSON Details Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity" 
            onClick={() => setSelectedLog(null)}
          ></div>

          {/* Modal Container */}
          <div className="relative w-full max-w-lg rounded-xl border border-gray-200 bg-white p-6 shadow-xl z-10 text-gray-800 flex flex-col max-h-[80vh] animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Activity Log Details</h3>
                <p className="text-[10px] text-gray-500 mt-0.5">{selectedLog.action} by {selectedLog.performedBy}</p>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-gray-400 hover:text-gray-900 p-1.5 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6" />
                </svg>
              </button>
            </div>

            {/* Description */}
            <div className="my-4 text-xs font-medium text-gray-600 bg-gray-50 p-3 rounded-lg border border-gray-150">
              <strong>Description: </strong>{selectedLog.description}
            </div>

            {/* Code editor / json display */}
            <div className="flex-1 overflow-y-auto min-h-0 bg-[#0f172a] rounded-lg p-4 font-mono text-[10px] text-emerald-400 border border-slate-800">
              <pre className="whitespace-pre-wrap">{JSON.stringify(selectedLog.details, null, 2)}</pre>
            </div>

            {/* Footer */}
            <div className="flex justify-end pt-3 border-t border-gray-100 mt-4">
              <button
                onClick={() => setSelectedLog(null)}
                className="rounded-lg border border-gray-200 bg-white hover:bg-gray-50 px-4 py-2 text-xs font-bold text-gray-700 transition-colors cursor-pointer"
              >
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
