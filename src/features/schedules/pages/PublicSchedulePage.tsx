import { ValidatedForm } from '@/components/ValidatedForm'
import React, { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { scheduleService } from '@/services/scheduleService'
import { memberService } from '@/services/memberService'
import { publicationService } from '@/services/publicationService'
import { submissionService } from '@/services/submissionService'
import type { Schedule } from '@/types/schedule'
import type { Member } from '@/types/member'
import type { SchedulePublication } from '@/types/publication'
import type { ScheduleSubmission } from '@/types/submission'
import { getFullName } from '@/utils/member'
import {
  formatTime12Hour,
  isScheduleIncludedInPublication,
  isMemberEligibleForPublication,
  getRankLimitForSlot,
  getSlotRankBreakdown,
  isPublicationDeadlinePassed,
  getCountdownTimeRemaining,
  getParishTodayDate,
  type CountdownResult,
  groupSchedulesIntoPatterns,
  type SchedulePattern,
  checkMemberQuotaStatus,
  type MemberQuotaStatus
} from '@/utils/scheduleUtils'
import { AlertModal, ConfirmModal } from '@/components/Dialog'
import { MemberSearchDropdown } from '@/components/MemberSearchDropdown'
import { useToast } from '@/context/ToastContext'
import { useAuth } from '@/features/authentication/AuthContext'
import { AdminMassAssignmentPanel } from '../components/AdminMassAssignmentPanel'
import { ManageSubmissionsModal } from '../components/ManageSubmissionsModal'


export const getLiturgicalTheme = (colorKey?: string, isSpecialPubFallback: boolean = false) => {
  const key = colorKey?.toLowerCase()
  switch (key) {
    case 'green':
      return {
        name: 'Green (Ordinary Time)',
        bannerGradient: 'bg-gradient-to-r from-emerald-950 via-emerald-900 to-teal-950 border-emerald-700',
        bannerSubtext: 'text-emerald-200',
        bannerIcon: 'text-emerald-200',
        buttonClass: 'bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white shadow-emerald-600/30',
        headerIconBg: 'bg-emerald-100/80 text-emerald-700',
        timeClass: 'text-emerald-700',
        locationBadgeClass: 'bg-emerald-50 border-emerald-200 text-emerald-950',
        locationIconClass: 'text-emerald-600',
        subtextClass: 'text-[10px] text-emerald-800 font-bold truncate max-w-[150px] mx-auto mt-0.5',
        cellSelectedClass: 'bg-emerald-600 text-white border-emerald-600 shadow-md ring-2 ring-emerald-300 scale-[1.02] cursor-pointer hover:bg-emerald-700 active:scale-95',
        cellDotClass: 'bg-emerald-500'
      }
    case 'white':
    case 'gold':
      return {
        name: 'White / Gold (Feasts & Solemnities)',
        bannerGradient: 'bg-gradient-to-r from-amber-950 via-amber-900 to-yellow-950 border-amber-600',
        bannerSubtext: 'text-amber-200',
        bannerIcon: 'text-amber-200',
        buttonClass: 'bg-amber-600 hover:bg-amber-700 active:scale-[0.99] text-white shadow-amber-600/30',
        headerIconBg: 'bg-amber-100/80 text-amber-800',
        timeClass: 'text-amber-700',
        locationBadgeClass: 'bg-amber-50 border-amber-300 text-amber-950',
        locationIconClass: 'text-amber-600',
        subtextClass: 'text-[10px] text-amber-800 font-bold truncate max-w-[150px] mx-auto mt-0.5',
        cellSelectedClass: 'bg-amber-500 text-white border-amber-500 shadow-md ring-2 ring-amber-200 scale-[1.02] cursor-pointer hover:bg-amber-600 active:scale-95',
        cellDotClass: 'bg-amber-500'
      }
    case 'purple':
    case 'violet':
      return {
        name: 'Violet / Purple (Advent, Lent, Memorials)',
        bannerGradient: 'bg-gradient-to-r from-purple-950 via-purple-900 to-indigo-950 border-purple-700',
        bannerSubtext: 'text-purple-200',
        bannerIcon: 'text-purple-200',
        buttonClass: 'bg-purple-600 hover:bg-purple-700 active:scale-[0.99] text-white shadow-purple-600/30',
        headerIconBg: 'bg-purple-100/80 text-purple-700',
        timeClass: 'text-purple-600',
        locationBadgeClass: 'bg-purple-50 border-purple-200 text-purple-900',
        locationIconClass: 'text-purple-600',
        subtextClass: 'text-[10px] text-purple-800 font-bold truncate max-w-[150px] mx-auto mt-0.5',
        cellSelectedClass: 'bg-purple-600 text-white border-purple-600 shadow-md ring-2 ring-purple-300 scale-[1.02] cursor-pointer hover:bg-purple-700 active:scale-95',
        cellDotClass: 'bg-purple-500'
      }
    case 'red':
      return {
        name: 'Red (Pentecost, Passion, Martyrs)',
        bannerGradient: 'bg-gradient-to-r from-rose-950 via-rose-900 to-red-950 border-rose-700',
        bannerSubtext: 'text-rose-200',
        bannerIcon: 'text-rose-200',
        buttonClass: 'bg-rose-600 hover:bg-rose-700 active:scale-[0.99] text-white shadow-rose-600/30',
        headerIconBg: 'bg-rose-100/80 text-rose-700',
        timeClass: 'text-rose-600',
        locationBadgeClass: 'bg-rose-50 border-rose-200 text-rose-900',
        locationIconClass: 'text-rose-600',
        subtextClass: 'text-[10px] text-rose-800 font-bold truncate max-w-[150px] mx-auto mt-0.5',
        cellSelectedClass: 'bg-rose-600 text-white border-rose-600 shadow-md ring-2 ring-rose-300 scale-[1.02] cursor-pointer hover:bg-rose-700 active:scale-95',
        cellDotClass: 'bg-rose-500'
      }
    case 'rose':
    case 'pink':
      return {
        name: 'Rose / Pink (Gaudete & Laetare)',
        bannerGradient: 'bg-gradient-to-r from-pink-950 via-pink-900 to-rose-950 border-pink-700',
        bannerSubtext: 'text-pink-200',
        bannerIcon: 'text-pink-200',
        buttonClass: 'bg-pink-500 hover:bg-pink-600 active:scale-[0.99] text-white shadow-pink-500/30',
        headerIconBg: 'bg-pink-100/80 text-pink-700',
        timeClass: 'text-pink-600',
        locationBadgeClass: 'bg-pink-50 border-pink-200 text-pink-900',
        locationIconClass: 'text-pink-500',
        subtextClass: 'text-[10px] text-pink-800 font-bold truncate max-w-[150px] mx-auto mt-0.5',
        cellSelectedClass: 'bg-pink-500 text-white border-pink-500 shadow-md ring-2 ring-pink-200 scale-[1.02] cursor-pointer hover:bg-pink-600 active:scale-95',
        cellDotClass: 'bg-pink-500'
      }
    case 'blue':
      return {
        name: 'Blue (Marian Feasts)',
        bannerGradient: 'bg-gradient-to-r from-sky-950 via-sky-900 to-blue-950 border-sky-700',
        bannerSubtext: 'text-sky-200',
        bannerIcon: 'text-sky-200',
        buttonClass: 'bg-sky-600 hover:bg-sky-700 active:scale-[0.99] text-white shadow-sky-600/30',
        headerIconBg: 'bg-sky-100/80 text-sky-700',
        timeClass: 'text-sky-600',
        locationBadgeClass: 'bg-sky-50 border-sky-200 text-sky-900',
        locationIconClass: 'text-sky-600',
        subtextClass: 'text-[10px] text-sky-800 font-bold truncate max-w-[150px] mx-auto mt-0.5',
        cellSelectedClass: 'bg-sky-600 text-white border-sky-600 shadow-md ring-2 ring-sky-300 scale-[1.02] cursor-pointer hover:bg-sky-700 active:scale-95',
        cellDotClass: 'bg-sky-500'
      }
    default:
      if (isSpecialPubFallback) {
        return {
          name: 'Purple (Special Event)',
          bannerGradient: 'bg-gradient-to-r from-purple-950 via-purple-900 to-indigo-950 border-purple-700',
          bannerSubtext: 'text-purple-200',
          bannerIcon: 'text-purple-200',
          buttonClass: 'bg-purple-600 hover:bg-purple-700 active:scale-[0.99] text-white shadow-purple-600/30',
          headerIconBg: 'bg-purple-100/80 text-purple-700',
          timeClass: 'text-purple-600',
          locationBadgeClass: 'bg-amber-50 border-amber-200 text-amber-900',
          locationIconClass: 'text-amber-600',
          subtextClass: 'text-[10px] text-slate-500 font-bold truncate max-w-[150px] mx-auto mt-0.5',
          cellSelectedClass: 'bg-purple-600 text-white border-purple-600 shadow-md ring-2 ring-purple-300 scale-[1.02] cursor-pointer hover:bg-purple-700 active:scale-95',
          cellDotClass: 'bg-purple-500'
        }
      }
      return {
        name: 'Standard Indigo',
        bannerGradient: 'bg-gradient-to-r from-indigo-900 via-indigo-800 to-indigo-900 border-indigo-700',
        bannerSubtext: 'text-indigo-200',
        bannerIcon: 'text-indigo-200',
        buttonClass: 'bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white shadow-indigo-600/30',
        headerIconBg: 'bg-indigo-100/70 text-indigo-600',
        timeClass: 'text-indigo-600',
        locationBadgeClass: 'bg-amber-50 border-amber-200 text-amber-900',
        locationIconClass: 'text-amber-600',
        subtextClass: 'text-[10px] text-slate-500 font-bold truncate max-w-[150px] mx-auto mt-0.5',
        cellSelectedClass: 'bg-indigo-600 text-white border-indigo-600 shadow-md ring-2 ring-indigo-300 scale-[1.02] cursor-pointer hover:bg-indigo-700 active:scale-95',
        cellDotClass: 'bg-indigo-500'
      }
  }
}

export const PublicSchedulePage: React.FC = () => {
  const { id: publicationId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { user, profile, isAdmin, canAction } = useAuth()
  const canAdminSchedule = Boolean(user && (isAdmin || canAction('canManageSchedules') || profile?.permissions?.canManageSchedules))
  const [schedulingMode, setSchedulingMode] = useState<'member' | 'admin'>('member')
  
  const [publication, setPublication] = useState<SchedulePublication | null>(null)
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [allRawMembers, setAllRawMembers] = useState<Member[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [submissions, setSubmissions] = useState<ScheduleSubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMemberId, setSelectedMemberId] = useState<string>('')
  const [selectedScheduleIds, setSelectedScheduleIds] = useState<Set<string>>(new Set())
  const [selectedSlotIndexMap, setSelectedSlotIndexMap] = useState<Record<string, number>>({})
  const [nameSearchQuery, setNameSearchQuery] = useState('')
  const [isMemberPickerOpen, setIsMemberPickerOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Admin Mode UI states
  const [adminModalOpen, setAdminModalOpen] = useState(false)
  const [adminTargetPatternId, setAdminTargetPatternId] = useState<string>('')
  const [adminTargetSlotIndex, setAdminTargetSlotIndex] = useState<number | null>(null)
  const [adminHighlightServerId, setAdminHighlightServerId] = useState<string>('')
  const [adminEffectiveDate, setAdminEffectiveDate] = useState<string>(() => getParishTodayDate())
  const [manageSubmissionsOpen, setManageSubmissionsOpen] = useState(false)
  const [adminControlsExpanded, setAdminControlsExpanded] = useState(false)
  
  // Custom dialog modals
  const [limitModal, setLimitModal] = useState<{ title: string; message: string } | null>(null)
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false)
  const [currentTime, setCurrentTime] = useState<number>(() => Date.now())

  // Dynamic ticker to ensure deadline comparisons and countdown update in real time
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Listen for tab focus or visibility changes to sync immediately on mobile device wake / app resume
  useEffect(() => {
    const handleSync = () => {
      setCurrentTime(Date.now())
    }
    document.addEventListener('visibilitychange', handleSync)
    window.addEventListener('focus', handleSync)
    return () => {
      document.removeEventListener('visibilitychange', handleSync)
      window.removeEventListener('focus', handleSync)
    }
  }, [])

  const loadData = async (silent = false) => {
    if (!publicationId) return
    if (!silent) setLoading(true)
    try {
      const pub = await queryClient.fetchQuery({
        queryKey: ['publication', publicationId],
        queryFn: () => publicationService.getPublication(publicationId),
        staleTime: 0
      })

      if (!pub) {
        setPublication(null)
        setLoading(false)
        return
      }

      setPublication(pub)

      const [membersData, schedsData, subsData] = await Promise.all([
        queryClient.fetchQuery({
          queryKey: ['members'],
          queryFn: () => memberService.getMembers(),
          staleTime: 1000 * 60 * 2
        }),
        queryClient.fetchQuery({
          queryKey: ['public-schedules', pub.id],
          queryFn: () => scheduleService.getSchedulesForPublication(pub),
          staleTime: 0
        }),
        queryClient.fetchQuery({
          queryKey: ['public-submissions', pub.id],
          queryFn: () => submissionService.getSubmissionsForPublication(pub.id),
          staleTime: 0
        }).catch(err => {
          console.warn('Could not fetch existing submissions:', err)
          return [] as ScheduleSubmission[]
        })
      ])

      setAllRawMembers(membersData)
      const eligible = membersData.filter(m => isMemberEligibleForPublication(m, pub, true))

      setMembers(eligible)
      setSchedules(schedsData)
      setSubmissions(subsData || [])
    } catch (err: any) {
      console.error(err)
      setMessage({ type: 'error', text: 'Failed to load publication details.' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [publicationId, queryClient])

  // Real-time Firestore subscriptions for publication and submissions
  useEffect(() => {
    if (!publicationId) return
    const unsubPub = publicationService.subscribeToPublication(
      publicationId,
      (livePub) => {
        setPublication(livePub)
        setLoading(false)
      },
      (err) => console.warn('Live publication subscription warning:', err)
    )

    const unsubSubs = submissionService.subscribeToPublicationSubmissions(
      publicationId,
      (liveSubs) => {
        setSubmissions(liveSubs || [])
      },
      (err) => console.warn('Live submissions subscription warning:', err)
    )

    return () => {
      unsubPub()
      unsubSubs()
    }
  }, [publicationId])

  // Real-time Firestore subscription for schedules within the publication range
  useEffect(() => {
    if (!publication || !publication.startDate || !publication.endDate) return
    const unsubScheds = scheduleService.subscribeToPublicationSchedules(
      publication,
      (liveSchedules) => {
        setSchedules(liveSchedules)
      },
      (err) => console.warn('Live schedules subscription warning:', err)
    )
    return () => unsubScheds()
  }, [
    publication?.id,
    publication?.startDate,
    publication?.endDate,
    publication?.publicationType,
    publication?.includeSundays,
    publication?.includeWeekdays,
    publication?.includeSpecialEvents,
    publication?.includeHolyHour,
    publication?.includeMeetings
  ])

  // Recompute eligible members when publication rules or raw members update
  useEffect(() => {
    if (!publication || allRawMembers.length === 0) return
    const eligible = allRawMembers.filter(m => isMemberEligibleForPublication(m, publication, true))
    setMembers(eligible)
  }, [publication, allRawMembers])

  // Clamp adminEffectiveDate to publication bounds when publication loads
  useEffect(() => {
    if (!publication) return
    const today = getParishTodayDate()
    if (today < publication.startDate) {
      setAdminEffectiveDate(publication.startDate)
    } else if (today > publication.endDate) {
      setAdminEffectiveDate(publication.endDate)
    } else {
      setAdminEffectiveDate(today)
    }
  }, [publication?.id, publication?.startDate, publication?.endDate])

  // Filter schedules strictly by publication date range and dynamic filter settings
  const publicationSchedules = useMemo(() => {
    if (!publication) return []
    return schedules.filter(s => 
      isScheduleIncludedInPublication(s, publication)
    )
  }, [schedules, publication])

  const memberSubmission = useMemo(() => {
    if (!selectedMemberId) return null
    return submissions.find(s => s.memberId === selectedMemberId) || null
  }, [selectedMemberId, submissions])

  // Track which memberId was last initialized so background snapshots don't wipe unsaved user selections
  const [initializedMemberId, setInitializedMemberId] = useState<string>('')

  useEffect(() => {
    if (!selectedMemberId) {
      setSelectedScheduleIds(new Set())
      setSelectedSlotIndexMap({})
      setInitializedMemberId('')
      return
    }

    const isSwitchingMember = initializedMemberId !== selectedMemberId

    if (memberSubmission) {
      if (isSwitchingMember) {
        setSelectedScheduleIds(new Set(memberSubmission.requestedScheduleIds))
      } else {
        setSelectedScheduleIds(prev => {
          const next = new Set(prev)
          memberSubmission.requestedScheduleIds.forEach(id => next.add(id))
          return next
        })
      }
      const slotMap: Record<string, number> = {}
      if (memberSubmission.slotSummaries) {
        memberSubmission.slotSummaries.forEach(sm => {
          if (sm.slotIndex !== undefined && sm.scheduleIds) {
            sm.scheduleIds.forEach(id => {
              slotMap[id] = sm.slotIndex!
            })
          }
        })
      }
      setSelectedSlotIndexMap(prev => (isSwitchingMember ? slotMap : { ...prev, ...slotMap }))
      if (isSwitchingMember) setInitializedMemberId(selectedMemberId)
      return
    }

    const assignedSet = new Set<string>()
    publicationSchedules.forEach(s => {
      if (s.assignedMembers?.includes(selectedMemberId)) {
        assignedSet.add(s.id)
      }
    })
    if (isSwitchingMember) {
      setSelectedScheduleIds(assignedSet)
      setSelectedSlotIndexMap({})
      setInitializedMemberId(selectedMemberId)
    } else if (assignedSet.size > 0) {
      setSelectedScheduleIds(prev => {
        const next = new Set(prev)
        assignedSet.forEach(id => next.add(id))
        return next
      })
    }
  }, [selectedMemberId, publicationSchedules, memberSubmission, initializedMemberId])

  const isSpecialPub = publication?.publicationType === 'special_event' || !!publication?.enableStreetLocation || (publication?.includedDaysOfWeek && publication.includedDaysOfWeek.length > 0)

  // Group into patterns using centralized domain utility with provisional submissions included
  const { sundayPatterns, weekdayPatterns, specialPatterns } = useMemo(() => {
    return groupSchedulesIntoPatterns(publicationSchedules, publication, { submissions })
  }, [publicationSchedules, publication, submissions])

  const memberMap = useMemo(() => {
    return new Map(members.map(m => [m.id, getFullName(m)]))
  }, [members])

  const memberObjMap = useMemo(() => {
    return new Map(members.map(m => [m.id, m]))
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

  const maxRowsSpecial = useMemo(() => {
    const configuredLimit = publication?.maxServersPerSpecialSlot ?? 6
    let currentMaxAssigned = configuredLimit
    specialPatterns.forEach(p => {
      if (p.assignedMembers.length > currentMaxAssigned) currentMaxAssigned = p.assignedMembers.length
    })
    return currentMaxAssigned
  }, [specialPatterns, publication])

  const allPatterns = useMemo(() => {
    return [...sundayPatterns, ...weekdayPatterns, ...specialPatterns]
  }, [sundayPatterns, weekdayPatterns, specialPatterns])

  const adminCycleMetrics = useMemo(() => {
    let totalCapacity = 0
    let totalFilled = 0
    let highlightedServerSlots = 0

    const collectPatternStats = (list: SchedulePattern[], limitPerPattern: number) => {
      list.forEach(p => {
        const filled = (p.assignedMembers || []).filter(Boolean)
        totalCapacity += limitPerPattern
        totalFilled += Math.min(filled.length, limitPerPattern)
        if (adminHighlightServerId && filled.includes(adminHighlightServerId)) {
          highlightedServerSlots += 1
        }
      })
    }

    if (isSpecialPub) {
      collectPatternStats(specialPatterns, publication?.maxServersPerSpecialSlot ?? 6)
    } else {
      collectPatternStats(sundayPatterns, publication?.maxServersPerSundaySlot ?? 5)
      collectPatternStats(weekdayPatterns, publication?.maxServersPerWeekdaySlot ?? 5)
    }

    const totalVacant = Math.max(0, totalCapacity - totalFilled)
    const fillPercent = totalCapacity > 0 ? Math.round((totalFilled / totalCapacity) * 100) : 0
    const pendingSubmissionsCount = submissions.filter(s => s.status === 'pending').length
    const totalSubmissionsCount = new Set([
      ...(publication?.submittedMembers || []),
      ...submissions.map(s => s.memberId)
    ]).size

    return {
      totalCapacity,
      totalFilled,
      totalVacant,
      fillPercent,
      pendingSubmissionsCount,
      totalSubmissionsCount,
      highlightedServerSlots
    }
  }, [isSpecialPub, specialPatterns, sundayPatterns, weekdayPatterns, publication, submissions, adminHighlightServerId])

  // Map of quota status for every member (including provisional submissions and official assignments)
  const memberQuotaStatusMap = useMemo(() => {
    const map = new Map<string, MemberQuotaStatus>()
    members.forEach(m => {
      const status = checkMemberQuotaStatus(m.id, publication, {
        sundayPatterns,
        weekdayPatterns,
        specialPatterns
      })
      map.set(m.id, status)
    })
    return map
  }, [members, publication, sundayPatterns, weekdayPatterns, specialPatterns])

  const isFinalized = publication?.status === 'archived'
  const isDraft = publication?.status === 'draft'

  const isDeadlinePassed = useMemo(() => {
    if (currentTime <= 0) return false
    return isPublicationDeadlinePassed(publication, currentTime)
  }, [publication, currentTime])

  const countdown = useMemo<CountdownResult>(() => {
    return getCountdownTimeRemaining(publication, currentTime)
  }, [publication, currentTime])

  const isClosed = isFinalized || isDraft || isDeadlinePassed

  // Only show members in dropdown who have NOT fully occupied their maximum allowed quota
  const availableMembers = useMemo(() => {
    return members.filter(m => {
      const status = memberQuotaStatusMap.get(m.id)
      return !status?.isFullyMaxed
    })
  }, [members, memberQuotaStatusMap])

  const filteredAvailableMembers = useMemo(() => {
    const sorted = availableMembers.slice().sort((a, b) => a.lastName.localeCompare(b.lastName))
    if (!nameSearchQuery.trim()) return sorted
    const q = nameSearchQuery.toLowerCase().trim()
    return sorted.filter(m => 
      `${m.lastName}, ${m.firstName}`.toLowerCase().includes(q) ||
      `${m.firstName} ${m.lastName}`.toLowerCase().includes(q)
    )
  }, [availableMembers, nameSearchQuery])

  // Track previously saved schedule IDs for the currently selected member (immutable)
  const savedScheduleIdsForMember = useMemo(() => {
    const set = new Set<string>()
    if (!selectedMemberId) return set
    if (memberSubmission?.requestedScheduleIds) {
      memberSubmission.requestedScheduleIds.forEach(id => set.add(id))
    }
    publicationSchedules.forEach(s => {
      if (s.assignedMembers?.includes(selectedMemberId)) {
        set.add(s.id)
      }
    })
    return set
  }, [selectedMemberId, memberSubmission, publicationSchedules])

  // Newly selected schedule IDs in the current session (not yet saved in DB)
  const newlySelectedScheduleIds = useMemo(() => {
    return Array.from(selectedScheduleIds).filter(id => !savedScheduleIdsForMember.has(id))
  }, [selectedScheduleIds, savedScheduleIdsForMember])

  const hasSavedSlots = savedScheduleIdsForMember.size > 0

  const selectedSundayCount = useMemo(() => {
    return sundayPatterns.filter(p => p.scheduleIds.some(id => selectedScheduleIds.has(id))).length
  }, [sundayPatterns, selectedScheduleIds])

  const selectedWeekdayCount = useMemo(() => {
    return weekdayPatterns.filter(p => p.scheduleIds.some(id => selectedScheduleIds.has(id))).length
  }, [weekdayPatterns, selectedScheduleIds])

  const selectedSpecialCount = useMemo(() => {
    return specialPatterns.filter(p => p.scheduleIds.some(id => selectedScheduleIds.has(id))).length
  }, [specialPatterns, selectedScheduleIds])

  const selectedMember = useMemo(() => {
    if (!selectedMemberId) return null
    return members.find(mem => mem.id === selectedMemberId) || null
  }, [members, selectedMemberId])

  const selectedMemberName = useMemo(() => {
    if (!selectedMember) return ''
    return `${selectedMember.lastName}, ${selectedMember.firstName}`
  }, [selectedMember])

  const isSuspended = selectedMember?.status === 'suspended'

  const selectedMemberQuotaStatus = useMemo(() => {
    if (!selectedMemberId) return null
    return memberQuotaStatusMap.get(selectedMemberId) || null
  }, [selectedMemberId, memberQuotaStatusMap])

  const { isQuotaMaxed, confirmModalMessage } = useMemo(() => {
    if (isSpecialPub) {
      const isActualSpecialEvent = publication?.publicationType === 'special_event'
      const maxSlots = isActualSpecialEvent
        ? (publication?.maxSpecialPerServer ?? 2)
        : (publication?.maxWeekdaysPerServer ?? 8)
      const hasSpecial = specialPatterns.length > 0
      const maxed = hasSpecial && (selectedSpecialCount >= maxSlots || selectedSpecialCount >= specialPatterns.length)

      const msg = hasSavedSlots
        ? `You have selected ${newlySelectedScheduleIds.length} additional slot(s). Total: ${selectedSpecialCount} special slot(s). Once submitted, your selections will be saved to the schedule roster.`
        : `You have selected ${selectedSpecialCount} schedule slot(s). Once submitted, your selections will be saved to the schedule roster.`

      return { isQuotaMaxed: maxed, confirmModalMessage: msg }
    }

    const maxSun = publication?.maxSundaysPerServer ?? 4
    const maxWk = publication?.maxWeekdaysPerServer ?? 8
    const hasSun = sundayPatterns.length > 0
    const hasWk = weekdayPatterns.length > 0

    const sunMaxed = !hasSun || selectedSundayCount >= maxSun || (hasSun && selectedSundayCount >= sundayPatterns.length)
    const wkMaxed = !hasWk || selectedWeekdayCount >= maxWk || (hasWk && selectedWeekdayCount >= weekdayPatterns.length)
    const maxed = (!hasSun && !hasWk) ? false : (sunMaxed && wkMaxed)

    const msg = hasSavedSlots
      ? `You have selected ${newlySelectedScheduleIds.length} additional slot(s). Total: ${selectedSundayCount} Sunday(s) and ${selectedWeekdayCount} Weekday(s). Once submitted, your selections will be saved to the schedule roster.`
      : `You have selected ${selectedSundayCount} Sunday(s) and ${selectedWeekdayCount} Weekday(s). Once submitted, your selections will be saved to the schedule roster.`

    return { isQuotaMaxed: maxed, confirmModalMessage: msg }
  }, [publication, isSpecialPub, selectedSpecialCount, specialPatterns, sundayPatterns, weekdayPatterns, selectedSundayCount, selectedWeekdayCount, hasSavedSlots, newlySelectedScheduleIds])

  // Member is considered fully completed if their quota is maxed out and no draft selections are uncommitted
  const isMemberFullyCompleted = Boolean(
    (isQuotaMaxed || selectedMemberQuotaStatus?.isFullyMaxed) &&
    hasSavedSlots &&
    newlySelectedScheduleIds.length === 0
  )

  const isSlotPast = (pattern: SchedulePattern): boolean => {
    if (!pattern.date) return false
    const parts = pattern.date.split('-').map(Number)
    if (parts.length < 3) return false
    const [y, m, d] = parts
    const timeParts = (pattern.startTime || '00:00').split(':').map(Number)
    const hh = timeParts[0] || 0
    const mm = timeParts[1] || 0
    const slotTime = new Date(y, m - 1, d, hh, mm, 0).getTime()
    return slotTime <= currentTime
  }

  const handleCellClick = (patternId: string, category: 'sunday' | 'weekday' | 'special', targetSlotIndex?: number) => {
    if (isClosed) {
      setLimitModal({
        title: 'Scheduling Closed',
        message: isDraft
          ? 'This publication is currently in draft mode and not accepting submissions.'
          : isFinalized
            ? 'This schedule period has been finalized by the administrator.'
            : `The submission deadline (${publication?.submissionDeadline ? new Date(publication.submissionDeadline).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }) : ''}) has passed. Scheduling is now closed.`
      })
      return
    }
    if (isMemberFullyCompleted) {
      const fullMsg = 'You have already completed your maximum schedule quota for this publication.'
      setMessage({ type: 'error', text: fullMsg })
      setLimitModal({ title: 'Schedule Completed', message: fullMsg })
      return
    }

    if (!selectedMemberId) {
      const errText = 'Please select your name first from the selection panel!'
      setMessage({ type: 'error', text: errText })
      setLimitModal({ title: 'Select Name First', message: errText })
      return
    }

    if (isSuspended && !isSpecialPub) {
      const suspMsg = 'Your serving privileges are currently SUSPENDED. You cannot select or submit slots for Sunday/Weekday Mass schedules until your suspension is cleared. Please attend the required monthly meetings.'
      setMessage({ type: 'error', text: suspMsg })
      setLimitModal({ title: 'Account Suspended', message: suspMsg })
      return
    }

    const patterns = category === 'special'
      ? specialPatterns
      : category === 'sunday'
        ? sundayPatterns
        : weekdayPatterns

    const pattern = patterns.find(p => p.id === patternId)
    if (!pattern) return

    // Check if slot has already concluded/passed
    if (isSlotPast(pattern)) {
      const pastMsg = 'Tapos na ang schedule na ito at sarado na sa pagpili.'
      setMessage({ type: 'error', text: pastMsg })
      setLimitModal({ title: 'Schedule Ended', message: pastMsg })
      return
    }

    // Check if member is ALREADY saved in DB for this pattern/schedule slot
    const isAlreadySavedInDb =
      pattern.scheduleIds.some(id => savedScheduleIdsForMember.has(id)) ||
      pattern.assignedMembers.includes(selectedMemberId)
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
      const currentMember = members.find(m => m.id === selectedMemberId)

      // Check rank quota for this slot
      if (currentMember?.rank) {
        const isSunday = category === 'sunday'
        const isSpecial = category === 'special'
        const rankLimit = getRankLimitForSlot(publication, currentMember.rank, isSunday, isSpecial)
        if (rankLimit !== undefined) {
          const currentRankCount = pattern.assignedMembers.filter(id => {
            const m = members.find(mem => mem.id === id)
            return m?.rank?.toLowerCase().trim() === currentMember.rank?.toLowerCase().trim()
          }).length

          if (currentRankCount >= rankLimit) {
            // Find which other ranks still have open reserved slots in this pattern
            const allowedRanks = publication.allowedRanks && publication.allowedRanks.length > 0
              ? publication.allowedRanks
              : ['Chevaliers', 'Paladins']

            const availableReservedRanks: string[] = []
            allowedRanks.forEach(r => {
              if (r.toLowerCase().trim() !== currentMember.rank?.toLowerCase().trim()) {
                const otherLimit = getRankLimitForSlot(publication, r, isSunday, isSpecial)
                const otherAssignedCount = pattern.assignedMembers.filter(id => {
                  const m = members.find(mem => mem.id === id)
                  return m?.rank?.toLowerCase().trim() === r.toLowerCase().trim()
                }).length

                if (otherLimit === undefined) {
                  availableReservedRanks.push(r)
                } else if (otherAssignedCount < otherLimit) {
                  const openCount = otherLimit - otherAssignedCount
                  availableReservedRanks.push(`${r} (${openCount} slot${openCount > 1 ? 's' : ''} available)`)
                }
              }
            })

            const reservedText = availableReservedRanks.length > 0
              ? `The remaining open slot(s) are reserved for: ${availableReservedRanks.join(', ')}.`
              : `All slot allotments in this Mass are currently filled.`

            const rankMsg = `Rank Limit Reached: This ${isSpecial ? 'Special Event' : isSunday ? 'Sunday' : 'Weekday'} Mass slot already reached its capacity of ${rankLimit} server(s) for ${currentMember.rank}. ${reservedText}`
            setMessage({ type: 'error', text: rankMsg })
            setLimitModal({ 
              title: `${currentMember.rank} Full (Reserved for ${availableReservedRanks.map(r => r.split(' ')[0]).join(', ') || 'Others'})`, 
              message: rankMsg 
            })
            return
          }
        }
      }

      if (category === 'special') {
        const isActualSpecialEvent = publication?.publicationType === 'special_event'
        const maxServersForSlot = isActualSpecialEvent
          ? (publication?.maxServersPerSpecialSlot ?? 6)
          : (publication?.maxServersPerWeekdaySlot ?? 5)
        if (pattern.assignedMembers.length >= maxServersForSlot) {
          const capacityMsg = `Slot Full: This Mass time slot already reached the maximum capacity of ${maxServersForSlot} server(s).`
          setMessage({ type: 'error', text: capacityMsg })
          setLimitModal({ title: 'Slot Full', message: capacityMsg })
          return
        }

        const max = isActualSpecialEvent
          ? (publication?.maxSpecialPerServer ?? 2)
          : (publication?.maxWeekdaysPerServer ?? 8)
        if (selectedSpecialCount >= max) {
          const limitMsg = `Personal Limit Reached: You can only select up to ${max} schedule slot(s) for yourself.`
          setMessage({ type: 'error', text: limitMsg })
          setLimitModal({ title: 'Slot Limit Reached', message: limitMsg })
          return
        }
      } else if (category === 'sunday') {
        const maxServersForSlot = publication.maxServersPerSundaySlot ?? 5
        if (pattern.assignedMembers.length >= maxServersForSlot) {
          const capacityMsg = `Mass Slot Full: This Sunday Mass time slot already reached the maximum capacity of ${maxServersForSlot} server(s).`
          setMessage({ type: 'error', text: capacityMsg })
          setLimitModal({ title: 'Mass Slot Full', message: capacityMsg })
          return
        }

        const max = publication.maxSundaysPerServer ?? 4
        if (selectedSundayCount >= max) {
          const limitMsg = `Personal Limit Reached: You can only select up to ${max} Sunday schedule(s) for yourself.`
          setMessage({ type: 'error', text: limitMsg })
          setLimitModal({ title: 'Sunday Personal Limit Reached', message: limitMsg })
          return
        }
      } else {
        const maxServersForSlot = publication.maxServersPerWeekdaySlot ?? 5
        if (pattern.assignedMembers.length >= maxServersForSlot) {
          const capacityMsg = `Mass Slot Full: This Weekday Mass time slot already reached the maximum capacity of ${maxServersForSlot} server(s).`
          setMessage({ type: 'error', text: capacityMsg })
          setLimitModal({ title: 'Mass Slot Full', message: capacityMsg })
          return
        }

        const max = publication.maxWeekdaysPerServer ?? 8
        if (selectedWeekdayCount >= max) {
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

    setSelectedSlotIndexMap(prev => {
      const next = { ...prev }
      if (isSelected) {
        delete next[pattern.id]
        pattern.scheduleIds.forEach(id => delete next[id])
      } else {
        const slot = targetSlotIndex !== undefined
          ? targetSlotIndex
          : (pattern.assignedMembers.findIndex(m => !m) !== -1 ? pattern.assignedMembers.findIndex(m => !m) : pattern.assignedMembers.length)
        next[pattern.id] = slot
        pattern.scheduleIds.forEach(id => {
          next[id] = slot
        })
      }
      return next
    })
    setMessage(null)
  }

  const handleOpenConfirmModal = (e: React.FormEvent) => {
    e.preventDefault()
    if (isClosed) {
      setLimitModal({
        title: 'Submissions Closed',
        message: isDraft
          ? 'This publication is currently in draft mode and not accepting submissions.'
          : isFinalized
            ? 'This schedule period has been finalized by the administrator.'
            : `The submission deadline (${publication?.submissionDeadline ? new Date(publication.submissionDeadline).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }) : ''}) has passed. Submissions are no longer accepted.`
      })
      return
    }

    if (!selectedMemberId) {
      setMessage({ type: 'error', text: 'Please select your name first from the selection panel.' })
      setLimitModal({ title: 'Select Name First', message: 'Please select your name from the selection panel before saving.' })
      return
    }

    if (isSuspended && !isSpecialPub) {
      const suspMsg = 'Your serving privileges are currently SUSPENDED. You cannot submit Mass schedules. Please attend monthly meetings for clearance.'
      setMessage({ type: 'error', text: suspMsg })
      setLimitModal({ title: 'Account Suspended', message: suspMsg })
      return
    }

    if (newlySelectedScheduleIds.length === 0) {
      const noSelectionMsg = hasSavedSlots
        ? 'Please select at least one additional schedule slot from the table before saving.'
        : 'Please select at least one schedule slot from the table before saving.'
      setMessage({ type: 'error', text: noSelectionMsg })
      setLimitModal({ title: 'No New Schedule Selected', message: noSelectionMsg })
      return
    }

    setConfirmSubmitOpen(true)
  }

  const handleConfirmedSave = async () => {
    setConfirmSubmitOpen(false)
    if (!publication || !selectedMemberId) return

    if (isClosed) {
      setMessage({ type: 'error', text: 'Submissions are closed for this publication.' })
      setLimitModal({
        title: 'Scheduling Closed',
        message: isDraft
          ? 'This publication is currently in draft mode and not accepting submissions.'
          : isFinalized
            ? 'This schedule period has been finalized by the administrator.'
            : 'Submissions are no longer accepted for this publication.'
      })
      return
    }

    setSubmitting(true)
    setMessage(null)

    try {
      const selectedPatterns = isSpecialPub
        ? specialPatterns.filter(p => p.scheduleIds.some(id => selectedScheduleIds.has(id)))
        : [...sundayPatterns, ...weekdayPatterns].filter(p => p.scheduleIds.some(id => selectedScheduleIds.has(id)))

      const slotSummaries = selectedPatterns.map(p => {
        const chosenSlot = selectedSlotIndexMap[p.id] ?? selectedSlotIndexMap[p.scheduleIds[0]]
        return {
          dayOfWeek: p.dayOfWeek,
          dayName: p.dayName,
          startTime: p.startTime,
          title: p.title,
          location: p.location,
          datesCount: p.scheduleIds.length,
          scheduleIds: p.scheduleIds,
          ...(chosenSlot !== undefined ? { slotIndex: chosenSlot } : {})
        }
      })

      const newSubmission = await submissionService.createPendingSubmission(
        {
          publicationId: publication.id,
          memberId: selectedMemberId,
          memberName: selectedMember ? getFullName(selectedMember) : selectedMemberName,
          memberRank: selectedMember?.rank || '',
          requestedScheduleIds: Array.from(selectedScheduleIds),
          slotSummaries
        },
        {
          member: selectedMember || undefined,
          publication,
          publicationSchedules
        }
      )

      // Add to local state so user immediately sees their submission confirmed
      setSubmissions(prev => [...prev.filter(s => s.memberId !== selectedMemberId), newSubmission])

      const successTitle = isQuotaMaxed ? 'Schedule Completed!' : 'Schedule Saved!'
      const successMsg = isQuotaMaxed
        ? `Thank you, ${selectedMember?.firstName || 'Altar Server'}! You have reached your maximum schedule quota. All your selections have been saved to the roster.`
        : `Thank you, ${selectedMember?.firstName || 'Altar Server'}! Your selected schedule slots have been saved to the roster. You can select additional slots anytime before the deadline.`

      setMessage({
        type: 'success',
        text: successMsg
      })
      setLimitModal({
        title: successTitle,
        message: successMsg
      })
    } catch (err: any) {
      console.error(err)
      const errMsg = err.message || 'Failed to submit schedule preferences.'
      setMessage({ type: 'error', text: errMsg })
      setLimitModal({
        title: 'Submission Not Accepted',
        message: errMsg
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div
        className="min-h-screen bg-slate-50 flex items-center justify-center p-4"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)',
        }}
      >
        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    )
  }

  if ((!publication || (!canAdminSchedule && publication.status === 'draft')) && !loading) {
    const isDraft = publication?.status === 'draft'

    return (
      <div
        className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4 font-sans relative overflow-hidden"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)',
        }}
      >
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
                  This link is <strong>temporarily closed</strong> because it is currently in preparation and in the <strong>Draft stage</strong> by the Ministry Administrator. 
                  <br /><br />
                  Please wait until it is officially published by your coordinator.
                </>
              ) : (
                <>
                  This link is <strong>permanently closed</strong> or no longer available. This schedule period may have expired or been removed by the administrator.
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

  const bannerTheme = getLiturgicalTheme(publication?.liturgicalColor, isSpecialPub)
  const isAdminMode = schedulingMode === 'admin' && canAdminSchedule

  const openAdminRosterModal = (patternId?: string, slotIndex: number | null = null) => {
    const targetId = patternId || allPatterns[0]?.id || ''
    setAdminTargetPatternId(targetId)
    setAdminTargetSlotIndex(slotIndex)
    setAdminModalOpen(true)
  }

  const renderTable = (patterns: SchedulePattern[], maxRows: number, category: 'sunday' | 'weekday' | 'special', title: string, subtitle: string, icon: React.ReactNode) => {
    if (patterns.length === 0) return null

    const maxPerServer = category === 'special'
      ? (publication?.maxSpecialPerServer ?? 2)
      : category === 'sunday'
        ? (publication?.maxSundaysPerServer ?? 4)
        : (publication?.maxWeekdaysPerServer ?? 8)

    const slotCapacity = category === 'special'
      ? (publication?.maxServersPerSpecialSlot ?? 6)
      : category === 'sunday'
        ? (publication?.maxServersPerSundaySlot ?? 5)
        : (publication?.maxServersPerWeekdaySlot ?? 5)

    const currentCount = category === 'special'
      ? selectedSpecialCount
      : category === 'sunday'
        ? selectedSundayCount
        : selectedWeekdayCount

    const sectionTheme = getLiturgicalTheme(publication?.liturgicalColor, category === 'special')

    return (
      <div className="mb-8 sm:mb-10 w-full max-w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 sm:mb-6">
          <div className="flex items-center gap-2.5 sm:gap-4 min-w-0">
            <div className={`w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl ${sectionTheme.headerIconBg} flex items-center justify-center shrink-0 shadow-xs`}>
              {icon}
            </div>
            <div className="min-w-0">
              <h2 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight truncate">{title}</h2>
              <p className="text-xs font-semibold text-slate-500 truncate">{subtitle}</p>
            </div>
          </div>

          {isAdminMode ? (
            <div className="inline-flex items-center gap-2 self-start sm:self-auto bg-indigo-50 border border-indigo-200/80 text-indigo-900 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl text-[11px] sm:text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse shrink-0" />
              <span>Click Mass header or slot to assign</span>
            </div>
          ) : (
            selectedMemberId && !isClosed && (
              <div className={`inline-flex items-center gap-2 self-start sm:self-auto ${category === 'special' ? 'bg-purple-50 border-purple-200/80 text-purple-900' : 'bg-indigo-50 border-indigo-200/80 text-indigo-900'} border px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl text-[11px] sm:text-xs font-bold`}>
                <span>Your Limit:</span>
                <span className={`px-2 py-0.5 rounded-md font-extrabold ${currentCount >= maxPerServer ? 'bg-amber-100 text-amber-900' : 'bg-white text-indigo-700 shadow-xs'}`}>
                  {currentCount} / {maxPerServer} Selected
                </span>
              </div>
            )
          )}
        </div>

        {/* Horizontal scroll hint on mobile */}
        <div className="sm:hidden mb-2 px-2.5 py-1.5 bg-slate-100/90 border border-slate-200 rounded-xl flex items-center justify-between text-[11px] font-bold text-slate-600">
          <span className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-indigo-600 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            <span>Swipe table horizontally</span>
          </span>
          <span className="text-[10px] font-extrabold uppercase text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200">
            {patterns.length} Masses ➔
          </span>
        </div>

        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden w-full max-w-full">
          <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-200 w-full max-w-full touch-pan-x">
            <table className="w-full border-collapse text-left min-w-max">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70">
                  <th className="px-2.5 sm:px-6 py-3 sm:py-5 font-extrabold text-[10px] sm:text-xs text-slate-400 uppercase tracking-widest w-14 sm:w-24 sticky left-0 bg-slate-100 sm:bg-slate-50/95 z-20 border-r border-slate-200/80 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.06)] text-center">
                    ROLE
                  </th>
                  {patterns.map(p => {
                    const theme = getLiturgicalTheme(p.liturgicalColor || publication?.liturgicalColor, category === 'special')
                    const isPast = isSlotPast(p)
                    const filledCount = (p.assignedMembers || []).filter(Boolean).length
                    const isFull = filledCount >= slotCapacity
                    return (
                      <th key={p.id} className="px-2.5 sm:px-6 py-3 sm:py-5 text-center min-w-[130px] sm:min-w-[175px] align-top">
                        <div className="font-black text-xs text-slate-900 uppercase tracking-widest">{p.dayName}</div>
                        <div className={`font-extrabold text-xs ${isPast ? 'text-slate-500' : theme.timeClass} mt-0.5`}>
                          {formatTime12Hour(p.startTime)}
                        </div>
                        {isPast && (
                          <div className="inline-flex items-center justify-center gap-1 px-2 py-0.5 mt-1 rounded-md bg-slate-200/90 text-slate-700 border border-slate-300 text-[10px] font-black uppercase tracking-wider shadow-2xs">
                            Ended
                          </div>
                        )}
                        {p.location && (
                          <div className={`inline-flex items-center justify-center gap-1 px-2 py-0.5 mt-1 rounded-md border text-[10px] font-extrabold max-w-[140px] sm:max-w-[150px] mx-auto truncate shadow-2xs ${theme.locationBadgeClass}`}>
                            <svg className={`w-2.5 h-2.5 shrink-0 ${theme.locationIconClass}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span className="truncate">{p.location}</span>
                          </div>
                        )}
                        {p.title && (!p.location || p.title.toLowerCase().trim() !== p.location.toLowerCase().trim()) && (
                          <div className={theme.subtextClass}>{p.title}</div>
                        )}

                        {publication?.enableRankQuotas && (
                          <div className="mt-1.5 flex items-center justify-center gap-1 flex-wrap text-[9px] font-bold">
                            {getSlotRankBreakdown(p.assignedMembers, members, publication, category === 'sunday', category === 'special').items.map(item => (
                              <span
                                key={item.rank}
                                className={`px-1.5 py-0.5 rounded-md border text-[9px] font-bold ${
                                  item.isFull
                                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                                    : 'bg-slate-100 text-slate-600 border-slate-200'
                                }`}
                                title={`${item.rank}: ${item.current} / ${item.limit !== undefined ? item.limit : 'Unlimited'}`}
                              >
                                {item.rank.slice(0, 4)}: {item.current}/{item.limit !== undefined ? item.limit : '∞'}
                              </span>
                            ))}
                          </div>
                        )}

                        {isAdminMode && (
                          <div className="mt-2 pt-2 border-t border-slate-200/70 flex flex-col items-center gap-1.5">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-extrabold border ${
                              isFull
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : filledCount > 0
                                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                  : 'bg-amber-50 text-amber-800 border-amber-200'
                            }`}>
                              {filledCount}/{slotCapacity} Filled
                            </span>
                            <button
                              type="button"
                              onClick={() => openAdminRosterModal(p.id, null)}
                              className="w-full py-1 px-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-[10px] font-extrabold shadow-2xs transition cursor-pointer flex items-center justify-center gap-1"
                            >
                              <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              <span>Edit Roster</span>
                            </button>
                          </div>
                        )}
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {Array.from({ length: maxRows }).map((_, rowIndex) => (
                  <tr key={rowIndex} className="hover:bg-slate-50/40 transition-colors">
                    <td className="px-2.5 sm:px-6 py-2.5 sm:py-4 font-bold text-[11px] sm:text-xs text-slate-400 uppercase sticky left-0 bg-white sm:bg-white/95 z-10 border-r border-slate-200/80 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.06)] text-center">
                      S-{rowIndex + 1}
                    </td>
                    {patterns.map(pattern => {
                      const theme = getLiturgicalTheme(pattern.liturgicalColor || publication?.liturgicalColor, category === 'special')
                      const isPast = isSlotPast(pattern)
                      const isSelectedByCurrentMember = pattern.scheduleIds.some(id => selectedScheduleIds.has(id))
                      const savedMemberIds = pattern.assignedMembers
                      const assignedMemberIdAtRow = savedMemberIds[rowIndex] || ''
                      const assignedMemberObj = assignedMemberIdAtRow ? memberObjMap.get(assignedMemberIdAtRow) : undefined
                      const isHighlightedInAdmin = Boolean(isAdminMode && adminHighlightServerId && assignedMemberIdAtRow === adminHighlightServerId)

                      // Admin Mode cell rendering
                      if (isAdminMode) {
                        const adminDisplayName = assignedMemberIdAtRow ? (memberMap.get(assignedMemberIdAtRow) || assignedMemberIdAtRow) : null
                        const rankShort = assignedMemberObj?.rank ? assignedMemberObj.rank.slice(0, 1).toUpperCase() : ''

                        return (
                          <td key={pattern.id} className="px-1.5 sm:px-3 py-2 sm:py-3 text-center align-middle">
                            {adminDisplayName ? (
                              <button
                                type="button"
                                onClick={() => openAdminRosterModal(pattern.id, rowIndex)}
                                className={`group inline-flex items-center justify-between gap-1 px-2 sm:px-3.5 py-1.5 sm:py-2.5 rounded-xl sm:rounded-2xl border text-[11px] sm:text-xs font-bold transition-all select-none min-w-[115px] sm:min-w-[155px] max-w-[135px] sm:max-w-[165px] text-left cursor-pointer ${
                                  isHighlightedInAdmin
                                    ? 'bg-amber-100 border-amber-500 text-amber-950 ring-2 ring-amber-400 shadow-md scale-[1.03]'
                                    : 'bg-white hover:bg-indigo-50/70 border-slate-200 hover:border-indigo-300 text-slate-800 shadow-2xs'
                                }`}
                                title={`Click to change or remove ${adminDisplayName} (Slot S-${rowIndex + 1})`}
                              >
                                <div className="flex items-center gap-1.5 min-w-0">
                                  {rankShort ? (
                                    <span className={`w-4 h-4 rounded-md text-[9px] font-black flex items-center justify-center shrink-0 ${
                                      assignedMemberObj?.rank === 'Chevaliers'
                                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                        : assignedMemberObj?.rank === 'Paladins'
                                          ? 'bg-indigo-100 text-indigo-800 border border-indigo-300'
                                          : 'bg-slate-200 text-slate-700'
                                    }`}>
                                      {rankShort}
                                    </span>
                                  ) : (
                                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${theme.cellDotClass}`} />
                                  )}
                                  <span className="truncate">{adminDisplayName}</span>
                                </div>
                                <svg className="w-3 h-3 text-slate-400 group-hover:text-indigo-600 shrink-0 opacity-60 group-hover:opacity-100 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => openAdminRosterModal(pattern.id, rowIndex)}
                                className="w-full h-full min-h-[38px] sm:min-h-[44px] rounded-xl sm:rounded-2xl border-2 border-dashed border-indigo-200/80 hover:border-indigo-500 hover:bg-indigo-50/60 flex items-center justify-center gap-1 text-[11px] font-extrabold text-indigo-500 hover:text-indigo-700 transition-all cursor-pointer"
                                title={`Assign Server to Slot S-${rowIndex + 1}`}
                              >
                                <span>+ Assign</span>
                              </button>
                            )}
                          </td>
                        )
                      }
                      
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
                          const chosenSlot = selectedSlotIndexMap[pattern.id] ?? selectedSlotIndexMap[pattern.scheduleIds[0]]
                          const targetSlot = chosenSlot !== undefined ? chosenSlot : savedMemberIds.findIndex(m => !m)
                          const resolvedSlot = targetSlot !== -1 ? targetSlot : savedMemberIds.length
                          if (rowIndex === resolvedSlot) {
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
                        <td key={pattern.id} className="px-1.5 sm:px-3 py-2 sm:py-3 text-center align-middle">
                          {displayMemberName ? (
                            <div
                              onClick={() => !isOtherUserCell && !isPast && handleCellClick(pattern.id, category, rowIndex)}
                              className={`inline-flex items-center justify-center px-2 sm:px-4 py-1.5 sm:py-3 rounded-xl sm:rounded-2xl border text-[11px] sm:text-xs font-bold transition-all select-none min-w-[115px] sm:min-w-[140px] max-w-[130px] sm:max-w-[160px] text-center ${
                                isPast
                                  ? 'bg-slate-100 border-slate-200 text-slate-600 cursor-not-allowed opacity-90 shadow-2xs'
                                  : isMyCell
                                    ? theme.cellSelectedClass
                                    : 'bg-slate-50 border-slate-200 text-slate-800 cursor-not-allowed opacity-85 shadow-xs'
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full mr-1.5 sm:mr-2 shrink-0 ${isPast ? 'bg-slate-400' : isMyCell ? 'bg-white' : theme.cellDotClass}`} />
                              <span className="truncate">{displayMemberName}</span>
                            </div>
                          ) : isPast ? (
                            <div className="w-full h-full min-h-[38px] sm:min-h-[44px] rounded-xl sm:rounded-2xl border border-slate-200 bg-slate-100/70 flex items-center justify-center text-[10px] font-extrabold text-slate-400 select-none cursor-not-allowed">
                              Closed
                            </div>
                          ) : (
                            <div
                              onClick={() => !isClosed && handleCellClick(pattern.id, category, rowIndex)}
                              className={`w-full h-full min-h-[38px] sm:min-h-[44px] rounded-xl sm:rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center transition-all ${
                                !isClosed && !isMemberFullyCompleted
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
    <div
      className="min-h-screen bg-[#f8fafc] flex flex-col lg:flex-row font-sans text-slate-800 pb-24 lg:pb-0 w-full max-w-full overflow-x-hidden"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      {/* LEFT FORM PANEL */}
      <div className="w-full lg:w-[380px] lg:fixed lg:top-0 lg:left-0 lg:h-screen lg:overflow-y-auto bg-white border-b lg:border-b-0 lg:border-r border-slate-200 p-4 sm:p-6 lg:p-8 flex flex-col shrink-0 shadow-xs justify-between min-w-0 z-30 scrollbar-thin scrollbar-thumb-slate-200">
        <div>
          {/* Header Actions */}
          <div className="flex items-center gap-3.5 mb-5 sm:mb-8">
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl sm:rounded-full overflow-hidden border border-indigo-100 shadow-xs flex items-center justify-center bg-white shrink-0">
              <img src="/favicon/favicon.png" alt="Ministry Logo" className="w-full h-full object-cover" />
            </div>
            <div className="lg:hidden min-w-0">
              <h1 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight truncate">Schedule Selection</h1>
              <p className="text-xs font-bold text-indigo-600 truncate">{publication?.name}</p>
              {publication?.submissionDeadline && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className={`text-[11px] font-bold mt-0.5 flex items-center gap-1 ${isDeadlinePassed ? 'text-rose-700' : 'text-purple-700'}`}>
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>
                      {isDeadlinePassed ? 'Deadline Passed: ' : 'Deadline: '}
                      {new Date(publication.submissionDeadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </span>
                  </p>
                  {!isDeadlinePassed && countdown.hasDeadline && (
                    <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-200">
                      ⏱ {countdown.formatted}
                    </span>
                  )}
                </div>
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
                <div className={`p-2.5 rounded-xl border text-xs font-bold mt-2 flex items-center gap-2 ${
                  isDeadlinePassed 
                    ? 'bg-rose-50 border-rose-200 text-rose-900' 
                    : 'bg-purple-50 border-purple-200 text-purple-900'
                }`}>
                  <span className={`${isDeadlinePassed ? 'text-rose-600' : 'text-purple-600'} shrink-0`}>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </span>
                  <div>
                    <span className={`block text-[10px] ${isDeadlinePassed ? 'text-rose-600' : 'text-purple-500'} uppercase font-black`}>
                      {isDeadlinePassed ? 'Submission Closed (Deadline Passed)' : 'Submission Deadline'}
                    </span>
                    <span>{new Date(publication.submissionDeadline).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}</span>
                  </div>
                  {!isDeadlinePassed && countdown.hasDeadline && (
                    <span className="ml-auto inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-black bg-purple-100 text-purple-800 tracking-wide border border-purple-200 shrink-0">
                      ⏱ {countdown.formatted}
                    </span>
                  )}
                </div>
              )}
              {publication?.description && (
                <p className="text-xs text-slate-500 mt-2">{publication.description}</p>
              )}
            </div>
          </div>

          {user && (
            <div className="mb-4">
              <button
                type="button"
                onClick={() => navigate('/schedules')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer border border-slate-200 shadow-2xs group"
              >
                <svg className="w-3.5 h-3.5 text-indigo-600 group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span>← Return to Schedules Management</span>
              </button>
            </div>
          )}

          {canAdminSchedule && (
            <div className="mb-5 p-1 bg-slate-100 rounded-xl border border-slate-200 flex items-center">
              <button
                type="button"
                onClick={() => setSchedulingMode('member')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  schedulingMode === 'member'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span>Member Mode</span>
              </button>
              <button
                type="button"
                onClick={() => setSchedulingMode('admin')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  schedulingMode === 'admin'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span>Admin Mode</span>
              </button>
            </div>
          )}

          {schedulingMode === 'admin' && canAdminSchedule ? (
            <div className="space-y-3.5 mt-2 sm:mt-4">
              {/* Executive Command Center Header Card */}
              <div className="bg-gradient-to-br from-indigo-50/90 via-white to-slate-50 border border-indigo-200/80 p-3.5 sm:p-5 rounded-2xl shadow-xs space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <span className="block text-xs font-black text-slate-900 uppercase tracking-wide truncate">
                        Admin Command Center
                      </span>
                      <span className="text-[10px] font-bold text-slate-500 block truncate">
                        Direct Matrix & Roster Control
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Live
                    </span>
                    <button
                      type="button"
                      onClick={() => setAdminControlsExpanded(prev => !prev)}
                      className="lg:hidden px-2 py-1 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 text-[10px] font-black rounded-lg border border-indigo-200 transition cursor-pointer"
                    >
                      {adminControlsExpanded ? 'Hide ▲' : 'Tools ▼'}
                    </button>
                  </div>
                </div>

                {/* Cycle Health Progress Bar */}
                <div className="bg-white border border-slate-200/80 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs font-extrabold">
                    <span className="text-slate-600">Slot Occupancy</span>
                    <span className="text-indigo-700">
                      {adminCycleMetrics.totalFilled} / {adminCycleMetrics.totalCapacity} ({adminCycleMetrics.fillPercent}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        adminCycleMetrics.fillPercent >= 90
                          ? 'bg-emerald-500'
                          : adminCycleMetrics.fillPercent >= 50
                            ? 'bg-indigo-600'
                            : 'bg-amber-500'
                      }`}
                      style={{ width: `${Math.min(100, adminCycleMetrics.fillPercent)}%` }}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 pt-1 text-center">
                    <div className="bg-emerald-50/70 border border-emerald-200/70 rounded-lg py-1.5 px-1">
                      <span className="block text-sm font-black text-emerald-800">{adminCycleMetrics.totalFilled}</span>
                      <span className="block text-[9px] font-extrabold text-emerald-600 uppercase">Filled</span>
                    </div>
                    <div className="bg-amber-50/70 border border-amber-200/70 rounded-lg py-1.5 px-1">
                      <span className="block text-sm font-black text-amber-800">{adminCycleMetrics.totalVacant}</span>
                      <span className="block text-[9px] font-extrabold text-amber-600 uppercase">Vacant</span>
                    </div>
                    <div className="bg-indigo-50/70 border border-indigo-200/70 rounded-lg py-1.5 px-1">
                      <span className="block text-sm font-black text-indigo-800">{adminCycleMetrics.totalSubmissionsCount}</span>
                      <span className="block text-[9px] font-extrabold text-indigo-600 uppercase">Submitted</span>
                    </div>
                  </div>
                </div>

                {/* Collapsible Mobile Section: Tools & Highlighter */}
                <div className={`space-y-3 pt-1 ${adminControlsExpanded ? 'block' : 'hidden lg:block'}`}>
                  {/* Server Schedule Highlighter */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                        Highlight Server in Matrix
                      </label>
                      {adminHighlightServerId && (
                        <button
                          type="button"
                          onClick={() => setAdminHighlightServerId('')}
                          className="text-[10px] font-extrabold text-rose-600 hover:underline cursor-pointer"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    <MemberSearchDropdown
                      members={members}
                      value={adminHighlightServerId}
                      onChange={(id) => setAdminHighlightServerId(id)}
                      placeholder="Find server across schedule..."
                      allowClear={true}
                    />
                    {adminHighlightServerId && (
                      <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-[11px] font-bold text-amber-900">
                        <span>Assigned Mass Slots:</span>
                        <span className="px-2 py-0.5 rounded-md bg-amber-200/80 text-amber-950 font-black">
                          {adminCycleMetrics.highlightedServerSlots} Mass(es)
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Effective Date Control */}
                  <div className="pt-2 border-t border-slate-200/70 flex items-center justify-between gap-2 text-xs">
                    <span className="font-bold text-slate-600">Effective Date:</span>
                    <input
                      type="date"
                      value={adminEffectiveDate}
                      min={publication?.startDate}
                      max={publication?.endDate}
                      onChange={(e) => setAdminEffectiveDate(e.target.value)}
                      className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-extrabold text-indigo-700 cursor-pointer focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Quick Admin Action Buttons */}
              <div className={`space-y-2 ${adminControlsExpanded ? 'block' : 'hidden lg:block'}`}>
                <button
                  type="button"
                  onClick={() => setManageSubmissionsOpen(true)}
                  className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white font-black text-xs rounded-2xl shadow-md shadow-indigo-600/20 transition flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                    <span>Submissions Monitor & Auto-Assign</span>
                  </div>
                  {adminCycleMetrics.pendingSubmissionsCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-300 text-slate-950 text-[10px] font-black">
                      {adminCycleMetrics.pendingSubmissionsCount} Pending
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => openAdminRosterModal()}
                  className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 text-slate-800 font-extrabold text-xs rounded-2xl border border-slate-200 shadow-2xs transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <svg className="w-4 h-4 text-indigo-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  <span>Open Mass Roster Editor</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.href)
                    toast.success('Link Copied', 'Public schedule link copied to clipboard!')
                  }}
                  className="w-full py-2.5 px-4 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-2xl border border-slate-200/80 transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <span>Copy Public Schedule Link</span>
                </button>
              </div>
            </div>
          ) : isDraft ? (
            <div className="bg-slate-50 border border-slate-200/80 p-5 sm:p-6 rounded-2xl text-center shadow-xs mt-2 sm:mt-4">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 text-slate-600 flex items-center justify-center mx-auto mb-3 shadow-xs">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
              </div>
              <h3 className="text-slate-900 font-black mb-1 sm:mb-2 text-base sm:text-lg tracking-tight">Draft Schedule (Submissions Not Open)</h3>
              <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
                This schedule publication is currently in draft mode and is not accepting submissions.
              </p>
            </div>
          ) : isFinalized ? (
            <div className="bg-amber-50 border border-amber-200/80 p-5 sm:p-6 rounded-2xl text-center shadow-xs mt-2 sm:mt-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 border border-amber-200 text-amber-700 flex items-center justify-center mx-auto mb-3 shadow-xs">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              <h3 className="text-amber-950 font-black mb-1 sm:mb-2 text-base sm:text-lg tracking-tight">Scheduling Closed</h3>
              <p className="text-amber-800 text-xs sm:text-sm leading-relaxed">
                This schedule period has been finalized by the administrator. No further selections can be made.
              </p>
            </div>
          ) : isDeadlinePassed ? (
            <div className="bg-rose-50 border border-rose-200/80 p-5 sm:p-6 rounded-2xl text-center shadow-xs mt-2 sm:mt-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 border border-rose-200 text-rose-700 flex items-center justify-center mx-auto mb-3 shadow-xs">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
              <h3 className="text-rose-950 font-black mb-1 sm:mb-2 text-base sm:text-lg tracking-tight">Deadline Passed (Closed)</h3>
              <p className="text-rose-800 text-xs sm:text-sm leading-relaxed">
                The submission deadline for this schedule (<strong>{new Date(publication!.submissionDeadline!).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}</strong>) has expired. Submissions are now closed.
              </p>
            </div>
          ) : (
            <ValidatedForm onSubmit={handleOpenConfirmModal} className="space-y-4 sm:space-y-6">
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
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="text-xs font-bold">{m.lastName}, {m.firstName}</span>
                                      {m.status === 'suspended' && (
                                        <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-rose-100 text-rose-700 border border-rose-200">
                                          SUSPENDED
                                        </span>
                                      )}
                                      {(() => {
                                        const q = memberQuotaStatusMap.get(m.id)
                                        const hasSaved = Boolean(
                                          (q && (q.sundayCount > 0 || q.weekdayCount > 0 || q.specialCount > 0)) ||
                                          submissions.some(s => s.memberId === m.id) ||
                                          publication?.submittedMembers?.includes(m.id)
                                        )
                                        if (!hasSaved) return null
                                        return (
                                          <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-200">
                                            {isSpecialPub
                                              ? `${q?.specialCount ?? 1}/${publication?.maxSpecialPerServer ?? 2} SPECIAL`
                                              : `${q?.sundayCount ?? 0}/${publication?.maxSundaysPerServer ?? 4} SUN${q?.weekdayCount ? ` · ${q.weekdayCount}/${publication?.maxWeekdaysPerServer ?? 8} WK` : ''}`}
                                          </span>
                                        )
                                      })()}
                                    </div>
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

              {/* Suspended Account Notice Banner */}
              {isSuspended && !isSpecialPub && (
                <div className="bg-rose-50/90 border border-rose-200 p-4 rounded-2xl text-xs text-rose-950 leading-relaxed shadow-xs space-y-1.5">
                  <div className="flex items-center gap-1.5 font-extrabold text-rose-900">
                    <svg className="h-4 w-4 text-rose-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>Serving Privileges Suspended</span>
                  </div>
                  <p className="text-[11px] text-rose-800 leading-relaxed font-medium">
                    Bro. {selectedMemberName}, your serving privileges are currently marked as <strong>SUSPENDED</strong> due to attendance requirements. You cannot submit availability or select slots for Sunday and Weekday Mass schedules until cleared. Please attend the required monthly meetings.
                  </p>
                </div>
              )}

              {isMemberFullyCompleted ? (
                <div className="bg-emerald-50/80 border border-emerald-200 p-3.5 sm:p-4 rounded-2xl text-xs text-emerald-950 leading-relaxed shadow-xs">
                  <div className="flex items-center gap-1.5 mb-1 font-extrabold text-emerald-900">
                    <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Schedule Completed (Max Quota Reached)</span>
                  </div>
                  All your schedule slots have been saved to the roster. To make changes or corrections, please contact your ministry coordinator directly.
                </div>
              ) : hasSavedSlots ? (
                <div className="bg-indigo-50/80 border border-indigo-200 p-3.5 sm:p-4 rounded-2xl text-xs text-indigo-950 leading-relaxed shadow-xs space-y-1.5">
                  <div className="flex items-center gap-1.5 font-extrabold text-indigo-900">
                    <svg className="w-4 h-4 text-indigo-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Schedule Saved (Partial)</span>
                  </div>
                  <p className="text-[11px] text-indigo-900 leading-relaxed">
                    Your previously saved slots are locked in the schedule. You have not yet reached your personal limit. Tap open <strong>+</strong> slots in the table to add more, then tap Submit.
                  </p>
                  <div className="pt-2 border-t border-indigo-200/60 flex items-center justify-between font-bold text-[11px]">
                    {isSpecialPub ? (
                      <span>Special Slots: {selectedSpecialCount}/{publication?.maxSpecialPerServer ?? 2}</span>
                    ) : (
                      <>
                        <span>Sunday: {selectedSundayCount}/{publication?.maxSundaysPerServer ?? 4}</span>
                        <span>Weekday: {selectedWeekdayCount}/{publication?.maxWeekdaysPerServer ?? 8}</span>
                      </>
                    )}
                  </div>
                </div>
              ) : (!isSuspended || isSpecialPub) && (
                isSpecialPub ? (
                  <div className="bg-purple-50/80 border border-purple-100 p-3.5 sm:p-4 rounded-2xl text-xs text-purple-900 leading-relaxed shadow-xs">
                    <strong className="block mb-1 text-purple-950 font-extrabold">2. Select Special Occasion Slots</strong>
                    Tap any special event slot below to choose your serving time. When done, tap Save Schedule.
                    {selectedMemberId && (
                      <div className="mt-2.5 pt-2 border-t border-purple-200/60 flex items-center justify-between font-bold text-[11px]">
                        <span>Special Slots: {selectedSpecialCount}/{publication?.maxSpecialPerServer ?? 2}</span>
                      </div>
                    )}
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
                )
              )}

              {message && (
                <div className={`p-3.5 sm:p-4 rounded-2xl text-xs font-bold ${message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
                  {message.text}
                </div>
              )}

              {/* Desktop Save Button (hidden on mobile, visible on lg+) */}
              <button
                type="submit"
                disabled={
                  submitting ||
                  !selectedMemberId ||
                  isClosed ||
                  (isSuspended && !isSpecialPub) ||
                  isMemberFullyCompleted ||
                  newlySelectedScheduleIds.length === 0
                }
                className={`hidden lg:flex w-full py-4 font-extrabold text-sm rounded-2xl shadow-lg transition-all items-center justify-center gap-2 mt-4 ${
                  isMemberFullyCompleted || isClosed || (isSuspended && !isSpecialPub) || newlySelectedScheduleIds.length === 0
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none' 
                    : `${bannerTheme.buttonClass} cursor-pointer disabled:opacity-50`
                }`}
              >
                <span>
                  {submitting 
                    ? 'Submitting...' 
                    : isClosed
                      ? 'Scheduling Closed'
                      : isSuspended && !isSpecialPub
                        ? 'Account Suspended (Cannot Submit)'
                        : isMemberFullyCompleted
                          ? 'Schedule Completed (Max Quota Reached)'
                          : newlySelectedScheduleIds.length === 0
                            ? hasSavedSlots
                              ? 'Select Additional Slots to Submit'
                              : 'Select Schedule Slots in Table'
                            : hasSavedSlots
                              ? `Submit Additional Slots (+${newlySelectedScheduleIds.length} new)`
                              : isQuotaMaxed 
                                ? 'Submit Schedule Preferences' 
                                : isSpecialPub
                                  ? `Submit Selections (${selectedSpecialCount} special slot(s))`
                                  : `Submit Selections (${selectedSundayCount + selectedWeekdayCount} slots)`}
                </span>
                <span className="text-base">▹</span>
              </button>
            </ValidatedForm>
          )}
        </div>

        <div className="hidden lg:block pt-8 text-center text-[11px] font-bold text-slate-400">
          © {new Date().getFullYear()} Ministry of Altar Servers
        </div>
      </div>

      {/* RIGHT MATRIX TABLE PANEL */}
      <div className="flex-1 min-w-0 w-full max-w-full p-3 sm:p-5 md:p-8 lg:p-10 overflow-x-hidden lg:ml-[380px]">
        {publicationSchedules.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 sm:p-10 bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs">
            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                <line x1="16" x2="16" y1="2" y2="6" />
                <line x1="8" x2="8" y1="2" y2="6" />
                <line x1="3" x2="21" y1="10" y2="10" />
              </svg>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-800 mb-2">No Schedules Yet</h2>
            <p className="text-xs sm:text-sm text-slate-500 max-w-md">
              There are currently no matching schedules within this publication's date range ({publication?.startDate} to {publication?.endDate}). 
              <br/><br/>
              <strong>Admin Instruction:</strong> Create or generate schedules for this date range in the Schedule Management page.
            </p>
          </div>
        ) : (
          <>
            {/* SCHEDULE MONTH BANNER ABOVE SUNDAY MASSES */}
            <div className={`mb-4 sm:mb-6 ${bannerTheme.bannerGradient} text-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl shadow-lg border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4`}>
              <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-white/10 flex items-center justify-center shrink-0 border border-white/10 shadow-xs">
                  <svg xmlns="http://www.w3.org/2000/svg" className={`w-5 h-5 sm:w-7 sm:h-7 ${bannerTheme.bannerIcon}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                    <span className={`text-[10px] sm:text-[11px] font-extrabold ${bannerTheme.bannerSubtext} uppercase tracking-widest`}>
                      {isSpecialPub ? 'SPECIAL OCCASION SCHEDULE' : 'SCHEDULE PERIOD'}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-white/15 text-white border border-white/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Live Updates
                    </span>
                  </div>
                  <h2 className="text-lg sm:text-2xl md:text-3xl font-black tracking-tight text-white break-words">
                    {publication?.name || 'Schedule Period'}
                  </h2>
                  <p className={`text-[11px] ${bannerTheme.bannerSubtext} font-semibold sm:hidden mt-0.5`}>
                    {publication?.startDate} to {publication?.endDate}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-stretch sm:self-auto flex-wrap">
                {isAdminMode && (
                  <button
                    type="button"
                    onClick={() => openAdminRosterModal()}
                    className="flex-1 sm:flex-initial px-3 sm:px-3.5 py-2 rounded-xl sm:rounded-2xl bg-white text-slate-900 hover:bg-indigo-50 font-black text-xs shadow-sm transition cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <svg className="w-3.5 h-3.5 text-indigo-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    <span>Edit Mass Rosters</span>
                  </button>
                )}
                <div className={`bg-white/10 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl sm:rounded-2xl text-xs font-bold ${bannerTheme.bannerSubtext} border border-white/10 backdrop-blur-xs text-center flex items-center justify-center shrink-0`}>
                  {isAdminMode ? 'Admin Direct Matrix' : isSpecialPub ? 'Special Occasion' : 'Public Schedule'}
                </div>
              </div>
            </div>

            {isAdminMode && adminHighlightServerId && (
              <div className="mb-4 sm:mb-6 px-4 py-3 rounded-2xl bg-amber-50 border border-amber-300 flex items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-2.5 text-xs font-bold text-amber-950">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping shrink-0" />
                  <span>
                    Highlighting <strong>{memberMap.get(adminHighlightServerId)}</strong> across all Masses ({adminCycleMetrics.highlightedServerSlots} assigned slot(s))
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setAdminHighlightServerId('')}
                  className="px-2.5 py-1 rounded-lg bg-white border border-amber-300 text-[11px] font-extrabold text-amber-900 hover:bg-amber-100 transition cursor-pointer shrink-0"
                >
                  Clear Highlight
                </button>
              </div>
            )}

            {isSpecialPub ? (
              renderTable(
                specialPatterns,
                maxRowsSpecial,
                'special',
                'Special Occasion Masses',
                'Dedicated Fiesta, Triduum & Solemnity Events',
                <svg xmlns="http://www.w3.org/2000/svg" className={`w-5 h-5 sm:w-6 sm:h-6 ${bannerTheme.bannerIcon}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                </svg>
              )
            ) : (
              <>
                {renderTable(
                  sundayPatterns, 
                  maxRowsSunday, 
                  'sunday', 
                  'Sunday Masses', 
                  `Recurring Sunday Schedules`, 
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                )}
                {renderTable(
                  weekdayPatterns, 
                  maxRowsWeekday, 
                  'weekday', 
                  publication?.includedDaysOfWeek && publication.includedDaysOfWeek.length === 1
                    ? `${publication.includedDaysOfWeek[0]} Masses`
                    : 'Weekday Masses', 
                  publication?.includedDaysOfWeek && publication.includedDaysOfWeek.length > 0
                    ? `Recurring every ${publication.includedDaysOfWeek.join(', ')}`
                    : `Recurring Weekday Schedules`, 
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
              </>
            )}

            <div className="lg:hidden text-center text-[11px] font-bold text-slate-400 py-6">
              © {new Date().getFullYear()} Ministry of Altar Servers
            </div>
          </>
        )}
      </div>

      {/* ADMIN MASS ROSTER EDITOR MODAL */}
      {canAdminSchedule && publication && (
        <AdminMassAssignmentPanel
          isOpen={adminModalOpen}
          onClose={() => setAdminModalOpen(false)}
          publication={publication}
          publicationSchedules={publicationSchedules}
          members={members}
          initialPatternId={adminTargetPatternId}
          initialSlotIndex={adminTargetSlotIndex}
          effectiveDate={adminEffectiveDate}
          onEffectiveDateChange={setAdminEffectiveDate}
          onSuccess={() => loadData(true)}
        />
      )}

      {/* ADMIN SUBMISSIONS MONITOR MODAL */}
      {canAdminSchedule && publication && (
        <ManageSubmissionsModal
          isOpen={manageSubmissionsOpen}
          onClose={() => setManageSubmissionsOpen(false)}
          publication={publication}
          onSuccess={() => loadData(true)}
        />
      )}

      {/* MOBILE FLOATING BOTTOM ACTION BAR (< lg) */}
      {!isClosed && schedulingMode === 'member' && (
        <div
          className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-2xl p-3 sm:p-4 animate-in slide-in-from-bottom duration-200"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}
        >
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
                className={`w-full py-3 px-4 ${bannerTheme.buttonClass} text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-md active:scale-98 transition-all`}
              >
                <span>Tap to Select Your Name First</span>
              </button>
            ) : isMemberFullyCompleted ? (
              <div className="w-full text-center py-2.5 px-3 text-xs font-bold text-emerald-800 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-center gap-1.5">
                <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span>Schedule Completed (Max Quota Reached)</span>
              </div>
            ) : isSuspended && !isSpecialPub ? (
              <div className="w-full text-center py-2 text-xs font-extrabold text-rose-800 bg-rose-50 rounded-xl border border-rose-200">
                Account Suspended (Cannot Submit)
              </div>
            ) : (
              <>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] uppercase font-extrabold text-slate-400 truncate">
                    {selectedMemberName}
                  </div>
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>
                      {isSpecialPub
                        ? `${selectedSpecialCount}/${publication?.maxSpecialPerServer ?? 2} Special Slots`
                        : `${selectedSundayCount} Sun, ${selectedWeekdayCount} Wkday`}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleOpenConfirmModal}
                  disabled={submitting || newlySelectedScheduleIds.length === 0}
                  className={`py-3 px-5 ${bannerTheme.buttonClass} active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-black text-xs shadow-md transition-all shrink-0 flex items-center gap-1.5 cursor-pointer`}
                >
                  <span>{submitting ? 'Submitting...' : hasSavedSlots ? 'Submit New' : 'Submit'}</span>
                  <span>▹</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* MOBILE FLOATING ADMIN ACTION BAR (< lg) */}
      {canAdminSchedule && schedulingMode === 'admin' && (
        <div
          className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-2xl p-2.5 sm:p-3 animate-in slide-in-from-bottom duration-200"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.5rem)' }}
        >
          <div className="max-w-md mx-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => openAdminRosterModal()}
              className="flex-1 py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-black text-xs rounded-xl shadow-md shadow-indigo-600/20 flex items-center justify-center gap-1.5 cursor-pointer transition"
            >
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <span>Roster Editor</span>
            </button>

            <button
              type="button"
              onClick={() => setManageSubmissionsOpen(true)}
              className="flex-1 py-2.5 px-3 bg-white border border-slate-200 hover:bg-slate-50 active:scale-95 text-slate-800 font-extrabold text-xs rounded-xl shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer transition"
            >
              <span>Submissions</span>
              {adminCycleMetrics.pendingSubmissionsCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black">
                  {adminCycleMetrics.pendingSubmissionsCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(window.location.href)
                toast.success('Link Copied', 'Public schedule link copied to clipboard!')
              }}
              className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl border border-slate-200 cursor-pointer transition"
              title="Copy Public Link"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Save Confirmation Modal Popup */}
      <ConfirmModal
        isOpen={confirmSubmitOpen}
        onClose={() => setConfirmSubmitOpen(false)}
        onConfirm={handleConfirmedSave}
        variant="info"
        title="Confirm Schedule Submission"
        message={confirmModalMessage}
        confirmLabel={submitting ? 'Submitting...' : 'Submit Preferences'}
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

