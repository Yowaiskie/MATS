import { 
  collection, 
  doc, 
  updateDoc, 
  getDoc, 
  getDocs, 
  onSnapshot,
  query, 
  orderBy, 
  serverTimestamp, 
  arrayUnion, 
  arrayRemove,
  runTransaction,
  type Transaction,
  type Firestore
} from 'firebase/firestore'
import type { SchedulePublication, SchedulePublicationInput, PublicationStatus } from '../types/publication.ts'
import type { AdminUserContext } from '../types/submission.ts'
import { getParishTodayDate } from '../utils/scheduleUtils.ts'
import { guardPublicationMutation, guardPublicationRangeEdit, integrityDoc, needsPublicationOverlapCheck, scheduleIntegrityService } from './scheduleIntegrityService.ts'

export interface PublicationLifecycleOptions {
  db?: Firestore
  transactionRunner?: <T>(fn: (transaction: any) => Promise<T>) => Promise<T>
}

const PUBLICATIONS_COLLECTION = 'schedulePublications'

let defaultDb: Firestore | null = null

export function setPublicationDb(firestoreInstance: Firestore) {
  defaultDb = firestoreInstance
}

async function getEffectiveDb(explicitDb?: Firestore): Promise<Firestore> {
  if (explicitDb) return explicitDb
  if (defaultDb) return defaultDb
  try {
    const config = await import('../firebase/config.ts')
    defaultDb = config.db
    return defaultDb
  } catch {
    throw new Error('Firestore database instance is not available.')
  }
}

function doesSnapshotExist(snap: any): boolean {
  if (!snap) return false
  return typeof snap.exists === 'function' ? snap.exists() : Boolean(snap.exists)
}

function getDocumentRef(firestoreInstance: any, collectionPath: string, docId: string): any {
  if (firestoreInstance && !firestoreInstance.app && typeof firestoreInstance.doc === 'function') {
    return firestoreInstance.doc(collectionPath, docId)
  }
  return doc(firestoreInstance, collectionPath, docId)
}

