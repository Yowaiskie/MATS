import React, { useState, useEffect } from 'react'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { FormInput } from '@/components/FormInput'
import { settingsService } from '@/services/settingsService'
import type { ExcusePolicySettings } from '@/types/excuse'
import { DEFAULT_EXCUSE_POLICY_SETTINGS } from '@/types/excuse'
import { useAuth } from '@/features/authentication/AuthContext'

interface ExcusePolicySettingsCardProps {
  onNotifySuccess?: (msg: string) => void
  onNotifyError?: (msg: string) => void
}

const PRESET_WINDOWS = [
  { days: 3, label: '3 Days', desc: 'Strict (Weekend buffer)' },
  { days: 7, label: '7 Days', desc: 'Recommended (1-week buffer)' },
  { days: 14, label: '14 Days', desc: 'Moderate (2-week buffer)' },
  { days: 30, label: '30 Days', desc: 'Generous (Monthly buffer)' }
]

export const ExcusePolicySettingsCard: React.FC<ExcusePolicySettingsCardProps> = ({
  onNotifySuccess,
  onNotifyError
}) => {
  const { profile, user } = useAuth()
  const [policy, setPolicy] = useState<ExcusePolicySettings>(DEFAULT_EXCUSE_POLICY_SETTINGS)
  const [initialPolicy, setInitialPolicy] = useState<ExcusePolicySettings>(DEFAULT_EXCUSE_POLICY_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const loadSettings = async () => {
    setLoading(true)
    try {
      const data = await settingsService.getExcusePolicySettings()
      setPolicy(data)
      setInitialPolicy(data)
    } catch (err) {
      console.error('Failed to load excuse policy settings:', err)
      onNotifyError?.('Failed to load excuse policy settings.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSettings()
  }, [])

  const isDirty =
    policy.allowPublicPastExcuses !== initialPolicy.allowPublicPastExcuses ||
    policy.publicPastWindowDays !== initialPolicy.publicPastWindowDays ||
    policy.requireReason !== initialPolicy.requireReason ||
    policy.minimumReasonLength !== initialPolicy.minimumReasonLength

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()

    if (policy.allowPublicPastExcuses && (policy.publicPastWindowDays < 1 || policy.publicPastWindowDays > 90)) {
      onNotifyError?.('Past schedule window must be between 1 and 90 days.')
      return
    }

    if (policy.requireReason && policy.minimumReasonLength < 1) {
      onNotifyError?.('Minimum reason length must be at least 1 character.')
      return
    }

    setSaving(true)
    try {
      const performedBy = profile?.displayName || profile?.email || user?.email || 'Admin'
      await settingsService.saveExcusePolicySettings(policy, performedBy)
      setInitialPolicy(policy)
      onNotifySuccess?.('Excuse policy settings saved successfully!')
    } catch (err: any) {
      console.error('Failed to save excuse policy settings:', err)
      onNotifyError?.(err.message || 'Failed to save excuse policy settings.')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    setPolicy(DEFAULT_EXCUSE_POLICY_SETTINGS)
  }

  if (loading) {
    return (
      <Card>
        <div className="py-16 flex flex-col items-center justify-center space-y-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
          <span className="text-xs text-slate-500 font-medium">Loading excuse policy parameters...</span>
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-6">
      <form onSubmit={handleSave} className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </span>
              <h2 className="text-base font-black text-slate-900 tracking-tight">Excuse Submission Policy</h2>
            </div>
            <p className="text-xs font-semibold text-slate-500">
              Control altar server excuse filing rules, past schedule allowances, and public link display limits.
            </p>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {isDirty && (
              <span className="text-[11px] font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                Unsaved Changes
              </span>
            )}
            <Button
              type="submit"
              variant="primary"
              size="dense"
              loading={saving}
              loadingText="Saving..."
              disabled={!isDirty || saving}
            >
              Save Policy
            </Button>
          </div>
        </div>

        {/* Section 1: Public Past Excuse Allowance Toggle */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-0.5 w-4 bg-indigo-500 rounded-full" />
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
              1. Public Portal Past Schedule Allowance
            </h3>
          </div>

          <div className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/50 hover:bg-slate-50 transition-colors space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <label htmlFor="allowPublicPastExcuses" className="text-xs font-black text-slate-900 cursor-pointer">
                  Allow Public Excuse Filing for Past Schedules (Missed Duties)
                </label>
                <p className="text-xs text-slate-500 leading-relaxed">
                  When enabled, altar servers can select and submit excuses for duties that already occurred within the configured window limit.
                  When disabled, the public link strictly permits excuses for today and upcoming duties.
                </p>
              </div>

              <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
                <input
                  id="allowPublicPastExcuses"
                  type="checkbox"
                  checked={policy.allowPublicPastExcuses}
                  onChange={(e) =>
                    setPolicy((prev) => ({
                      ...prev,
                      allowPublicPastExcuses: e.target.checked
                    }))
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600" />
              </label>
            </div>

            {policy.allowPublicPastExcuses ? (
              <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs font-bold text-emerald-900">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <span>
                  Public filing for past missed duties is <strong>ENABLED</strong> within the window limit below.
                </span>
              </div>
            ) : (
              <div className="p-3 bg-slate-100 border border-slate-200 rounded-xl flex items-center gap-2 text-xs font-bold text-slate-700">
                <span className="w-2 h-2 rounded-full bg-slate-400 shrink-0" />
                <span>
                  Public filing for past schedules is <strong>DISABLED</strong>. Only upcoming and current duties are listed on the public link.
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Section 2: Public Past Duty Window Limit */}
        <div className={`space-y-3 transition-opacity ${policy.allowPublicPastExcuses ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
          <div className="flex items-center gap-2">
            <div className="h-0.5 w-4 bg-amber-500 rounded-full" />
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
              2. Past Duty Window Limit (Days)
            </h3>
          </div>

          <div className="space-y-3">
            <p className="text-xs text-slate-500">
              Specify how many days in the past the public link should look for missed duties.
              Prevents the portal from displaying duties from months or years ago.
            </p>

            {/* Quick Preset Pills */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {PRESET_WINDOWS.map((preset) => {
                const isSelected = policy.publicPastWindowDays === preset.days
                return (
                  <button
                    key={preset.days}
                    type="button"
                    onClick={() =>
                      setPolicy((prev) => ({
                        ...prev,
                        publicPastWindowDays: preset.days
                      }))
                    }
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-amber-50/90 border-amber-500 text-amber-950 ring-1 ring-amber-500 font-bold shadow-2xs'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-black text-slate-900">{preset.label}</span>
                      {preset.days === 7 && (
                        <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-600 text-white">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 leading-tight">{preset.desc}</p>
                  </button>
                )
              })}
            </div>

            {/* Direct Number Input */}
            <div className="max-w-xs">
              <label htmlFor="publicPastWindowDays" className="block text-xs font-bold text-slate-700 mb-1">
                Custom Window (Days) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <FormInput
                  id="publicPastWindowDays"
                  type="number"
                  min={1}
                  max={90}
                  value={policy.publicPastWindowDays}
                  onChange={(e) =>
                    setPolicy((prev) => ({
                      ...prev,
                      publicPastWindowDays: Math.max(1, Math.min(90, parseInt(e.target.value, 10) || 1))
                    }))
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                  Days Ago
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Permitted range: 1 to 90 days (Recommended: 7 days).
              </p>
            </div>
          </div>
        </div>

        {/* Section 3: Reason Requirement */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-0.5 w-4 bg-blue-500 rounded-full" />
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
              3. Absence Reason Validation
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/50 space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="requireReason" className="text-xs font-black text-slate-900 cursor-pointer">
                  Require Excuse Reason
                </label>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    id="requireReason"
                    type="checkbox"
                    checked={policy.requireReason}
                    onChange={(e) =>
                      setPolicy((prev) => ({
                        ...prev,
                        requireReason: e.target.checked
                      }))
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
                </label>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Requires the server or officer to submit an explanation before the form can be submitted.
              </p>
            </div>

            <div className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/50 space-y-2">
              <label htmlFor="minimumReasonLength" className="block text-xs font-black text-slate-900">
                Minimum Reason Length (Characters)
              </label>
              <FormInput
                id="minimumReasonLength"
                type="number"
                min={1}
                max={50}
                value={policy.minimumReasonLength}
                onChange={(e) =>
                  setPolicy((prev) => ({
                    ...prev,
                    minimumReasonLength: Math.max(1, Math.min(50, parseInt(e.target.value, 10) || 1))
                  }))
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
              <p className="text-[11px] text-slate-500">
                Prevents empty or one-word excuse reasons (Default: 5 characters).
              </p>
            </div>
          </div>
        </div>

        {/* Section 4: Admin / Officer Filing Exemption Banner */}
        <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200/80 flex items-start gap-3">
          <div className="p-1.5 rounded-lg bg-indigo-100 text-indigo-700 shrink-0 mt-0.5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="space-y-1 text-xs">
            <h4 className="font-black text-indigo-950">Admin & Officer Exemption</h4>
            <p className="text-indigo-800 leading-relaxed">
              Coordinators and officers filing via <strong>&quot;+ File Member Excuse&quot;</strong> in the admin portal are
              <strong> never restricted</strong> by the public portal&apos;s window limit. Any past assignment can always be excused
              and directly approved by authorized officers to maintain accurate records.
            </p>
          </div>
        </div>

        {/* Section 5: Current Configuration Summary & Actions */}
        <div className="p-4 rounded-2xl bg-slate-900 text-white space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Active Policy Summary
            </span>
            <button
              type="button"
              onClick={handleReset}
              className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
            >
              Reset to Defaults
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700">
              <span className="text-slate-400 text-[10px] block">Public Past Schedules</span>
              <span className={`font-black ${policy.allowPublicPastExcuses ? 'text-emerald-400' : 'text-slate-400'}`}>
                {policy.allowPublicPastExcuses ? `Allowed (Last ${policy.publicPastWindowDays} days)` : 'Disabled'}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700">
              <span className="text-slate-400 text-[10px] block">Admin Past Filing</span>
              <span className="font-black text-indigo-300">Always Allowed (Full History)</span>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700">
              <span className="text-slate-400 text-[10px] block">Reason Validation</span>
              <span className="font-black text-amber-300">
                {policy.requireReason ? `Required (Min ${policy.minimumReasonLength} chars)` : 'Optional'}
              </span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
          <Button
            type="submit"
            variant="primary"
            size="default"
            loading={saving}
            loadingText="Saving Policy..."
            disabled={!isDirty || saving}
          >
            Save Excuse Policy Settings
          </Button>
        </div>
      </form>
    </Card>
  )
}
