import React, { useState, useEffect } from 'react'
import type { SchedulePublication, SchedulePublicationInput } from '@/types/publication'
import type { ScheduleTemplate } from '@/types/schedule'
import { recurringService } from '@/services/recurringService'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSubmit: (input: SchedulePublicationInput, generateSchedules: boolean, selectedTemplateIds: string[]) => Promise<void>
  publication: SchedulePublication | null
}

export const PublicationFormModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSubmit,
  publication
}) => {
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [submissionDeadline, setSubmissionDeadline] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<'draft' | 'published' | 'archived'>('draft')
  const [maxSundaysPerServer, setMaxSundaysPerServer] = useState<number>(4)
  const [maxWeekdaysPerServer, setMaxWeekdaysPerServer] = useState<number>(8)
  const [maxServersPerSundaySlot, setMaxServersPerSundaySlot] = useState<number>(5)
  const [maxServersPerWeekdaySlot, setMaxServersPerWeekdaySlot] = useState<number>(5)
  const [includeSundays, setIncludeSundays] = useState<boolean>(true)
  const [includeWeekdays, setIncludeWeekdays] = useState<boolean>(true)
  const [includeHolyHour, setIncludeHolyHour] = useState<boolean>(false)
  const [includeMeetings, setIncludeMeetings] = useState<boolean>(false)
  const [customExcludedKeywords, setCustomExcludedKeywords] = useState<string>('')
  const [allowedRanks, setAllowedRanks] = useState<string[]>(['Chevaliers', 'Paladins'])
  const [generateSchedules, setGenerateSchedules] = useState<boolean>(true)
  const [templates, setTemplates] = useState<ScheduleTemplate[]>([])
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      if (publication) {
        setName(publication.name)
        setStartDate(publication.startDate)
        setEndDate(publication.endDate)
        setSubmissionDeadline(publication.submissionDeadline || '')
        setDescription(publication.description || '')
        setStatus(publication.status)
        setMaxSundaysPerServer(publication.maxSundaysPerServer ?? 4)
        setMaxWeekdaysPerServer(publication.maxWeekdaysPerServer ?? 8)
        setMaxServersPerSundaySlot(publication.maxServersPerSundaySlot ?? 5)
        setMaxServersPerWeekdaySlot(publication.maxServersPerWeekdaySlot ?? 5)
        setIncludeSundays(publication.includeSundays ?? true)
        setIncludeWeekdays(publication.includeWeekdays ?? true)
        setIncludeHolyHour(publication.includeHolyHour ?? false)
        setIncludeMeetings(publication.includeMeetings ?? false)
        setCustomExcludedKeywords((publication.customExcludedKeywords || []).join(', '))
        setAllowedRanks(publication.allowedRanks ?? ['Chevaliers', 'Paladins'])
        setGenerateSchedules(false) // Default to false when editing
      } else {
        setName('')
        setStartDate('')
        setEndDate('')
        setSubmissionDeadline('')
        setDescription('')
        setStatus('draft')
        setMaxSundaysPerServer(4)
        setMaxWeekdaysPerServer(8)
        setMaxServersPerSundaySlot(5)
        setMaxServersPerWeekdaySlot(5)
        setIncludeSundays(true)
        setIncludeWeekdays(true)
        setIncludeHolyHour(false)
        setIncludeMeetings(false)
        setCustomExcludedKeywords('')
        setAllowedRanks(['Chevaliers', 'Paladins'])
        setGenerateSchedules(true) // Default to true when creating
      }
      const loadTemplates = async () => {
        try {
          const fetched = await recurringService.getTemplates()
          const active = fetched.filter(t => t.active)
          setTemplates(active)
          setSelectedTemplateIds(active.map(t => t.id))
        } catch (err) {
          console.error('Failed to load templates', err)
        }
      }
      loadTemplates()

      setError('')
    }
  }, [isOpen, publication])

  const toggleTemplateSelection = (id: string) => {
    setSelectedTemplateIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    )
  }

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (startDate > endDate) {
      setError('Start date cannot be after end date.')
      return
    }
    setIsSubmitting(true)
    setError('')
    try {
      const excludedKwList = customExcludedKeywords
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0)

      await onSubmit({ 
        name, startDate, endDate, description, status,
        submissionDeadline: submissionDeadline || undefined,
        maxSundaysPerServer, maxWeekdaysPerServer,
        maxServersPerSundaySlot, maxServersPerWeekdaySlot,
        includeSundays, includeWeekdays,
        includeHolyHour, includeMeetings,
        customExcludedKeywords: excludedKwList,
        allowedRanks
      }, generateSchedules, selectedTemplateIds)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to save publication.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200/80 animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-extrabold text-sm shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100 inline-block mb-0.5">
                Publication Setup
              </span>
              <h2 className="text-base font-black text-slate-900 tracking-tight">
                {publication ? 'Edit Publication' : 'Create Publication'}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer focus:outline-none"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {error && (
            <div className="mb-6 p-3.5 bg-rose-50 text-rose-800 text-xs font-bold rounded-2xl border border-rose-200 animate-fade-in">
              {error}
            </div>
          )}

          <form id="pub-form" onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-extrabold uppercase text-gray-500 mb-1.5">
                Publication Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="e.g. September 2026 Schedule"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-extrabold uppercase text-gray-500 mb-1.5">
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-extrabold uppercase text-gray-500 mb-1.5">
                  End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-extrabold uppercase text-gray-500 mb-1.5">
                Submission Deadline (Optional)
              </label>
              <input
                type="datetime-local"
                value={submissionDeadline}
                onChange={(e) => setSubmissionDeadline(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-medium text-gray-800"
              />
              <span className="text-[10px] text-gray-400 font-medium block mt-1">
                Members who do not submit by this deadline can be automatically assigned via &quot;Auto-Assign Randomly&quot;.
              </span>
            </div>

            <div>
              <label className="block text-[10px] font-extrabold uppercase text-gray-500 mb-1.5">
                Publication Status & Link Access
              </label>
              <div className="relative">
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full h-10 pl-3.5 pr-10 text-xs font-semibold border border-slate-300 rounded-xl bg-white text-slate-800 appearance-none focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 shadow-2xs cursor-pointer transition"
                >
                  <option value="draft">Draft (Temporary Closed)</option>
                  <option value="published">Published (Open for Scheduling)</option>
                  <option value="archived">Archived (Totally Closed & Locked)</option>
                </select>
                <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Limit Rules Section */}
            <div className="space-y-4 pt-2 border-t border-gray-100">
              {/* Section 1: Server Selection Limits */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 space-y-3">
                <div>
                  <span className="block text-xs font-black text-slate-800">1. Individual Server Limits (per Person)</span>
                  <span className="text-[10px] text-slate-500 font-medium leading-tight block mt-0.5">
                    Maximum number of schedule slots each member is allowed to select per month.
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase text-slate-600 mb-1">
                      Max Sundays / Person
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={maxSundaysPerServer}
                      onChange={(e) => setMaxSundaysPerServer(parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-bold text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase text-slate-600 mb-1">
                      Max Weekdays / Person
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={maxWeekdaysPerServer}
                      onChange={(e) => setMaxWeekdaysPerServer(parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-bold text-slate-800"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Per Mass Slot Server Capacity */}
              <div className="bg-indigo-50/50 p-3.5 rounded-xl border border-indigo-100 space-y-3">
                <div>
                  <span className="block text-xs font-black text-indigo-950">2. Mass Capacity Limits (per Time Slot)</span>
                  <span className="text-[10px] text-indigo-700 font-medium leading-tight block mt-0.5">
                    Maximum number of altar servers allowed to serve in a single Mass time slot.
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase text-indigo-800 mb-1">
                      Max Servers / Sunday Mass
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={maxServersPerSundaySlot}
                      onChange={(e) => setMaxServersPerSundaySlot(parseInt(e.target.value) || 1)}
                      className="w-full px-3 py-1.5 rounded-lg border border-indigo-200 text-xs bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-bold text-indigo-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase text-indigo-800 mb-1">
                      Max Servers / Weekday Mass
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={maxServersPerWeekdaySlot}
                      onChange={(e) => setMaxServersPerWeekdaySlot(parseInt(e.target.value) || 1)}
                      className="w-full px-3 py-1.5 rounded-lg border border-indigo-200 text-xs bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-bold text-indigo-900"
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: Included Schedule Types & Filter Settings */}
              <div className="bg-amber-50/50 p-3.5 rounded-xl border border-amber-200/80 space-y-3">
                <div>
                  <span className="block text-xs font-black text-amber-950">3. Included Schedule Types & Filters</span>
                  <span className="text-[10px] text-amber-700 font-medium leading-tight block mt-0.5">
                    Configure which schedule categories are displayed in the public link and counted towards quotas.
                  </span>
                </div>

                <div className="space-y-2 pt-1">
                  <label className="flex items-start gap-2.5 p-2 rounded-lg bg-white border border-amber-200/60 hover:bg-amber-50/30 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={includeSundays}
                      onChange={(e) => setIncludeSundays(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-amber-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-800">Sunday & Anticipated Masses</span>
                      <span className="text-[10px] text-slate-500 leading-tight">
                        Saturday evening (5:00 PM onwards) and all Sunday Masses.
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 p-2 rounded-lg bg-white border border-amber-200/60 hover:bg-amber-50/30 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={includeWeekdays}
                      onChange={(e) => setIncludeWeekdays(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-amber-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-800">Weekday Masses</span>
                      <span className="text-[10px] text-slate-500 leading-tight">
                        Regular daily morning and afternoon Masses (Mon–Sat).
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 p-2 rounded-lg bg-white border border-amber-200/60 hover:bg-amber-50/30 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={includeHolyHour}
                      onChange={(e) => setIncludeHolyHour(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-amber-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-800">Holy Hour & Eucharistic Adoration</span>
                      <span className="text-[10px] text-slate-500 leading-tight">
                        Unchecked by default. Enable only if you want altar servers to select Holy Hour slots in this link.
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 p-2 rounded-lg bg-white border border-amber-200/60 hover:bg-amber-50/30 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={includeMeetings}
                      onChange={(e) => setIncludeMeetings(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-amber-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-800">Meetings & Formations</span>
                      <span className="text-[10px] text-slate-500 leading-tight">
                        Parish assemblies, practices, and rehearsals (Unchecked by default).
                      </span>
                    </div>
                  </label>
                </div>

                <div className="pt-2 border-t border-amber-100">
                  <label className="block text-[10px] font-extrabold uppercase text-amber-900 mb-1">
                    Custom Excluded Keywords (Optional)
                  </label>
                  <input
                    type="text"
                    value={customExcludedKeywords}
                    onChange={(e) => setCustomExcludedKeywords(e.target.value)}
                    placeholder="e.g. Novena, Vespers, Special Service"
                    className="w-full px-3 py-1.5 rounded-lg border border-amber-200 text-xs bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 font-medium text-slate-800 placeholder:text-slate-400"
                  />
                  <span className="text-[10px] text-amber-700 leading-tight block mt-1">
                    Comma-separated title keywords to exclude from this publication.
                  </span>
                </div>
              </div>

              {/* Section 4: Eligible Member Ranks */}
              <div className="bg-emerald-50/50 p-3.5 rounded-xl border border-emerald-200/80 space-y-3">
                <div>
                  <span className="block text-xs font-black text-emerald-950">4. Eligible Member Ranks (Allowed to Schedule)</span>
                  <span className="text-[10px] text-emerald-700 font-medium leading-tight block mt-0.5">
                    Select which server ranks can view and submit schedules in this publication. Squires are unchecked by default.
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                  {[
                    { id: 'Chevaliers', label: 'Chevaliers', desc: 'Senior Servers' },
                    { id: 'Paladins', label: 'Paladins', desc: 'Intermediate Servers' },
                    { id: 'Squires', label: 'Squires', desc: 'Junior / Trainees' }
                  ].map(rank => {
                    const isChecked = allowedRanks.includes(rank.id)
                    return (
                      <label key={rank.id} className="flex items-start gap-2 p-2 rounded-lg bg-white border border-emerald-200/60 hover:bg-emerald-50/30 cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              setAllowedRanks(allowedRanks.filter(r => r !== rank.id))
                            } else {
                              setAllowedRanks([...allowedRanks, rank.id])
                            }
                          }}
                          className="mt-0.5 h-4 w-4 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-slate-800">{rank.label}</span>
                          <span className="text-[10px] text-slate-500">{rank.desc}</span>
                        </div>
                      </label>
                    )
                  })}
                </div>
              </div>
            </div>

            {!publication && (
              <div className="space-y-3 p-4 border border-blue-100 bg-blue-50/30 rounded-xl">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={generateSchedules}
                    onChange={(e) => setGenerateSchedules(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-blue-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-blue-900">Generate Schedules from Templates</span>
                    <span className="text-[10px] text-blue-700 leading-relaxed mt-0.5">
                      Automatically create schedule slots between the Start and End dates using selected active Schedule Templates.
                    </span>
                  </div>
                </label>

                {generateSchedules && templates.length > 0 && (
                  <div className="ml-6 space-y-2">
                    <div className="text-[10px] font-bold text-gray-500 uppercase flex justify-between">
                      <span>Select Templates to Include</span>
                      <div className="space-x-2">
                        <button type="button" onClick={() => setSelectedTemplateIds(templates.map(t => t.id))} className="text-blue-600 hover:underline cursor-pointer">All</button>
                        <span>•</span>
                        <button type="button" onClick={() => setSelectedTemplateIds([])} className="text-gray-500 hover:underline cursor-pointer">None</button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                      {templates.map(t => (
                        <label key={t.id} className="flex items-center gap-2 p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 cursor-pointer text-xs">
                          <input
                            type="checkbox"
                            checked={selectedTemplateIds.includes(t.id)}
                            onChange={() => toggleTemplateSelection(t.id)}
                            className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                          <div className="flex flex-col">
                            <span className="font-semibold text-gray-800">{t.title}</span>
                            <span className="text-[10px] text-gray-500">{t.dayOfWeek} • {t.startTime}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="block text-[10px] font-extrabold uppercase text-gray-500 mb-1.5">
                Description (Optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Add details about this publication..."
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </form>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 bg-white flex justify-end gap-3 sticky bottom-0">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-700 transition-all cursor-pointer shadow-2xs"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="pub-form"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-5 py-2.5 text-xs font-black text-white transition-all disabled:opacity-50 cursor-pointer shadow-md shadow-indigo-500/20 active:scale-95"
          >
            {isSubmitting ? 'Saving...' : 'Save Publication'}
          </button>
        </div>
      </div>
    </div>
  )
}
