import type { Schedule } from '@/types/schedule'
import type { AttendanceRecord } from '@/types/attendance'
import type { Member } from '@/types/member'
import type { 
  ScheduleCategoryKey, 
  CategoryRule, 
  MemberQualificationResult, 
  MemberCategoryStat
} from '@/types/attendanceCategory'
import { SCHEDULE_CATEGORIES } from '@/types/attendanceCategory'
import { isSundayOrAnticipatedMass, isHolyHourSchedule, isSpecialEventOrService } from '@/utils/scheduleUtils'

export class QualificationService {
  /**
   * Intelligently detects or derives the category of a schedule.
   * Prioritizes explicit `schedule.category` if present, otherwise uses pattern matching.
   */
  classifySchedule(schedule: Pick<Schedule, 'title' | 'date' | 'startTime' | 'category'>): ScheduleCategoryKey {
    if (schedule.category) {
      return schedule.category
    }

    const title = (schedule.title || '').toLowerCase().trim()

    // 1. Check for Combined Meeting & Formation
    if (
      (title.includes('meeting') || title.includes('pulong') || title.includes('assembly')) &&
      (title.includes('formation') || title.includes('ogf') || title.includes('seminar') || title.includes('recollection'))
    ) {
      return 'meeting_and_formation'
    }

    // 2. Check for Formation / OGF
    if (
      title.includes('formation') ||
      title.includes('ogf') ||
      title.includes('seminar') ||
      title.includes('recollection') ||
      title.includes('orientation') ||
      title.includes('workshop') ||
      title.includes('training')
    ) {
      return 'formation'
    }

    // 3. Check for Meeting
    if (
      title.includes('meeting') ||
      title.includes('pulong') ||
      title.includes('assembly') ||
      title.includes('officers') ||
      title.includes('council')
    ) {
      return 'meeting'
    }

    // 4. Check for Holy Hour
    if (isHolyHourSchedule(schedule.title)) {
      return 'holy_hour'
    }

    // 5. Check for Practice / Rehearsal
    if (
      title.includes('practice') ||
      title.includes('rehearsal') ||
      title.includes('dry run') ||
      title.includes('ensayo')
    ) {
      return 'practice'
    }

    // 6. Check for Special Events / Fiesta / Solemnities
    if (isSpecialEventOrService(schedule)) {
      return 'special_event'
    }

    // 7. Check for Sunday Mass vs Weekday Mass
    if (isSundayOrAnticipatedMass(schedule.title, schedule.date, schedule.startTime)) {
      return 'mass_sunday'
    }

    return 'mass_weekday'
  }

  /**
   * Checks whether a schedule matches a specific target category.
   * Handles combined 'meeting_and_formation' which matches BOTH 'meeting' and 'formation'.
   */
  scheduleMatchesCategory(schedule: Schedule, targetCategory: ScheduleCategoryKey | 'all'): boolean {
    if (targetCategory === 'all') return true
    const cat = this.classifySchedule(schedule)
    if (cat === targetCategory) return true

    // Combined meeting & formation matches both
    if (cat === 'meeting_and_formation') {
      return targetCategory === 'formation' || targetCategory === 'meeting'
    }

    return false
  }

