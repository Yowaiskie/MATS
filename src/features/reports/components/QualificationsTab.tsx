import React, { useState, useEffect, useMemo, useRef } from 'react'
import type { Member } from '@/types/member'
import { ORDER_GROUPS, getOrderBadgeStyle } from '@/types/member'
import type { Schedule } from '@/types/schedule'
import type { AttendanceRecord } from '@/types/attendance'
import type { 
  QualificationPreset, 
  CategoryRule, 
  MemberQualificationResult,
  ScheduleCategoryKey 
} from '@/types/attendanceCategory'
import { 
  SCHEDULE_CATEGORIES, 
  DEFAULT_QUALIFICATION_PRESETS 
} from '@/types/attendanceCategory'
import { qualificationService } from '@/services/qualificationService'
import { settingsService } from '@/services/settingsService'
import { getFullName } from '@/utils/member'
import { AlertModal, ConfirmModal } from '@/components/Dialog'
import { ActionMenu, FilterDropdown } from '@/components'
import { QualificationsExportModal } from './QualificationsExportModal'

interface QualificationsTabProps {
  members: Member[]
  schedules: Schedule[]
  attendanceRecords: AttendanceRecord[]
  startDate: string
  endDate: string
  onDateChange: (start: string, end: string) => void
  userRole?: string
  canExport?: boolean
}

