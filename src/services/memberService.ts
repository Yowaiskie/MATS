import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  getDocs, 
  query, 
  where, 
  writeBatch,
  serverTimestamp,
  orderBy
} from 'firebase/firestore'
import { db } from '@/firebase/config'
import type { Member, MemberInput } from '@/types/member'

const MEMBERS_COLLECTION = 'members'

export const memberService = {
  /**
   * Fetches all members from Firestore, ordered by lastName then firstName.
   * If includeArchived is false, it excludes 'archived' status members.
   */
  async getMembers(includeArchived = false): Promise<Member[]> {
    const membersRef = collection(db, MEMBERS_COLLECTION)
    
    // Sort by lastName then firstName
    let q = query(membersRef, orderBy('lastName'), orderBy('firstName'))
    
    if (!includeArchived) {
      q = query(
        membersRef, 
        where('status', 'in', ['active', 'inactive']), 
        orderBy('lastName'), 
        orderBy('firstName')
      )
    }
    
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Member[]
  },

  /**
   * Adds a new member to Firestore with server timestamps.
   */
  async addMember(input: MemberInput): Promise<string> {
    const membersRef = collection(db, MEMBERS_COLLECTION)
    const docRef = await addDoc(membersRef, {
      firstName: input.firstName.trim(),
      middleName: input.middleName?.trim() || '',
      lastName: input.lastName.trim(),
      suffix: input.suffix?.trim() || '',
      nickname: input.nickname?.trim() || '',
      rank: input.rank.trim(),
      status: input.status,
      phoneNumber: input.phoneNumber?.trim() || '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })
    return docRef.id
  },

  /**
   * Updates an existing member's fields.
   */
  async updateMember(id: string, input: Partial<MemberInput>): Promise<void> {
    const docRef = doc(db, MEMBERS_COLLECTION, id)
    const updateData: any = {
      updatedAt: serverTimestamp()
    }
    
    if (input.firstName !== undefined) updateData.firstName = input.firstName.trim()
    if (input.middleName !== undefined) updateData.middleName = input.middleName.trim()
    if (input.lastName !== undefined) updateData.lastName = input.lastName.trim()
    if (input.suffix !== undefined) updateData.suffix = input.suffix.trim()
    if (input.nickname !== undefined) updateData.nickname = input.nickname.trim()
    if (input.rank !== undefined) updateData.rank = input.rank.trim()
    if (input.status !== undefined) updateData.status = input.status
    if (input.phoneNumber !== undefined) updateData.phoneNumber = input.phoneNumber.trim()
    
    await updateDoc(docRef, updateData)
  },

  /**
   * Soft deletes a member by changing status to 'archived'.
   */
  async archiveMember(id: string): Promise<void> {
    await this.updateMember(id, { status: 'archived' })
  },

  /**
   * Restores an archived member back to 'active'.
   */
  async restoreMember(id: string): Promise<void> {
    await this.updateMember(id, { status: 'active' })
  },

  /**
   * Performs sequential batch writes to Firestore for imported members.
   * Automatically splits inputs into chunks of maximum 500 operations per batch.
   * Supports up to 1000 items as dictated by guidelines.
   */
  async importMembersBatch(inputs: MemberInput[]): Promise<void> {
    if (inputs.length === 0) return
    if (inputs.length > 1000) {
      throw new Error('Bulk import exceeds maximum limit of 1000 rows.')
    }
    
    const BATCH_SIZE_LIMIT = 500
    
    // Process imports in sequential chunks of 500
    for (let i = 0; i < inputs.length; i += BATCH_SIZE_LIMIT) {
      const chunk = inputs.slice(i, i + BATCH_SIZE_LIMIT)
      const batch = writeBatch(db)
      const membersRef = collection(db, MEMBERS_COLLECTION)
      
      chunk.forEach((input) => {
        const newDocRef = doc(membersRef) // Auto-generates ID
        batch.set(newDocRef, {
          firstName: input.firstName.trim(),
          middleName: input.middleName?.trim() || '',
          lastName: input.lastName.trim(),
          suffix: input.suffix?.trim() || '',
          nickname: input.nickname?.trim() || '',
          rank: input.rank.trim(),
          status: input.status,
          phoneNumber: input.phoneNumber?.trim() || '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        })
      })
      
      await batch.commit()
    }
  }
}
