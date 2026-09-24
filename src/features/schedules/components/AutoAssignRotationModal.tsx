import React, { useState, useEffect, useMemo } from 'react'
import type { Schedule } from '@/types/schedule'
import type { Member } from '@/types/member'
import { getOrderBadgeStyle } from '@/types/member'
import type { OrderRotationSettings } from '@/types/orderRotation'
import { DEFAULT_ORDER_ROTATION_SETTINGS } from '@/types/orderRotation'
import { settingsService } from '@/services/settingsService'
import { orderRotationService } from '@/services/orderRotationService'
import { DatePicker, FilterDropdown } from '@/components'
import { useToast } from '@/context/ToastContext'
import { useAuth } from '@/features/authentication/AuthContext'
import { formatTime12Hour } from '@/utils/scheduleUtils'

interface AutoAssignRotationModalProps {
  isOpen: boolean
  onClose: () => void
  schedules: Schedule[]
  activeMembers: Member[]
  defaultMonthStr?: string // e.g. '2026-10'
  onSuccess: () => Promise<void>
}

export const AutoAssignRotationModal: React.FC<AutoAssignRotationModalProps> = ({
  isOpen,
  onClose,
  schedules,
  activeMembers,
  defaultMonthStr,
  onSuccess
}) => {
  const { profile } = useAuth()
  const { toast } = useToast()

  const [settings, setSettings] = useState<OrderRotationSettings>(DEFAULT_ORDER_ROTATION_SETTINGS)
  const [startingGroup, setStartingGroup] = useState<string>('Order of San Pedro')
  const [serviceFilter, setServiceFilter] = useState<'all' | 'holy_hour' | 'binyag'>('all')
  const [overwriteExisting, setOverwriteExisting] = useState<boolean>(false)
  const [applying, setApplying] = useState<boolean>(false)

  // Date Range filter mode inside modal
  const [dateRangeMode, setDateRangeMode] = useState<'month' | 'range'>('month')
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    if (defaultMonthStr) return defaultMonthStr
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  const [startDate, setStartDate] = useState<string>(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  })
  const [endDate, setEndDate] = useState<string>(() => {
    const now = new Date()
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  })

  // Load rotation settings on mount/open
  useEffect(() => {
    if (isOpen) {
      const loadSettings = async () => {
        try {
          const s = await settingsService.getOrderRotationSettings()
          setSettings(s)
          if (s.rotationSequence && s.rotationSequence.length > 0) {
            setStartingGroup(s.rotationSequence[0])
          }
        } catch (err) {
          console.error('Failed to load order rotation settings:', err)
        }
      }
      loadSettings()
    }
  }, [isOpen])

  // Filter schedules within chosen date boundary
  const scopedSchedules = useMemo(() => {
    return schedules.filter(s => {
      if (dateRangeMode === 'month') {
        return s.date.startsWith(selectedMonth)
      } else {
        if (startDate && s.date < startDate) return false
        if (endDate && s.date > endDate) return false
        return true
      }
    })
  }, [schedules, dateRangeMode, selectedMonth, startDate, endDate])

  // Active custom settings considering service filter
  const activeSettings = useMemo(() => {
    let customKeywords = [...settings.targetKeywords]
    let customCategories = [...settings.targetCategories]

    if (serviceFilter === 'holy_hour') {
      customKeywords = ['Holy Hour', 'Adoration']
      customCategories = ['holy_hour']
    } else if (serviceFilter === 'binyag') {
      customKeywords = ['Binyag', 'Baptism']
      customCategories = []
    }

    return {
      ...settings,
      targetKeywords: customKeywords,
      targetCategories: customCategories
    }
  }, [settings, serviceFilter])

  // Compute live rotation plan
  const rotationPlan = useMemo(() => {
    return orderRotationService.computeRotationPlan(
      scopedSchedules,
      activeMembers,
      activeSettings,
      startingGroup
    )
  }, [scopedSchedules, activeMembers, activeSettings, startingGroup])

  const unassignedCount = rotationPlan.filter(p => !p.isAlreadyAssigned).length
  const willUpdateCount = overwriteExisting ? rotationPlan.length : unassignedCount

  const handleApply = async () => {
    if (rotationPlan.length === 0) return
    setApplying(true)
    try {
      const actor = profile?.email || 'Admin'
      const { updatedCount, skippedCount } = await orderRotationService.applyRotationPlan(
        rotationPlan,
        overwriteExisting,
        actor
      )

      toast.success(
        'Order Rotation Applied',
        `Successfully assigned ${updatedCount} schedule(s) across rotating Order Groups.${skippedCount > 0 ? ` (${skippedCount} already assigned schedules were preserved)` : ''}`
      )

      await onSuccess()
      onClose()
    } catch (err: any) {
      console.error(err)
      toast.error('Assignment Failed', err.message || 'Failed to apply order rotation assignments.')
    } finally {
      setApplying(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md transition-opacity" onClick={onClose} />

      {/* Modal Container */}
      <div className="relative w-full max-w-3xl rounded-3xl border border-slate-200/80 bg-white p-6 shadow-2xl z-10 text-slate-800 flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 bg-white">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-extrabold text-sm shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100 inline-block">
                  Auto-Assign Engine
                </span>
                <span className="text-xs font-bold text-slate-400">
                  • Holy Hour & Binyag
                </span>
              </div>
              <h3 className="text-base font-black text-slate-900 tracking-tight mt-0.5">
                Order Groups Automatic Rotation Assigner
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer focus:outline-none"
            aria-label="Close modal"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content Body */}
        <div className="mt-4 flex-1 space-y-4 overflow-y-auto pr-1">
          {/* 1. Sequence Banner */}
          <div className="p-3.5 rounded-2xl bg-indigo-50/60 border border-indigo-100/90 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-black text-indigo-950">Rotation Sequence:</span>
              {(settings.rotationSequence || DEFAULT_ORDER_ROTATION_SETTINGS.rotationSequence).map((grp, idx) => (
                <div key={grp} className="flex items-center gap-1.5">
                  <span className={`px-2 py-0.5 rounded-lg text-[11px] font-extrabold border ${getOrderBadgeStyle(grp)}`}>
                    {idx + 1}. {grp.replace('Order of ', '')}
                  </span>
                  {idx < (settings.rotationSequence || DEFAULT_ORDER_ROTATION_SETTINGS.rotationSequence).length - 1 && (
                    <svg className="w-3 h-3 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                </div>
              ))}
            </div>
            <span className="text-[10px] font-bold text-indigo-700 bg-white px-2 py-0.5 rounded-lg border border-indigo-200 shrink-0 self-start sm:self-auto shadow-2xs">
              Continuous Cycle
            </span>
          </div>

          {/* 2. Controls Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-2xl border border-slate-200/80 bg-slate-50/50">
            {/* Date Scope */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Target Scope
                </label>
                <button
                  type="button"
                  onClick={() => setDateRangeMode(prev => prev === 'month' ? 'range' : 'month')}
                  className="text-[10px] font-bold text-indigo-600 hover:underline cursor-pointer"
                >
                  Switch to {dateRangeMode === 'month' ? 'Range' : 'Month'}
                </button>
              </div>

              {dateRangeMode === 'month' ? (
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 shadow-2xs cursor-pointer"
                />
              ) : (
                <div className="grid grid-cols-2 gap-1.5">
                  <DatePicker
                    value={startDate}
                    onChange={setStartDate}
                    placeholder="Start"
                    size="dense"
                  />
                  <DatePicker
                    value={endDate}
                    onChange={setEndDate}
                    placeholder="End"
                    size="dense"
                  />
                </div>
              )}
            </div>

            {/* Target Services */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Target Services
              </label>
              <FilterDropdown
                value={serviceFilter}
                onChange={val => setServiceFilter(val as any)}
                options={[
                  { key: 'all', label: 'All (Holy Hour & Binyag)', dot: 'bg-indigo-500' },
                  { key: 'holy_hour', label: 'Holy Hour Only', dot: 'bg-amber-500' },
                  { key: 'binyag', label: 'Binyag / Baptism Only', dot: 'bg-blue-500' }
                ]}
              />
            </div>

            {/* Starting Group */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Starting Order Group
              </label>
              <FilterDropdown
                value={startingGroup}
                onChange={setStartingGroup}
                options={(settings.rotationSequence || DEFAULT_ORDER_ROTATION_SETTINGS.rotationSequence).map(grp => ({
                  key: grp,
                  label: grp,
                  dot: 'bg-purple-500'
                }))}
              />
            </div>
          </div>

          {/* 3. Overwrite Toggle & Plan Overview Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-slate-900">
                Timeline Preview ({rotationPlan.length} matching schedules found)
              </span>
              <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                {unassignedCount} unassigned
              </span>
            </div>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={overwriteExisting}
                onChange={e => setOverwriteExisting(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 accent-indigo-600 cursor-pointer"
              />
              <span className="text-xs font-bold text-slate-700">
                Overwrite schedules that already have servers
              </span>
            </label>
          </div>

          {/* 4. Interactive Timeline List */}
          <div className="border border-slate-200 rounded-2xl divide-y divide-slate-100 bg-white overflow-hidden shadow-2xs max-h-72 overflow-y-auto">
            {rotationPlan.length > 0 ? (
              rotationPlan.map((item, idx) => {
                return (
                  <div
                    key={item.scheduleId}
                    className={`p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                      item.isAlreadyAssigned && !overwriteExisting ? 'bg-slate-50/50 opacity-60' : 'hover:bg-slate-50/80'
                    }`}
                  >
                    {/* Left: Schedule details */}
                    <div className="flex items-center gap-3">
                      <span className="h-6 w-6 rounded-full bg-slate-100 text-slate-700 font-mono text-xs font-black flex items-center justify-center shrink-0">
                        #{idx + 1}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-slate-900">{item.scheduleTitle}</span>
                          <span className="text-[10px] font-bold text-slate-500">
                            {formatTime12Hour(item.startTime)} - {formatTime12Hour(item.endTime)}
                          </span>
                        </div>
                        <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
                          Date: <strong className="text-slate-800">{item.date}</strong>
                        </p>
                      </div>
                    </div>

                    {/* Right: Assigned Group & Status */}
                    <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-auto">
                      <div className="text-right">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-black border shadow-2xs ${getOrderBadgeStyle(item.assignedOrderGroup)}`}>
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                          </svg>
                          <span>{item.assignedOrderGroup}</span>
                        </span>

                        <div className="text-[10px] font-bold text-slate-500 mt-0.5">
                          {item.assignedMemberIds.length} Active Servers
                        </div>
                      </div>

                      {item.isAlreadyAssigned ? (
                        <span className={`px-2 py-1 rounded-lg text-[10px] font-bold ${
                          overwriteExisting
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}>
                          {overwriteExisting ? 'Will Reassign' : 'Preserved (Assigned)'}
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded-lg text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          Ready to Assign
                        </span>
                      )}
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="p-8 text-center">
                <svg className="w-8 h-8 text-slate-300 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-xs font-bold text-slate-700">No matching Holy Hour or Binyag schedules found</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Try adjusting the target date range or service filter above.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100 mt-4 bg-white">
          <span className="text-xs font-bold text-slate-600">
            {willUpdateCount > 0 ? (
              <span>Will assign <strong className="text-indigo-600">{willUpdateCount}</strong> schedule(s)</span>
            ) : (
              <span className="text-slate-400">No schedules to assign</span>
            )}
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={applying}
              className="rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-4 py-2 text-xs font-bold text-slate-700 transition-colors cursor-pointer shadow-2xs"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleApply}
              disabled={applying || willUpdateCount === 0}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 px-4.5 py-2 text-xs font-black text-white transition-all cursor-pointer shadow-md shadow-indigo-600/20"
            >
              {applying ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Applying Rotation...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Apply Group Assignments ({willUpdateCount})</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
