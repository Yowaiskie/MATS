import { test } from 'node:test'
import assert from 'node:assert'
import {
  getMemberVariationIndex,
  synthesizePastoralEvaluation,
  summarizeOfficerRemarks,
  getMemberIdFromResponse,
  consolidateFormEvaluations,
  generateSmartAttendancePresets
} from '../src/utils/eventFormConsolidation.ts'
import type { EventFormQuestion, EventFormResponse } from '../src/types/eventForm.ts'
import type { Member } from '../src/types/member.ts'

test('getMemberVariationIndex provides deterministic and varied pseudo-random indices', () => {
  const index1 = getMemberVariationIndex('member-123', 5)
  const index2 = getMemberVariationIndex('member-123', 5)
  // Deterministic for same seed
  assert.strictEqual(index1, index2)

  // Bounds check
  assert.ok(index1 >= 0 && index1 < 5)

  // Different member IDs can hit different indices
  const indices = new Set<number>()
  for (let i = 0; i < 20; i++) {
    indices.add(getMemberVariationIndex(`server-unique-id-${i}`, 5))
  }
  assert.ok(indices.size > 1, 'Should distribute across variations')
})

test('synthesizePastoralEvaluation produces appropriate tier narratives based on score', () => {
  // Tier 5: Exemplary (4.5 - 5.0)
  const tier5 = synthesizePastoralEvaluation('m1', 4.8)
  assert.ok(
    tier5.includes('Exemplary') ||
    tier5.includes('reverence') ||
    tier5.includes('dedication') ||
    tier5.includes('maturity') ||
    tier5.includes('pillar') ||
    tier5.includes('Commended'),
    `Tier 5 narrative expected, got: ${tier5}`
  )

  // Tier 4: Very Good (3.5 - 4.4)
  const tier4 = synthesizePastoralEvaluation('m1', 4.0)
  assert.ok(
    tier4.includes('commendable') ||
    tier4.includes('dependable') ||
    tier4.includes('diligence') ||
    tier4.includes('discipline') ||
    tier4.includes('camaraderie') ||
    tier4.includes('competence'),
    `Tier 4 narrative expected, got: ${tier4}`
  )

  // Tier 3: Satisfactory (2.5 - 3.4)
  const tier3 = synthesizePastoralEvaluation('m1', 3.0)
  assert.ok(
    tier3.includes('satisfactory') ||
    tier3.includes('growth') ||
    tier3.includes('willingness') ||
    tier3.includes('workshops') ||
    tier3.includes('Capable'),
    `Tier 3 narrative expected, got: ${tier3}`
  )

  // Tier 2: Needs Guidance (1.5 - 2.4)
  const tier2 = synthesizePastoralEvaluation('m1', 2.0)
  assert.ok(
    tier2.includes('guidance') ||
    tier2.includes('mentoring') ||
    tier2.includes('inconsistent') ||
    tier2.includes('encouragement') ||
    tier2.includes('punctuality'),
    `Tier 2 narrative expected, got: ${tier2}`
  )

  // Tier 1: Critical (1.0 - 1.4)
  const tier1 = synthesizePastoralEvaluation('m1', 1.2)
  assert.ok(
    tier1.includes('Critical') ||
    tier1.includes('conference') ||
    tier1.includes('Minimal') ||
    tier1.includes('inactivity') ||
    tier1.includes('re-engagement'),
    `Tier 1 narrative expected, got: ${tier1}`
  )
})

test('synthesizePastoralEvaluation handles attendance tier fallbacks when no rating score exists', () => {
  // Inactive: <= 10%
  const inactive = synthesizePastoralEvaluation('m1', undefined, 8.5)
  assert.ok(inactive.includes('10% or below') || inactive.includes('Inactive') || inactive.includes('inactive'), `Expected inactive narrative, got: ${inactive}`)

  // Irregular: 11% - 49%
  const irregular = synthesizePastoralEvaluation('m1', undefined, 42)
  assert.ok(irregular.includes('attendance') || irregular.includes('schedules'))

  // Moderate: 50% - 74%
  const moderate = synthesizePastoralEvaluation('m1', undefined, 65)
  assert.ok(moderate.includes('Moderate') || moderate.includes('attendance'))

  // Good: 75% - 89%
  const good = synthesizePastoralEvaluation('m1', undefined, 82)
  assert.ok(
    good.toLowerCase().includes('good') ||
    good.toLowerCase().includes('reliable') ||
    good.toLowerCase().includes('dependable') ||
    good.toLowerCase().includes('attendance') ||
    good.toLowerCase().includes('commendable'),
    `Expected good narrative, got: ${good}`
  )

  // Exemplary: >= 90%
  const exemplary = synthesizePastoralEvaluation('m1', undefined, 96)
  assert.ok(exemplary.includes('Outstanding') || exemplary.includes('Exemplary') || exemplary.includes('Superb') || exemplary.includes('attendance'))
})

