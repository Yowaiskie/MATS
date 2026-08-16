import React, { useState, useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
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
      const pub = await publicationService.getPublication(publicationId)
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
        scheduleService.getSchedules(),
        memberService.getMembers()
      ])
      
      const activeMems = memList.filter(m => {
        if (m.status !== 'active') return false
        const r = (m.rank || '').toLowerCase()
        const o = (m.order || '').toLowerCase()
        const p = (m.position || '').toLowerCase()
        return !(r.includes('squire') || o.includes('squire') || p.includes('squire'))
      })
      setMembers(activeMems)
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
  }, [publicationId])

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
      if (publication) {
        await publicationService.markMemberSubmitted(publication.id, selectedMemberId)
      }
      
      setMessage({ type: 'success', text: 'Your schedule response has been saved successfully!' })

      // Refresh schedules and publication from backend
      const [updatedSchedules, updatedPub] = await Promise.all([
        scheduleService.getSchedules(),
        publicationService.getPublication(publicationId!)
      ])
      setSchedules(updatedSchedules)
      if (updatedPub) setPublication(updatedPub)
    } catch (err) {
      console.error(err)
      setMessage({ type: 'error', text: 'Failed to save schedule. Please try again.' })
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

    return (
      <div className="mb-10">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-indigo-100/70 text-indigo-600 flex items-center justify-center shadow-xs">
            {icon}
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">{title}</h2>
            <p className="text-xs font-semibold text-slate-500">{subtitle}</p>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left min-w-max">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="px-6 py-5 font-extrabold text-xs text-slate-400 uppercase tracking-widest w-24 sticky left-0 bg-slate-50/90 z-10">
                    ROLE
                  </th>
                  {patterns.map(p => (
                    <th key={p.id} className="px-6 py-5 text-center min-w-[170px]">
                      <div className="font-black text-xs text-slate-900 uppercase tracking-widest">{p.dayName}</div>
                      <div className="font-extrabold text-xs text-indigo-600 mt-0.5">{formatTime12Hour(p.startTime)}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {Array.from({ length: maxRows }).map((_, rowIndex) => (
                  <tr key={rowIndex} className="hover:bg-slate-50/40 transition-colors">
                    <td className="px-6 py-4 font-bold text-xs text-slate-400 uppercase sticky left-0 bg-white/90 z-10">
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
                        <td key={pattern.id} className="px-3 py-3 text-center align-middle">
                          {displayMemberName ? (
                            <div
                              onClick={() => !isOtherUserCell && handleCellClick(pattern.id, isSunday)}
                              className={`inline-flex items-center justify-center px-4 py-3 rounded-2xl border text-xs font-bold transition-all select-none min-w-[140px] max-w-[160px] text-center ${
                                isMyCell
                                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-md ring-2 ring-indigo-300 scale-[1.02] cursor-pointer hover:bg-indigo-700'
                                  : 'bg-slate-50 border-slate-200 text-slate-800 cursor-not-allowed opacity-85 shadow-xs'
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full mr-2 shrink-0 ${isMyCell ? 'bg-white' : 'bg-indigo-500'}`} />
                              <span className="truncate">{displayMemberName}</span>
                            </div>
                          ) : (
                            <div
                              onClick={() => handleCellClick(pattern.id, isSunday)}
                              className={`w-full h-full min-h-[44px] rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center transition-all ${
                                !isFinalized && !hasSubmitted
                                  ? 'cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/50'
                                  : 'cursor-not-allowed opacity-50'
                              }`}
                            >
                              <span className="text-slate-300 text-lg font-light">+</span>
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
    <div className="min-h-screen bg-[#f8fafc] flex flex-col lg:flex-row font-sans text-slate-800">
      {/* LEFT FORM PANEL */}
      <div className="w-full lg:w-[360px] bg-white border-r border-slate-200 p-8 flex flex-col shrink-0 shadow-xs justify-between">
        <div>
          {/* Header Actions */}
          <div className="flex items-center mb-8">
            <div className="w-16 h-16 rounded-full overflow-hidden border border-indigo-100 shadow-xs flex items-center justify-center bg-white">
              <img src="/favicon/favicon.png" alt="Ministry Logo" className="w-full h-full object-cover" />
            </div>
          </div>

          <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Schedule Selection</h1>
          <div className="mb-6 space-y-1">
            <p className="text-sm font-bold text-indigo-600">{publication?.name}</p>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
              {publication?.startDate} to {publication?.endDate}
            </p>
            {publication?.description && (
              <p className="text-xs text-slate-500 mt-2">{publication.description}</p>
            )}
          </div>

          {isFinalized ? (
            <div className="bg-amber-50 border border-amber-200 p-6 rounded-2xl text-center shadow-xs mt-4">
              <div className="text-3xl mb-3">🔒</div>
              <h3 className="text-amber-900 font-black mb-2 text-lg">Scheduling Closed</h3>
              <p className="text-amber-800 text-sm leading-relaxed">
                This schedule period has been finalized by the administrator. No further selections can be made.
              </p>
            </div>
          ) : (
            <form onSubmit={handleOpenConfirmModal} className="space-y-6">
              {/* Member Picker Component matched from PublicEventFormPage */}
              <div className="space-y-2">
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
                        className={`w-full p-4 border rounded-2xl flex items-center justify-between text-left transition-all cursor-pointer ${
                          selectedMemberId
                            ? 'bg-indigo-50/80 border-indigo-400 text-indigo-900 shadow-xs'
                            : 'bg-slate-50 border-slate-200 hover:border-indigo-400 text-slate-600'
                        }`}
                      >
                        {selectedMemberId ? (
                          <div className="flex items-center justify-between w-full">
                            <div>
                              <span className="block text-xs font-black text-slate-900">
                                {members.find(m => m.id === selectedMemberId)?.lastName}, {members.find(m => m.id === selectedMemberId)?.firstName}
                              </span>
                              {members.find(m => m.id === selectedMemberId)?.order && (
                                <span className="text-[10px] text-indigo-700 font-bold">
                                  {members.find(m => m.id === selectedMemberId)?.order}
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] font-extrabold text-indigo-600 bg-white px-3 py-1.5 rounded-xl border border-indigo-200 shadow-xs">
                              Change Name
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
                      <div className="p-4 bg-white border-2 border-indigo-600 rounded-2xl shadow-xl space-y-3">
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
                          className="w-full p-3 border border-slate-300 rounded-xl text-xs bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none font-medium"
                        />

                        <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
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
                                  className={`flex items-center justify-between p-3 border rounded-xl cursor-pointer transition-all ${
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
                <div className="bg-amber-50/80 border border-amber-200 p-4 rounded-2xl text-xs text-amber-900 leading-relaxed shadow-xs mt-4">
                  <strong className="block mb-1 text-amber-950 font-extrabold">Finalized</strong>
                  You have already saved your schedule for this publication. If you need to make changes, please contact your administrator.
                </div>
              ) : (
                <div className="bg-indigo-50/80 border border-indigo-100 p-4 rounded-2xl text-xs text-indigo-900 leading-relaxed shadow-xs">
                  <strong className="block mb-1 text-indigo-950 font-extrabold">2. Click Directly on the Table Slots</strong>
                  After selecting your name, simply click/tap any mass time slot card or empty slot on the table matrix to choose your serving time!
                </div>
              )}

              {message && !hasSubmitted && (
                <div className={`p-4 rounded-2xl text-xs font-bold ${message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
                  {message.text}
                </div>
              )}

              {/* Save Button */}
              <button
                type="submit"
                disabled={submitting || !selectedMemberId || hasSubmitted}
                className={`w-full py-4 font-extrabold text-sm rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 mt-4 ${
                  hasSubmitted 
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none' 
                    : 'bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white shadow-indigo-600/30 cursor-pointer disabled:opacity-50'
                }`}
              >
                <span>{submitting ? 'Saving...' : 'Save Schedule'}</span>
                <span className="text-base">▹</span>
              </button>
            </form>
          )}
        </div>

        <div className="pt-8 text-center text-[11px] font-bold text-slate-400">
          © {new Date().getFullYear()} Ministry of Altar Servers
        </div>
      </div>

      {/* RIGHT MATRIX TABLE PANEL */}
      <div className="flex-1 p-6 md:p-10 overflow-x-auto overflow-y-auto">
        {publicationSchedules.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-10 bg-white rounded-3xl border border-slate-200/80 shadow-xs">
            <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mb-4 text-2xl">
              📅
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">No Mass Schedules Yet</h2>
            <p className="text-sm text-slate-500 max-w-md">
              There are currently no generated schedules within this publication's date range ({publication?.startDate} to {publication?.endDate}). 
              <br/><br/>
              <strong>Admin Instruction:</strong> Go to the Schedule Management page and use the "Templates" button to generate the schedules for this date range.
            </p>
          </div>
        ) : (
          <>
            {/* SCHEDULE MONTH BANNER ABOVE SUNDAY MASSES */}
            <div className="mb-6 bg-gradient-to-r from-indigo-900 via-indigo-800 to-indigo-900 text-white p-6 rounded-3xl shadow-lg border border-indigo-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center shrink-0 border border-white/10 shadow-xs">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-indigo-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <span className="text-[11px] font-extrabold text-indigo-300 uppercase tracking-widest block mb-0.5">
                    SCHEDULE MONTH / PERIOD
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                    {publication?.name || 'Schedule Period'}
                  </h2>
                </div>
              </div>
              <div className="bg-white/10 px-4 py-2 rounded-2xl text-xs font-bold text-indigo-200 border border-white/10 backdrop-blur-xs self-stretch sm:self-auto text-center">
                Public Schedule
              </div>
            </div>

            {renderTable(
              sundayPatterns, 
              maxRowsSunday, 
              true, 
              'Sunday Masses', 
              `Recurring Sunday Schedules`, 
              <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            )}
            {renderTable(
              weekdayPatterns, 
              maxRowsWeekday, 
              false, 
              'Weekday Masses', 
              `Recurring Weekday Schedules`, 
              <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </>
        )}
      </div>

      {/* Save Confirmation Modal Popup */}
      <ConfirmModal
        isOpen={confirmSubmitOpen}
        onClose={() => setConfirmSubmitOpen(false)}
        onConfirm={handleConfirmedSave}
        variant="info"
        title="Confirm Schedule Submission"
        message={`Are you sure you want to save your selected serving schedules for ${members.find(m => m.id === selectedMemberId)?.firstName || 'this server'}?`}
        confirmLabel={submitting ? 'Saving...' : 'Yes, Save Schedule'}
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
