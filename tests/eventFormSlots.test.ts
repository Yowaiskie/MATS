import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import type { EventFormQuestion } from '../src/types/eventForm.ts'
import {
  buildAppointmentSlotKey,
  buildSlotCountDocId,
  buildSlotCountMapKey,
  computeSlotDeltas,
  extractLimitedSelections,
  SlotFullError
} from '../src/utils/eventFormSlots.ts'

describe('eventFormSlots utilities', () => {
  const appointmentQuestion: EventFormQuestion = {
    id: 'q_appt',
    formId: 'form_pax_tecum',
    eventId: 'evt_pax',
    type: 'appointment_slots',
    question: 'Choose your Pax Tecum schedule',
    required: true,
    order: 3,
    appointmentConfig: [
      {
        id: 'day1',
        date: '2026-12-10',
        label: 'Day 1',
        slots: [
          { id: 'slot_am', startTime: '09:00 AM', endTime: '10:00 AM', label: 'Morning Batch', maxCapacity: 25 },
          { id: 'slot_pm', startTime: '02:00 PM', endTime: '03:00 PM', label: 'Afternoon Batch', maxCapacity: 25 },
          { id: 'slot_open', startTime: '04:00 PM', endTime: '05:00 PM', label: 'Unlimited' }
        ]
      }
    ]
  }

  const optionLimitQuestion: EventFormQuestion = {
    id: 'q_shirt',
    formId: 'form_pax_tecum',
    eventId: 'evt_pax',
    type: 'multiple_choice',
    question: 'Shirt Size',
    required: true,
    order: 4,
    options: ['Small / Youth', 'Medium', 'Large'],
    optionLimits: {
      'Small / Youth': 10,
      Medium: 20
    }
  }

  it('produces deterministic, Firestore-safe doc IDs without collisions', () => {
    const id1 = buildSlotCountDocId('form_1', 'q_1', 'option', 'Small / Youth')
    const id2 = buildSlotCountDocId('form_1', 'q_1', 'option', 'Small / Youth')
    const id3 = buildSlotCountDocId('form_1', 'q_1', 'option', 'Small - Youth')

    assert.equal(id1, id2)
    assert.notEqual(id1, id3)
    assert.ok(!id1.includes('/'), 'Doc ID must not contain slashes')
    assert.ok(!id1.includes(' '), 'Doc ID must not contain spaces')
  })

  it('extracts capacity-limited appointment slots and ignores unlimited slots', () => {
    const limited = extractLimitedSelections('form_pax_tecum', [appointmentQuestion], {
      q_appt: {
        date: '2026-12-10',
        dateLabel: 'Day 1',
        slotId: 'slot_am',
        timeRange: '09:00 AM - 10:00 AM',
        slotLabel: 'Morning Batch'
      }
    })

    assert.equal(limited.length, 1)
    assert.equal(limited[0].slotType, 'appointment')
    assert.equal(limited[0].maxCapacity, 25)
    assert.equal(limited[0].slotKey, buildAppointmentSlotKey('2026-12-10', 'slot_am'))
    assert.equal(
      limited[0].mapKey,
      buildSlotCountMapKey('q_appt', 'appointment', '2026-12-10::slot_am')
    )

    const unlimited = extractLimitedSelections('form_pax_tecum', [appointmentQuestion], {
      q_appt: {
        date: '2026-12-10',
        slotId: 'slot_open',
        timeRange: '04:00 PM - 05:00 PM'
      }
    })
    assert.equal(unlimited.length, 0)
  })

  it('extracts optionLimits for single and array answers and computes edit deltas', () => {
    const oldTargets = extractLimitedSelections(
      'form_pax_tecum',
      [appointmentQuestion, optionLimitQuestion],
      {
        q_appt: { date: '2026-12-10', slotId: 'slot_am', timeRange: '09:00 AM - 10:00 AM' },
        q_shirt: 'Small / Youth'
      }
    )

    const newTargets = extractLimitedSelections(
      'form_pax_tecum',
      [appointmentQuestion, optionLimitQuestion],
      {
        q_appt: { date: '2026-12-10', slotId: 'slot_pm', timeRange: '02:00 PM - 03:00 PM' },
        q_shirt: 'Small / Youth'
      }
    )

    const { toIncrement, toDecrement } = computeSlotDeltas(oldTargets, newTargets)
    assert.equal(toIncrement.length, 1)
    assert.equal(toDecrement.length, 1)
    assert.equal(toIncrement[0].slotKey, '2026-12-10::slot_pm')
    assert.equal(toDecrement[0].slotKey, '2026-12-10::slot_am')
  })

  it('constructs descriptive SlotFullError metadata for UI recovery', () => {
    const err = new SlotFullError({
      questionId: 'q_appt',
      slotKey: '2026-12-10::slot_am',
      slotType: 'appointment',
      maxCapacity: 25,
      label: '09:00 AM - 10:00 AM (Day 1)'
    })
    assert.equal(err.name, 'SlotFullError')
    assert.equal(err.questionId, 'q_appt')
    assert.match(err.message, /already full/)
  })
})

describe('firestore.rules eventFormResponses & eventFormSlotCounts hardening', () => {
  const rulesText = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf8')

  it('restricts eventFormResponses read to authenticated users only', () => {
    const responsesBlock = rulesText.match(/match \/eventFormResponses\/\{responseId\}\s*\{[\s\S]*?\n    \}/)
    assert.ok(responsesBlock, 'eventFormResponses rule block must exist')
    assert.match(responsesBlock[0], /allow read:\s*if isAuthenticated\(\);/)
    assert.doesNotMatch(responsesBlock[0], /allow read:\s*if true;/)
  })

  it('defines eventFormSlotCounts with public read and bounded +1 increment rules', () => {
    const slotBlock = rulesText.match(/match \/eventFormSlotCounts\/\{slotDocId\}\s*\{[\s\S]*?\n    \}/)
    assert.ok(slotBlock, 'eventFormSlotCounts rule block must exist')
    assert.match(slotBlock[0], /allow read:\s*if true;/)
    assert.match(slotBlock[0], /request\.resource\.data\.count == 1/)
    assert.match(slotBlock[0], /request\.resource\.data\.count == resource\.data\.count \+ 1/)
    assert.match(slotBlock[0], /request\.resource\.data\.count <= request\.resource\.data\.maxCapacity/)
    assert.match(slotBlock[0], /allow delete:\s*if isAuthenticated\(\);/)
  })
})
