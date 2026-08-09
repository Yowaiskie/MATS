import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  getDocs, 
  query,
  where,
  serverTimestamp
} from 'firebase/firestore'
import { db } from '@/firebase/config'
import type { EventTask, EventChecklistItem } from '@/types/event'
import { auditService } from '@/services/auditService'

const TASKS_COLLECTION = 'eventTasks'
const CHECKLISTS_COLLECTION = 'eventChecklists'

export const eventTaskService = {
  /**
   * Get all tasks for an event
   */
  async getTasksByEventId(eventId: string): Promise<EventTask[]> {
    const q = query(
      collection(db, TASKS_COLLECTION), 
      where('eventId', '==', eventId)
    )
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as EventTask[]
  },

  /**
   * Creates a new task
   */
  async createTask(input: Omit<EventTask, 'id' | 'createdAt' | 'updatedAt' | 'isArchived'>, performedBy = 'System'): Promise<string> {
    const docRef = await addDoc(collection(db, TASKS_COLLECTION), {
      ...input,
      unreadByAssignee: true,
      isArchived: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })

    await auditService.logAction(
      'EVENT_TASK_CREATE',
      'system',
      `Created task '${input.title}' for event '${input.eventId}'`,
      performedBy,
      { taskId: docRef.id, eventId: input.eventId }
    )
    return docRef.id
  },

  /**
   * Updates an existing task
   */
  async updateTask(id: string, input: Partial<EventTask>, performedBy = 'System'): Promise<void> {
    const docRef = doc(db, TASKS_COLLECTION, id)
    // Always mark as unread upon update, unless the update explicitly sets it to false (e.g. when reading)
    const unreadByAssignee = input.unreadByAssignee !== undefined ? input.unreadByAssignee : true;
    const updateData = { ...input, unreadByAssignee, updatedAt: serverTimestamp() }
    delete updateData.id
    
    await updateDoc(docRef, updateData)

    await auditService.logAction(
      'EVENT_TASK_UPDATE',
      'system',
      `Updated task ID: ${id}`,
      performedBy,
      { taskId: id, updates: input }
    )
  },

  /**
   * Deletes a task
   */
  async deleteTask(id: string, performedBy = 'System'): Promise<void> {
    const docRef = doc(db, TASKS_COLLECTION, id)
    await deleteDoc(docRef)

    await auditService.logAction(
      'EVENT_TASK_DELETE',
      'system',
      `Deleted task ID: ${id}`,
      performedBy,
      { taskId: id }
    )
  },

  /**
   * Get checklists for a task
   */
  async getChecklistsByTaskId(taskId: string): Promise<EventChecklistItem[]> {
    const q = query(
      collection(db, CHECKLISTS_COLLECTION), 
      where('taskId', '==', taskId)
    )
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as EventChecklistItem[]
  },

  /**
   * Add a checklist item
   */
  async addChecklistItem(input: Omit<EventChecklistItem, 'id' | 'createdAt'>, performedBy = 'System'): Promise<string> {
    const docRef = await addDoc(collection(db, CHECKLISTS_COLLECTION), {
      ...input,
      createdAt: serverTimestamp()
    })

    await auditService.logAction(
      'EVENT_CHECKLIST_CREATE',
      'system',
      `Added checklist item '${input.title}' to task '${input.taskId}'`,
      performedBy,
      { checklistId: docRef.id, taskId: input.taskId }
    )
    return docRef.id
  },

  /**
   * Update a checklist item (e.g. toggle completed)
   */
  async updateChecklistItem(id: string, input: Partial<EventChecklistItem>, performedBy = 'System'): Promise<void> {
    const docRef = doc(db, CHECKLISTS_COLLECTION, id)
    const updateData = { ...input }
    delete updateData.id
    
    await updateDoc(docRef, updateData)

    await auditService.logAction(
      'EVENT_CHECKLIST_UPDATE',
      'system',
      `Updated checklist item ID: ${id}`,
      performedBy,
      { checklistId: id, updates: input }
    )
  }
}
