import type { Member } from '@/types/member'
import type { EventRequirement, EventRequirementCheck, RequirementMemberRow } from '@/types/eventRequirement'
import { getFullName } from '@/utils/member'

export function buildRequirementRows(members: Member[], ranks: string[], requirements: EventRequirement[], checks: EventRequirementCheck[]): RequirementMemberRow[] {
  const completedChecks = new Set(checks.filter(c => c.completed).map(c => `${c.requirementId}_${c.memberId}`))
  return members.filter(m => m.status !== 'archived' && ranks.includes(m.rank)).map(member => {
    const cells: RequirementMemberRow['cells'] = {}
    let completed = 0
    let required = 0
    for (const requirement of requirements) {
      const applicable = !requirement.targetRanks.length || requirement.targetRanks.some(rank => rank === member.rank)
      if (!applicable) {
        cells[requirement.id] = 'N/A'
        continue
      }
      required++
      const done = completedChecks.has(`${requirement.id}_${member.id}`)
      if (done) completed++
      cells[requirement.id] = done ? 'Done' : 'Pending'
    }
    return {
      memberId: member.id, name: getFullName(member), rank: member.rank, cells, completed, required,
      status: !required ? 'N/A' : completed === required ? 'Complete' : 'Incomplete'
    }
  })
}
