import { useEffect, useState } from 'react'
import { FirebaseError } from 'firebase/app'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ActionMenu, Button, CustomSelect, EmptyState, Modal, Pagination, Loading, useToast } from '@/components'
import { ConfirmModal, PasswordConfirmModal } from '@/components/Dialog'
import { FormInput } from '@/components/FormInput'
import { ValidatedForm, FormTextarea } from '@/components/ValidatedForm'
import { useAuth } from '@/features/authentication/AuthContext'
import { usePWA } from '@/context/PWAContext'
import { memberService } from '@/services/memberService'
import { authService } from '@/services/authService'
import { eventRequirementService } from '@/services/eventRequirementService'
import { MEMBER_RANKS, type MemberRank } from '@/types/member'
import type { EventRequirement, RequirementInput } from '@/types/eventRequirement'
import { buildRequirementRows } from '@/utils/eventRequirements'
import { EventRequirementsExportModal } from './EventRequirementsExportModal'
import { RequirementIcon, RequirementsChecklist } from './RequirementsChecklist'

const FIELD_CLASS = 'w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-medium text-slate-800 outline-none transition focus:bg-white focus:ring-2 focus:ring-indigo-500/25'
const EMPTY_INPUT: RequirementInput = { title: '', description: '', targetRanks: [] }

function RankPicker({ value, onChange, disabled = false }: { value: MemberRank[]; onChange: (ranks: MemberRank[]) => void; disabled?: boolean }) {
  return <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">{MEMBER_RANKS.map(rank => (
    <label key={rank} className={`inline-flex items-center justify-between gap-3 rounded-xl border px-3.5 py-3 text-xs font-bold transition-colors ${disabled ? 'cursor-default opacity-60' : 'cursor-pointer'} ${value.includes(rank) ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-200'}`}>
      <span>{rank}</span>
      <input type="checkbox" checked={value.includes(rank)} disabled={disabled} onChange={e => onChange(e.target.checked ? [...value, rank] : value.filter(r => r !== rank))} className="h-4 w-4 rounded accent-indigo-600" />
    </label>
  ))}</div>
}