  /**
   * Evaluates all members against a list of active category rules within the provided date range.
   */
  evaluateMembers(
    members: Member[],
    schedules: Schedule[],
    attendanceRecords: AttendanceRecord[],
    rules: CategoryRule[],
    orderFilter?: string
  ): MemberQualificationResult[] {
    // 1. Filter out cancelled schedules
    const validSchedules = schedules.filter(s => s.status !== 'cancelled')

    // 2. Group attendance by memberId -> scheduleId -> record
    const attendanceByMember = new Map<string, Map<string, AttendanceRecord>>()
    attendanceRecords.forEach(rec => {
      if (!attendanceByMember.has(rec.memberId)) {
        attendanceByMember.set(rec.memberId, new Map())
      }
      attendanceByMember.get(rec.memberId)!.set(rec.scheduleId, rec)
    })

    // Filter members by order if specified
    const targetMembers = orderFilter && orderFilter !== 'all'
      ? members.filter(m => (m.order || '').toLowerCase() === orderFilter.toLowerCase())
      : members

    return targetMembers.map(member => {
      const memberAttMap = attendanceByMember.get(member.id) || new Map<string, AttendanceRecord>()

      // Compute stats for every standard category + 'all'
      const categoryStats: Record<string, MemberCategoryStat> = {}
      
      const allCategoriesToEvaluate: Array<ScheduleCategoryKey | 'all'> = [
        'all',
        ...SCHEDULE_CATEGORIES.map(c => c.key)
      ]

      let totalOverallHeld = validSchedules.length
      let totalOverallAttended = 0

      allCategoriesToEvaluate.forEach(catKey => {
        const matchingSchedules = validSchedules.filter(s => this.scheduleMatchesCategory(s, catKey))
        let present = 0
        let late = 0
        let absent = 0
        let excused = 0
        let assignedCount = 0

        matchingSchedules.forEach(sched => {
          const isAssigned = (sched.assignedMembers || []).includes(member.id)
          if (isAssigned) assignedCount++

          const record = memberAttMap.get(sched.id)
          if (record) {
            if (record.status === 'present') present++
            else if (record.status === 'late') late++
            else if (record.status === 'absent') absent++
            else if (record.status === 'excused') excused++
            else if (record.status === 'observer' || record.status === 'formation') present++
          } else if (isAssigned) {
            // Assigned but no record in completed schedule -> count as absent
            absent++
          }
        })

        const attended = present + late
        if (catKey === 'all') {
          totalOverallAttended = attended
        }

        const totalEvaluated = attended + absent + excused
        // Calculate attendance rate (percentage)
        const rate = totalEvaluated > 0
          ? Math.round(((present + late * 0.75) / totalEvaluated) * 1000) / 10
          : matchingSchedules.length === 0 ? 100 : 0

        // Find applicable rule for this category
        const rule = rules.find(r => r.category === catKey)
        let meetsRule = true
        let ruleFeedback: string | undefined = undefined

        if (rule) {
          if (rule.minRate !== undefined && rule.minRate > 0) {
            if (rate < rule.minRate) {
              meetsRule = false
              ruleFeedback = `${rate.toFixed(1)}% (Min ${rule.minRate}%)`
            }
          }
          if (rule.minAttended !== undefined && rule.minAttended > 0) {
            if (attended < rule.minAttended) {
              meetsRule = false
              ruleFeedback = `${attended}/${rule.minAttended} sessions`
            }
          }
        }

        const meta = SCHEDULE_CATEGORIES.find(c => c.key === catKey)
        const label = catKey === 'all' ? 'Overall Attendance' : (meta?.shortLabel || catKey)

        categoryStats[catKey] = {
          category: catKey,
          categoryLabel: label,
          totalHeld: matchingSchedules.length,
          totalAssigned: assignedCount,
          present,
          late,
          absent,
          excused,
          rate,
          targetRate: rule?.minRate,
          meetsRule,
          ruleFeedback
        }
      })

      // Evaluate overall qualification status
      const activeRules = rules.filter(r => r.required)
      const deficiencies: string[] = []
      let passedCount = 0

      activeRules.forEach(rule => {
        const stat = categoryStats[rule.category]
        if (stat) {
          if (stat.meetsRule) {
            passedCount++
          } else {
            const catName = stat.categoryLabel
            const reason = stat.ruleFeedback || `Below required threshold`
            deficiencies.push(`${catName}: ${reason}`)
          }
        }
      })

      const isQualified = activeRules.length === 0 || passedCount === activeRules.length
      const overallRate = categoryStats['all']?.rate || 0

      return {
        member,
        categoryStats,
        overallRate,
        totalAttended: totalOverallAttended,
        totalHeld: totalOverallHeld,
        isQualified,
        passedRulesCount: passedCount,
        totalRulesCount: activeRules.length,
        deficiencies
      }
    })
  }
}

export const qualificationService = new QualificationService()
