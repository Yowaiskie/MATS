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
  const [selectedScheduleIds, setSelectedScheduleIds] = useState<Set<string>>(new Set())
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const loadData = async () => {
    if (!publicationId) {
      setMessage({ type: 'error', text: 'No publication ID provided.' })
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const pub = await publicationService.getPublication(publicationId)
      if (!pub || pub.status === 'draft') {
        setMessage({ type: 'error', text: 'Publication not found or is still a draft.' })
        setLoading(false)
        return
      }

      setPublication(pub)

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
    let max = 5
    sundayPatterns.forEach(p => {
      if (p.assignedMembers.length > max) max = p.assignedMembers.length
    })
    return max
  }, [sundayPatterns])



  const hasSubmitted = useMemo(() => {
    if (!publication || !selectedMemberId) return false
    return publication.submittedMembers?.includes(selectedMemberId) || false
  }, [publication, selectedMemberId])

  const isFinalized = publication?.status === 'archived'

  const availableMembers = useMemo(() => {
    if (!publication) return members
    return members.filter(m => !publication.submittedMembers?.includes(m.id))
  }, [members, publication])

  const handleCellClick = (patternId: string, isSunday: boolean) => {
    if (isFinalized) return
    if (hasSubmitted) return

    if (!selectedMemberId) {
      setMessage({ type: 'error', text: 'Please select your name first from the dropdown on the left!' })
      return
    }

    const patterns = isSunday ? sundayPatterns : weekdayPatterns
    const pattern = patterns.find(p => p.id === patternId)
    if (!pattern) return

    // Determine if pattern is already selected for this user
    const isSelected = pattern.scheduleIds.some(id => selectedScheduleIds.has(id))

    // Enforce limits when trying to add a new selection
    if (!isSelected && publication) {
      if (isSunday) {
        const currentSelectedCount = sundayPatterns.filter(p => p.scheduleIds.some(id => selectedScheduleIds.has(id))).length
        const max = publication.maxSundaysPerServer ?? 4
        if (currentSelectedCount >= max) {
          setMessage({ type: 'error', text: `Maximum limit reached: You can only select up to ${max} Sunday schedule(s).` })
          return
        }
      } else {
        const currentSelectedCount = weekdayPatterns.filter(p => p.scheduleIds.some(id => selectedScheduleIds.has(id))).length
        const max = publication.maxWeekdaysPerServer ?? 8
        if (currentSelectedCount >= max) {
          setMessage({ type: 'error', text: `Maximum limit reached: You can only select up to ${max} Weekday schedule(s).` })
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedMemberId) {
      setMessage({ type: 'error', text: 'Please select your name from the dropdown.' })
      return
    }

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

  if (!publication && !loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center bg-white p-10 rounded-2xl shadow-sm border border-slate-200">
          <div className="w-16 h-16 rounded-full overflow-hidden border border-slate-100 shadow-xs mb-4 flex items-center justify-center bg-white mx-auto">
            <img src="/favicon.png" alt="Ministry Logo" className="w-full h-full object-cover" />
          </div>
          <h2 className="text-xl font-bold text-slate-800">Publication Unavailable</h2>
          <p className="text-sm text-slate-500 mt-2 max-w-sm">{message?.text || 'This schedule publication is either invalid or currently closed.'}</p>
        </div>
      </div>
    )
  }

  const renderTable = (patterns: SchedulePattern[], maxRows: number, isSunday: boolean, title: string, subtitle: string, icon: string) => {
    if (patterns.length === 0) return null

    return (
      <div className="mb-10">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-indigo-100/70 text-indigo-600 flex items-center justify-center text-xl shadow-xs">
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

  const renderMatrixTable = (patterns: SchedulePattern[], title: string, subtitle: string, icon: string) => {
    if (patterns.length === 0) return null

    // Extract unique times and days
    const uniqueTimes = Array.from(new Set(patterns.map(p => p.startTime))).sort()
    
    // Sort days correctly (1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat)
    const uniqueDays = Array.from(new Set(patterns.map(p => p.dayOfWeek))).sort((a, b) => a - b)

    const getDayNameFromIndex = (index: number) => {
      const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']
      return days[index]
    }

    return (
      <div className="mb-10">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center text-xl shadow-xs border border-teal-100">
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
                  <th className="px-6 py-5 font-extrabold text-[10px] text-slate-500 uppercase tracking-widest w-24 sticky left-0 bg-slate-50/90 z-10 border-r border-slate-100">
                    Time \ Day
                  </th>
                  {uniqueDays.map(d => (
                    <th key={d} className="px-6 py-5 text-center min-w-[170px]">
                      <div className="font-black text-xs text-slate-900 uppercase tracking-widest">{getDayNameFromIndex(d)}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {uniqueTimes.map(time => (
                  <tr key={time} className="transition-colors">
                    <td className="px-6 py-4 font-black text-xs text-slate-900 uppercase sticky left-0 bg-white/90 z-10 border-r border-slate-100 whitespace-nowrap">
                      {formatTime12Hour(time)}
                    </td>
                    {uniqueDays.map(day => {
                      const pattern = patterns.find(p => p.dayOfWeek === day && p.startTime === time)
                      
                      if (!pattern) {
                        return (
                          <td key={`${day}-${time}`} className="px-4 py-4 text-center align-middle bg-slate-50/30">
                            <span className="text-slate-300 font-bold tracking-widest text-xs">----</span>
                          </td>
                        )
                      }

                      const isSelectedByCurrentMember = pattern.scheduleIds.some(id => selectedScheduleIds.has(id))
                      const savedMemberIds = pattern.assignedMembers

                      const displayMembers: Array<{ id: string, name: string, isDraft: boolean }> = []
                      
                      savedMemberIds.forEach(id => {
                         displayMembers.push({ id, name: memberMap.get(id) || 'Unknown', isDraft: false })
                      })

                      if (selectedMemberId && isSelectedByCurrentMember && !savedMemberIds.includes(selectedMemberId)) {
                         displayMembers.push({ id: selectedMemberId, name: memberMap.get(selectedMemberId) || 'Unknown', isDraft: true })
                      }

                      return (
                        <td 
                          key={`${day}-${time}`} 
                          className={`px-4 py-4 text-center align-top transition-colors ${!isFinalized && !hasSubmitted ? 'cursor-pointer hover:bg-slate-50/80' : ''}`}
                          onClick={() => !isFinalized && !hasSubmitted && handleCellClick(pattern.id, false)}
                        >
                           <div className="flex flex-col gap-2 min-h-[100px] h-full rounded-xl border border-transparent hover:border-slate-200 p-1 transition-colors">
                              {displayMembers.length > 0 ? (
                                displayMembers.map(m => {
                                  return (
                                    <div key={m.id} className="px-3 py-2.5 rounded-xl border border-slate-200 text-[11px] font-bold flex flex-col items-start shadow-[0_2px_8px_-4px_rgba(0,0,0,0.05)] bg-white text-slate-700 relative overflow-hidden group">
                                       {m.isDraft && <div className="absolute inset-0 bg-indigo-50 opacity-50 pointer-events-none" />}
                                       <div className="flex items-start gap-2 relative z-10">
                                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 mt-1" />
                                          <span className="text-left leading-snug break-words">
                                            {m.name} 
                                            {m.isDraft && <span className="ml-1 text-indigo-600 font-extrabold text-[9px] uppercase tracking-wider">(Draft)</span>}
                                          </span>
                                       </div>
                                    </div>
                                  )
                                })
                              ) : (
                                <div className="flex-1 flex items-center justify-center">
                                  <span className="text-slate-300 font-bold tracking-widest text-xs">----</span>
                                </div>
                              )}
                           </div>
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
              <img src="/favicon.png" alt="Ministry Logo" className="w-full h-full object-cover" />
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
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Single Name Select Dropdown */}
              <div>
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">
                  1. SELECT YOUR NAME
                </label>
                <div className="relative">
                  <select
                    value={selectedMemberId}
                    onChange={(e) => setSelectedMemberId(e.target.value)}
                    className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:outline-none transition-all cursor-pointer"
                    required
                  >
                    <option value="">-- Select Your Name --</option>
                    {availableMembers
                      .slice()
                      .sort((a, b) => a.lastName.localeCompare(b.lastName))
                      .map(m => (
                        <option key={m.id} value={m.id}>
                          {m.lastName}, {m.firstName}
                        </option>
                      ))}
                  </select>
                </div>
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
            {renderTable(sundayPatterns, maxRowsSunday, true, 'Sunday Masses', `Recurring Sunday Schedules`, '📅')}
            {renderMatrixTable(weekdayPatterns, 'Weekday Masses', `Weekday Masses Schedule for ${publication?.name || ''}`, '📆')}
          </>
        )}
      </div>
    </div>
  )
}
