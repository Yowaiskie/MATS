import React, { useState, useEffect } from 'react'
import type { Member } from '@/types/member'
import type { ScheduleTemplate, ScheduleTemplateInput } from '@/types/schedule'
import { recurringService } from '@/services/recurringService'
import { getFullName } from '@/utils/member'
import { ConfirmModal } from '@/components/Dialog'

const formatTime12 = (timeStr: string) => {
  if (!timeStr) return ''
  const parts = timeStr.split(':')
  if (parts.length < 2) return timeStr
  let h = parseInt(parts[0], 10)
  const m = parts[1].padStart(2, '0')
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12
  h = h ? h : 12
  return `${h}:${m} ${ampm}`
}

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

  // Sub-navigation mode: 'list' | 'create' | 'edit' | 'generate' | 'report' | 'import_csv'
  const [mode, setMode] = useState<'list' | 'create' | 'edit' | 'generate' | 'report' | 'import_csv'>('list')
  const [editingTemplate, setEditingTemplate] = useState<ScheduleTemplate | null>(null)
  // Category Card Collapsible/Accordion state
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)

  // Template Form State
  const [name, setName] = useState('')
  const [title, setTitle] = useState('')
  const [dayOfWeek, setDayOfWeek] = useState('Sunday')
  const [selectedDays, setSelectedDays] = useState<string[]>(['Sunday'])
  const [timeSlots, setTimeSlots] = useState<Array<{ id: string; startTime: string; endTime: string }>>([
    { id: '1', startTime: '08:00', endTime: '09:00' }
  ])
  const [defaultAssigned, setDefaultAssigned] = useState<string[]>([])
  const [active, setActive] = useState(true)

  // CSV Import for Templates State
  const [csvText, setCsvText] = useState('')
  const [importedSlots, setImportedSlots] = useState<any[]>([])
  const [selectedSlotKeys, setSelectedSlotKeys] = useState<string[]>([])
  const [unknownMembers, setUnknownMembers] = useState<string[]>([])
  const [manualMemberMap, setManualMemberMap] = useState<Record<string, string>>({})
  const [importingCSV, setImportingCSV] = useState(false)

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
    setSelectedDays(['Sunday'])
    setTimeSlots([{ id: Date.now().toString(), startTime: '08:00', endTime: '09:00' }])
    setDefaultAssigned([])
    setActive(true)
    setEditingTemplate(null)
    setMode('create')
  }

  const handleOpenCreateForCategory = (categoryTitle: string) => {
    setName('')
    setTitle(categoryTitle)
    setDayOfWeek('Saturday')
    setSelectedDays(['Saturday'])
    setTimeSlots([{ id: Date.now().toString(), startTime: '18:00', endTime: '19:00' }])
    setDefaultAssigned([])
    setActive(true)
    setEditingTemplate(null)
    setMode('create')
  }

  const handleOpenEdit = (t: ScheduleTemplate) => {
    setName(t.name)
    setTitle(t.title)
    setDayOfWeek(t.dayOfWeek)
    setSelectedDays([t.dayOfWeek])
    setTimeSlots([{ id: t.id, startTime: t.startTime, endTime: t.endTime }])
    setDefaultAssigned(t.assignedMembers || [])
    setActive(t.active)
    setEditingTemplate(t)
    setMode('edit')
  }

  const handleAddTimeSlot = () => {
    setTimeSlots(prev => [
      ...prev,
      { id: Date.now().toString(), startTime: '10:00', endTime: '11:00' }
    ])
  }

  const handleRemoveTimeSlot = (id: string) => {
    if (timeSlots.length <= 1) return
    setTimeSlots(prev => prev.filter(slot => slot.id !== id))
  }

  const handleTimeSlotChange = (id: string, field: 'startTime' | 'endTime', value: string) => {
    setTimeSlots(prev => prev.map(slot => 
      slot.id === id ? { ...slot, [field]: value } : slot
    ))
  }

  const calculateEndTime = (start: string): string => {
    if (!start) return '09:00'
    const [h, m] = start.split(':').map(Number)
    const nextH = (h + 1) % 24
    return `${String(nextH).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      setError('Please provide a Schedule Title.')
      return
    }

    if (timeSlots.length === 0) {
      setError('Please add at least one time slot.')
      return
    }

    for (const slot of timeSlots) {
      if (!slot.startTime) {
        setError('Please select a start time for all time slots.')
        return
      }
    }

    setLoading(true)
    setError(null)
    setSuccessMsg(null)

    try {
      if (editingTemplate) {
        // Single template update
        const slot = timeSlots[0]
        const computedEnd = calculateEndTime(slot.startTime)
        const selectedDay = selectedDays[0] || dayOfWeek
        const templateName = name.trim() || `${title.trim()} (${slot.startTime})`
        await recurringService.updateTemplate(editingTemplate.id, {
          name: templateName,
          title: title.trim(),
          dayOfWeek: selectedDay,
          startTime: slot.startTime,
          endTime: computedEnd,
          assignedMembers: defaultAssigned,
          active
        })
        setSuccessMsg('Template updated successfully.')
      } else {
        // Multi-day & Multi-slot batch template creation
        const daysToCreate = selectedDays.length > 0 ? selectedDays : [dayOfWeek]
        let createdCount = 0

        for (const targetDay of daysToCreate) {
          for (const slot of timeSlots) {
            const computedEnd = calculateEndTime(slot.startTime)
            const templateName = (timeSlots.length === 1 && daysToCreate.length === 1 && name.trim())
              ? name.trim()
              : `${title.trim()} (${slot.startTime})`

            const payload: ScheduleTemplateInput = {
              name: templateName,
              title: title.trim(),
              dayOfWeek: targetDay,
              startTime: slot.startTime,
              endTime: computedEnd,
              assignedMembers: defaultAssigned,
              active
            }
            await recurringService.addTemplate(payload)
            createdCount++
          }
        }
        setSuccessMsg(`Successfully created ${createdCount} template slot(s) across ${daysToCreate.length} day(s).`)
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

  const handleOpenCSVImport = () => {
    setCsvText('')
    setImportedSlots([])
    setSelectedSlotKeys([])
    setUnknownMembers([])
    setManualMemberMap({})
    setError(null)
    setSuccessMsg(null)
    setMode('import_csv')
  }

  const handleCSVFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (event) => {
      if (event.target?.result) {
        const text = event.target.result as string
        setCsvText(text)
        await parseCSVForTemplates(text, manualMemberMap)
      }
    }
    reader.readAsText(file)
  }

  const parseCSVForTemplates = async (text: string, currentManualMap: Record<string, string>) => {
    if (!text.trim()) return
    setLoading(true)
    setError(null)
    try {
      const result = await recurringService.extractTemplateAssignmentsFromCSV(text, activeMembers, currentManualMap)
      setImportedSlots(result.slots)
      setUnknownMembers(result.unknownMembers)
      // Pre-select all detected slots
      setSelectedSlotKeys(result.slots.map(s => s.key))
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Failed to parse CSV file.')
    } finally {
      setLoading(false)
    }
  }

  const handleManualMapChange = async (unknownName: string, memberId: string) => {
    const updatedMap = { ...manualMemberMap, [unknownName]: memberId }
    if (!memberId) {
      delete updatedMap[unknownName]
    }
    setManualMemberMap(updatedMap)
    if (csvText) {
      await parseCSVForTemplates(csvText, updatedMap)
    }
  }

  const toggleSlotSelection = (key: string) => {
    setSelectedSlotKeys(prev => 
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  const handleApplyCSVToTemplates = async () => {
    const slotsToApply = importedSlots.filter(s => selectedSlotKeys.includes(s.key))
    if (slotsToApply.length === 0) {
      setError('Please select at least one schedule slot to update or create templates.')
      return
    }

    setImportingCSV(true)
    setError(null)
    setSuccessMsg(null)

    try {
      let createdCount = 0
      let updatedCount = 0

      for (const slot of slotsToApply) {
        // Find existing template matching title, dayOfWeek, startTime, endTime
        const existing = templates.find(t => 
          t.title.toLowerCase() === slot.title.toLowerCase() &&
          t.dayOfWeek.toLowerCase() === slot.dayOfWeek.toLowerCase() &&
          t.startTime === slot.startTime &&
          t.endTime === slot.endTime
        )

        if (existing) {
          // Merge or update assigned members
          const mergedAssigned = Array.from(new Set([...(existing.assignedMembers || []), ...slot.assignedMemberIds]))
          await recurringService.updateTemplate(existing.id, {
            assignedMembers: mergedAssigned
          })
          updatedCount++
        } else {
          // Create new template
          await recurringService.addTemplate({
            name: `${slot.title} (${slot.startTime})`,
            title: slot.title,
            dayOfWeek: slot.dayOfWeek,
            startTime: slot.startTime,
            endTime: slot.endTime,
            assignedMembers: slot.assignedMemberIds,
            active: true
          })
          createdCount++
        }
      }

      setSuccessMsg(`Successfully processed ${slotsToApply.length} slots! Created: ${createdCount}, Updated: ${updatedCount}.`)
      await loadTemplates()
      setMode('list')
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Failed to apply server assignments to templates.')
    } finally {
      setImportingCSV(false)
    }
  }

  const handleClose = () => {
    setMode('list')
    setEditingTemplate(null)
    setError(null)
    setSuccessMsg(null)
    setGenerationReport(null)
    setCsvText('')
    setImportedSlots([])
    setSelectedSlotKeys([])
    setUnknownMembers([])
    setManualMemberMap({})
    onClose()
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity" 
          onClick={() => handleClose()} 
        />

        {/* Modal Card */}
        <div className="relative w-full max-w-2xl rounded-xl border border-gray-200 bg-white p-6 shadow-xl z-10 text-gray-800 flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
          
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div>
              <h3 className="text-sm font-bold text-gray-900">Schedule Templates Manager</h3>
              <p className="text-xs text-gray-500 mt-0.5 font-medium">Manage recurring schedule templates and bulk-generate schedules.</p>
            </div>
            <button 
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                handleClose()
              }} 
              className="text-gray-400 hover:text-gray-700 transition-colors cursor-pointer focus:outline-none p-1.5 rounded-lg hover:bg-gray-100 relative z-30"
              aria-label="Close modal"
            >
              <svg className="h-5 w-5 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

        {/* Content */}
        <div className="mt-4 flex-1 space-y-4 overflow-y-auto pr-1">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-xs text-red-600 font-medium">
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
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Generate Schedules
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleOpenCSVImport}
                    className="rounded-lg border border-gray-200 bg-white hover:bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:text-gray-900 transition-colors cursor-pointer shadow-sm flex items-center gap-1"
                  >
                    <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    Import CSV
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenCreate}
                    className="rounded-lg border border-gray-200 bg-white hover:bg-gray-50 px-3.5 py-1.5 text-xs font-semibold text-gray-700 hover:text-gray-900 transition-colors cursor-pointer shadow-sm flex items-center gap-1"
                  >
                    <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Template
                  </button>
                </div>
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
                <div className="space-y-4">
                  {(() => {
                    // Group templates purely by Schedule Title
                    const groups: Record<string, { title: string; items: ScheduleTemplate[] }> = {}
                    
                    templates.forEach(t => {
                      const key = t.title.trim().toLowerCase()
                      if (!groups[key]) {
                        groups[key] = {
                          title: t.title.trim(),
                          items: []
                        }
                      }
                      groups[key].items.push(t)
                    })

                    return Object.entries(groups).map(([groupKey, group]) => {
                      // Order days of week
                      const dayOrder: Record<string, number> = {
                        'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3,
                        'Thursday': 4, 'Friday': 5, 'Saturday': 6
                      }

                      // Sort items by Day of Week then Start Time
                      const sortedItems = [...group.items].sort((a, b) => {
                        const dayA = dayOrder[a.dayOfWeek] ?? 7
                        const dayB = dayOrder[b.dayOfWeek] ?? 7
                        if (dayA !== dayB) return dayA - dayB
                        return a.startTime.localeCompare(b.startTime)
                      })

                      // Extract unique days list
                      const uniqueDays = Array.from(new Set(sortedItems.map(i => i.dayOfWeek)))
                      const daysText = uniqueDays.length === 7 
                        ? 'Everyday' 
                        : uniqueDays.length === 5 && !uniqueDays.includes('Saturday') && !uniqueDays.includes('Sunday')
                          ? 'Weekdays (M-F)'
                          : uniqueDays.join(', ')

                      const activeCount = sortedItems.filter(i => i.active).length
                      const isExpanded = expandedCategory === groupKey

                      return (
                        <div key={groupKey} className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-2xs transition-all">
                          {/* Category Header (Clickable Accordion) */}
                          <div 
                            onClick={() => setExpandedCategory(isExpanded ? null : groupKey)}
                            className="flex items-center justify-between p-4 bg-gray-50/50 hover:bg-gray-100/70 transition-colors cursor-pointer select-none"
                          >
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-blue-50 border border-blue-100 rounded-lg text-blue-600">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5m0 0h4m-4 0V11m0 0V7m0 4h4m-4 0H7" />
                                </svg>
                              </div>
                              <div>
                                <h4 className="font-bold text-sm text-gray-900">{group.title}</h4>
                                <p className="text-[11px] text-gray-500 font-medium mt-0.5 flex items-center gap-1">
                                  <svg className="w-3.5 h-3.5 text-gray-400 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                  <span className="text-blue-600 font-semibold">{daysText}</span> • <span className="font-semibold text-gray-700">{sortedItems.length} Time Slot(s)</span>
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100">
                                {activeCount} Active / {sortedItems.length} Total
                              </span>

                              <div className="p-1 rounded-lg hover:bg-gray-200/60 text-gray-400">
                                <svg 
                                  className={`h-5 w-5 transition-transform duration-200 ${isExpanded ? 'rotate-180 text-blue-600' : ''}`} 
                                  fill="none" 
                                  viewBox="0 0 24 24" 
                                  stroke="currentColor"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </div>
                            </div>
                          </div>

                          {/* Time Slots List inside Collapsible Accordion */}
                          {isExpanded && (
                            <div className="p-4 border-t border-gray-100 bg-white space-y-3 animate-in fade-in duration-150">
                              <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                                  Scheduled Days & Time Slots ({sortedItems.length})
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleOpenCreateForCategory(group.title)
                                  }}
                                  className="text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-md transition-colors cursor-pointer flex items-center gap-1 border border-blue-200"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                  </svg>
                                  Add Slot to {group.title}
                                </button>
                              </div>
                              <div className="grid grid-cols-1 gap-2">
                                {sortedItems.map((t) => (
                                  <div
                                    key={t.id}
                                    className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                                      t.active ? 'bg-gray-50/70 border-gray-200' : 'bg-gray-50/30 border-gray-100 opacity-60'
                                    }`}
                                  >
                                    {/* Left: Day Badge, Time Badge, Assigned count */}
                                    <div className="flex items-center gap-3 flex-wrap">
                                      <span className="font-bold text-xs text-blue-800 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-100 shrink-0">
                                        {t.dayOfWeek}
                                      </span>

                                      <div className="flex items-center gap-1.5 text-xs font-bold text-gray-900 shrink-0">
                                        <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <span className="whitespace-nowrap">{formatTime12(t.startTime)} - {formatTime12(t.endTime)}</span>
                                      </div>

                                      <span className="text-[10px] text-blue-600 font-semibold flex items-center gap-1 bg-white px-2 py-0.5 rounded-md border border-gray-200/80 shrink-0">
                                        <svg className="w-3 h-3 text-blue-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                        </svg>
                                        {t.assignedMembers?.length || 0} servers assigned
                                      </span>
                                    </div>

                                    {/* Right: Active Status + Edit / Delete Actions */}
                                    <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto border-t sm:border-t-0 sm:border-l border-gray-200/70 pt-2 sm:pt-0 sm:pl-3 w-full sm:w-auto justify-end">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          handleToggleActive(t)
                                        }}
                                        className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase border cursor-pointer ${
                                          t.active 
                                            ? 'bg-green-50 border-green-200 text-green-700' 
                                            : 'bg-gray-100 border-gray-200 text-gray-500'
                                        }`}
                                      >
                                        {t.active ? 'Active' : 'Off'}
                                      </button>

                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          handleOpenEdit(t)
                                        }}
                                        className="text-xs text-blue-600 hover:text-blue-700 font-bold cursor-pointer hover:bg-blue-50 px-2 py-0.5 rounded transition-colors"
                                        title="Edit slot & assigned servers"
                                      >
                                        Edit
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          handleDeleteTemplate(t.id)
                                        }}
                                        className="text-xs text-red-500 hover:text-red-700 font-semibold cursor-pointer hover:bg-red-50 px-2 py-0.5 rounded transition-colors"
                                        title="Delete time slot"
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })
                  })()}
                </div>
              )}
            </div>
          )}

          {/* Form Mode (Create/Edit) */}
          {(mode === 'create' || mode === 'edit') && (
            <form onSubmit={handleSaveTemplate} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Template Name (Optional when creating multiple slots) */}
                <div className="flex flex-col space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Template Name {mode === 'create' && timeSlots.length > 1 && '(Auto-generated if empty)'}
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-shadow duration-150"
                    placeholder="e.g. Sunday 6AM Mass"
                  />
                </div>

                {/* Schedule Title */}
                <div className="flex flex-col space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Schedule Title *</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-shadow duration-150"
                    placeholder="e.g. Sunday Mass"
                  />
                </div>

                {/* Day of Week Selector */}
                <div className="flex flex-col space-y-1.5 sm:col-span-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      Days of Week {mode === 'create' ? `(${selectedDays.length} selected)` : ''}
                    </label>
                    {mode === 'create' && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedDays(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'])}
                          className="text-[10px] font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 px-2 py-0.5 rounded-md border border-blue-200 cursor-pointer transition-colors"
                        >
                          ⚡ Weekdays (M-F)
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedDays(['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'])}
                          className="text-[10px] font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-0.5 rounded-md border border-gray-200 cursor-pointer transition-colors"
                        >
                          Everyday
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedDays(['Saturday', 'Sunday'])}
                          className="text-[10px] font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-0.5 rounded-md border border-gray-200 cursor-pointer transition-colors"
                        >
                          Weekend
                        </button>
                      </div>
                    )}
                  </div>

                  {mode === 'create' ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-2 bg-gray-50/70 border border-gray-200 rounded-lg">
                      {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((d) => {
                        const isChecked = selectedDays.includes(d)
                        return (
                          <label key={d} className="flex items-center space-x-1.5 text-xs p-1 hover:bg-white rounded cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                setSelectedDays(prev => {
                                  if (isChecked) {
                                    if (prev.length <= 1) return prev // Keep at least one
                                    return prev.filter(day => day !== d)
                                  } else {
                                    return [...prev, d]
                                  }
                                })
                              }}
                              className="h-3.5 w-3.5 rounded border-gray-300 bg-white text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                            <span className={`text-xs ${isChecked ? 'font-bold text-blue-900' : 'text-gray-600'}`}>{d}</span>
                          </label>
                        )
                      })}
                    </div>
                  ) : (
                    <select
                      value={selectedDays[0] || dayOfWeek}
                      onChange={(e) => {
                        setDayOfWeek(e.target.value)
                        setSelectedDays([e.target.value])
                      }}
                      className="block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 focus:outline-none focus:border-blue-500 transition-colors"
                    >
                      {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Active Toggle */}
                <div className="flex items-center space-x-2 pt-1 select-none sm:col-span-2">
                  <input
                    type="checkbox"
                    id="template-active"
                    checked={active}
                    onChange={(e) => setActive(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 bg-white text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <label htmlFor="template-active" className="text-xs font-bold text-gray-600 cursor-pointer">
                    Enable Template (Active)
                  </label>
                </div>
              </div>

              {/* Time Slots Section (Add Multiple Hours) */}
              <div className="border-t border-gray-100 pt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Schedule Start Time Slots ({timeSlots.length})
                  </label>
                  {mode === 'create' && (
                    <button
                      type="button"
                      onClick={handleAddTimeSlot}
                      className="text-xs text-blue-600 hover:text-blue-700 font-bold cursor-pointer flex items-center gap-1 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-md transition-colors"
                    >
                      + Add More Hours / Time Slot
                    </button>
                  )}
                </div>

                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  {timeSlots.map((slot, index) => (
                    <div key={slot.id} className="flex items-center gap-3 bg-gray-50/60 p-2.5 rounded-lg border border-gray-200">
                      <span className="text-xs font-bold text-gray-400 w-4">#{index + 1}</span>
                      
                      <div className="flex-1 flex items-center gap-2">
                        <div className="flex-1 flex flex-col space-y-0.5">
                          <span className="text-[9px] font-bold text-gray-400 uppercase">Start Time</span>
                          <input
                            type="time"
                            required
                            value={slot.startTime}
                            onChange={(e) => handleTimeSlotChange(slot.id, 'startTime', e.target.value)}
                            className="block w-full rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-800 focus:outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>

                      {mode === 'create' && timeSlots.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveTimeSlot(slot.id)}
                          className="text-red-500 hover:text-red-700 p-1.5 rounded-md hover:bg-red-50 cursor-pointer mt-1"
                          title="Remove time slot"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
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
          )}          {/* Generate Mode */}
          {mode === 'generate' && (
            <div className="space-y-5">
              <div>
                <h4 className="text-sm font-bold text-gray-900">Generate Schedules from Templates</h4>
                <p className="text-xs text-gray-500 mt-0.5">Bulk-generate recurring mass schedules into your active calendar for a specific date range.</p>
              </div>

              {/* Date Range Selection + Quick Month Presets */}
              <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-800">1. Select Target Date Range</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const now = new Date()
                        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
                        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
                        const formatYMD = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
                        setGenStartDate(formatYMD(firstDay))
                        setGenEndDate(formatYMD(lastDay))
                      }}
                      className="px-2.5 py-1 text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md cursor-pointer transition-colors"
                    >
                      This Month
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const now = new Date()
                        const firstDay = new Date(now.getFullYear(), now.getMonth() + 1, 1)
                        const lastDay = new Date(now.getFullYear(), now.getMonth() + 2, 0)
                        const formatYMD = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
                        setGenStartDate(formatYMD(firstDay))
                        setGenEndDate(formatYMD(lastDay))
                      }}
                      className="px-2.5 py-1 text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md cursor-pointer transition-colors"
                    >
                      Next Month
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex flex-col space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Start Date</label>
                    <input
                      type="date"
                      required
                      value={genStartDate}
                      onChange={(e) => setGenStartDate(e.target.value)}
                      className="block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800 focus:outline-none focus:border-blue-500 shadow-2xs"
                    />
                  </div>

                  <div className="flex flex-col space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">End Date</label>
                    <input
                      type="date"
                      required
                      value={genEndDate}
                      onChange={(e) => setGenEndDate(e.target.value)}
                      className="block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800 focus:outline-none focus:border-blue-500 shadow-2xs"
                    />
                  </div>
                </div>
              </div>

              {/* Templates Selector Grouped cleanly by Category */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-800">2. Select Templates to Include ({selectedTemplateIds.length} selected)</span>
                  <div className="space-x-2">
                    <button
                      type="button"
                      onClick={() => setSelectedTemplateIds(templates.map(t => t.id))}
                      className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
                    >
                      Select All
                    </button>
                    <span className="text-gray-300">•</span>
                    <button
                      type="button"
                      onClick={() => setSelectedTemplateIds([])}
                      className="text-[11px] font-semibold text-gray-500 hover:text-gray-700 cursor-pointer"
                    >
                      Deselect All
                    </button>
                  </div>
                </div>

                <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-xl p-3 bg-white space-y-3 shadow-2xs">
                  {templates.length === 0 ? (
                    <div className="text-xs text-gray-400 italic p-2 text-center">No schedule templates available.</div>
                  ) : (
                    (() => {
                      const groups: Record<string, ScheduleTemplate[]> = {}
                      templates.forEach(t => {
                        const key = t.title.trim()
                        if (!groups[key]) groups[key] = []
                        groups[key].push(t)
                      })

                      const dayOrder: Record<string, number> = {
                        'Monday': 0, 'Tuesday': 1, 'Wednesday': 2,
                        'Thursday': 3, 'Friday': 4, 'Saturday': 5, 'Sunday': 6
                      }

                      return Object.entries(groups).map(([categoryTitle, items]) => {
                        const sortedItems = [...items].sort((a, b) => {
                          const dayA = dayOrder[a.dayOfWeek] ?? 7
                          const dayB = dayOrder[b.dayOfWeek] ?? 7
                          if (dayA !== dayB) return dayA - dayB
                          return a.startTime.localeCompare(b.startTime)
                        })

                        return (
                          <div key={categoryTitle} className="space-y-1.5 border-b border-gray-100 last:border-0 pb-2.5 last:pb-0">
                            <div className="text-xs font-bold text-gray-900 bg-gray-50/80 px-2.5 py-1 rounded-md border border-gray-200/60 flex items-center justify-between">
                              <span>{categoryTitle}</span>
                              <span className="text-[10px] text-gray-500 font-semibold">{sortedItems.length} slot(s)</span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pl-1">
                              {sortedItems.map((t) => {
                                const isSelected = selectedTemplateIds.includes(t.id)
                                return (
                                  <label
                                    key={t.id}
                                    className={`flex items-center gap-2 text-xs p-2 rounded-lg border cursor-pointer select-none transition-all ${
                                      isSelected 
                                        ? 'border-blue-300 bg-blue-50/40 text-blue-900 font-semibold shadow-2xs' 
                                        : 'border-gray-100 bg-white hover:bg-gray-50 text-gray-600'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => toggleTemplateSelection(t.id)}
                                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                    />
                                    <div className="flex-1 flex items-center justify-between min-w-0">
                                      <span className="truncate">{t.dayOfWeek} • {formatTime12(t.startTime)}</span>
                                      <span className={`px-1.5 py-0.2 rounded text-[8px] font-bold uppercase shrink-0 ${
                                        t.active ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-gray-100 text-gray-400'
                                      }`}>
                                        {t.active ? 'Active' : 'Off'}
                                      </span>
                                    </div>
                                  </label>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })
                    })()
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-gray-100 bg-white">
                <button
                  type="button"
                  onClick={() => setMode('list')}
                  className="rounded-lg border border-gray-200 bg-white hover:bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-700 hover:text-gray-900 transition-colors cursor-pointer shadow-sm"
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

          {/* CSV Import for Templates Mode */}
          {mode === 'import_csv' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 space-y-2">
                <h4 className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                  <span>📄</span> Extract Server Assignments from CSV
                </h4>
                <p className="text-xs text-blue-700 leading-relaxed">
                  Upload a schedule CSV file. The system will extract assigned servers for each mass schedule slot and assign them to your schedule templates.
                </p>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleCSVFileChange}
                  className="block w-full text-xs text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500 cursor-pointer pt-1"
                />
              </div>

              {/* Unknown member manual mapping if needed */}
              {unknownMembers.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800">
                    <span>⚠️</span> Unrecognized Server Names ({unknownMembers.length})
                  </div>
                  <p className="text-[11px] text-amber-700">
                    Match unrecognized names from CSV to active members in your roster:
                  </p>
                  <div className="max-h-36 overflow-y-auto space-y-2 pr-1">
                    {unknownMembers.map(name => (
                      <div key={name} className="flex items-center justify-between gap-2 text-xs bg-white p-2 rounded-lg border border-amber-200 shadow-2xs">
                        <span className="font-semibold text-gray-800 truncate max-w-[200px]">{name}</span>
                        <select
                          value={manualMemberMap[name] || ''}
                          onChange={(e) => handleManualMapChange(name, e.target.value)}
                          className="text-xs border border-gray-300 rounded-md p-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 max-w-[220px]"
                        >
                          <option value="">-- Ignore / Skip --</option>
                          {activeMembers.map(m => (
                            <option key={m.id} value={m.id}>
                              {getFullName(m)}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Slot assignment preview list */}
              {importedSlots.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-gray-700">Extracted Schedule Slots ({importedSlots.length})</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedSlotKeys.length === importedSlots.length) {
                          setSelectedSlotKeys([])
                        } else {
                          setSelectedSlotKeys(importedSlots.map(s => s.key))
                        }
                      }}
                      className="text-blue-600 hover:text-blue-700 font-semibold cursor-pointer"
                    >
                      {selectedSlotKeys.length === importedSlots.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>

                  <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                    {importedSlots.map(slot => {
                      const isSelected = selectedSlotKeys.includes(slot.key)
                      const existing = templates.find(t => 
                        t.title.toLowerCase() === slot.title.toLowerCase() &&
                        t.dayOfWeek.toLowerCase() === slot.dayOfWeek.toLowerCase() &&
                        t.startTime === slot.startTime &&
                        t.endTime === slot.endTime
                      )

                      return (
                        <div
                          key={slot.key}
                          onClick={() => toggleSlotSelection(slot.key)}
                          className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                            isSelected 
                              ? 'border-blue-300 bg-blue-50/30 shadow-2xs' 
                              : 'border-gray-200 bg-white opacity-70'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}} // Handled by container onClick
                                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                              />
                              <div>
                                <span className="font-bold text-gray-900">{slot.title}</span>
                                <span className="text-[11px] text-gray-500 ml-2">
                                  ({slot.dayOfWeek} | {formatTime12(slot.startTime)} - {formatTime12(slot.endTime)})
                                </span>
                              </div>
                            </div>
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                              existing ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'
                            }`}>
                              {existing ? 'Updates Existing Template' : 'New Template'}
                            </span>
                          </div>

                          <div className="mt-2 text-[11px] text-gray-600 pl-6">
                            <span className="font-semibold text-gray-700">Servers found ({slot.assignedMemberIds.length}): </span>
                            {slot.assignedMemberNames.length > 0 ? (
                              <span>{slot.assignedMemberNames.join(', ')}</span>
                            ) : (
                              <span className="italic text-gray-400">None detected</span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-gray-100 bg-white">
                <button
                  type="button"
                  onClick={() => setMode('list')}
                  className="rounded-lg border border-gray-200 bg-white hover:bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-700 hover:text-gray-900 transition-colors cursor-pointer shadow-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApplyCSVToTemplates}
                  disabled={importingCSV || importedSlots.length === 0 || selectedSlotKeys.length === 0}
                  className="rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-4.5 py-2 text-xs font-bold text-white transition-colors cursor-pointer shadow-sm"
                >
                  {importingCSV ? 'Applying...' : 'Apply Assignments to Templates'}
                </button>
              </div>
            </div>
          )}

          {/* Audit Report Mode */}
          {mode === 'report' && generationReport && (
            <div className="space-y-5">
              {/* Success Banner */}
              <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/60 flex items-center gap-3.5 shadow-2xs">
                <div className="p-2 bg-emerald-100 border border-emerald-200 rounded-lg text-emerald-600 shrink-0">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-emerald-900">Generation Complete</h4>
                  <p className="text-xs text-emerald-700 font-medium mt-0.5">
                    Recurring schedules have been successfully processed for your selected date range.
                  </p>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="space-y-2">
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Summary Statistics
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-xl border border-gray-200 bg-white shadow-2xs space-y-1 text-center">
                    <span className="text-xs font-semibold text-gray-500 block">Created</span>
                    <span className="text-xl font-extrabold text-emerald-600 block">{generationReport.created}</span>
                  </div>
                  <div className="p-3.5 rounded-xl border border-gray-200 bg-white shadow-2xs space-y-1 text-center">
                    <span className="text-xs font-semibold text-gray-500 block">Duplicates</span>
                    <span className="text-xl font-extrabold text-amber-600 block">{generationReport.duplicates}</span>
                  </div>
                  <div className="p-3.5 rounded-xl border border-gray-200 bg-white shadow-2xs space-y-1 text-center">
                    <span className="text-xs font-semibold text-gray-500 block">Skipped</span>
                    <span className="text-xl font-extrabold text-slate-600 block">{generationReport.skipped}</span>
                  </div>
                </div>
              </div>

              {/* Conflict Warnings */}
              {generationReport.validationErrors.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[10px] font-bold text-red-600 uppercase tracking-wider flex items-center gap-1">
                    <svg className="w-3.5 h-3.5 text-red-500 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    Validation Warnings ({generationReport.validationErrors.length})
                  </div>
                  <div className="max-h-32 overflow-y-auto border border-red-200 bg-red-50/40 rounded-xl p-3 space-y-1 text-xs">
                    {generationReport.validationErrors.map((errorStr: string, index: number) => (
                      <div key={index} className="text-red-700 leading-relaxed flex items-start gap-1.5">
                        <span className="text-red-400 font-bold">•</span>
                        <span>{errorStr}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action */}
              <div className="flex justify-end pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setMode('list')}
                  className="rounded-lg bg-blue-600 hover:bg-blue-500 px-5 py-2 text-xs font-bold text-white transition-colors cursor-pointer shadow-sm"
                >
                  Done
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
