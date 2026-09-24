import React, { useState, useEffect } from 'react'
import { Card, Button } from '@/components'
import { settingsService } from '@/services/settingsService'
import { DEFAULT_ORDER_ROTATION_SETTINGS } from '@/types/orderRotation'
import type { OrderRotationSettings } from '@/types/orderRotation'

interface OrderRotationSettingsCardProps {
  onNotifySuccess: (msg: string) => void
  onNotifyError: (msg: string) => void
}

const ORDER_COLOR_MAP: Record<string, { bg: string; text: string; border: string; badge: string }> = {
  'Order of San Pedro': { bg: 'bg-red-50/80', text: 'text-red-900', border: 'border-red-200', badge: 'bg-red-600 text-white' },
  'Order of San Juan': { bg: 'bg-blue-50/80', text: 'text-blue-900', border: 'border-blue-200', badge: 'bg-blue-600 text-white' },
  'Order of San Tiago': { bg: 'bg-emerald-50/80', text: 'text-emerald-900', border: 'border-emerald-200', badge: 'bg-emerald-600 text-white' },
  'Order of San Andres': { bg: 'bg-amber-50/80', text: 'text-amber-900', border: 'border-amber-200', badge: 'bg-amber-500 text-white' }
}

export const OrderRotationSettingsCard: React.FC<OrderRotationSettingsCardProps> = ({
  onNotifySuccess,
  onNotifyError,
}) => {
  const [settings, setSettings] = useState<OrderRotationSettings>(DEFAULT_ORDER_ROTATION_SETTINGS)
  const [originalSettings, setOriginalSettings] = useState<OrderRotationSettings>(DEFAULT_ORDER_ROTATION_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [newKeyword, setNewKeyword] = useState('')

  const loadSettings = async () => {
    setLoading(true)
    try {
      const data = await settingsService.getOrderRotationSettings()
      setSettings(data)
      setOriginalSettings(data)
    } catch (err: any) {
      console.error(err)
      onNotifyError('Failed to load Order Rotation settings.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSettings()
  }, [])

  const isDirty = JSON.stringify(settings) !== JSON.stringify(originalSettings)

  const handleMoveOrder = (index: number, direction: 'up' | 'down') => {
    const newSeq = [...settings.rotationSequence]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= newSeq.length) return
    const temp = newSeq[index]
    newSeq[index] = newSeq[targetIndex]
    newSeq[targetIndex] = temp
    setSettings(prev => ({ ...prev, rotationSequence: newSeq }))
  }

  const handleResetDefaultSequence = () => {
    setSettings(prev => ({
      ...prev,
      rotationSequence: [...DEFAULT_ORDER_ROTATION_SETTINGS.rotationSequence]
    }))
  }

  const handleAddKeyword = () => {
    const trimmed = newKeyword.trim().toLowerCase()
    if (!trimmed) return
    if (settings.targetKeywords.includes(trimmed)) {
      setNewKeyword('')
      return
    }
    setSettings(prev => ({
      ...prev,
      targetKeywords: [...prev.targetKeywords, trimmed]
    }))
    setNewKeyword('')
  }

  const handleRemoveKeyword = (kw: string) => {
    setSettings(prev => ({
      ...prev,
      targetKeywords: prev.targetKeywords.filter(k => k !== kw)
    }))
  }

  const handleToggleHolyHourCategory = (checked: boolean) => {
    setSettings(prev => ({
      ...prev,
      targetCategories: checked
        ? Array.from(new Set([...prev.targetCategories, 'holy_hour']))
        : prev.targetCategories.filter(c => c !== 'holy_hour')
    }))
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (settings.rotationSequence.length === 0) {
      onNotifyError('Rotation sequence must contain at least one Order group.')
      return
    }

    setSaving(true)
    try {
      await settingsService.saveOrderRotationSettings(settings)
      setOriginalSettings(settings)
      onNotifySuccess('Order Groups rotation settings saved successfully!')
    } catch (err: any) {
      console.error(err)
      onNotifyError(err.message || 'Failed to save Order Rotation settings.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center space-x-2 py-6">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent"></div>
          <span className="text-xs text-gray-500">Loading order rotation rules...</span>
        </div>
      </Card>
    )
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600 border border-indigo-100 shrink-0 mt-0.5">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">Automatic Order Groups Rotation</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Configure automated sequential assignment for Holy Hour and Baptism schedules across parish Order Groups.
            </p>
          </div>
        </div>
        {isDirty && (
          <span className="text-[11px] font-semibold text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-200 shrink-0 whitespace-nowrap">
            Unsaved changes
          </span>
        )}
      </div>

      <form onSubmit={handleSave} className="mt-6 space-y-6">
        {/* Enable / Disable Toggle */}
        <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 flex items-center justify-between gap-4">
          <div>
            <span className="text-xs font-black text-slate-900 block">Enable Automated Order Rotation</span>
            <p className="text-[11px] text-slate-500 mt-0.5">
              When active, templates and bulk tools can automatically assign entire Order groups to Holy Hour and Baptism schedules.
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(e) => setSettings(s => ({ ...s, enabled: e.target.checked }))}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-500/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
          </label>
        </div>

        {/* Rotation Sequence */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="h-0.5 w-4 bg-indigo-500 rounded-full"></div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">Rotation Sequence (Continuous Order)</h3>
            </div>
            <button
              type="button"
              onClick={handleResetDefaultSequence}
              className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer hover:underline"
            >
              Reset to Default Sequence
            </button>
          </div>

          <div className="space-y-2">
            {settings.rotationSequence.map((groupName: string, idx: number) => {
              const styling = ORDER_COLOR_MAP[groupName] || {
                bg: 'bg-slate-50',
                text: 'text-slate-900',
                border: 'border-slate-200',
                badge: 'bg-slate-600 text-white'
              }

              return (
                <div
                  key={groupName}
                  className={`p-3 rounded-2xl border ${styling.border} ${styling.bg} flex items-center justify-between gap-3 shadow-2xs transition-all`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`h-6 w-6 rounded-lg ${styling.badge} flex items-center justify-center text-[10px] font-black shrink-0`}>
                      {idx + 1}
                    </span>
                    <div>
                      <span className={`text-xs font-black ${styling.text} block`}>{groupName}</span>
                      <span className="text-[10px] font-semibold text-slate-500">
                        Rotates to position {((idx + 1) % settings.rotationSequence.length) + 1} ({settings.rotationSequence[(idx + 1) % settings.rotationSequence.length]})
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMoveOrder(idx, 'up')}
                      className="p-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed text-slate-600 cursor-pointer"
                      title="Move up"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      disabled={idx === settings.rotationSequence.length - 1}
                      onClick={() => handleMoveOrder(idx, 'down')}
                      className="p-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed text-slate-600 cursor-pointer"
                      title="Move down"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Applicable Target Rules */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="h-0.5 w-4 bg-emerald-500 rounded-full"></div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">Target Categories & Schedule Matching</h3>
          </div>

          <div className="space-y-3">
            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 flex items-center justify-between gap-3">
              <div>
                <span className="text-xs font-black text-slate-900 block">Match Holy Hour Category (`holy_hour`)</span>
                <p className="text-[11px] text-slate-500">Apply continuous rotation whenever schedule category is set to Holy Hour</p>
              </div>
              <input
                type="checkbox"
                checked={settings.targetCategories.includes('holy_hour')}
                onChange={(e) => handleToggleHolyHourCategory(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 accent-indigo-600 cursor-pointer"
              />
            </div>

            {/* Keywords */}
            <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3 shadow-2xs">
              <div>
                <span className="text-xs font-black text-slate-900 block">Title Keyword Matchers</span>
                <p className="text-[11px] text-slate-500">
                  Any schedule whose title contains these keywords will be recognized as eligible for Order Groups rotation.
                </p>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {settings.targetKeywords.map((kw: string) => (
                  <span
                    key={kw}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-xs font-bold text-indigo-800"
                  >
                    <span>{kw}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveKeyword(kw)}
                      className="p-0.5 hover:bg-indigo-200/60 rounded text-indigo-500 hover:text-indigo-800 cursor-pointer"
                      title={`Remove keyword "${kw}"`}
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAddKeyword()
                    }
                  }}
                  placeholder="e.g. baptismal, binyag"
                  className="w-full sm:w-64 rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="dense"
                  onClick={handleAddKeyword}
                  className="text-xs shrink-0"
                >
                  Add Keyword
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-4 border-t border-gray-100">
          <Button
            type="submit"
            variant="primary"
            size="default"
            loading={saving}
            disabled={!isDirty}
            className="w-full sm:w-auto min-h-[44px] !bg-indigo-600 hover:!bg-indigo-700"
          >
            Save Order Rotation Settings
          </Button>
        </div>
      </form>
    </Card>
  )
}
