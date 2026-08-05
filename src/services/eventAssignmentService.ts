import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  getDocs, 
  query,
  where,
  serverTimestamp,
  deleteDoc
} from 'firebase/firestore'
import { db } from '@/firebase/config'
import type { EventAssignment, EventRole } from '@/types/event'
import { auditService } from '@/services/auditService'

const ASSIGNMENTS_COLLECTION = 'eventAssignments'
const ROLES_COLLECTION = 'eventRoles'

export const eventAssignmentService = {
  /**
   * Get all assignments for an event
   */
  async getAssignmentsByEventId(eventId: string): Promise<EventAssignment[]> {
    const q = query(
      collection(db, ASSIGNMENTS_COLLECTION), 
      where('eventId', '==', eventId)
    )
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as EventAssignment[]
  },

  /**
   * Assign a member to an event
   */
  async createAssignment(input: Omit<EventAssignment, 'id' | 'assignedAt'>, performedBy = 'System'): Promise<string> {
    const docRef = await addDoc(collection(db, ASSIGNMENTS_COLLECTION), {
      ...input,
      assignedAt: serverTimestamp()
    })

    await auditService.logAction(
      'EVENT_ASSIGN_MEMBER',
      'system',
      `Assigned member '${input.memberName}' as '${input.eventRoleName}' to event '${input.eventId}'`,
      performedBy,
      { assignmentId: docRef.id, eventId: input.eventId, memberUid: input.memberUid }
    )
    return docRef.id
  },

  /**
   * Update an assignment (e.g. change role, make head)
   */
  async updateAssignment(id: string, input: Partial<EventAssignment>, performedBy = 'System'): Promise<void> {
    const docRef = doc(db, ASSIGNMENTS_COLLECTION, id)
    const updateData = { ...input }
    delete updateData.id
    
    await updateDoc(docRef, updateData)

    await auditService.logAction(
      'EVENT_ASSIGNMENT_UPDATE',
      'system',
      `Updated assignment ID: ${id}`,
      performedBy,
      { assignmentId: id, updates: input }
    )
  },

  /**
   * Remove an assignment
   */
  async removeAssignment(id: string, performedBy = 'System'): Promise<void> {
    const docRef = doc(db, ASSIGNMENTS_COLLECTION, id)
    await deleteDoc(docRef)

    await auditService.logAction(
      'EVENT_ASSIGNMENT_REMOVE',
      'system',
      `Removed assignment ID: ${id}`,
      performedBy,
      { assignmentId: id }
    )
  },

  /**
   * Get global or event-specific roles
   */
  async getRoles(eventId?: string): Promise<EventRole[]> {
    let q = query(collection(db, ROLES_COLLECTION))
    // Note: If we want both global (eventId null) and specific (eventId), we'd need an 'in' or two queries.
    // For simplicity, let's just fetch all or filter client-side, or execute two queries.
    const snapshot = await getDocs(q)
    let roles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as EventRole[]
    
    if (eventId) {
      roles = roles.filter(r => r.eventId === eventId || !r.eventId)
    } else {
      roles = roles.filter(r => !r.eventId)
    }
    return roles
  },

  /**
   * Create a new custom role
   */
  async createRole(input: Omit<EventRole, 'id' | 'createdAt'>, performedBy = 'System'): Promise<string> {
    const docRef = await addDoc(collection(db, ROLES_COLLECTION), {
      ...input,
      createdAt: serverTimestamp()
    })

    await auditService.logAction(
      'EVENT_ROLE_CREATE',
      'system',
      `Created custom role '${input.name}'`,
      performedBy,
      { roleId: docRef.id, name: input.name }
    )
    return docRef.id
  }
}
