import React, { useState, useEffect } from 'react'
import { Card } from '@/components/Card'
import { settingsService } from '@/services/settingsService'
import { memberService } from '@/services/memberService'
import type { SignaturePreset, SignatoryItem } from '@/types/signature'
import {
  COMMON_SIGNATURE_LABELS,
  DEFAULT_PARISH_NAME,
  DEFAULT_MINISTRY_NAME,
  DEFAULT_SIGNATURE_PRESETS
} from '@/types/signature'
import type { Member } from '@/types/member'
import { useAuth } from '@/features/authentication/AuthContext'
import { ConfirmModal } from '@/components/Dialog'
import { MemberSearchDropdown } from '@/components/MemberSearchDropdown'

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

  // Load presets and members
  const loadData = async () => {
    setLoading(true)
    try {
      const [fetchedPresets, fetchedMembers] = await Promise.all([
        settingsService.getSignaturePresets(),
        memberService.getMembers(false)
      ])

      const list = fetchedPresets && fetchedPresets.length > 0 ? fetchedPresets : DEFAULT_SIGNATURE_PRESETS
      setPresets(list)
      setMembers(fetchedMembers)

      const initialId = list[0]?.id || ''
      setSelectedPresetId(initialId)
      const initialPreset = list.find(p => p.id === initialId) || null
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
      label: 'Noted by:',
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

  const handleCreateNewPreset = () => {
    const newPreset: SignaturePreset = {
      id: `preset-${Date.now()}`,
      name: `Custom Template ${presets.length + 1}`,
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
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
          <span className="text-xs text-gray-500">Loading signature presets...</span>
        </div>
      </Card>
    )
  }

  const leftSignatories = activePreset?.signatories.filter(s => s.column === 1 || !s.column) || []
  const rightSignatories = activePreset?.signatories.filter(s => s.column === 2) || []

  return (
    <div className="space-y-6">
      {/* Top Preset Tabs & Create New */}
      <Card className="p-4 border border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-black text-gray-900 uppercase tracking-tight">
              Report Signature Templates
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Create and manage default signature templates for Ministry Finance Reports, Event Form Exports, and Statements.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleCreateNewPreset}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-2xs transition cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              <span>+ New Preset Template</span>
            </button>
            <button
              type="button"
              onClick={() => setConfirmRestore(true)}
              className="px-3 py-2 text-xs font-bold text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-xl transition cursor-pointer"
            >
              Restore Defaults
            </button>
          </div>
        </div>

        {/* Preset Selector Pill Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pt-4 border-t border-gray-100 mt-3 pb-1">
          {presets.map(p => {
            const isSelected = selectedPresetId === p.id
            return (
              <div
                key={p.id}
                className={`inline-flex items-center rounded-xl border transition-all ${
                  isSelected
                    ? 'border-blue-600 bg-blue-600 text-white font-black shadow-md shadow-blue-500/25 ring-2 ring-blue-500/30'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300 font-bold shadow-2xs'
                }`}
              >
                <button
                  type="button"
                  onClick={() => handleSelectPreset(p.id)}
                  className="px-3.5 py-2 text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  {isSelected && (
                    <svg className="w-3.5 h-3.5 text-white stroke-[3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  <span>{p.name}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      isSelected ? 'bg-white/20 text-white font-black' : 'bg-gray-100 text-gray-500 font-bold'
                    }`}
                  >
                    {p.signatories.length}
                  </span>
                </button>
                {presets.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(p.id)}
                    className={`px-2.5 py-2 border-l transition cursor-pointer ${
                      isSelected
                        ? 'text-white/80 hover:text-white hover:bg-blue-700 border-blue-500'
                        : 'text-gray-400 hover:text-rose-600 hover:bg-rose-50 border-gray-200'
                    }`}
                    title="Delete preset"
                  >
                    &times;
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
            <Card className="p-4 border border-gray-200 space-y-4">
              {/* Preset Title Input */}
              <div>
                <label className="block text-xs font-black text-gray-800 uppercase tracking-wider mb-1">
                  Preset Template Name
                </label>
                <input
                  type="text"
                  value={activePreset.name}
                  onChange={e => handleUpdateActivePresetName(e.target.value)}
                  placeholder="e.g. Treasury Standard, General Approval"
                  className="w-full p-2.5 text-xs font-bold border border-gray-300 rounded-xl bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Signatories List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-gray-800 uppercase tracking-wider">
                    Signatory List ({activePreset.signatories.length})
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleAddSignatory(1)}
                      className="px-2.5 py-1 text-[11px] font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg cursor-pointer"
                    >
                      + Add Left Col
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddSignatory(2)}
                      className="px-2.5 py-1 text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg cursor-pointer"
                    >
                      + Add Right Col
                    </button>
                  </div>
                </div>

                <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                  {activePreset.signatories.map((sig, idx) => (
                    <div
                      key={sig.id}
                      className="p-3.5 rounded-xl border border-gray-200 bg-gray-50/60 hover:bg-white hover:border-gray-300 transition-all space-y-2.5 shadow-2xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200/60 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 flex items-center justify-center rounded-full bg-gray-200 text-[10px] font-black text-gray-700">
                            {idx + 1}
                          </span>
                          <span className="text-xs font-black text-gray-800">Signatory #{idx + 1}</span>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Column Selector */}
                          <div className="flex items-center rounded-lg border border-gray-200 bg-white p-0.5 text-[11px] font-bold">
                            <button
                              type="button"
                              onClick={() => handleUpdateSignatory(sig.id, { column: 1 })}
                              className={`px-2 py-0.5 rounded-md transition cursor-pointer ${
                                sig.column === 1 || !sig.column
                                  ? 'bg-blue-600 text-white font-black'
                                  : 'text-gray-600 hover:text-gray-900'
                              }`}
                            >
                              Left
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateSignatory(sig.id, { column: 2 })}
                              className={`px-2 py-0.5 rounded-md transition cursor-pointer ${
                                sig.column === 2
                                  ? 'bg-blue-600 text-white font-black'
                                  : 'text-gray-600 hover:text-gray-900'
                              }`}
                            >
                              Right
                            </button>
                          </div>

                          {/* Member Auto-fill */}
                          <div className="w-52">
                            <MemberSearchDropdown
                              members={members}
                              value=""
                              mode="id"
                              title="Auto-fill Signatory"
                              placeholder="Auto-fill member..."
                              allowClear={false}
                              onChange={(val) => {
                                if (val) handleSelectMember(sig.id, val)
                              }}
                            />
                          </div>

                          {/* Order Buttons */}
                          <button
                            type="button"
                            onClick={() => handleMoveSignatory(idx, 'up')}
                            disabled={idx === 0}
                            className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30 cursor-pointer"
                            title="Move Up"
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveSignatory(idx, 'down')}
                            disabled={idx === activePreset.signatories.length - 1}
                            className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30 cursor-pointer"
                            title="Move Down"
                          >
                            ▼
                          </button>

                          {/* Remove */}
                          <button
                            type="button"
                            onClick={() => handleRemoveSignatory(sig.id)}
                            className="p-1 px-2 text-[11px] font-bold text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                          >
                            Remove
                          </button>
                        </div>
                      </div>

                      {/* Fields */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                            Role / Prefix Label
                          </label>
                          <input
                            type="text"
                            value={sig.label}
                            onChange={e => handleUpdateSignatory(sig.id, { label: e.target.value })}
                            placeholder="e.g. Requesting officer:, Approved by:"
                            className="w-full p-2 text-xs font-semibold border border-gray-300 rounded-lg bg-white"
                          />
                          <div className="flex flex-wrap gap-1 mt-1">
                            {COMMON_SIGNATURE_LABELS.slice(0, 5).map(lbl => (
                              <button
                                key={lbl}
                                type="button"
                                onClick={() => handleUpdateSignatory(sig.id, { label: lbl })}
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border cursor-pointer ${
                                  sig.label === lbl
                                    ? 'bg-blue-50 border-blue-300 text-blue-700'
                                    : 'bg-white border-gray-200 text-gray-500 hover:text-gray-800'
                                }`}
                              >
                                {lbl}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                            Signatory Name (Bold in PDF)
                          </label>
                          <input
                            type="text"
                            value={sig.name}
                            onChange={e => handleUpdateSignatory(sig.id, { name: e.target.value })}
                            placeholder="e.g. Bro. CHRYSLER DAVID"
                            className="w-full p-2 text-xs font-bold uppercase border border-gray-300 rounded-lg bg-white"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                            Position / Title Line 1
                          </label>
                          <input
                            type="text"
                            value={sig.title}
                            onChange={e => handleUpdateSignatory(sig.id, { title: e.target.value })}
                            placeholder="e.g. Treasurer, Ministry of Altar Servers"
                            className="w-full p-2 text-xs font-medium border border-gray-300 rounded-lg bg-white"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                            Parish / Organization Line 2
                          </label>
                          <input
                            type="text"
                            value={sig.organization || ''}
                            onChange={e => handleUpdateSignatory(sig.id, { organization: e.target.value })}
                            placeholder={DEFAULT_PARISH_NAME}
                            className="w-full p-2 text-xs font-medium border border-gray-300 rounded-lg bg-white"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Save Button */}
              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleSaveAll}
                  disabled={saving || !activePreset.name.trim()}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-black text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl shadow-md shadow-blue-500/20 active:scale-95 transition cursor-pointer"
                >
                  {saving ? (
                    <span>Saving Presets...</span>
                  ) : (
                    <span>Save Template Changes</span>
                  )}
                </button>
              </div>
            </Card>
          </div>

          {/* Right Column: Live Mock Preview Card */}
          <div className="lg:col-span-5 flex flex-col min-h-0">
            <Card className="p-0 border border-gray-200 shadow-xs flex flex-col flex-1">
              <div className="shrink-0 px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                    Live PDF Signature Layout Preview
                  </h3>
                </div>
                <span className="text-[11px] font-bold text-gray-500">
                  {activePreset.signatories.length} Signatories
                </span>
              </div>

              <div className="flex-1 overflow-y-auto min-h-0 p-5 bg-slate-100">
                <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200 space-y-6 text-slate-900 font-sans">
                  {/* Left Column Preview */}
                  <div>
                    <span className="text-[10px] font-black uppercase text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                      Left Column ({leftSignatories.length})
                    </span>
                    <div className="mt-3 space-y-6">
                      {leftSignatories.length > 0 ? (
                        leftSignatories.map(sig => (
                          <div key={sig.id} className="space-y-1">
                            <p className="text-xs font-medium text-slate-700">{sig.label || 'Signature:'}</p>
                            <div className="h-9 border-b border-slate-800 flex items-end pb-1 w-full max-w-[240px]"></div>
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
                        <p className="text-[11px] text-slate-400 italic">No left column signatories</p>
                      )}
                    </div>
                  </div>

                  {/* Right Column Preview */}
                  <div className="pt-4 border-t border-slate-100">
                    <span className="text-[10px] font-black uppercase text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                      Right Column ({rightSignatories.length})
                    </span>
                    <div className="mt-3 space-y-6">
                      {rightSignatories.length > 0 ? (
                        rightSignatories.map(sig => (
                          <div key={sig.id} className="space-y-1">
                            <p className="text-xs font-medium text-slate-700">{sig.label || 'Signature:'}</p>
                            <div className="h-9 border-b border-slate-800 flex items-end pb-1 w-full max-w-[240px]"></div>
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
