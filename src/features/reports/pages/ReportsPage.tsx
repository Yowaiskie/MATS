import React, { useState, useEffect } from 'react'
import { reportService } from '@/services/reportService'
import type { ReportRawData, OverallSummary, MemberReportRow, ScheduleReportRow, MonthlyReportRow } from '@/services/reportService'
import { Card } from '@/components/Card'
import { FilterBar } from '../components/FilterBar'
import { SummaryCards } from '../components/SummaryCards'

type TabType = 'summary' | 'member' | 'schedule' | 'monthly'

export const ReportsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('summary')

  // Date and filter states
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [searchQuery, setSearchQuery] = useState('')

  // Report raw data
  const [rawData, setRawData] = useState<ReportRawData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
  }, [activeTab])

  // Computed views based on rawData
  const getOverallSummary = (): OverallSummary => {
    if (!rawData) return { present: 0, late: 0, absent: 0, excused: 0, total: 0, rate: 0 }
    return reportService.generateOverallSummary(rawData)
  }

  const getFilteredMemberRows = (): MemberReportRow[] => {
    if (!rawData) return []
    const rows = reportService.generateMemberReport(rawData)
    if (!searchQuery.trim()) return rows
    const query = searchQuery.toLowerCase().trim()
    return rows.filter(r => r.name.toLowerCase().includes(query))
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

  return (
    <div className="space-y-6">
      {/* Header page */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Reports & Analytics</h1>
          <p className="text-sm text-gray-400 mt-1">Review attendance aggregates, server metrics, and analytics.</p>
        </div>
      </div>

      {/* Tabs list triggers */}
      <div className="flex border-b border-gray-800 space-x-4">
        {[
          { key: 'summary', label: 'Overall Summary' },
          { key: 'member', label: 'Member Reports' },
          { key: 'schedule', label: 'Schedule Reports' },
          { key: 'monthly', label: 'Monthly Analytics' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as TabType)}
            className={`pb-3 text-sm font-semibold tracking-wide border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-gray-400 hover:text-gray-200'
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
      />

      {/* Error notify */}
      {error && (
        <div className="rounded border border-red-900 bg-red-950/40 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Overall Summary cards (Persists on the top of report tables) */}
      {!loading && rawData && <SummaryCards summary={overallSummary} />}

      {/* Content layout tables */}
      <Card>
        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center space-y-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
            <span className="text-xs text-gray-500">Compiling report statistics...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            {activeTab === 'summary' && (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-gray-950 border-b border-gray-800 text-gray-400 uppercase tracking-wider text-xxs">
                  <tr>
                    <th className="p-4">Overall Performance Metric</th>
                    <th className="p-4 text-right">Aggregate Metric Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-900 bg-gray-950/20">
                  <tr className="hover:bg-gray-900/10">
                    <td className="p-4 text-gray-300 font-semibold">Attendance Service Rate</td>
                    <td className="p-4 text-right text-white font-bold">{overallSummary.rate}%</td>
                  </tr>
                  <tr className="hover:bg-gray-900/10">
                    <td className="p-4 text-gray-300">Total Assigned Positions</td>
                    <td className="p-4 text-right text-white font-semibold">{overallSummary.total}</td>
                  </tr>
                  <tr className="hover:bg-gray-900/10">
                    <td className="p-4 text-gray-350">Total Present Marks</td>
                    <td className="p-4 text-right text-green-400 font-semibold">{overallSummary.present}</td>
                  </tr>
                  <tr className="hover:bg-gray-900/10">
                    <td className="p-4 text-gray-350">Total Late Marks</td>
                    <td className="p-4 text-right text-yellow-450 font-semibold">{overallSummary.late}</td>
                  </tr>
                  <tr className="hover:bg-gray-900/10">
                    <td className="p-4 text-gray-350">Total Absent Marks</td>
                    <td className="p-4 text-right text-red-400 font-semibold">{overallSummary.absent}</td>
                  </tr>
                  <tr className="hover:bg-gray-900/10">
                    <td className="p-4 text-gray-350">Total Excused Marks</td>
                    <td className="p-4 text-right text-gray-400 font-semibold">{overallSummary.excused}</td>
                  </tr>
                </tbody>
              </table>
            )}

            {activeTab === 'member' && (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-gray-950 border-b border-gray-800 text-gray-400 uppercase tracking-wider text-xxs">
                  <tr>
                    <th className="p-4">Server Name</th>
                    <th className="p-4">Rank</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-center">Assigned</th>
                    <th className="p-4 text-center">Present</th>
                    <th className="p-4 text-center">Late</th>
                    <th className="p-4 text-center">Absent</th>
                    <th className="p-4 text-center">Excused</th>
                    <th className="p-4 text-right">Attendance Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-900 bg-gray-950/20">
                  {getFilteredMemberRows().length > 0 ? (
                    getFilteredMemberRows().map((row) => (
                      <tr key={row.memberId} className="hover:bg-gray-900/10 transition-colors">
                        <td className="p-4 text-white font-semibold whitespace-nowrap">{row.name}</td>
                        <td className="p-4 text-gray-300 whitespace-nowrap">{row.rank}</td>
                        <td className="p-4 whitespace-nowrap">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-xxs font-bold capitalize border ${
                            row.status === 'active'
                              ? 'bg-green-500/10 border-green-500/20 text-green-500'
                              : row.status === 'inactive'
                              ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-500'
                              : 'bg-gray-500/10 border-gray-500/20 text-gray-500'
                          }`}>
                            {row.status}
                          </span>
                        </td>
                        <td className="p-4 text-center text-gray-300 font-semibold">{row.totalAssigned}</td>
                        <td className="p-4 text-center text-green-400 font-semibold">{row.present}</td>
                        <td className="p-4 text-center text-yellow-450 font-semibold">{row.late}</td>
                        <td className="p-4 text-center text-red-400 font-semibold">{row.absent}</td>
                        <td className="p-4 text-center text-gray-400">{row.excused}</td>
                        <td className="p-4 text-right text-white font-bold">{row.rate}%</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-sm text-gray-500">
                        No member records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {activeTab === 'schedule' && (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-gray-950 border-b border-gray-800 text-gray-400 uppercase tracking-wider text-xxs">
                  <tr>
                    <th className="p-4">Service Event Title</th>
                    <th className="p-4">Date</th>
                    <th className="p-4">Time Span</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-center">Assigned</th>
                    <th className="p-4 text-center">Present</th>
                    <th className="p-4 text-center">Late</th>
                    <th className="p-4 text-center">Absent</th>
                    <th className="p-4 text-center">Excused</th>
                    <th className="p-4 text-right">Attendance Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-900 bg-gray-950/20">
                  {getFilteredScheduleRows().length > 0 ? (
                    getFilteredScheduleRows().map((row) => (
                      <tr key={row.scheduleId} className="hover:bg-gray-900/10 transition-colors">
                        <td className="p-4 text-white font-semibold whitespace-nowrap">{row.title}</td>
                        <td className="p-4 text-gray-300 whitespace-nowrap">{row.date}</td>
                        <td className="p-4 text-gray-400 whitespace-nowrap">{row.timeSpan}</td>
                        <td className="p-4 whitespace-nowrap">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-xxs font-bold capitalize border ${
                            row.status === 'cancelled'
                              ? 'bg-red-500/10 border-red-500/20 text-red-500'
                              : 'bg-green-500/10 border-green-500/20 text-green-500'
                          }`}>
                            {row.status}
                          </span>
                        </td>
                        <td className="p-4 text-center text-gray-300 font-semibold">{row.totalAssigned}</td>
                        <td className="p-4 text-center text-green-400 font-semibold">{row.present}</td>
                        <td className="p-4 text-center text-yellow-450 font-semibold">{row.late}</td>
                        <td className="p-4 text-center text-red-400 font-semibold">{row.absent}</td>
                        <td className="p-4 text-center text-gray-400">{row.excused}</td>
                        <td className="p-4 text-right text-white font-bold">{row.rate}%</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-sm text-gray-500">
                        No schedule service records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {activeTab === 'monthly' && (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-gray-950 border-b border-gray-800 text-gray-400 uppercase tracking-wider text-xxs">
                  <tr>
                    <th className="p-4">Calendar Month</th>
                    <th className="p-4 text-center">Total Services</th>
                    <th className="p-4 text-center">Assigned Positions</th>
                    <th className="p-4 text-center">Present</th>
                    <th className="p-4 text-center">Late</th>
                    <th className="p-4 text-center">Absent</th>
                    <th className="p-4 text-center">Excused</th>
                    <th className="p-4 text-right">Avg Attendance Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-900 bg-gray-950/20">
                  {getMonthlyRows().map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-900/10 transition-colors">
                      <td className="p-4 text-white font-semibold whitespace-nowrap">{row.month}</td>
                      <td className="p-4 text-center text-gray-300 font-semibold">{row.totalServices}</td>
                      <td className="p-4 text-center text-gray-300">{row.totalAssigned}</td>
                      <td className="p-4 text-center text-green-400 font-semibold">{row.present}</td>
                      <td className="p-4 text-center text-yellow-450 font-semibold">{row.late}</td>
                      <td className="p-4 text-center text-red-400 font-semibold">{row.absent}</td>
                      <td className="p-4 text-center text-gray-400">{row.excused}</td>
                      <td className="p-4 text-right text-white font-bold">
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
    </div>
  )
}
