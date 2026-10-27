import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  setDoc,
  runTransaction,
  serverTimestamp,
  type Firestore,
  type Transaction
} from 'firebase/firestore'
import {
  type ScheduleSubmission,
  type RequestedSlotSummary,
  type CreateSubmissionInput,
  type ApproveSubmissionOptions,
  type RejectSubmissionOptions,
  type ApprovalResult,
  type RejectionResult,
  type AdminUserContext,
  SubmissionError
} from '../types/submission.ts'
import type { SchedulePublication } from '../types/publication.ts'
import type { Member } from '../types/member.ts'
import type { Schedule } from '../types/schedule.ts'
import {
  isMemberEligibleForPublication,
  isPublicationDeadlinePassed,
  isScheduleIncludedInPublication,
  isSundayOrAnticipatedMass,
  isSpecialEventOrService,
  isHistoricalScheduleOccurrence,
  isTimeOverlapping,
  getParishTodayDate
} from '../utils/scheduleUtils.ts'

export const SUBMISSIONS_COLLECTION = 'scheduleSubmissions'

let defaultDb: Firestore | null = null

export function setSubmissionDb(firestoreInstance: Firestore) {
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

/**
 * Returns a deterministic submission ID: `${publicationId}_${memberId}`.
 */
export function getSubmissionId(publicationId: string, memberId: string): string {
  if (!publicationId || !memberId) {
    throw new Error('Both publicationId and memberId are required to generate submission ID.')
  }
  return `${publicationId}_${memberId}`
}

export interface SubmissionValidationContext {
  publication: SchedulePublication
  member: Member
  publicationSchedules?: Schedule[]
  serverTime?: number | Date
}

/**
 * Pure application-layer validation of submission input against business rules.
 */

function getDocumentRef(firestoreInstance: any, collectionPath: string, docId: string): any {
  if (firestoreInstance && typeof firestoreInstance.doc === 'function') {
    return firestoreInstance.doc(collectionPath, docId);
  }
  return doc(firestoreInstance, collectionPath, docId);
}

async function getDocument(firestoreInstance: any, collectionPath: string, docId: string): Promise<any> {
  if (firestoreInstance && typeof firestoreInstance.getDoc === 'function') {
    return firestoreInstance.getDoc(collectionPath, docId);
  }
  const docRef = getDocumentRef(firestoreInstance, collectionPath, docId);
  return getDoc(docRef);
}

async function setDocument(firestoreInstance: any, collectionPath: string, docId: string, data: any): Promise<void> {
  if (firestoreInstance && typeof firestoreInstance.setDoc === 'function') {
    return firestoreInstance.setDoc(collectionPath, docId, data);
  }
  const docRef = getDocumentRef(firestoreInstance, collectionPath, docId);
  return setDoc(docRef, data);
}

function verifyAdminPermissions(adminUser?: AdminUserContext): void {
  if (!adminUser) return
  const isAuthorized =
    adminUser.role === 'admin' ||
    adminUser.role === 'coordinator' ||
    adminUser.permissions?.canManageSchedules === true

  if (!isAuthorized) {
    throw new SubmissionError(
      'PERMISSION_DENIED',
      'Unauthorized: User does not have permission to manage schedule submissions.'
    )
  }
}

async function safeLogAudit(
  action: any,
  category: any,
  description: string,
  performedBy: string,
  details?: any
): Promise<void> {
  try {
    const { auditService } = await import('./auditService.ts')
    await auditService.logAction(action, category, description, performedBy, details)
  } catch {
    // Audit logging is non-blocking in offline or test harness environments
  }
}

export function validateSubmission(
  input: CreateSubmissionInput,
  context: SubmissionValidationContext
): void {
  const { publication, member, publicationSchedules } = context

  if (!input.publicationId || input.publicationId !== publication.id) {
    throw new Error('Publication ID mismatch.')
  }

  if (!input.memberId || input.memberId !== member.id) {
    throw new Error('Member ID mismatch.')
  }

  if (publication.status !== 'published') {
    throw new SubmissionError(
      'PUBLICATION_CLOSED',
      'Submissions are closed for this publication because it is not currently published.'
    )
  }

  if (isPublicationDeadlinePassed(publication, context.serverTime)) {
    throw new SubmissionError(
      'PUBLICATION_CLOSED',
      'The submission deadline for this publication has passed. Submissions are no longer accepted.'
    )
  }

  // Member eligibility check
  const isEligible = isMemberEligibleForPublication(member, publication, true)
  if (!isEligible) {
    throw new Error('Altar server is not eligible for this publication based on rank or status.')
  }

  const isSpecialPub =
    publication.publicationType === 'special_event' ||
    !!publication.enableStreetLocation ||
    (publication.includedDaysOfWeek && publication.includedDaysOfWeek.length > 0)

  if (member.status === 'suspended' && !isSpecialPub) {
    throw new Error('Your serving privileges are currently SUSPENDED. You cannot submit Mass schedules.')
  }

  if (!Array.isArray(input.requestedScheduleIds) || input.requestedScheduleIds.length === 0) {
    throw new Error('Please select at least one schedule slot before submitting.')
  }

  if (input.requestedScheduleIds.length > 50) {
    throw new Error('A submission cannot exceed 50 requested schedule slots.')
  }

  if (input.requestedScheduleIds.some(id => typeof id !== 'string' || !id.trim())) {
    throw new Error('Each requested schedule must have a valid ID.')
  }

  if (input.slotSummaries !== undefined) {
    if (!Array.isArray(input.slotSummaries)) throw new Error('Slot summaries must be a list.')
    for (const summary of input.slotSummaries) {
      if (!summary || typeof summary.startTime !== 'string' || !summary.startTime.trim()) {
        throw new Error('Each slot summary requires a start time.')
      }
      if (!Array.isArray(summary.scheduleIds) || summary.scheduleIds.length === 0 ||
        summary.scheduleIds.some(id => typeof id !== 'string' || !id.trim())) {
        throw new Error('Each slot summary requires valid schedule IDs.')
      }
    }
  }

  // Schedule ownership verification: every requested schedule ID must belong to this publication
  if (publicationSchedules && publicationSchedules.length > 0) {
    const validScheduleIds = new Set(
      publicationSchedules
        .filter(s => isScheduleIncludedInPublication(s, publication))
        .map(s => s.id)
    )
    for (const id of input.requestedScheduleIds) {
      if (!validScheduleIds.has(id)) {
        throw new Error(`Selected schedule (${id}) does not belong to this publication.`)
      }
    }
  }

  if (typeof input.memberName !== 'string' || !input.memberName.trim()) {
    throw new Error('Altar server name is required.')
  }
}

export const submissionService = {
  getSubmissionId,
  validateSubmission,
  setSubmissionDb,

  /**
   * Retrieves a single submission for a member under a publication.
   */
  async getSubmission(
    publicationId: string,
    memberId: string,
    db?: Firestore
  ): Promise<ScheduleSubmission | null> {
    const firestoreInstance = await getEffectiveDb(db)
    const submissionId = getSubmissionId(publicationId, memberId)
    const docRef = getDocumentRef(firestoreInstance, SUBMISSIONS_COLLECTION, submissionId)
    const docSnap = await getDoc(docRef)
    if (!docSnap.exists()) return null
    return { id: docSnap.id, ...(docSnap.data() || {}) } as ScheduleSubmission
  },

  /**
   * Checks whether a member has an existing submission for a publication.
   */
  async hasMemberSubmitted(
    publicationId: string,
    memberId: string,
    db?: Firestore
  ): Promise<boolean> {
    const sub = await this.getSubmission(publicationId, memberId, db)
    return sub !== null
  },

  /**
   * Retrieves all submissions for a publication.
   */
  async getSubmissionsForPublication(
    publicationId: string,
    db?: Firestore
  ): Promise<ScheduleSubmission[]> {
    const firestoreInstance = await getEffectiveDb(db)
    const ref = collection(firestoreInstance, SUBMISSIONS_COLLECTION)
    const q = query(ref, where('publicationId', '==', publicationId))
    const snapshot = await getDocs(q)
    return snapshot.docs.map(d => ({ id: d.id, ...(d.data() || {}) })) as ScheduleSubmission[]
  },

  /**
   * Creates a pending schedule submission with deterministic ID.
   *
   * CRITICAL SECURITY & WORKFLOW INVARIANTS:
   * 1. Deterministic document ID `${publicationId}_${memberId}` prevents multiple submissions per member.
   * 2. Status is set to 'pending'.
   * 3. Does NOT modify schedules.assignedMembers or schedulePublications.submittedMembers.
   * 4. If submission already exists, rejects with clear coordinator guidance.
   */
  async createPendingSubmission(
    input: CreateSubmissionInput,
    options?: {
      member?: Member
      publication?: SchedulePublication
      publicationSchedules?: Schedule[]
      firestoreInstance?: Firestore
      serverTime?: number | Date
    }
  ): Promise<ScheduleSubmission> {
    const firestoreInstance = await getEffectiveDb(options?.firestoreInstance)
    const submissionId = getSubmissionId(input.publicationId, input.memberId)

    // Check if submission already exists (Deterministic check)
    const existingSnap = await getDocument(firestoreInstance, SUBMISSIONS_COLLECTION, submissionId)
    if (existingSnap && existingSnap.exists()) {
      throw new Error(
        'A schedule submission has already been received for this altar server. If you need to make changes, please contact your ministry coordinator.'
      )
    }

    // Resolve publication if not provided
    let publication = options?.publication
    if (!publication) {
      const pubDoc = await getDoc(getDocumentRef(firestoreInstance, 'schedulePublications', input.publicationId))
      if (!pubDoc.exists()) {
        throw new Error('Publication not found.')
      }
      publication = { id: pubDoc.id, ...(pubDoc.data() || {}) } as SchedulePublication
    }

    // Resolve member if not provided
    let member = options?.member
    if (!member) {
      const memberDoc = await getDoc(getDocumentRef(firestoreInstance, 'members', input.memberId))
      if (!memberDoc.exists()) {
        throw new Error('Member not found.')
      }
      member = { id: memberDoc.id, ...(memberDoc.data() || {}) } as Member
    }

    // Resolve schedules if not provided
    let publicationSchedules = options?.publicationSchedules
    if (!publicationSchedules) {
      const schedRef = collection(firestoreInstance, 'schedules')
      const q = query(schedRef, where('publicationId', '==', publication.id))
      const snap = await getDocs(q)
      publicationSchedules = snap.docs.map(d => ({ id: d.id, ...(d.data() || {}) })) as Schedule[]
    }

    // Run business validations
    validateSubmission(input, {
      publication,
      member,
      publicationSchedules,
      serverTime: options?.serverTime
    })

    const nowIso = new Date().toISOString()
    const memberNameClean = input.memberName.trim().slice(0, 150)
    // Public patterns may omit a location or other optional display metadata.
    // Firestore rejects undefined inside nested array objects. Whitelist optional
    // fields here while keeping validated required fields explicit and unchanged.
    const slotSummaries: RequestedSlotSummary[] = (input.slotSummaries ?? []).map(summary => ({
      startTime: summary.startTime,
      scheduleIds: summary.scheduleIds,
      ...(summary.dayOfWeek !== undefined ? { dayOfWeek: summary.dayOfWeek } : {}),
      ...(summary.dayName !== undefined ? { dayName: summary.dayName } : {}),
      ...(summary.title !== undefined ? { title: summary.title } : {}),
      ...(summary.location !== undefined ? { location: summary.location } : {}),
      ...(summary.datesCount !== undefined ? { datesCount: summary.datesCount } : {})
    }))

    const submissionData = {
      id: submissionId,
      publicationId: input.publicationId,
      memberId: input.memberId,
      memberName: memberNameClean,
      memberRank: input.memberRank || member.rank || '',
      status: 'pending' as const,
      requestedScheduleIds: input.requestedScheduleIds,
      slotSummaries,
      submittedAt: nowIso,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }

    // Save strictly to /scheduleSubmissions without touching /schedules or publication.submittedMembers
    await setDocument(firestoreInstance, SUBMISSIONS_COLLECTION, submissionId, submissionData)

    return {
      ...submissionData,
      createdAt: nowIso,
      updatedAt: nowIso
    } as unknown as ScheduleSubmission
  },

  /**
   * Atomically approves a pending schedule submission via runTransaction.
   *
   * Verifications and Invariants:
   * 1. Authorization: Checks adminUser permissions (canManageSchedules or admin role).
   * 2. Transaction reads first: reads submission, publication, member, and target schedules inside transaction.
   * 3. Validates submission status is 'pending' (rejects duplicate approvals or invalid status transitions).
   * 4. Validates member rank eligibility and non-suspension for regular mass cycles.
   * 5. Slices requested schedules into historical (immutable past) and future eligible occurrences.
   *    Historical occurrences (past Asia/Manila date/time, locked, attendance finalized, or prior to effectiveDate)
   *    are 100% preserved and never modified.
   * 6. Validates slot capacity atomically against real-time database state (prevents concurrent overbooking).
   * 7. Validates cross-schedule time overlap conflicts on the same date.
   * 8. Transaction writes: updates eligible future schedules with arrayUnion(memberId), marks submission 'approved',
   *    and adds memberId to publication.submittedMembers.
   * 9. If any validation fails, the transaction is aborted and no writes commit.
   */
  async approveScheduleSubmission(
    submissionId: string,
    options?: ApproveSubmissionOptions
  ): Promise<ApprovalResult> {
    verifyAdminPermissions(options?.adminUser)

    const firestoreInstance = await getEffectiveDb(options?.firestoreInstance)
    const effectiveDate = options?.effectiveDate || getParishTodayDate()
    const reviewerIdentifier = options?.adminUser?.email || options?.adminUser?.uid || 'coordinator'

    const executeTransaction = options?.transactionRunner || ((fn: any) => runTransaction(firestoreInstance, fn))

    return await executeTransaction(async (transaction: Transaction) => {
      // 1. READS (All reads must precede writes)
      // 1a. Read submission
      const submissionRef = getDocumentRef(firestoreInstance, SUBMISSIONS_COLLECTION, submissionId)
      const submissionSnap = await transaction.get(submissionRef)
      if (!submissionSnap.exists()) {
        throw new SubmissionError('NOT_FOUND', `Submission document '${submissionId}' not found.`)
      }
      const submission = { id: submissionSnap.id, ...(submissionSnap.data() || {}) } as ScheduleSubmission

      // 1b. Validate status is pending
      if (submission.status !== 'pending') {
        throw new SubmissionError(
          'INVALID_STATUS',
          `Cannot approve submission with status '${submission.status}'. Only pending submissions can be approved.`,
          { currentStatus: submission.status, submissionId }
        )
      }

      // 1c. Read publication
      const publicationRef = getDocumentRef(firestoreInstance, 'schedulePublications', submission.publicationId)
      const pubSnap = await transaction.get(publicationRef)
      if (!pubSnap.exists()) {
        throw new SubmissionError('NOT_FOUND', `Publication '${submission.publicationId}' not found.`)
      }
      const publication = { id: pubSnap.id, ...(pubSnap.data() || {}) } as SchedulePublication

      if (publication.status === 'archived') {
        throw new SubmissionError(
          'PUBLICATION_CLOSED',
          'Cannot approve submissions for an archived publication.',
          { publicationId: publication.id }
        )
      }

      // 1d. Read member
      const memberRef = getDocumentRef(firestoreInstance, 'members', submission.memberId)
      const memberSnap = await transaction.get(memberRef)
      if (!memberSnap.exists()) {
        throw new SubmissionError('NOT_FOUND', `Member '${submission.memberId}' not found.`)
      }
      const member = { id: memberSnap.id, ...(memberSnap.data() || {}) } as Member

      // 1e. Read requested schedules
      const requestedIds = submission.requestedScheduleIds || []
      if (requestedIds.length === 0) {
        throw new SubmissionError('INVALID_STATUS', 'Submission has no requested schedules.', { submissionId })
      }

      const scheduleDocsMap = new Map<string, Schedule>()
      for (const schedId of requestedIds) {
        const schedRef = getDocumentRef(firestoreInstance, 'schedules', schedId)
        const schedSnap = await transaction.get(schedRef)
        if (!schedSnap.exists()) {
          throw new SubmissionError('NOT_FOUND', `Requested schedule '${schedId}' was not found.`, { scheduleId: schedId })
        }
        scheduleDocsMap.set(schedId, { id: schedSnap.id, ...(schedSnap.data() || {}) } as Schedule)
      }

      // 2. VALIDATIONS & SLICING
      // 2a. Member eligibility
      const isEligible = isMemberEligibleForPublication(member, publication, true)
      if (!isEligible) {
        throw new SubmissionError(
          'MEMBER_INELIGIBLE',
          `Altar server '${member.firstName} ${member.lastName}' is not eligible for this publication based on rank.`,
          { memberId: member.id, rank: member.rank }
        )
      }

      const isSpecialPub =
        publication.publicationType === 'special_event' ||
        !!publication.enableStreetLocation ||
        (publication.includedDaysOfWeek && publication.includedDaysOfWeek.length > 0)

      if (member.status === 'suspended' && !isSpecialPub) {
        throw new SubmissionError(
          'MEMBER_INELIGIBLE',
          `Altar server '${member.firstName} ${member.lastName}' is currently suspended and cannot be assigned to regular Masses.`,
          { memberId: member.id, status: member.status }
        )
      }

      if (member.status !== 'active' && member.status !== 'suspended') {
        throw new SubmissionError(
          'MEMBER_INELIGIBLE',
          `Member status is '${member.status}'. Only active altar servers can be approved.`,
          { memberId: member.id, status: member.status }
        )
      }

      // 2b. Slice historical occurrences vs future eligible
      const skippedHistoricalScheduleIds: string[] = []
      const eligibleFutureSchedules: Schedule[] = []

      for (const schedId of requestedIds) {
        const sched = scheduleDocsMap.get(schedId)!
        if (isHistoricalScheduleOccurrence(sched, effectiveDate)) {
          skippedHistoricalScheduleIds.push(sched.id)
        } else {
          eligibleFutureSchedules.push(sched)
        }
      }

      // 2c. Schedule publication ownership verification
      for (const sched of eligibleFutureSchedules) {
        if (sched.publicationId && sched.publicationId !== publication.id) {
          throw new SubmissionError(
            'INVALID_STATUS',
            `Schedule '${sched.id}' belongs to publication '${sched.publicationId}', not '${publication.id}'.`,
            { scheduleId: sched.id, schedulePublicationId: sched.publicationId, targetPublicationId: publication.id }
          )
        }
      }

      // 2d. Atomic Capacity verification (prevents concurrent overbooking)
      for (const sched of eligibleFutureSchedules) {
        const currentAssigned = sched.assignedMembers || []
        const isAlreadyAssigned = currentAssigned.includes(member.id)
        if (!isAlreadyAssigned) {
          const isSunday = isSundayOrAnticipatedMass(sched.title || '', sched.date, sched.startTime)
          const isSpecial = isSpecialEventOrService(sched)
          const maxLimit = isSpecial
            ? (publication.maxServersPerSpecialSlot ?? 6)
            : isSunday
            ? (publication.maxServersPerSundaySlot ?? 5)
            : (publication.maxServersPerWeekdaySlot ?? 5)

          if (currentAssigned.length >= maxLimit) {
            throw new SubmissionError(
              'SLOT_FULL',
              `Schedule '${sched.title}' on ${sched.date} at ${sched.startTime} has reached maximum capacity (${currentAssigned.length}/${maxLimit}).`,
              {
                scheduleId: sched.id,
                title: sched.title,
                date: sched.date,
                startTime: sched.startTime,
                currentCount: currentAssigned.length,
                maxLimit
              }
            )
          }
        }
      }

      // 2e. Cross-schedule overlap / double-booking verification
      for (let i = 0; i < eligibleFutureSchedules.length; i++) {
        for (let j = i + 1; j < eligibleFutureSchedules.length; j++) {
          const sA = eligibleFutureSchedules[i]
          const sB = eligibleFutureSchedules[j]
          if (sA.date === sB.date && isTimeOverlapping(sA.startTime, sA.endTime, sB.startTime, sB.endTime)) {
            throw new SubmissionError(
              'OVERLAPPING_SCHEDULE',
              `Schedule time overlap detected on ${sA.date}: '${sA.title}' (${sA.startTime}-${sA.endTime}) overlaps with '${sB.title}' (${sB.startTime}-${sB.endTime}).`,
              { date: sA.date, scheduleA: sA.id, scheduleB: sB.id }
            )
          }
        }
      }

      // 3. ATOMIC WRITES
      const nowIso = new Date().toISOString()

      // 3a. Update eligible future schedules
      for (const sched of eligibleFutureSchedules) {
        const currentAssigned = sched.assignedMembers || []
        if (!currentAssigned.includes(member.id)) {
          const schedRef = getDocumentRef(firestoreInstance, 'schedules', sched.id)
          transaction.update(schedRef, {
            assignedMembers: [...currentAssigned, member.id],
            updatedAt: serverTimestamp()
          })
        }
      }

      // 3b. Update submission doc to approved
      transaction.update(submissionRef, {
        status: 'approved',
        effectiveDate,
        reviewedAt: nowIso,
        reviewedBy: reviewerIdentifier,
        updatedAt: serverTimestamp()
      })

      // 3c. Update publication doc submittedMembers
      const submittedMembers = Array.from(new Set([...(publication.submittedMembers || []), member.id]))
      transaction.update(publicationRef, {
        submittedMembers,
        updatedAt: serverTimestamp()
      })

      // 4. Audit Log
      await safeLogAudit(
        'SCHEDULE_SUBMISSION_APPROVE',
        'schedule',
        `Approved schedule submission for ${member.firstName} ${member.lastName} in publication '${publication.name}'`,
        reviewerIdentifier,
        {
          submissionId: submission.id,
          memberId: member.id,
          publicationId: publication.id,
          effectiveDate,
          assignedCount: eligibleFutureSchedules.length,
          skippedHistoricalCount: skippedHistoricalScheduleIds.length
        }
      )

      return {
        success: true,
        submissionId: submission.id,
        memberId: member.id,
        assignedScheduleIds: eligibleFutureSchedules.map(s => s.id),
        skippedHistoricalScheduleIds,
        effectiveDate
      }
    })
  },

  /**
   * Atomically rejects a pending schedule submission.
   *
   * Verifications and Invariants:
   * 1. Authorization: Checks adminUser permissions.
   * 2. Reads submission inside transaction and asserts status === 'pending'.
   * 3. Updates submission status to 'rejected' with reviewer info and optional reason.
   * 4. Zero mutations to official schedules and zero mutations to publication.submittedMembers.
   */
  async rejectScheduleSubmission(
    submissionId: string,
    options?: RejectSubmissionOptions
  ): Promise<RejectionResult> {
    verifyAdminPermissions(options?.adminUser)

    const firestoreInstance = await getEffectiveDb(options?.firestoreInstance)
    const reviewerIdentifier = options?.adminUser?.email || options?.adminUser?.uid || 'coordinator'

    const executeTransaction = options?.transactionRunner || ((fn: any) => runTransaction(firestoreInstance, fn))

    return await executeTransaction(async (transaction: Transaction) => {
      const submissionRef = getDocumentRef(firestoreInstance, SUBMISSIONS_COLLECTION, submissionId)
      const submissionSnap = await transaction.get(submissionRef)
      if (!submissionSnap.exists()) {
        throw new SubmissionError('NOT_FOUND', `Submission document '${submissionId}' not found.`)
      }
      const submission = { id: submissionSnap.id, ...(submissionSnap.data() || {}) } as ScheduleSubmission

      if (submission.status !== 'pending') {
        throw new SubmissionError(
          'INVALID_STATUS',
          `Cannot reject submission with status '${submission.status}'. Only pending submissions can be rejected.`,
          { currentStatus: submission.status, submissionId }
        )
      }

      const nowIso = new Date().toISOString()

      // Rejecting pending submission NEVER modifies official schedules or publication.submittedMembers!
      transaction.update(submissionRef, {
        status: 'rejected',
        reviewNote: options?.reason || '',
        reviewedAt: nowIso,
        reviewedBy: reviewerIdentifier,
        updatedAt: serverTimestamp()
      })

      await safeLogAudit(
        'SCHEDULE_SUBMISSION_REJECT',
        'schedule',
        `Rejected schedule submission for member '${submission.memberId}' (Reason: ${options?.reason || 'None specified'})`,
        reviewerIdentifier,
        {
          submissionId: submission.id,
          memberId: submission.memberId,
          publicationId: submission.publicationId,
          reason: options?.reason
        }
      )

      return {
        success: true,
        submissionId: submission.id,
        memberId: submission.memberId,
        reason: options?.reason
      }
    })
  }
}
