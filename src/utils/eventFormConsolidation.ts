import type { EventFormQuestion, EventFormResponse } from '../types/eventForm.ts'
import type { Member } from '../types/member.ts'
import type { MemberReportRow } from '../services/reportService.ts'

export interface MemberReportTableData {
  tableHead: string[][]
  tableBody: string[][]
}

export interface BuildMemberReportTableDataOptions {
  reportType?: 'standard' | 'pastoral_evaluation'
  evaluationsMap?: Record<string, string>
}

export function buildMemberReportTableData(
  rows: MemberReportRow[],
  opts: BuildMemberReportTableDataOptions = {}
): MemberReportTableData {
  const isPastoral = opts.reportType === 'pastoral_evaluation'
  const tableHead = isPastoral
    ? [
        [
          '#',
          'MEMBER NAME',
          'RANK',
          'PRESENT',
          'LATE',
          'ABSENT',
          'RATE',
          'EVALUATION & PASTORAL REMARKS',
        ],
      ]
    : [
        [
          '#',
          'MEMBER NAME',
          'RANK',
          'PRESENT',
          'LATE',
          'ABSENT',
          'EXCUSED',
          'ATTENDANCE %',
          'STATUS',
          'TRIGGERING ABSENCES',
        ],
      ]

  const tableBody = rows.map((r, index) => {
    if (isPastoral) {
      const evalText =
        opts.evaluationsMap?.[r.memberId] ||
        opts.evaluationsMap?.[r.name] ||
        (r as any).evaluation ||
        'Faithfully serving as an altar server in the ministry.'
      const isInactive = r.rate <= 10
      const rateDisplay = isInactive ? `${r.rate.toFixed(1)}%\n(Inactive)` : `${r.rate.toFixed(1)}%`

      return [
        String(index + 1),
        r.name.toUpperCase(),
        (r.rank || '—').toUpperCase(),
        String(r.present),
        String(r.late),
        String(r.absent),
        rateDisplay,
        evalText,
      ]
    }

    let triggering = '—'
    if (r.warningStatus === 'suspended' || r.warningStatus === 'warning') {
      const parts = []
      if (r.sundayAbsences > 0) parts.push(`${r.sundayAbsences} Sun`)
      if (r.weekdayAbsences > 0) parts.push(`${r.weekdayAbsences} Wkday`)
      if (r.meetingAbsences > 0) parts.push(`${r.meetingAbsences} Mtg`)
      triggering = parts.join(', ') || `${r.absent} Absences`
    }

    return [
      String(index + 1),
      r.name.toUpperCase(),
      (r.rank || '—').toUpperCase(),
      String(r.present),
      String(r.late),
      String(r.absent),
      String(r.excused),
      `${r.rate.toFixed(1)}%`,
      r.warningStatus.toUpperCase(),
      triggering,
    ]
  })

  return { tableHead, tableBody }
}

export interface OfficerRatingItem {
  questionId: string
  questionText: string
  score: number
  maxScore: number
}

export interface OfficerSubmissionFeedback {
  responseId: string
  officerName: string
  officerRole?: string
  submittedAt?: string
  ratings: OfficerRatingItem[]
  remarks: string[]
  overallRating: number
}

export interface ConsolidatedMemberEvaluation {
  memberId: string
  memberName: string
  rank?: string
  order?: string
  attendanceRate?: number
  evaluatingOfficers: string[]
  detailedOfficerFeedback: OfficerSubmissionFeedback[]
  averageScore?: number
  distinctRemarks: string[]
  synthesizedNarrative: string
  isCustomized?: boolean
}

/**
 * Deterministic pseudo-random index based on memberId to ensure
 * different members get distinct varied sentence templates.
 */
export function getMemberVariationIndex(seed: string, count: number): number {
  if (count <= 1) return 0
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash) % count
}

