import React, { useState, useEffect } from 'react'
import { Card } from '@/components/Card'
import { settingsService, DEFAULT_POLICY_SETTINGS } from '@/services/settingsService'
import type { SuspensionPolicySettings } from '@/services/settingsService'

interface PolicySettingsCardProps {
  onNotifySuccess: (msg: string) => void
  onNotifyError: (msg: string) => void
}

export const PolicySettingsCard: React.FC<PolicySettingsCardProps> = ({
  onNotifySuccess,
  onNotifyError,
}) => {
  const [policy, setPolicy] = useState<SuspensionPolicySettings>(DEFAULT_POLICY_SETTINGS)
  const [originalPolicy, setOriginalPolicy] = useState<SuspensionPolicySettings>(DEFAULT_POLICY_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const loadPolicy = async () => {
    setLoading(true)
    try {
      const fetched = await settingsService.getPolicySettings()
      setPolicy(fetched)
      setOriginalPolicy(fetched)
    } catch (err: any) {
      console.error(err)
      onNotifyError('Failed to load attendance policy settings.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPolicy()
  }, [])

  const isDirty = JSON.stringify(policy) !== JSON.stringify(originalPolicy)

  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault()
    if (policy.warningAbsenceThreshold <= 0) {
      onNotifyError('Warning threshold must be at least 1 absence.')
      return
    }
    if (policy.suspensionAbsenceThreshold <= policy.warningAbsenceThreshold) {
      onNotifyError('Suspension threshold must be greater than Warning threshold.')
      return
    }

    setSaving(true)
    try {
      await settingsService.savePolicySettings(policy)
      setOriginalPolicy(policy)
      onNotifySuccess('Attendance & Suspension Policy Settings saved successfully!')
    } catch (err: any) {
      console.error(err)
      onNotifyError(err.message || 'Failed to save policy settings.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center space-x-2 py-6">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
          <span className="text-xs text-gray-500">Loading policy rules...</span>
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-6 border border-gray-200 shadow-xs">
      <div className="flex items-center justify-between pb-4 border-b border-gray-100">
        <div className="flex items-center space-x-2.5">
          <span className="p-2 bg-amber-50 rounded-lg text-amber-600 border border-amber-100">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </span>
          <div>
            <h2 className="text-base font-bold text-gray-900">Attendance Warning & Suspension Policy</h2>
            <p className="text-xs text-gray-500">Configure dynamic absence thresholds, schedule filters, and evaluation durations.</p>
          </div>
        </div>

        {isDirty && (
          <span className="text-[11px] font-semibold text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-200">
            Unsaved changes
          </span>
        )}
      </div>

      <form onSubmit={handleSavePolicy} className="mt-5 space-y-5 text-xs text-gray-800">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Warning Threshold */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
              Warning Absence Threshold *
            </label>
            <div className="relative">
              <input
                type="number"
                min={1}
                max={50}
                required
                value={policy.warningAbsenceThreshold}
                onChange={(e) => setPolicy(p => ({ ...p, warningAbsenceThreshold: parseInt(e.target.value, 10) || 1 }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-800 focus:outline-none focus:border-amber-500"
              />
              <span className="absolute right-3 top-2 text-xs text-gray-400">Absences</span>
            </div>
            <p className="mt-1 text-[10px] text-gray-400">Triggers 🟡 Warning for Suspension badge in reports.</p>
          </div>

          {/* Suspension Threshold */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
              Suspension Absence Threshold *
            </label>
            <div className="relative">
              <input
                type="number"
                min={2}
                max={100}
                required
                value={policy.suspensionAbsenceThreshold}
                onChange={(e) => setPolicy(p => ({ ...p, suspensionAbsenceThreshold: parseInt(e.target.value, 10) || 2 }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-800 focus:outline-none focus:border-red-500"
              />
              <span className="absolute right-3 top-2 text-xs text-gray-400">Absences</span>
            </div>
            <p className="mt-1 text-[10px] text-gray-400">Triggers 🔴 Suspended badge in reports.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Schedule Day Scope Filter — replaced with 3 category toggles */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
              Evaluation Period Duration *
            </label>
            <select
              value={policy.evaluationMonths}
              onChange={(e) => setPolicy(p => ({ ...p, evaluationMonths: parseInt(e.target.value, 10) }))}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-800 focus:outline-none focus:border-blue-500 cursor-pointer bg-white"
            >
              <option value={1}>1 Month (Last 30 days)</option>
              <option value={2}>2 Months (Last 60 days)</option>
              <option value={3}>3 Months (Quarterly / 90 days)</option>
              <option value={6}>6 Months (Semi-annual)</option>
              <option value={0}>All Time (Entire Schedule History)</option>
            </select>
            <p className="mt-1 text-[10px] text-gray-400">Time window of schedule history evaluated for absences.</p>
          </div>
        </div>

        {/* Category Toggles */}
        <div className="pt-3 border-t border-gray-100 space-y-3">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">
              Categories to Track
            </label>
            <p className="text-[10px] text-gray-400 mb-3">Select which schedule categories count towards absence thresholds. Each category is evaluated independently.</p>
          </div>

          {/* Include Sundays */}
          <div className="flex items-center justify-between py-2 px-3 rounded-lg border border-gray-100 bg-gray-50/50">
            <div className="flex items-center gap-2">
              <span className="text-blue-600">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </span>
              <div>
                <label className="text-xs font-bold text-gray-900 block">Sunday Mass / Services</label>
                <p className="text-[10px] text-gray-500">Track absences for Sunday schedules</p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={policy.includeSundays}
              onChange={(e) => setPolicy(p => ({ ...p, includeSundays: e.target.checked }))}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
          </div>

          {/* Include Weekdays */}
          <div className="flex items-center justify-between py-2 px-3 rounded-lg border border-gray-100 bg-gray-50/50">
            <div className="flex items-center gap-2">
              <span className="text-teal-600">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </span>
              <div>
                <label className="text-xs font-bold text-gray-900 block">Weekday Mass / Services</label>
                <p className="text-[10px] text-gray-500">Track absences for Monday–Saturday schedules</p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={policy.includeWeekdays}
              onChange={(e) => setPolicy(p => ({ ...p, includeWeekdays: e.target.checked }))}
              className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
            />
          </div>

          {/* Include Meetings */}
          <div className="flex items-center justify-between py-2 px-3 rounded-lg border border-gray-100 bg-gray-50/50">
            <div className="flex items-center gap-2">
              <span className="text-purple-600">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </span>
              <div>
                <label className="text-xs font-bold text-gray-900 block">Meetings & Assemblies</label>
                <p className="text-[10px] text-gray-500">Track absences for General Meetings & Assemblies</p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={policy.includeMeetings}
              onChange={(e) => setPolicy(p => ({ ...p, includeMeetings: e.target.checked }))}
              className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end pt-3 border-t border-gray-100">
          <button
            type="submit"
            disabled={saving || !isDirty}
            className="rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-40 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed px-5 py-2 text-xs font-bold text-white transition-colors shadow-sm cursor-pointer"
          >
            {saving ? 'Saving Rules...' : 'Save Policy Settings'}
          </button>
        </div>
      </form>
    </Card>
  )
}
