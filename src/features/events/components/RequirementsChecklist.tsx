import type { EventRequirement, RequirementMemberRow } from '@/types/eventRequirement'

export function RequirementIcon({ name, className = 'h-4 w-4' }: { name: 'check' | 'list' | 'members' | 'clock' | 'plus' | 'download' | 'refresh' | 'search' | 'settings'; className?: string }) {
  const paths = {
    check: 'M5 12l4 4L19 6',
    list: 'M9 5h11M9 12h11M9 19h11M3 5h.01M3 12h.01M3 19h.01',
    members: 'M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M16 3a4 4 0 010 8M22 21v-2a4 4 0 00-3-3.87M13 7a4 4 0 11-8 0 4 4 0 018 0',
    clock: 'M12 8v4l3 2M21 12a9 9 0 11-18 0 9 9 0 0118 0',
    plus: 'M12 5v14M5 12h14',
    download: 'M12 3v12m-4-4l4 4 4-4M5 17v4h14v-4',
    refresh: 'M20 7v5h-5M4 17v-5h5M6 6a8 8 0 0113 3M18 18a8 8 0 01-13-3',
    search: 'M21 21l-5-5M18 10a8 8 0 11-16 0 8 8 0 0116 0',
    settings: 'M4 7h16M4 17h16M8 4v6M16 14v6'
  }
  return <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d={paths[name]} /></svg>
}

function MemberProgress({ row }: { row: RequirementMemberRow }) {
  return <div className="min-w-32 space-y-2">
    <div className="flex items-center justify-between gap-3">
      <span className={`text-[11px] font-bold ${row.status === 'Complete' ? 'text-emerald-700' : row.status === 'Incomplete' ? 'text-amber-700' : 'text-slate-400'}`}>{row.status}</span>
      <span className="text-[10px] font-semibold tabular-nums text-slate-400">{row.completed}/{row.required}</span>
    </div>
    {row.required > 0 && <div role="progressbar" aria-label={`${row.name} completion`} aria-valuemin={0} aria-valuemax={row.required} aria-valuenow={row.completed} className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full transition-all ${row.status === 'Complete' ? 'bg-emerald-500' : 'bg-amber-400'}`} style={{ width: `${row.completed / row.required * 100}%` }} /></div>}
  </div>
}

function RequirementCheck({ row, requirement, disabled, onCheck }: { row: RequirementMemberRow; requirement: EventRequirement; disabled: boolean; onCheck: (requirementId: string, memberId: string, completed: boolean) => void }) {
  const status = row.cells[requirement.id]
  if (status === 'N/A') return <span className="inline-flex rounded-lg bg-slate-50 px-3 py-2 text-[11px] font-medium text-slate-400" title="Not applicable to this member's rank">N/A</span>
  return <label className={`relative inline-flex min-h-10 items-center gap-2.5 rounded-xl border px-3 py-2 text-[11px] font-bold transition-colors ${disabled ? 'cursor-default' : 'cursor-pointer hover:shadow-xs'} ${status === 'Done' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-500'}`}>
    <input type="checkbox" className="peer sr-only" aria-label={`${row.name}: ${requirement.title}`} checked={status === 'Done'} disabled={disabled} onChange={event => onCheck(requirement.id, row.memberId, event.target.checked)} />
    <span className={`flex h-4 w-4 items-center justify-center rounded-md border peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-500 peer-focus-visible:ring-offset-2 ${status === 'Done' ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300 bg-slate-50'}`}>{status === 'Done' && <RequirementIcon name="check" className="h-3 w-3" />}</span>
    <span>{status}</span>
  </label>
}

export function RequirementsChecklist({ rows, requirements, disabled, onCheck }: { rows: RequirementMemberRow[]; requirements: EventRequirement[]; disabled: boolean; onCheck: (requirementId: string, memberId: string, completed: boolean) => void }) {
  return <>
    <div className="hidden overflow-x-auto md:block">
      <table className="w-full border-separate border-spacing-0 text-left">
        <thead><tr className="text-[10px] font-black uppercase tracking-wider text-slate-400">
          <th scope="col" className="sticky left-0 z-20 min-w-60 border-b border-slate-200 bg-slate-50 px-5 py-4">Member</th>
          {requirements.map((requirement, index) => <th scope="col" key={requirement.id} className="min-w-40 max-w-56 border-b border-slate-200 bg-slate-50 px-4 py-4">
            <span className="mb-1 block text-indigo-400">{String(index + 1).padStart(2, '0')}</span>
            <span className="block normal-case text-xs font-bold tracking-normal text-slate-700 break-words" title={requirement.description || requirement.title}>{requirement.title}</span>
          </th>)}
          <th scope="col" className="min-w-44 border-b border-slate-200 bg-slate-50 px-5 py-4">Progress</th>
        </tr></thead>
        <tbody>{rows.map(row => <tr key={row.memberId} className="group">
          <th scope="row" className="sticky left-0 z-10 max-w-72 border-b border-slate-100 bg-white px-5 py-4 group-hover:bg-slate-50">
            <p className="text-xs font-bold text-slate-800 break-words">{row.name}</p><p className="mt-1 text-[10px] font-medium text-slate-400">{row.rank}</p>
          </th>
          {requirements.map(requirement => <td key={requirement.id} className="border-b border-slate-100 px-4 py-3 group-hover:bg-slate-50/60"><RequirementCheck row={row} requirement={requirement} disabled={disabled} onCheck={onCheck} /></td>)}
          <td className="border-b border-slate-100 px-5 py-4 group-hover:bg-slate-50/60"><MemberProgress row={row} /></td>
        </tr>)}</tbody>
      </table>
    </div>
    <div className="divide-y divide-slate-100 md:hidden">{rows.map(row => <article key={row.memberId} className="p-4 space-y-4">
      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h4 className="text-sm font-bold text-slate-800 break-words">{row.name}</h4><p className="mt-1 text-[11px] text-slate-400">{row.rank}</p></div><div className="w-32 shrink-0"><MemberProgress row={row} /></div></div>
      {!!requirements.length && <div className="space-y-2 rounded-xl bg-slate-50 p-3">{requirements.map(requirement => <div key={requirement.id} className="flex items-center justify-between gap-3"><p className="min-w-0 text-xs font-medium text-slate-600 break-words">{requirement.title}</p><div className="shrink-0"><RequirementCheck row={row} requirement={requirement} disabled={disabled} onCheck={onCheck} /></div></div>)}</div>}
    </article>)}</div>
  </>
}