export const QualificationsTab: React.FC<QualificationsTabProps> = ({
  members,
  schedules,
  attendanceRecords,
  startDate,
  endDate,
  onDateChange,
  canExport = true
}) => {
  // Preset state
  const [presets, setPresets] = useState<QualificationPreset[]>(DEFAULT_QUALIFICATION_PRESETS)
  const [selectedPresetId, setSelectedPresetId] = useState<string>('preset-annual-renewal')
  const [activeRules, setActiveRules] = useState<CategoryRule[]>(DEFAULT_QUALIFICATION_PRESETS[0].rules)

  // Custom Dropdown Open States
  const [isPresetDropdownOpen, setIsPresetDropdownOpen] = useState(false)
  const [isAddRuleDropdownOpen, setIsAddRuleDropdownOpen] = useState(false)
  const presetDropdownRef = useRef<HTMLDivElement>(null)
  const addRuleDropdownRef = useRef<HTMLDivElement>(null)

  // Filters state
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'qualified' | 'deficient'>('all')
  const [selectedOrder, setSelectedOrder] = useState<string>('all')
  const [selectedMemberModal, setSelectedMemberModal] = useState<MemberQualificationResult | null>(null)

  // Modals state
  const [showExportModal, setShowExportModal] = useState(false)
  const [showSavePresetModal, setShowSavePresetModal] = useState(false)
  const [showEditPresetModal, setShowEditPresetModal] = useState(false)
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false)

  // Preset form state
  const [presetNameInput, setPresetNameInput] = useState('')
  const [presetDescInput, setPresetDescInput] = useState('')
  const [isSavingPreset, setIsSavingPreset] = useState(false)

  // Alerts
  const [alertModal, setAlertModal] = useState<{ title: string; message: string; variant?: 'info' | 'error' | 'success' } | null>(null)

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (presetDropdownRef.current && !presetDropdownRef.current.contains(e.target as Node)) {
        setIsPresetDropdownOpen(false)
      }
      if (addRuleDropdownRef.current && !addRuleDropdownRef.current.contains(e.target as Node)) {
        setIsAddRuleDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Load saved presets from settingsService
  useEffect(() => {
    const fetchPresets = async () => {
      try {
        const list = await settingsService.getQualificationPresets()
        setPresets(list)
        if (list.length > 0) {
          const matched = list.find(p => p.id === selectedPresetId) || list[0]
          setSelectedPresetId(matched.id)
          setActiveRules(matched.rules)
        }
      } catch (err) {
        console.warn('Failed to load qualification presets:', err)
      }
    }
    fetchPresets()
  }, [])

  const activePreset = useMemo(() => {
    return presets.find(p => p.id === selectedPresetId) || presets[0]
  }, [presets, selectedPresetId])

  // Check if active rules differ from the selected preset's saved rules
  const hasUnsavedRuleChanges = useMemo(() => {
    if (!activePreset) return false
    if (activeRules.length !== activePreset.rules.length) return true
    for (const rule of activeRules) {
      const saved = activePreset.rules.find(r => r.category === rule.category)
      if (!saved || saved.minRate !== rule.minRate) return true
    }
    return false
  }, [activeRules, activePreset])

  // When preset selection changes, load its rules
  const handleSelectPreset = (presetId: string) => {
    setSelectedPresetId(presetId)
    setIsPresetDropdownOpen(false)
    const matched = presets.find(p => p.id === presetId)
    if (matched) {
      setActiveRules([...matched.rules])
    }
  }

  // Update rule threshold on the fly with clamped integer
  const handleUpdateRuleRate = (ruleId: string, minRate: number) => {
    const clamped = Math.max(0, Math.min(100, minRate))
    setActiveRules(prev =>
      prev.map(r => (r.id === ruleId ? { ...r, minRate: clamped } : r))
    )
  }

  const handleAddRule = (category: ScheduleCategoryKey | 'all') => {
    setIsAddRuleDropdownOpen(false)
    if (activeRules.some(r => r.category === category)) return
    const newRule: CategoryRule = {
      id: `rule-${Date.now()}`,
      category,
      minRate: 60,
      required: true
    }
    setActiveRules(prev => [...prev, newRule])
  }

  const handleRemoveRule = (ruleId: string) => {
    setActiveRules(prev => prev.filter(r => r.id !== ruleId))
  }

  // Reset rules back to active preset default
  const handleResetRules = () => {
    if (activePreset) {
      setActiveRules([...activePreset.rules])
    }
  }

  // Update active preset with currently active rules
  const handleUpdateCurrentPresetRules = async () => {
    if (!activePreset) return
    setIsSavingPreset(true)
    try {
      const updatedPresets = presets.map(p =>
        p.id === activePreset.id ? { ...p, rules: activeRules } : p
      )
      await settingsService.saveQualificationPresets(updatedPresets)
      setPresets(updatedPresets)
      setAlertModal({
        title: 'Preset Updated',
        message: `Qualification rules for "${activePreset.name}" have been updated successfully.`,
        variant: 'success'
      })
    } catch (err: any) {
      setAlertModal({
        title: 'Update Failed',
        message: err.message || 'Failed to update preset rules.',
        variant: 'error'
      })
    } finally {
      setIsSavingPreset(false)
    }
  }

  // Open Edit Preset Info Modal
  const handleOpenEditPresetModal = () => {
    if (!activePreset) return
    setPresetNameInput(activePreset.name)
    setPresetDescInput(activePreset.description || '')
    setShowEditPresetModal(true)
  }

  // Save edited preset info (name & description)
  const handleSaveEditPresetInfo = async () => {
    if (!presetNameInput.trim()) {
      setAlertModal({
        title: 'Preset Name Required',
        message: 'Please enter a name for the criteria preset.',
        variant: 'error'
      })
      return
    }

    setIsSavingPreset(true)
    try {
      const updatedPresets = presets.map(p =>
        p.id === activePreset?.id
          ? {
              ...p,
              name: presetNameInput.trim(),
              description: presetDescInput.trim() || undefined,
              rules: activeRules
            }
          : p
      )
      await settingsService.saveQualificationPresets(updatedPresets)
      setPresets(updatedPresets)
      setShowEditPresetModal(false)
      setAlertModal({
        title: 'Preset Updated',
        message: 'Preset details have been saved successfully.',
        variant: 'success'
      })
    } catch (err: any) {
      setAlertModal({
        title: 'Save Failed',
        message: err.message || 'Failed to save preset details.',
        variant: 'error'
      })
    } finally {
      setIsSavingPreset(false)
    }
  }

  // Delete current preset
  const handleDeletePreset = async () => {
    if (!activePreset) return
    if (presets.length <= 1) {
      setAlertModal({
        title: 'Cannot Delete',
        message: 'You must have at least one criteria preset available.',
        variant: 'error'
      })
      return
    }

    setIsSavingPreset(true)
    try {
      const updated = presets.filter(p => p.id !== activePreset.id)
      const fallback = updated[0] || DEFAULT_QUALIFICATION_PRESETS[0]
      await settingsService.saveQualificationPresets(updated)
      setPresets(updated)
      setSelectedPresetId(fallback.id)
      setActiveRules(fallback.rules)
      setShowDeleteConfirmModal(false)
      setAlertModal({
        title: 'Preset Deleted',
        message: `Preset "${activePreset.name}" has been removed.`,
        variant: 'success'
      })
    } catch (err: any) {
      setAlertModal({
        title: 'Delete Failed',
        message: err.message || 'Failed to delete preset.',
        variant: 'error'
      })
    } finally {
      setIsSavingPreset(false)
    }
  }

  // Save active rules as a new preset
  const handleSaveNewCustomPreset = async () => {
    if (!presetNameInput.trim()) {
      setAlertModal({
        title: 'Preset Name Required',
        message: 'Please enter a name for this criteria preset.',
        variant: 'error'
      })
      return
    }

    const newPreset: QualificationPreset = {
      id: `preset-${Date.now()}`,
      name: presetNameInput.trim(),
      description: presetDescInput.trim() || undefined,
      rules: activeRules,
      isSystemDefault: false
    }

    setIsSavingPreset(true)
    try {
      const updated = [...presets, newPreset]
      await settingsService.saveQualificationPresets(updated)
      setPresets(updated)
      setSelectedPresetId(newPreset.id)
      setShowSavePresetModal(false)
      setPresetNameInput('')
      setPresetDescInput('')
      setAlertModal({
        title: 'Preset Saved',
        message: `Criteria preset "${newPreset.name}" has been created successfully.`,
        variant: 'success'
      })
    } catch (err: any) {
      setAlertModal({
        title: 'Save Failed',
        message: err.message || 'Failed to save preset.',
        variant: 'error'
      })
    } finally {
      setIsSavingPreset(false)
    }
  }

  // Calculate evaluation results across active members
  const evaluationResults = useMemo<MemberQualificationResult[]>(() => {
    return qualificationService.evaluateMembers(
      members,
      schedules,
      attendanceRecords,
      activeRules,
      selectedOrder
    )
  }, [members, schedules, attendanceRecords, activeRules, selectedOrder])

  // Filter evaluation results by search and status
  const filteredResults = useMemo(() => {
    return evaluationResults.filter(res => {
      const name = getFullName(res.member).toLowerCase()
      const matchesSearch = !searchQuery.trim() || name.includes(searchQuery.toLowerCase().trim())
      
      let matchesStatus = true
      if (statusFilter === 'qualified') matchesStatus = res.isQualified
      if (statusFilter === 'deficient') matchesStatus = !res.isQualified

      return matchesSearch && matchesStatus
    })
  }, [evaluationResults, searchQuery, statusFilter])

  // Aggregate Metrics
  const metrics = useMemo(() => {
    const total = evaluationResults.length
    const qualified = evaluationResults.filter(r => r.isQualified).length
    const deficient = total - qualified
    const qualifiedPct = total > 0 ? Math.round((qualified / total) * 100) : 0

    // Average Formation rate
    let totalFormationRate = 0
    let formationCount = 0
    evaluationResults.forEach(r => {
      const ogf = r.categoryStats['formation']
      if (ogf && ogf.totalHeld > 0) {
        totalFormationRate += ogf.rate
        formationCount++
      }
    })
    const avgOgfRate = formationCount > 0 ? (totalFormationRate / formationCount).toFixed(1) : 'N/A'

    return {
      total,
      qualified,
      deficient,
      qualifiedPct,
      avgOgfRate
    }
  }, [evaluationResults])

  // Export CSV
  const handleExportCsv = () => {
    const headers = ['Name', 'Rank', 'Order', 'OGF Rate %', 'OGF Attended', 'OGF Total', 'Meeting Rate %', 'Meeting Attended', 'Meeting Total', 'Sunday Rate %', 'Overall Rate %', 'Qualified Status', 'Deficiencies']
    const rows = filteredResults.map(r => {
      const ogf = r.categoryStats['formation']
      const mtg = r.categoryStats['meeting']
      const sun = r.categoryStats['mass_sunday']

      return [
        `"${getFullName(r.member)}"`,
        `"${r.member.rank || ''}"`,
        `"${r.member.order || ''}"`,
        ogf ? ogf.rate.toFixed(1) : '',
        ogf ? ogf.present : '',
        ogf ? ogf.totalHeld : '',
        mtg ? mtg.rate.toFixed(1) : '',
        mtg ? mtg.present : '',
        mtg ? mtg.totalHeld : '',
        sun ? sun.rate.toFixed(1) : '',
        r.overallRate.toFixed(1),
        r.isQualified ? 'QUALIFIED' : 'DEFICIENT',
        `"${r.deficiencies.join('; ')}"`
      ]
    })

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `MATS_Renewal_Qualification_${startDate}_to_${endDate}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-6">
      {/* ── 1. PRESET & CRITERIA BUILDER CARD ──────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-sm space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-lg border border-indigo-100">
                Evaluation Criteria Engine
              </span>
              <span className="text-xs font-bold text-slate-400">
                • Real-time Renewal & Promotion Qualification
              </span>
            </div>
            <h2 className="text-base font-black text-slate-900">
              Attendance Categories & Renewal Criteria
            </h2>
          </div>

          {/* Preset Selector & Action Toolbar */}
          <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto">
            {/* Custom Modern Dropdown Trigger */}
            <div className="relative w-full sm:w-auto" ref={presetDropdownRef}>
              <div className="flex items-center justify-between sm:justify-start bg-slate-50 border border-slate-200/90 rounded-2xl p-1 shadow-2xs gap-1 w-full sm:w-auto">
                <span className="text-xs font-black text-slate-500 pl-2 pr-1 shrink-0">Preset:</span>
                
                <button
                  type="button"
                  onClick={() => setIsPresetDropdownOpen(prev => !prev)}
                  className="flex-1 sm:flex-initial flex items-center justify-between gap-2.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-800 px-3 py-1.5 rounded-xl shadow-2xs text-xs font-extrabold transition-all cursor-pointer min-w-0 sm:min-w-[200px]"
                >
                  <span className="truncate max-w-[140px] sm:max-w-[190px]">
                    {activePreset?.name || 'Select Preset'}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${
                      activePreset?.isSystemDefault 
                        ? 'bg-slate-100 text-slate-500 border border-slate-200' 
                        : 'bg-purple-50 text-purple-700 border border-purple-200'
                    }`}>
                      {activePreset?.isSystemDefault ? 'System' : 'Custom'}
                    </span>
                    <svg
                      className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                        isPresetDropdownOpen ? 'rotate-180 text-indigo-600' : ''
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {/* Preset Options Meatball Menu */}
                <ActionMenu
                  triggerVariant="meatball"
                  size="sm"
                  ariaLabel="Preset actions"
                  items={[
                    {
                      label: 'Edit Preset Details',
                      description: 'Update criteria, name & active rules',
                      icon: (
                        <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      ),
                      onClick: handleOpenEditPresetModal
                    },
                    {
                      label: 'Delete Preset',
                      description: 'Permanently remove this preset',
                      variant: 'danger',
                      hidden: presets.length <= 1,
                      icon: (
                        <svg className="w-4 h-4 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      ),
                      onClick: () => setShowDeleteConfirmModal(true)
                    }
                  ]}
                />
              </div>

              {/* Custom Floating Dropdown Menu */}
              {isPresetDropdownOpen && (
                <div className="absolute left-0 top-full mt-2 w-[calc(100vw-3rem)] max-w-xs sm:w-80 bg-white rounded-2xl border border-slate-200 shadow-xl z-30 p-2 space-y-1 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Saved Qualification Presets
                  </div>
                  <div className="max-h-60 overflow-y-auto space-y-1">
                    {presets.map(p => {
                      const isSelected = p.id === selectedPresetId
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleSelectPreset(p.id)}
                          className={`w-full text-left p-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-between gap-2 ${
                            isSelected
                              ? 'bg-indigo-50/80 border border-indigo-200/80 text-indigo-950 font-black'
                              : 'hover:bg-slate-50 text-slate-700 font-bold'
                          }`}
                        >
                          <div className="truncate">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs truncate">{p.name}</span>
                              <span className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded shrink-0 ${
                                p.isSystemDefault
                                  ? 'bg-slate-100 text-slate-500'
                                  : 'bg-purple-100 text-purple-700'
                              }`}>
                                {p.isSystemDefault ? 'System' : 'Custom'}
                              </span>
                            </div>
                            {p.description && (
                              <p className="text-[10px] text-slate-400 font-medium truncate mt-0.5">
                                {p.description}
                              </p>
                            )}
                          </div>
                          {isSelected && (
                            <svg className="w-4 h-4 text-indigo-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Prominent Update Preset Button (Shows whenever rules differ from saved) */}
            {hasUnsavedRuleChanges && (
              <div className="flex items-center gap-1.5 animate-in fade-in duration-200 w-full sm:w-auto justify-end sm:justify-start">
                <button
                  type="button"
                  onClick={handleUpdateCurrentPresetRules}
                  disabled={isSavingPreset}
                  className="flex-1 sm:flex-initial justify-center px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-black transition-all cursor-pointer shadow-md shadow-emerald-600/20 flex items-center gap-1.5"
                  title="Save and update threshold criteria to the active preset"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Update Preset</span>
                </button>

                <button
                  type="button"
                  onClick={handleResetRules}
                  className="px-3 py-2 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-2xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
                  title="Discard changes and revert to preset saved values"
                >
                  Reset
                </button>
              </div>
            )}

            {/* Save as New Preset Button */}
            <button
              type="button"
              onClick={() => {
                setPresetNameInput('')
                setPresetDescInput('')
                setShowSavePresetModal(true)
              }}
              className="w-full sm:w-auto justify-center px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-2xl text-xs font-black transition-all cursor-pointer shrink-0 shadow-2xs flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              <span>+ Save as New Preset</span>
            </button>
          </div>
        </div>

        {/* Date Range Selector & Category Rules Strip */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Date Range Picker */}
          <div className="lg:col-span-4 bg-slate-50/70 p-4 rounded-2xl border border-slate-200/80 space-y-2">
            <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              Evaluation Date Range
            </span>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[9px] font-bold text-slate-500">From</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => onDateChange(e.target.value, endDate)}
                  className="w-full text-xs font-bold p-2 border border-slate-200 rounded-xl bg-white focus:border-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-[9px] font-bold text-slate-500">To</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => onDateChange(startDate, e.target.value)}
                  className="w-full text-xs font-bold p-2 border border-slate-200 rounded-xl bg-white focus:border-indigo-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Active Rules Badges */}
          <div className="lg:col-span-8 bg-slate-50/70 p-4 rounded-2xl border border-slate-200/80 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                Active Criteria Rules (Type threshold 0-100% to edit)
              </span>

              {/* Custom Add Category Rule Dropdown */}
              <div className="relative self-start sm:self-auto" ref={addRuleDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsAddRuleDropdownOpen(prev => !prev)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 text-xs font-black rounded-xl shadow-2xs transition-all cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Add Category Rule</span>
                  <svg className={`w-3 h-3 text-slate-400 transition-transform ${isAddRuleDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {isAddRuleDropdownOpen && (
                  <div className="absolute right-0 top-full mt-2 w-[calc(100vw-3rem)] max-w-xs sm:w-64 bg-white rounded-2xl border border-slate-200 shadow-xl z-30 p-1.5 space-y-0.5 max-h-72 overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
                    <button
                      type="button"
                      disabled={activeRules.some(r => r.category === 'all')}
                      onClick={() => handleAddRule('all')}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:bg-indigo-50 hover:text-indigo-700 text-slate-800"
                    >
                      Overall Attendance
                    </button>
                    {SCHEDULE_CATEGORIES.map(c => {
                      const isAlreadyAdded = activeRules.some(r => r.category === c.key)
                      return (
                        <button
                          key={c.key}
                          type="button"
                          disabled={isAlreadyAdded}
                          onClick={() => handleAddRule(c.key)}
                          className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:bg-indigo-50 hover:text-indigo-700 text-slate-800 flex items-center justify-between"
                        >
                          <span>{c.label}</span>
                          {isAlreadyAdded && <span className="text-[10px] text-slate-400 font-semibold">Added</span>}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Threshold Badges */}
            <div className="flex flex-wrap gap-2 pt-1">
              {activeRules.map(rule => {
                const catMeta = SCHEDULE_CATEGORIES.find(c => c.key === rule.category)
                const label = rule.category === 'all' ? 'Overall' : (catMeta?.shortLabel || rule.category)
                return (
                  <div
                    key={rule.id}
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200/90 rounded-2xl shadow-2xs text-xs font-bold text-slate-800"
                  >
                    <span className="text-slate-600 font-extrabold">{label}:</span>
                    
                    {/* Clean Clamped Type-in Input */}
                    <div className="flex items-center gap-1 bg-indigo-50/70 border border-indigo-200/80 rounded-lg px-2 py-0.5">
                      <span className="text-indigo-600 font-black text-[11px]">Min</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={rule.minRate ?? 0}
                        onChange={e => {
                          const val = e.target.value.replace(/\D/g, '')
                          const num = val === '' ? 0 : Math.min(100, Math.max(0, parseInt(val, 10)))
                          handleUpdateRuleRate(rule.id, num)
                        }}
                        className="w-10 text-xs font-black text-center bg-white rounded border border-indigo-200 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-indigo-900 shadow-2xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <span className="text-indigo-600 font-bold text-xs">%</span>
                    </div>

                    {activeRules.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveRule(rule.id)}
                        className="text-slate-400 hover:text-rose-600 font-bold ml-1 cursor-pointer transition-colors p-0.5 rounded-lg hover:bg-rose-50"
                        title="Remove Rule"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. KPI METRICS SUMMARY CARDS ───────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-1">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Total Evaluated</span>
          <div className="text-xl sm:text-2xl font-black text-slate-900">{metrics.total}</div>
          <span className="text-[10px] font-bold text-slate-500">Altar Servers</span>
        </div>

        <div className="bg-emerald-50/60 p-4 sm:p-5 rounded-2xl border border-emerald-200 shadow-2xs space-y-1">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">Qualified Servers</span>
          <div className="text-xl sm:text-2xl font-black text-emerald-900 flex items-baseline gap-2">
            <span>{metrics.qualified}</span>
            <span className="text-xs font-extrabold text-emerald-600">({metrics.qualifiedPct}%)</span>
          </div>
          <span className="text-[10px] font-bold text-emerald-700">Passed All Category Rules</span>
        </div>

        <div className="bg-rose-50/60 p-4 sm:p-5 rounded-2xl border border-rose-200 shadow-2xs space-y-1">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-700">Deficient / Below Target</span>
          <div className="text-xl sm:text-2xl font-black text-rose-900 flex items-baseline gap-2">
            <span>{metrics.deficient}</span>
            <span className="text-xs font-extrabold text-rose-600">({100 - metrics.qualifiedPct}%)</span>
          </div>
          <span className="text-[10px] font-bold text-rose-700">Requires Makeup / Review</span>
        </div>

        <div className="bg-purple-50/60 p-4 sm:p-5 rounded-2xl border border-purple-200 shadow-2xs space-y-1">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-700">Avg Formation (OGF) Rate</span>
          <div className="text-xl sm:text-2xl font-black text-purple-900">
            {metrics.avgOgfRate !== 'N/A' ? `${metrics.avgOgfRate}%` : 'N/A'}
          </div>
          <span className="text-[10px] font-bold text-purple-700">Across All Active Servers</span>
        </div>
      </div>

      {/* ── 3. ROSTER CONTROLS, SEARCH, DROPDOWN FILTERS & EXPORT ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1">
          {/* Search Bar */}
          <div className="relative flex-1 min-w-[180px]">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search server name..."
              className="w-full h-10 pl-9 pr-3 text-xs font-semibold border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition text-slate-800 placeholder-slate-400"
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </div>
          </div>

          {/* Order Dropdown */}
          <div className="w-full sm:w-52 shrink-0">
            <FilterDropdown
              value={selectedOrder}
              onChange={(val) => setSelectedOrder(val)}
              allLabel="All Orders / Groups"
              options={[
                { key: 'all', label: 'All Orders / Groups', dot: 'bg-slate-400' },
                ...ORDER_GROUPS.map(grp => ({
                  key: grp,
                  label: grp,
                  dot: 'bg-purple-500'
                }))
              ]}
            />
          </div>

          {/* Status Dropdown */}
          <div className="w-full sm:w-52 shrink-0">
            <FilterDropdown
              value={statusFilter}
              onChange={(val) => setStatusFilter(val as any)}
              allLabel="All Statuses"
              options={[
                { 
                  key: 'all', 
                  label: 'All Statuses', 
                  dot: 'bg-slate-400',
                  count: evaluationResults.length 
                },
                { 
                  key: 'qualified', 
                  label: 'Qualified', 
                  dot: 'bg-emerald-500',
                  count: metrics.qualified 
                },
                { 
                  key: 'deficient', 
                  label: 'Deficient / Makeup', 
                  dot: 'bg-rose-500',
                  count: metrics.deficient 
                }
              ]}
            />
          </div>
        </div>

        {/* Export Buttons */}
        {canExport && (
          <div className="shrink-0 self-end sm:self-auto">
            <ActionMenu
              triggerVariant="button"
              triggerLabel="Export"
              size="sm"
              ariaLabel="Export options"
              items={[
                {
                  label: 'Export PDF Report',
                  description: 'Official formatted evaluation sheet with signatures',
                  icon: (
                    <svg className="w-4 h-4 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  ),
                  onClick: () => setShowExportModal(true)
                },
                {
                  label: 'Export CSV Spreadsheet',
                  description: 'Tabular data for Excel or spreadsheet analysis',
                  icon: (
                    <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                    </svg>
                  ),
                  onClick: handleExportCsv
                }
              ]}
            />
          </div>
        )}
      </div>

      {/* ── 4. EVALUATION ROSTER TABLE ─────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-[10px] font-black uppercase tracking-wider text-slate-500">
                <th className="py-3.5 px-4 w-10">#</th>
                <th className="py-3.5 px-4">Altar Server Name</th>
                <th className="py-3.5 px-4">Rank & Order</th>
                <th className="py-3.5 px-4 text-center">Formation (OGF)</th>
                <th className="py-3.5 px-4 text-center">Monthly Meetings</th>
                <th className="py-3.5 px-4 text-center">Sunday Masses</th>
                <th className="py-3.5 px-4 text-center">Overall Rate</th>
                <th className="py-3.5 px-4 text-center">Qualification Status</th>
                <th className="py-3.5 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-semibold">
              {filteredResults.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 italic font-medium">
                    No altar servers matched the selected criteria filters.
                  </td>
                </tr>
              ) : (
                filteredResults.map((row, idx) => {
                  const ogf = row.categoryStats['formation']
                  const mtg = row.categoryStats['meeting']
                  const sun = row.categoryStats['mass_sunday']

                  return (
                    <tr
                      key={row.member.id}
                      onClick={() => setSelectedMemberModal(row)}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                    >
                      <td className="py-3 px-4 text-slate-400 text-[11px] font-bold">
                        {idx + 1}
                      </td>

                      <td className="py-3 px-4 font-black text-slate-900">
                        <div className="flex items-center gap-2">
                          <span>{getFullName(row.member)}</span>
                          {row.member.status === 'suspended' && (
                            <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                              SUSPENDED
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-slate-600">
                            {row.member.rank || 'Altar Server'}
                          </span>
                          {row.member.order && (
                            <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${getOrderBadgeStyle(row.member.order)}`}>
                              {row.member.order}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Formation (OGF) Progress */}
                      <td className="py-3 px-4 text-center">
                        {ogf && ogf.totalHeld > 0 ? (
                          <div className="inline-flex flex-col items-center">
                            <span className={`text-xs font-black ${ogf.meetsRule ? 'text-purple-700' : 'text-rose-600'}`}>
                              {ogf.rate.toFixed(0)}%
                            </span>
                            <span className="text-[10px] text-slate-400 font-bold">
                              {ogf.present}/{ogf.totalHeld} sessions
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-300 font-bold">-</span>
                        )}
                      </td>

                      {/* Meeting Progress */}
                      <td className="py-3 px-4 text-center">
                        {mtg && mtg.totalHeld > 0 ? (
                          <div className="inline-flex flex-col items-center">
                            <span className={`text-xs font-black ${mtg.meetsRule ? 'text-blue-700' : 'text-rose-600'}`}>
                              {mtg.rate.toFixed(0)}%
                            </span>
                            <span className="text-[10px] text-slate-400 font-bold">
                              {mtg.present}/{mtg.totalHeld} sessions
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-300 font-bold">-</span>
                        )}
                      </td>

                      {/* Sunday Mass Progress */}
                      <td className="py-3 px-4 text-center">
                        {sun && sun.totalHeld > 0 ? (
                          <div className="inline-flex flex-col items-center">
                            <span className={`text-xs font-black ${sun.meetsRule ? 'text-emerald-700' : 'text-rose-600'}`}>
                              {sun.rate.toFixed(0)}%
                            </span>
                            <span className="text-[10px] text-slate-400 font-bold">
                              {sun.present} attended
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-300 font-bold">-</span>
                        )}
                      </td>

                      {/* Overall Rate */}
                      <td className="py-3 px-4 text-center font-black text-slate-800">
                        {row.overallRate.toFixed(1)}%
                      </td>

                      {/* Qualification Status Badge */}
                      <td className="py-3 px-4 text-center">
                        {row.isQualified ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-xl text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                            QUALIFIED
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center px-2.5 py-1 rounded-xl text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200"
                            title={row.deficiencies.join(', ')}
                          >
                            DEFICIENT ({row.passedRulesCount}/{row.totalRulesCount})
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedMemberModal(row)
                          }}
                          className="px-2.5 py-1 text-[11px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors cursor-pointer"
                        >
                          Breakdown →
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 5. MEMBER DETAIL BREAKDOWN MODAL ────────────────────────── */}
      {selectedMemberModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setSelectedMemberModal(null)} />
          <div className="relative w-full max-w-2xl bg-white rounded-3xl border border-slate-200 p-6 shadow-2xl z-10 space-y-5 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-extrabold text-indigo-600 uppercase tracking-wider">
                  Member Category Evaluation
                </span>
                <h3 className="text-lg font-black text-slate-900">
                  {getFullName(selectedMemberModal.member)}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedMemberModal(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Status Summary Banner */}
            <div className={`p-4 rounded-2xl border ${
              selectedMemberModal.isQualified ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider">
                  {selectedMemberModal.isQualified ? 'STATUS: QUALIFIED FOR RENEWAL' : 'STATUS: ACTION / MAKEUP NEEDED'}
                </span>
                <span className="text-sm font-black">Overall: {selectedMemberModal.overallRate.toFixed(1)}%</span>
              </div>
              {selectedMemberModal.deficiencies.length > 0 && (
                <div className="mt-2 text-xs font-bold text-rose-800 space-y-0.5">
                  <span className="block font-black">Criteria Deficiencies:</span>
                  {selectedMemberModal.deficiencies.map((d, i) => (
                    <div key={i}>• {d}</div>
                  ))}
                </div>
              )}
            </div>

            {/* Category breakdown cards */}
            <div className="space-y-3">
              <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                Category-by-Category Summary
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Object.values(selectedMemberModal.categoryStats).filter(s => s.category !== 'all').map(stat => (
                  <div key={stat.category} className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800">{stat.categoryLabel}</span>
                      <span className={`text-xs font-black ${stat.meetsRule ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {stat.rate.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                      <span>Present: {stat.present} | Late: {stat.late} | Absent: {stat.absent}</span>
                      <span>{stat.present}/{stat.totalHeld} held</span>
                    </div>
                    {stat.targetRate && (
                      <div className="text-[10px] text-slate-400 font-bold">
                        Target Threshold: {stat.targetRate}% {stat.meetsRule ? '✓ Met' : '✗ Below Target'}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedMemberModal(null)}
                className="px-5 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 6. SAVE AS NEW PRESET MODAL ────────────────────────────────────── */}
      {showSavePresetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowSavePresetModal(false)} />
          <div className="relative w-full max-w-md bg-white rounded-3xl border border-slate-200 p-6 shadow-2xl z-10 space-y-4">
            <div>
              <span className="text-[10px] font-extrabold text-indigo-600 uppercase tracking-wider">Save Criteria Template</span>
              <h3 className="text-base font-black text-slate-900">New Qualification Preset</h3>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Preset Name *</label>
                <input
                  type="text"
                  value={presetNameInput}
                  onChange={e => setPresetNameInput(e.target.value)}
                  placeholder="e.g. Annual Renewal 2026 / Knights Investiture"
                  className="w-full text-xs font-bold p-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Description (Optional)</label>
                <textarea
                  value={presetDescInput}
                  onChange={e => setPresetDescInput(e.target.value)}
                  rows={2}
                  placeholder="Brief description of when to use this preset..."
                  className="w-full text-xs font-medium p-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowSavePresetModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveNewCustomPreset}
                disabled={isSavingPreset}
                className="px-5 py-2 text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs cursor-pointer disabled:opacity-50"
              >
                Save Preset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 7. EDIT PRESET INFO MODAL ─────────────────────────────────── */}
      {showEditPresetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowEditPresetModal(false)} />
          <div className="relative w-full max-w-md bg-white rounded-3xl border border-slate-200 p-6 shadow-2xl z-10 space-y-4">
            <div>
              <span className="text-[10px] font-extrabold text-indigo-600 uppercase tracking-wider">Edit Preset Details</span>
              <h3 className="text-base font-black text-slate-900">Update Preset Information</h3>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Preset Name *</label>
                <input
                  type="text"
                  value={presetNameInput}
                  onChange={e => setPresetNameInput(e.target.value)}
                  className="w-full text-xs font-bold p-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Description (Optional)</label>
                <textarea
                  value={presetDescInput}
                  onChange={e => setPresetDescInput(e.target.value)}
                  rows={2}
                  className="w-full text-xs font-medium p-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowEditPresetModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEditPresetInfo}
                disabled={isSavingPreset}
                className="px-5 py-2 text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs cursor-pointer disabled:opacity-50"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 8. DELETE PRESET CONFIRMATION MODAL ───────────────────────── */}
      {showDeleteConfirmModal && activePreset && (
        <ConfirmModal
          isOpen={showDeleteConfirmModal}
          title="Delete Qualification Preset"
          message={`Are you sure you want to delete the preset "${activePreset.name}"? This action cannot be undone.`}
          confirmLabel="Delete Preset"
          cancelLabel="Cancel"
          variant="danger"
          onConfirm={handleDeletePreset}
          onClose={() => setShowDeleteConfirmModal(false)}
        />
      )}

      {/* ── 9. DEDICATED QUALIFICATIONS PDF EXPORT MODAL ───────────────── */}
      {showExportModal && (
        <QualificationsExportModal
          isOpen={showExportModal}
          onClose={() => setShowExportModal(false)}
          results={filteredResults}
          dateRange={{ start: startDate, end: endDate }}
          presetName={activePreset?.name}
          activeRules={activeRules}
        />
      )}

      {/* ── 10. ALERT MODAL ───────────────────────────────────────────── */}
      {alertModal && (
        <AlertModal
          isOpen={!!alertModal}
          title={alertModal.title}
          message={alertModal.message}
          variant={alertModal.variant || 'info'}
          onClose={() => setAlertModal(null)}
        />
      )}
    </div>
  )
}
