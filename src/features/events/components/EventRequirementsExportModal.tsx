import { useState } from 'react'
import { Button, CustomSelect, Modal, useToast } from '@/components'
import { FormInput } from '@/components/FormInput'
import { DynamicSignatureConfig } from '@/components/signatures/DynamicSignatureConfig'
import { DEFAULT_SIGNATURE_PRESETS, type SignatureConfig } from '@/types/signature'
import type { EventRequirement, RequirementMemberRow } from '@/types/eventRequirement'
import { downloadEventRequirementsPdf } from '@/utils/eventRequirementsPdfReport'
import { RequirementIcon } from './RequirementsChecklist'

interface Props {
  eventName: string
  allRows: RequirementMemberRow[]
  filteredRows: RequirementMemberRow[]
  requirements: EventRequirement[]
  filterDescription: string
  onClose: () => void
}

export function EventRequirementsExportModal({ eventName, allRows, filteredRows, requirements, filterDescription, onClose }: Props) {
  const { toast } = useToast()
  const [scope, setScope] = useState('filtered')
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('landscape')
  const [title, setTitle] = useState(`EVENT REQUIREMENTS REPORT: ${eventName.toUpperCase()}`)
  const [signatureConfig, setSignatureConfig] = useState<SignatureConfig>({ enabled: true, signatories: DEFAULT_SIGNATURE_PRESETS[0].signatories.map(s => ({ ...s })) })
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const rows = scope === 'all' ? allRows : filteredRows

  async function download() {
    setGenerating(true)
    setError('')
    try {
      await downloadEventRequirementsPdf({ eventName, rows, requirements, filterDescription: scope === 'all' ? 'All tracker members' : filterDescription }, { documentTitle: title.trim() || `EVENT REQUIREMENTS REPORT: ${eventName}`, signatureConfig, orientation })
      toast.success('PDF Export Ready', 'Requirements report downloaded.')
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate PDF.')
    } finally {
      setGenerating(false)
    }
  }

  return <Modal isOpen onClose={() => { if (!generating) onClose() }} title="Export Requirements Report" subtitle={eventName} badge="PDF Export" icon={<RequirementIcon name="download" className="h-5 w-5" />} maxWidth="2xl">
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200/80 bg-slate-50 p-4 space-y-4">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200/80 pb-3"><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-wider text-indigo-500">Report overview</p><h4 className="mt-1 text-xs font-bold text-slate-800 break-words">{eventName}</h4></div><span className="shrink-0 rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700">{rows.length} members</span></div>
        <CustomSelect id="requirements-export-scope" label="Members to export" value={scope} onChange={(e: { target: { value: string } }) => setScope(e.target.value)} disabled={generating} options={[{ value: 'filtered', label: `Current filtered list (${filteredRows.length} members)` }, { value: 'all', label: `All tracker members (${allRows.length} members)` }]} />
        <fieldset className="space-y-2"><legend className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Page orientation</legend><div className="grid grid-cols-2 gap-2">{(['landscape', 'portrait'] as const).map(value => <label key={value} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors ${orientation === value ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-500'} ${generating ? 'opacity-60' : ''}`}><input type="radio" name="requirements-pdf-orientation" value={value} checked={orientation === value} onChange={() => setOrientation(value)} disabled={generating} className="accent-indigo-600" /><span><span className="block text-xs font-bold capitalize">{value}</span><span className="mt-0.5 block text-[10px]">{value === 'landscape' ? 'Wide checklist layout' : 'Standard page layout'}</span></span></label>)}</div></fieldset>
        <label className="block space-y-2"><span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Report title</span><FormInput maxLength={250} value={title} onChange={e => setTitle(e.target.value)} disabled={generating} className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500/25" /></label>
        <p className="text-[11px] leading-relaxed text-slate-500">Includes all matching pages, requirement statuses, and member progress. Wide checklists split into readable column groups.</p>
      </div>
      <DynamicSignatureConfig value={signatureConfig} onChange={setSignatureConfig} defaultPresetName="General" />
      {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4"><Button variant="outline" onClick={onClose} disabled={generating}>Cancel</Button><Button onClick={download} loading={generating} disabled={generating || !rows.length}>Generate & Download PDF</Button></div>
    </div>
  </Modal>
}