test('synthesizePastoralEvaluation summarizes officer remarks into flowing sentences without bullets or quotes', () => {
  const remarks = [
    'Always punctual for Sunday dawn mass.',
    'Always punctual for Sunday dawn mass.', // duplicate
    'Shows great reverence during communion.',
    'N/A' // ignored
  ]
  const synthesized = synthesizePastoralEvaluation('m1', 4.8, 95, remarks)
  // Must NOT have bullets, raw dashes, or quotes
  assert.ok(!synthesized.includes('-'), 'Should not contain raw bullet dashes')
  assert.ok(!synthesized.includes('\n'), 'Should not contain raw newlines')
  assert.ok(!synthesized.includes('Officers noted: "'), 'Should not dump raw quotation wrapper')
  assert.ok(
    synthesized.includes('Evaluating officers commend') ||
    synthesized.includes('punctual') ||
    synthesized.includes('reverence'),
    `Expected synthesized narrative, got: ${synthesized}`
  )
})

test('summarizeOfficerRemarks converts messy bulleted feedback into cohesive pastoral sentences', () => {
  const userFeedbackInput = [
    'Presence of mind and willingness to serve; Does accept feedback, knows proper posture during mass.',
    '- cooperation with other altar servers\n- attendance on ministry meetings, formation, and activities. \n- as far as I know, he is stuck at being a main server, four bell, and single bell.',
    '- more activities to enhance his social interaction with other servers.\n- mentorship'
  ]

  const summary = summarizeOfficerRemarks(userFeedbackInput)

  // Verify bullet elimination
  assert.ok(!summary.includes('-'), 'Must strip all dashes and bullets')
  assert.ok(!summary.includes('\n'), 'Must strip all raw newlines')
  assert.ok(!summary.includes('\r'), 'Must strip all carriage returns')
  assert.ok(!summary.includes('"'), 'Must not contain raw quotes')

  // Verify natural sentence structure and synthesis
  assert.ok(summary.includes('Evaluating officers commend his'), 'Should commend recognized strengths')
  assert.ok(summary.includes('presence of mind'), 'Should include presence of mind')
  assert.ok(summary.includes('proper posture during Mass'), 'Should properly format and capitalize posture')
  assert.ok(summary.includes('receptiveness to feedback'), 'Should polish does accept feedback into receptiveness')
  assert.ok(summary.includes('For continued growth, officers note areas for improvement'), 'Should transition smoothly into growth areas')
  assert.ok(summary.includes('recommending'), 'Should recommend next steps')
  assert.ok(summary.includes('fraternal mentorship'), 'Should polish mentorship into fraternal mentorship')
})

test('getMemberIdFromResponse resolves member via selector question or name matching', () => {
  const members: Member[] = [
    {
      id: 'mem_001',
      firstName: 'Juan',
      lastName: 'Dela Cruz',
      rank: 'Senior Acolyte',
      status: 'active'
    } as any,
    {
      id: 'mem_002',
      firstName: 'Pedro',
      lastName: 'Santos',
      rank: 'Junior Knight',
      status: 'active'
    } as any
  ]

  const questions: EventFormQuestion[] = [
    {
      id: 'q_member',
      formId: 'form_eval',
      order: 1,
      type: 'member_selector',
      question: 'Select Member Evaluated',
      required: true
    },
    {
      id: 'q_rate',
      formId: 'form_eval',
      order: 2,
      type: 'rating',
      question: 'Liturgical Reverence',
      required: true,
      maxRating: 5
    }
  ]

  // Test 1: Direct member selector answer
  const resp1: EventFormResponse = {
    id: 'resp_1',
    formId: 'form_eval',
    eventId: 'evt_1',
    trackingNumber: 'TRK-001',
    answers: {
      q_member: 'mem_001',
      q_rate: 5
    },
    status: 'approved'
  }
  assert.strictEqual(getMemberIdFromResponse(resp1, questions, members), 'mem_001')

  // Test 2: Name match fallback
  const textQuestions: EventFormQuestion[] = [
    {
      id: 'q_text_name',
      formId: 'form_eval',
      order: 1,
      type: 'short_text',
      question: 'Name of Altar Server',
      required: true
    }
  ]
  const resp2: EventFormResponse = {
    id: 'resp_2',
    formId: 'form_eval',
    eventId: 'evt_1',
    trackingNumber: 'TRK-002',
    answers: {
      q_text_name: 'Dela Cruz, Juan'
    },
    status: 'approved'
  }
  assert.strictEqual(getMemberIdFromResponse(resp2, textQuestions, members), 'mem_001')
})

