import React, { useState, useEffect } from 'react'
import { reportService } from '@/services/reportService'
import type { ReportRawData, OverallSummary, MemberReportRow, ScheduleReportRow, MonthlyReportRow } from '@/services/reportService'
import { Card } from '@/components/Card'
import { FilterBar } from '../components/FilterBar'
import { SummaryCards } from '../components/SummaryCards'
import { AbsenceBreakdownModal } from '../components/AbsenceBreakdownModal'
import { AlertModal } from '@/components/Dialog'

import { downloadMembersReportPdf } from '@/utils/memberPdfReport'

type TabType = 'summary' | 'member' | 'schedule' | 'monthly'

export const ReportsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('summary')

  // Date and filter states
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  // Report raw data
  const [rawData, setRawData] = useState<ReportRawData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Absence breakdown modal state
  const [selectedMemberRow, setSelectedMemberRow] = useState<MemberReportRow | null>(null)
  const [showBreakdownModal, setShowBreakdownModal] = useState(false)

  // Load baseline data on change of date filters
  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await reportService.loadReportData(
        startDate || undefined, 
        endDate || undefined
      )
      setRawData(data)
    } catch (err: any) {
      console.error(err)
      setError('Failed to fetch attendance reports data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [startDate, endDate])

  // Clear query on tab change
  useEffect(() => {
    setSearchQuery('')
    setStatusFilter('all')
  }, [activeTab])

  // Computed views based on rawData
  const getOverallSummary = (): OverallSummary => {
    if (!rawData) return { present: 0, late: 0, absent: 0, excused: 0, total: 0, rate: 0 }
    return reportService.generateOverallSummary(rawData)
  }

  const getFilteredMemberRows = (): MemberReportRow[] => {
    if (!rawData) return []
    let rows = reportService.generateMemberReport(rawData)

    // Apply search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      rows = rows.filter(r => r.name.toLowerCase().includes(q))
    }

    // Apply suspension status filter
    if (statusFilter !== 'all') {
      rows = rows.filter(r => r.warningStatus === statusFilter)
    }

    return rows
  }

  const getFilteredScheduleRows = (): ScheduleReportRow[] => {
    if (!rawData) return []
    const rows = reportService.generateScheduleReport(rawData)
    if (!searchQuery.trim()) return rows
    const query = searchQuery.toLowerCase().trim()
    return rows.filter(r => r.title.toLowerCase().includes(query))
  }

  const getMonthlyRows = (): MonthlyReportRow[] => {
    if (!rawData) return []
    return reportService.generateMonthlyReport(rawData, selectedYear)
  }

  const overallSummary = getOverallSummary()

  // Policy summary label
  const policyLabel = rawData?.policy
    ? (() => {
        const p = rawData.policy
        const cats = [p.includeSundays && 'Sun', p.includeWeekdays && 'Weekday', p.includeMeetings && 'Meeting'].filter(Boolean).join(', ')
        return `Warning @ ${p.warningAbsenceThreshold} | Suspension @ ${p.suspensionAbsenceThreshold} | ${cats || 'No categories'} | ${p.evaluationMonths === 0 ? 'All Time' : `${p.evaluationMonths}mo`}`
      })()
    : ''

  const handleViewBreakdown = (row: MemberReportRow) => {
    setSelectedMemberRow(row)
    setShowBreakdownModal(true)
  }

  const handleDownloadMemberPdf = () => {
    const filteredRows = getFilteredMemberRows()
    downloadMembersReportPdf(filteredRows, { start: startDate, end: endDate })
  }

  return (
    <div className="space-y-6">
      {/* Header page */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">Reports & Analytics</h1>
          <p className="text-sm text-gray-500 mt-1">Review attendance aggregates, server metrics, and analytics.</p>
        </div>

        {/* Header Action Buttons */}
        {activeTab === 'member' && (
          <button
            onClick={handleDownloadMemberPdf}
            className="rounded-lg border border-gray-200 bg-white hover:bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-700 hover:text-gray-900 transition-colors cursor-pointer shadow-sm flex items-center gap-1.5 self-start sm:self-auto"
          >
            <svg className="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Download PDF
          </button>
        )}
      </div>

      {/* Tabs list triggers */}
      <div className="flex border-b border-gray-200 space-x-1">
        {[
          { key: 'summary', label: 'Overall Summary' },
          { key: 'member', label: 'Member Reports' },
          { key: 'schedule', label: 'Schedule Reports' },
          { key: 'monthly', label: 'Monthly Analytics' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as TabType)}
            className={`pb-3 px-1 text-sm font-semibold tracking-wide border-b-2 transition-colors cursor-pointer ${
              activeTab === tab.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filter component */}
      <FilterBar
        activeTab={activeTab}
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        selectedYear={selectedYear}
        onYearChange={setSelectedYear}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
      />

      {/* Policy Summary Banner (visible on Member tab) */}
      {activeTab === 'member' && !loading && rawData?.policy && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 rounded-xl border border-amber-200 bg-amber-50/60">
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="text-xs font-semibold text-amber-800">Active Policy: {policyLabel}</span>
          </div>
          <span className="text-[11px] text-amber-600">Configured in Settings</span>
        </div>
      )}

      {/* Overall Summary cards (Persists on the top of report tables) */}
      {!loading && rawData && <SummaryCards summary={overallSummary} />}

      {/* Content layout tables */}
      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center space-y-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
            <span className="text-xs text-gray-500">Compiling report statistics...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            {activeTab === 'summary' && (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-6 py-3">Overall Performance Metric</th>
                    <th className="px-6 py-3 text-right">Aggregate Metric Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-gray-700 font-semibold">Attendance Service Rate</td>
                    <td className="px-6 py-4 text-right text-gray-900 font-bold">{overallSummary.rate}%</td>
                  </tr>
                  <tr className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-gray-600">Total Assigned Positions</td>
                    <td className="px-6 py-4 text-right text-gray-900 font-semibold">{overallSummary.total}</td>
                  </tr>
                  <tr className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-gray-600">Total Present Marks</td>
                    <td className="px-6 py-4 text-right text-green-600 font-semibold">{overallSummary.present}</td>
                  </tr>
                  <tr className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-gray-600">Total Late Marks</td>
                    <td className="px-6 py-4 text-right text-yellow-600 font-semibold">{overallSummary.late}</td>
                  </tr>
                  <tr className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-gray-600">Total Absent Marks</td>
                    <td className="px-6 py-4 text-right text-red-600 font-semibold">{overallSummary.absent}</td>
                  </tr>
                  <tr className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-gray-600">Total Excused Marks</td>
                    <td className="px-6 py-4 text-right text-gray-500 font-semibold">{overallSummary.excused}</td>
                  </tr>
                </tbody>
              </table>
            )}

            {activeTab === 'member' && (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Server Name</th>
                    <th className="px-4 py-3">Rank</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-center">Assigned</th>
                    <th className="px-4 py-3 text-center">Present</th>
                    <th className="px-4 py-3 text-center">Late</th>
                    <th className="px-4 py-3 text-center">Absent</th>
                    <th className="px-4 py-3 text-center">Excused</th>
                    <th className="px-4 py-3 text-right">Rate</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {getFilteredMemberRows().length > 0 ? (
                    getFilteredMemberRows().map((row) => (
                      <tr key={row.memberId} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-4 text-gray-900 font-semibold whitespace-nowrap">{row.name}</td>
                        <td className="px-4 py-4 text-gray-600 whitespace-nowrap">{row.rank}</td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                            row.status === 'active'
                              ? 'bg-green-50 border border-green-200 text-green-700'
                              : row.status === 'inactive'
                              ? 'bg-yellow-50 border border-yellow-200 text-yellow-700'
                              : 'bg-gray-100 border border-gray-200 text-gray-500'
                          }`}>
                            {row.status}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center text-gray-700 font-semibold">{row.totalAssigned}</td>
                        <td className="px-4 py-4 text-center text-green-600 font-semibold">{row.present}</td>
                        <td className="px-4 py-4 text-center text-yellow-600 font-semibold">{row.late}</td>
                        <td className="px-4 py-4 text-center text-red-600 font-semibold">{row.absent}</td>
                        <td className="px-4 py-4 text-center text-gray-500">{row.excused}</td>
                        <td className="px-4 py-4 text-right text-gray-900 font-bold">{row.rate}%</td>
                        {/* Warning / Suspension Badge */}
                        <td className="px-4 py-4 text-center whitespace-nowrap">
                          <div className="flex flex-col items-center gap-1">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              row.warningStatus === 'suspended'
                                ? 'bg-red-50 border-red-200 text-red-700'
                                : row.warningStatus === 'warning'
                                ? 'bg-amber-50 border-amber-200 text-amber-700'
                                : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                            }`}>
                              {row.warningStatus === 'suspended' && (
                                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                </svg>
                              )}
                              {row.warningStatus === 'warning' && (
                                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                              )}
                              {row.warningStatus === 'active' && (
                                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                              {row.warningStatus === 'suspended'
                                ? 'Suspended'
                                : row.warningStatus === 'warning'
                                ? 'Warning'
                                : 'Active'}
                            </span>
                            {/* Per-category breakdown */}
                            {(row.sundayAbsences > 0 || row.weekdayAbsences > 0 || row.meetingAbsences > 0) && (
                              <span className="text-[9px] text-gray-400 font-medium">
                                {[
                                  row.sundayAbsences > 0 && `S: ${row.sundayAbsences}`,
                                  row.weekdayAbsences > 0 && `W: ${row.weekdayAbsences}`,
                                  row.meetingAbsences > 0 && `M: ${row.meetingAbsences}`
                                ].filter(Boolean).join(' · ')}
                              </span>
                            )}
                          </div>
                        </td>
                        {/* View Breakdown Button */}
                        <td className="px-4 py-4 text-center whitespace-nowrap">
                          {row.missedSchedules.length > 0 ? (
                            <button
                              onClick={() => handleViewBreakdown(row)}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-md transition-colors cursor-pointer border border-blue-200"
                            >
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                              View
                            </button>
                          ) : (
                            <span className="text-[11px] text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={11} className="px-6 py-12 text-center text-sm text-gray-400">
                        No member records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {activeTab === 'schedule' && (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-6 py-3">Service Event Title</th>
                    <th className="px-6 py-3">Date</th>
                    <th className="px-6 py-3">Time Span</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3 text-center">Assigned</th>
                    <th className="px-6 py-3 text-center">Present</th>
                    <th className="px-6 py-3 text-center">Late</th>
                    <th className="px-6 py-3 text-center">Absent</th>
                    <th className="px-6 py-3 text-center">Excused</th>
                    <th className="px-6 py-3 text-right">Attendance Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {getFilteredScheduleRows().length > 0 ? (
                    getFilteredScheduleRows().map((row) => (
                      <tr key={row.scheduleId} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 text-gray-900 font-semibold whitespace-nowrap">{row.title}</td>
                        <td className="px-6 py-4 text-gray-600 whitespace-nowrap">{row.date}</td>
                        <td className="px-6 py-4 text-gray-500 whitespace-nowrap">{row.timeSpan}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                            row.status === 'cancelled'
                              ? 'bg-red-50 border border-red-200 text-red-700'
                              : 'bg-green-50 border border-green-200 text-green-700'
                          }`}>
                            {row.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center text-gray-700 font-semibold">{row.totalAssigned}</td>
                        <td className="px-6 py-4 text-center text-green-600 font-semibold">{row.present}</td>
                        <td className="px-6 py-4 text-center text-yellow-600 font-semibold">{row.late}</td>
                        <td className="px-6 py-4 text-center text-red-600 font-semibold">{row.absent}</td>
                        <td className="px-6 py-4 text-center text-gray-500">{row.excused}</td>
                        <td className="px-6 py-4 text-right text-gray-900 font-bold">{row.rate}%</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={10} className="px-6 py-12 text-center text-sm text-gray-400">
                        No schedule service records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {activeTab === 'monthly' && (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-6 py-3">Calendar Month</th>
                    <th className="px-6 py-3 text-center">Total Services</th>
                    <th className="px-6 py-3 text-center">Assigned Positions</th>
                    <th className="px-6 py-3 text-center">Present</th>
                    <th className="px-6 py-3 text-center">Late</th>
                    <th className="px-6 py-3 text-center">Absent</th>
                    <th className="px-6 py-3 text-center">Excused</th>
                    <th className="px-6 py-3 text-right">Avg Attendance Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {getMonthlyRows().map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-gray-900 font-semibold whitespace-nowrap">{row.month}</td>
                      <td className="px-6 py-4 text-center text-gray-700 font-semibold">{row.totalServices}</td>
                      <td className="px-6 py-4 text-center text-gray-600">{row.totalAssigned}</td>
                      <td className="px-6 py-4 text-center text-green-600 font-semibold">{row.present}</td>
                      <td className="px-6 py-4 text-center text-yellow-600 font-semibold">{row.late}</td>
                      <td className="px-6 py-4 text-center text-red-600 font-semibold">{row.absent}</td>
                      <td className="px-6 py-4 text-center text-gray-500">{row.excused}</td>
                      <td className="px-6 py-4 text-right text-gray-900 font-bold">
                        {row.totalAssigned > 0 ? `${row.rate}%` : '0%'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </Card>

      {/* Absence Breakdown Modal */}
      <AbsenceBreakdownModal
        isOpen={showBreakdownModal}
        onClose={() => {
          setShowBreakdownModal(false)
          setSelectedMemberRow(null)
        }}
        memberRow={selectedMemberRow}
        policy={rawData?.policy ?? null}
      />

      {/* Error Alert Modal */}
      <AlertModal
        isOpen={!!error}
        onClose={() => setError(null)}
        variant="error"
        title="Error"
        message={error ?? ''}
      />
    </div>
  )
}