// 5+ distinct variations per rating tier (scores 1.0 - 5.0)
const RATING_TIER_TEMPLATES: Record<'tier5' | 'tier4' | 'tier3' | 'tier2' | 'tier1', string[]> = {
  tier5: [
    'Exemplary liturgical service and outstanding commitment at the altar; serves as an inspiring role model to fellow altar servers.',
    'Consistently demonstrates deep reverence, punctuality, and liturgical mastery; trusted with major parish celebrations and solemnities.',
    'Displays exceptional dedication, reverent decorum, and dependable leadership during all assigned Masses and ministry duties.',
    'Shows remarkable maturity and liturgical diligence; always thoroughly prepared and eager to mentor junior servers.',
    'A steadfast pillar in the ministry with flawless decorum, prompt attendance, and commendable spiritual maturity.',
    'Commended for top-tier altar performance, reverent posture, and unwavering readiness to assist our parish clergy.'
  ],
  tier4: [
    'Shows commendable dedication and steady reverence at the altar; consistently dependable in assigned liturgical schedules.',
    'Very dependable altar server who exhibits solid liturgical awareness and enthusiasm in serving regular Sunday Masses.',
    'Performs duties with diligence, respectful posture, and high enthusiasm; encouraged to take on more senior ceremonial roles.',
    'Displays good discipline, active cooperation with ministry officers, and reliable presence across liturgical assignments.',
    'Commended for reliable service, prompt arrival, and positive camaraderie among fellow altar servers.',
    'Shows strong liturgical competence and helpful initiative before and after Masses.'
  ],
  tier3: [
    'Demonstrates satisfactory service and steady altar presence; encouraged to further refine ceremonial precision and punctuality.',
    'Fulfills assigned altar duties adequately; with continued guidance and practice, shows great potential for growth.',
    'Shows good willingness to serve; recommended to focus on consistent schedule attendance and reverent sanctuary movements.',
    'Regular in fulfilling ministry tasks; will benefit from participating in upcoming liturgical workshops and team reviews.',
    'Capable server with satisfactory performance; encouraged to be more proactive during complex liturgical solemnities.'
  ],
  tier2: [
    'Needs closer guidance in sanctuary decorum and regular attendance; recommended for a supportive refresher session with officers.',
    'Requires additional mentoring and consistent follow-up regarding attendance reliability and altar protocols.',
    'Attendance and liturgical attentiveness are inconsistent; will greatly benefit from pairing with an experienced senior server.',
    'Shows potential but currently struggles with consistency; recommended for pastoral encouragement and liturgical check-in.',
    'Needs encouragement to participate more actively and maintain steady punctuality on scheduled ministry obligations.'
  ],
  tier1: [
    'Critical need for pastoral follow-up and evaluation; exhibiting low engagement and prolonged absences from sanctuary duties.',
    'Recommended for an empathetic pastoral conference or parental check-in to ascertain current status and willingness to serve.',
    'Minimal participation recorded; needs direct consultation with the ministry coordinator and spiritual director.',
    'Prolonged inactivity and lack of responsiveness to liturgical schedules; requires formal review before next scheduling cycle.',
    'Shows urgent need for pastoral re-engagement and spiritual discernment regarding continuing membership.'
  ]
}

