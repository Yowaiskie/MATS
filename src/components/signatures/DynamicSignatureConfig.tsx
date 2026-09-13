import React, { useState, useEffect } from 'react'
import type { SignatoryItem, SignatureConfig, SignaturePreset } from '@/types/signature'
import {
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
import { memberService } from '@/services/memberService'
import { settingsService } from '@/services/settingsService'
import type { Member } from '@/types/member'
import { MemberSearchDropdown } from '@/components/MemberSearchDropdown'

interface DynamicSignatureConfigProps {
  value: SignatureConfig
  onChange: (config: SignatureConfig) => void
  defaultPresetName?: string
}

export const COMMON_POSITION_SUGGESTIONS = [
  `Coordinator, ${DEFAULT_MINISTRY_NAME}`,
  `Assistant Coordinator, ${DEFAULT_MINISTRY_NAME}`,
  `Treasurer, ${DEFAULT_MINISTRY_NAME}`,
  `Auditor, ${DEFAULT_MINISTRY_NAME}`,
  `Admin Officer, ${DEFAULT_MINISTRY_NAME}`,
  `Secretary, ${DEFAULT_MINISTRY_NAME}`,
  `Chevalier, ${DEFAULT_MINISTRY_NAME}`,
  `Paladin, ${DEFAULT_MINISTRY_NAME}`,
  `Squire, ${DEFAULT_MINISTRY_NAME}`,
  `Altar Server, ${DEFAULT_MINISTRY_NAME}`,
  'Parish Priest',
  'Parochial Vicar',
  'Spiritual Director'
]

// Priority common role pills for quick 1-click selection
export const POPULAR_ROLE_PILLS = [
  'Prepared by:',
  'Noted by:',
  'Approved by:',
  'Requesting officer:',
  'Checked by:',
  'Verified by:',
  'Audited by:',
  'Released by:',
  'Received by:'
]

/**
 * Smart matching helper to find a matching preset by ID, name, or keyword
 */
const findMatchingPreset = (
  presets: SignaturePreset[],
  target?: string
): SignaturePreset | undefined => {
  if (!target || !target.trim()) return undefined
  const t = target.trim().toLowerCase()

  // 1. Match by exact ID
  const byId = presets.find(p => p.id.toLowerCase() === t)
  if (byId) return byId

  // 2. Match by exact name
  const byName = presets.find(p => p.name.toLowerCase() === t)
  if (byName) return byName

  // 3. Match by keyword inclusion
  const byKeyword = presets.find(p => {
    const pName = p.name.toLowerCase()
    const pId = p.id.toLowerCase()
    return (
      pName.includes(t) ||
      t.includes(pName) ||
      (t.includes('req') && (pId.includes('req') || pName.includes('req'))) ||
      (t.includes('liq') && (pId.includes('liq') || pName.includes('liq'))) ||
      ((t.includes('treasury') || t.includes('finance')) && (pId.includes('finance') || pName.includes('treasury'))) ||
      ((t.includes('gen') || t.includes('qual') || t.includes('member') || t.includes('contrib')) && (pId.includes('general') || pName.includes('general')))
    )
  })

  return byKeyword
}

/**
 * Generates a clean human-readable preview of the roles in a preset
 */
const getPresetRoleChain = (preset: SignaturePreset): string => {
  if (!preset.signatories || preset.signatories.length === 0) return 'No signatures'
  const roles = preset.signatories.map(s => (s.label || 'Sig').replace(/:$/, '').trim())
  return roles.join(' → ')
}

export const DynamicSignatureConfig: React.FC<DynamicSignatureConfigProps> = ({
  value,
  onChange,
  defaultPresetName
}) => {
  const [members, setMembers] = useState<Member[]>([])
  const [savedPresets, setSavedPresets] = useState<SignaturePreset[]>(DEFAULT_SIGNATURE_PRESETS)
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null)
  const [newPresetName, setNewPresetName] = useState('')
  const [showSavePresetModal, setShowSavePresetModal] = useState(false)
  const [isSavingPreset, setIsSavingPreset] = useState(false)
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit')

  // Load presets from settingsService (Firestore + localStorage)
  useEffect(() => {
    let isMounted = true
    const fetchPresets = async () => {
      try {
        const fetched = await settingsService.getSignaturePresets()
        const presetsList = fetched && fetched.length > 0 ? fetched : DEFAULT_SIGNATURE_PRESETS

        // Strict deduplication
        const seenIds = new Set<string>()
        const seenNames = new Set<string>()
        const deduplicated: SignaturePreset[] = []
        for (const p of presetsList) {
          const normName = p.name.trim().toLowerCase()
          if (!seenIds.has(p.id) && !seenNames.has(normName)) {
            seenIds.add(p.id)
            seenNames.add(normName)
            deduplicated.push(p)
          }
        }

        if (!isMounted) return
        setSavedPresets(deduplicated)

        // Find initial preset matching
        const matched = findMatchingPreset(deduplicated, defaultPresetName) || deduplicated[0]
        if (matched) {
          setSelectedPresetId(matched.id)

          // If the parent modal didn't supply any initial signatories, load from matched preset
          if (!value.signatories || value.signatories.length === 0) {
            onChange({
              enabled: true,
              signatories: matched.signatories.map(s => ({
                ...s,
                id: `sig-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
              }))
            })
          }
        }
      } catch (err) {
        console.warn('Could not load signature presets:', err)
      }
    }

    fetchPresets()
    return () => {
      isMounted = false
    }
  }, [defaultPresetName])

  // Load active members for search & auto-fill dropdown
  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const list = await memberService.getMembers(false)
        setMembers(list)
      } catch (err) {
        console.warn('Failed to load members for signatures:', err)
      }
    }
    fetchMembers()
  }, [])

  const handleToggleEnabled = (enabled: boolean) => {
    onChange({
      ...value,
      enabled
    })
  }

  const handleAddSignatory = (column: 1 | 2 = 2) => {
    const newSig: SignatoryItem = {
      id: `sig-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      label: column === 1 ? 'Prepared by:' : 'Approved by:',
      name: '',
      title: DEFAULT_MINISTRY_NAME,
      organization: DEFAULT_PARISH_NAME,
      column
    }
    setSelectedPresetId(null) // Custom state
    onChange({
      ...value,
      signatories: [...value.signatories, newSig]
    })
  }

  const handleUpdateSignatory = (id: string, updates: Partial<SignatoryItem>) => {
    onChange({
      ...value,
      signatories: value.signatories.map(s => (s.id === id ? { ...s, ...updates } : s))
    })
  }

  const handleRemoveSignatory = (id: string) => {
    setSelectedPresetId(null)
    onChange({
      ...value,
      signatories: value.signatories.filter(s => s.id !== id)
    })
  }

  const handleMoveSignatory = (index: number, direction: 'up' | 'down') => {
    const newItems = [...value.signatories]
    const targetIdx = direction === 'up' ? index - 1 : index + 1
    if (targetIdx < 0 || targetIdx >= newItems.length) return
    const temp = newItems[index]
    newItems[index] = newItems[targetIdx]
    newItems[targetIdx] = temp
    onChange({ ...value, signatories: newItems })
  }

  const handleFillParishPriest = (sigId: string) => {
    handleUpdateSignatory(sigId, {
      label: 'Approved by:',
      name: DEFAULT_PARISH_PRIEST_NAME,
      title: DEFAULT_PARISH_PRIEST_TITLE,
      organization: DEFAULT_PARISH_NAME,
      column: 2
    })
  }

  const handleFillCoordinator = (sigId: string) => {
    handleUpdateSignatory(sigId, {
      label: 'Noted by:',
      name: DEFAULT_COORDINATOR_NAME,
      title: DEFAULT_COORDINATOR_TITLE,
      organization: DEFAULT_PARISH_NAME,
      column: 2
    })
  }

  const handleFillTreasurer = (sigId: string) => {
    handleUpdateSignatory(sigId, {
      label: 'Prepared by:',
      name: DEFAULT_TREASURER_NAME,
      title: DEFAULT_TREASURER_TITLE,
      organization: DEFAULT_PARISH_NAME,
      column: 1
    })
  }

  const handleSelectMember = (sigId: string, member: Member) => {
    const prefix = 'Bro. '
    const fullName = `${prefix}${member.firstName} ${member.lastName}`.toUpperCase()

    // Format position title
    let positionTitle = member.position || member.rank || 'Altar Server'
    if (positionTitle && !positionTitle.toLowerCase().includes('ministry')) {
      positionTitle = `${positionTitle}, ${DEFAULT_MINISTRY_NAME}`
    }

    handleUpdateSignatory(sigId, {
      name: fullName,
      title: positionTitle,
      organization: DEFAULT_PARISH_NAME
    })
  }

  const handleApplyPreset = (preset: SignaturePreset) => {
    setSelectedPresetId(preset.id)
    onChange({
      enabled: true,
      signatories: preset.signatories.map(s => ({
        id: `sig-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        label: s.label || 'Prepared by:',
        name: s.name || '',
        title: s.title || DEFAULT_MINISTRY_NAME,
        organization: s.organization || DEFAULT_PARISH_NAME,
        column: s.column === 1 ? 1 : 2,
        signatureImageUrl: s.signatureImageUrl
      }))
    })
  }

  const handleSavePreset = async () => {
    const trimmedName = newPresetName.trim()
    if (!trimmedName || isSavingPreset) return

    setIsSavingPreset(true)
    try {
      const existingIndex = savedPresets.findIndex(
        p => p.name.trim().toLowerCase() === trimmedName.toLowerCase()
      )

      let updated: SignaturePreset[]

      if (existingIndex >= 0) {
        // Overwrite existing preset with current signatories
        updated = savedPresets.map((p, idx) =>
          idx === existingIndex
            ? { ...p, signatories: value.signatories }
            : p
        )
        setSelectedPresetId(savedPresets[existingIndex].id)
      } else {
        const newPreset: SignaturePreset = {
          id: `custom-preset-${Date.now()}`,
          name: trimmedName,
          signatories: value.signatories.map(s => ({
            id: s.id,
            label: s.label,
            name: s.name,
            title: s.title,
            organization: s.organization,
            column: s.column,
            signatureImageUrl: s.signatureImageUrl
          }))
        }
        updated = [...savedPresets, newPreset]
        setSelectedPresetId(newPreset.id)
      }

      setSavedPresets(updated)
      await settingsService.saveSignaturePresets(updated)

      setNewPresetName('')
      setShowSavePresetModal(false)
    } catch (err) {
      console.warn('Failed to save preset to settingsService:', err)
    } finally {
      setIsSavingPreset(false)
    }
  }

  const handleDeletePreset = async (presetId: string) => {
    const updated = savedPresets.filter(p => p.id !== presetId)
    setSavedPresets(updated)
    if (selectedPresetId === presetId) {
      setSelectedPresetId(updated[0]?.id || null)
    }
    try {
      await settingsService.saveSignaturePresets(updated)
    } catch (err) {
      console.warn('Failed to delete preset in settingsService:', err)
    }
  }

  const leftSignatories = value.signatories.filter(s => s.column === 1 || !s.column)
  const rightSignatories = value.signatories.filter(s => s.column === 2)

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs">
      {/* Header with Enable Switch & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
        <div className="flex items-center gap-3">
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={value.enabled}
              onChange={e => handleToggleEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-10 h-5 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
          </label>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-slate-800 tracking-tight">
                Include Official Signatures in Document
              </span>
              {value.enabled && (
                <span className="px-2 py-0.5 text-[10px] font-black rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                  {value.signatories.length} Signatories Active
                </span>
              )}
            </div>
            <p className="text-[11px] font-medium text-slate-400">
              Customize dynamic sign-off lines (Prepared by, Noted by, Approved by, etc.)
            </p>
          </div>
        </div>

        {value.enabled && (
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab('edit')}
              className={`px-3 py-1 text-[11px] font-black rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'edit'
                  ? 'bg-white text-indigo-700 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <span>Editor ({value.signatories.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              className={`px-3 py-1 text-[11px] font-black rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'preview'
                  ? 'bg-white text-indigo-700 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              <span>Live Preview</span>
            </button>
          </div>
        )}
      </div>

      {value.enabled && (
        <>
          {/* Enhanced Signature Presets Bar */}
          <div className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <span>Official Signature Presets</span>
              </span>

              <button
                type="button"
                onClick={() => {
                  setNewPresetName('')
                  setShowSavePresetModal(true)
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-700 bg-white hover:bg-indigo-50/50 rounded-xl border border-indigo-200 transition shadow-2xs cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                <span>Save Current as Preset</span>
              </button>
            </div>

            {/* Presets Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {savedPresets.map(preset => {
                const isSelected = selectedPresetId === preset.id
                const isCustom = preset.id.startsWith('custom-')
                const roleChain = getPresetRoleChain(preset)

                return (
                  <div
                    key={preset.id}
                    onClick={() => handleApplyPreset(preset)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer relative group flex flex-col justify-between gap-1.5 ${
                      isSelected
                        ? 'bg-indigo-50/90 border-indigo-500 ring-2 ring-indigo-500/20 shadow-xs'
                        : 'bg-white border-slate-200/90 hover:border-indigo-300 hover:bg-slate-50/80 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {isSelected ? (
                          <span className="w-2 h-2 rounded-full bg-indigo-600 shrink-0 animate-pulse" />
                        ) : (
                          <span className="w-2 h-2 rounded-full bg-slate-300 shrink-0" />
                        )}
                        <span className={`text-xs font-black truncate ${isSelected ? 'text-indigo-900' : 'text-slate-800'}`}>
                          {preset.name}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {isCustom && (
                          <span className="px-1.5 py-0.2 text-[9px] font-black rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                            Custom
                          </span>
                        )}
                        <span className="text-[10px] font-mono font-bold text-slate-400">
                          ({preset.signatories?.length || 0})
                        </span>
                        {isCustom && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeletePreset(preset.id)
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition"
                            title="Delete custom preset"
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="text-[10px] font-bold text-slate-500 truncate" title={roleChain}>
                      {roleChain}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Tab 1: Edit Mode */}
          {activeTab === 'edit' && (
            <div className="space-y-3.5">
              {value.signatories.length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                  <p className="text-xs font-bold text-slate-500 mb-2">No signatories configured.</p>
                  <button
                    type="button"
                    onClick={() => handleAddSignatory(1)}
                    className="px-4 py-2 text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs cursor-pointer"
                  >
                    + Add First Signatory
                  </button>
                </div>
              ) : (
                <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
                  {value.signatories.map((sig, idx) => (
                    <div
                      key={sig.id}
                      className="p-3.5 rounded-2xl border border-slate-200/90 bg-white hover:border-indigo-300 transition-all space-y-3 shadow-2xs"
                    >
                      {/* Top Bar: Order #, Label Badge, Column Toggle, Move, Delete */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 flex items-center justify-center rounded-lg bg-indigo-50 text-[10px] font-black text-indigo-700 border border-indigo-100">
                            {idx + 1}
                          </span>
                          <span className="text-xs font-black text-slate-900">
                            {sig.label || `Signatory #${idx + 1}`}
                          </span>
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md ${
                            sig.column === 1
                              ? 'bg-slate-100 text-slate-700'
                              : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                          }`}>
                            {sig.column === 1 ? 'Left Column (Col 1)' : 'Right Column (Col 2)'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap">
                          {/* Column Placement Switch */}
                          <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-0.5 text-[10px] font-bold">
                            <button
                              type="button"
                              onClick={() => handleUpdateSignatory(sig.id, { column: 1 })}
                              className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                                sig.column === 1 || !sig.column
                                  ? 'bg-white text-indigo-700 font-black shadow-2xs border border-slate-200/80'
                                  : 'text-slate-500 hover:text-slate-800'
                              }`}
                            >
                              Left
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateSignatory(sig.id, { column: 2 })}
                              className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                                sig.column === 2
                                  ? 'bg-white text-indigo-700 font-black shadow-2xs border border-slate-200/80'
                                  : 'text-slate-500 hover:text-slate-800'
                              }`}
                            >
                              Right
                            </button>
                          </div>

                          {/* Move Up / Down */}
                          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl p-0.5">
                            <button
                              type="button"
                              onClick={() => handleMoveSignatory(idx, 'up')}
                              disabled={idx === 0}
                              className="p-1 text-slate-500 hover:text-slate-800 disabled:opacity-20 rounded-lg cursor-pointer"
                              title="Move Up"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveSignatory(idx, 'down')}
                              disabled={idx === value.signatories.length - 1}
                              className="p-1 text-slate-500 hover:text-slate-800 disabled:opacity-20 rounded-lg cursor-pointer"
                              title="Move Down"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                          </div>

                          {/* Remove Signatory */}
                          <button
                            type="button"
                            onClick={() => handleRemoveSignatory(sig.id)}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-xl border border-rose-200/60 transition cursor-pointer"
                            title="Remove Signatory"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      {/* Inputs Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        {/* 1. Role / Label Selection & Quick Chips */}
                        <div className="sm:col-span-2 space-y-1.5">
                          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500">
                            Role / Prefix Header Label
                          </label>

                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={sig.label}
                              onChange={e => handleUpdateSignatory(sig.id, { label: e.target.value })}
                              placeholder="e.g. Prepared by:, Noted by:, Approved by:"
                              className="flex-1 p-2 text-xs font-bold border border-slate-300 rounded-xl bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-600 transition"
                            />
                          </div>

                          {/* Quick Role Select Chips */}
                          <div className="flex flex-wrap gap-1 pt-0.5">
                            {POPULAR_ROLE_PILLS.map(lbl => {
                              const isCurrent = sig.label === lbl
                              return (
                                <button
                                  key={lbl}
                                  type="button"
                                  onClick={() => handleUpdateSignatory(sig.id, { label: lbl })}
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border transition-all cursor-pointer ${
                                    isCurrent
                                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-2xs'
                                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-700 hover:bg-white'
                                  }`}
                                >
                                  {lbl}
                                </button>
                              )
                            })}
                          </div>
                        </div>

                        {/* 2. Signatory Name with Member Search Dropdown & Quick Autofill */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500">
                              Signatory Name (Bold in PDF)
                            </label>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleFillParishPriest(sig.id)}
                                className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition cursor-pointer"
                                title="Auto-fill Parish Priest (Rev. Fr. ILDEFONSO DE GUZMAN JR.)"
                              >
                                Parish Priest
                              </button>
                              <button
                                type="button"
                                onClick={() => handleFillCoordinator(sig.id)}
                                className="text-[9px] font-black px-1.5 py-0.5 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 transition cursor-pointer"
                                title="Auto-fill Coordinator (Bro. KYLE VINCENT MADRIAGA)"
                              >
                                Coordinator
                              </button>
                              <button
                                type="button"
                                onClick={() => handleFillTreasurer(sig.id)}
                                className="text-[9px] font-black px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 transition cursor-pointer"
                                title="Auto-fill Treasurer (Bro. CHRYSLER DAVID)"
                              >
                                Treasurer
                              </button>
                            </div>
                          </div>

                          <MemberSearchDropdown
                            members={members}
                            value={sig.name}
                            mode="name"
                            title="Select Officer / Altar Server"
                            placeholder="Search officer / member..."
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

                        {/* 3. Title / Designation */}
                        <div>
                          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                            Position / Title (Line 1)
                          </label>
                          <input
                            type="text"
                            value={sig.title}
                            onChange={e => handleUpdateSignatory(sig.id, { title: e.target.value })}
                            placeholder="e.g. Coordinator, Ministry of Altar Servers"
                            className="w-full p-2 text-xs font-semibold border border-slate-300 rounded-xl bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-600"
                          />
                          <div className="flex flex-wrap gap-1 mt-1">
                            {COMMON_POSITION_SUGGESTIONS.slice(0, 4).map(pos => (
                              <button
                                key={pos}
                                type="button"
                                onClick={() => handleUpdateSignatory(sig.id, { title: pos })}
                                className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border transition cursor-pointer ${
                                  sig.title === pos
                                    ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                                    : 'bg-white border-slate-200 text-slate-500 hover:text-slate-800'
                                }`}
                              >
                                {pos.replace(`, ${DEFAULT_MINISTRY_NAME}`, '')}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* 4. Organization / Parish Line */}
                        <div className="sm:col-span-2">
                          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                            Parish / Organization (Line 2)
                          </label>
                          <input
                            type="text"
                            value={sig.organization || ''}
                            onChange={e => handleUpdateSignatory(sig.id, { organization: e.target.value })}
                            placeholder={DEFAULT_PARISH_NAME}
                            className="w-full p-2 text-xs font-semibold border border-slate-300 rounded-xl bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-600"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Signatory Toolbar */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleAddSignatory(1)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-black text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer shadow-2xs"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Add to Left Column</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddSignatory(2)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-black text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition cursor-pointer shadow-2xs"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Add to Right Column</span>
                  </button>
                </div>
                <span className="text-[11px] font-extrabold text-slate-500">
                  Total: {value.signatories.length} ({leftSignatories.length} Left, {rightSignatories.length} Right)
                </span>
              </div>
            </div>
          )}

          {/* Tab 2: Visual Live Preview */}
          {activeTab === 'preview' && (
            <div className="p-4 sm:p-5 bg-slate-100/80 rounded-2xl border border-slate-200">
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-3 text-center">
                Document Signatures Layout Preview
              </div>

              <div className="bg-white p-5 sm:p-7 rounded-2xl shadow-xs border border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-8 text-slate-900 font-sans">
                {/* Left Column Preview */}
                <div className="space-y-6">
                  {leftSignatories.length > 0 ? (
                    leftSignatories.map(sig => (
                      <div key={sig.id} className="space-y-1">
                        <p className="text-xs font-semibold text-slate-600">{sig.label || 'Signature:'}</p>
                        <div className="h-8 border-b border-slate-800 flex items-end pb-1 w-full max-w-[260px]" />
                        <p className="text-xs font-black uppercase tracking-tight text-slate-900 pt-0.5">
                          {sig.name || 'SIGNATORY FULL NAME'}
                        </p>
                        {sig.title && <p className="text-[11px] text-slate-600 font-medium leading-tight">{sig.title}</p>}
                        {sig.organization && (
                          <p className="text-[11px] text-slate-400 font-normal leading-tight">{sig.organization}</p>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="h-20 border border-dashed border-slate-200 rounded-xl flex items-center justify-center text-[11px] text-slate-400 font-bold">
                      No left column signatures
                    </div>
                  )}
                </div>

                {/* Right Column Preview */}
                <div className="space-y-6">
                  {rightSignatories.length > 0 ? (
                    rightSignatories.map(sig => (
                      <div key={sig.id} className="space-y-1">
                        <p className="text-xs font-semibold text-slate-600">{sig.label || 'Signature:'}</p>
                        <div className="h-8 border-b border-slate-800 flex items-end pb-1 w-full max-w-[260px]" />
                        <p className="text-xs font-black uppercase tracking-tight text-slate-900 pt-0.5">
                          {sig.name || 'SIGNATORY FULL NAME'}
                        </p>
                        {sig.title && <p className="text-[11px] text-slate-600 font-medium leading-tight">{sig.title}</p>}
                        {sig.organization && (
                          <p className="text-[11px] text-slate-400 font-normal leading-tight">{sig.organization}</p>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="h-20 border border-dashed border-slate-200 rounded-xl flex items-center justify-center text-[11px] text-slate-400 font-bold">
                      No right column signatures
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Save Preset Dialog */}
      {showSavePresetModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[80] flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-5 sm:p-6 max-w-sm w-full space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center font-black">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
              </div>
              <h4 className="text-sm font-black text-slate-900">Save Signature Preset</h4>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Enter a name for this template. Saved presets can be reused anytime across all export modals.
            </p>

            <input
              type="text"
              value={newPresetName}
              onChange={e => setNewPresetName(e.target.value)}
              placeholder="e.g. Audit & Verified Approval"
              className="w-full p-2.5 text-xs font-bold border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-600"
              autoFocus
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSavePresetModal(false)}
                className="px-3.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSavePreset}
                disabled={!newPresetName.trim() || isSavingPreset}
                className="px-4 py-1.5 text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl shadow-xs cursor-pointer"
              >
                {isSavingPreset ? 'Saving...' : 'Save Preset'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
