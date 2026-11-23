import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { EventForm, EventFormQuestion } from '@/types/eventForm'
import { eventFormQuestionService } from '@/services/eventFormQuestionService'
import { eventFormResponseService } from '@/services/eventFormResponseService'
import { buildAppointmentSlotKey, buildSlotCountMapKey } from '@/utils/eventFormSlots'
import { Modal, Loading, Button, useToast } from '@/components'

interface EventFormSlotStatusModalProps {
  isOpen: boolean
  onClose: () => void
  form: EventForm
  onOpenResponses?: () => void
}

type AvailabilityFilter = 'all' | 'available' | 'full'

export const EventFormSlotStatusModal: React.FC<EventFormSlotStatusModalProps> = ({
  isOpen,
  onClose,
  form,
  onOpenResponses
}) => {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [questions, setQuestions] = useState<EventFormQuestion[]>([])
  const [slotCountsMap, setSlotCountsMap] = useState<Record<string, number>>({})
  const [filter, setFilter] = useState<AvailabilityFilter>('all')
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string>('')

  const loadSlotStatus = useCallback(
    async (isManualRefresh: boolean = false) => {
      if (!form.id) return
      if (isManualRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }
      setError(null)
      try {
        const [qs, counts] = await Promise.all([
          queryClient.fetchQuery({
            queryKey: ['event-form-questions', form.id],
            queryFn: () => eventFormQuestionService.getQuestionsByFormId(form.id!),
            staleTime: 1000 * 60 * 3
          }),
          eventFormResponseService.getSlotCountsByFormId(form.id)
        ])
        setQuestions(qs)
        setSlotCountsMap(counts)
        setLastUpdatedAt(
          new Date().toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            second: '2-digit'
          })
        )
      } catch (err) {
        console.error('Failed to load quick slot status:', err)
        setError(err instanceof Error ? err.message : 'Failed to load slot availability.')
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [form.id, queryClient]
  )

  useEffect(() => {
    if (isOpen) {
      loadSlotStatus(false)
    }
  }, [isOpen, loadSlotStatus])

  const handleSyncCounters = async () => {
    if (!form.id || syncing) return
    setSyncing(true)
    try {
      const result = await eventFormResponseService.reconcileSlotCountsForForm(form.id)
      await loadSlotStatus(true)
      toast.success(
        'Slot Counts Synced',
        `Synchronized ${result.syncedSlots} slot counter(s) across ${result.totalResponses} response(s).`
      )
    } catch (err) {
      console.error('Failed to sync slot counters:', err)
      toast.error('Sync Failed', err instanceof Error ? err.message : 'Failed to synchronize slot counters.')
    } finally {
      setSyncing(false)
    }
  }

  const appointmentQuestions = useMemo(
    () =>
      questions.filter(
        q => q.type === 'appointment_slots' && q.appointmentConfig && q.appointmentConfig.length > 0
      ),
    [questions]
  )

  const optionLimitQuestions = useMemo(
    () => questions.filter(q => q.optionLimits && Object.keys(q.optionLimits).length > 0),
    [questions]
  )

  const summary = useMemo(() => {
    let totalCapacity = 0
    let totalBooked = 0
    let totalSlots = 0
    let fullSlots = 0

    appointmentQuestions.forEach(q => {
      ;(q.appointmentConfig || []).forEach(dateCfg => {
        dateCfg.slots.forEach(slot => {
          const maxCap = slot.maxCapacity || 0
          if (maxCap <= 0) return
          const slotKey = buildAppointmentSlotKey(dateCfg.date, slot.id)
          const mapKey = buildSlotCountMapKey(q.id, 'appointment', slotKey)
          const booked = slotCountsMap[mapKey] ?? 0
          totalSlots += 1
          totalCapacity += maxCap
          totalBooked += Math.min(booked, maxCap)
          if (booked >= maxCap) fullSlots += 1
        })
      })
    })

    optionLimitQuestions.forEach(q => {
      ;(q.options || []).forEach(opt => {
        const maxCap = q.optionLimits?.[opt] || 0
        if (maxCap <= 0) return
        const mapKey = buildSlotCountMapKey(q.id, 'option', opt)
        const booked = slotCountsMap[mapKey] ?? 0
        totalSlots += 1
        totalCapacity += maxCap
        totalBooked += Math.min(booked, maxCap)
        if (booked >= maxCap) fullSlots += 1
      })
    })

    return {
      totalCapacity,
      totalBooked,
      totalAvailable: Math.max(0, totalCapacity - totalBooked),
      totalSlots,
      fullSlots
    }
  }, [appointmentQuestions, optionLimitQuestions, slotCountsMap])

  const formatDateHeading = (dateStr: string, label?: string) => {
    try {
      const d = new Date(dateStr + 'T00:00:00')
      const formatted = d.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })
      return label ? `${label} (${formatted})` : formatted
    } catch {
      return label ? `${label} (${dateStr})` : dateStr
    }
  }

  const hasAnyLimitedSlots = appointmentQuestions.length > 0 || optionLimitQuestions.length > 0

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Quick Slot Availability"
      subtitle={form.title}
      badge="Lightweight Live Counter"
      maxWidth="3xl"
      icon={
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      }
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2 w-full">
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="dense"
              onClick={() => loadSlotStatus(true)}
              disabled={refreshing || loading}
              className="min-h-10"
              icon={
                <svg className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              }
            >
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
            {hasAnyLimitedSlots && (
              <button
                type="button"
                onClick={handleSyncCounters}
                disabled={syncing || loading}
                className="min-h-10 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-600 transition cursor-pointer disabled:opacity-50"
                title="Recalculate counters from actual responses (one-time repair for older forms)"
              >
                {syncing ? 'Syncing...' : 'Sync Counters'}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {onOpenResponses && (
              <Button
                variant="secondary"
                size="dense"
                className="min-h-10"
                onClick={() => {
                  onClose()
                  onOpenResponses()
                }}
              >
                View Full Responses
              </Button>
            )}
            <Button variant="primary" size="dense" className="min-h-10" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      }
    >
      {loading ? (
        <div className="py-12">
          <Loading variant="spinner" label="Loading slot availability..." />
        </div>
      ) : error ? (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-800">
          {error}
        </div>
      ) : !hasAnyLimitedSlots ? (
        <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5">
          <p className="text-sm font-black text-slate-800">No Slot Limits Configured</p>
          <p className="text-xs text-slate-500">
            This form has no Appointment Slots or Option Capacity Limits yet.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Summary KPI Strip */}
          <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200/80">
              <div className="text-[10px] font-black uppercase tracking-wider text-emerald-700">
                Available Left
              </div>
              <div className="text-2xl font-black text-emerald-900 mt-0.5">
                {summary.totalAvailable}
              </div>
              <div className="text-[11px] font-semibold text-emerald-700/80">
                of {summary.totalCapacity} total seats
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-indigo-50 border border-indigo-200/80">
              <div className="text-[10px] font-black uppercase tracking-wider text-indigo-700">
                Total Booked
              </div>
              <div className="text-2xl font-black text-indigo-950 mt-0.5">
                {summary.totalBooked}
              </div>
              <div className="text-[11px] font-semibold text-indigo-700/80">
                {summary.totalCapacity > 0
                  ? `${Math.round((summary.totalBooked / summary.totalCapacity) * 100)}% filled`
                  : '0% filled'}
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                Full Slots
              </div>
              <div className="text-2xl font-black text-slate-900 mt-0.5">
                {summary.fullSlots}
                <span className="text-sm font-bold text-slate-400"> / {summary.totalSlots}</span>
              </div>
              <div className="text-[11px] font-semibold text-slate-500 truncate">
                {lastUpdatedAt ? `Updated ${lastUpdatedAt}` : 'Live counter'}
              </div>
            </div>
          </div>

          {/* Quick Filter Pills */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200/80">
              {(
                [
                  { id: 'all', label: 'All Slots' },
                  { id: 'available', label: 'Available Only' },
                  { id: 'full', label: 'Full Only' }
                ] as { id: AvailabilityFilter; label: string }[]
              ).map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    filter === tab.id
                      ? 'bg-white text-indigo-700 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Appointment Slots Breakdown */}
          {appointmentQuestions.map(q => (
            <div key={q.id} className="space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">
                {q.question}
              </h4>

              {(q.appointmentConfig || []).map(dateCfg => {
                const visibleSlots = dateCfg.slots.filter(slot => {
                  const maxCap = slot.maxCapacity || 0
                  if (maxCap <= 0) return filter !== 'full'
                  const slotKey = buildAppointmentSlotKey(dateCfg.date, slot.id)
                  const booked = slotCountsMap[buildSlotCountMapKey(q.id, 'appointment', slotKey)] ?? 0
                  const isFull = booked >= maxCap
                  if (filter === 'available') return !isFull
                  if (filter === 'full') return isFull
                  return true
                })

                if (visibleSlots.length === 0) return null

                const dateRemaining = dateCfg.slots.reduce((sum, slot) => {
                  const maxCap = slot.maxCapacity || 0
                  if (maxCap <= 0) return sum
                  const slotKey = buildAppointmentSlotKey(dateCfg.date, slot.id)
                  const booked = slotCountsMap[buildSlotCountMapKey(q.id, 'appointment', slotKey)] ?? 0
                  return sum + Math.max(0, maxCap - booked)
                }, 0)

                return (
                  <div
                    key={dateCfg.id || dateCfg.date}
                    className="bg-slate-50/75 border border-slate-200/80 rounded-2xl p-3.5 space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-black text-slate-800">
                        {formatDateHeading(dateCfg.date, dateCfg.label)}
                      </span>
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-white border border-slate-200 text-slate-700">
                        {dateRemaining} left
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {visibleSlots.map(slot => {
                        const maxCap = slot.maxCapacity || 0
                        const hasCap = maxCap > 0
                        const slotKey = buildAppointmentSlotKey(dateCfg.date, slot.id)
                        const booked = slotCountsMap[buildSlotCountMapKey(q.id, 'appointment', slotKey)] ?? 0
                        const left = hasCap ? Math.max(0, maxCap - booked) : null
                        const isFull = hasCap && left === 0
                        const isLow = hasCap && left !== null && left > 0 && left <= 3
                        const percent = hasCap ? Math.min(100, Math.round((booked / maxCap) * 100)) : 0

                        return (
                          <div
                            key={slot.id}
                            className={`p-3 rounded-xl border bg-white space-y-2 ${
                              isFull
                                ? 'border-rose-200 bg-rose-50/40'
                                : isLow
                                ? 'border-amber-200 bg-amber-50/30'
                                : 'border-slate-200/90'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="text-xs font-black text-slate-900">
                                  {slot.startTime} - {slot.endTime}
                                </div>
                                {slot.label && (
                                  <div className="text-[11px] font-semibold text-slate-500 truncate">
                                    {slot.label}
                                  </div>
                                )}
                              </div>

                              {hasCap ? (
                                <span
                                  className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-black border ${
                                    isFull
                                      ? 'bg-rose-100 text-rose-700 border-rose-200'
                                      : isLow
                                      ? 'bg-amber-100 text-amber-800 border-amber-200'
                                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  }`}
                                >
                                  {isFull ? 'FULL' : `${left} left`}
                                </span>
                              ) : (
                                <span className="shrink-0 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                  Unlimited
                                </span>
                              )}
                            </div>

                            {hasCap && (
                              <div className="space-y-1">
                                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all ${
                                      isFull
                                        ? 'bg-rose-500'
                                        : isLow
                                        ? 'bg-amber-500'
                                        : 'bg-emerald-500'
                                    }`}
                                    style={{ width: `${percent}%` }}
                                  />
                                </div>
                                <div className="flex items-center justify-between text-[10px] font-bold text-slate-500">
                                  <span>{booked} / {maxCap} booked</span>
                                  <span>{percent}%</span>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}

          {/* Option Limits Breakdown */}
          {optionLimitQuestions.map(q => {
            const visibleOptions = (q.options || []).filter(opt => {
              const maxCap = q.optionLimits?.[opt] || 0
              if (maxCap <= 0) return false
              const booked = slotCountsMap[buildSlotCountMapKey(q.id, 'option', opt)] ?? 0
              const isFull = booked >= maxCap
              if (filter === 'available') return !isFull
              if (filter === 'full') return isFull
              return true
            })

            if (visibleOptions.length === 0) return null

            return (
              <div key={q.id} className="space-y-2.5">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">
                  {q.question}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {visibleOptions.map(opt => {
                    const maxCap = q.optionLimits?.[opt] || 0
                    const booked = slotCountsMap[buildSlotCountMapKey(q.id, 'option', opt)] ?? 0
                    const left = Math.max(0, maxCap - booked)
                    const isFull = left === 0
                    const isLow = left > 0 && left <= 3
                    const percent = Math.min(100, Math.round((booked / maxCap) * 100))

                    return (
                      <div
                        key={opt}
                        className={`p-3 rounded-xl border bg-white space-y-2 ${
                          isFull
                            ? 'border-rose-200 bg-rose-50/40'
                            : isLow
                            ? 'border-amber-200 bg-amber-50/30'
                            : 'border-slate-200/90'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-black text-slate-900 truncate" title={opt}>
                            {opt}
                          </span>
                          <span
                            className={`shrink-0 px-2.5 py-0.5 rounded-full text-[11px] font-black border ${
                              isFull
                                ? 'bg-rose-100 text-rose-700 border-rose-200'
                                : isLow
                                ? 'bg-amber-100 text-amber-800 border-amber-200'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }`}
                          >
                            {isFull ? 'FULL' : `${left} left`}
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              isFull ? 'bg-rose-500' : isLow ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[10px] font-bold text-slate-500">
                          <span>{booked} / {maxCap} booked</span>
                          <span>{percent}%</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Modal>
  )
}