// 5+ distinct variations per attendance tier (0% - 100%)
const ATTENDANCE_TIER_TEMPLATES: Record<'exemplary' | 'good' | 'moderate' | 'irregular' | 'inactive', string[]> = {
  exemplary: [
    'Outstanding attendance record with near-perfect reliability across regular Masses and parish solemnities.',
    'Exemplary dedication to liturgical schedules; consistently present, punctual, and ready to serve.',
    'Superb commitment to ministry obligations; dependable sanctuary presence at all scheduled liturgies.',
    'Highly commendable attendance consistency; sets an excellent standard of fidelity for fellow altar servers.',
    'Impeccable reliability and promptness in serving assigned Sunday and weekday Masses.'
  ],
  good: [
    'Good and steady attendance record; faithfully fulfills designated Mass assignments.',
    'Reliable sanctuary presence with regular compliance on liturgical appointments.',
    'Commendable attendance standing; demonstrates steady responsibility and fidelity to service.',
    'Consistently attends assigned Masses with very few excused absences; good service record.',
    'Dependable server who reliably honors liturgical assignments throughout the evaluation period.'
  ],
  moderate: [
    'Moderate attendance record; encouraged to maintain closer consistency on scheduled appointments.',
    'Satisfactory attendance standing; recommended to participate more actively in upcoming parish liturgies.',
    'Fulfills essential schedules but occasionally misses assignments; encouraged to improve attendance rate.',
    'Meets baseline attendance expectations; will benefit from regular check-ins to build greater momentum.',
    'Shows adequate presence; recommended for more frequent scheduling to strengthen service routine.'
  ],
  irregular: [
    'Irregular attendance standing; officers are advised to reach out and follow up on missed schedules.',
    'Noticeable drop in schedule attendance; recommended for active encouragement and schedule alignment.',
    'Inconsistent attendance recorded; requires officer coordination to resolve scheduling conflicts.',
    'Needs attention regarding missed schedules and attendance; recommended for friendly follow-up and guidance.',
    'Shows sporadic attendance; encouraged to communicate availability in advance to avoid unexcused absences.'
  ],
  inactive: [
    'Critically low attendance (10% or below); flagged as inactive status and recommended for pastoral review.',
    'Inactive standing due to prolonged absence; recommended for pastoral discernment and roster update.',
    'Minimal to zero attendance recorded (inactive status); advised for pastoral check-in or temporary sabbatical designation.',
    'Severely inactive service record; needs direct pastoral consultation before continuing active roster listing.',
    'Flagged for inactive status; recommended for pastoral review by the spiritual director and parish clergy.'
  ]
}

/**
 * Summarizes and synthesizes multiple raw officer remarks, notes, and bullet points
 * into cohesive, flowing pastoral sentences without bullets, dashes, or verbatim quotes.
 */