test('consolidateFormEvaluations consolidates multi-officer feedback with attribution', () => {
  const members: Member[] = [
    {
      id: 'mem_001',
      firstName: 'Gabriel',
      lastName: 'Reyes',
      rank: 'Acolyte',
      order: 'Order of San Pedro',
      status: 'active'
    } as any
  ]

  const questions: EventFormQuestion[] = [
    {
      id: 'q_mem',
      formId: 'form_1',
      order: 1,
      type: 'member_selector',
      question: 'Evaluated Altar Server',
      required: true
    },
    {
      id: 'q_reverence',
      formId: 'form_1',
      order: 2,
      type: 'rating',
      question: 'Sanctuary Reverence',
      required: true,
      maxRating: 5
    },
    {
      id: 'q_punctuality',
      formId: 'form_1',
      order: 3,
      type: 'rating',
      question: 'Punctuality & Decorum',
      required: true,
      maxRating: 5
    },
    {
      id: 'q_remarks',
      formId: 'form_1',
      order: 4,
      type: 'long_text',
      question: 'Specific Remarks & Commendations',
      required: false
    }
  ]

  // Officer 1 submission
  const resp1: EventFormResponse = {
    id: 'resp_off_1',
    formId: 'form_1',
    eventId: 'evt_1',
    trackingNumber: 'TRK-101',
    respondentMemberName: 'Bro. Kyle Vincent Madriaga',
    respondentEmail: 'kyle@mats.org',
    submittedAt: '2026-11-10T08:00:00Z',
    answers: {
      q_mem: 'mem_001',
      q_reverence: 5,
      q_punctuality: 5,
      q_remarks: 'Consistently reverent during the Holy Hour.'
    },
    status: 'approved'
  }

  // Officer 2 submission
  const resp2: EventFormResponse = {
    id: 'resp_off_2',
    formId: 'form_1',
    eventId: 'evt_1',
    trackingNumber: 'TRK-102',
    respondentMemberName: 'Bro. Benaika Lorenzo Paronable',
    respondentEmail: 'benaika@mats.org',
    submittedAt: '2026-11-11T09:00:00Z',
    answers: {
      q_mem: 'mem_001',
      q_reverence: 4,
      q_punctuality: 4,
      q_remarks: 'Shows great discipline and helpfulness to younger servers.'
    },
    status: 'approved'
  }

  const consolidated = consolidateFormEvaluations({
    questions,
    responses: [resp1, resp2],
    members,
    attendanceMap: {
      mem_001: { rate: 94.5, rank: 'Senior Acolyte' }
    }
  })

  assert.strictEqual(consolidated.length, 1)
  const evalItem = consolidated[0]
  assert.strictEqual(evalItem.memberId, 'mem_001')
  assert.strictEqual(evalItem.memberName, 'Reyes, Gabriel')
  assert.strictEqual(evalItem.rank, 'Senior Acolyte')
  assert.strictEqual(evalItem.attendanceRate, 94.5)

  // Evaluating officers attribution
  assert.strictEqual(evalItem.evaluatingOfficers.length, 2)
  assert.ok(evalItem.evaluatingOfficers.includes('Bro. Kyle Vincent Madriaga'))
  assert.ok(evalItem.evaluatingOfficers.includes('Bro. Benaika Lorenzo Paronable'))

  // Detailed officer feedback inspection
  assert.strictEqual(evalItem.detailedOfficerFeedback.length, 2)
  const fb1 = evalItem.detailedOfficerFeedback[0]
  assert.strictEqual(fb1.officerName, 'Bro. Kyle Vincent Madriaga')
  assert.strictEqual(fb1.overallRating, 5.0)
  assert.strictEqual(fb1.ratings.length, 2)
  assert.strictEqual(fb1.remarks[0], 'Consistently reverent during the Holy Hour.')

  const fb2 = evalItem.detailedOfficerFeedback[1]
  assert.strictEqual(fb2.officerName, 'Bro. Benaika Lorenzo Paronable')
  assert.strictEqual(fb2.overallRating, 4.0)

  // Composite average score across all ratings: (5 + 5 + 4 + 4) / 4 = 4.5
  assert.strictEqual(evalItem.averageScore, 4.5)

  // Deduplicated remarks
  assert.strictEqual(evalItem.distinctRemarks.length, 2)

  // Synthesized narrative includes remarks summarized into flowing sentences
  assert.ok(evalItem.synthesizedNarrative.includes('Evaluating officers commend'))
  assert.ok(evalItem.synthesizedNarrative.includes('reverent during the Holy Hour'))
  assert.ok(evalItem.synthesizedNarrative.includes('discipline and helpfulness to younger servers'))
  assert.ok(!evalItem.synthesizedNarrative.includes('Officers noted: "'), 'Should not use raw quote dump')
})

test('generateSmartAttendancePresets generates complete presets for all members', () => {
  const members = [
    { id: 'm1', attendanceRate: 95, name: 'Server A' },
    { id: 'm2', attendanceRate: 8, name: 'Server B' },
    { id: 'm3', attendanceRate: 60, name: 'Server C' }
  ]

  const presets = generateSmartAttendancePresets(members)
  assert.ok(presets['m1'].length > 10)
  assert.ok(presets['m2'].includes('10% or below') || presets['m2'].includes('Inactive') || presets['m2'].includes('inactive'))
  assert.ok(presets['m3'].length > 10)
})
