import React, { useState, useEffect, useRef } from 'react'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { settingsService } from '@/services/settingsService'
import { memberService } from '@/services/memberService'
import type { SignaturePreset, SignatoryItem } from '@/types/signature'
import {
  COMMON_SIGNATURE_LABELS,
  DEFAULT_PARISH_NAME,
  DEFAULT_MINISTRY_NAME,
  DEFAULT_PARISH_PRIEST_NAME,
  DEFAULT_PARISH_PRIEST_TITLE,
  DEFAULT_COORDINATOR_NAME,
  DEFAULT_COORDINATOR_TITLE,
  DEFAULT_TREASURER_NAME,
  DEFAULT_TREASURER_TITLE,
  DEFAULT_SIGNATURE_PRESETS
} from '@/types/signature'
import type { Member } from '@/types/member'
import { useAuth } from '@/features/authentication/AuthContext'
import { ConfirmModal } from '@/components/Dialog'
import { MemberSearchDropdown } from '@/components/MemberSearchDropdown'

interface RoleSelectDropdownProps {
  value: string
  onChange: (val: string) => void
  onCustomMode: () => void
}

const RoleSelectDropdown: React.FC<RoleSelectDropdownProps> = ({
  value,
  onChange,
  onCustomMode
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  const isStandard = (COMMON_SIGNATURE_LABELS as readonly string[]).includes(value)
  const displayLabel = isStandard ? value : (value ? `Custom: ${value}` : 'Select Role...')

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`h-8 px-3 rounded-xl border bg-white flex items-center justify-between gap-2 text-xs font-bold transition shadow-2xs cursor-pointer select-none min-w-[170px] ${
          isOpen
            ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/30 text-indigo-950'
            : 'border-slate-200/90 text-slate-800 hover:border-indigo-300 hover:bg-slate-50/60'
        }`}
      >
        <div className="flex items-center gap-1.5 truncate">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 shrink-0" />
          <span className="truncate">{displayLabel}</span>
        </div>
        <svg
          className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-150 ${
            isOpen ? 'rotate-180 text-indigo-600' : ''
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 bg-white rounded-2xl border border-slate-200 shadow-xl z-50 p-1.5 min-w-[220px] max-h-64 overflow-y-auto space-y-0.5 animate-in fade-in zoom-in-95 duration-100">
          <div className="px-2.5 py-1 text-[10px] font-black text-slate-400 uppercase tracking-wider">
            Signatory Role
          </div>
          {COMMON_SIGNATURE_LABELS.map((lbl) => {
            const isSelected = value === lbl
            return (
              <button
                key={lbl}
                type="button"
                onClick={() => {
                  onChange(lbl)
                  setIsOpen(false)
                }}
                className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs flex items-center justify-between transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-indigo-50 text-indigo-950 font-bold'
                    : 'text-slate-700 hover:bg-slate-100 font-medium'
                }`}
              >
                <span>{lbl}</span>
                {isSelected && (
                  <svg className="w-3.5 h-3.5 text-indigo-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                )}
              </button>
            )
          })}
          <div className="border-t border-slate-100 pt-1 mt-1">
            <button
              type="button"
              onClick={() => {
                onCustomMode()
                setIsOpen(false)
              }}
              className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs flex items-center justify-between transition-colors cursor-pointer ${
                !isStandard
                  ? 'bg-indigo-50 text-indigo-950 font-bold'
                  : 'text-indigo-600 hover:bg-indigo-50 font-semibold'
              }`}
            >
              <span>Custom Role Label...</span>
              {!isStandard && (
                <svg className="w-3.5 h-3.5 text-indigo-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

interface SignatureSettingsCardProps {
  onNotifySuccess: (msg: string) => void
  onNotifyError: (msg: string) => void
}

export const SignatureSettingsCard: React.FC<SignatureSettingsCardProps> = ({
  onNotifySuccess,
  onNotifyError
}) => {
  const { profile } = useAuth()
  const [presets, setPresets] = useState<SignaturePreset[]>([])
  const [selectedPresetId, setSelectedPresetId] = useState<string>('')
  const [activePreset, setActivePreset] = useState<SignaturePreset | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [confirmRestore, setConfirmRestore] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  // Load presets and members with deduplication
  const loadData = async () => {
    setLoading(true)
    try {
      const [fetchedPresets, fetchedMembers] = await Promise.all([
        settingsService.getSignaturePresets(),
        memberService.getMembers(false)
      ])

      const list = fetchedPresets && fetchedPresets.length > 0 ? fetchedPresets : DEFAULT_SIGNATURE_PRESETS
      
      // Deduplicate presets by ID and Name to avoid clutter
      const seenIds = new Set<string>()
      const seenNames = new Set<string>()
      const deduplicated: SignaturePreset[] = []
      for (const p of list) {
        const normName = p.name.trim().toLowerCase()
        if (!seenIds.has(p.id) && !seenNames.has(normName)) {
          seenIds.add(p.id)
          seenNames.add(normName)
          deduplicated.push(p)
        }
      }

      setPresets(deduplicated)
      setMembers(fetchedMembers)

      const initialId = deduplicated[0]?.id || ''
      setSelectedPresetId(initialId)
      const initialPreset = deduplicated.find(p => p.id === initialId) || null
      setActivePreset(initialPreset ? JSON.parse(JSON.stringify(initialPreset)) : null)
    } catch (err) {
      console.error('Failed to load signature presets:', err)
      onNotifyError('Failed to load signature presets.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Handle switching selected preset tab
  const handleSelectPreset = (presetId: string) => {
    setSelectedPresetId(presetId)
    const target = presets.find(p => p.id === presetId)
    if (target) {
      setActivePreset(JSON.parse(JSON.stringify(target)))
    }
  }

  // Handle field updates on the active preset
  const handleUpdateActivePresetName = (name: string) => {
    if (!activePreset) return
    setActivePreset({ ...activePreset, name })
  }

  const handleAddSignatory = (column: 1 | 2 = 2) => {
    if (!activePreset) return
    const newSig: SignatoryItem = {
      id: `sig-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      label: column === 1 ? 'Prepared by:' : 'Approved by:',
      name: '',
      title: DEFAULT_MINISTRY_NAME,
      organization: DEFAULT_PARISH_NAME,
      column
    }
    setActivePreset({
      ...activePreset,
      signatories: [...activePreset.signatories, newSig]
    })
  }

  const handleUpdateSignatory = (sigId: string, updates: Partial<SignatoryItem>) => {
    if (!activePreset) return
    setActivePreset({
      ...activePreset,
      signatories: activePreset.signatories.map(s => (s.id === sigId ? { ...s, ...updates } : s))
    })
  }

  const handleRemoveSignatory = (sigId: string) => {
    if (!activePreset) return
    setActivePreset({
      ...activePreset,
      signatories: activePreset.signatories.filter(s => s.id !== sigId)
    })
  }

  const handleMoveSignatory = (index: number, direction: 'up' | 'down') => {
    if (!activePreset) return
    const newItems = [...activePreset.signatories]
    const targetIdx = direction === 'up' ? index - 1 : index + 1
    if (targetIdx < 0 || targetIdx >= newItems.length) return
    const temp = newItems[index]
    newItems[index] = newItems[targetIdx]
    newItems[targetIdx] = temp
    setActivePreset({ ...activePreset, signatories: newItems })
  }

  const handleSelectMember = (sigId: string, member: Member) => {
    const prefix = 'Bro. '
    const fullName = `${prefix}${member.firstName} ${member.lastName}`.toUpperCase()
    let positionTitle = member.position || member.rank || DEFAULT_MINISTRY_NAME
    if (positionTitle && !positionTitle.toLowerCase().includes('ministry')) {
      positionTitle = `${positionTitle}, ${DEFAULT_MINISTRY_NAME}`
    }

    handleUpdateSignatory(sigId, {
      name: fullName,
      title: positionTitle,
      organization: DEFAULT_PARISH_NAME
    })
  }

  const handleFillParishPriest = (sigId: string) => {
    handleUpdateSignatory(sigId, {
      label: 'Approved by:',
      name: DEFAULT_PARISH_PRIEST_NAME,
      title: DEFAULT_PARISH_PRIEST_TITLE,
      organization: DEFAULT_PARISH_NAME
    })
  }

  const handleFillCoordinator = (sigId: string) => {
    handleUpdateSignatory(sigId, {
      label: 'Noted by:',
      name: DEFAULT_COORDINATOR_NAME,
      title: DEFAULT_COORDINATOR_TITLE,
      organization: DEFAULT_PARISH_NAME
    })
  }

  const handleFillTreasurer = (sigId: string) => {
    handleUpdateSignatory(sigId, {
      label: 'Prepared by:',
      name: DEFAULT_TREASURER_NAME,
      title: DEFAULT_TREASURER_TITLE,
      organization: DEFAULT_PARISH_NAME
    })
  }

  const handleCreateNewPreset = () => {
    const newPreset: SignaturePreset = {
      id: `custom-preset-${Date.now()}`,
      name: `Custom Preset ${presets.length + 1}`,
      signatories: [
        {
          id: `sig-${Date.now()}-1`,
          label: 'Prepared by:',
          name: '',
          title: DEFAULT_MINISTRY_NAME,
          organization: DEFAULT_PARISH_NAME,
          column: 1
        },
        {
          id: `sig-${Date.now()}-2`,
          label: 'Approved by:',
          name: '',
          title: `Coordinator, ${DEFAULT_MINISTRY_NAME}`,
          organization: DEFAULT_PARISH_NAME,
          column: 2
        }
      ]
    }
    const updated = [...presets, newPreset]
    setPresets(updated)
    setSelectedPresetId(newPreset.id)
    setActivePreset(newPreset)
  }

  const handleDeletePreset = async (presetId: string) => {
    const updated = presets.filter(p => p.id !== presetId)
    if (updated.length === 0) {
      onNotifyError('Cannot delete all presets. At least one template must remain.')
      return
    }
    setSaving(true)
    try {
      await settingsService.saveSignaturePresets(updated, profile?.email || 'Admin')
      setPresets(updated)
      setSelectedPresetId(updated[0].id)
      setActivePreset(JSON.parse(JSON.stringify(updated[0])))
      onNotifySuccess('Preset deleted successfully.')
    } catch (err: any) {
      console.error(err)
      onNotifyError(err.message || 'Failed to delete preset.')
    } finally {
      setSaving(false)
      setConfirmDelete(null)
    }
  }

  const handleSaveAll = async () => {
    if (!activePreset) return
    setSaving(true)
    try {
      const updated = presets.map(p => (p.id === activePreset.id ? activePreset : p))
      await settingsService.saveSignaturePresets(updated, profile?.email || 'Admin')
      setPresets(updated)
      onNotifySuccess(`Signature preset "${activePreset.name}" successfully saved!`)
    } catch (err: any) {
      console.error(err)
      onNotifyError(err.message || 'Failed to save signature preset.')
    } finally {
      setSaving(false)
    }
  }

  const handleRestoreDefaults = async () => {
    setSaving(true)
    try {
      await settingsService.saveSignaturePresets(DEFAULT_SIGNATURE_PRESETS, profile?.email || 'Admin')
      setPresets(DEFAULT_SIGNATURE_PRESETS)
      setSelectedPresetId(DEFAULT_SIGNATURE_PRESETS[0].id)
      setActivePreset(JSON.parse(JSON.stringify(DEFAULT_SIGNATURE_PRESETS[0])))
      onNotifySuccess('Default signature presets restored successfully!')
    } catch (err: any) {
      console.error(err)
      onNotifyError(err.message || 'Failed to restore default presets.')
    } finally {
      setSaving(false)
      setConfirmRestore(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <div className="py-16 flex flex-col items-center justify-center space-y-3">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-indigo-600 border-t-transparent" />
          <span className="text-xs font-semibold text-slate-500">Loading signature presets...</span>
        </div>
      </Card>
    )
  }

  const leftSignatories = activePreset?.signatories.filter(s => s.column === 1 || !s.column) || []
  const rightSignatories = activePreset?.signatories.filter(s => s.column === 2) || []

  return (
    <div className="space-y-5">
      {/* Top Presets Header Card */}
      <Card className="p-5 border border-slate-200/80 bg-white rounded-3xl shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100">
                Signature Presets
              </span>
              <span className="text-xs font-bold text-slate-400">•</span>
              <span className="text-xs font-bold text-slate-500">{presets.length} Templates</span>
            </div>
            <h3 className="text-base font-black text-slate-900 tracking-tight">
              Report Signature Templates
            </h3>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">
              Configure signature blocks for financial statements, liquidation reports, and event summaries.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              type="button"
              variant="secondary"
              size="dense"
              onClick={() => setConfirmRestore(true)}
            >
              Restore Defaults
            </Button>
            <Button
              type="button"
              variant="primary"
              size="dense"
              onClick={handleCreateNewPreset}
              icon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              }
            >
              New Preset
            </Button>
          </div>
        </div>

        {/* Preset Selector Single-Line Pill Tabs (No native scrollbar) */}
        <div className="flex items-center gap-2 overflow-x-auto pt-3 border-t border-slate-100 select-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {presets.map(p => {
            const isSelected = selectedPresetId === p.id
            const isCustom = p.id.startsWith('custom-')
            return (
              <div
                key={p.id}
                onClick={() => handleSelectPreset(p.id)}
                className={`flex-shrink-0 h-9 px-3.5 rounded-xl text-xs font-bold inline-flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap shadow-2xs ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 ring-2 ring-indigo-600/20'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80 hover:border-slate-300'
                }`}
              >
                {isSelected ? (
                  <span className="h-2 w-2 rounded-full bg-white shrink-0" />
                ) : (
                  <span className="h-2 w-2 rounded-full bg-slate-300 shrink-0" />
                )}
                <span>{p.name}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-slate-200/80 text-slate-600'
                  }`}
                >
                  {p.signatories.length} sigs
                </span>
                {presets.length > 1 && isCustom && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setConfirmDelete(p.id)
                    }}
                    className={`ml-0.5 p-0.5 rounded-md hover:bg-rose-500/20 transition cursor-pointer ${
                      isSelected ? 'text-white/80 hover:text-white' : 'text-slate-400 hover:text-rose-600'
                    }`}
                    title="Delete custom preset"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </Card>

      {/* Preset Editor & Mock Preview Grid */}
      {activePreset && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Editor Controls */}
          <div className="lg:col-span-7 space-y-4">
            <Card className="p-5 border border-slate-200/80 bg-white rounded-3xl shadow-2xs space-y-4">
              {/* Preset Title Input */}
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Preset Template Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={activePreset.name}
                  onChange={e => handleUpdateActivePresetName(e.target.value)}
                  placeholder="e.g. Treasury Standard, General Approval"
                  className="w-full h-9 px-3.5 text-xs font-bold border border-slate-200 rounded-xl bg-slate-50/60 text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all shadow-2xs"
                />
              </div>

              {/* Signatories List */}
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Signatory List ({activePreset.signatories.length})
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleAddSignatory(1)}
                      className="px-2.5 py-1 text-[11px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer transition-colors"
                    >
                      + Left Column
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddSignatory(2)}
                      className="px-2.5 py-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100/80 rounded-lg cursor-pointer transition-colors border border-indigo-200/60"
                    >
                      + Right Column
                    </button>
                  </div>
                </div>

                <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                  {activePreset.signatories.length === 0 ? (
                    <div className="py-8 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                      <p className="text-xs font-semibold text-slate-400 mb-2">No signatories configured in this preset.</p>
                      <button
                        type="button"
                        onClick={() => handleAddSignatory(1)}
                        className="px-3.5 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl border border-indigo-200 cursor-pointer"
                      >
                        + Add First Signatory
                      </button>
                    </div>
                  ) : (
                    activePreset.signatories.map((sig, idx) => {
                      const isStandardLabel = (COMMON_SIGNATURE_LABELS as readonly string[]).includes(sig.label)

                      return (
                        <div
                          key={sig.id}
                          className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/50 hover:bg-white hover:border-slate-300 transition-all space-y-3 shadow-2xs"
                        >
                          {/* Signatory Card Header */}
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/60 pb-2.5">
                            {/* Role Label Selector / Editor (Custom Popover Dropdown) */}
                            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                              <span className="w-5 h-5 flex items-center justify-center rounded-lg bg-indigo-100 text-[10px] font-black text-indigo-700 shrink-0">
                                {idx + 1}
                              </span>
                              
                              <RoleSelectDropdown
                                value={sig.label}
                                onChange={(val) => handleUpdateSignatory(sig.id, { label: val })}
                                onCustomMode={() => handleUpdateSignatory(sig.id, { label: '' })}
                              />

                              {!isStandardLabel && (
                                <input
                                  type="text"
                                  value={sig.label}
                                  onChange={e => handleUpdateSignatory(sig.id, { label: e.target.value })}
                                  placeholder="Type custom role..."
                                  className="h-8 px-3 text-xs font-bold border border-slate-200 rounded-xl bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 flex-1 min-w-[140px] shadow-2xs"
                                  autoFocus
                                />
                              )}
                            </div>

                            {/* Column Switch, Up/Down, Delete */}
                            <div className="flex items-center gap-2 shrink-0">
                              {/* Left/Right Column Toggle */}
                              <div className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5 text-[10px] font-bold shadow-2xs">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateSignatory(sig.id, { column: 1 })}
                                  className={`px-2 py-0.5 rounded-md transition cursor-pointer ${
                                    sig.column === 1 || !sig.column
                                      ? 'bg-indigo-600 text-white font-black'
                                      : 'text-slate-500 hover:text-slate-800'
                                  }`}
                                >
                                  Left
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateSignatory(sig.id, { column: 2 })}
                                  className={`px-2 py-0.5 rounded-md transition cursor-pointer ${
                                    sig.column === 2
                                      ? 'bg-indigo-600 text-white font-black'
                                      : 'text-slate-500 hover:text-slate-800'
                                  }`}
                                >
                                  Right
                                </button>
                              </div>

                              {/* Move Up / Down Buttons */}
                              <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 shadow-2xs">
                                <button
                                  type="button"
                                  onClick={() => handleMoveSignatory(idx, 'up')}
                                  disabled={idx === 0}
                                  className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20 cursor-pointer rounded"
                                  title="Move Up"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                                  </svg>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleMoveSignatory(idx, 'down')}
                                  disabled={idx === activePreset.signatories.length - 1}
                                  className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20 cursor-pointer rounded"
                                  title="Move Down"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                  </svg>
                                </button>
                              </div>

                              {/* Remove Signatory */}
                              <button
                                type="button"
                                onClick={() => handleRemoveSignatory(sig.id)}
                                className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg border border-transparent hover:border-rose-200 transition cursor-pointer"
                                title="Remove Signatory"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </div>

                          {/* Signatory Body Form */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                            {/* Signatory Name */}
                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                  Signatory Name <span className="text-rose-500">*</span>
                                </label>
                                <div className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-600">
                                  <button
                                    type="button"
                                    onClick={() => handleFillParishPriest(sig.id)}
                                    className="hover:underline cursor-pointer"
                                  >
                                    Priest
                                  </button>
                                  <span className="text-slate-300">•</span>
                                  <button
                                    type="button"
                                    onClick={() => handleFillCoordinator(sig.id)}
                                    className="hover:underline cursor-pointer"
                                  >
                                    Coord
                                  </button>
                                  <span className="text-slate-300">•</span>
                                  <button
                                    type="button"
                                    onClick={() => handleFillTreasurer(sig.id)}
                                    className="hover:underline cursor-pointer"
                                  >
                                    Treas
                                  </button>
                                </div>
                              </div>

                              <MemberSearchDropdown
                                members={members}
                                value={sig.name}
                                mode="name"
                                title="Select Officer / Altar Server"
                                placeholder="Search officer or type name..."
                                formatDisplayName={(m) => `Bro. ${m.firstName} ${m.lastName}`.toUpperCase()}
                                onChange={(val, item) => {
                                  if (item?.rawMember) {
                                    handleSelectMember(sig.id, item.rawMember)
                                  } else {
                                    handleUpdateSignatory(sig.id, { name: val })
                                  }
                                }}
                              />
                            </div>

                            {/* Position / Title Line 1 */}
                            <div className="space-y-1">
                              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                Position / Title (Line 1)
                              </label>
                              <input
                                type="text"
                                value={sig.title}
                                onChange={e => handleUpdateSignatory(sig.id, { title: e.target.value })}
                                placeholder="e.g. Treasurer, Ministry of Altar Servers"
                                className="w-full h-8 px-3 text-xs font-semibold border border-slate-200 rounded-lg bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 shadow-2xs"
                              />
                            </div>

                            {/* Parish / Organization Line 2 */}
                            <div className="sm:col-span-2 space-y-1">
                              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                Parish / Organization (Line 2)
                              </label>
                              <input
                                type="text"
                                value={sig.organization || ''}
                                onChange={e => handleUpdateSignatory(sig.id, { organization: e.target.value })}
                                placeholder={DEFAULT_PARISH_NAME}
                                className="w-full h-8 px-3 text-xs font-semibold border border-slate-200 rounded-lg bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 shadow-2xs"
                              />
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

              {/* Save Button */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
                <span className="text-[11px] font-bold text-slate-400">
                  Total {activePreset.signatories.length} signatories in preset
                </span>
                <Button
                  type="button"
                  variant="primary"
                  size="dense"
                  onClick={handleSaveAll}
                  disabled={saving || !activePreset.name.trim()}
                  loading={saving}
                  loadingText="Saving Presets..."
                >
                  Save Template Changes
                </Button>
              </div>
            </Card>
          </div>

          {/* Right Column: Live Mock Preview Card */}
          <div className="lg:col-span-5 flex flex-col min-h-0">
            <Card className="p-0 border border-slate-200/80 bg-white rounded-3xl shadow-2xs flex flex-col flex-1 overflow-hidden">
              <div className="shrink-0 px-5 py-3.5 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Live PDF Document Sign-Off Preview
                  </h4>
                </div>
                <span className="text-[11px] font-bold text-slate-500">
                  {activePreset.signatories.length} Signatories
                </span>
              </div>

              <div className="flex-1 overflow-y-auto min-h-0 p-5 bg-slate-100/70">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80 space-y-6 text-slate-900 font-sans">
                  {/* Left Column Preview */}
                  <div>
                    <span className="text-[10px] font-black uppercase text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100 inline-block">
                      Left Column ({leftSignatories.length})
                    </span>
                    <div className="mt-4 space-y-5">
                      {leftSignatories.length > 0 ? (
                        leftSignatories.map(sig => (
                          <div key={sig.id} className="space-y-1">
                            <p className="text-xs font-semibold text-slate-600">{sig.label || 'Signature:'}</p>
                            <div className="h-8 border-b border-slate-800 flex items-end pb-1 w-full max-w-[240px]" />
                            <p className="text-xs font-black uppercase tracking-tight text-slate-900 pt-0.5">
                              {sig.name || 'SIGNATORY FULL NAME'}
                            </p>
                            {sig.title && <p className="text-[11px] text-slate-600 leading-tight font-medium">{sig.title}</p>}
                            {sig.organization && (
                              <p className="text-[10px] text-slate-400 leading-tight">{sig.organization}</p>
                            )}
                          </div>
                        ))
                      ) : (
                        <p className="text-[11px] text-slate-400 italic">No left column signatories</p>
                      )}
                    </div>
                  </div>

                  {/* Right Column Preview */}
                  <div className="pt-4 border-t border-slate-100">
                    <span className="text-[10px] font-black uppercase text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100 inline-block">
                      Right Column ({rightSignatories.length})
                    </span>
                    <div className="mt-4 space-y-5">
                      {rightSignatories.length > 0 ? (
                        rightSignatories.map(sig => (
                          <div key={sig.id} className="space-y-1">
                            <p className="text-xs font-semibold text-slate-600">{sig.label || 'Signature:'}</p>
                            <div className="h-8 border-b border-slate-800 flex items-end pb-1 w-full max-w-[240px]" />
                            <p className="text-xs font-black uppercase tracking-tight text-slate-900 pt-0.5">
                              {sig.name || 'SIGNATORY FULL NAME'}
                            </p>
                            {sig.title && <p className="text-[11px] text-slate-600 leading-tight font-medium">{sig.title}</p>}
                            {sig.organization && (
                              <p className="text-[10px] text-slate-400 leading-tight">{sig.organization}</p>
                            )}
                          </div>
                        ))
                      ) : (
                        <p className="text-[11px] text-slate-400 italic">No right column signatories</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Confirm Delete Modal */}
      <ConfirmModal
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && handleDeletePreset(confirmDelete)}
        variant="danger"
        title="Delete Signature Preset"
        message="Are you sure you want to delete this signature template? This action cannot be undone."
        confirmLabel="Delete Preset"
      />

      {/* Confirm Restore Defaults Modal */}
      <ConfirmModal
        isOpen={confirmRestore}
        onClose={() => setConfirmRestore(false)}
        onConfirm={handleRestoreDefaults}
        variant="warning"
        title="Restore Default Presets"
        message="Are you sure you want to restore the system default signature templates? Any custom presets will be overwritten."
        confirmLabel="Restore Defaults"
      />
    </div>
  )
}