export function summarizeOfficerRemarks(officerRemarks: string[] = []): string {
  if (!officerRemarks || officerRemarks.length === 0) return ''

  // 1. Extract and clean individual points from remarks
  const rawFragments: string[] = []

  for (const rem of officerRemarks) {
    if (!rem || typeof rem !== 'string') continue
    // Split by line breaks and semicolons
    const splitItems = rem.split(/[\r\n;]+/)
    for (const item of splitItems) {
      // Strip bullet points, numbers, asterisks, dashes, leading/trailing whitespace & quotes
      const cleaned = item
        .replace(/^[\s•*–—\d.):-]+/, '')
        .replace(/["'“”]/g, '')
        .trim()

      if (cleaned.length < 3) continue

      const lower = cleaned.toLowerCase()
      // Skip meaningless filler responses
      if (
        lower === 'n/a' ||
        lower === 'na' ||
        lower === 'none' ||
        lower === 'wala' ||
        lower === 'wla' ||
        lower === 'no comment' ||
        lower === 'nothing' ||
        lower === 'ok' ||
        lower === 'okay' ||
        lower === 'goods' ||
        lower === 'all good' ||
        lower === 'walang komento'
      ) {
        continue
      }

      rawFragments.push(cleaned)
    }
  }

  if (rawFragments.length === 0) return ''

  // 2. Deduplicate while preserving original phrasing
  const uniqueFragments: string[] = []
  const seen = new Set<string>()

  for (const frag of rawFragments) {
    const key = frag.toLowerCase().replace(/[^a-z0-9]/g, '')
    if (!seen.has(key)) {
      seen.add(key)
      uniqueFragments.push(frag)
    }
  }

  // 3. Classify fragments
  const commendations: string[] = []
  const growthAreas: string[] = []
  const recommendations: string[] = []
  const generalNotes: string[] = []

  for (const frag of uniqueFragments) {
    const lower = frag.toLowerCase()

    const hasGrowthTrigger =
      lower.includes('need') ||
      lower.includes('kailangan') ||
      lower.includes('dapat') ||
      lower.includes('stuck') ||
      lower.includes('lack') ||
      lower.includes('kulang') ||
      lower.includes('nahuhuli') ||
      lower.includes('late') ||
      lower.includes('absent') ||
      lower.includes('struggle') ||
      lower.includes('cooperation') ||
      lower.includes('attendance') ||
      lower.includes('meeting') ||
      lower.includes('formation') ||
      (lower.includes('focus') && (lower.includes('more') || lower.includes('dapat') || lower.includes('need')))

    const hasRecommendationTrigger =
      lower.includes('mentor') ||
      lower.includes('workshop') ||
      lower.includes('activities') ||
      lower.includes('activity') ||
      lower.includes('training') ||
      lower.includes('exposure') ||
      lower.includes('recommend') ||
      lower.includes('rekomenda') ||
      lower.includes('encourage') ||
      lower.includes('fellowship') ||
      lower.includes('social interaction') ||
      lower.includes('interaction') ||
      lower.includes('counseling') ||
      lower.includes('guidance')

    const hasCommendationTrigger =
      lower.includes('presence of mind') ||
      lower.includes('willingness') ||
      lower.includes('posture') ||
      lower.includes('accept feedback') ||
      lower.includes('reveren') ||
      lower.includes('punctual') ||
      lower.includes('diligent') ||
      lower.includes('active') ||
      lower.includes('reliable') ||
      lower.includes('dependable') ||
      lower.includes('magaling') ||
      lower.includes('maasahan') ||
      lower.includes('mabait') ||
      lower.includes('respectful') ||
      lower.includes('alert') ||
      lower.includes('good') ||
      lower.includes('great') ||
      lower.includes('potential') ||
      lower.includes('dedicated') ||
      lower.includes('dedication') ||
      lower.includes('initiative')

    if (hasRecommendationTrigger && !hasCommendationTrigger) {
      recommendations.push(frag)
    } else if (hasGrowthTrigger && !lower.includes('potential')) {
      growthAreas.push(frag)
    } else if (hasCommendationTrigger) {
      commendations.push(frag)
    } else {
      generalNotes.push(frag)
    }
  }

  // 4. Transform raw phrases into natural flowing clauses
  const polishClause = (text: string): string => {
    let t = text.trim()
    // Strip trailing punctuation
    t = t.replace(/[.,;:]+$/, '').trim()
    // Remove colloquial preamble
    t = t.replace(/^(as far as I know,?|in my opinion,?|tingin ko,?|sa tingin ko,?|parang|palagay ko,?)\s*/i, '')
    // Smooth common officer phrasing
    t = t.replace(/\bdoes accept feedback\b/i, 'receptiveness to feedback')
    t = t.replace(/\baccepts? feedback\b/i, 'receptiveness to feedback')
    t = t.replace(/\bknows proper posture\b/i, 'proper posture')
    t = t.replace(/\bproper posture during mass\b/i, 'proper posture during Mass')
    t = t.replace(/\bshows steady commitment\b/i, 'steady commitment')
    t = t.replace(/\bshows great potential\b/i, 'great potential')
    t = t.replace(/^he is stuck at being a main server, four bell, and single bell/i, 'broadening assignments beyond main and bell server duties')
    t = t.replace(/^stuck at being a main server, four bell, and single bell/i, 'broadening assignments beyond main and bell server duties')
    t = t.replace(/^attendance on ministry meetings, formation, and activities/i, 'active attendance in ministry meetings and formation activities')
    t = t.replace(/^cooperation with other altar servers/i, 'cooperation and camaraderie with fellow servers')
    t = t.replace(/^more activities to enhance his social interaction with other servers/i, 'involvement in activities to enhance social interaction with peers')
    t = t.replace(/^mentorship$/i, 'continued fraternal mentorship')
    t = t.replace(/^always punctual/i, 'consistent punctuality')
    t = t.replace(/^respectful to/i, 'respect for')
    t = t.replace(/^handles liturgical/i, 'reverent handling of liturgical')
    t = t.replace(/^handles sacred/i, 'reverent handling of sacred')
    t = t.replace(/^needs more practice on/i, 'further practice on')
    t = t.replace(/^shyness/i, 'building confidence and overcoming shyness')
    t = t.replace(/^occasional tardiness/i, 'addressing occasional tardiness')

    // Capitalize Mass / Sunday if present
    t = t.replace(/\bmass\b/g, 'Mass')
    t = t.replace(/\bsunday\b/g, 'Sunday')

    // Lowercase first letter if not Mass, Sunday, Holy, etc.
    if (t.length > 0 && !t.startsWith('Mass') && !t.startsWith('Sunday') && !t.startsWith('Holy') && !t.startsWith('I ')) {
      t = t.charAt(0).toLowerCase() + t.slice(1)
    }
    return t
  }

  const joinClauses = (items: string[]): string => {
    if (items.length === 0) return ''
    if (items.length === 1) return items[0]
    if (items.length === 2) return `${items[0]} and ${items[1]}`
    return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`
  }

  const summarySentences: string[] = []

  // Commendations sentence
  if (commendations.length > 0) {
    const polished = commendations.map(polishClause)
    summarySentences.push(`Evaluating officers commend his ${joinClauses(polished)}.`)
  }

  // Growth & Recommendations sentence
  if (growthAreas.length > 0 && recommendations.length > 0) {
    const polishedGrowth = growthAreas.map(polishClause)
    const polishedRecs = recommendations.map(polishClause)
    summarySentences.push(
      `For continued growth, officers note areas for improvement in ${joinClauses(polishedGrowth)}, recommending ${joinClauses(polishedRecs)}.`
    )
  } else if (growthAreas.length > 0) {
    const polishedGrowth = growthAreas.map(polishClause)
    summarySentences.push(
      `For continued growth, officers recommend focus on ${joinClauses(polishedGrowth)}.`
    )
  } else if (recommendations.length > 0) {
    const polishedRecs = recommendations.map(polishClause)
    summarySentences.push(
      `Evaluating officers recommend ${joinClauses(polishedRecs)}.`
    )
  }

  // General notes
  if (generalNotes.length > 0) {
    const polishedGeneral = generalNotes.map(polishClause)
    if (summarySentences.length === 0) {
      summarySentences.push(`Evaluating officers noted ${joinClauses(polishedGeneral)}.`)
    } else {
      summarySentences.push(`Officers also noted ${joinClauses(polishedGeneral)}.`)
    }
  }

  return summarySentences.join(' ')
}

/**
 * Synthesizes a cohesive, naturally varied pastoral evaluation narrative.
 */
export function synthesizePastoralEvaluation(
  memberId: string,
  ratingScore?: number,
  attendanceRate?: number,
  officerRemarks: string[] = []
): string {
  let baseSentence = ''

  if (attendanceRate !== undefined && !isNaN(attendanceRate) && attendanceRate <= 10) {
    const templates = ATTENDANCE_TIER_TEMPLATES.inactive
    const idx = getMemberVariationIndex(memberId, templates.length)
    baseSentence = templates[idx]
  } else if (ratingScore !== undefined && !isNaN(ratingScore) && ratingScore > 0) {
    let tierKey: 'tier5' | 'tier4' | 'tier3' | 'tier2' | 'tier1'
    if (ratingScore >= 4.5) tierKey = 'tier5'
    else if (ratingScore >= 3.5) tierKey = 'tier4'
    else if (ratingScore >= 2.5) tierKey = 'tier3'
    else if (ratingScore >= 1.5) tierKey = 'tier2'
    else tierKey = 'tier1'

    const templates = RATING_TIER_TEMPLATES[tierKey]
    const idx = getMemberVariationIndex(memberId, templates.length)
    baseSentence = templates[idx]
  } else if (attendanceRate !== undefined && !isNaN(attendanceRate)) {
    let tierKey: 'exemplary' | 'good' | 'moderate' | 'irregular' | 'inactive'
    if (attendanceRate <= 10) tierKey = 'inactive'
    else if (attendanceRate < 50) tierKey = 'irregular'
    else if (attendanceRate < 75) tierKey = 'moderate'
    else if (attendanceRate < 90) tierKey = 'good'
    else tierKey = 'exemplary'

    const templates = ATTENDANCE_TIER_TEMPLATES[tierKey]
    const idx = getMemberVariationIndex(memberId, templates.length)
    baseSentence = templates[idx]
  } else {
    baseSentence = 'Faithfully serves as an altar server in the parish ministry.'
  }

  const summarizedRemarks = summarizeOfficerRemarks(officerRemarks)
  if (summarizedRemarks) {
    return `${baseSentence} ${summarizedRemarks}`
  }

  return baseSentence
}

/**
 * Finds the member ID from a submitted response by checking question types and values.
 */
export function getMemberIdFromResponse(
  response: EventFormResponse,
  questions: EventFormQuestion[],
  members: Member[]
): string | null {
  if (!response.answers) return null

  // 1. Direct match from a member_selector question
  const memberQ = questions.find(q => q.type === 'member_selector')
  if (memberQ && response.answers[memberQ.id]) {
    const val = String(response.answers[memberQ.id]).trim()
    const member = members.find(m => m.id === val)
    if (member) return member.id
  }

  // 2. Check if any question answer directly matches an active member ID
  for (const q of questions) {
    const ans = response.answers[q.id]
    if (typeof ans === 'string' && ans.trim()) {
      const match = members.find(m => m.id === ans.trim())
      if (match) return match.id
    }
  }

  // 3. Fallback: Check if any answer matches a member's full name or "LastName, FirstName"
  for (const q of questions) {
    const ans = response.answers[q.id]
    if (typeof ans === 'string' && ans.trim().length > 3) {
      const normAns = ans.trim().toLowerCase()
      const match = members.find(m => {
        const full = `${m.firstName} ${m.lastName}`.toLowerCase()
        const reverse = `${m.lastName}, ${m.firstName}`.toLowerCase()
        const reverseNoComma = `${m.lastName} ${m.firstName}`.toLowerCase()
        return normAns === full || normAns === reverse || normAns === reverseNoComma
      })
      if (match) return match.id
    }
  }

  return null
}

/**
 * Consolidates multi-officer event form responses grouped by evaluated member.
 */
export function consolidateFormEvaluations(params: {
  questions: EventFormQuestion[]
  responses: EventFormResponse[]
  members: Member[]
  attendanceMap?: Record<string, { rate: number; rank?: string }>
}): ConsolidatedMemberEvaluation[] {
  const { questions, responses, members, attendanceMap = {} } = params

  const memberMap = new Map<string, Member>()
  for (const m of members) {
    memberMap.set(m.id, m)
  }

  // Rating questions in this form
  const ratingQuestions = questions.filter(q => q.type === 'rating')
  // Remarks / text questions in this form (excluding name/member selector questions)
  const remarkQuestions = questions.filter(
    q =>
      (q.type === 'long_text' || q.type === 'short_text') &&
      !q.question.toLowerCase().includes('member') &&
      !q.question.toLowerCase().includes('pangalan') &&
      !q.question.toLowerCase().includes('server name') &&
      !q.question.toLowerCase().includes('name of')
  )

  // Group responses by evaluated memberId
  const groupedByMember = new Map<string, EventFormResponse[]>()

  for (const resp of responses) {
    const memberId = getMemberIdFromResponse(resp, questions, members)
    if (memberId) {
      const existing = groupedByMember.get(memberId) || []
      existing.push(resp)
      groupedByMember.set(memberId, existing)
    }
  }

  const consolidatedList: ConsolidatedMemberEvaluation[] = []

  groupedByMember.forEach((memberResponses, memberId) => {
    const member = memberMap.get(memberId)
    const memberName = member ? `${member.lastName}, ${member.firstName}` : memberId
    const attData = attendanceMap[memberId]
    const attendanceRate = attData ? attData.rate : undefined
    const rank = (attData && attData.rank) || member?.rank || 'Altar Server'

    const detailedFeedback: OfficerSubmissionFeedback[] = []
    const evaluatingOfficerNames: string[] = []
    const allMemberRemarks: string[] = []
    const memberAllRatings: number[] = []

    for (const resp of memberResponses) {
      const officerName = resp.respondentMemberName || resp.respondentEmail || 'Ministry Officer'
      if (!evaluatingOfficerNames.includes(officerName)) {
        evaluatingOfficerNames.push(officerName)
      }

      const officerRatings: OfficerRatingItem[] = []
      for (const rq of ratingQuestions) {
        const val = resp.answers ? resp.answers[rq.id] : undefined
        const num = Number(val)
        if (!isNaN(num) && num > 0) {
          officerRatings.push({
            questionId: rq.id,
            questionText: rq.question,
            score: num,
            maxScore: rq.maxRating || 5
          })
          memberAllRatings.push(num)
        }
      }

      const officerRemarks: string[] = []
      for (const tq of remarkQuestions) {
        const val = resp.answers ? resp.answers[tq.id] : undefined
        if (typeof val === 'string' && val.trim().length > 0) {
          const trimmed = val.trim()
          const isMemberName = members.some(m => {
            const norm = trimmed.toLowerCase()
            return (
              norm === `${m.firstName} ${m.lastName}`.toLowerCase() ||
              norm === `${m.lastName}, ${m.firstName}`.toLowerCase()
            )
          })
          if (!isMemberName) {
            if (!officerRemarks.includes(trimmed)) {
              officerRemarks.push(trimmed)
            }
            if (!allMemberRemarks.includes(trimmed)) {
              allMemberRemarks.push(trimmed)
            }
          }
        }
      }

      const officerAvg = officerRatings.length > 0
        ? Number((officerRatings.reduce((sum, r) => sum + r.score, 0) / officerRatings.length).toFixed(1))
        : 0

      let submittedAtStr: string | undefined
      if (typeof resp.submittedAt === 'string') {
        submittedAtStr = resp.submittedAt
      } else if (resp.submittedAt && typeof resp.submittedAt === 'object' && 'toDate' in resp.submittedAt) {
        submittedAtStr = (resp.submittedAt as any).toDate().toISOString()
      }

      detailedFeedback.push({
        responseId: resp.id || '',
        officerName,
        submittedAt: submittedAtStr,
        ratings: officerRatings,
        remarks: officerRemarks,
        overallRating: officerAvg
      })
    }

    const averageScore = memberAllRatings.length > 0
      ? Number((memberAllRatings.reduce((sum, s) => sum + s, 0) / memberAllRatings.length).toFixed(1))
      : undefined

    const synthesizedNarrative = synthesizePastoralEvaluation(
      memberId,
      averageScore,
      attendanceRate,
      allMemberRemarks
    )

    consolidatedList.push({
      memberId,
      memberName,
      rank,
      order: member?.order,
      attendanceRate,
      evaluatingOfficers: evaluatingOfficerNames,
      detailedOfficerFeedback: detailedFeedback,
      averageScore,
      distinctRemarks: allMemberRemarks,
      synthesizedNarrative,
      isCustomized: false
    })
  })

  return consolidatedList
}

/**
 * Generates automated smart attendance presets for all members.
 */
export function generateSmartAttendancePresets(
  members: { id: string; attendanceRate: number; name: string }[]
): Record<string, string> {
  const result: Record<string, string> = {}
  for (const m of members) {
    result[m.id] = synthesizePastoralEvaluation(m.id, undefined, m.attendanceRate, [])
  }
  return result
}
