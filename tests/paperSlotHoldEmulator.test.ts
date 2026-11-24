import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import * as firestore from 'firebase/firestore'
import {
  buildAppointmentSlotKey,
  buildSlotCountDocId,
  SlotFullError
} from '../src/utils/eventFormSlots.ts'

const PROJECT_ID = 'demo-mats-paper-hold-test'
const FORM_ID = 'paxTecumPaperTest0001'
const EVENT_ID = 'evt_pax_tecum_paper_test'
const QUESTION_ID = 'q_appt'
const SLOT_DATE = '2026-12-10'
const SLOT_ID = 'slot_1'
const MAX_CAPACITY = 3

test('Paper Form Slot Holds & Encode Paper Registration (Firestore Emulator)', {
  skip: !process.env.FIRESTORE_EMULATOR_HOST,
  timeout: 60000
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

  const slotKey = buildAppointmentSlotKey(SLOT_DATE, SLOT_ID)
  const docId = buildSlotCountDocId(FORM_ID, QUESTION_ID, 'appointment', slotKey)

  const seed = async () => {
    await env.clearFirestore()
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as unknown as firestore.Firestore
      await firestore.setDoc(firestore.doc(db, 'eventForms', FORM_ID), {
        eventId: EVENT_ID,
        title: 'Pax Tecum 2026 Paper Hold Test',
        status: 'published',
        isPublic: true,
        allowEditResponse: false,
        allowMultipleResponses: false,
        createdByUid: 'officer-1'
      })
    })
  }

  try {
    await t.test('end-to-end paper holds, public booking compatibility, rules protection, encode conversion, and release', async () => {
      await seed()

      const officerDb = env.authenticatedContext('officer-1', { email: 'officer@mats.test' }).firestore() as unknown as firestore.Firestore
      const anonDb = env.unauthenticatedContext().firestore() as unknown as firestore.Firestore

      const officerSlotRef = firestore.doc(officerDb, 'eventFormSlotCounts', docId)
      const anonSlotRef = firestore.doc(anonDb, 'eventFormSlotCounts', docId)

      // Helper mimicking adjustPaperSlotHold
      const adjustPaperHold = async (delta: 1 | -1) => {
        return firestore.runTransaction(officerDb, async (tx) => {
          const snap = await tx.get(officerSlotRef)
          const currentCount = snap.exists() ? Number(snap.data().count || 0) : 0
          const currentPaper = snap.exists() ? Number(snap.data().paperReservedCount || 0) : 0

          if (delta === 1 && currentCount + 1 > MAX_CAPACITY) {
            throw new Error('Slot is already full')
          }
          if (delta === -1 && currentPaper <= 0) {
            throw new Error('No paper holds to release')
          }

          const nextCount = Math.max(0, currentCount + delta)
          const nextPaper = Math.max(0, currentPaper + delta)

          tx.set(officerSlotRef, {
            formId: FORM_ID,
            questionId: QUESTION_ID,
            slotType: 'appointment',
            slotKey,
            count: nextCount,
            paperReservedCount: nextPaper,
            maxCapacity: MAX_CAPACITY,
            updatedAt: firestore.serverTimestamp()
          }, { merge: true })

          return { count: nextCount, paperReservedCount: nextPaper }
        })
      }

      // 1. Authenticated officer adds +1 Paper twice on a 3-capacity slot
      const hold1 = await assertSucceeds(adjustPaperHold(1))
      assert.deepEqual(hold1, { count: 1, paperReservedCount: 1 })

      const hold2 = await assertSucceeds(adjustPaperHold(1))
      assert.deepEqual(hold2, { count: 2, paperReservedCount: 2 })

      // 2. Unauthenticated public user attempts to mutate paperReservedCount -> DENIED
      await assertFails(
        firestore.updateDoc(anonSlotRef, {
          formId: FORM_ID,
          questionId: QUESTION_ID,
          slotType: 'appointment',
          slotKey,
          count: 3,
          paperReservedCount: 0,
          maxCapacity: MAX_CAPACITY,
          updatedAt: firestore.serverTimestamp()
        })
      )

      // 3. Unauthenticated public user books the 3rd slot (leaving paperReservedCount intact) -> SUCCEEDS
      await assertSucceeds(
        firestore.runTransaction(anonDb, async (tx) => {
          const snap = await tx.get(anonSlotRef)
          const currentCount = snap.exists() ? Number(snap.data().count || 0) : 0
          if (currentCount + 1 > MAX_CAPACITY) {
            throw new SlotFullError({
              docId,
              questionId: QUESTION_ID,
              questionText: 'Preferred Schedule',
              slotType: 'appointment',
              slotKey,
              slotLabel: 'Day 1 (08:00 AM - 09:30 AM)',
              maxCapacity: MAX_CAPACITY
            })
          }
          tx.update(anonSlotRef, {
            formId: FORM_ID,
            questionId: QUESTION_ID,
            slotType: 'appointment',
            slotKey,
            count: currentCount + 1,
            maxCapacity: MAX_CAPACITY,
            updatedAt: firestore.serverTimestamp()
          })
          const respRef = firestore.doc(firestore.collection(anonDb, 'eventFormResponses'))
          tx.set(respRef, {
            formId: FORM_ID,
            eventId: EVENT_ID,
            trackingNumber: 'FR-202611-10001',
            respondentMemberUid: '',
            respondentMemberName: 'Online Parishioner',
            respondentEmail: '',
            answers: {
              q_appt: { date: SLOT_DATE, slotId: SLOT_ID, timeRange: '08:00 AM - 09:30 AM' }
            },
            status: 'submitted',
            submittedAt: firestore.serverTimestamp(),
            updatedAt: firestore.serverTimestamp()
          })
        })
      )

      let snap = await firestore.getDoc(officerSlotRef)
      assert.equal(snap.data()?.count, 3)
      assert.equal(snap.data()?.paperReservedCount, 2)

      // 4. Unauthenticated public user attempts to book 4th seat -> BLOCKED by rules (count <= maxCapacity)
      await assertFails(
        firestore.updateDoc(anonSlotRef, {
          formId: FORM_ID,
          questionId: QUESTION_ID,
          slotType: 'appointment',
          slotKey,
          count: 4,
          maxCapacity: MAX_CAPACITY,
          updatedAt: firestore.serverTimestamp()
        })
      )

      // 5. Authenticated officer encodes 1 paper response -> paperReservedCount 2 -> 1, count stays 3 (zero double-count)
      let encodedResponseId = ''
      await assertSucceeds(
        firestore.runTransaction(officerDb, async (tx) => {
          const s = await tx.get(officerSlotRef)
          const currentCount = Number(s.data()?.count || 0)
          const currentPaper = Number(s.data()?.paperReservedCount || 0)
          assert.equal(currentCount, 3)
          assert.equal(currentPaper, 2)

          tx.set(officerSlotRef, {
            formId: FORM_ID,
            questionId: QUESTION_ID,
            slotType: 'appointment',
            slotKey,
            count: currentCount, // unchanged!
            paperReservedCount: currentPaper - 1,
            maxCapacity: MAX_CAPACITY,
            updatedAt: firestore.serverTimestamp()
          }, { merge: true })

          const respRef = firestore.doc(firestore.collection(officerDb, 'eventFormResponses'))
          encodedResponseId = respRef.id
          tx.set(respRef, {
            formId: FORM_ID,
            eventId: EVENT_ID,
            trackingNumber: 'FR-202611-10002',
            respondentMemberUid: '',
            respondentMemberName: 'Paper Household 1',
            respondentEmail: '',
            answers: {
              q_appt: { date: SLOT_DATE, slotId: SLOT_ID, timeRange: '08:00 AM - 09:30 AM' }
            },
            status: 'submitted',
            submissionSource: 'paper',
            encodedByUid: 'officer-1',
            encodedByName: 'Officer One',
            submittedAt: firestore.serverTimestamp(),
            updatedAt: firestore.serverTimestamp()
          })
        })
      )

      snap = await firestore.getDoc(officerSlotRef)
      assert.equal(snap.data()?.count, 3, 'Count must stay 3 when converting paper hold to encoded response')
      assert.equal(snap.data()?.paperReservedCount, 1, 'paperReservedCount must decrement from 2 to 1')

      const encodedRespSnap = await firestore.getDoc(firestore.doc(officerDb, 'eventFormResponses', encodedResponseId))
      assert.equal(encodedRespSnap.data()?.submissionSource, 'paper')
      assert.equal(encodedRespSnap.data()?.encodedByUid, 'officer-1')

      // 6. Authenticated officer releases -1 paper hold -> paperReservedCount 1 -> 0, count 3 -> 2 (1 seat reopened)
      const released = await assertSucceeds(adjustPaperHold(-1))
      assert.deepEqual(released, { count: 2, paperReservedCount: 0 })

      // Confirm reopened seat can now be booked by a public user
      await assertSucceeds(
        firestore.updateDoc(anonSlotRef, {
          formId: FORM_ID,
          questionId: QUESTION_ID,
          slotType: 'appointment',
          slotKey,
          count: 3,
          maxCapacity: MAX_CAPACITY,
          updatedAt: firestore.serverTimestamp()
        })
      )

      snap = await firestore.getDoc(officerSlotRef)
      assert.equal(snap.data()?.count, 3)
      assert.equal(snap.data()?.paperReservedCount, 0)
    })

    await t.test('blocks unauthenticated create with non-zero paperReservedCount', async () => {
      await seed()
      const anonDb = env.unauthenticatedContext().firestore() as unknown as firestore.Firestore
      const anonSlotRef = firestore.doc(anonDb, 'eventFormSlotCounts', docId)

      // Public create does NOT allow paperReservedCount key at all (hasOnly excludes it on create)
      await assertFails(
        firestore.setDoc(anonSlotRef, {
          formId: FORM_ID,
          questionId: QUESTION_ID,
          slotType: 'appointment',
          slotKey,
          count: 1,
          paperReservedCount: 1,
          maxCapacity: MAX_CAPACITY,
          updatedAt: firestore.serverTimestamp()
        })
      )
    })
  } finally {
    await env.cleanup()
  }
})
