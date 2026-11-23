import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import * as firestore from 'firebase/firestore'
import type { EventFormQuestion } from '../src/types/eventForm.ts'
import {
  buildAppointmentSlotKey,
  buildSlotCountDocId,
  extractLimitedSelections,
  SlotFullError
} from '../src/utils/eventFormSlots.ts'

const PROJECT_ID = 'demo-mats-pax-tecum-stress'
const FORM_ID = 'paxTecumForm20260001'
const EVENT_ID = 'evt_pax_tecum_2026'

const DATES = [
  { id: 'd1', date: '2026-12-10', label: 'Day 1' },
  { id: 'd2', date: '2026-12-11', label: 'Day 2' },
  { id: 'd3', date: '2026-12-12', label: 'Day 3' }
]

const SLOTS_PER_DATE = [
  { id: 'slot_1', startTime: '08:00 AM', endTime: '09:30 AM', label: 'Batch 1', maxCapacity: 25 },
  { id: 'slot_2', startTime: '10:00 AM', endTime: '11:30 AM', label: 'Batch 2', maxCapacity: 25 },
  { id: 'slot_3', startTime: '01:00 PM', endTime: '02:30 PM', label: 'Batch 3', maxCapacity: 25 },
  { id: 'slot_4', startTime: '03:00 PM', endTime: '04:30 PM', label: 'Batch 4', maxCapacity: 25 }
]

const QUESTIONS: EventFormQuestion[] = [
  { id: 'q_name', formId: FORM_ID, eventId: EVENT_ID, type: 'short_text', question: 'Full Name', required: true, order: 0 },
  { id: 'q_address', formId: FORM_ID, eventId: EVENT_ID, type: 'short_text', question: 'Address', required: true, order: 1 },
  { id: 'q_contact', formId: FORM_ID, eventId: EVENT_ID, type: 'contact_number', question: 'Contact Number', required: true, order: 2 },
  {
    id: 'q_appt',
    formId: FORM_ID,
    eventId: EVENT_ID,
    type: 'appointment_slots',
    question: 'Preferred Pax Tecum Schedule',
    required: true,
    order: 3,
    appointmentConfig: DATES.map(d => ({ ...d, slots: SLOTS_PER_DATE }))
  }
]

