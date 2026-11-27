import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc
} from 'firebase/firestore'
import { db } from '../firebase/config.ts'
import type { CalendarEvent, CalendarEventInput } from '../types/calendarEvent.ts'

const COLLECTION_NAME = 'calendarEvents'

function sanitizeInput(input: CalendarEventInput) {
  const title = input.title.trim()
  const startDate = input.startDate.trim()
  const endDate = input.endDate?.trim() || ''
  const startTime = input.startTime?.trim() || ''
  const endTime = input.endTime?.trim() || ''
  const location = input.location?.trim() || ''
  const notes = input.notes?.trim() || ''

  return {
    title,
    startDate,
    endDate: endDate && endDate >= startDate ? endDate : '',
    startTime,
    endTime,
    location,
    notes
  }
}

export const calendarEventService = {
  async getCalendarEvents(): Promise<CalendarEvent[]> {
    const snap = await getDocs(collection(db, COLLECTION_NAME))
    return snap.docs.map(d => ({
      id: d.id,
      ...d.data()
    })) as CalendarEvent[]
  },

  async createCalendarEvent(
    input: CalendarEventInput,
    actor: { uid: string; displayName: string }
  ): Promise<string> {
    const clean = sanitizeInput(input)
    if (!clean.title) throw new Error('Event title is required.')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(clean.startDate)) {
      throw new Error('Start date must be a valid YYYY-MM-DD date.')
    }

    const ref = await addDoc(collection(db, COLLECTION_NAME), {
      ...clean,
      createdByUid: actor.uid,
      createdByName: actor.displayName || 'Admin',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })
    return ref.id
  },

  async updateCalendarEvent(id: string, input: CalendarEventInput): Promise<void> {
    const clean = sanitizeInput(input)
    if (!clean.title) throw new Error('Event title is required.')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(clean.startDate)) {
      throw new Error('Start date must be a valid YYYY-MM-DD date.')
    }

    await updateDoc(doc(db, COLLECTION_NAME, id), {
      ...clean,
      updatedAt: serverTimestamp()
    })
  },

  async deleteCalendarEvent(id: string): Promise<void> {
    await deleteDoc(doc(db, COLLECTION_NAME, id))
  }
}
