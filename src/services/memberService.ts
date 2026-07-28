import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  getDocs, 
  writeBatch,
  serverTimestamp,
  deleteDoc
} from 'firebase/firestore'
import { db } from '@/firebase/config'
import type { Member, MemberInput } from '@/types/member'
import { isDuplicateName } from '@/utils/member'
import { auditService } from '@/services/auditService'

const MEMBERS_COLLECTION = 'members'

export const memberService = {
  /**
   * Fetches all members from Firestore, ordered by lastName then firstName.
   * If includeArchived is false, it excludes 'archived' status members.
   */
  async getMembers(includeArchived: boolean | 'archived_only' = false): Promise<Member[]> {
    const membersRef = collection(db, MEMBERS_COLLECTION)
    const snapshot = await getDocs(membersRef)
    let members = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Member[]
    
    if (includeArchived === 'archived_only') {
      // Archived Members tab: show ONLY archived members
      members = members.filter(m => m.status === 'archived')
    } else if (!includeArchived) {
      // Active Members tab: show active and inactive members (exclude archived)
      members = members.filter(m => m.status !== 'archived')
    }
    // If includeArchived === true (or 'all'), return ALL members (active, inactive, archived) without filtering out active ones!
    
    members.sort((a, b) => {
      const lastA = (a.lastName || '').toLowerCase()
      const lastB = (b.lastName || '').toLowerCase()
      const lastCompare = lastA.localeCompare(lastB)
      if (lastCompare !== 0) return lastCompare
      
      const firstA = (a.firstName || '').toLowerCase()
      const firstB = (b.firstName || '').toLowerCase()
      return firstA.localeCompare(firstB)
    })
    
    return members
  },

  /**
   * Adds a new member to Firestore with server timestamps.
   */
  async addMember(input: MemberInput, performedBy = 'System'): Promise<string> {
    const membersRef = collection(db, MEMBERS_COLLECTION)
    const docRef = await addDoc(membersRef, {
      firstName: input.firstName.trim(),
      middleName: input.middleName?.trim() || '',
      lastName: input.lastName.trim(),
      suffix: input.suffix?.trim() || '',
      nickname: input.nickname?.trim() || '',
      homeAddress: input.homeAddress?.trim() || '',
      dateOfBirth: input.dateOfBirth?.trim() || '',
      rank: input.rank.trim(),
      status: input.status,
      phoneNumber: input.phoneNumber?.trim() || '',
      monthJoined: input.monthJoined?.trim() || '',
      dateOfInvestiture: input.dateOfInvestiture?.trim() || '',
      position: input.position?.trim() || '',
      order: input.order?.trim() || '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })

    await auditService.logAction(
      'MEMBER_CREATE',
      'member',
      `Created member '${input.firstName} ${input.lastName}'`,
      performedBy,
      { memberId: docRef.id, input }
    )

    return docRef.id
  },

  /**
   * Updates an existing member's fields.
   */
  async updateMember(id: string, input: Partial<MemberInput>, performedBy = 'System'): Promise<void> {
    const docRef = doc(db, MEMBERS_COLLECTION, id)
    const updateData: any = {
      updatedAt: serverTimestamp()
    }
    
    if (input.firstName !== undefined) updateData.firstName = input.firstName.trim()
    if (input.middleName !== undefined) updateData.middleName = input.middleName.trim()
    if (input.lastName !== undefined) updateData.lastName = input.lastName.trim()
    if (input.suffix !== undefined) updateData.suffix = input.suffix.trim()
    if (input.nickname !== undefined) updateData.nickname = input.nickname.trim()
    if (input.homeAddress !== undefined) updateData.homeAddress = input.homeAddress.trim()
    if (input.dateOfBirth !== undefined) updateData.dateOfBirth = input.dateOfBirth.trim()
    if (input.rank !== undefined) updateData.rank = input.rank.trim()
    if (input.status !== undefined) updateData.status = input.status
    if (input.phoneNumber !== undefined) updateData.phoneNumber = input.phoneNumber.trim()
    if (input.monthJoined !== undefined) updateData.monthJoined = input.monthJoined.trim()
    if (input.dateOfInvestiture !== undefined) updateData.dateOfInvestiture = input.dateOfInvestiture.trim()
    if (input.position !== undefined) updateData.position = input.position.trim()
    if (input.order !== undefined) updateData.order = input.order.trim()
    
    await updateDoc(docRef, updateData)

    await auditService.logAction(
      'MEMBER_UPDATE',
      'member',
      `Updated member '${input.firstName || ''} ${input.lastName || ''}' (ID: ${id})`,
      performedBy,
      { memberId: id, updates: input }
    )
  },

  /**
   * Soft deletes a member by changing status to 'archived'.
   */
  async archiveMember(id: string, performedBy = 'System'): Promise<void> {
    const docRef = doc(db, MEMBERS_COLLECTION, id)
    await updateDoc(docRef, { status: 'archived', updatedAt: serverTimestamp() })
    await auditService.logAction(
      'MEMBER_ARCHIVE',
      'member',
      `Archived member with ID: ${id}`,
      performedBy,
      { memberId: id }
    )
  },

  /**
   * Restores an archived member back to 'active'.
   */
  async restoreMember(id: string, performedBy = 'System'): Promise<void> {
    const docRef = doc(db, MEMBERS_COLLECTION, id)
    await updateDoc(docRef, { status: 'active', updatedAt: serverTimestamp() })
    await auditService.logAction(
      'MEMBER_UPDATE',
      'member',
      `Restored archived member with ID: ${id}`,
      performedBy,
      { memberId: id }
    )
  },

  /**
   * Performs sequential batch writes to Firestore for imported members.
   * Checks for existing members by First Name and Last Name.
   * Performs UPSERT (Update existing fields if they have value, Insert if new).
   */
  async importMembersBatch(inputs: MemberInput[], performedBy = 'System'): Promise<void> {
    if (inputs.length === 0) return
    if (inputs.length > 1000) {
      throw new Error('Bulk import exceeds maximum limit of 1000 rows.')
    }
    
    // Fetch all existing members including archived to correctly map duplicates
    const existingMembers = await this.getMembers(true)
    
    const BATCH_SIZE_LIMIT = 500
    
    // Process imports in sequential chunks of 500
    for (let i = 0; i < inputs.length; i += BATCH_SIZE_LIMIT) {
      const chunk = inputs.slice(i, i + BATCH_SIZE_LIMIT)
      const batch = writeBatch(db)
      const membersRef = collection(db, MEMBERS_COLLECTION)
      
      chunk.forEach((input) => {
        // Find existing member by name
        const existingMember = existingMembers.find(m => 
          isDuplicateName(input.firstName, input.lastName, m.firstName, m.lastName)
        )
        
        if (existingMember) {
          // Update existing document (only non-blank fields)
          const docRef = doc(db, MEMBERS_COLLECTION, existingMember.id)
          const updateData: any = { updatedAt: serverTimestamp() }
          
          if (input.firstName?.trim()) updateData.firstName = input.firstName.trim()
          if (input.middleName?.trim()) updateData.middleName = input.middleName.trim()
          if (input.lastName?.trim()) updateData.lastName = input.lastName.trim()
          if (input.suffix?.trim()) updateData.suffix = input.suffix.trim()
          if (input.nickname?.trim()) updateData.nickname = input.nickname.trim()
          if (input.homeAddress?.trim()) updateData.homeAddress = input.homeAddress.trim()
          if (input.dateOfBirth?.trim()) updateData.dateOfBirth = input.dateOfBirth.trim()
          if (input.rank?.trim()) updateData.rank = input.rank.trim()
          if (input.status) updateData.status = input.status
          if (input.phoneNumber?.trim()) updateData.phoneNumber = input.phoneNumber.trim()
          if (input.monthJoined?.trim()) updateData.monthJoined = input.monthJoined.trim()
          if (input.dateOfInvestiture?.trim()) updateData.dateOfInvestiture = input.dateOfInvestiture.trim()
          if (input.position?.trim()) updateData.position = input.position.trim()
          if (input.order?.trim()) updateData.order = input.order.trim()
          
          batch.update(docRef, updateData)
        } else {
          // Add new document
          const newDocRef = doc(membersRef)
          batch.set(newDocRef, {
            firstName: input.firstName.trim(),
            middleName: input.middleName?.trim() || '',
            lastName: input.lastName.trim(),
            suffix: input.suffix?.trim() || '',
            nickname: input.nickname?.trim() || '',
            homeAddress: input.homeAddress?.trim() || '',
            dateOfBirth: input.dateOfBirth?.trim() || '',
            rank: input.rank.trim(),
            status: input.status,
            phoneNumber: input.phoneNumber?.trim() || '',
            monthJoined: input.monthJoined?.trim() || '',
            dateOfInvestiture: input.dateOfInvestiture?.trim() || '',
            position: input.position?.trim() || '',
            order: input.order?.trim() || '',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          })
        }
      })
      
      await batch.commit()
    }

    await auditService.logAction(
      'MEMBER_IMPORT',
      'member',
      `Imported / upserted batch of ${inputs.length} members`,
      performedBy,
      { count: inputs.length }
    )
  },

  /**
   * Bulk-archives multiple members (sets status → 'archived') using batched writes.
   */
  async bulkArchiveMembers(ids: string[], performedBy = 'System'): Promise<void> {
    if (ids.length === 0) return
    const BATCH_SIZE_LIMIT = 500
    for (let i = 0; i < ids.length; i += BATCH_SIZE_LIMIT) {
      const chunk = ids.slice(i, i + BATCH_SIZE_LIMIT)
      const batch = writeBatch(db)
      chunk.forEach(id => {
        const ref = doc(db, MEMBERS_COLLECTION, id)
        batch.update(ref, { status: 'archived', updatedAt: serverTimestamp() })
      })
      await batch.commit()
    }

    await auditService.logAction(
      'MEMBER_ARCHIVE',
      'member',
      `Bulk archived ${ids.length} members`,
      performedBy,
      { count: ids.length, ids }
    )
  },

  /**
   * Bulk-updates rank for multiple members using batched writes.
   */
  async bulkUpdateRank(ids: string[], newRank: string, performedBy = 'System'): Promise<void> {
    if (ids.length === 0) return
    const BATCH_SIZE_LIMIT = 500
    for (let i = 0; i < ids.length; i += BATCH_SIZE_LIMIT) {
      const chunk = ids.slice(i, i + BATCH_SIZE_LIMIT)
      const batch = writeBatch(db)
      chunk.forEach(id => {
        const ref = doc(db, MEMBERS_COLLECTION, id)
        batch.update(ref, { rank: newRank.trim(), updatedAt: serverTimestamp() })
      })
      await batch.commit()
    }

    await auditService.logAction(
      'MEMBER_UPDATE',
      'member',
      `Bulk updated rank to '${newRank}' for ${ids.length} members`,
      performedBy,
      { count: ids.length, newRank, ids }
    )
  },

  /**
   * Bulk-restores multiple archived members (sets status → 'active') using batched writes.
   */
  async bulkRestoreMembers(ids: string[], performedBy = 'System'): Promise<void> {
    if (ids.length === 0) return
    const BATCH_SIZE_LIMIT = 500
    for (let i = 0; i < ids.length; i += BATCH_SIZE_LIMIT) {
      const chunk = ids.slice(i, i + BATCH_SIZE_LIMIT)
      const batch = writeBatch(db)
      chunk.forEach(id => {
        const ref = doc(db, MEMBERS_COLLECTION, id)
        batch.update(ref, { status: 'active', updatedAt: serverTimestamp() })
      })
      await batch.commit()
    }

    await auditService.logAction(
      'MEMBER_UPDATE',
      'member',
      `Bulk restored/reactivated ${ids.length} members`,
      performedBy,
      { count: ids.length, ids }
    )
  },

  /**
   * Permanently deletes a member document from Firestore.
   */
  async deleteMember(id: string, performedBy = 'System'): Promise<void> {
    const docRef = doc(db, MEMBERS_COLLECTION, id)
    await deleteDoc(docRef)

    await auditService.logAction(
      'MEMBER_DELETE',
      'member',
      `Permanently deleted member with ID: ${id}`,
      performedBy,
      { memberId: id }
    )
  },

  /**
   * Bulk-deletes multiple members permanently using batched writes.
   */
  async bulkDeleteMembers(ids: string[], performedBy = 'System'): Promise<void> {
    if (ids.length === 0) return
    const BATCH_SIZE_LIMIT = 500
    for (let i = 0; i < ids.length; i += BATCH_SIZE_LIMIT) {
      const chunk = ids.slice(i, i + BATCH_SIZE_LIMIT)
      const batch = writeBatch(db)
      chunk.forEach(id => {
        const ref = doc(db, MEMBERS_COLLECTION, id)
        batch.delete(ref)
      })
      await batch.commit()
    }

    await auditService.logAction(
      'MEMBER_DELETE',
      'member',
      `Bulk permanently deleted ${ids.length} members`,
      performedBy,
      { count: ids.length, ids }
    )
  }
}
