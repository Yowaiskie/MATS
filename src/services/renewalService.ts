import {
  collection,
  doc,
  getDocs,
  getDoc,
  updateDoc,
  query,
  where,
  writeBatch,
  serverTimestamp,
  increment
} from 'firebase/firestore'
import { db } from '@/firebase/config'
import type {
  RenewalCycle,
  RenewalCycleInput,
  RenewalMembership,
  RenewalMembershipInput,
  RenewalMembershipWithMember
} from '@/types/renewal'
import type { Member } from '@/types/member'
import { memberService } from '@/services/memberService'
import { auditService } from '@/services/auditService'

const RENEWAL_CYCLES_COLLECTION = 'renewalCycles'
const RENEWAL_MEMBERSHIPS_COLLECTION = 'renewalMemberships'

export const renewalService = {
  /**
   * Retrieves all renewal cycles ordered with current first, then newest startDate descending.
   */
  async getCycles(): Promise<RenewalCycle[]> {
    const cyclesRef = collection(db, RENEWAL_CYCLES_COLLECTION)
    const snapshot = await getDocs(cyclesRef)
    const cycles = snapshot.docs.map(d => ({
      id: d.id,
      ...d.data()
    })) as RenewalCycle[]

    return cycles.sort((a, b) => {
      // Current cycle always first
      if (a.isCurrent && !b.isCurrent) return -1
      if (!a.isCurrent && b.isCurrent) return 1
      // Non-archived before archived
      if (!a.isArchived && b.isArchived) return -1
      if (a.isArchived && !b.isArchived) return 1
      // Then newest start date first
      return (b.startDate || '').localeCompare(a.startDate || '')
    })
  },

  /**
   * Retrieves the currently active renewal cycle (isCurrent == true).
   */
  async getCurrentCycle(): Promise<RenewalCycle | null> {
    const cyclesRef = collection(db, RENEWAL_CYCLES_COLLECTION)
    const q = query(cyclesRef, where('isCurrent', '==', true))
    const snapshot = await getDocs(q)
    if (snapshot.empty) return null
    const docData = snapshot.docs[0]
    return {
      id: docData.id,
      ...docData.data()
    } as RenewalCycle
  },

  /**
   * Retrieves a single cycle by its ID.
   */
  async getCycleById(cycleId: string): Promise<RenewalCycle | null> {
    const docRef = doc(db, RENEWAL_CYCLES_COLLECTION, cycleId)
    const snap = await getDoc(docRef)
    if (!snap.exists()) return null
    return { id: snap.id, ...snap.data() } as RenewalCycle
  },

  /**
   * Creates a new annual renewal cycle. Starts with an empty roster (0 members).
   * If isCurrent is true, atomically deactivates any existing current cycle.
   */
  async createCycle(input: RenewalCycleInput, actor = 'Admin'): Promise<RenewalCycle> {
    const cyclesRef = collection(db, RENEWAL_CYCLES_COLLECTION)
    const newDocRef = doc(cyclesRef)
    const batch = writeBatch(db)

    // Invariant: If marked as current, deactivate any existing current cycle
    if (input.isCurrent) {
      const q = query(cyclesRef, where('isCurrent', '==', true))
      const currentSnap = await getDocs(q)
      currentSnap.docs.forEach(d => {
        batch.update(doc(db, RENEWAL_CYCLES_COLLECTION, d.id), {
          isCurrent: false,
          updatedAt: serverTimestamp()
        })
      })
    }

    const payload = {
      name: input.name.trim(),
      year: input.year.trim(),
      startDate: input.startDate,
      endDate: input.endDate,
      isCurrent: input.isCurrent ?? false,
      isArchived: false,
      description: input.description?.trim() || '',
      memberCount: 0,
      createdBy: actor,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }

    batch.set(newDocRef, payload)
    await batch.commit()

    await auditService.logAction(
      'RENEWAL_CYCLE_CREATE',
      'member',
      `Created annual renewal cycle '${input.name}' (${input.year})`,
      actor,
      { cycleId: newDocRef.id, name: input.name, year: input.year, isCurrent: input.isCurrent }
    )

    return {
      id: newDocRef.id,
      ...payload
    } as RenewalCycle
  },

  /**
   * Updates cycle metadata (name, year, dates, description).
   * Rejects modification if the cycle is archived.
   */
  async updateCycle(cycleId: string, updates: Partial<RenewalCycleInput>, actor = 'Admin'): Promise<void> {
    const docRef = doc(db, RENEWAL_CYCLES_COLLECTION, cycleId)
    const snap = await getDoc(docRef)
    if (!snap.exists()) throw new Error('Renewal cycle not found.')
    const currentData = snap.data() as RenewalCycle
    if (currentData.isArchived) throw new Error('Cannot update an archived renewal cycle. Unarchive it first.')

    const updatePayload: Record<string, any> = {
      updatedAt: serverTimestamp()
    }
    if (updates.name !== undefined) updatePayload.name = updates.name.trim()
    if (updates.year !== undefined) updatePayload.year = updates.year.trim()
    if (updates.startDate !== undefined) updatePayload.startDate = updates.startDate
    if (updates.endDate !== undefined) updatePayload.endDate = updates.endDate
    if (updates.description !== undefined) updatePayload.description = updates.description.trim()

    await updateDoc(docRef, updatePayload)

    await auditService.logAction(
      'RENEWAL_CYCLE_UPDATE',
      'member',
      `Updated renewal cycle '${currentData.name}'`,
      actor,
      { cycleId, updates }
    )
  },

  /**
   * Sets the given cycle as current, atomically toggling all other cycles to isCurrent = false.
   */
  async setCurrentCycle(cycleId: string, actor = 'Admin'): Promise<void> {
    const cyclesRef = collection(db, RENEWAL_CYCLES_COLLECTION)
    const targetRef = doc(db, RENEWAL_CYCLES_COLLECTION, cycleId)
    const targetSnap = await getDoc(targetRef)
    if (!targetSnap.exists()) throw new Error('Target renewal cycle not found.')
    const targetData = targetSnap.data() as RenewalCycle

    const batch = writeBatch(db)

    // 1. Set all currently active cycles to false
    const q = query(cyclesRef, where('isCurrent', '==', true))
    const currentSnap = await getDocs(q)
    currentSnap.docs.forEach(d => {
      if (d.id !== cycleId) {
        batch.update(doc(db, RENEWAL_CYCLES_COLLECTION, d.id), {
          isCurrent: false,
          updatedAt: serverTimestamp()
        })
      }
    })

    // 2. Set target cycle to true (unarchiving if previously archived)
    batch.update(targetRef, {
      isCurrent: true,
      isArchived: false,
      updatedAt: serverTimestamp()
    })

    await batch.commit()

    await auditService.logAction(
      'RENEWAL_CYCLE_ACTIVATE',
      'member',
      `Activated '${targetData.name}' as the current renewal cycle`,
      actor,
      { cycleId, name: targetData.name }
    )
  },

  /**
   * Archives a cycle, locking its roster and historical classifications from accidental edits.
   */
  async archiveCycle(cycleId: string, actor = 'Admin'): Promise<void> {
    const docRef = doc(db, RENEWAL_CYCLES_COLLECTION, cycleId)
    const snap = await getDoc(docRef)
    if (!snap.exists()) throw new Error('Renewal cycle not found.')
    const cycle = snap.data() as RenewalCycle

    await updateDoc(docRef, {
      isArchived: true,
      isCurrent: false, // Cannot be current while archived
      archivedAt: serverTimestamp(),
      archivedBy: actor,
      updatedAt: serverTimestamp()
    })

    await auditService.logAction(
      'RENEWAL_CYCLE_ARCHIVE',
      'member',
      `Archived and locked renewal cycle '${cycle.name}'`,
      actor,
      { cycleId, name: cycle.name }
    )
  },

  /**
   * Unarchives a previously locked cycle to allow administrative corrections.
   */
  async unarchiveCycle(cycleId: string, actor = 'Admin'): Promise<void> {
    const docRef = doc(db, RENEWAL_CYCLES_COLLECTION, cycleId)
    const snap = await getDoc(docRef)
    if (!snap.exists()) throw new Error('Renewal cycle not found.')
    const cycle = snap.data() as RenewalCycle

    await updateDoc(docRef, {
      isArchived: false,
      archivedAt: null,
      archivedBy: null,
      updatedAt: serverTimestamp()
    })

    await auditService.logAction(
      'RENEWAL_CYCLE_UPDATE',
      'member',
      `Unarchived renewal cycle '${cycle.name}'`,
      actor,
      { cycleId, name: cycle.name }
    )
  },

  /**
   * Fetches all memberships for a cycle, joined with the permanent member profiles.
   */
  async getMembershipsForCycle(cycleId: string): Promise<RenewalMembershipWithMember[]> {
    const membershipsRef = collection(db, RENEWAL_MEMBERSHIPS_COLLECTION)
    const q = query(membershipsRef, where('cycleId', '==', cycleId))
    const [membershipsSnap, allMembers] = await Promise.all([
      getDocs(q),
      memberService.getMembers(true) // Get all permanent members for joining
    ])

    const memberMap = new Map<string, Member>()
    allMembers.forEach(m => memberMap.set(m.id, m))

    const result: RenewalMembershipWithMember[] = []

    membershipsSnap.docs.forEach(docSnap => {
      const data = docSnap.data() as Omit<RenewalMembership, 'id'>
      const member = memberMap.get(data.memberId)
      if (member) {
        result.push({
          id: docSnap.id,
          ...data,
          member
        })
      }
    })

    // Sort alphabetically by member lastName, firstName
    return result.sort((a, b) => {
      const lastA = (a.member.lastName || '').toLowerCase()
      const lastB = (b.member.lastName || '').toLowerCase()
      const lastCmp = lastA.localeCompare(lastB)
      if (lastCmp !== 0) return lastCmp
      return (a.member.firstName || '').toLowerCase().localeCompare((b.member.firstName || '').toLowerCase())
    })
  },

  /**
   * Enrolls an existing permanent member into a renewal cycle with cycle-specific classifications.
   * Deterministic ID `${cycleId}_${memberId}` prevents duplicate enrollment in the same cycle.
   */
  async enrollMemberInCycle(
    cycleId: string,
    memberId: string,
    input: RenewalMembershipInput,
    actor = 'Admin'
  ): Promise<void> {
    const cycleRef = doc(db, RENEWAL_CYCLES_COLLECTION, cycleId)
    const cycleSnap = await getDoc(cycleRef)
    if (!cycleSnap.exists()) throw new Error('Renewal cycle not found.')
    if ((cycleSnap.data() as RenewalCycle).isArchived) throw new Error('Cannot add members to an archived cycle.')

    const membershipId = `${cycleId}_${memberId}`
    const membershipRef = doc(db, RENEWAL_MEMBERSHIPS_COLLECTION, membershipId)
    const membershipSnap = await getDoc(membershipRef)
    if (membershipSnap.exists()) {
      throw new Error('This member is already enrolled in this renewal cycle.')
    }

    const todayStr = new Date().toISOString().split('T')[0]
    const batch = writeBatch(db)

    batch.set(membershipRef, {
      cycleId,
      memberId,
      cycleRank: input.cycleRank,
      cycleOrder: input.cycleOrder || '',
      membershipStatus: input.membershipStatus || 'active',
      renewalDate: input.renewalDate || todayStr,
      notes: input.notes?.trim() || '',
      addedBy: actor,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })

    batch.update(cycleRef, {
      memberCount: increment(1),
      updatedAt: serverTimestamp()
    })

    await batch.commit()

    await auditService.logAction(
      'RENEWAL_MEMBERSHIP_ADD',
      'member',
      `Enrolled member in renewal cycle as ${input.cycleRank}`,
      actor,
      { cycleId, memberId, cycleRank: input.cycleRank, membershipStatus: input.membershipStatus }
    )
  },

  /**
   * Batch enrolls multiple permanent members into a cycle (e.g. initial roster seeding).
   */
  async bulkEnrollMembersInCycle(
    cycleId: string,
    entries: Array<{
      memberId: string
      cycleRank: RenewalMembershipInput['cycleRank']
      membershipStatus: RenewalMembershipInput['membershipStatus']
      cycleOrder?: string
      notes?: string
    }>,
    actor = 'Admin'
  ): Promise<number> {
    if (entries.length === 0) return 0

    const cycleRef = doc(db, RENEWAL_CYCLES_COLLECTION, cycleId)
    const cycleSnap = await getDoc(cycleRef)
    if (!cycleSnap.exists()) throw new Error('Renewal cycle not found.')
    if ((cycleSnap.data() as RenewalCycle).isArchived) throw new Error('Cannot add members to an archived cycle.')

    const todayStr = new Date().toISOString().split('T')[0]
    const CHUNK_SIZE = 450
    let addedCount = 0

    for (let i = 0; i < entries.length; i += CHUNK_SIZE) {
      const chunk = entries.slice(i, i + CHUNK_SIZE)
      const batch = writeBatch(db)

      chunk.forEach(e => {
        const membershipId = `${cycleId}_${e.memberId}`
        const membershipRef = doc(db, RENEWAL_MEMBERSHIPS_COLLECTION, membershipId)
        batch.set(membershipRef, {
          cycleId,
          memberId: e.memberId,
          cycleRank: e.cycleRank,
          cycleOrder: e.cycleOrder || '',
          membershipStatus: e.membershipStatus || 'active',
          renewalDate: todayStr,
          notes: e.notes?.trim() || '',
          addedBy: actor,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        })
      })

      batch.update(cycleRef, {
        memberCount: increment(chunk.length),
        updatedAt: serverTimestamp()
      })

      await batch.commit()
      addedCount += chunk.length
    }

    await auditService.logAction(
      'RENEWAL_MEMBERSHIP_ADD',
      'member',
      `Bulk enrolled ${addedCount} members in renewal cycle`,
      actor,
      { cycleId, enrolledCount: addedCount }
    )

    return addedCount
  },

  /**
   * Updates cycle-specific classifications, order, or status for an enrolled member.
   */
  async updateMembership(
    cycleId: string,
    memberId: string,
    updates: Partial<RenewalMembershipInput>,
    actor = 'Admin'
  ): Promise<void> {
    const cycleRef = doc(db, RENEWAL_CYCLES_COLLECTION, cycleId)
    const cycleSnap = await getDoc(cycleRef)
    if (!cycleSnap.exists()) throw new Error('Renewal cycle not found.')
    if ((cycleSnap.data() as RenewalCycle).isArchived) throw new Error('Cannot modify members in an archived cycle.')

    const membershipId = `${cycleId}_${memberId}`
    const membershipRef = doc(db, RENEWAL_MEMBERSHIPS_COLLECTION, membershipId)
    const membershipSnap = await getDoc(membershipRef)
    if (!membershipSnap.exists()) throw new Error('Membership record not found.')

    const payload: Record<string, any> = {
      updatedAt: serverTimestamp()
    }
    if (updates.cycleRank !== undefined) payload.cycleRank = updates.cycleRank
    if (updates.membershipStatus !== undefined) payload.membershipStatus = updates.membershipStatus
    if (updates.cycleOrder !== undefined) payload.cycleOrder = updates.cycleOrder
    if (updates.renewalDate !== undefined) payload.renewalDate = updates.renewalDate
    if (updates.notes !== undefined) payload.notes = updates.notes.trim()

    await updateDoc(membershipRef, payload)

    await auditService.logAction(
      'RENEWAL_MEMBERSHIP_UPDATE',
      'member',
      `Updated cycle classification for member (${updates.cycleRank || 'Rank'})`,
      actor,
      { cycleId, memberId, updates }
    )
  },

  /**
   * Removes a member from a renewal cycle.
   * IMPORTANT: The permanent member profile in the 'members' collection is NEVER deleted.
   */
  async removeMembership(cycleId: string, memberId: string, actor = 'Admin'): Promise<void> {
    const cycleRef = doc(db, RENEWAL_CYCLES_COLLECTION, cycleId)
    const cycleSnap = await getDoc(cycleRef)
    if (!cycleSnap.exists()) throw new Error('Renewal cycle not found.')
    if ((cycleSnap.data() as RenewalCycle).isArchived) throw new Error('Cannot remove members from an archived cycle.')

    const membershipId = `${cycleId}_${memberId}`
    const membershipRef = doc(db, RENEWAL_MEMBERSHIPS_COLLECTION, membershipId)

    const batch = writeBatch(db)
    batch.delete(membershipRef)
    batch.update(cycleRef, {
      memberCount: increment(-1),
      updatedAt: serverTimestamp()
    })

    await batch.commit()

    await auditService.logAction(
      'RENEWAL_MEMBERSHIP_REMOVE',
      'member',
      'Removed member from renewal cycle roster (permanent profile preserved)',
      actor,
      { cycleId, memberId }
    )
  }
}