function createNewDocumentRef(firestoreInstance: any, collectionPath: string): any {
  const autoId = `audit_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
  if (firestoreInstance && !firestoreInstance.app && typeof firestoreInstance.doc === 'function') {
    return firestoreInstance.doc(collectionPath, autoId)
  }
  return doc(collection(firestoreInstance, collectionPath))
}

function getCollectionRef(firestoreInstance: any, collectionPath: string): any {
  if (firestoreInstance && typeof firestoreInstance.collection === 'function') {
    return firestoreInstance.collection(collectionPath)
  }
  return collection(firestoreInstance, collectionPath)
}

async function getDocument(firestoreInstance: any, collectionPath: string, docId: string): Promise<any> {
  if (firestoreInstance && typeof firestoreInstance.getDoc === 'function') {
    return firestoreInstance.getDoc(collectionPath, docId)
  }
  const docRef = getDocumentRef(firestoreInstance, collectionPath, docId)
  return getDoc(docRef)
}

function writePublicationAudit(
  firestoreInstance: Firestore,
  transaction: Transaction,
  action: 'SCHEDULE_CREATE' | 'SCHEDULE_UPDATE' | 'SCHEDULE_DELETE',
  description: string,
  performedBy: string,
  details: Record<string, unknown>
): void {
  transaction.set(createNewDocumentRef(firestoreInstance, 'auditLogs'), {
    action, category: 'schedule', description, performedBy, timestamp: serverTimestamp(),
    details: JSON.parse(JSON.stringify(details))
  })
}

/**
 * Parses a deadline string (ISO or local) to epoch milliseconds.
 */
export function parseDeadlineMs(deadline?: string): number | null {
  if (!deadline || !deadline.trim()) return null
  const parsed = new Date(deadline.trim())
  const ms = parsed.getTime()
  return isNaN(ms) ? null : ms
}

/**
 * Checks whether an actor context has permission to manage publication lifecycle.
 */
export function checkAdminPublicationPermission(adminUser?: AdminUserContext | string): string {
  if (!adminUser) return 'System'
  if (typeof adminUser === 'string') return adminUser

  const isAuthorized =
    adminUser.role === 'admin' ||
    adminUser.role === 'coordinator' ||
    adminUser.permissions?.canManageSchedules === true

  if (!isAuthorized) {
    throw new Error('Unauthorized: User does not have permission to manage publication lifecycle.')
  }
  return adminUser.email || adminUser.uid || 'Admin'
}

function parseLifecycleOptions(options?: PublicationLifecycleOptions | Firestore): {
  explicitDb?: Firestore
  transactionRunner?: <T>(fn: (transaction: any) => Promise<T>) => Promise<T>
} {
  if (!options) return {}
  if ('collection' in options || 'doc' in options) {
    return { explicitDb: options as Firestore }
  }
  const typed = options as PublicationLifecycleOptions
  return {
    explicitDb: typed.db,
    transactionRunner: typed.transactionRunner
  }
}

async function executeLifecycleTransaction<T>(
  firestoreInstance: any,
  transactionRunner: ((fn: any) => Promise<T>) | undefined,
  updateFn: (transaction: any) => Promise<T>
): Promise<T> {
  if (transactionRunner) {
    return transactionRunner(updateFn)
  }
  if (typeof firestoreInstance?.runTransaction === 'function') {
    return firestoreInstance.runTransaction(updateFn)
  }
  return runTransaction(firestoreInstance, updateFn)
}

export const publicationService = {
  setPublicationDb,

  /**
   * Retrieves all publications sorted chronologically by startDate.
   */
  async getPublications(db?: Firestore): Promise<SchedulePublication[]> {
    const firestoreInstance = await getEffectiveDb(db)
    const pubRef = getCollectionRef(firestoreInstance, PUBLICATIONS_COLLECTION)
    const q = query(pubRef, orderBy('startDate', 'desc'))
    const snapshot = await getDocs(q)
    return snapshot.docs.map((d: any) => ({
      id: d.id,
      ...d.data()
    })) as SchedulePublication[]
  },

  /**
   * Retrieves a single publication by ID.
   */
  async getPublication(id: string, db?: Firestore): Promise<SchedulePublication | null> {
    const firestoreInstance = await getEffectiveDb(db)
    const docSnap = await getDocument(firestoreInstance, PUBLICATIONS_COLLECTION, id)
    if (!docSnap || !doesSnapshotExist(docSnap)) return null
    return { id: docSnap.id, ...docSnap.data() } as SchedulePublication
  },

  /**
   * Subscribes to real-time updates for a single publication document.
   */
  subscribeToPublication(
    id: string,
    onUpdate: (pub: SchedulePublication | null) => void,
    onError?: (err: Error) => void,
    db?: Firestore
  ): () => void {
    let unsubscribed = false
    let innerUnsub: (() => void) | null = null

    getEffectiveDb(db)
      .then(firestoreInstance => {
        if (unsubscribed) return
        const docRef = getDocumentRef(firestoreInstance, PUBLICATIONS_COLLECTION, id)
        innerUnsub = onSnapshot(
          docRef,
          (docSnap: any) => {
            if (unsubscribed) return
            if (!docSnap || !doesSnapshotExist(docSnap)) {
              onUpdate(null)
              return
            }
            onUpdate({ id: docSnap.id, ...docSnap.data() } as SchedulePublication)
          },
          (err: Error) => {
            if (!unsubscribed && onError) onError(err)
          }
        )
      })
      .catch(err => {
        if (!unsubscribed && onError) onError(err)
      })

    return () => {
      unsubscribed = true
      if (innerUnsub) innerUnsub()
    }
  },

  /**
   * Subscribes to real-time updates for all publications sorted chronologically by startDate.
   */
  subscribeToPublications(
    onUpdate: (pubs: SchedulePublication[]) => void,
    onError?: (err: Error) => void,
    db?: Firestore
  ): () => void {
    let unsubscribed = false
    let innerUnsub: (() => void) | null = null

    getEffectiveDb(db)
      .then(firestoreInstance => {
        if (unsubscribed) return
        const pubRef = getCollectionRef(firestoreInstance, PUBLICATIONS_COLLECTION)
        const q = query(pubRef, orderBy('startDate', 'desc'))
        innerUnsub = onSnapshot(
          q,
          (snapshot: any) => {
            if (unsubscribed) return
            const list = snapshot.docs.map((d: any) => ({
              id: d.id,
              ...d.data()
            })) as SchedulePublication[]
            onUpdate(list)
          },
          (err: Error) => {
            if (!unsubscribed && onError) onError(err)
          }
        )
      })
      .catch(err => {
        if (!unsubscribed && onError) onError(err)
      })

    return () => {
      unsubscribed = true
      if (innerUnsub) innerUnsub()
    }
  },

  /**
   * Retrieves the currently active published publication.
   * By default (currentOnly: true), only returns a published publication whose date range spans today's parish date.
   * If allowFuture is true, falls back to future published publications when none span today.
   */
  async getActivePublication(options: { 
    regularOnly?: boolean; 
    db?: Firestore; 
    allowFuture?: boolean;
    currentDate?: string;
  } = {}): Promise<SchedulePublication | null> {
    const publications = await this.getPublications(options.db)
    const list = options.regularOnly
      ? publications.filter(publication => publication.publicationType !== 'special_event')
      : publications
    if (list.length === 0) return null

    // 1. Find published publications
    const published = list.filter(p => p.status === 'published')
    const today = options.currentDate || getParishTodayDate('Asia/Manila')

    if (published.length > 0) {
      // Prioritize regular cycle publication spanning today's date
      const regularCurrent = published.find(p => p.publicationType !== 'special_event' && p.startDate <= today && today <= p.endDate)
      if (regularCurrent) return regularCurrent

      const current = published.find(p => p.startDate <= today && today <= p.endDate)
      if (current) return current

      if (options.allowFuture) {
        return published[0]
      }
      return null
    }

    // 2. Fallback to any publication spanning today
    const currentAny = list.find(p => p.startDate <= today && today <= p.endDate)
    if (currentAny) return currentAny

    if (options.allowFuture) {
      return list[0]
    }
    return null
  },

  /**
   * Adds a new publication.
   */
  async addPublication(input: SchedulePublicationInput, performedBy = 'System', db?: Firestore): Promise<string> {
    const firestoreInstance = await getEffectiveDb(db)
    const deadlineMs = input.submissionDeadlineMs ?? parseDeadlineMs(input.submissionDeadline)

    const docRef = createNewDocumentRef(firestoreInstance, PUBLICATIONS_COLLECTION)
    const publicationData = {
      name: input.name.trim(),
      startDate: input.startDate,
      endDate: input.endDate,
      status: input.status || 'draft',
      publicationType: input.publicationType || 'regular',
      description: input.description?.trim() || '',
      submissionDeadline: input.submissionDeadline || '',
      submissionDeadlineMs: deadlineMs ?? null,
      maxSundaysPerServer: input.maxSundaysPerServer ?? 4,
      maxWeekdaysPerServer: input.maxWeekdaysPerServer ?? 8,
      maxSpecialPerServer: input.maxSpecialPerServer ?? 2,
      maxServersPerSundaySlot: input.maxServersPerSundaySlot ?? 5,
      maxServersPerWeekdaySlot: input.maxServersPerWeekdaySlot ?? 5,
      maxServersPerSpecialSlot: input.maxServersPerSpecialSlot ?? 6,
      enableRankQuotas: input.enableRankQuotas ?? false,
      rankSlotQuotas: input.rankSlotQuotas || {},
      sundayRankQuotas: input.sundayRankQuotas || {},
      weekdayRankQuotas: input.weekdayRankQuotas || {},
      specialRankQuotas: input.specialRankQuotas || {},
      includeSundays: input.includeSundays ?? true,
      includeWeekdays: input.includeWeekdays ?? true,
      includeHolyHour: input.includeHolyHour ?? false,
      includeMeetings: input.includeMeetings ?? false,
      includeSpecialEvents: input.includeSpecialEvents ?? (input.publicationType === 'special_event'),
      includedDaysOfWeek: input.includedDaysOfWeek || [],
      enableStreetLocation: input.enableStreetLocation ?? false,
      liturgicalColor: input.liturgicalColor || '',
      customExcludedKeywords: input.customExcludedKeywords || [],
      allowedRanks: input.allowedRanks || ['Chevaliers', 'Paladins'],
      warningAbsenceThreshold: input.warningAbsenceThreshold ?? 3,
      suspensionAbsenceThreshold: input.suspensionAbsenceThreshold ?? 5,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }
    await executeLifecycleTransaction<void>(firestoreInstance, undefined, async transaction => {
      await guardPublicationMutation(firestoreInstance, transaction, { ...publicationData, id: docRef.id } as SchedulePublication)
      transaction.set(docRef, publicationData)
      writePublicationAudit(firestoreInstance, transaction, 'SCHEDULE_CREATE',
        `Created publication '${input.name}' (${input.publicationType === 'special_event' ? 'Special Occasion' : 'Regular Cycle'})`,
        performedBy, { publicationId: docRef.id, input })
    })

    return docRef.id
  },

  /**
   * Updates publication details.
   */
  async updatePublication(
    id: string, 
    input: Partial<SchedulePublicationInput>, 
    performedBy = 'System',
    db?: Firestore
  ): Promise<void> {
    const firestoreInstance = await getEffectiveDb(db)
    const updateData: any = {
      updatedAt: serverTimestamp()
    }

    if (input.name !== undefined) updateData.name = input.name.trim()
    if (input.startDate !== undefined) updateData.startDate = input.startDate
    if (input.endDate !== undefined) updateData.endDate = input.endDate
    if (input.status !== undefined) updateData.status = input.status
    if (input.publicationType !== undefined) updateData.publicationType = input.publicationType
    if (input.description !== undefined) updateData.description = input.description.trim()
    if (input.submissionDeadline !== undefined) {
      updateData.submissionDeadline = input.submissionDeadline || ''
      updateData.submissionDeadlineMs = parseDeadlineMs(input.submissionDeadline)
    }
    if (input.submissionDeadlineMs !== undefined) updateData.submissionDeadlineMs = input.submissionDeadlineMs
    if (input.maxSundaysPerServer !== undefined) updateData.maxSundaysPerServer = input.maxSundaysPerServer
    if (input.maxWeekdaysPerServer !== undefined) updateData.maxWeekdaysPerServer = input.maxWeekdaysPerServer
    if (input.maxSpecialPerServer !== undefined) updateData.maxSpecialPerServer = input.maxSpecialPerServer
    if (input.maxServersPerSundaySlot !== undefined) updateData.maxServersPerSundaySlot = input.maxServersPerSundaySlot
    if (input.maxServersPerWeekdaySlot !== undefined) updateData.maxServersPerWeekdaySlot = input.maxServersPerWeekdaySlot
    if (input.maxServersPerSpecialSlot !== undefined) updateData.maxServersPerSpecialSlot = input.maxServersPerSpecialSlot
    if (input.enableRankQuotas !== undefined) updateData.enableRankQuotas = input.enableRankQuotas
    if (input.rankSlotQuotas !== undefined) updateData.rankSlotQuotas = input.rankSlotQuotas
    if (input.sundayRankQuotas !== undefined) updateData.sundayRankQuotas = input.sundayRankQuotas
    if (input.weekdayRankQuotas !== undefined) updateData.weekdayRankQuotas = input.weekdayRankQuotas
    if (input.specialRankQuotas !== undefined) updateData.specialRankQuotas = input.specialRankQuotas
    if (input.includeSundays !== undefined) updateData.includeSundays = input.includeSundays
    if (input.includeWeekdays !== undefined) updateData.includeWeekdays = input.includeWeekdays
    if (input.includeHolyHour !== undefined) updateData.includeHolyHour = input.includeHolyHour
    if (input.includeMeetings !== undefined) updateData.includeMeetings = input.includeMeetings
    if (input.includeSpecialEvents !== undefined) updateData.includeSpecialEvents = input.includeSpecialEvents
    if (input.includedDaysOfWeek !== undefined) updateData.includedDaysOfWeek = input.includedDaysOfWeek
    if (input.enableStreetLocation !== undefined) updateData.enableStreetLocation = input.enableStreetLocation
    if (input.liturgicalColor !== undefined) updateData.liturgicalColor = input.liturgicalColor
    if (input.customExcludedKeywords !== undefined) updateData.customExcludedKeywords = input.customExcludedKeywords
    if (input.allowedRanks !== undefined) updateData.allowedRanks = input.allowedRanks
    if (input.warningAbsenceThreshold !== undefined) updateData.warningAbsenceThreshold = input.warningAbsenceThreshold
    if (input.suspensionAbsenceThreshold !== undefined) updateData.suspensionAbsenceThreshold = input.suspensionAbsenceThreshold

    await executeLifecycleTransaction<void>(firestoreInstance, undefined, async transaction => {
      const publicationRef = integrityDoc(firestoreInstance, PUBLICATIONS_COLLECTION, id)
      const snapshot = await transaction.get(publicationRef)
      if (!doesSnapshotExist(snapshot)) throw new Error(`Publication '${id}' not found.`)
      const current = { ...snapshot.data(), id } as SchedulePublication
      const next = { ...current, ...updateData } as SchedulePublication
      if (needsPublicationOverlapCheck(current, next)) await guardPublicationRangeEdit(firestoreInstance, current, next)
      await guardPublicationMutation(firestoreInstance, transaction, next, needsPublicationOverlapCheck(current, next))
      transaction.update(publicationRef, updateData)
      writePublicationAudit(firestoreInstance, transaction, 'SCHEDULE_UPDATE',
        `Updated publication details for ID: ${id} (${input.name || ''})`, performedBy, { publicationId: id, updates: input })
    })
  },

  /**
   * Deletes a publication.
   */
  async deletePublication(id: string, performedBy = 'System', db?: Firestore): Promise<void> {
    const firestoreInstance = await getEffectiveDb(db)
    await executeLifecycleTransaction<void>(firestoreInstance, undefined, async transaction => {
      const publicationRef = integrityDoc(firestoreInstance, PUBLICATIONS_COLLECTION, id)
      const snapshot = await transaction.get(publicationRef)
      if (!doesSnapshotExist(snapshot)) throw new Error(`Publication '${id}' not found.`)
      const current = { ...snapshot.data(), id } as SchedulePublication
      await scheduleIntegrityService.assertDeletable(firestoreInstance, current)
      await guardPublicationMutation(firestoreInstance, transaction, current, false)
      transaction.delete(publicationRef)
      writePublicationAudit(firestoreInstance, transaction, 'SCHEDULE_DELETE',
        `Deleted publication with ID: ${id}`, performedBy, { publicationId: id })
    })
  },

  /**
   * Extends the submission deadline for a publication using Firestore runTransaction.
   * Validates status preconditions, preserves all unrelated fields, and atomically records an audit log.
   */
  async extendPublicationDeadline(
    id: string,
    newDeadline: string,
    adminUser?: AdminUserContext | string,
    reason?: string,
    options?: PublicationLifecycleOptions | Firestore
  ): Promise<void> {
    const actor = checkAdminPublicationPermission(adminUser)
    const newDeadlineMs = parseDeadlineMs(newDeadline)
    if (newDeadlineMs === null) {
      throw new Error(`Invalid deadline timestamp: ${newDeadline}`)
    }
    if (newDeadlineMs <= Date.now()) {
      throw new Error(`New deadline must be in the future. Received: ${newDeadline}`)
    }

    const { explicitDb, transactionRunner } = parseLifecycleOptions(options)
    const firestoreInstance = await getEffectiveDb(explicitDb)
    const pubRef = getDocumentRef(firestoreInstance, PUBLICATIONS_COLLECTION, id)

    await executeLifecycleTransaction<void>(firestoreInstance, transactionRunner, async (transaction: any) => {
      const pubSnap = await transaction.get(pubRef)
      if (!pubSnap || !doesSnapshotExist(pubSnap)) {
        throw new Error(`Publication '${id}' not found.`)
      }
      const current = pubSnap.data() as SchedulePublication

      if (current.status === 'archived') {
        throw new Error(`Cannot extend deadline on an archived publication without reopening first. Current status: ${current.status}`)
      }

      const updateData = {
        submissionDeadline: newDeadline,
        submissionDeadlineMs: newDeadlineMs,
        updatedAt: serverTimestamp()
      }

      transaction.update(pubRef, updateData)

      // Atomically create audit log within the same transaction
      const auditDocRef = createNewDocumentRef(firestoreInstance, 'auditLogs')
      transaction.set(auditDocRef, {
        action: 'SCHEDULE_UPDATE',
        category: 'schedule',
        description: `Extended submission deadline for publication ID: ${id} to ${newDeadline}${reason ? ` (${reason})` : ''}`,
        performedBy: actor,
        timestamp: serverTimestamp(),
        details: {
          publicationId: id,
          lifecycleAction: 'extend_deadline',
          newDeadline,
          newDeadlineMs,
          reason: reason || null,
          before: {
            status: current.status,
            submissionDeadline: current.submissionDeadline || null,
            submissionDeadlineMs: current.submissionDeadlineMs ?? null
          },
          after: {
            status: current.status,
            submissionDeadline: newDeadline,
            submissionDeadlineMs: newDeadlineMs
          }
        }
      })
    })
  },

  /**
   * Closes submissions early for a publication by atomically updating the deadline to the current timestamp
   * and recording an audit log within the same transaction.
   * Requires an active 'published' publication.
   */
  async closeSubmissionsEarly(
    id: string,
    adminUser?: AdminUserContext | string,
    reason?: string,
    options?: PublicationLifecycleOptions | Firestore
  ): Promise<void> {
    const actor = checkAdminPublicationPermission(adminUser)
    const { explicitDb, transactionRunner } = parseLifecycleOptions(options)
    const firestoreInstance = await getEffectiveDb(explicitDb)
    const pubRef = getDocumentRef(firestoreInstance, PUBLICATIONS_COLLECTION, id)

    const nowIso = new Date().toISOString()
    const nowMs = Date.now()

    await executeLifecycleTransaction<void>(firestoreInstance, transactionRunner, async (transaction: any) => {
      const pubSnap = await transaction.get(pubRef)
      if (!pubSnap || !doesSnapshotExist(pubSnap)) {
        throw new Error(`Publication '${id}' not found.`)
      }
      const current = pubSnap.data() as SchedulePublication

      if (current.status === 'archived') {
        throw new Error(`Cannot close submissions on an archived publication. Current status: ${current.status}`)
      }
      if (current.status !== 'published') {
        throw new Error(`Cannot close submissions on non-published publication. Current status: ${current.status}`)
      }

      const updateData = {
        submissionDeadline: nowIso,
        submissionDeadlineMs: nowMs,
        updatedAt: serverTimestamp()
      }

      transaction.update(pubRef, updateData)

      // Atomically create audit log within the same transaction
      const auditDocRef = createNewDocumentRef(firestoreInstance, 'auditLogs')
      transaction.set(auditDocRef, {
        action: 'SCHEDULE_UPDATE',
        category: 'schedule',
        description: `Closed submissions early for publication ID: ${id}${reason ? ` (${reason})` : ''}`,
        performedBy: actor,
        timestamp: serverTimestamp(),
        details: {
          publicationId: id,
          lifecycleAction: 'close_early',
          closedAt: nowIso,
          closedAtMs: nowMs,
          reason: reason || null,
          before: {
            status: current.status,
            submissionDeadline: current.submissionDeadline || null,
            submissionDeadlineMs: current.submissionDeadlineMs ?? null
          },
          after: {
            status: current.status,
            submissionDeadline: nowIso,
            submissionDeadlineMs: nowMs
          }
        }
      })
    })
  },

  /**
   * Reopens an archived or closed publication with a new submission deadline using Firestore runTransaction,
   * atomically creating an audit log within the transaction.
   */
  async reopenPublication(
    id: string,
    newDeadline: string,
    adminUser?: AdminUserContext | string,
    reason?: string,
    options?: PublicationLifecycleOptions | Firestore
  ): Promise<void> {
    const actor = checkAdminPublicationPermission(adminUser)
    const newDeadlineMs = parseDeadlineMs(newDeadline)
    if (newDeadlineMs === null) {
      throw new Error(`Invalid deadline timestamp: ${newDeadline}`)
    }
    if (newDeadlineMs <= Date.now()) {
      throw new Error(`Reopened deadline must be in the future. Received: ${newDeadline}`)
    }

    const { explicitDb, transactionRunner } = parseLifecycleOptions(options)
    const firestoreInstance = await getEffectiveDb(explicitDb)
    const pubRef = getDocumentRef(firestoreInstance, PUBLICATIONS_COLLECTION, id)

    await executeLifecycleTransaction<void>(firestoreInstance, transactionRunner, async (transaction: any) => {
      const pubSnap = await transaction.get(pubRef)
      if (!pubSnap || !doesSnapshotExist(pubSnap)) {
        throw new Error(`Publication '${id}' not found.`)
      }
      const current = pubSnap.data() as SchedulePublication

      if (
        current.status === 'published' &&
        current.submissionDeadlineMs != null &&
        current.submissionDeadlineMs > Date.now() &&
        current.submissionDeadline === newDeadline
      ) {
        throw new Error(`Publication is already active and published with this deadline.`)
      }

      const updateData = {
        status: 'published' as const,
        submissionDeadline: newDeadline,
        submissionDeadlineMs: newDeadlineMs,
        updatedAt: serverTimestamp()
      }

      await guardPublicationMutation(firestoreInstance, transaction, { ...current, id, ...updateData }, current.status === 'archived')
      transaction.update(pubRef, updateData)

      // Atomically create audit log within the same transaction
      const auditDocRef = createNewDocumentRef(firestoreInstance, 'auditLogs')
      transaction.set(auditDocRef, {
        action: 'SCHEDULE_UPDATE',
        category: 'schedule',
        description: `Reopened publication ID: ${id} until ${newDeadline}${reason ? ` (${reason})` : ''}`,
        performedBy: actor,
        timestamp: serverTimestamp(),
        details: {
          publicationId: id,
          lifecycleAction: 'reopen',
          status: 'published',
          newDeadline,
          newDeadlineMs,
          reason: reason || null,
          before: {
            status: current.status,
            submissionDeadline: current.submissionDeadline || null,
            submissionDeadlineMs: current.submissionDeadlineMs ?? null
          },
          after: {
            status: 'published',
            submissionDeadline: newDeadline,
            submissionDeadlineMs: newDeadlineMs
          }
        }
      })
    })
  },

  /**
   * Atomically transitions publication status (draft -> published -> archived -> published) via runTransaction,
   * creating an audit log in the same atomic commit.
   */
  async updatePublicationStatus(
    id: string,
    newStatus: PublicationStatus,
    adminUser?: AdminUserContext | string,
    reasonOrOptions?: string | PublicationLifecycleOptions | Firestore,
    options?: PublicationLifecycleOptions | Firestore
  ): Promise<void> {
    const actor = checkAdminPublicationPermission(adminUser)
    const reason = typeof reasonOrOptions === 'string' ? reasonOrOptions : undefined
    const effectiveOptions = typeof reasonOrOptions !== 'string' ? reasonOrOptions : options
    const { explicitDb, transactionRunner } = parseLifecycleOptions(effectiveOptions)
    const firestoreInstance = await getEffectiveDb(explicitDb)
    const pubRef = getDocumentRef(firestoreInstance, PUBLICATIONS_COLLECTION, id)

    await executeLifecycleTransaction<void>(firestoreInstance, transactionRunner, async (transaction: any) => {
      const pubSnap = await transaction.get(pubRef)
      if (!pubSnap || !doesSnapshotExist(pubSnap)) {
        throw new Error(`Publication '${id}' not found.`)
      }
      const current = pubSnap.data() as SchedulePublication

      if (current.status === newStatus) {
        throw new Error(`Publication is already in status '${newStatus}'.`)
      }

      if (newStatus === 'published' && current.submissionDeadlineMs != null && current.submissionDeadlineMs <= Date.now()) {
        throw new Error(`Cannot transition to published with an expired deadline. Use reopenPublication with a new future deadline.`)
      }

      const updateData = {
        status: newStatus,
        updatedAt: serverTimestamp()
      }

      await guardPublicationMutation(firestoreInstance, transaction, { ...current, id, ...updateData }, current.status === 'archived')
      transaction.update(pubRef, updateData)

      // Atomically create audit log within the same transaction
      const auditDocRef = createNewDocumentRef(firestoreInstance, 'auditLogs')
      transaction.set(auditDocRef, {
        action: 'SCHEDULE_UPDATE',
        category: 'schedule',
        description: `Updated publication status for ID: ${id} to ${newStatus}${reason ? ` (${reason})` : ''}`,
        performedBy: actor,
        timestamp: serverTimestamp(),
        details: {
          publicationId: id,
          lifecycleAction: 'status_change',
          beforeStatus: current.status,
          newStatus,
          reason: reason || null,
          before: { status: current.status },
          after: { status: newStatus }
        }
      })
    })
  },

  /**
   * Marks a member as having submitted their schedule for this publication.
   */
  async markMemberSubmitted(publicationId: string, memberId: string, db?: Firestore): Promise<void> {
    const firestoreInstance = await getEffectiveDb(db)
    const docRef = getDocumentRef(firestoreInstance, PUBLICATIONS_COLLECTION, publicationId)
    await updateDoc(docRef, {
      submittedMembers: arrayUnion(memberId),
      updatedAt: serverTimestamp()
    })
  },

  /**
   * Marks multiple members as having submitted their schedules for this publication.
   */
  async markMembersSubmitted(publicationId: string, memberIds: string[], db?: Firestore): Promise<void> {
    if (memberIds.length === 0) return
    const firestoreInstance = await getEffectiveDb(db)
    const docRef = getDocumentRef(firestoreInstance, PUBLICATIONS_COLLECTION, publicationId)
    await updateDoc(docRef, {
      // @ts-ignore - Firestore arrayUnion accepts multiple arguments via spread
      submittedMembers: arrayUnion(...memberIds),
      updatedAt: serverTimestamp()
    })
  },

  /**
   * Resets submission status for multiple members, allowing them to submit again.
   */
  async resetMembersSubmission(publicationId: string, memberIds: string[], db?: Firestore): Promise<void> {
    if (memberIds.length === 0) return
    const firestoreInstance = await getEffectiveDb(db)
    const docRef = getDocumentRef(firestoreInstance, PUBLICATIONS_COLLECTION, publicationId)
    await updateDoc(docRef, {
      // @ts-ignore - Firestore arrayRemove accepts multiple arguments via spread
      submittedMembers: arrayRemove(...memberIds),
      updatedAt: serverTimestamp()
    })
  }
}
