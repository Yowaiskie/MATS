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

  // Exports currently active report to BOM UTF-8 CSV
  const handleCSVExport = () => {
    let headers: string[] = []
    let csvRows: string[] = []
    let filename = 'report'

    if (activeTab === 'summary') {
      const summary = getOverallSummary()
      headers = ['Metric', 'Count / Rate']
      csvRows = [
        `"Attendance Rate",${summary.rate}%`,
        `"Total Assigned",${summary.total}`,
        `"Total Present",${summary.present}`,
        `"Total Late",${summary.late}`,
        `"Total Absent",${summary.absent}`,
        `"Total Excused",${summary.excused}`
      ]
      filename = `overall_attendance_summary`
    } else if (activeTab === 'member') {
      const rows = getFilteredMemberRows()
      headers = ['Name', 'Rank', 'Status', 'Assigned', 'Present', 'Late', 'Absent', 'Excused', 'Rate']
      rows.forEach((r) => {
        csvRows.push([
          `"${r.name.replace(/"/g, '""')}"`,
          `"${r.rank}"`,
          r.status,
          r.totalAssigned,
          r.present,
          r.late,
          r.absent,
          r.excused,
          `${r.rate}%`
        ].join(','))
      })
      filename = `member_attendance_report`
    } else if (activeTab === 'schedule') {
      const rows = getFilteredScheduleRows()
      headers = ['Service Title', 'Date', 'Time Span', 'Status', 'Assigned', 'Present', 'Late', 'Absent', 'Excused', 'Rate']
      rows.forEach((r) => {
        csvRows.push([
          `"${r.title.replace(/"/g, '""')}"`,
          r.date,
          `"${r.timeSpan}"`,
          r.status,
          r.totalAssigned,
          r.present,
          r.late,
          r.absent,
          r.excused,
          `${r.rate}%`
        ].join(','))
      })
      filename = `schedule_attendance_report`
    } else if (activeTab === 'monthly') {
      const rows = getMonthlyRows()
      headers = ['Month', 'Services Count', 'Assigned', 'Present', 'Late', 'Absent', 'Excused', 'Rate']
      rows.forEach((r) => {
        csvRows.push([
          `"${r.month}"`,
          r.totalServices,
          r.totalAssigned,
          r.present,
          r.late,
          r.absent,
          r.excused,
          `${r.rate}%`
        ].join(','))
      })
      filename = `monthly_attendance_report_${selectedYear}`
    }

    const csvContent = '\uFEFF' + [headers.join(','), ...csvRows].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `${filename}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handlePNGExport = () => {
    if (!rawData) return

    const summary = getOverallSummary()
    
    // Count schedules that are completed
    const servicesCount = rawData.schedules.length

    // Create dynamic canvas element
    const canvas = document.createElement('canvas')
    canvas.width = 800
    canvas.height = 500
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // 1. Draw premium background gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, 500)
    gradient.addColorStop(0, '#0f172a') // slate-900
    gradient.addColorStop(1, '#020617') // slate-955
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 800, 500)

    // Accent indigo top line
    const accentGrad = ctx.createLinearGradient(0, 0, 800, 0)
    accentGrad.addColorStop(0, '#6366f1') // indigo-500
    accentGrad.addColorStop(1, '#a855f7') // purple-500
    ctx.fillStyle = accentGrad
    ctx.fillRect(0, 0, 800, 6)

    // 2. Draw Branded Title
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 24px Inter, system-ui, sans-serif'
    ctx.fillText('Ministry of Altar Servers', 40, 55)

    // Subtitle
    ctx.fillStyle = '#94a3b8' // slate-400
    ctx.font = '600 13px Inter, system-ui, sans-serif'
    const periodText = startDate || endDate 
      ? `Covered Week: ${startDate || 'Start'} to ${endDate || 'Present'}`
      : 'Weekly Attendance Report Summary'
    ctx.fillText(periodText, 40, 85)

    // Divider Line
    ctx.strokeStyle = '#334155' // slate-700
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(40, 110)
    ctx.lineTo(760, 110)
    ctx.stroke()

    // 3. Draw Featured Left Card (Overall Attendance Rate)
    ctx.fillStyle = '#0b0f19'
    ctx.strokeStyle = '#4338ca' // indigo-700
    ctx.lineWidth = 2

    const drawRoundedRect = (x: number, y: number, w: number, h: number, r: number) => {
      ctx.beginPath()
      ctx.moveTo(x + r, y)
      ctx.lineTo(x + w - r, y)
      ctx.quadraticCurveTo(x + w, y, x + w, y + r)
      ctx.lineTo(x + w, y + h - r)
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
      ctx.lineTo(x + r, y + h)
      ctx.quadraticCurveTo(x, y + h, x, y + h - r)
      ctx.lineTo(x, y + r)
      ctx.quadraticCurveTo(x, y, x + r, y)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
    }

    drawRoundedRect(40, 140, 320, 290, 8)

    // Text inside Left Card
    ctx.textAlign = 'center'
    ctx.fillStyle = '#818cf8' // indigo-400
    ctx.font = 'bold 11px Inter, system-ui, sans-serif'
    ctx.fillText('OVERALL ATTENDANCE RATE', 200, 185)

    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 64px Inter, system-ui, sans-serif'
    ctx.fillText(`${summary.rate}%`, 200, 280)

    ctx.fillStyle = '#64748b' // slate-500
    ctx.font = '500 12px Inter, system-ui, sans-serif'
    ctx.fillText(`${summary.total} assigned server positions`, 200, 340)

    // 4. Draw Right Summary Table
    ctx.fillStyle = '#070a13'
    ctx.strokeStyle = '#1e293b'
    ctx.lineWidth = 1.5
    drawRoundedRect(390, 140, 370, 290, 8)

    // Table Header Fill
    ctx.fillStyle = '#0f172a'
    ctx.beginPath()
    ctx.moveTo(391, 148)
    ctx.lineTo(759, 148)
    ctx.lineTo(759, 175)
    ctx.lineTo(391, 175)
    ctx.closePath()
    ctx.fill()

    // Header text
    ctx.fillStyle = '#94a3b8' // slate-400
    ctx.font = 'bold 11px Inter, system-ui, sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText('ATTENDANCE METRIC', 410, 162)
    ctx.textAlign = 'right'
    ctx.fillText('COUNT', 740, 162)

    // Divider under header
    ctx.strokeStyle = '#1e293b'
    ctx.beginPath()
    ctx.moveTo(390, 175)
    ctx.lineTo(760, 175)
    ctx.stroke()

    // Draw rows
    const rows = [
      { label: 'Total Services', val: String(servicesCount), color: '#ffffff' },
      { label: 'Total Assigned Slots', val: String(summary.total), color: '#ffffff' },
      { label: 'Present Marks', val: String(summary.present), color: '#10b981' }, // green-500
      { label: 'Late Marks', val: String(summary.late), color: '#eab308' }, // yellow-500
      { label: 'Absent Marks', val: String(summary.absent), color: '#f43f5e' }, // rose-500
      { label: 'Excused Marks', val: String(summary.excused), color: '#94a3b8' } // slate-400
    ]

    rows.forEach((row, i) => {
      const rowY = 175 + i * 42.5
      
      // Draw alternating row background
      if (i % 2 === 1) {
        ctx.fillStyle = '#0b0f19'
        ctx.fillRect(391, rowY + 1, 368, 41.5)
      }

      // Draw bottom border for row (except last)
      if (i < 5) {
        ctx.strokeStyle = '#1e293b'
        ctx.beginPath()
        ctx.moveTo(390, rowY + 42.5)
        ctx.lineTo(760, rowY + 42.5)
        ctx.stroke()
      }

      // Render text
      ctx.textAlign = 'left'
      ctx.fillStyle = '#cbd5e1' // slate-300
      ctx.font = '500 12px Inter, system-ui, sans-serif'
      ctx.fillText(row.label, 410, rowY + 26)

      ctx.textAlign = 'right'
      ctx.fillStyle = row.color
      ctx.font = 'bold 13px Inter, system-ui, sans-serif'
      ctx.fillText(row.val, 740, rowY + 26)
    })

    // 5. Draw Footer
    ctx.fillStyle = '#475569' // slate-600
    ctx.font = '500 11px Inter, system-ui, sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText('Generated automatically by Altar Server Attendance Tracking (MATS)', 40, 470)

    // Trigger PNG Download
    const dataUrl = canvas.toDataURL('image/png')
    const dlLink = document.createElement('a')
    dlLink.setAttribute('href', dataUrl)
    dlLink.setAttribute('download', `mats_weekly_report_${startDate || 'start'}_to_${endDate || 'end'}.png`)
    document.body.appendChild(dlLink)
    dlLink.click()
    document.body.removeChild(dlLink)
  }

  const overallSummary = getOverallSummary()

  return (
    <div className="space-y-6">
      {/* Header page */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Reports & Analytics</h1>
          <p className="text-sm text-gray-400 mt-1">Review attendance aggregates, server metrics, and download CSV sheets.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
          {activeTab === 'summary' && (
            <button
              onClick={handlePNGExport}
              disabled={loading || !rawData}
              className="rounded border border-gray-800 bg-gray-950 hover:bg-gray-900 px-4 py-2 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors disabled:opacity-50 w-full sm:w-auto"
            >
              Download Weekly Report (PNG)
            </button>
          )}
          <button
            onClick={handleCSVExport}
            disabled={loading || !rawData}
            className="rounded bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-xs font-semibold text-white transition-colors disabled:opacity-50 w-full sm:w-auto"
          >
            Export Active Report (CSV)
          </button>
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
