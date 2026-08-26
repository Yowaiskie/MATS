import React, { useState, useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { scheduleService } from '@/services/scheduleService'
import { memberService } from '@/services/memberService'
import { publicationService } from '@/services/publicationService'
import type { Schedule } from '@/types/schedule'
import type { Member } from '@/types/member'
import type { SchedulePublication } from '@/types/publication'
import { getFullName } from '@/utils/member'
import { formatTime12Hour } from '@/utils/scheduleUtils'
import { AlertModal, ConfirmModal } from '@/components/Dialog'

interface SchedulePattern {
  id: string
  dayOfWeek: number
  dayName: string
  startTime: string
  scheduleIds: string[]
  assignedMembers: string[]
}

export const PublicSchedulePage: React.FC = () => {
  const { id: publicationId } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  
  const [publication, setPublication] = useState<SchedulePublication | null>(null)
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // User Selection State
  const [selectedMemberId, setSelectedMemberId] = useState('')
  const [nameSearchQuery, setNameSearchQuery] = useState('')
  const [isMemberPickerOpen, setIsMemberPickerOpen] = useState(false)
  const [selectedScheduleIds, setSelectedScheduleIds] = useState<Set<string>>(new Set())
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [limitModal, setLimitModal] = useState<{ title: string; message: string } | null>(null)
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false)



  const loadData = async () => {
    if (!publicationId) {
      setMessage({ type: 'error', text: 'No publication ID provided.' })
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const pub = await queryClient.fetchQuery({
        queryKey: ['publication', publicationId],
        queryFn: () => publicationService.getPublication(publicationId),
        staleTime: 0
      })
      if (!pub) {
        setMessage({ type: 'error', text: 'Publication link not found or invalid.' })
        setLoading(false)
        return
      }

      setPublication(pub)

      if (pub.status === 'draft') {
        setMessage({ type: 'error', text: 'Draft' })
        setLoading(false)
        return
      }

      const [schedList, memList] = await Promise.all([
        queryClient.fetchQuery({
          queryKey: ['public-schedules', pub.id, pub.startDate, pub.endDate],
          queryFn: () => scheduleService.getSchedulesByDateRange(pub.startDate, pub.endDate),
          staleTime: 0
        }),
        queryClient.fetchQuery({
          queryKey: ['public-active-members-non-squire'],
          queryFn: async () => {
            const allMembers = await memberService.getMembers()
            return allMembers.filter(m => {
              if (m.status !== 'active') return false
              const r = (m.rank || '').toLowerCase()
              const o = (m.order || '').toLowerCase()
              const p = (m.position || '').toLowerCase()
              return !(r.includes('squire') || o.includes('squire') || p.includes('squire'))
            })
          },
          staleTime: 1000 * 60 * 10 // 10 minutes cache
        })
      ])

      setMembers(memList)
      setSchedules(schedList)
    } catch (err) {
      console.error(err)
      setMessage({ type: 'error', text: 'Failed to load schedule data.' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [publicationId, queryClient])

  // Sync selected schedules when selected member changes
  useEffect(() => {
    if (!selectedMemberId) {
      setSelectedScheduleIds(new Set())
      return
    }
    const initial = new Set<string>()
    schedules.forEach(s => {
      if (s.assignedMembers?.includes(selectedMemberId)) {
        initial.add(s.id)
      }
    })
    setSelectedScheduleIds(initial)
  }, [selectedMemberId, schedules])

  // Filter schedules strictly by publication date range
  const publicationSchedules = useMemo(() => {
    if (!publication) return []
    return schedules.filter(s => 
      s.date >= publication.startDate && 
      s.date <= publication.endDate && 
      s.status !== 'cancelled'
    )
  }, [schedules, publication])

  // Group into patterns
  const { sundayPatterns, weekdayPatterns } = useMemo(() => {
    const patternMap = new Map<string, SchedulePattern>()

    publicationSchedules.forEach(s => {
      const d = new Date(s.date)
      const dayOfWeek = d.getDay()
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()
      const patternId = `${dayOfWeek}-${s.startTime}`

      if (!patternMap.has(patternId)) {
        patternMap.set(patternId, {
          id: patternId,
          dayOfWeek,
          dayName,
          startTime: s.startTime,
          scheduleIds: [],
          assignedMembers: []
        })
      }

      const pattern = patternMap.get(patternId)!
      pattern.scheduleIds.push(s.id)
      
      // Merge unique assigned members
      s.assignedMembers?.forEach(memId => {
        if (!pattern.assignedMembers.includes(memId)) {
          pattern.assignedMembers.push(memId)
        }
      })
    })

    const allPatterns = Array.from(patternMap.values())
    
    const getSortWeight = (p: SchedulePattern) => {
      // Anticipated mass on Saturday goes before Sunday
      if (p.dayOfWeek === 6 && p.startTime >= '16:00') return -1
      return p.dayOfWeek
    }

    // Sort by dayOfWeek (Sun=0, Mon=1...) then startTime
    allPatterns.sort((a, b) => {
      const weightA = getSortWeight(a)
      const weightB = getSortWeight(b)
      if (weightA !== weightB) return weightA - weightB
      return a.startTime.localeCompare(b.startTime)
    })

    return {
      sundayPatterns: allPatterns.filter(p => p.dayOfWeek === 0 || (p.dayOfWeek === 6 && p.startTime >= '16:00')),
      weekdayPatterns: allPatterns.filter(p => p.dayOfWeek !== 0 && !(p.dayOfWeek === 6 && p.startTime >= '16:00'))
    }
  }, [publicationSchedules])

  const memberMap = useMemo(() => {
    return new Map(members.map(m => [m.id, getFullName(m)]))
  }, [members])

  const maxRowsSunday = useMemo(() => {
    const configuredLimit = publication?.maxServersPerSundaySlot ?? 5
    let currentMaxAssigned = configuredLimit
    sundayPatterns.forEach(p => {
      if (p.assignedMembers.length > currentMaxAssigned) currentMaxAssigned = p.assignedMembers.length
    })
    return currentMaxAssigned
  }, [sundayPatterns, publication])

  const maxRowsWeekday = useMemo(() => {
    const configuredLimit = publication?.maxServersPerWeekdaySlot ?? 5
    let currentMaxAssigned = configuredLimit
    weekdayPatterns.forEach(p => {
      if (p.assignedMembers.length > currentMaxAssigned) currentMaxAssigned = p.assignedMembers.length
    })
    return currentMaxAssigned
  }, [weekdayPatterns, publication])

  const hasSubmitted = useMemo(() => {
    if (!publication || !selectedMemberId) return false
    return publication.submittedMembers?.includes(selectedMemberId) || false
  }, [publication, selectedMemberId])

  const isFinalized = publication?.status === 'archived'

  const availableMembers = useMemo(() => {
    if (!publication) return members
    // Member remains available unless they have submitted their schedule
    return members.filter(m => !publication.submittedMembers?.includes(m.id))
  }, [members, publication])

  const filteredAvailableMembers = useMemo(() => {
    const sorted = availableMembers.slice().sort((a, b) => a.lastName.localeCompare(b.lastName))
    if (!nameSearchQuery.trim()) return sorted
    const q = nameSearchQuery.toLowerCase().trim()
    return sorted.filter(m => 
      `${m.lastName}, ${m.firstName}`.toLowerCase().includes(q) ||
      `${m.firstName} ${m.lastName}`.toLowerCase().includes(q)
    )
  }, [availableMembers, nameSearchQuery])

  const selectedSundayCount = useMemo(() => {
    return sundayPatterns.filter(p => p.scheduleIds.some(id => selectedScheduleIds.has(id))).length
  }, [sundayPatterns, selectedScheduleIds])

  const selectedWeekdayCount = useMemo(() => {
    return weekdayPatterns.filter(p => p.scheduleIds.some(id => selectedScheduleIds.has(id))).length
  }, [weekdayPatterns, selectedScheduleIds])

  const selectedMemberName = useMemo(() => {
    if (!selectedMemberId) return ''
    const m = members.find(mem => mem.id === selectedMemberId)
    return m ? `${m.lastName}, ${m.firstName}` : ''
  }, [members, selectedMemberId])

  const { isQuotaMaxed, confirmModalMessage } = useMemo(() => {
    const maxSun = publication?.maxSundaysPerServer ?? 4
    const maxWk = publication?.maxWeekdaysPerServer ?? 8
    const hasSun = sundayPatterns.length > 0
    const hasWk = weekdayPatterns.length > 0

    const sunMaxed = !hasSun || selectedSundayCount >= maxSun
    const wkMaxed = !hasWk || selectedWeekdayCount >= maxWk
    const maxed = sunMaxed && wkMaxed

    let msg = ''
    if (maxed) {
      msg = `You have selected ${selectedSundayCount} Sunday(s) and ${selectedWeekdayCount} Weekday(s), reaching your maximum quota. Once saved, your submission will be finalized.`
    } else {
      msg = `You have currently selected ${selectedSundayCount}/${maxSun} Sunday(s) and ${selectedWeekdayCount}/${maxWk} Weekday(s). Since you haven't reached the full quota yet, your chosen slots will be saved and locked, and you can still select more slots later.`
    }

    return { isQuotaMaxed: maxed, confirmModalMessage: msg }
  }, [publication, sundayPatterns, weekdayPatterns, selectedSundayCount, selectedWeekdayCount])

  const handleCellClick = (patternId: string, isSunday: boolean) => {
    if (isFinalized) return
    if (hasSubmitted) return

    if (!selectedMemberId) {
      const errText = 'Please select your name first from the selection panel!'
      setMessage({ type: 'error', text: errText })
      setLimitModal({ title: 'Select Name First', message: errText })
      return
    }

    const patterns = isSunday ? sundayPatterns : weekdayPatterns
    const pattern = patterns.find(p => p.id === patternId)
    if (!pattern) return

    // Check if member is ALREADY saved in DB for this pattern/schedule slot
    const isAlreadySavedInDb = pattern.assignedMembers.includes(selectedMemberId)
    if (isAlreadySavedInDb) {
      const lockMsg = 'This schedule slot is already saved for you and cannot be un-selected.'
      setMessage({ type: 'error', text: lockMsg })
      setLimitModal({ title: 'Slot Locked', message: lockMsg })
      return
    }

    // Determine if pattern is selected in current draft selection
    const isSelected = pattern.scheduleIds.some(id => selectedScheduleIds.has(id))

    // Enforce limits when trying to add a new selection
    if (!isSelected && publication) {
      // 1. Per-Mass Slot Server Capacity Check
      const maxServersForSlot = isSunday 
        ? (publication.maxServersPerSundaySlot ?? 5) 
        : (publication.maxServersPerWeekdaySlot ?? 5)
      
      const currentAssignedCount = pattern.assignedMembers.length
      if (currentAssignedCount >= maxServersForSlot) {
        const capacityMsg = `Mass Slot Full: This ${isSunday ? 'Sunday' : 'Weekday'} Mass time slot already reached the maximum capacity of ${maxServersForSlot} server(s).`
        setMessage({ type: 'error', text: capacityMsg })
        setLimitModal({ title: 'Mass Slot Full', message: capacityMsg })
        return
      }

      // 2. Individual Per-Person Limits Check
      if (isSunday) {
        const currentSelectedCount = sundayPatterns.filter(p => p.scheduleIds.some(id => selectedScheduleIds.has(id))).length
        const max = publication.maxSundaysPerServer ?? 4
        if (currentSelectedCount >= max) {
          const limitMsg = `Personal Limit Reached: You can only select up to ${max} Sunday schedule(s) for yourself.`
          setMessage({ type: 'error', text: limitMsg })
          setLimitModal({ title: 'Sunday Personal Limit Reached', message: limitMsg })
          return
        }
      } else {
        const currentSelectedCount = weekdayPatterns.filter(p => p.scheduleIds.some(id => selectedScheduleIds.has(id))).length
        const max = publication.maxWeekdaysPerServer ?? 8
        if (currentSelectedCount >= max) {
          const limitMsg = `Personal Limit Reached: You can only select up to ${max} Weekday schedule(s) for yourself.`
          setMessage({ type: 'error', text: limitMsg })
          setLimitModal({ title: 'Weekday Personal Limit Reached', message: limitMsg })
          return
        }
      }
    }

    setSelectedScheduleIds(prev => {
      const next = new Set(prev)
      if (isSelected) {
        pattern.scheduleIds.forEach(id => next.delete(id))
      } else {
        pattern.scheduleIds.forEach(id => next.add(id))
      }
      return next
    })
    setMessage(null)
  }

  const handleOpenConfirmModal = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedMemberId) {
      setMessage({ type: 'error', text: 'Please select your name first from the selection panel.' })
      setLimitModal({ title: 'Select Name First', message: 'Please select your name from the selection panel before saving.' })
      return
    }

    if (selectedScheduleIds.size === 0) {
      const noSelectionMsg = 'Please select at least one Mass schedule slot from the table before saving.'
      setMessage({ type: 'error', text: noSelectionMsg })
      setLimitModal({ title: 'No Schedule Selected', message: noSelectionMsg })
      return
    }

    setConfirmSubmitOpen(true)
  }

  const handleConfirmedSave = async () => {
    setConfirmSubmitOpen(false)
    if (!selectedMemberId) return

    setSubmitting(true)
    setMessage(null)

    try {
      const selections = publicationSchedules.map(s => ({
        scheduleId: s.id,
        isSelected: selectedScheduleIds.has(s.id)
      }))

      await scheduleService.submitPublicScheduleSelections(selectedMemberId, selections)
      
      const maxSun = publication?.maxSundaysPerServer ?? 4
      const maxWk = publication?.maxWeekdaysPerServer ?? 8
      const hasSun = sundayPatterns.length > 0
      const hasWk = weekdayPatterns.length > 0

      const sunMaxed = !hasSun || selectedSundayCount >= maxSun
      const wkMaxed = !hasWk || selectedWeekdayCount >= maxWk
      const fullyCompleted = sunMaxed && wkMaxed

      if (publication && fullyCompleted) {
        await publicationService.markMemberSubmitted(publication.id, selectedMemberId)
        setMessage({ 
          type: 'success', 
          text: `Awesome! You have reached your quota (${selectedSundayCount} Sunday, ${selectedWeekdayCount} Weekday) and your submission is now finalized.` 
        })
      } else {
        setMessage({ 
          type: 'success', 
          text: `Your selections (${selectedSundayCount} Sunday, ${selectedWeekdayCount} Weekday) have been saved! Since you haven't reached the full quota yet, your name remains in the list so you can select the remaining slots later.` 
        })
      }

      // Refresh schedules and publication from backend
      await queryClient.invalidateQueries({ queryKey: ['publication', publicationId] })
      const updatedPub = await queryClient.fetchQuery({
        queryKey: ['publication', publicationId],
        queryFn: () => publicationService.getPublication(publicationId!),
        staleTime: 0
      })
      if (!updatedPub) throw new Error('Publication not found.')

      await queryClient.invalidateQueries({
        queryKey: ['public-schedules', updatedPub.id, updatedPub.startDate, updatedPub.endDate]
      })
      const updatedScheds = await queryClient.fetchQuery({
        queryKey: ['public-schedules', updatedPub.id, updatedPub.startDate, updatedPub.endDate],
        queryFn: () => scheduleService.getSchedulesByDateRange(updatedPub.startDate, updatedPub.endDate),
        staleTime: 0
      })

      setPublication(updatedPub)
      setSchedules(updatedScheds)

      if (fullyCompleted) {
        setSelectedMemberId('')
        setSelectedScheduleIds(new Set())
      }
    } catch (err: any) {
      console.error(err)
      setMessage({ type: 'error', text: err.message || 'Failed to save schedule.' })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    )
  }

  if ((!publication || publication.status === 'draft') && !loading) {
    const isDraft = publication?.status === 'draft'

    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4 font-sans relative overflow-hidden">
        {/* Background glow accents */}
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="bg-white max-w-lg w-full rounded-3xl shadow-xl p-8 sm:p-10 border border-slate-200/80 text-center relative z-10 animate-in fade-in zoom-in-95 duration-200">
          {/* Logo Header */}
          <div className="w-20 h-20 rounded-3xl overflow-hidden border-2 border-indigo-100 shadow-md flex items-center justify-center bg-white mx-auto mb-6 p-1">
            <img src="/favicon/favicon.png" alt="Ministry Logo" className="w-full h-full object-cover rounded-2xl" />
          </div>

          {/* Status Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider mb-4 border shadow-xs">
            {isDraft ? (
              <span className="bg-amber-50 text-amber-800 border-amber-200 flex items-center gap-1.5 px-3 py-1 rounded-full">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                Temporary Closed (Draft Stage)
              </span>
            ) : (
              <span className="bg-rose-50 text-rose-800 border-rose-200 flex items-center gap-1.5 px-3 py-1 rounded-full">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                Totally Closed / Link Invalid
              </span>
            )}
          </div>

          {/* Title */}
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mb-3">
            {isDraft ? 'Schedule Link Temporarily Closed' : 'Schedule Link Closed'}
          </h2>

          {/* Description & Explanation */}
          <div className="bg-slate-50 border border-slate-200/80 p-5 rounded-2xl text-left space-y-2 mb-6">
            {publication?.name && (
              <div className="text-xs font-black text-indigo-600 mb-1 uppercase tracking-wide">
                {publication.name}
              </div>
            )}
            <p className="text-xs font-medium text-slate-600 leading-relaxed">
              {isDraft ? (
                <>
                  Ang link na ito ay <strong>pansamantalang sarado (Temporary Closed)</strong> dahil kasalukuyan pa itong inihahanda at nasa <strong>Draft stage</strong> ng Ministry Administrator. 
                  <br /><br />
                  Mangyaring maghintay hanggang sa opisyal itong i-publish ng inyong coordinator.
                </>
              ) : (
                <>
                  Ang link na ito ay <strong>lubusan nang sarado (Totally Closed)</strong> o hindi na available. Maaring nag-expire na ang schedule period na ito o inalis na ng administrator.
                </>
              )}
            </p>
          </div>

          {/* Actions / Info footer */}
          <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400 font-bold">
            <span>Ministry of Altar Servers</span>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl transition cursor-pointer"
            >
              Refresh Page
            </button>
          </div>
        </div>
      </div>
    )
  }

  const renderTable = (patterns: SchedulePattern[], maxRows: number, isSunday: boolean, title: string, subtitle: string, icon: React.ReactNode) => {
    if (patterns.length === 0) return null

    const maxPerServer = isSunday ? (publication?.maxSundaysPerServer ?? 4) : (publication?.maxWeekdaysPerServer ?? 8)
    const currentCount = isSunday ? selectedSundayCount : selectedWeekdayCount

    return (
      <div className="mb-8 sm:mb-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 sm:mb-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-indigo-100/70 text-indigo-600 flex items-center justify-center shrink-0 shadow-xs">
              {icon}
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">{title}</h2>
              <p className="text-xs font-semibold text-slate-500">{subtitle}</p>
            </div>
          </div>

          {selectedMemberId && !hasSubmitted && (
            <div className="inline-flex items-center gap-2 self-start sm:self-auto bg-indigo-50 border border-indigo-200/80 px-3 py-1.5 rounded-xl text-xs font-bold text-indigo-900">
              <span>Your Limit:</span>
              <span className={`px-2 py-0.5 rounded-md font-extrabold ${currentCount >= maxPerServer ? 'bg-amber-100 text-amber-900' : 'bg-white text-indigo-700 shadow-xs'}`}>
                {currentCount} / {maxPerServer} Selected
              </span>
            </div>
          )}
        </div>

        {/* Horizontal scroll hint on mobile */}
        <div className="sm:hidden mb-2 flex items-center justify-between text-[11px] font-semibold text-slate-400 px-1">
          <span>👈 Swipe horizontally to view all times 👉</span>
          <span>{patterns.length} slots</span>
        </div>

        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-200">
            <table className="w-full border-collapse text-left min-w-max">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70">
                  <th className="px-3 sm:px-6 py-3.5 sm:py-5 font-extrabold text-[10px] sm:text-xs text-slate-400 uppercase tracking-widest w-16 sm:w-24 sticky left-0 bg-slate-100 sm:bg-slate-50/95 z-20 border-r border-slate-200/80 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.06)] text-center">
                    ROLE
                  </th>
                  {patterns.map(p => (
                    <th key={p.id} className="px-3 sm:px-6 py-3.5 sm:py-5 text-center min-w-[130px] sm:min-w-[170px]">
                      <div className="font-black text-xs text-slate-900 uppercase tracking-widest">{p.dayName}</div>
                      <div className="font-extrabold text-xs text-indigo-600 mt-0.5">{formatTime12Hour(p.startTime)}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {Array.from({ length: maxRows }).map((_, rowIndex) => (
                  <tr key={rowIndex} className="hover:bg-slate-50/40 transition-colors">
                    <td className="px-3 sm:px-6 py-3 sm:py-4 font-bold text-xs text-slate-400 uppercase sticky left-0 bg-white sm:bg-white/95 z-10 border-r border-slate-200/80 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.06)] text-center">
                      S-{rowIndex + 1}
                    </td>
                    {patterns.map(pattern => {
                      const isSelectedByCurrentMember = pattern.scheduleIds.some(id => selectedScheduleIds.has(id))
                      const savedMemberIds = pattern.assignedMembers
                      
                      const savedRowIndexForUser = savedMemberIds.indexOf(selectedMemberId)
                      const isSavedInDb = savedRowIndexForUser !== -1

                      let displayMemberName: string | null = null
                      let isMyCell = false
                      let isOtherUserCell = false

                      if (isSelectedByCurrentMember && selectedMemberId) {
                        if (isSavedInDb) {
                          if (rowIndex === savedRowIndexForUser) {
                            displayMemberName = memberMap.get(selectedMemberId) || null
                            isMyCell = true
                          } else if (savedMemberIds[rowIndex]) {
                            displayMemberName = memberMap.get(savedMemberIds[rowIndex]) || null
                            isOtherUserCell = true
                          }
                        } else {
                          const firstEmptyIndex = savedMemberIds.length
                          if (rowIndex === firstEmptyIndex) {
                            displayMemberName = memberMap.get(selectedMemberId) || null
                            isMyCell = true
                          } else if (savedMemberIds[rowIndex]) {
                            displayMemberName = memberMap.get(savedMemberIds[rowIndex]) || null
                            isOtherUserCell = true
                          }
                        }
                      } else if (!isSelectedByCurrentMember && isSavedInDb) {
                        if (savedMemberIds[rowIndex] && rowIndex !== savedRowIndexForUser) {
                          displayMemberName = memberMap.get(savedMemberIds[rowIndex]) || null
                          isOtherUserCell = true
                        }
                      } else if (savedMemberIds[rowIndex]) {
                        displayMemberName = memberMap.get(savedMemberIds[rowIndex]) || null
                        if (savedMemberIds[rowIndex] === selectedMemberId) {
                          isMyCell = true
                        } else {
                          isOtherUserCell = true
                        }
                      }

                      return (
                        <td key={pattern.id} className="px-2 sm:px-3 py-2.5 sm:py-3 text-center align-middle">
                          {displayMemberName ? (
                            <div
                              onClick={() => !isOtherUserCell && handleCellClick(pattern.id, isSunday)}
                              className={`inline-flex items-center justify-center px-2.5 sm:px-4 py-2 sm:py-3 rounded-xl sm:rounded-2xl border text-[11px] sm:text-xs font-bold transition-all select-none min-w-[120px] sm:min-w-[140px] max-w-[145px] sm:max-w-[160px] text-center ${
                                isMyCell
                                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-md ring-2 ring-indigo-300 scale-[1.02] cursor-pointer hover:bg-indigo-700 active:scale-95'
                                  : 'bg-slate-50 border-slate-200 text-slate-800 cursor-not-allowed opacity-85 shadow-xs'
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full mr-1.5 sm:mr-2 shrink-0 ${isMyCell ? 'bg-white' : 'bg-indigo-500'}`} />
                              <span className="truncate">{displayMemberName}</span>
                            </div>
                          ) : (
                            <div
                              onClick={() => handleCellClick(pattern.id, isSunday)}
                              className={`w-full h-full min-h-[40px] sm:min-h-[44px] rounded-xl sm:rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center transition-all ${
                                !isFinalized && !hasSubmitted
                                  ? 'cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/50 active:bg-indigo-100/50'
                                  : 'cursor-not-allowed opacity-50'
                              }`}
                            >
                              <span className="text-slate-300 text-base sm:text-lg font-light">+</span>
                            </div>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col lg:flex-row font-sans text-slate-800 pb-24 lg:pb-0">
      {/* LEFT FORM PANEL */}
      <div className="w-full lg:w-[360px] bg-white border-b lg:border-b-0 lg:border-r border-slate-200 p-5 sm:p-6 lg:p-8 flex flex-col shrink-0 shadow-xs justify-between">
        <div>
          {/* Header Actions */}
          <div className="flex items-center gap-3.5 mb-5 sm:mb-8">
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl sm:rounded-full overflow-hidden border border-indigo-100 shadow-xs flex items-center justify-center bg-white shrink-0">
              <img src="/favicon/favicon.png" alt="Ministry Logo" className="w-full h-full object-cover" />
            </div>
            <div className="lg:hidden">
              <h1 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight">Schedule Selection</h1>
              <p className="text-xs font-bold text-indigo-600 truncate">{publication?.name}</p>
              {publication?.submissionDeadline && (
                <p className="text-[11px] font-bold text-purple-700 mt-0.5">
                  ⏰ Deadline: {new Date(publication.submissionDeadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                </p>
              )}
            </div>
          </div>

          <div className="hidden lg:block">
            <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Schedule Selection</h1>
            <div className="mb-6 space-y-1">
              <p className="text-sm font-bold text-indigo-600">{publication?.name}</p>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                {publication?.startDate} to {publication?.endDate}
              </p>
              {publication?.submissionDeadline && (
                <div className="p-2.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-900 text-xs font-bold mt-2 flex items-center gap-2">
                  <span className="text-purple-600">⏰</span>
                  <div>
                    <span className="block text-[10px] text-purple-500 uppercase font-black">Submission Deadline</span>
                    <span>{new Date(publication.submissionDeadline).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}</span>
                  </div>
                </div>
              )}
              {publication?.description && (
                <p className="text-xs text-slate-500 mt-2">{publication.description}</p>
              )}
            </div>
          </div>

          {isFinalized ? (
            <div className="bg-amber-50 border border-amber-200 p-5 sm:p-6 rounded-2xl text-center shadow-xs mt-2 sm:mt-4">
              <div className="text-2xl sm:text-3xl mb-2 sm:mb-3">🔒</div>
              <h3 className="text-amber-900 font-black mb-1 sm:mb-2 text-base sm:text-lg">Scheduling Closed</h3>
              <p className="text-amber-800 text-xs sm:text-sm leading-relaxed">
                This schedule period has been finalized by the administrator. No further selections can be made.
              </p>
            </div>
          ) : (
            <form onSubmit={handleOpenConfirmModal} className="space-y-4 sm:space-y-6">
              {/* Member Picker Component */}
              <div className="space-y-2" id="member-picker-section">
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                  1. SELECT YOUR NAME
                </label>

                {availableMembers.length === 0 ? (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-center text-xs font-semibold text-slate-500">
                    All eligible active servers have already submitted their responses for this publication.
                  </div>
                ) : (
                  <div>
                    {!isMemberPickerOpen ? (
                      /* Trigger Button / Selected Box */
                      <button
                        type="button"
                        onClick={() => {
                          setIsMemberPickerOpen(true)
                          setNameSearchQuery('')
                        }}
                        className={`w-full p-3.5 sm:p-4 border rounded-2xl flex items-center justify-between text-left transition-all cursor-pointer ${
                          selectedMemberId
                            ? 'bg-indigo-50/80 border-indigo-400 text-indigo-900 shadow-xs'
                            : 'bg-slate-50 border-slate-200 hover:border-indigo-400 text-slate-600'
                        }`}
                      >
                        {selectedMemberId ? (
                          <div className="flex items-center justify-between w-full gap-2">
                            <div className="truncate">
                              <span className="block text-xs font-black text-slate-900 truncate">
                                {members.find(m => m.id === selectedMemberId)?.lastName}, {members.find(m => m.id === selectedMemberId)?.firstName}
                              </span>
                              {members.find(m => m.id === selectedMemberId)?.order && (
                                <span className="text-[10px] text-indigo-700 font-bold">
                                  {members.find(m => m.id === selectedMemberId)?.order}
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] font-extrabold text-indigo-600 bg-white px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl border border-indigo-200 shadow-xs shrink-0">
                              Change
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between w-full">
                            <span className="text-xs font-bold text-slate-500">
                              Click to search / select your name...
                            </span>
                            <span className="text-xs text-slate-400 font-bold">▼</span>
                          </div>
                        )}
                      </button>
                    ) : (
                      /* Expanded Picker Card with Search Input */
                      <div className="p-3.5 sm:p-4 bg-white border-2 border-indigo-600 rounded-2xl shadow-xl space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                          <span className="text-xs font-black text-slate-900">Select Your Name</span>
                          <button
                            type="button"
                            onClick={() => setIsMemberPickerOpen(false)}
                            className="text-xs font-bold text-slate-400 hover:text-slate-700 px-2 py-0.5 rounded-md"
                          >
                            Close ✕
                          </button>
                        </div>

                        <input
                          type="text"
                          autoFocus
                          value={nameSearchQuery}
                          onChange={e => setNameSearchQuery(e.target.value)}
                          placeholder="Type to search name or order..."
                          className="w-full p-2.5 sm:p-3 border border-slate-300 rounded-xl text-xs bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none font-medium"
                        />

                        <div className="space-y-1.5 max-h-52 sm:max-h-60 overflow-y-auto pr-1">
                          {filteredAvailableMembers.length === 0 ? (
                            <div className="p-3 text-center text-xs text-slate-400 italic">
                              No matching active members found.
                            </div>
                          ) : (
                            filteredAvailableMembers.map(m => {
                              const isSelected = selectedMemberId === m.id
                              return (
                                <div
                                  key={m.id}
                                  onClick={() => {
                                    setSelectedMemberId(m.id)
                                    setIsMemberPickerOpen(false)
                                  }}
                                  className={`flex items-center justify-between p-2.5 sm:p-3 border rounded-xl cursor-pointer transition-all ${
                                    isSelected
                                      ? 'bg-indigo-50 border-indigo-500 text-indigo-950 font-bold shadow-xs'
                                      : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-800'
                                  }`}
                                >
                                  <div>
                                    <div className="text-xs font-bold">{m.lastName}, {m.firstName}</div>
                                    {m.order && <div className="text-[10px] text-slate-500 font-medium">{m.order}</div>}
                                  </div>
                                  {isSelected && (
                                    <span className="w-2 h-2 rounded-full bg-indigo-600" />
                                  )}
                                </div>
                              )
                            })
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {hasSubmitted ? (
                <div className="bg-amber-50/80 border border-amber-200 p-3.5 sm:p-4 rounded-2xl text-xs text-amber-900 leading-relaxed shadow-xs">
                  <strong className="block mb-1 text-amber-950 font-extrabold">Finalized</strong>
                  You have already saved your schedule for this publication. If you need to make changes, please contact your administrator.
                </div>
              ) : (
                <div className="bg-indigo-50/80 border border-indigo-100 p-3.5 sm:p-4 rounded-2xl text-xs text-indigo-900 leading-relaxed shadow-xs">
                  <strong className="block mb-1 text-indigo-950 font-extrabold">2. Select Slots in the Table</strong>
                  Tap any slot below to choose your serving time. When done, tap Save Schedule.
                  {selectedMemberId && (
                    <div className="mt-2.5 pt-2 border-t border-indigo-200/60 flex items-center justify-between font-bold text-[11px]">
                      <span>Sunday: {selectedSundayCount}/{publication?.maxSundaysPerServer ?? 4}</span>
                      <span>Weekday: {selectedWeekdayCount}/{publication?.maxWeekdaysPerServer ?? 8}</span>
                    </div>
                  )}
                </div>
              )}

              {message && !hasSubmitted && (
                <div className={`p-3.5 sm:p-4 rounded-2xl text-xs font-bold ${message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
                  {message.text}
                </div>
              )}

              {/* Desktop Save Button (hidden on mobile, visible on lg+) */}
              <button
                type="submit"
                disabled={submitting || !selectedMemberId || hasSubmitted}
                className={`hidden lg:flex w-full py-4 font-extrabold text-sm rounded-2xl shadow-lg transition-all items-center justify-center gap-2 mt-4 ${
                  hasSubmitted 
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none' 
                    : 'bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white shadow-indigo-600/30 cursor-pointer disabled:opacity-50'
                }`}
              >
                <span>
                  {submitting 
                    ? 'Saving...' 
                    : isQuotaMaxed 
                      ? 'Submit & Finalize Schedule' 
                      : `Save Selections (${selectedSundayCount + selectedWeekdayCount} slots)`}
                </span>
                <span className="text-base">▹</span>
              </button>
            </form>
          )}
        </div>

        <div className="hidden lg:block pt-8 text-center text-[11px] font-bold text-slate-400">
          © {new Date().getFullYear()} Ministry of Altar Servers
        </div>
      </div>

      {/* RIGHT MATRIX TABLE PANEL */}
      <div className="flex-1 p-3.5 sm:p-6 md:p-10 overflow-x-auto overflow-y-auto">
        {publicationSchedules.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 sm:p-10 bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs">
            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mb-4 text-2xl">
              📅
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-800 mb-2">No Mass Schedules Yet</h2>
            <p className="text-xs sm:text-sm text-slate-500 max-w-md">
              There are currently no generated schedules within this publication's date range ({publication?.startDate} to {publication?.endDate}). 
              <br/><br/>
              <strong>Admin Instruction:</strong> Go to the Schedule Management page and use the "Templates" button to generate the schedules for this date range.
            </p>
          </div>
        ) : (
          <>
            {/* SCHEDULE MONTH BANNER ABOVE SUNDAY MASSES */}
            <div className="mb-4 sm:mb-6 bg-gradient-to-r from-indigo-900 via-indigo-800 to-indigo-900 text-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl shadow-lg border border-indigo-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-white/10 flex items-center justify-center shrink-0 border border-white/10 shadow-xs">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 sm:w-7 sm:h-7 text-indigo-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <span className="text-[10px] sm:text-[11px] font-extrabold text-indigo-300 uppercase tracking-widest block mb-0.5">
                    SCHEDULE PERIOD
                  </span>
                  <h2 className="text-xl sm:text-3xl font-black tracking-tight text-white">
                    {publication?.name || 'Schedule Period'}
                  </h2>
                  <p className="text-[11px] text-indigo-200 font-semibold sm:hidden mt-0.5">
                    {publication?.startDate} to {publication?.endDate}
                  </p>
                </div>
              </div>
              <div className="bg-white/10 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl sm:rounded-2xl text-xs font-bold text-indigo-200 border border-white/10 backdrop-blur-xs self-stretch sm:self-auto text-center">
                Public Schedule
              </div>
            </div>

            {renderTable(
              sundayPatterns, 
              maxRowsSunday, 
              true, 
              'Sunday Masses', 
              `Recurring Sunday Schedules`, 
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            )}
            {renderTable(
              weekdayPatterns, 
              maxRowsWeekday, 
              false, 
              'Weekday Masses', 
              `Recurring Weekday Schedules`, 
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}

            <div className="lg:hidden text-center text-[11px] font-bold text-slate-400 py-6">
              © {new Date().getFullYear()} Ministry of Altar Servers
            </div>
          </>
        )}
      </div>

      {/* MOBILE FLOATING BOTTOM ACTION BAR (< lg) */}
      {!isFinalized && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-2xl p-3 sm:p-4 animate-in slide-in-from-bottom duration-200">
          <div className="max-w-md mx-auto flex items-center justify-between gap-3">
            {!selectedMemberId ? (
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById('member-picker-section')
                  if (el) {
                    el.scrollIntoView({ behavior: 'smooth' })
                    setIsMemberPickerOpen(true)
                  }
                }}
                className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-indigo-600/20 active:scale-98 transition-all"
              >
                <span>👆 Tap to Select Your Name First</span>
              </button>
            ) : hasSubmitted ? (
              <div className="w-full text-center py-2 text-xs font-bold text-amber-800 bg-amber-50 rounded-xl border border-amber-200">
                ✅ Schedule Already Saved
              </div>
            ) : (
              <>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] uppercase font-extrabold text-slate-400 truncate">
                    {selectedMemberName}
                  </div>
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>{selectedSundayCount} Sun, {selectedWeekdayCount} Wkday</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleOpenConfirmModal}
                  disabled={submitting || selectedScheduleIds.size === 0}
                  className="py-3 px-5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-black text-xs shadow-md shadow-indigo-600/20 transition-all shrink-0 flex items-center gap-1.5 cursor-pointer"
                >
                  <span>{submitting ? 'Saving...' : isQuotaMaxed ? 'Finalize' : 'Save'}</span>
                  <span>▹</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Save Confirmation Modal Popup */}
      <ConfirmModal
        isOpen={confirmSubmitOpen}
        onClose={() => setConfirmSubmitOpen(false)}
        onConfirm={handleConfirmedSave}
        variant="info"
        title={isQuotaMaxed ? 'Confirm Final Schedule Submission' : 'Save Schedule Selections'}
        message={confirmModalMessage}
        confirmLabel={submitting ? 'Saving...' : isQuotaMaxed ? 'Submit & Finalize' : 'Yes, Save Selections'}
        cancelLabel="Review Selections"
        loading={submitting}
      />

      {/* Limit / Validation Error Modal Popup */}
      <AlertModal
        isOpen={!!limitModal}
        onClose={() => setLimitModal(null)}
        variant="warning"
        title={limitModal?.title || 'Notice'}
        message={limitModal?.message || ''}
        closeLabel="Got it"
      />
    </div>
  )
}

