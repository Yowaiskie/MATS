import type { Member } from '@/types/member'
import type { Schedule } from '@/types/schedule'
import type { AttendanceRecord } from '@/types/attendance'
import type { SuspensionPolicySettings } from '@/services/settingsService'
import { qualificationService } from '@/services/qualificationService'
import { memberService } from '@/services/memberService'
import { auditService } from '@/services/auditService'

export interface UnsuspensionClearanceStatus {
  isSuspended: boolean
  isEligibleForUnsuspension: boolean
  meetingMonthsAttended: number
  meetingMonthsRequired: number
  meetingsAttended: number
  meetingsRequired: number
  formationsAttended: number
  formationsRequired: number
  summaryReason: string
}

export class SuspensionLifecycleService {
  /**
   * Evaluates if a suspended member has met the dynamic clearance criteria (e.g. attended monthly meetings across X months).
   */
  checkClearance(
    member: Member,
    isSuspended: boolean,
    schedules: Schedule[],
    attendanceRecords: AttendanceRecord[],
    policy: SuspensionPolicySettings
  ): UnsuspensionClearanceStatus {
    if (!isSuspended) {
      return {
        isSuspended: false,
        isEligibleForUnsuspension: false,
        meetingMonthsAttended: 0,
        meetingMonthsRequired: 0,
        meetingsAttended: 0,
        meetingsRequired: 0,
        formationsAttended: 0,
        formationsRequired: 0,
        summaryReason: 'Member is currently in good standing.'
      }
    }

    const memberRecords = attendanceRecords.filter(
      r => r.memberId === member.id && (r.status === 'present' || r.status === 'late')
    )
    const scheduleMap = new Map<string, Schedule>(schedules.map(s => [s.id, s]))

    const meetingMonthsSet = new Set<string>()
    let meetingsAttended = 0
    let formationsAttended = 0

    memberRecords.forEach(rec => {
      const sched = scheduleMap.get(rec.scheduleId)
      if (sched) {
        if (qualificationService.scheduleMatchesCategory(sched, 'meeting')) {
          meetingsAttended++
          const monthKey = (sched.date || '').slice(0, 7) // "YYYY-MM"
          if (monthKey) {
            meetingMonthsSet.add(monthKey)
          }
        }
        if (qualificationService.scheduleMatchesCategory(sched, 'formation')) {
          formationsAttended++
        }
      }
    })

    const meetingMonthsAttended = meetingMonthsSet.size
    const meetingMonthsRequired = policy.unsuspensionRequiresMeeting
      ? (policy.unsuspensionRequiredMeetingMonths ?? policy.unsuspensionRequiredMeetingCount ?? 1)
      : 0
    const formationsRequired = policy.unsuspensionRequiresFormation
      ? (policy.unsuspensionRequiredFormationCount || 1)
      : 0

    const meetingRequirementPassed = !policy.unsuspensionRequiresMeeting || meetingMonthsAttended >= meetingMonthsRequired
    const formationRequirementPassed = !policy.unsuspensionRequiresFormation || formationsAttended >= formationsRequired

    const isEligible = meetingRequirementPassed && formationRequirementPassed && (meetingMonthsRequired > 0 || formationsRequired > 0)

    let summaryReason = ''
    if (isEligible) {
      summaryReason = 'Clearance requirements met. Eligible for immediate unsuspension.'
    } else {
      const pending: string[] = []
      if (policy.unsuspensionRequiresMeeting && meetingMonthsAttended < meetingMonthsRequired) {
        const remaining = meetingMonthsRequired - meetingMonthsAttended
        pending.push(`Attend Monthly Meetings in ${remaining} more month(s)`)
      }
      if (policy.unsuspensionRequiresFormation && formationsAttended < formationsRequired) {
        pending.push(`Attend ${formationsRequired - formationsAttended} more Formation(s)`)
      }
      summaryReason = pending.length > 0 ? `Needs: ${pending.join(', ')}` : 'Suspension in effect.'
    }

    return {
      isSuspended: true,
      isEligibleForUnsuspension: isEligible,
      meetingMonthsAttended,
      meetingMonthsRequired,
      meetingsAttended,
      meetingsRequired: meetingMonthsRequired,
      formationsAttended,
      formationsRequired,
      summaryReason
    }
  }

  /**
   * Lifts a suspension for a member, updating their status and logging an audit event.
   */
  async liftSuspension(member: Member, adminEmail = 'Admin', remarks?: string): Promise<void> {
    await memberService.updateMember(member.id, {
      status: 'active'
    })

    await auditService.logAction(
      'MEMBER_UPDATE',
      'member',
      `Lifted suspension for ${member.firstName} ${member.lastName}. Status restored to Active. ${remarks ? `(${remarks})` : ''}`,
      adminEmail,
      { memberId: member.id, previousStatus: member.status, newStatus: 'active', remarks }
    )
  }
}

export const suspensionLifecycleService = new SuspensionLifecycleService()