test('Pax Tecum 320-user concurrent stress test & rules audit (Firestore Emulator)', {
  skip: !process.env.FIRESTORE_EMULATOR_HOST,
  timeout: 180000
}, async (t) => {
  const [host, port] = process.env.FIRESTORE_EMULATOR_HOST!.split(':')
  assert.ok(['127.0.0.1', 'localhost'].includes(host), 'Only a local emulator may be used')

  const env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host,
      port: Number(port),
      rules: fs.readFileSync('firestore.rules', 'utf8')
    }
  })

  const seed = async () => {
    await env.clearFirestore()
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as unknown as firestore.Firestore
      const batch = firestore.writeBatch(db)
      batch.set(firestore.doc(db, 'eventForms', FORM_ID), {
        eventId: EVENT_ID,
        title: 'Pax Tecum 2026 Registration',
        status: 'published',
        isPublic: true,
        allowEditResponse: false,
        allowMultipleResponses: false,
        createdByUid: 'admin-1'
      })
      for (const q of QUESTIONS) {
        batch.set(firestore.doc(db, 'eventFormQuestions', q.id), q)
      }
      await batch.commit()
    })
  }

  try {
    await t.test('blocks unauthenticated PII reads and forged slot counter writes', async () => {
      await seed()
      const anonDb = env.unauthenticatedContext().firestore() as unknown as firestore.Firestore

      // 1. Unauthenticated read on eventFormResponses MUST be denied
      await assertFails(
        firestore.getDocs(
          firestore.query(firestore.collection(anonDb, 'eventFormResponses'), firestore.where('formId', '==', FORM_ID))
        )
      )

      // 2. Unauthenticated read on eventFormSlotCounts MUST succeed
      await assertSucceeds(
        firestore.getDocs(
          firestore.query(firestore.collection(anonDb, 'eventFormSlotCounts'), firestore.where('formId', '==', FORM_ID))
        )
      )

      // 3. Forged initial count != 1 MUST be denied
      const slotKey = buildAppointmentSlotKey('2026-12-10', 'slot_1')
      const docId = buildSlotCountDocId(FORM_ID, 'q_appt', 'appointment', slotKey)
      await assertFails(
        firestore.setDoc(firestore.doc(anonDb, 'eventFormSlotCounts', docId), {
          formId: FORM_ID,
          questionId: 'q_appt',
          slotType: 'appointment',
          slotKey,
          count: 5,
          maxCapacity: 25,
          updatedAt: firestore.serverTimestamp()
        })
      )
    })

    await t.test('320 concurrent public users across 12 slots (300 capacity): zero overbooking & low reads', async () => {
      await seed()
      const anonDb = env.unauthenticatedContext().firestore() as unknown as firestore.Firestore

      let totalReads = 0
      let totalWrites = 0
      let succeededCount = 0
      let slotFullCount = 0
      let contentionErrorCount = 0

      // Build 320 simulated registrants:
      // - First 40 ALL rush Day 1 Batch 1 (maxCapacity = 25) to stress-test overbooking!
      // - Remaining 280 spread across the other 11 slots (~25-26 per slot)
      const allSlots = DATES.flatMap(d =>
        SLOTS_PER_DATE.map(s => ({
          date: d.date,
          dateLabel: d.label,
          slotId: s.id,
          timeRange: `${s.startTime} - ${s.endTime}`,
          slotLabel: s.label
        }))
      )

      const registrants = Array.from({ length: 320 }, (_, i) => {
        const slot = i < 40 ? allSlots[0] : allSlots[1 + ((i - 40) % (allSlots.length - 1))]
        return {
          index: i + 1,
          name: `Registrant ${i + 1}`,
          address: `Blk ${i % 20} Lot ${i % 50}, Parish Area`,
          contact: `0917${String(1000000 + i).slice(-7)}`,
          slot
        }
      })

      const runOneUser = async (reg: (typeof registrants)[number]) => {
        // 1. Simulate PublicEventFormPage load: 1 form doc + 4 question docs + N slot count docs
        const formSnap = await firestore.getDoc(firestore.doc(anonDb, 'eventForms', FORM_ID))
        totalReads += 1
        assert.ok(formSnap.exists())

        const qSnap = await firestore.getDocs(
          firestore.query(firestore.collection(anonDb, 'eventFormQuestions'), firestore.where('formId', '==', FORM_ID))
        )
        totalReads += Math.max(1, qSnap.size)

        const countsSnap = await firestore.getDocs(
          firestore.query(firestore.collection(anonDb, 'eventFormSlotCounts'), firestore.where('formId', '==', FORM_ID))
        )
        totalReads += Math.max(1, countsSnap.size)

        // 2. Simulate atomic submitResponse transaction
        const answers = {
          q_name: reg.name,
          q_address: reg.address,
          q_contact: reg.contact,
          q_appt: reg.slot
        }
        const targets = extractLimitedSelections(FORM_ID, QUESTIONS, answers)
        const target = targets[0]
        const slotRef = firestore.doc(anonDb, 'eventFormSlotCounts', target.docId)
        const respRef = firestore.doc(firestore.collection(anonDb, 'eventFormResponses'))

        try {
          let attempt = 0
          while (true) {
            try {
              await firestore.runTransaction(anonDb, async (tx) => {
                const snap = await tx.get(slotRef)
                totalReads += 1
                const current = snap.exists() ? Number(snap.data().count || 0) : 0
                if (current + 1 > target.maxCapacity) {
                  throw new SlotFullError(target)
                }
                if (snap.exists()) {
                  tx.update(slotRef, {
                    formId: FORM_ID,
                    questionId: target.questionId,
                    slotType: target.slotType,
                    slotKey: target.slotKey,
                    count: current + 1,
                    maxCapacity: target.maxCapacity,
                    updatedAt: firestore.serverTimestamp()
                  })
                } else {
                  tx.set(slotRef, {
                    formId: FORM_ID,
                    questionId: target.questionId,
                    slotType: target.slotType,
                    slotKey: target.slotKey,
                    count: 1,
                    maxCapacity: target.maxCapacity,
                    updatedAt: firestore.serverTimestamp()
                  })
                }
                tx.set(respRef, {
                  formId: FORM_ID,
                  eventId: EVENT_ID,
                  trackingNumber: `FR-202611-${10000 + reg.index}`,
                  respondentMemberUid: '',
                  respondentMemberName: reg.name,
                  respondentEmail: '',
                  answers,
                  status: 'submitted',
                  submittedAt: firestore.serverTimestamp(),
                  updatedAt: firestore.serverTimestamp()
                })
              })
              break
            } catch (txErr) {
              if (txErr instanceof SlotFullError || attempt >= 4) throw txErr
              attempt += 1
              const delayMs = 150 * Math.pow(1.6, attempt - 1) + Math.floor(Math.random() * 250)
              await new Promise(resolve => setTimeout(resolve, delayMs))
            }
          }
          totalWrites += 2
          succeededCount += 1
        } catch (err) {
          if (err instanceof SlotFullError) {
            slotFullCount += 1
          } else {
            contentionErrorCount += 1
          }
        }
      }

      // Run in realistic concurrent waves of 25 users hitting simultaneously
      const WAVE_SIZE = 25
      const startedAt = Date.now()
      for (let i = 0; i < registrants.length; i += WAVE_SIZE) {
        const wave = registrants.slice(i, i + WAVE_SIZE)
        await Promise.all(wave.map(runOneUser))
      }
      const elapsedMs = Date.now() - startedAt

      // Verify zero overbooking and 100% counter accuracy using admin privileges
      await env.withSecurityRulesDisabled(async (ctx) => {
        const adminDb = ctx.firestore() as unknown as firestore.Firestore
        const [responsesSnap, countersSnap] = await Promise.all([
          firestore.getDocs(
            firestore.query(firestore.collection(adminDb, 'eventFormResponses'), firestore.where('formId', '==', FORM_ID))
          ),
          firestore.getDocs(
            firestore.query(firestore.collection(adminDb, 'eventFormSlotCounts'), firestore.where('formId', '==', FORM_ID))
          )
        ])

        assert.equal(responsesSnap.size, succeededCount, 'Persisted response count must equal succeeded submits')

        // Count actual responses per slot
        const actualPerSlot = new Map<string, number>()
        responsesSnap.docs.forEach(d => {
          const appt = d.data().answers?.q_appt
          const key = buildAppointmentSlotKey(appt.date, appt.slotId)
          actualPerSlot.set(key, (actualPerSlot.get(key) || 0) + 1)
        })

        // Verify EVERY counter matches actual responses and NEVER exceeds maxCapacity (25)
        countersSnap.docs.forEach(d => {
          const data = d.data()
          const actual = actualPerSlot.get(data.slotKey) || 0
          assert.ok(data.count <= 25, `Slot ${data.slotKey} overbooked: ${data.count} > 25`)
          assert.equal(data.count, actual, `Counter drift on ${data.slotKey}: counter=${data.count}, actual=${actual}`)
        })

        console.log('\n=== PAX TECUM 320-USER STRESS TEST METRICS ===')
        console.log(`Elapsed time:       ${elapsedMs} ms`)
        console.log(`Succeeded bookings: ${succeededCount}`)
        console.log(`Blocked (SlotFull): ${slotFullCount}`)
        console.log(`Contention aborts:  ${contentionErrorCount}`)
        console.log(`Total Reads:        ${totalReads} (Spark daily limit: 50,000 -> ${((totalReads / 50000) * 100).toFixed(1)}%)`)
        console.log(`Total Writes:       ${totalWrites} (Spark daily limit: 20,000 -> ${((totalWrites / 20000) * 100).toFixed(1)}%)`)
        console.log('==============================================\n')

        assert.ok(totalReads < 15000, `Expected < 15,000 reads for 320 users, got ${totalReads}`)
        assert.ok(totalWrites < 2000, `Expected < 2,000 writes for 320 users, got ${totalWrites}`)
      })
    })
  } finally {
    await env.cleanup()
  }
})
