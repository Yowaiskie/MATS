import React, { useState, useEffect } from 'react'
import type { SignatoryItem, SignatureConfig, SignaturePreset } from '@/types/signature'
import {
  COMMON_SIGNATURE_LABELS,
  DEFAULT_PARISH_NAME,
  DEFAULT_MINISTRY_NAME,
  DEFAULT_SIGNATURE_PRESETS
} from '@/types/signature'
import { memberService } from '@/services/memberService'
import { settingsService } from '@/services/settingsService'
import type { Member } from '@/types/member'

interface DynamicSignatureConfigProps {
  value: SignatureConfig
  onChange: (config: SignatureConfig) => void
  defaultPresetName?: string
}

export const DynamicSignatureConfig: React.FC<DynamicSignatureConfigProps> = ({
  value,
  onChange,
  defaultPresetName
}) => {
  const [members, setMembers] = useState<Member[]>([])
  const [loadingMembers, setLoadingMembers] = useState(false)
  const [savedPresets, setSavedPresets] = useState<SignaturePreset[]>([])
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(() => {
    if (defaultPresetName) {
      const matched = DEFAULT_SIGNATURE_PRESETS.find(p => p.name.toLowerCase() === defaultPresetName.toLowerCase())
      if (matched) return matched.id
    }
    return 'preset-finance'
  })
  const [newPresetName, setNewPresetName] = useState('')
  const [showSavePresetModal, setShowSavePresetModal] = useState(false)
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit')

  // Load saved presets from settingsService (Firestore + localStorage)
  useEffect(() => {
    const fetchPresets = async () => {
      try {
        const fetched = await settingsService.getSignaturePresets()
        const presetsList = fetched && fetched.length > 0 ? fetched : DEFAULT_SIGNATURE_PRESETS
        setSavedPresets(presetsList)
        if (defaultPresetName) {
          const matched = presetsList.find(p => p.name.toLowerCase() === defaultPresetName.toLowerCase())
          if (matched) {
            setSelectedPresetId(matched.id)
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
        }
      } catch (err) {
        console.warn('Could not load presets from settingsService:', err)
      }
    }
    fetchPresets()
  }, [defaultPresetName])

  // Load active members for auto-fill dropdown
  useEffect(() => {
    const fetchMembers = async () => {
      setLoadingMembers(true)
      try {
        const list = await memberService.getMembers(false)
        setMembers(list)
      } catch (err) {
        console.warn('Failed to load members for signatures:', err)
      } finally {
        setLoadingMembers(false)
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
      label: 'Noted by:',
      name: '',
      title: DEFAULT_MINISTRY_NAME,
      organization: DEFAULT_PARISH_NAME,
      column
    }
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

  const handleSelectMember = (sigId: string, memberId: string) => {
    if (!memberId) return
    const mem = members.find(m => m.id === memberId)
    if (!mem) return

    const prefix = 'Bro. '
    const fullName = `${prefix}${mem.firstName} ${mem.lastName}`.toUpperCase()
    let positionTitle = mem.position || DEFAULT_MINISTRY_NAME
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
        ...s,
        id: `sig-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
      }))
    })
  }

  const handleSavePreset = async () => {
    if (!newPresetName.trim()) return
    const newPreset: SignaturePreset = {
      id: `custom-preset-${Date.now()}`,
      name: newPresetName.trim(),
      signatories: value.signatories
    }
    const updated = [...savedPresets, newPreset]
    setSavedPresets(updated)
    setSelectedPresetId(newPreset.id)
    try {
      await settingsService.saveSignaturePresets(updated)
    } catch (err) {
      console.warn('Failed to save preset to settingsService:', err)
    }
    setNewPresetName('')
    setShowSavePresetModal(false)
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
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
      {/* Header with Enable Switch and Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-3">
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={value.enabled}
              onChange={e => handleToggleEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-10 h-5 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
          <div>
            <span className="text-xs font-black text-slate-800 tracking-tight flex items-center gap-1.5">
              Include Signatures in PDF
              {value.enabled && (
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-700">
                  Active ({value.signatories.length})
                </span>
              )}
            </span>
            <p className="text-[11px] font-medium text-slate-400">
              Customize dynamic signature lines (e.g. Requesting officer, Approved by, Noted by).
            </p>
          </div>
        </div>

        {value.enabled && (
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab('edit')}
              className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-all ${
                activeTab === 'edit'
                  ? 'bg-white text-slate-800 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Signatories
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-all ${
                activeTab === 'preview'
                  ? 'bg-white text-blue-700 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Visual Preview
            </button>
          </div>
        )}
      </div>

      {value.enabled && (
        <>
          {/* Preset Selector Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                Preset Templates:
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {savedPresets.map(preset => {
                  const isSelected = selectedPresetId === preset.id
                  return (
                    <div
                      key={preset.id}
                      className={`inline-flex items-center rounded-xl border transition-all ${
                        isSelected
                          ? 'bg-blue-600 border-blue-600 text-white font-black shadow-sm ring-2 ring-blue-500/30'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 font-bold shadow-2xs'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleApplyPreset(preset)}
                        className="px-3 py-1 text-[11px] flex items-center gap-1.5 cursor-pointer"
                        title={`Apply ${preset.name} template`}
                      >
                        {isSelected && (
                          <svg className="w-3.5 h-3.5 text-white stroke-[3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                        <span>{preset.name}</span>
                      </button>
                      {preset.id.startsWith('custom-') && (
                        <button
                          type="button"
                          onClick={() => handleDeletePreset(preset.id)}
                          className={`px-2 py-1 transition cursor-pointer ${
                            isSelected
                              ? 'text-white/80 hover:text-white hover:bg-blue-700 border-l border-blue-500'
                              : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50 border-l border-slate-200'
                          }`}
                          title="Delete custom preset"
                        >
                          &times;
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowSavePresetModal(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-blue-600 hover:bg-blue-50 rounded-lg border border-blue-200 transition"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
              Save as Preset
            </button>
          </div>

          {/* Tab 1: Edit Mode */}
          {activeTab === 'edit' && (
            <div className="space-y-4">
              {value.signatories.length === 0 ? (
                <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-xl">
                  <p className="text-xs font-semibold text-slate-500 mb-2">No signatories added yet.</p>
                  <button
                    type="button"
                    onClick={() => handleAddSignatory(1)}
                    className="px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-2xs"
                  >
                    + Add First Signatory
                  </button>
                </div>
              ) : (
                <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
                  {value.signatories.map((sig, idx) => (
                    <div
                      key={sig.id}
                      className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-slate-300 transition-all space-y-2.5 shadow-2xs"
                    >
                      {/* Top Bar: Signatory #, Column Selector, Member Auto-fill, Actions */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/60 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 flex items-center justify-center rounded-full bg-slate-200 text-[10px] font-black text-slate-700">
                            {idx + 1}
                          </span>
                          <span className="text-xs font-black text-slate-800">Signatory Details</span>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Column Placement Selector */}
                          <div className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5 text-[11px] font-bold">
                            <button
                              type="button"
                              onClick={() => handleUpdateSignatory(sig.id, { column: 1 })}
                              className={`px-2 py-0.5 rounded-md transition ${
                                sig.column === 1 || !sig.column
                                  ? 'bg-blue-600 text-white font-black'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              Left Col
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateSignatory(sig.id, { column: 2 })}
                              className={`px-2 py-0.5 rounded-md transition ${
                                sig.column === 2
                                  ? 'bg-blue-600 text-white font-black'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              Right Col
                            </button>
                          </div>

                          {/* Member Quick Auto-fill */}
                          <select
                            onChange={e => handleSelectMember(sig.id, e.target.value)}
                            defaultValue=""
                            className="p-1 px-2 text-[11px] font-bold border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="" disabled>
                              {loadingMembers ? 'Loading...' : 'Auto-fill Officer/Member...'}
                            </option>
                            {members.map(m => (
                              <option key={m.id} value={m.id}>
                                {m.firstName} {m.lastName} {m.position ? `(${m.position})` : ''}
                              </option>
                            ))}
                          </select>

                          {/* Move up / down */}
                          <div className="flex items-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => handleMoveSignatory(idx, 'up')}
                              disabled={idx === 0}
                              className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 rounded-md"
                              title="Move Up"
                            >
                              ▲
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveSignatory(idx, 'down')}
                              disabled={idx === value.signatories.length - 1}
                              className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 rounded-md"
                              title="Move Down"
                            >
                              ▼
                            </button>
                          </div>

                          {/* Delete Button */}
                          <button
                            type="button"
                            onClick={() => handleRemoveSignatory(sig.id)}
                            className="p-1 px-2 text-[11px] font-bold text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            title="Remove Signatory"
                          >
                            Remove
                          </button>
                        </div>
                      </div>

                      {/* Form Inputs Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
                        {/* Label / Prefix Input with Quick Tags */}
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                            Role / Prefix Label
                          </label>
                          <input
                            type="text"
                            value={sig.label}
                            onChange={e => handleUpdateSignatory(sig.id, { label: e.target.value })}
                            placeholder="e.g. Requesting officer:, Approved by:"
                            className="w-full p-2 text-xs font-semibold border border-slate-300 rounded-lg bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                          />
                          {/* Quick Chips */}
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {COMMON_SIGNATURE_LABELS.slice(0, 6).map(lbl => (
                              <button
                                key={lbl}
                                type="button"
                                onClick={() => handleUpdateSignatory(sig.id, { label: lbl })}
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border transition ${
                                  sig.label === lbl
                                    ? 'bg-blue-50 border-blue-300 text-blue-700'
                                    : 'bg-white border-slate-200 text-slate-500 hover:text-slate-800'
                                }`}
                              >
                                {lbl}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Signatory Full Name */}
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                            Signatory Name (Bold in PDF)
                          </label>
                          <input
                            type="text"
                            value={sig.name}
                            onChange={e => handleUpdateSignatory(sig.id, { name: e.target.value })}
                            placeholder="e.g. Bro. CHRYSLER DAVID"
                            className="w-full p-2 text-xs font-bold border border-slate-300 rounded-lg bg-white uppercase focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                          />
                        </div>

                        {/* Position / Title */}
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                            Title / Position Line 1
                          </label>
                          <input
                            type="text"
                            value={sig.title}
                            onChange={e => handleUpdateSignatory(sig.id, { title: e.target.value })}
                            placeholder="e.g. Treasurer, Ministry of Altar Servers"
                            className="w-full p-2 text-xs font-medium border border-slate-300 rounded-lg bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                          />
                        </div>

                        {/* Organization / Parish */}
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                            Parish / Organization Line 2
                          </label>
                          <input
                            type="text"
                            value={sig.organization || ''}
                            onChange={e => handleUpdateSignatory(sig.id, { organization: e.target.value })}
                            placeholder={DEFAULT_PARISH_NAME}
                            className="w-full p-2 text-xs font-medium border border-slate-300 rounded-lg bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Signatory Button */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleAddSignatory(1)}
                    className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                  >
                    + Add to Left Column
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddSignatory(2)}
                    className="px-3 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition cursor-pointer"
                  >
                    + Add to Right Column
                  </button>
                </div>
                <span className="text-[11px] font-bold text-slate-400">
                  Total: {value.signatories.length} Signatories
                </span>
              </div>
            </div>
          )}

          {/* Tab 2: Visual Live Preview */}
          {activeTab === 'preview' && (
            <div className="p-6 bg-slate-100 rounded-xl border border-slate-200">
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-3 text-center">
                Document Signature Section Preview
              </div>

              <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-8 text-slate-900 font-sans">
                {/* Left Column Preview */}
                <div className="space-y-8">
                  {leftSignatories.length > 0 ? (
                    leftSignatories.map(sig => (
                      <div key={sig.id} className="space-y-1">
                        <p className="text-xs font-medium text-slate-700">{sig.label || 'Signature:'}</p>
                        <div className="h-10 border-b border-slate-800 flex items-end pb-1 w-full max-w-[280px]">
                          {/* Signature line / placeholder */}
                        </div>
                        <p className="text-xs font-bold uppercase tracking-tight text-slate-900 pt-0.5">
                          {sig.name || 'SIGNATORY FULL NAME'}
                        </p>
                        {sig.title && <p className="text-[11px] text-slate-600 leading-tight">{sig.title}</p>}
                        {sig.organization && (
                          <p className="text-[11px] text-slate-500 leading-tight">{sig.organization}</p>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="h-20 border-2 border-dashed border-slate-200 rounded-lg flex items-center justify-center text-[11px] text-slate-400">
                      No left column signatures
                    </div>
                  )}
                </div>

                {/* Right Column Preview */}
                <div className="space-y-8">
                  {rightSignatories.length > 0 ? (
                    rightSignatories.map(sig => (
                      <div key={sig.id} className="space-y-1">
                        <p className="text-xs font-medium text-slate-700">{sig.label || 'Signature:'}</p>
                        <div className="h-10 border-b border-slate-800 flex items-end pb-1 w-full max-w-[280px]">
                          {/* Signature line / placeholder */}
                        </div>
                        <p className="text-xs font-bold uppercase tracking-tight text-slate-900 pt-0.5">
                          {sig.name || 'SIGNATORY FULL NAME'}
                        </p>
                        {sig.title && <p className="text-[11px] text-slate-600 leading-tight">{sig.title}</p>}
                        {sig.organization && (
                          <p className="text-[11px] text-slate-500 leading-tight">{sig.organization}</p>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="h-20 border-2 border-dashed border-slate-200 rounded-lg flex items-center justify-center text-[11px] text-slate-400">
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
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-xl">
            <h4 className="text-sm font-black text-slate-900">Save Signature Template</h4>
            <p className="text-xs text-slate-500">
              Save current signatories as a template so you can quickly load them in future report exports.
            </p>
            <input
              type="text"
              value={newPresetName}
              onChange={e => setNewPresetName(e.target.value)}
              placeholder="e.g. Treasury Standard Approval"
              className="w-full p-2.5 text-xs font-bold border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSavePresetModal(false)}
                className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSavePreset}
                disabled={!newPresetName.trim()}
                className="px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl shadow-2xs"
              >
                Save Preset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
