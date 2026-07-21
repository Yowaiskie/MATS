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
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-amber-50 rounded-lg text-amber-600 border border-amber-100 shrink-0 mt-0.5">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">Attendance Warning & Suspension Policy</h2>
            <p className="text-xs text-gray-500 mt-0.5">Configure dynamic absence thresholds, schedule filters, and evaluation durations.</p>
          </div>
        </div>
        {isDirty && (
          <span className="text-[11px] font-semibold text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-200 shrink-0 whitespace-nowrap">
            Unsaved changes
          </span>
        )}
      </div>

      <form onSubmit={handleSavePolicy} className="mt-6 space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="h-0.5 w-4 bg-amber-400 rounded-full"></div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">Absence Thresholds</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Warning Absence Threshold <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={1}
                  max={50}
                  required
                  value={policy.warningAbsenceThreshold}
                  onChange={(e) => setPolicy(p => ({ ...p, warningAbsenceThreshold: parseInt(e.target.value, 10) || 1 }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-shadow"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">Absences</span>
              </div>
              <p className="mt-1 text-xs text-gray-400">Triggers yellow warning badge in reports</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Suspension Absence Threshold <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={2}
                  max={100}
                  required
                  value={policy.suspensionAbsenceThreshold}
                  onChange={(e) => setPolicy(p => ({ ...p, suspensionAbsenceThreshold: parseInt(e.target.value, 10) || 2 }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-shadow"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">Absences</span>
              </div>
              <p className="mt-1 text-xs text-gray-400">Triggers red suspension badge in reports</p>
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="h-0.5 w-4 bg-blue-400 rounded-full"></div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">Evaluation Window</h3>
          </div>
          <div className="max-w-md">
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Evaluation Period Duration <span className="text-red-500">*</span>
            </label>
            <select
              value={policy.evaluationMonths}
              onChange={(e) => setPolicy(p => ({ ...p, evaluationMonths: parseInt(e.target.value, 10) }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-shadow cursor-pointer bg-white"
            >
              <option value={1}>1 Month (Last 30 days)</option>
              <option value={2}>2 Months (Last 60 days)</option>
              <option value={3}>3 Months (Quarterly / 90 days)</option>
              <option value={6}>6 Months (Semi-annual)</option>
              <option value={0}>All Time (Entire Schedule History)</option>
            </select>
            <p className="mt-1 text-xs text-gray-400">Time window of schedule history evaluated for absences.</p>
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="h-0.5 w-4 bg-purple-400 rounded-full"></div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">Categories to Track</h3>
          </div>
          <p className="text-xs text-gray-400 mb-3">Select which schedule categories count towards absence thresholds. Each category is evaluated independently.</p>

          <div className="space-y-2">
            <div className="flex items-center justify-between py-3 px-4 rounded-lg border border-gray-200 bg-gray-50/50 hover:bg-gray-50 transition-colors min-h-[52px]">
              <div className="flex items-center gap-3">
                <span className="text-blue-600 shrink-0">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </span>
                <div>
                  <span className="text-sm font-semibold text-gray-900">Sunday Mass / Services</span>
                  <p className="text-xs text-gray-500">Track absences for Sunday schedules</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-3">
                <input
                  type="checkbox"
                  checked={policy.includeSundays}
                  onChange={(e) => setPolicy(p => ({ ...p, includeSundays: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between py-3 px-4 rounded-lg border border-gray-200 bg-gray-50/50 hover:bg-gray-50 transition-colors min-h-[52px]">
              <div className="flex items-center gap-3">
                <span className="text-teal-600 shrink-0">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </span>
                <div>
                  <span className="text-sm font-semibold text-gray-900">Weekday Mass / Services</span>
                  <p className="text-xs text-gray-500">Track absences for Monday–Saturday schedules</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-3">
                <input
                  type="checkbox"
                  checked={policy.includeWeekdays}
                  onChange={(e) => setPolicy(p => ({ ...p, includeWeekdays: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-teal-500/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-teal-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between py-3 px-4 rounded-lg border border-gray-200 bg-gray-50/50 hover:bg-gray-50 transition-colors min-h-[52px]">
              <div className="flex items-center gap-3">
                <span className="text-purple-600 shrink-0">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </span>
                <div>
                  <span className="text-sm font-semibold text-gray-900">Meetings & Assemblies</span>
                  <p className="text-xs text-gray-500">Track absences for General Meetings & Assemblies</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-3">
                <input
                  type="checkbox"
                  checked={policy.includeMeetings}
                  onChange={(e) => setPolicy(p => ({ ...p, includeMeetings: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-500/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
            </div>
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-4 border-t border-gray-100">
          <button
            type="submit"
            disabled={saving || !isDirty}
            className="w-full sm:w-auto rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-40 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed px-6 py-2.5 text-sm font-bold text-white transition-colors shadow-sm cursor-pointer min-h-[44px]"
          >
            {saving ? 'Saving Rules...' : 'Save Policy Settings'}
          </button>
        </div>
      </form>
    </Card>
  )
}
