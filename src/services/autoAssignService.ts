import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/firebase/config'
import type { Schedule } from '@/types/schedule'
import type { Member } from '@/types/member'
import type { SchedulePublication } from '@/types/publication'
import { memberService } from '@/services/memberService'
import { scheduleService } from '@/services/scheduleService'
import { publicationService } from '@/services/publicationService'
import { auditService } from '@/services/auditService'
import { isSundayOrAnticipatedMass, isTimeOverlapping } from '@/utils/scheduleUtils'
import { getFullName } from '@/utils/member'

export interface MemberAssignmentSummary {
  memberId: string
  memberName: string
  sundaysAssigned: number
  weekdaysAssigned: number
  assignedScheduleIds: string[]
  assignedScheduleTitles: string[]
}

export interface AutoAssignResult {
  assignedMembersCount: number
  totalSlotsFilled: number
  unfilledSchedulesCount: number
  memberSummaries: MemberAssignmentSummary[]
}

export interface AutoAssignOptions {
  publication: SchedulePublication
  targetMemberIds?: string[]
  mode?: 'both' | 'sundays_only' | 'weekdays_only'
  performedBy?: string
}

export const autoAssignService = {
  /**
   * Automatically and randomly assigns unsubmitted active members to unfilled schedule slots
   * in the given publication period, strictly respecting Sunday/Weekday quotas, slot limits,
   * and time overlap constraints.
   */
  async autoAssignUnsubmittedMembers(options: AutoAssignOptions): Promise<AutoAssignResult> {
    const { publication, targetMemberIds, mode = 'both', performedBy = 'Coordinator' } = options

    // 1. Fetch active, non-squire members
    const allMembers = await memberService.getMembers()
    const activeEligibleMembers = allMembers.filter(m => {
      if (m.status !== 'active') return false
      const r = (m.rank || '').toLowerCase()
      const o = (m.order || '').toLowerCase()
      const p = (m.position || '').toLowerCase()
      return !(r.includes('squire') || o.includes('squire') || p.includes('squire'))
    })

    // 2. Fetch all schedules in the publication's date range
    const schedules = await scheduleService.getSchedulesByDateRange(
      publication.startDate,
      publication.endDate
    )
    const activeSchedules = schedules.filter(s => s.status !== 'cancelled' && !s.isLocked)

    // 3. Determine candidates to assign
    const submittedSet = new Set(publication.submittedMembers || [])
    
    // Candidates are unsubmitted members (or explicitly targeted member IDs)
    const candidateMembers = activeEligibleMembers.filter(m => {
      if (targetMemberIds && targetMemberIds.length > 0) {
        return targetMemberIds.includes(m.id)
      }
      return !submittedSet.has(m.id)
    })

    if (candidateMembers.length === 0 || activeSchedules.length === 0) {
      return {
        assignedMembersCount: 0,
        totalSlotsFilled: 0,
        unfilledSchedulesCount: activeSchedules.filter(s => {
          const isSunday = isSundayOrAnticipatedMass(s.title, s.date, s.startTime)
          const cap = isSunday
            ? (publication.maxServersPerSundaySlot ?? 5)
            : (publication.maxServersPerWeekdaySlot ?? 5)
          return (s.assignedMembers?.length || 0) < cap
        }).length,
        memberSummaries: []
      }
    }

    // Config Limits
    const maxSundaysPerServer = publication.maxSundaysPerServer ?? 4
    const maxWeekdaysPerServer = publication.maxWeekdaysPerServer ?? 8
    const maxServersSunday = publication.maxServersPerSundaySlot ?? 5
    const maxServersWeekday = publication.maxServersPerWeekdaySlot ?? 5

    // In-memory assignment state mapping
    // Map of scheduleId -> array of memberIds
    const scheduleAssignments = new Map<string, string[]>()
    activeSchedules.forEach(s => {
      scheduleAssignments.set(s.id, [...(s.assignedMembers || [])])
    })

    // Track existing member loads in this publication period
    const memberLoads = new Map<string, { sundays: number; weekdays: number; assignedScheduleIds: Set<string> }>()
    
    activeEligibleMembers.forEach(m => {
      let sundays = 0
      let weekdays = 0
      const assignedIds = new Set<string>()

      activeSchedules.forEach(s => {
        if (s.assignedMembers?.includes(m.id)) {
          assignedIds.add(s.id)
          if (isSundayOrAnticipatedMass(s.title, s.date, s.startTime)) {
            sundays++
          } else {
            weekdays++
          }
        }
      })

      memberLoads.set(m.id, { sundays, weekdays, assignedScheduleIds: assignedIds })
    })

    // Helper: Fisher-Yates Shuffle array
    const shuffle = <T>(array: T[]): T[] => {
      const arr = [...array]
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[arr[i], arr[j]] = [arr[j], arr[i]]
      }
      return arr
    }

    // Shuffled candidate members to randomize distribution
    const shuffledCandidates = shuffle(candidateMembers)

    // Categorize and sort schedules by date & time, then distribute
    const sundaySchedules = activeSchedules.filter(s => isSundayOrAnticipatedMass(s.title, s.date, s.startTime))
    const weekdaySchedules = activeSchedules.filter(s => !isSundayOrAnticipatedMass(s.title, s.date, s.startTime))

    // Helper function to try assigning a member to a schedule
    const tryAssign = (member: Member, schedule: Schedule, isSunday: boolean): boolean => {
      const load = memberLoads.get(member.id)!
      const maxSlots = isSunday ? maxServersSunday : maxServersWeekday
      const currentAssigned = scheduleAssignments.get(schedule.id) || []

      // 1. Capacity check
      if (currentAssigned.length >= maxSlots) return false
      // 2. Already in this schedule
      if (currentAssigned.includes(member.id)) return false
      // 3. Member quota limit
      if (isSunday && load.sundays >= maxSundaysPerServer) return false
      if (!isSunday && load.weekdays >= maxWeekdaysPerServer) return false

      // 4. Same-day overlap check
      const sameDaySchedules = activeSchedules.filter(other => 
        other.date === schedule.date && 
        other.id !== schedule.id && 
        scheduleAssignments.get(other.id)?.includes(member.id)
      )

      for (const other of sameDaySchedules) {
        if (isTimeOverlapping(schedule.startTime, schedule.endTime, other.startTime, other.endTime)) {
          return false
        }
      }

      // Assign!
      currentAssigned.push(member.id)
      scheduleAssignments.set(schedule.id, currentAssigned)
      load.assignedScheduleIds.add(schedule.id)
      if (isSunday) load.sundays++
      else load.weekdays++

      return true
    }

    // Pass 1: Assign to Sundays (if mode is 'both' or 'sundays_only')
    if (mode !== 'weekdays_only') {
      for (let round = 0; round < maxSundaysPerServer; round++) {
        const roundSundays = shuffle(sundaySchedules)
        for (const member of shuffledCandidates) {
          const load = memberLoads.get(member.id)!
          if (load.sundays >= maxSundaysPerServer) continue

          for (const schedule of roundSundays) {
            if (tryAssign(member, schedule, true)) {
              break
            }
          }
        }
      }
    }

    // Pass 2: Assign to Weekdays (if mode is 'both' or 'weekdays_only')
    if (mode !== 'sundays_only') {
      for (let round = 0; round < maxWeekdaysPerServer; round++) {
        const roundWeekdays = shuffle(weekdaySchedules)
        for (const member of shuffledCandidates) {
          const load = memberLoads.get(member.id)!
          if (load.weekdays >= maxWeekdaysPerServer) continue

          for (const schedule of roundWeekdays) {
            if (tryAssign(member, schedule, false)) {
              break
            }
          }
        }
      }
    }

    // 4. Persist updated schedules in Firestore
    const changedSchedules: { id: string; assignedMembers: string[] }[] = []
    let totalSlotsFilled = 0

    for (const schedule of activeSchedules) {
      const updatedList = scheduleAssignments.get(schedule.id) || []
      const originalList = schedule.assignedMembers || []

      const hasChanged = updatedList.length !== originalList.length || 
        updatedList.some((id, idx) => id !== originalList[idx])

      if (hasChanged) {
        changedSchedules.push({ id: schedule.id, assignedMembers: updatedList })
      }
    }

    // Update schedules concurrently in Firestore
    await Promise.all(
      changedSchedules.map(cs => {
        const schedRef = doc(db, 'schedules', cs.id)
        return updateDoc(schedRef, {
          assignedMembers: cs.assignedMembers,
          updatedAt: serverTimestamp()
        })
      })
    )

    // 5. Mark candidates as submitted in publication
    const newlyAssignedMemberIds = shuffledCandidates
      .filter(m => {
        const load = memberLoads.get(m.id)!
        return load.assignedScheduleIds.size > 0
      })
      .map(m => m.id)

    if (newlyAssignedMemberIds.length > 0) {
      await publicationService.markMembersSubmitted(publication.id, newlyAssignedMemberIds)
    }

    // 6. Build summary report
    const scheduleMap = new Map(activeSchedules.map(s => [s.id, s]))
    const memberSummaries: MemberAssignmentSummary[] = shuffledCandidates.map(member => {
      const load = memberLoads.get(member.id)!
      const assignedIds = Array.from(load.assignedScheduleIds)
      const titles = assignedIds.map(id => {
        const s = scheduleMap.get(id)
        return s ? `${s.date} ${s.title} (${s.startTime})` : id
      })

      totalSlotsFilled += assignedIds.length

      return {
        memberId: member.id,
        memberName: getFullName(member),
        sundaysAssigned: load.sundays,
        weekdaysAssigned: load.weekdays,
        assignedScheduleIds: assignedIds,
        assignedScheduleTitles: titles
      }
    })

    // Log audit trail
    await auditService.logAction(
      'SCHEDULE_ASSIGN',
      'schedule',
      `Auto-assigned ${newlyAssignedMemberIds.length} unsubmitted members across ${changedSchedules.length} schedules in publication '${publication.name}'`,
      performedBy,
      {
        publicationId: publication.id,
        newlyAssignedCount: newlyAssignedMemberIds.length,
        changedSchedulesCount: changedSchedules.length
      }
    )

    const unfilledSchedulesCount = activeSchedules.filter(s => {
      const currentList = scheduleAssignments.get(s.id) || []
      const isSunday = isSundayOrAnticipatedMass(s.title, s.date, s.startTime)
      const cap = isSunday ? maxServersSunday : maxServersWeekday
      return currentList.length < cap
    }).length

    return {
      assignedMembersCount: newlyAssignedMemberIds.length,
      totalSlotsFilled,
      unfilledSchedulesCount,
      memberSummaries
    }
  }
}
