import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  getDocs, 
  getDoc,
  serverTimestamp,
  deleteDoc,
  query,
  where,
  limit
} from 'firebase/firestore'
import { db } from '@/firebase/config'
import type { Event, EventOptionalModule } from '@/types/event'
import { auditService } from '@/services/auditService'

const EVENTS_COLLECTION = 'events'

export const eventService = {
  /**
   * Fetches all events. Can optionally include archived.
   */
  async getEvents(includeArchived: boolean = false): Promise<Event[]> {
    const eventsRef = collection(db, EVENTS_COLLECTION)
    const snapshot = await getDocs(eventsRef)
    let events = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Event[]
    
    if (!includeArchived) {
      events = events.filter(e => !e.isArchived)
    }
    
    // Sort by startDate descending (most recent first)
    events.sort((a, b) => {
      return (b.startDate || '').localeCompare(a.startDate || '')
    })
    
    return events
  },

  /**
   * Get a single event by ID
   */
  async getEventById(id: string): Promise<Event | null> {
    const docRef = doc(db, EVENTS_COLLECTION, id)
    const docSnap = await getDoc(docRef)
    if (!docSnap.exists()) return null
    return { id: docSnap.id, ...docSnap.data() } as Event
  },

  /**
   * Creates a new event
   */
  async createEvent(input: Omit<Event, 'id' | 'createdAt' | 'updatedAt' | 'isArchived'>, performedBy = 'System'): Promise<string> {
    const eventsRef = collection(db, EVENTS_COLLECTION)
    const docRef = await addDoc(eventsRef, {
      ...input,
      isArchived: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })

    await auditService.logAction(
      'EVENT_CREATE',
      'system',
      `Created event '${input.title}'`,
      performedBy,
      { eventId: docRef.id, title: input.title }
    )

    return docRef.id
  },

  /**
   * Updates an existing event
   */
  async updateEvent(id: string, input: Partial<Event>, performedBy = 'System'): Promise<void> {
    const docRef = doc(db, EVENTS_COLLECTION, id)
    const updateData = { ...input, updatedAt: serverTimestamp() }
    
    // Remove id if present to avoid writing it to document fields
    delete updateData.id
    delete updateData.createdAt // never update createdAt
    
    await updateDoc(docRef, updateData)

    await auditService.logAction(
      'EVENT_UPDATE',
      'system',
      `Updated event '${input.title || id}'`,
      performedBy,
      { eventId: id, updates: input }
    )
  },

  /**
   * Archives an event
   */
  async archiveEvent(id: string, performedBy = 'System'): Promise<void> {
    const docRef = doc(db, EVENTS_COLLECTION, id)
    await updateDoc(docRef, { isArchived: true, updatedAt: serverTimestamp() })
    await auditService.logAction(
      'EVENT_ARCHIVE',
      'system',
      `Archived event ID: ${id}`,
      performedBy,
      { eventId: id }
    )
  },
  
  /**
   * Deletes an event permanently (Caution!)
   */
  async deleteEvent(id: string, performedBy = 'System'): Promise<void> {
    const docRef = doc(db, EVENTS_COLLECTION, id)
    await deleteDoc(docRef)
    await auditService.logAction(
      'EVENT_DELETE',
      'system',
      `Permanently deleted event ID: ${id}`,
      performedBy,
      { eventId: id }
    )
  },

  /**
   * Checks which of the provided optional modules already have persisted records
   * for this event using minimal limit(1) Firestore queries.
   */
  async getModulesWithExistingData(
    eventId: string,
    modules: EventOptionalModule[]
  ): Promise<EventOptionalModule[]> {
    const collectionsByModule: Partial<Record<EventOptionalModule, string[]>> = {
      finance: ['eventIncome', 'eventExpenses', 'eventFundTransfers'],
      forms: ['eventForms'],
      requirements: ['eventRequirements'],
      contributions: ['eventContributions', 'eventContributionPurposes']
    }

    const checks = await Promise.all(
      modules.map(async (mod): Promise<EventOptionalModule | null> => {
        const colNames = collectionsByModule[mod]
        if (!colNames || colNames.length === 0) return null
        for (const colName of colNames) {
          const snap = await getDocs(
            query(collection(db, colName), where('eventId', '==', eventId), limit(1))
          )
          if (!snap.empty) {
            return mod
          }
        }
        return null
      })
    )

    return checks.filter((mod): mod is EventOptionalModule => mod !== null)
  }
}
