import React, { useState, useEffect } from 'react'
import { Card, Button, CustomSelect } from '@/components'
import { settingsService, DEFAULT_POLICY_SETTINGS, POLICY_PRESETS } from '@/services/settingsService'
import type { SuspensionPolicySettings } from '@/services/settingsService'
import { publicationService } from '@/services/publicationService'
import type { SchedulePublication } from '@/types/publication'

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
  const [publications, setPublications] = useState<SchedulePublication[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const loadPolicy = async () => {
    setLoading(true)
    try {
      const [fetchedPolicy, fetchedPubs] = await Promise.all([
        settingsService.getPolicySettings(),
        publicationService.getPublications().catch(() => [])
      ])
      setPolicy(fetchedPolicy)
      setOriginalPolicy(fetchedPolicy)
      setPublications(fetchedPubs)
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
  const activePublication = publications.find(p => p.status === 'published')

  const handleDurationChange = (val: number) => {
    setPolicy(p => {
      let warning = p.warningAbsenceThreshold
      let suspension = p.suspensionAbsenceThreshold

      // Smart auto-adjustment for standard duration defaults
      if (val === 1) {
        if (p.suspensionAbsenceThreshold === 5 || p.suspensionAbsenceThreshold === 7) {
          warning = 2
          suspension = 3
        }
      } else if (val === 2) {
        if (p.suspensionAbsenceThreshold === 3 || p.suspensionAbsenceThreshold === 7) {
          warning = 3
          suspension = 5
        }
      } else if (val === 3) {
        if (p.suspensionAbsenceThreshold === 3 || p.suspensionAbsenceThreshold === 5) {
          warning = 4
          suspension = 7
        }
      }

      return {
        ...p,
        evaluationMonths: val,
        evaluationMonthStr: '',
        warningAbsenceThreshold: warning,
        suspensionAbsenceThreshold: suspension
      }
    })
  }

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
            <p className="text-xs text-gray-500 mt-0.5">Configure dynamic absence thresholds, 2-month publication scheduling rules, and evaluation durations.</p>
          </div>
        </div>
        {isDirty && (
          <span className="text-[11px] font-semibold text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-200 shrink-0 whitespace-nowrap">
            Unsaved changes
          </span>
        )}
      </div>

      <form onSubmit={handleSavePolicy} className="mt-6 space-y-6">
        {/* Active Publication Sync Notification Banner */}
        {activePublication && (
          <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-start gap-2.5">
              <div className="p-1.5 bg-indigo-600 text-white rounded-xl shrink-0 mt-0.5 shadow-2xs">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-indigo-950">{activePublication.name}</span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">Active Published</span>
                </div>
                <p className="text-[11px] text-indigo-700 font-medium mt-0.5">
                  Coverage: {activePublication.startDate} to {activePublication.endDate} (2-Month Schedule Cycle)
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setPolicy(p => ({
                  ...p,
                  evaluationMonths: 2,
                  evaluationMonthStr: '',
                  warningAbsenceThreshold: 3,
                  suspensionAbsenceThreshold: 5
                }))
              }}
              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-2xs shrink-0 cursor-pointer transition-all self-start sm:self-auto"
            >
              Sync 2-Month Policy (3/5)
            </button>
          </div>
        )}

        {/* Smart Policy Presets */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <div className="h-0.5 w-4 bg-indigo-500 rounded-full"></div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">Quick Policy Presets</h3>
            </div>
            <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
              One-Click Setup
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {POLICY_PRESETS.map((preset) => {
              const isMatch = policy.evaluationMonths === preset.evaluationMonths &&
                policy.warningAbsenceThreshold === preset.warningAbsenceThreshold &&
                policy.suspensionAbsenceThreshold === preset.suspensionAbsenceThreshold &&
                !policy.evaluationMonthStr

              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    setPolicy(p => ({
                      ...p,
                      evaluationMonths: preset.evaluationMonths,
                      evaluationMonthStr: '',
                      warningAbsenceThreshold: preset.warningAbsenceThreshold,
                      suspensionAbsenceThreshold: preset.suspensionAbsenceThreshold
                    }))
                  }}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                    isMatch
                      ? 'bg-indigo-50/90 border-indigo-500 text-indigo-950 ring-1 ring-indigo-500/50 shadow-2xs font-bold'
                      : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-xs font-bold text-slate-900">{preset.name}</span>
                    <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                      preset.id === 'preset_2_months'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      {preset.badge}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium leading-tight">
                    {preset.description}
                  </p>
                </button>
              )
            })}
          </div>
        </div>

        {/* Absence Thresholds */}
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
              <p className="mt-1 text-xs text-gray-400">Triggers yellow warning badge in reports (Default: 3 for 2-month cycle)</p>
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
              <p className="mt-1 text-xs text-gray-400">Triggers red suspension badge in reports (Default: at least 5 for 2-month cycle)</p>
            </div>
          </div>

          {/* Ratio Explanatory Note */}
          {policy.evaluationMonths === 2 && (
            <div className="mt-3 p-3 rounded-xl bg-amber-50/70 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
              <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>
                <strong>2-Month Publication Policy Active:</strong> Members will receive a <strong>Warning at {policy.warningAbsenceThreshold} absences</strong> and will only be marked <strong>Suspended upon reaching {policy.suspensionAbsenceThreshold} absences</strong> across the 2-month schedule period.
              </span>
            </div>
          )}
        </div>

        {/* Evaluation Window */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="h-0.5 w-4 bg-blue-400 rounded-full"></div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">Evaluation Window</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Evaluation Calendar Month Picker
              </label>
              <div className="relative">
                <input
                  type="month"
                  value={policy.evaluationMonthStr || ''}
                  onChange={(e) => setPolicy(p => ({ ...p, evaluationMonthStr: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-shadow cursor-pointer bg-white font-medium"
                />
              </div>
              <p className="mt-1 text-xs text-gray-400">Pick a specific calendar month (e.g. July 2026)</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Or Duration (Months) <span className="text-red-500">*</span>
              </label>
              <CustomSelect
                value={String(policy.evaluationMonths)}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                  const val = parseInt(e.target.value, 10)
                  handleDurationChange(val)
                }}
                options={[
                  { value: '1', label: '1 Month (Last 30 Days / Standard)' },
                  { value: '2', label: '2 Months (Last 60 Days / Publication Cycle)' },
                  { value: '3', label: '3 Months (Quarterly / 90 Days)' },
                  { value: '4', label: '4 Months' },
                  { value: '5', label: '5 Months' },
                  { value: '6', label: '6 Months (Semi-annual)' },
                  { value: '9', label: '9 Months' },
                  { value: '12', label: '12 Months (1 Year)' },
                  { value: '0', label: 'All Time (No cutoff date)' }
                ]}
              />
              <p className="mt-1 text-xs text-gray-400">Relative sliding timeframe (2 Months recommended for bi-monthly schedules)</p>
            </div>
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

        {/* Dynamic Unsuspension Clearance & Scheduling Rules */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="h-0.5 w-4 bg-emerald-500 rounded-full"></div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">Suspension Clearance & Scheduling Guardrails</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/60 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-black text-slate-900 block">Require Monthly Meeting Attendance for Clearance</span>
                  <p className="text-[11px] text-slate-500">Suspended member must attend monthly meetings across the set number of months</p>
                </div>
                <input
                  type="checkbox"
                  checked={policy.unsuspensionRequiresMeeting ?? true}
                  onChange={(e) => setPolicy(p => ({ ...p, unsuspensionRequiresMeeting: e.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 accent-emerald-600 cursor-pointer"
                />
              </div>
              {(policy.unsuspensionRequiresMeeting ?? true) && (
                <div className="flex items-center justify-between pt-1 border-t border-gray-200/60 text-xs">
                  <span className="font-bold text-slate-700">Required Meeting Months:</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={1}
                      max={12}
                      value={policy.unsuspensionRequiredMeetingMonths ?? policy.unsuspensionRequiredMeetingCount ?? 1}
                      onChange={(e) => {
                        const val = Math.max(1, parseInt(e.target.value, 10) || 1)
                        setPolicy(p => ({ ...p, unsuspensionRequiredMeetingMonths: val, unsuspensionRequiredMeetingCount: val }))
                      }}
                      className="w-16 p-1 text-center font-bold border border-slate-300 rounded-lg bg-white"
                    />
                    <span className="text-[11px] text-slate-500 font-semibold">Month(s)</span>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/60 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-black text-slate-900 block">Require Formation (OGF) Attendance</span>
                  <p className="text-[11px] text-slate-500">Suspended member must attend formation session before clearance</p>
                </div>
                <input
                  type="checkbox"
                  checked={policy.unsuspensionRequiresFormation ?? false}
                  onChange={(e) => setPolicy(p => ({ ...p, unsuspensionRequiresFormation: e.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 accent-emerald-600 cursor-pointer"
                />
              </div>
              {policy.unsuspensionRequiresFormation && (
                <div className="flex items-center justify-between pt-1 border-t border-gray-200/60 text-xs">
                  <span className="font-bold text-slate-700">Required Formation Count:</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={1}
                      max={12}
                      value={policy.unsuspensionRequiredFormationCount ?? 1}
                      onChange={(e) => setPolicy(p => ({ ...p, unsuspensionRequiredFormationCount: Math.max(1, parseInt(e.target.value, 10) || 1) }))}
                      className="w-16 p-1 text-center font-bold border border-slate-300 rounded-lg bg-white"
                    />
                    <span className="text-[11px] text-slate-500 font-semibold">Session(s)</span>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/60 flex items-start justify-between">
              <div>
                <span className="text-xs font-black text-slate-900 block">Prompt Admin on Scheduling Suspended Member</span>
                <p className="text-[11px] text-slate-500">System asks for confirmation before assigning a suspended member to a Mass schedule</p>
              </div>
              <input
                type="checkbox"
                checked={policy.autoPromptOnSchedulingSuspended ?? true}
                onChange={(e) => setPolicy(p => ({ ...p, autoPromptOnSchedulingSuspended: e.target.checked }))}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 accent-indigo-600 cursor-pointer"
              />
            </div>

            <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/60 flex items-start justify-between">
              <div>
                <span className="text-xs font-black text-slate-900 block">Exclude Suspended from Mass Schedules (Allow Meetings)</span>
                <p className="text-[11px] text-slate-500">Suspended servers are excluded from Sunday & Weekday Mass scheduling, but remain eligible for Meetings</p>
              </div>
              <input
                type="checkbox"
                checked={policy.excludeSuspendedFromAutoAssign ?? true}
                onChange={(e) => setPolicy(p => ({ ...p, excludeSuspendedFromAutoAssign: e.target.checked }))}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 accent-indigo-600 cursor-pointer"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-4 border-t border-gray-100">
          <Button
            type="submit"
            variant="primary"
            size="default"
            loading={saving}
            disabled={!isDirty}
            className="w-full sm:w-auto min-h-[44px] !bg-amber-600 hover:!bg-amber-700"
          >
            Save Policy Settings
          </Button>
        </div>
      </form>
    </Card>
  )
}
