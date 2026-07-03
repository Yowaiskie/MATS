import React, { useState, useEffect } from 'react'
import type { Member } from '@/types/member'
import type { ScheduleTemplate, ScheduleTemplateInput } from '@/types/schedule'
import { recurringService } from '@/services/recurringService'
import { getFullName } from '@/utils/member'

interface TemplateManagerModalProps {
  isOpen: boolean
  onClose: () => void
  activeMembers: Member[]
  allMembers: Member[]
  onGenerateSuccess: () => Promise<void>
}

export const TemplateManagerModal: React.FC<TemplateManagerModalProps> = ({
  isOpen,
  onClose,
  activeMembers,
  allMembers,
  onGenerateSuccess,
}) => {
  const [templates, setTemplates] = useState<ScheduleTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Sub-navigation mode: 'list' | 'create' | 'edit' | 'generate' | 'report'
  const [mode, setMode] = useState<'list' | 'create' | 'edit' | 'generate' | 'report'>('list')
  const [editingTemplate, setEditingTemplate] = useState<ScheduleTemplate | null>(null)

  // Template Form State
  const [name, setName] = useState('')
  const [title, setTitle] = useState('')
  const [dayOfWeek, setDayOfWeek] = useState('Sunday')
  const [startTime, setStartTime] = useState('08:00')
  const [endTime, setEndTime] = useState('09:00')
  const [defaultAssigned, setDefaultAssigned] = useState<string[]>([])
  const [active, setActive] = useState(true)

  // Schedule Generator State
  const [genStartDate, setGenStartDate] = useState('')
  const [genEndDate, setGenEndDate] = useState('')
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([])
  const [generationReport, setGenerationReport] = useState<any | null>(null)

  useEffect(() => {
    if (isOpen) {
      loadTemplates()
    }
  }, [isOpen])

  const loadTemplates = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await recurringService.getTemplates()
      setTemplates(data)
    } catch (err: any) {
      console.error(err)
      setError('Failed to load schedule templates.')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  // CRUD actions
  const handleOpenCreate = () => {
    setName('')
    setTitle('')
    setDayOfWeek('Sunday')
    setStartTime('08:00')
    setEndTime('09:00')
    setDefaultAssigned([])
    setActive(true)
    setEditingTemplate(null)
    setMode('create')
  }

  const handleOpenEdit = (t: ScheduleTemplate) => {
    setName(t.name)
    setTitle(t.title)
    setDayOfWeek(t.dayOfWeek)
    setStartTime(t.startTime)
    setEndTime(t.endTime)
    setDefaultAssigned(t.assignedMembers || [])
    setActive(t.active)
    setEditingTemplate(t)
    setMode('edit')
  }

  const handleOpenGenerate = () => {
    setGenStartDate('')
    setGenEndDate('')
    // Pre-select active templates
    setSelectedTemplateIds(templates.filter(t => t.active).map(t => t.id))
    setMode('generate')
  }

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !title.trim()) {
      setError('Please fill in Template Name and Schedule Title.')
      return
    }

    if (startTime >= endTime) {
      setError('Start Time must be before End Time.')
      return
    }

    setLoading(true)
    setError(null)
    try {
      const input: ScheduleTemplateInput = {
        name: name.trim(),
        title: title.trim(),
        dayOfWeek,
        startTime,
        endTime,
        assignedMembers: defaultAssigned,
        active
      }

      if (mode === 'edit' && editingTemplate) {
        await recurringService.updateTemplate(editingTemplate.id, input)
        setSuccessMsg('Template successfully updated!')
      } else {
        await recurringService.addTemplate(input)
        setSuccessMsg('Template successfully created!')
      }
      await loadTemplates()
      setMode('list')
    } catch (err: any) {
      console.error(err)
      setError('Failed to save schedule template.')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteTemplate = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this template?')) return
    setLoading(true)
    setError(null)
    try {
      await recurringService.deleteTemplate(id)
      setSuccessMsg('Template deleted.')
      await loadTemplates()
    } catch (err: any) {
      console.error(err)
      setError('Failed to delete template.')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleActive = async (t: ScheduleTemplate) => {
    try {
      await recurringService.updateTemplate(t.id, { active: !t.active })
      await loadTemplates()
    } catch (err: any) {
      console.error(err)
      setError('Failed to toggle active status.')
    }
  }

  const handleRunGenerator = async () => {
    if (!genStartDate || !genEndDate) {
      setError('Please select both Start Date and End Date.')
      return
    }

    if (genStartDate > genEndDate) {
      setError('Start Date must be before or equal to End Date.')
      return
    }

    if (selectedTemplateIds.length === 0) {
      setError('Please select at least one template to generate schedules from.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const selectedTemplates = templates.filter(t => selectedTemplateIds.includes(t.id))
      const report = await recurringService.generateSchedules(
        genStartDate,
        genEndDate,
        selectedTemplates,
        allMembers
      )

      setGenerationReport(report)
      await onGenerateSuccess()
      setMode('report')
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Schedule generation failed.')
    } finally {
      setLoading(false)
    }
  }

  const toggleTemplateSelection = (id: string) => {
    setSelectedTemplateIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const handleClose = () => {
    setMode('list')
    setEditingTemplate(null)
    setGenerationReport(null)
    setError(null)
    setSuccessMsg(null)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 transition-opacity" onClick={handleClose} />

      {/* Modal Card */}
      <div className="relative w-full max-w-2xl rounded-lg border border-gray-800 bg-gray-950 p-6 shadow-xl z-10 text-white flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-900">
          <div>
            <h3 className="text-base font-bold text-white">Schedule Templates Manager</h3>
            <p className="text-xs text-gray-400 mt-0.5">Manage recurring schedule templates and bulk-generate schedules.</p>
          </div>
          <button onClick={handleClose} className="text-gray-400 hover:text-white transition-colors cursor-pointer">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="mt-4 flex-1 space-y-4 overflow-y-auto">
          {error && (
            <div className="rounded border border-red-900 bg-red-950/40 p-4 text-xs text-red-400">
              {error}
            </div>
          )}

          {successMsg && (
            <div className="rounded border border-green-900 bg-green-950/40 p-4 text-xs text-green-400">
              {successMsg}
            </div>
          )}

          {/* List mode */}
          {mode === 'list' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleOpenGenerate}
                  disabled={templates.length === 0}
                  className="rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-3.5 py-1.5 text-xs font-bold text-white transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  ⚙ Generate Schedules
                </button>
                <button
                  type="button"
                  onClick={handleOpenCreate}
                  className="rounded border border-gray-800 bg-gray-900 hover:bg-gray-850 px-3.5 py-1.5 text-xs font-semibold text-gray-300 hover:text-white transition-colors cursor-pointer"
                >
                  + Add Template
                </button>
              </div>

              {loading ? (
                <div className="py-12 flex flex-col items-center justify-center space-y-2">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent"></div>
                  <span className="text-xxs text-gray-500">Loading templates...</span>
                </div>
              ) : templates.length === 0 ? (
                <div className="py-12 text-center border border-gray-900 rounded bg-gray-950/20 text-gray-500 text-xs">
                  No recurring templates defined. Click "+ Add Template" to create one.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {templates.map((t) => (
                    <div key={t.id} className="p-4 rounded-lg border border-gray-900 bg-gray-900/30 flex flex-col justify-between space-y-3">
                      <div>
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-sm text-white truncate max-w-[180px]">{t.name}</h4>
                          <button
                            onClick={() => handleToggleActive(t)}
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                              t.active 
                                ? 'bg-green-500/10 border border-green-500/20 text-green-400' 
                                : 'bg-gray-800 border border-gray-800 text-gray-400'
                            }`}
                          >
                            {t.active ? 'Active' : 'Inactive'}
                          </button>
                        </div>
                        <p className="text-xxs text-gray-400 mt-1 leading-tight">
                          ⛪ Title: <span className="text-gray-300">{t.title}</span>
                        </p>
                        <p className="text-xxs text-gray-400 mt-0.5 leading-none">
                          📅 {t.dayOfWeek} | 🕒 {t.startTime} - {t.endTime}
                        </p>
                        <p className="text-[10px] text-indigo-400 font-semibold mt-2 leading-none">
                          👥 {t.assignedMembers?.length || 0} default servers assigned
                        </p>
                      </div>

                      <div className="flex items-center space-x-2 pt-2 border-t border-gray-900/50">
                        <button
                          onClick={() => handleOpenEdit(t)}
                          className="text-xs text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteTemplate(t.id)}
                          className="text-xs text-red-400 hover:text-red-300 font-medium cursor-pointer"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Form Mode (Create/Edit) */}
          {(mode === 'create' || mode === 'edit') && (
            <form onSubmit={handleSaveTemplate} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Template Name */}
                <div className="flex flex-col space-y-1">
                  <label className="text-xxs font-bold uppercase tracking-wider text-gray-400">Template Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="block w-full rounded border border-gray-850 bg-gray-950 px-3 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500"
                    placeholder="e.g. Sunday 6AM Mass"
                  />
                </div>

                {/* Schedule Title */}
                <div className="flex flex-col space-y-1">
                  <label className="text-xxs font-bold uppercase tracking-wider text-gray-400">Schedule Title</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="block w-full rounded border border-gray-850 bg-gray-950 px-3 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500"
                    placeholder="e.g. Sunday Mass"
                  />
                </div>

                {/* Day of Week */}
                <div className="flex flex-col space-y-1">
                  <label className="text-xxs font-bold uppercase tracking-wider text-gray-400">Day of Week</label>
                  <select
                    value={dayOfWeek}
                    onChange={(e) => setDayOfWeek(e.target.value)}
                    className="block w-full rounded border border-gray-850 bg-gray-950 px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                {/* Active Toggle */}
                <div className="flex items-center space-x-2 pt-5">
                  <input
                    type="checkbox"
                    id="template-active"
                    checked={active}
                    onChange={(e) => setActive(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-850 bg-gray-950 text-indigo-600 focus:ring-indigo-500"
                  />
                  <label htmlFor="template-active" className="text-xs font-bold text-gray-300 cursor-pointer">
                    Enable Template (Active)
                  </label>
                </div>

                {/* Start Time */}
                <div className="flex flex-col space-y-1">
                  <label className="text-xxs font-bold uppercase tracking-wider text-gray-400">Start Time</label>
                  <input
                    type="time"
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="block w-full rounded border border-gray-850 bg-gray-950 px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* End Time */}
                <div className="flex flex-col space-y-1">
                  <label className="text-xxs font-bold uppercase tracking-wider text-gray-400">End Time</label>
                  <input
                    type="time"
                    required
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="block w-full rounded border border-gray-850 bg-gray-950 px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Default Assigned Members Checklist */}
              <div className="border-t border-gray-900 pt-3">
                <label className="text-xxs font-bold uppercase tracking-wider text-gray-400">Default Assigned Altar Servers</label>
                <div className="mt-2 max-h-36 overflow-y-auto border border-gray-900 rounded p-2 bg-gray-950/50 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {activeMembers.length === 0 ? (
                    <span className="text-xxs text-gray-500 italic p-1">No active members found.</span>
                  ) : (
                    activeMembers.map((m) => {
                      const isAssigned = defaultAssigned.includes(m.id)
                      return (
                        <label key={m.id} className="flex items-center space-x-2 text-xs p-1 hover:bg-gray-900/35 rounded cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={isAssigned}
                            onChange={() => {
                              setDefaultAssigned(prev => 
                                isAssigned 
                                  ? prev.filter(id => id !== m.id)
                                  : [...prev, m.id]
                              )
                            }}
                            className="h-3.5 w-3.5 rounded border-gray-850 bg-gray-950 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="text-gray-300 truncate">{getFullName(m)}</span>
                          <span className="text-[9px] text-indigo-400 uppercase tracking-wider font-semibold font-mono">{m.rank}</span>
                        </label>
                      )
                    })
                  )}
                </div>
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-gray-900">
                <button
                  type="button"
                  onClick={() => setMode('list')}
                  className="rounded border border-gray-800 bg-gray-900 hover:bg-gray-850 px-4 py-2 text-xs font-semibold text-gray-300 hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-4.5 py-2 text-xs font-semibold text-white transition-colors cursor-pointer"
                >
                  {loading ? 'Saving...' : 'Save Template'}
                </button>
              </div>
            </form>
          )}

          {/* Generate Mode */}
          {mode === 'generate' && (
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-indigo-400">Generate Schedules from Templates</h4>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col space-y-1">
                  <label className="text-xxs font-bold uppercase tracking-wider text-gray-400">Start Date</label>
                  <input
                    type="date"
                    required
                    value={genStartDate}
                    onChange={(e) => setGenStartDate(e.target.value)}
                    className="block w-full rounded border border-gray-850 bg-gray-950 px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="flex flex-col space-y-1">
                  <label className="text-xxs font-bold uppercase tracking-wider text-gray-400">End Date</label>
                  <input
                    type="date"
                    required
                    value={genEndDate}
                    onChange={(e) => setGenEndDate(e.target.value)}
                    className="block w-full rounded border border-gray-850 bg-gray-950 px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Templates Selector Checklist */}
              <div className="border-t border-gray-900 pt-3">
                <label className="text-xxs font-bold uppercase tracking-wider text-gray-400">Select Templates to Generate</label>
                <div className="mt-2 space-y-1.5 max-h-40 overflow-y-auto border border-gray-900 rounded p-2 bg-gray-950/50">
                  {templates.length === 0 ? (
                    <div className="text-xxs text-gray-500 italic p-1">No templates available.</div>
                  ) : (
                    templates.map((t) => {
                      const isSelected = selectedTemplateIds.includes(t.id)
                      return (
                        <label key={t.id} className="flex items-center space-x-2 text-xs p-1.5 hover:bg-gray-900/35 rounded cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleTemplateSelection(t.id)}
                            className="h-4 w-4 rounded border-gray-850 bg-gray-950 text-indigo-600 focus:ring-indigo-500"
                          />
                          <div className="flex-1 flex justify-between items-center">
                            <div>
                              <span className="font-bold text-gray-200">{t.name}</span>
                              <span className="text-[10px] text-gray-400 ml-2">({t.dayOfWeek} | {t.startTime} - {t.endTime})</span>
                            </div>
                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase border ${
                              t.active ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-gray-800 border-gray-800 text-gray-400'
                            }`}>
                              {t.active ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                        </label>
                      )
                    })
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-gray-900">
                <button
                  type="button"
                  onClick={() => setMode('list')}
                  className="rounded border border-gray-800 bg-gray-900 hover:bg-gray-850 px-4 py-2 text-xs font-semibold text-gray-300 hover:text-white transition-colors cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleRunGenerator}
                  disabled={loading || selectedTemplateIds.length === 0 || !genStartDate || !genEndDate}
                  className="rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-4.5 py-2 text-xs font-bold text-white transition-colors cursor-pointer"
                >
                  {loading ? 'Generating...' : 'Generate Schedules'}
                </button>
              </div>
            </div>
          )}

          {/* Audit Report Mode */}
          {mode === 'report' && generationReport && (
            <div className="space-y-4">
              <div className="p-4 rounded border border-green-950 bg-green-950/15 text-center space-y-1">
                <svg className="mx-auto h-8 w-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h4 className="text-sm font-bold text-green-400 mt-2">Schedules Generation Complete!</h4>
                <p className="text-xs text-gray-300 mt-1">
                  Successfully completed the recurring templates generation algorithm.
                </p>
              </div>

              <div className="space-y-2">
                <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Generation Audit Log</div>
                <div className="border border-gray-900 rounded p-3 bg-gray-950/50 space-y-1 text-xs">
                  <div className="flex justify-between text-gray-300">
                    <span>Schedules Created:</span>
                    <span className="font-bold text-green-400">{generationReport.created}</span>
                  </div>
                  <div className="flex justify-between text-gray-300">
                    <span>Schedules Skipped (Conflict / Format Error):</span>
                    <span className="font-bold text-red-400">{generationReport.skipped}</span>
                  </div>
                  <div className="flex justify-between text-gray-300">
                    <span>Duplicate Schedules (Already Exist):</span>
                    <span className="font-bold text-yellow-500">{generationReport.duplicates}</span>
                  </div>
                </div>
              </div>

              {generationReport.validationErrors.length > 0 && (
                <div className="space-y-1.5">
                  <h5 className="text-xs font-bold text-red-400">⚠️ Validation Conflict Warnings ({generationReport.validationErrors.length})</h5>
                  <div className="max-h-32 overflow-y-auto border border-gray-900 rounded p-2 bg-gray-950/50 space-y-1">
                    {generationReport.validationErrors.map((errorStr: string, index: number) => (
                      <div key={index} className="text-[10px] text-red-400/90 leading-tight">
                        • {errorStr}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-3 border-t border-gray-900">
                <button
                  type="button"
                  onClick={() => setMode('list')}
                  className="rounded bg-indigo-600 hover:bg-indigo-500 px-4.5 py-2 text-xs font-semibold text-white transition-colors cursor-pointer"
                >
                  OK
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
