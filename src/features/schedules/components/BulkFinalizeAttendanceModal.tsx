import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Loading, Modal } from '@/components'
import { ConfirmModal } from '@/components/Dialog'
import { bulkAttendanceService, type BulkAttendanceItem } from '@/services/bulkAttendanceService'
import { usePWA } from '@/context/PWAContext'

export function BulkFinalizeAttendanceModal({ scheduleIds, onClose, onCompleted }: { scheduleIds?: string[]; onClose: () => void; onCompleted: () => Promise<void> }) {
  const { isOffline } = usePWA()
  const [items, setItems] = useState<BulkAttendanceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [progress, setProgress] = useState(0)
  const [total, setTotal] = useState(0)
  const [finished, setFinished] = useState(false)
  const [error, setError] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  useEffect(() => {
    let active = true
    const preview = scheduleIds ? bulkAttendanceService.preview(scheduleIds) : bulkAttendanceService.previewUnfinalized()
    preview.then(result => { if (active) setItems(result) }).catch(err => { if (active) setError(err instanceof Error ? err.message : 'Could not load preview.') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [scheduleIds])
  const selectable = items.filter(item => item.eligible && item.result !== 'finalized')
  const candidates = selectable.filter(item => selectedIds.has(item.scheduleId))
  const allSelected = selectable.length > 0 && candidates.length === selectable.length
  function toggleSelection(id: string) {
    setSelectedIds(previous => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  async function finalize() {
    setConfirm(false)
    setRunning(true)
    setProgress(0)
    setTotal(candidates.length)
    setError('')
    let completed = 0
    try {
      for (const item of candidates) {
        let result: BulkAttendanceItem
        if (!navigator.onLine) result = { ...item, result: 'failed', reason: 'Connection lost. Reconnect and retry.' }
        else {
          try { result = await bulkAttendanceService.finalize(item.scheduleId) }
          catch (err) { result = { ...item, result: 'failed', reason: err instanceof Error ? err.message : 'Could not finalize attendance.' } }
        }
        // Retry failures only; skipped sessions need attendance review and a fresh preview.
        result.eligible = result.result === 'failed'
        setItems(previous => previous.map(row => row.scheduleId === item.scheduleId ? result : row))
        setProgress(++completed)
      }
      setFinished(true)
      await onCompleted()
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not refresh schedules.') }
    finally { setRunning(false) }
  }
  return <>
    <Modal isOpen onClose={() => { if (!running) onClose() }} title="Bulk Finalize Attendance" subtitle="Past schedules with attendance that is not finalized yet." badge="Attendance" maxWidth="3xl">
      <div className="space-y-4">
        {loading ? <Loading label="Checking attendance sessions..." /> : <>
          <div className="flex flex-wrap gap-2 text-xs"><span className="rounded-xl bg-emerald-50 px-3 py-2 font-bold text-emerald-700">{finished ? items.filter(i => i.result === 'finalized').length : selectable.length} {finished ? 'finalized' : 'ready'}</span><span className="rounded-xl bg-amber-50 px-3 py-2 font-bold text-amber-700">{items.filter(i => !i.eligible && i.result !== 'finalized' || i.result === 'skipped').length} {finished ? 'skipped' : 'need review'}</span><span className="rounded-xl bg-rose-50 px-3 py-2 font-bold text-rose-700">{items.filter(i => i.result === 'failed').length} failed</span></div>
          {selectable.length > 0 && <div className="flex flex-wrap items-center justify-between gap-2"><Button variant="secondary" size="dense" disabled={running} onClick={() => setSelectedIds(allSelected ? new Set() : new Set(selectable.map(item => item.scheduleId)))}>{allSelected ? 'Deselect All' : 'Select All'}</Button><span aria-live="polite" className="text-xs font-bold text-slate-600">{candidates.length} / {selectable.length} selected</span></div>}
          {running && <p aria-live="polite" className="text-xs text-indigo-600">Processing {progress}/{total} selected sessions…</p>}
          {isOffline && <p className="text-xs text-amber-700">Connect to the internet before finalizing.</p>}
          {items.length === 0 && !error ? <p className="rounded-2xl bg-slate-50 p-6 text-center text-sm text-slate-500">No unfinalized attendance for past schedules.</p> : <div className="overflow-x-auto rounded-2xl border border-slate-200"><table className="w-full text-left text-xs"><thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-400"><tr><th className="w-10 p-3">Select</th><th className="p-3">Schedule</th><th className="p-3">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{items.map(item => <tr key={item.scheduleId} className={selectedIds.has(item.scheduleId) && item.eligible ? 'bg-indigo-50/50' : ''}><td className="p-3"><input type="checkbox" aria-label={`Select ${item.title} (${item.date})`} checked={item.eligible && selectedIds.has(item.scheduleId)} disabled={running || !item.eligible} onChange={() => toggleSelection(item.scheduleId)} className="h-4 w-4 accent-indigo-600 disabled:opacity-40" /></td><td className="p-3"><Link to={`/attendance?scheduleId=${encodeURIComponent(item.scheduleId)}`} onClick={event => { if (running) event.preventDefault() }} className="font-bold text-indigo-600 hover:underline">{item.title}</Link><p className="mt-1 text-slate-400">{item.date}</p></td><td className="p-3 text-slate-600">{item.reason}</td></tr>)}</tbody></table></div>}
          <p className="text-[11px] text-slate-500">Blank attendance is never filled automatically. Unlocking finalized sessions still requires password verification.</p>
        </>}
        {error && <p role="alert" className="text-xs text-rose-700">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><Button variant="secondary" disabled={running} onClick={onClose}>Close</Button>{(!finished || selectable.length > 0) && <Button disabled={loading || running || isOffline || !candidates.length} onClick={() => setConfirm(true)}>{finished && candidates.length > 0 && candidates.every(item => item.result === 'failed') ? 'Retry Remaining' : `Finalize ${candidates.length} Sessions`}</Button>}</div>
      </div>
    </Modal>
    <ConfirmModal isOpen={confirm} onClose={() => setConfirm(false)} onConfirm={() => { void finalize() }} title="Finalize & Lock Attendance" message={`Finalize ${candidates.length} complete attendance sessions? Each session will be rechecked. Records cannot be edited afterward unless unlocked with your account password.`} confirmLabel="Finalize & Lock" />
  </>
}
