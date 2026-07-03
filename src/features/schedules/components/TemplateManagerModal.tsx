import React, { useState, useEffect } from 'react'
import type { Member } from '@/types/member'
import type { ScheduleTemplate, ScheduleTemplateInput } from '@/types/schedule'
import { recurringService } from '@/services/recurringService'
import { getFullName } from '@/utils/member'
import { ConfirmModal } from '@/components/Dialog'

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

  // Confirm delete dialog state
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

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

  const handleDeleteTemplate = (id: string) => {
    setConfirmDeleteId(id)
  }

  const handleDeleteConfirmed = async () => {
    if (!confirmDeleteId) return
    const id = confirmDeleteId
    setConfirmDeleteId(null)
    setLoading(true)
    setError(null)
    setSuccessMsg(null)
    try {
      await recurringService.deleteTemplate(id)
      setSuccessMsg('Template deleted successfully.')
      await loadTemplates()
    } catch (err: any) {
      console.error(err)
      setError('Failed to delete template.')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleActive = async (t: ScheduleTemplate) => {
    setError(null)
    setSuccessMsg(null)
    try {
      await recurringService.updateTemplate(t.id, { active: !t.active })
      await loadTemplates()
    } catch (err: any) {
      console.error(err)
      setError('Failed to toggle template status.')
    }
  }

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !title.trim() || !startTime || !endTime) {
      setError('Please fill in all required template details.')
      return
    }

    if (startTime >= endTime) {
      setError('Start time must be before End time.')
      return
    }

    setLoading(true)
    setError(null)
    setSuccessMsg(null)

    const payload: ScheduleTemplateInput = {
      name: name.trim(),
      title: title.trim(),
      dayOfWeek,
      startTime,
      endTime,
      assignedMembers: defaultAssigned,
      active
    }

    try {
      if (editingTemplate) {
        await recurringService.updateTemplate(editingTemplate.id, payload)
        setSuccessMsg('Template updated successfully.')
      } else {
        await recurringService.addTemplate(payload)
        setSuccessMsg('New template created successfully.')
      }
      setMode('list')
      await loadTemplates()
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Failed to save template.')
    } finally {
      setLoading(false)
    }
  }

  const toggleTemplateSelection = (id: string) => {
    setSelectedTemplateIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    )
  }

  const handleRunGenerator = async () => {
    if (!genStartDate || !genEndDate) {
      setError('Please select both Start Date and End Date range.')
      return
    }
    if (genStartDate > genEndDate) {
      setError('Start Date must be before or equal to End Date.')
      return
    }
    if (selectedTemplateIds.length === 0) {
      setError('Please select at least one template to generate.')
      return
    }

    setLoading(true)
    setError(null)
    setSuccessMsg(null)

    try {
      const selectedTemplates = templates.filter(t => selectedTemplateIds.includes(t.id))
      const report = await recurringService.generateSchedules(
        genStartDate,
        genEndDate,
        selectedTemplates,
        allMembers
      )
      setGenerationReport(report)
      setMode('report')
      await onGenerateSuccess()
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Failed to generate schedules.')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setMode('list')
    setEditingTemplate(null)
    setError(null)
    setSuccessMsg(null)
    setGenerationReport(null)
    onClose()
  }

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity" onClick={handleClose}></div>

      {/* Modal Card */}
      <div className="relative w-full max-w-2xl rounded-xl border border-gray-200 bg-white p-6 shadow-xl z-10 text-gray-800 flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div>
            <h3 className="text-sm font-bold text-gray-900">Schedule Templates Manager</h3>
            <p className="text-xs text-gray-500 mt-0.5 font-medium">Manage recurring schedule templates and bulk-generate schedules.</p>
          </div>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-700 transition-colors cursor-pointer focus:outline-none">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="mt-4 flex-1 space-y-4 overflow-y-auto pr-1">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-xs text-red-655 font-medium">
              {error}
            </div>
          )}

          {successMsg && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-xs text-green-600">
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
                  className="rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-3.5 py-1.5 text-xs font-bold text-white transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
                >
                  ⚙ Generate Schedules
                </button>
                <button
                  type="button"
                  onClick={handleOpenCreate}
                  className="rounded-lg border border-gray-200 bg-white hover:bg-gray-50 px-3.5 py-1.5 text-xs font-semibold text-gray-700 hover:text-gray-900 transition-colors cursor-pointer shadow-sm"
                >
                  + Add Template
                </button>
              </div>

              {loading ? (
                <div className="py-12 flex flex-col items-center justify-center space-y-2">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
                  <span className="text-xs text-gray-500">Loading templates...</span>
                </div>
              ) : templates.length === 0 ? (
                <div className="py-12 text-center border border-gray-200 rounded-xl bg-gray-50/50 text-gray-400 text-xs italic">
                  No recurring templates defined. Click "+ Add Template" to create one.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {templates.map((t) => (
                    <div key={t.id} className="p-4 rounded-xl border border-gray-200 bg-gray-50/30 flex flex-col justify-between space-y-3">
                      <div>
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-sm text-gray-900 truncate max-w-[180px]">{t.name}</h4>
                          <button
                            onClick={() => handleToggleActive(t)}
                            className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase border cursor-pointer ${
                              t.active 
                                ? 'bg-green-50 border-green-100 text-green-600' 
                                : 'bg-gray-100 border-gray-200 text-gray-550'
                            }`}
                          >
                            {t.active ? 'Active' : 'Inactive'}
                          </button>
                        </div>
                        <p className="text-[11px] text-gray-500 mt-2 leading-tight">
                          ⛪ Title: <span className="text-gray-800 font-semibold">{t.title}</span>
                        </p>
                        <p className="text-[11px] text-gray-500 mt-0.5 leading-none">
                          📅 {t.dayOfWeek} | 🕒 {t.startTime} - {t.endTime}
                        </p>
                        <p className="text-[10px] text-blue-600 font-bold mt-3 leading-none">
                          👥 {t.assignedMembers?.length || 0} default servers assigned
                        </p>
                      </div>

                      <div className="flex items-center space-x-2.5 pt-2 border-t border-gray-200/60">
                        <button
                          onClick={() => handleOpenEdit(t)}
                          className="text-xs text-blue-600 hover:text-blue-700 font-bold cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteTemplate(t.id)}
                          className="text-xs text-red-655 hover:text-red-755 font-semibold cursor-pointer"
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
                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Template Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="block w-full rounded-lg border border-gray-250 bg-white px-3 py-2 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-shadow duration-150"
                    placeholder="e.g. Sunday 6AM Mass"
                  />
                </div>

                {/* Schedule Title */}
                <div className="flex flex-col space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Schedule Title</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="block w-full rounded-lg border border-gray-250 bg-white px-3 py-2 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-shadow duration-150"
                    placeholder="e.g. Sunday Mass"
                  />
                </div>

                {/* Day of Week */}
                <div className="flex flex-col space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Day of Week</label>
                  <select
                    value={dayOfWeek}
                    onChange={(e) => setDayOfWeek(e.target.value)}
                    className="block w-full rounded-lg border border-gray-250 bg-white px-3 py-2 text-xs text-gray-700 focus:outline-none focus:border-blue-500 transition-colors"
                  >
                    {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                {/* Active Toggle */}
                <div className="flex items-center space-x-2 pt-5 select-none">
                  <input
                    type="checkbox"
                    id="template-active"
                    checked={active}
                    onChange={(e) => setActive(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 bg-white text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <label htmlFor="template-active" className="text-xs font-bold text-gray-500 cursor-pointer">
                    Enable Template (Active)
                  </label>
                </div>

                {/* Start Time */}
                <div className="flex flex-col space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Start Time</label>
                  <input
                    type="time"
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="block w-full rounded-lg border border-gray-250 bg-white px-3 py-2 text-xs text-gray-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-shadow duration-150"
                  />
                </div>

                {/* End Time */}
                <div className="flex flex-col space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">End Time</label>
                  <input
                    type="time"
                    required
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="block w-full rounded-lg border border-gray-250 bg-white px-3 py-2 text-xs text-gray-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-shadow duration-150"
                  />
                </div>
              </div>

              {/* Default Assigned Members Checklist */}
              <div className="border-t border-gray-100 pt-3">
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Default Assigned Altar Servers</label>
                <div className="mt-2 max-h-36 overflow-y-auto border border-gray-200 rounded-lg p-2 bg-white grid grid-cols-1 sm:grid-cols-2 gap-2 shadow-xs">
                  {activeMembers.length === 0 ? (
                    <span className="text-xs text-gray-400 italic p-1">No active members found.</span>
                  ) : (
                    activeMembers.map((m) => {
                      const isAssigned = defaultAssigned.includes(m.id)
                      return (
                        <label key={m.id} className="flex items-center space-x-2 text-xs p-1 hover:bg-gray-50/70 rounded-lg cursor-pointer select-none">
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
                            className="h-3.5 w-3.5 rounded border-gray-300 bg-white text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                          <span className="text-gray-700 font-medium truncate">{getFullName(m)}</span>
                          <span className="text-[9px] text-blue-600 font-bold uppercase tracking-wider">{m.rank}</span>
                        </label>
                      )
                    })
                  )}
                </div>
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-gray-100 bg-white">
                <button
                  type="button"
                  onClick={() => setMode('list')}
                  className="rounded-lg border border-gray-200 bg-white hover:bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-700 hover:text-gray-900 transition-colors cursor-pointer shadow-sm animate-none"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-4.5 py-2 text-xs font-bold text-white transition-colors cursor-pointer shadow-sm"
                >
                  {loading ? 'Saving...' : 'Save Template'}
                </button>
              </div>
            </form>
          )}

          {/* Generate Mode */}
          {mode === 'generate' && (
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-blue-600">Generate Schedules from Templates</h4>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Start Date</label>
                  <input
                    type="date"
                    required
                    value={genStartDate}
                    onChange={(e) => setGenStartDate(e.target.value)}
                    className="block w-full rounded-lg border border-gray-250 bg-white px-3 py-2 text-xs text-gray-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-shadow duration-150"
                  />
                </div>

                <div className="flex flex-col space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">End Date</label>
                  <input
                    type="date"
                    required
                    value={genEndDate}
                    onChange={(e) => setGenEndDate(e.target.value)}
                    className="block w-full rounded-lg border border-gray-250 bg-white px-3 py-2 text-xs text-gray-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-shadow duration-150"
                  />
                </div>
              </div>

              {/* Templates Selector Checklist */}
              <div className="border-t border-gray-100 pt-3">
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Select Templates to Generate</label>
                <div className="mt-2 space-y-1.5 max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2 bg-white shadow-xs">
                  {templates.length === 0 ? (
                    <div className="text-xs text-gray-400 italic p-1">No templates available.</div>
                  ) : (
                    templates.map((t) => {
                      const isSelected = selectedTemplateIds.includes(t.id)
                      return (
                        <label key={t.id} className="flex items-center space-x-2 text-xs p-1.5 hover:bg-gray-50/70 rounded-lg cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleTemplateSelection(t.id)}
                            className="h-4 w-4 rounded border-gray-300 bg-white text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                          <div className="flex-1 flex justify-between items-center pr-1">
                            <div>
                              <span className="font-semibold text-gray-800">{t.name}</span>
                              <span className="text-[10px] text-gray-400 ml-2 font-medium">({t.dayOfWeek} | {t.startTime} - {t.endTime})</span>
                            </div>
                            <span className={`px-1.5 py-0.5 rounded-md text-[8px] font-bold uppercase border ${
                              t.active ? 'bg-green-50 border border-green-100 text-green-600' : 'bg-gray-100 border border-gray-200 text-gray-550'
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
              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-gray-100 bg-white">
                <button
                  type="button"
                  onClick={() => setMode('list')}
                  className="rounded-lg border border-gray-200 bg-white hover:bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-700 hover:text-gray-900 transition-colors cursor-pointer shadow-sm animate-none"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleRunGenerator}
                  disabled={loading || selectedTemplateIds.length === 0 || !genStartDate || !genEndDate}
                  className="rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-4.5 py-2 text-xs font-bold text-white transition-colors cursor-pointer shadow-sm"
                >
                  {loading ? 'Generating...' : 'Generate Schedules'}
                </button>
              </div>
            </div>
          )}

          {/* Audit Report Mode */}
          {mode === 'report' && generationReport && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-green-200 bg-green-50 text-center space-y-1 shadow-sm">
                <svg className="mx-auto h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h4 className="text-sm font-bold text-green-700 mt-2">Schedules Generation Complete!</h4>
                <p className="text-xs text-green-600 font-medium mt-1">
                  Successfully completed the recurring templates generation algorithm.
                </p>
              </div>

              <div className="space-y-2">
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Generation Audit Log</div>
                <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/50 space-y-2 text-xs">
                  <div className="flex justify-between text-gray-700">
                    <span>Schedules Created:</span>
                    <span className="font-bold text-green-600">{generationReport.created}</span>
                  </div>
                  <div className="flex justify-between text-gray-700">
                    <span>Schedules Skipped (Conflict / Format Error):</span>
                    <span className="font-bold text-red-600">{generationReport.skipped}</span>
                  </div>
                  <div className="flex justify-between text-gray-700">
                    <span>Duplicate Schedules (Already Exist):</span>
                    <span className="font-bold text-amber-600">{generationReport.duplicates}</span>
                  </div>
                </div>
              </div>

              {generationReport.validationErrors.length > 0 && (
                <div className="space-y-1.5">
                  <h5 className="text-xs font-bold text-red-655">⚠️ Validation Conflict Warnings ({generationReport.validationErrors.length})</h5>
                  <div className="max-h-32 overflow-y-auto border border-gray-250 bg-red-50/30 rounded-lg p-3 space-y-1">
                    {generationReport.validationErrors.map((errorStr: string, index: number) => (
                      <div key={index} className="text-[10px] text-red-700 leading-tight">
                        • {errorStr}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-3 border-t border-gray-100 bg-white">
                <button
                  type="button"
                  onClick={() => setMode('list')}
                  className="rounded-lg bg-blue-600 hover:bg-blue-500 px-4.5 py-2 text-xs font-bold text-white transition-colors cursor-pointer shadow-sm"
                >
                  OK
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>

      {/* Delete Template Confirm Dialog */}
      <ConfirmModal
        isOpen={!!confirmDeleteId}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={handleDeleteConfirmed}
        variant="danger"
        title="Delete Template"
        message="Are you sure you want to delete this template? This action cannot be undone."
        confirmLabel="Delete Template"
        loading={loading}
      />
    </>
  )
}