export function EventRequirementsTab({ eventId, eventName, isHeadOrCreator }: { eventId: string; eventName: string; isHeadOrCreator: boolean }) {
  const { profile, canAction } = useAuth()
  const { isOffline } = usePWA()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const canManage = canAction('canManageEvents') || isHeadOrCreator
  const actorUid = profile?.uid ?? ''
  const actorName = profile?.email || profile?.displayName || 'User'
  const trackerKey = ['event-requirements', eventId]
  const membersKey = ['members', 'requirements-read-only']
  const tracker = useQuery({
    queryKey: trackerKey,
    queryFn: () => eventRequirementService.getTracker(eventId),
    retry: (failureCount, error) => !(error instanceof FirebaseError && ['permission-denied', 'unauthenticated'].includes(error.code)) && failureCount < 2
  })
  const members = useQuery({ queryKey: membersKey, queryFn: () => memberService.getMembers(false, { readOnly: true }) })
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [draftRanks, setDraftRanks] = useState<MemberRank[]>([])
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<EventRequirement | null>(null)
  const [draft, setDraft] = useState<RequirementInput>(EMPTY_INPUT)
  const [archiveTarget, setArchiveTarget] = useState<EventRequirement | null>(null)
  const [resetOpen, setResetOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [rankFilter, setRankFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    if (tracker.error) console.error('Failed to load event requirements:', tracker.error)
    if (members.error) console.error('Failed to load requirements member roster:', members.error)
  }, [tracker.error, members.error])

  const mutation = useMutation({
    mutationFn: async (operation: () => Promise<void>) => {
      if (!canManage || !actorUid) throw new Error('You cannot edit event requirements.')
      if (isOffline || !navigator.onLine) throw new Error('Connect to the internet to save changes.')
      await operation()
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: trackerKey })
      toast.success('Saved', 'Requirements tracker updated.')
    },
    onError: (error: Error) => toast.error('Save Failed', error.message)
  })
  const busy = mutation.isPending
  const readOnly = !canManage || isOffline || busy
  const requirements = tracker.data?.requirements ?? []
  const ranks = tracker.data?.settings?.selectedRanks ?? []
  const rows = buildRequirementRows(members.data ?? [], ranks, requirements, tracker.data?.checks ?? [])
  const filtered = rows.filter(row => row.name.toLowerCase().includes(search.trim().toLowerCase()) && (rankFilter === 'all' || row.rank === rankFilter) && (statusFilter === 'all' || row.status === statusFilter))
  const currentPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / 20)))
  const visibleRows = filtered.slice((currentPage - 1) * 20, currentPage * 20)
  const completeCount = rows.filter(row => row.status === 'Complete').length
  const incompleteCount = rows.filter(row => row.status === 'Incomplete').length
  const notApplicableCount = rows.length - completeCount - incompleteCount
  const completionPercent = completeCount + incompleteCount ? Math.round(completeCount / (completeCount + incompleteCount) * 100) : 0
  const refreshing = tracker.isFetching || members.isFetching
  const hasTrackerData = !!tracker.data?.settings || !!requirements.length || !!tracker.data?.checks.length
  const hasFilters = !!search.trim() || rankFilter !== 'all' || statusFilter !== 'all'
  const filterDescription = `Name: ${search.trim() || 'All'}; Rank: ${rankFilter === 'all' ? 'All' : rankFilter}; Status: ${statusFilter === 'all' ? 'All' : statusFilter}`

  async function saveForm(operation: () => Promise<void>, close: () => void) {
    setFormError('')
    try {
      await mutation.mutateAsync(operation)
      close()
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not save changes.')
    }
  }

  function openEditor(requirement: EventRequirement | null) {
    setEditing(requirement)
    setDraft(requirement ? { title: requirement.title, description: requirement.description, targetRanks: [...requirement.targetRanks] } : { ...EMPTY_INPUT, targetRanks: [] })
    setFormError('')
    setEditorOpen(true)
  }

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: trackerKey }),
      queryClient.invalidateQueries({ queryKey: membersKey })
    ])
  }

  function openSettings() {
    setDraftRanks([...ranks])
    setFormError('')
    setSettingsOpen(true)
  }

  function clearFilters() {
    setSearch('')
    setRankFilter('all')
    setStatusFilter('all')
    setPage(1)
  }

  async function resetTracker(password: string) {
    try {
      await mutation.mutateAsync(async () => {
        await authService.verifyPassword(password)
        await eventRequirementService.resetTracker(eventId, actorName)
      })
      setResetOpen(false)
      setSearch('')
      setRankFilter('all')
      setStatusFilter('all')
      setPage(1)
    } catch (error) {
      await queryClient.invalidateQueries({ queryKey: trackerKey })
      throw error
    }
  }

  if ((tracker.isPending || members.isPending) && isOffline) return <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">You are offline. Connect to load this event's requirements.</div>
  if (tracker.isPending || members.isPending) return <div className="p-8"><Loading /></div>
  if (tracker.isError || members.isError) {
    const error = tracker.error ?? members.error
    const code = error instanceof FirebaseError ? error.code : ''
    const message = code === 'permission-denied'
      ? 'Requirements access was denied. Ask an administrator to check access for this event.'
      : code === 'unauthenticated'
        ? 'Your session has expired. Sign in again to load requirements.'
        : 'Could not load requirements. Check your connection and try again.'
    return <div role="alert" className="rounded-2xl border border-rose-200 bg-white p-6 space-y-3">
      <p className="text-rose-700">{message}</p>
      <Button onClick={refresh} disabled={tracker.isFetching || members.isFetching || isOffline}>Retry</Button>
    </div>
  }

  return <div className="space-y-5">
    {isOffline && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">You are offline. Showing loaded data; connect to save changes.</p>}
    <div className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-indigo-100 bg-indigo-50 text-indigo-600"><RequirementIcon name="list" className="h-5 w-5" /></div>
          <div><h2 className="text-base font-black tracking-tight text-slate-900">Requirements Tracker</h2><p className="mt-0.5 text-xs text-slate-500">Check submissions and see who still has requirements to complete.</p></div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span aria-live="polite" className="w-full text-[10px] font-semibold text-slate-400 xl:w-auto xl:mr-1">{busy ? 'Saving changes...' : refreshing ? 'Refreshing...' : !canManage ? 'View only' : 'Changes save automatically'}</span>
          <Button variant="ghost" size="dense" onClick={refresh} disabled={refreshing || busy || isOffline} title="Refresh tracker" aria-label="Refresh tracker" icon={<RequirementIcon name="refresh" className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />} />
          <Button variant="secondary" size="dense" onClick={() => setExportOpen(true)} disabled={!rows.length || refreshing || busy} icon={<RequirementIcon name="download" />}>Export PDF</Button>
          {canManage && <Button size="dense" disabled={readOnly || !ranks.length} onClick={() => openEditor(null)} icon={<RequirementIcon name="plus" />}>Add Requirement</Button>}
        </div>
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-slate-100 bg-slate-50/60 px-5 py-3 rounded-b-2xl">
        <div className="flex flex-wrap items-center gap-2"><span className="mr-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Tracking ranks</span>{ranks.length ? ranks.map(rank => <span key={rank} className="rounded-lg border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-[10px] font-bold text-indigo-600">{rank}</span>) : <span className="text-xs text-slate-400">Not configured</span>}</div>
        {canManage && <Button variant="ghost" size="xs" disabled={readOnly} onClick={openSettings} icon={<RequirementIcon name="settings" />}>{ranks.length ? 'Change Ranks' : 'Select Ranks'}</Button>}
      </div>
    </div>

    {!!ranks.length && <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4"><div className="flex items-center justify-between"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Members</p><span className="rounded-lg bg-slate-100 p-2 text-slate-500"><RequirementIcon name="members" /></span></div><p className="text-2xl font-black tabular-nums text-slate-900">{rows.length}</p><p className="mt-1 text-[10px] text-slate-400">Across {ranks.length} selected {ranks.length === 1 ? 'rank' : 'ranks'}</p></div>
      <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/40 p-4"><div className="flex items-center justify-between"><p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Complete</p><span className="rounded-lg bg-emerald-100/80 p-2 text-emerald-600"><RequirementIcon name="check" /></span></div><p className="text-2xl font-black tabular-nums text-emerald-800">{completeCount}</p><p className="mt-1 text-[10px] text-emerald-600">All applicable requirements done</p></div>
      <div className="rounded-2xl border border-amber-200/70 bg-amber-50/40 p-4"><div className="flex items-center justify-between"><p className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Incomplete</p><span className="rounded-lg bg-amber-100/80 p-2 text-amber-600"><RequirementIcon name="clock" /></span></div><p className="text-2xl font-black tabular-nums text-amber-800">{incompleteCount}</p><p className="mt-1 text-[10px] text-amber-600">Still have pending requirements</p></div>
      <div className="rounded-2xl border border-indigo-200/70 bg-indigo-50/40 p-4"><div className="flex items-center justify-between"><p className="text-[10px] font-bold uppercase tracking-wider text-indigo-500">Completion</p><span className="text-[10px] font-bold text-indigo-500">{requirements.length} items</span></div><p className="mt-2 text-2xl font-black tabular-nums text-indigo-800">{completionPercent}%</p><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-indigo-100"><div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${completionPercent}%` }} /></div></div>
    </div>}

    {!ranks.length ? <EmptyState title="Set up your requirements tracker" description={canManage ? 'Choose member ranks first, then add the requirements you want to track for this event.' : 'The event manager has not set up requirements yet.'} icon={<RequirementIcon name="list" className="h-8 w-8" />} action={canManage && !readOnly ? { label: 'Select Member Ranks', onClick: openSettings } : undefined} /> : <>
      <section className="space-y-3">
        <div className="flex items-center justify-between"><h3 className="text-xs font-bold text-slate-700">Requirement List <span className="ml-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">{requirements.length}</span></h3><p className="text-[10px] text-slate-400">Default: all selected ranks</p></div>
        {!requirements.length ? <EmptyState title="Add your first requirement" description="Create items such as consent forms or uniforms. Members appear below while you set up the checklist." action={canManage && !readOnly ? { label: 'Add Requirement', onClick: () => openEditor(null) } : undefined} className="py-6 sm:py-6" /> : <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">{requirements.map((requirement, index) => {
          const done = rows.filter(row => row.cells[requirement.id] === 'Done').length
          const applicable = rows.filter(row => row.cells[requirement.id] !== 'N/A').length
          return <article key={requirement.id} className="rounded-2xl border border-slate-200/80 bg-white p-4">
            <div className="flex items-start gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-[11px] font-black text-indigo-500">{String(index + 1).padStart(2, '0')}</span><div className="min-w-0 flex-1"><h4 className="text-xs font-bold text-slate-800 break-words">{requirement.title}</h4><p className="mt-1 text-[10px] text-slate-400">{requirement.targetRanks.length ? requirement.targetRanks.join(', ') : 'All selected ranks'}</p></div>{canManage && <ActionMenu ariaLabel={`Actions for ${requirement.title}`} disabled={readOnly} size="xs" items={[{ label: 'Edit requirement', onClick: () => openEditor(requirement) }, { label: 'Archive requirement', variant: 'danger', onClick: () => setArchiveTarget(requirement) }]} />}</div>
            {requirement.description && <p className="mt-3 text-[11px] leading-relaxed text-slate-500 break-words whitespace-pre-wrap">{requirement.description}</p>}
            <div className="mt-3 flex items-center gap-3"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${applicable ? done / applicable * 100 : 0}%` }} /></div><span className="text-[10px] font-semibold tabular-nums text-slate-400">{done}/{applicable} done</span></div>
          </article>
        })}</div>}
      </section>

      <section className="rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
        <div className="space-y-4 border-b border-slate-100 p-4 sm:p-5">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3"><div><h3 className="text-sm font-bold text-slate-800">Member Checklist</h3><p className="mt-0.5 text-[11px] text-slate-400">{canManage ? 'Tick a requirement when it is done.' : 'View each member’s requirement status.'} N/A means it does not apply.</p></div><div className="flex flex-wrap gap-1 rounded-xl bg-slate-100/80 p-1">{[{ value: 'all', label: 'All', count: rows.length }, { value: 'Incomplete', label: 'Incomplete', count: incompleteCount }, { value: 'Complete', label: 'Complete', count: completeCount }, { value: 'N/A', label: 'N/A', count: notApplicableCount }].map(option => <button key={option.value} type="button" aria-pressed={statusFilter === option.value} onClick={() => { setStatusFilter(option.value); setPage(1) }} className={`rounded-lg px-2.5 py-2 text-[10px] font-bold transition-colors ${statusFilter === option.value ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}>{option.label}<span className="ml-1.5 opacity-60 tabular-nums">{option.count}</span></button>)}</div></div>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><RequirementIcon name="search" /></span><FormInput aria-label="Search members" placeholder="Search member name..." value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} className={`${FIELD_CLASS} pl-10`} /></div>
            <CustomSelect id="requirements-rank-filter" label="" value={rankFilter} onChange={(e: { target: { value: string } }) => { setRankFilter(e.target.value); setPage(1) }} options={[{ value: 'all', label: 'All ranks' }, ...MEMBER_RANKS.map(rank => ({ value: rank, label: rank }))]} containerClassName="sm:w-48" />
            {hasFilters && <Button variant="ghost" size="dense" onClick={clearFilters}>Clear filters</Button>}
          </div>
        </div>
        {filtered.length ? <RequirementsChecklist rows={visibleRows} requirements={requirements} disabled={readOnly || refreshing} onCheck={(requirementId, memberId, completed) => mutation.mutate(() => eventRequirementService.setCompleted(eventId, requirementId, memberId, completed, actorUid, actorName))} /> : <div className="p-4"><EmptyState title={rows.length ? 'No matching members' : 'No members in these ranks'} description={rows.length ? 'Try a different name, rank, or completion filter.' : 'Members will appear here when their ranks match your selection.'} action={hasFilters ? { label: 'Clear Filters', onClick: clearFilters } : undefined} className="border-0" /></div>}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-t border-slate-100 px-4 py-3"><p className="text-[10px] font-medium text-slate-400">{filtered.length ? `${(currentPage - 1) * 20 + 1}–${Math.min(currentPage * 20, filtered.length)} of ${filtered.length} members` : '0 members'}{hasFilters ? ' · Filtered list' : ''}</p><Pagination currentPage={currentPage} totalItems={filtered.length} pageSize={20} onPageChange={setPage} /></div>
      </section>
    </>}

    {canManage && hasTrackerData && <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-rose-100 bg-rose-50/30 px-4 py-3"><div><p className="text-xs font-bold text-slate-700">Start over for this event</p><p className="mt-0.5 text-[10px] text-slate-500">Delete all requirements, saved checks, and the member list in this tracker.</p></div><Button variant="secondary" size="dense" className="border-rose-200 text-rose-600 hover:bg-rose-50 shrink-0" disabled={readOnly} onClick={() => setResetOpen(true)}>Reset Requirements</Button></div>}

    <Modal isOpen={settingsOpen} onClose={() => { if (!busy) setSettingsOpen(false) }} title="Select Tracker Ranks" subtitle="Choose the members to include in this event’s checklist." badge="Tracker Setup" icon={<RequirementIcon name="members" className="h-5 w-5" />}>
      <ValidatedForm className="space-y-4" onSubmit={e => { e.preventDefault(); void saveForm(() => eventRequirementService.saveSettings(eventId, draftRanks, actorUid, actorName), () => setSettingsOpen(false)) }}>
        <RankPicker value={draftRanks} onChange={setDraftRanks} disabled={readOnly} />
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3"><p className="text-xs font-bold text-indigo-700">{draftRanks.length} {draftRanks.length === 1 ? 'rank' : 'ranks'} selected</p><p className="mt-1 text-[11px] leading-relaxed text-indigo-600">Includes active, inactive, and suspended members. Saved checks stay when you change ranks.</p></div>
        {formError && <p role="alert" className="text-sm text-rose-700">{formError}</p>}
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><Button variant="secondary" type="button" onClick={() => setSettingsOpen(false)} disabled={busy}>Cancel</Button><Button type="submit" disabled={readOnly || !draftRanks.length} loading={busy}>Save Ranks</Button></div>
      </ValidatedForm>
    </Modal>
    <Modal isOpen={editorOpen} onClose={() => { if (!busy) setEditorOpen(false) }} title={editing ? 'Edit Requirement' : 'Add Requirement'} subtitle="Define what members need to complete for this event." badge="Checklist Item" icon={<RequirementIcon name="list" className="h-5 w-5" />}>
      <ValidatedForm className="space-y-4" onSubmit={e => { e.preventDefault(); void saveForm(() => eventRequirementService.saveRequirement(eventId, draft, actorUid, actorName, editing?.id), () => setEditorOpen(false)) }}>
        <label className="block space-y-2"><span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Requirement title</span><FormInput required maxLength={150} placeholder="e.g. Signed consent form" value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} className={FIELD_CLASS} disabled={readOnly} /></label>
        <label className="block space-y-2"><span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Description <span className="normal-case font-medium tracking-normal text-slate-400">(optional)</span></span><FormTextarea rows={3} maxLength={2000} placeholder="Add instructions or details for this requirement..." value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} className={`${FIELD_CLASS} resize-y`} disabled={readOnly} /></label>
        <fieldset className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4"><legend className="px-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Target ranks <span className="normal-case font-medium tracking-normal">(optional)</span></legend><p className="text-[11px] leading-relaxed text-slate-500">Applies to all selected tracker ranks by default. Choose ranks below only when this item is specific to them.</p><RankPicker value={draft.targetRanks} onChange={targetRanks => setDraft({ ...draft, targetRanks })} disabled={readOnly} /><p className="text-[10px] font-semibold text-indigo-600">{draft.targetRanks.length ? `Applies to: ${draft.targetRanks.join(', ')}` : 'Applies to all selected tracker ranks'}</p></fieldset>
        {formError && <p role="alert" className="text-sm text-rose-700">{formError}</p>}
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><Button variant="secondary" type="button" onClick={() => setEditorOpen(false)} disabled={busy}>Cancel</Button><Button type="submit" disabled={readOnly || !draft.title.trim()} loading={busy}>Save Requirement</Button></div>
      </ValidatedForm>
    </Modal>
    <ConfirmModal isOpen={!!archiveTarget} onClose={() => { if (!busy) setArchiveTarget(null) }} title="Archive Requirement" message={`Remove "${archiveTarget?.title}" from the active checklist? Saved checks will be retained.`} loading={busy} onConfirm={() => { if (archiveTarget) mutation.mutate(() => eventRequirementService.archiveRequirement(eventId, archiveTarget.id, actorName), { onSuccess: () => setArchiveTarget(null) }) }} />
    <PasswordConfirmModal isOpen={resetOpen} onClose={() => { if (!busy) setResetOpen(false) }} onConfirm={resetTracker} title="Reset All Requirements" confirmLabel="Delete All Requirements" message={`Permanently delete all requirements (including archived items), Done/Pending checks, and selected ranks for "${eventName}"? Member names will disappear from this tab. Records in the main Members module will remain. This cannot be undone. Enter your password to confirm.`} />
    {exportOpen && <EventRequirementsExportModal eventName={eventName} allRows={rows} filteredRows={filtered} requirements={requirements} filterDescription={filterDescription} onClose={() => setExportOpen(false)} />}
  </div>
}
