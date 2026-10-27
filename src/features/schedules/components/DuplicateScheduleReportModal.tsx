import { useState } from 'react'
import { Modal } from '@/components/Modal'
import { Button, DatePicker, Pagination } from '@/components'
import { scheduleService } from '@/services/scheduleService'
import { getParishTodayDate } from '@/utils/scheduleUtils'

type Report = Awaited<ReturnType<typeof scheduleService.getDuplicateReport>>

export function DuplicateScheduleReportModal({ onClose }: { onClose: () => void }) {
  const today = getParishTodayDate('Asia/Manila')
  const [startDate, setStartDate] = useState(`${today.slice(0, 7)}-01`)
  const [endDate, setEndDate] = useState(today)
  const [report, setReport] = useState<Report | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)

  const runReport = async (append = false) => {
    if (loading) return
    setLoading(true)
    setError('')
    if (!append) {
      setReport(null)
      setPage(1)
    }
    try {
      if (!navigator.onLine) throw new Error('Connect to the internet to review the latest schedules.')
      setReport(await scheduleService.getDuplicateReport(startDate, endDate, append && report ? report : undefined))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load the report. Try a narrower date range.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen onClose={onClose} title="Review Duplicate Schedules" maxWidth="3xl">
      <div className="p-5 sm:p-6 space-y-4 overflow-y-auto">
        <p className="text-sm text-slate-600">Read-only preview. Matching entries need review; they may belong to separate Mass contexts. This report never merges, deletes, or reassigns records. Attendance and submission references must be checked before any future cleanup.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div><label htmlFor="duplicate-start" className="text-xs font-bold text-slate-600">Start date</label><DatePicker id="duplicate-start" value={startDate} onChange={setStartDate} disabled={loading} /></div>
          <div><label htmlFor="duplicate-end" className="text-xs font-bold text-slate-600">End date</label><DatePicker id="duplicate-end" value={endDate} onChange={setEndDate} disabled={loading} /></div>
          <Button onClick={() => runReport()} disabled={loading}>{loading ? 'Reviewing…' : 'Run Preview'}</Button>
        </div>
        {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
        {report && <div aria-live="polite" className="space-y-3">
          <p className="text-xs font-semibold text-slate-600">{report.startDate} to {report.endDate}: {report.scannedCount} schedules reviewed; {report.groups.length} matching groups. No changes made.</p>
          {report.hasMore && <div className="space-y-2">
            <p className="text-xs text-slate-600">Preview is incomplete. Load the next page to check remaining schedules, including matches across pages.</p>
            <Button onClick={() => runReport(true)} disabled={loading || startDate !== report.startDate || endDate !== report.endDate}>Load Next 100 Schedules</Button>
          </div>}
          {report.truncated && <p role="status" className="text-sm text-amber-800">Review limit reached at 1,000 schedules. This preview is incomplete; narrow the dates and run a new preview.</p>}
          {report.groups.length === 0 && <p className="text-sm text-slate-600">{report.hasMore || report.truncated ? 'No matching groups found in the schedules reviewed so far.' : 'No matching groups found in this date range.'}</p>}
          {report.groups.slice((page - 1) * 8, page * 8).map(group => <div key={group.context} className="rounded-xl border border-slate-200 p-3 space-y-2">
            <p className="text-xs font-bold text-amber-800">{group.classification === 'same_publication' ? 'Possible duplicates within one publication' : 'Different or missing publication ownership — review required'}</p>
            {group.records.map(record => <div key={record.id} className="text-xs text-slate-700 break-words border-t border-slate-100 pt-2">
              <p className="font-bold">{record.date} {record.startTime}–{record.endTime} · {record.title}</p>
              <p>{record.location || 'No location'} · {record.assignedMemberCount} assigned · {record.status}{record.isLocked ? ' · Locked' : ''}</p>
              <p>Schedule: {record.id}</p><p>Publication: {record.publicationId || 'Legacy / untagged'}</p>
            </div>)}
          </div>)}
          {report.groups.length > 8 && <Pagination currentPage={page} totalPages={Math.ceil(report.groups.length / 8)} onPageChange={setPage} totalItems={report.groups.length} pageSize={8} />}
        </div>}
      </div>
    </Modal>
  )
}
