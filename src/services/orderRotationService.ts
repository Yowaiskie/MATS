import type { Schedule } from '@/types/schedule'
import type { Member } from '@/types/member'
import { getFullName } from '@/utils/member'
import { getMemberOrders } from '@/types/member'
import type { OrderRotationSettings, RotationAssignmentPlanItem } from '@/types/orderRotation'
import { DEFAULT_ORDER_ROTATION_SETTINGS } from '@/types/orderRotation'
import { scheduleService } from './scheduleService'

export const orderRotationService = {
  /**
   * Normalizes order names for robust matching (e.g. "San Pedro", "Order of San Pedro", "Santiago").
   */
  normalizeOrderName(orderStr?: string): string {
    if (!orderStr) return ''
    const s = orderStr.trim().toLowerCase()
    if (s.includes('pedro')) return 'Order of San Pedro'
    if (s.includes('juan')) return 'Order of San Juan'
    if (s.includes('tiago') || s.includes('santiago')) return 'Order of San Tiago'
    if (s.includes('andres')) return 'Order of San Andres'
    if (s.includes('officer')) return 'Officers'
    if (s.includes('squire')) return 'Squires'
    return orderStr.trim()
  },

  /**
   * Categorizes a schedule into an independent rotation track (e.g. 'Holy Hour', 'Binyag / Baptism', or title-based).
   */
  getServiceTrack(schedule: { title: string; category?: string }): string {
    const titleLower = (schedule.title || '').toLowerCase()
    if (schedule.category === 'holy_hour' || titleLower.includes('holy hour') || titleLower.includes('holyhour')) {
      return 'Holy Hour'
    }
    if (schedule.category === 'binyag' || titleLower.includes('binyag') || titleLower.includes('baptism')) {
      return 'Binyag / Baptism'
    }
    return schedule.title?.trim() || 'General'
  },

  /**
   * Checks if a schedule matches the targeted rotation services (Holy Hour, Binyag, etc.)
   */
  matchesRotationTarget(
    schedule: { title: string; category?: string },
    settings: OrderRotationSettings = DEFAULT_ORDER_ROTATION_SETTINGS
  ): boolean {
    if (!settings.enabled) return false

    // 1. Check category key
    if (schedule.category && settings.targetCategories.includes(schedule.category)) {
      return true
    }

    // 2. Check title keywords
    const titleLower = (schedule.title || '').toLowerCase()
    return settings.targetKeywords.some(kw => titleLower.includes(kw.toLowerCase().trim()))
  },

  /**
   * Filters and returns active members belonging to a specified Order Group.
   */
  getMembersForOrder(
    orderGroup: string,
    allMembers: Member[],
    includeSuspended = false
  ): Member[] {
    const targetNorm = this.normalizeOrderName(orderGroup)

    return allMembers.filter(m => {
      // Check status
      if (m.status !== 'active') {
        if (!includeSuspended || m.status !== 'suspended') return false
      }

      if (!m.order) return false
      const memberOrders = getMemberOrders(m.order).map(o => this.normalizeOrderName(o))
      return memberOrders.includes(targetNorm)
    })
  },

  /**
   * Computes a deterministic chronological rotation plan across target schedules.
   * By default, rotates each service track (Holy Hour vs Binyag) independently so that
   * 1st Friday Holy Hour -> San Pedro, 2nd Friday -> San Juan, AND
   * 1st Sunday Binyag -> San Pedro, 2nd Sunday -> San Juan.
   */
  computeRotationPlan(
    schedules: Schedule[],
    allMembers: Member[],
    settings: OrderRotationSettings = DEFAULT_ORDER_ROTATION_SETTINGS,
    startingGroup?: string,
    separateServiceTracks = true
  ): RotationAssignmentPlanItem[] {
    const sequence = settings.rotationSequence && settings.rotationSequence.length > 0
      ? settings.rotationSequence
      : DEFAULT_ORDER_ROTATION_SETTINGS.rotationSequence

    // 1. Filter matching schedules that are not cancelled
    const matching = schedules.filter(s => 
      s.status !== 'cancelled' && 
      this.matchesRotationTarget(s, settings)
    )

    // 2. Resolve starting index in rotation sequence
    let startIndex = 0
    if (startingGroup) {
      const normStart = this.normalizeOrderName(startingGroup)
      const foundIdx = sequence.findIndex(g => this.normalizeOrderName(g) === normStart)
      if (foundIdx !== -1) {
        startIndex = foundIdx
      }
    }

    if (!separateServiceTracks) {
      // Combined single stream
      matching.sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date)
        if (dateCompare !== 0) return dateCompare
        return a.startTime.localeCompare(b.startTime)
      })

      return matching.map((sch, idx) => {
        const groupIdx = (startIndex + idx) % sequence.length
        const assignedGroup = sequence[groupIdx]
        const groupMembers = this.getMembersForOrder(assignedGroup, allMembers, settings.includeSuspended)

        return {
          scheduleId: sch.id,
          scheduleTitle: sch.title,
          date: sch.date,
          startTime: sch.startTime,
          endTime: sch.endTime,
          assignedOrderGroup: assignedGroup,
          assignedMemberIds: groupMembers.map(m => m.id),
          assignedMemberNames: groupMembers.map(m => getFullName(m)),
          existingAssignedCount: (sch.assignedMembers || []).length,
          isAlreadyAssigned: (sch.assignedMembers || []).length > 0
        }
      })
    }

    // 3. Group by independent service track (Holy Hour vs Binyag)
    const trackGroups: Record<string, Schedule[]> = {}
    matching.forEach(sch => {
      const trackKey = this.getServiceTrack(sch)
      if (!trackGroups[trackKey]) {
        trackGroups[trackKey] = []
      }
      trackGroups[trackKey].push(sch)
    })

    const allPlanItems: RotationAssignmentPlanItem[] = []

    // Process each track independently
    Object.entries(trackGroups).forEach(([, trackSchedules]) => {
      // Sort chronologically within the track
      trackSchedules.sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date)
        if (dateCompare !== 0) return dateCompare
        return a.startTime.localeCompare(b.startTime)
      })

      trackSchedules.forEach((sch, trackIdx) => {
        const groupIdx = (startIndex + trackIdx) % sequence.length
        const assignedGroup = sequence[groupIdx]
        const groupMembers = this.getMembersForOrder(assignedGroup, allMembers, settings.includeSuspended)

        allPlanItems.push({
          scheduleId: sch.id,
          scheduleTitle: sch.title,
          date: sch.date,
          startTime: sch.startTime,
          endTime: sch.endTime,
          assignedOrderGroup: assignedGroup,
          assignedMemberIds: groupMembers.map(m => m.id),
          assignedMemberNames: groupMembers.map(m => getFullName(m)),
          existingAssignedCount: (sch.assignedMembers || []).length,
          isAlreadyAssigned: (sch.assignedMembers || []).length > 0
        })
      })
    })

    // Sort final result chronologically
    allPlanItems.sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date)
      if (dateCompare !== 0) return dateCompare
      return a.startTime.localeCompare(b.startTime)
    })

    return allPlanItems
  },

  /**
   * Applies the rotation assignment plan to Firestore schedules.
   */
  async applyRotationPlan(
    plan: RotationAssignmentPlanItem[],
    overwriteExisting = false,
    actor = 'Admin'
  ): Promise<{ updatedCount: number; skippedCount: number }> {
    let updatedCount = 0
    let skippedCount = 0

    for (const item of plan) {
      if (!overwriteExisting && item.isAlreadyAssigned) {
        skippedCount++
        continue
      }

      await scheduleService.assignMembers(item.scheduleId, item.assignedMemberIds, actor)
      updatedCount++
    }

    return { updatedCount, skippedCount }
  }
}
