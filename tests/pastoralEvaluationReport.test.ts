import { test } from 'node:test'
import assert from 'node:assert'
import type { MemberReportRow } from '../src/services/reportService.ts'
import { buildMemberReportTableData } from '../src/utils/eventFormConsolidation.ts'

test('Pastoral evaluation report correctly builds 8 columns with inactive flagging on <= 10% rate', () => {
  const testRows: MemberReportRow[] = [
    {
      memberId: 'mem_active',
      name: 'Gabriel Reyes',
      rank: 'Senior Acolyte',
      status: 'active',
      totalAssigned: 20,
      present: 18,
      late: 1,
      absent: 1,
      excused: 0,
      rate: 90.0,
      warningStatus: 'active',
      warningCategory: 'none',
      missedSchedules: [],
      sundayAbsences: 1,
      weekdayAbsences: 0,
      meetingAbsences: 0,
      policyAbsencesCount: 1,
      otherServerCount: 0,
      otherServerSchedules: []
    },
    {
      memberId: 'mem_low',
      name: 'John Doe',
      rank: 'Junior Knight',
      status: 'active',
      totalAssigned: 10,
      present: 1,
      late: 0,
      absent: 9,
      excused: 0,
      rate: 10.0, // Exactly 10.0% -> should be flagged inactive
      warningStatus: 'suspended',
      warningCategory: 'sunday',
      missedSchedules: [],
      sundayAbsences: 9,
      weekdayAbsences: 0,
      meetingAbsences: 0,
      policyAbsencesCount: 9,
      otherServerCount: 0,
      otherServerSchedules: []
    },
    {
      memberId: 'mem_zero',
      name: 'Inactive Server',
      rank: 'Acolyte',
      status: 'active',
      totalAssigned: 8,
      present: 0,
      late: 0,
      absent: 8,
      excused: 0,
      rate: 0.0, // <= 10% -> should be flagged inactive
      warningStatus: 'suspended',
      warningCategory: 'sunday',
      missedSchedules: [],
      sundayAbsences: 8,
      weekdayAbsences: 0,
      meetingAbsences: 0,
      policyAbsencesCount: 8,
      otherServerCount: 0,
      otherServerSchedules: []
    }
  ]

  const evals = {
    mem_active: 'Exemplary service and outstanding dedication at the altar.',
    mem_low: 'Critically low attendance (10% or below); flagged as inactive status and recommended for pastoral review.',
    mem_zero: 'Prolonged inactivity and lack of responsiveness to liturgical schedules.'
  }

  const { tableHead, tableBody } = buildMemberReportTableData(testRows, {
    reportType: 'pastoral_evaluation',
    evaluationsMap: evals
  })

  // Verify 8 columns in header
  assert.strictEqual(tableHead[0].length, 8)
  assert.deepStrictEqual(tableHead[0], [
    '#',
    'MEMBER NAME',
    'RANK',
    'PRESENT',
    'LATE',
    'ABSENT',
    'RATE',
    'EVALUATION & PASTORAL REMARKS',
  ])

  // Active server
  assert.strictEqual(tableBody[0][6], '90.0%')
  assert.strictEqual(tableBody[0][7], evals.mem_active)

  // Low server (10%) - flagged inactive
  assert.strictEqual(tableBody[1][6], '10.0%\n(Inactive)')
  assert.strictEqual(tableBody[1][7], evals.mem_low)

  // Zero attendance server (0%) - flagged inactive
  assert.strictEqual(tableBody[2][6], '0.0%\n(Inactive)')
  assert.strictEqual(tableBody[2][7], evals.mem_zero)
})

test('Member report table data correctly filters by targeted ranks', () => {
  const allRows: MemberReportRow[] = [
    {
      memberId: 'm1',
      name: 'Chevalier 1',
      rank: 'Chevaliers',
      status: 'active',
      totalAssigned: 10,
      present: 10,
      late: 0,
      absent: 0,
      excused: 0,
      rate: 100,
      warningStatus: 'active',
      warningCategory: 'none',
      missedSchedules: [],
      sundayAbsences: 0,
      weekdayAbsences: 0,
      meetingAbsences: 0,
      policyAbsencesCount: 0,
      otherServerCount: 0,
      otherServerSchedules: []
    },
    {
      memberId: 'm2',
      name: 'Paladin 1',
      rank: 'Paladins',
      status: 'active',
      totalAssigned: 10,
      present: 8,
      late: 1,
      absent: 1,
      excused: 0,
      rate: 80,
      warningStatus: 'active',
      warningCategory: 'none',
      missedSchedules: [],
      sundayAbsences: 1,
      weekdayAbsences: 0,
      meetingAbsences: 0,
      policyAbsencesCount: 1,
      otherServerCount: 0,
      otherServerSchedules: []
    },
    {
      memberId: 'm3',
      name: 'Squire 1',
      rank: 'Squires',
      status: 'active',
      totalAssigned: 10,
      present: 9,
      late: 0,
      absent: 1,
      excused: 0,
      rate: 90,
      warningStatus: 'active',
      warningCategory: 'none',
      missedSchedules: [],
      sundayAbsences: 1,
      weekdayAbsences: 0,
      meetingAbsences: 0,
      policyAbsencesCount: 1,
      otherServerCount: 0,
      otherServerSchedules: []
    }
  ]

  // Filter only Chevaliers
  const chevaliersRows = allRows.filter(r => r.rank === 'Chevaliers')
  const chevData = buildMemberReportTableData(chevaliersRows, { reportType: 'pastoral_evaluation' })
  assert.strictEqual(chevData.tableBody.length, 1)
  assert.strictEqual(chevData.tableBody[0][1], 'CHEVALIER 1')
  assert.strictEqual(chevData.tableBody[0][2], 'CHEVALIERS')

  // Filter Chevaliers + Squires
  const multiRankRows = allRows.filter(r => ['Chevaliers', 'Squires'].includes(r.rank))
  const multiData = buildMemberReportTableData(multiRankRows, { reportType: 'pastoral_evaluation' })
  assert.strictEqual(multiData.tableBody.length, 2)
  assert.deepStrictEqual(multiData.tableBody.map(b => b[2]), ['CHEVALIERS', 'SQUIRES'])
})
