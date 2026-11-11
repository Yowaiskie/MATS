import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  getDocs, 
  query,
  where,
  serverTimestamp,
  getDoc,
  runTransaction
} from 'firebase/firestore'
import { db } from '@/firebase/config'
import type { Event, EventTask, EventChecklistItem } from '@/types/event'
import { auditService } from '@/services/auditService'
import { eventTaskNotificationService, taskNotice } from '@/services/eventTaskNotificationService'
import { isActiveEventTask } from '@/utils/eventTaskNotifications'

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
   * Marks all unread tasks for a specific event assigned to a user as read
   */
  async markTasksAsReadForEvent(eventId: string, displayName: string): Promise<void> {
    if (!eventId || !displayName) return
    try {
      const q = query(
        collection(db, TASKS_COLLECTION),
        where('eventId', '==', eventId),
        where('assignedMemberName', '==', displayName),
        where('unreadByAssignee', '==', true),
        where('isArchived', '==', false)
      )
      const snapshot = await getDocs(q)
      if (snapshot.empty) return

      const batchPromises = snapshot.docs.map(docSnap => 
        updateDoc(doc(db, TASKS_COLLECTION, docSnap.id), {
          unreadByAssignee: false,
          updatedAt: serverTimestamp()
        })
      )
      await Promise.all(batchPromises)
    } catch (err) {
      console.error('Failed to mark tasks as read:', err)
    }
  },

  /**
   * Creates a new task
   */
  async createTask(input: Omit<EventTask, 'id' | 'createdAt' | 'updatedAt' | 'isArchived'>, performedBy = 'System'): Promise<string> {
    const docRef = doc(collection(db, TASKS_COLLECTION))
    const task = { ...input, id: docRef.id, isArchived: false } as EventTask
    const recipient = await eventTaskNotificationService.resolveRecipient(task)
    await runTransaction(db, async transaction => {
      const eventSnap = await transaction.get(doc(db, 'events', input.eventId))
      if (!eventSnap.exists()) throw new Error('Event no longer exists.')
      const event = { ...eventSnap.data(), id: eventSnap.id } as Event
      transaction.set(docRef, { ...input, notificationDeliveryKeys: [], notificationVersion: 0, unreadByAssignee: true, isArchived: false, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
      if (recipient && isActiveEventTask(task, event)) {
        transaction.set(doc(collection(db, 'notifications')), taskNotice(task, event, recipient, 'event_task_assignment'))
      }
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
    
    delete updateData.notificationDeliveryKeys
    delete updateData.notificationVersion
    delete updateData.createdAt
    delete updateData.eventId
    const before = await getDoc(docRef)
    if (!before.exists()) throw new Error('Task no longer exists.')
    const original = { ...before.data(), id } as EventTask
    const next = { ...original, ...updateData } as EventTask
    const [oldRecipient, recipient] = await Promise.all([
      eventTaskNotificationService.resolveRecipient(original), eventTaskNotificationService.resolveRecipient(next)
    ])
    await runTransaction(db, async transaction => {
      const [currentSnap, eventSnap] = await Promise.all([transaction.get(docRef), transaction.get(doc(db, 'events', original.eventId))])
      if (!currentSnap.exists() || !eventSnap.exists()) throw new Error('Task or event no longer exists.')
      const current = { ...currentSnap.data(), id } as EventTask
      // Resolution was performed before the transaction: never notify from stale identity.
      if (current.assignedMemberUid !== original.assignedMemberUid || current.assignedMemberName !== original.assignedMemberName || current.dueDate !== original.dueDate) {
        throw new Error('Task changed while saving. Refresh and try again.')
      }
      const updated = { ...current, ...updateData } as EventTask
      const event = { ...eventSnap.data(), id: eventSnap.id } as Event
      const deadlineChanged = (updated.dueDate || null) !== (current.dueDate || null)
      const deliveryChanged = recipient !== oldRecipient || deadlineChanged
      if (deliveryChanged) updated.notificationVersion = (current.notificationVersion ?? 0) + 1
      transaction.update(docRef, { ...updateData, ...(deliveryChanged ? { notificationVersion: updated.notificationVersion, notificationDeliveryKeys: [] } : {}) })
      if (recipient && isActiveEventTask(updated, event)) {
        const type = recipient !== oldRecipient ? 'event_task_assignment' : deadlineChanged ? 'event_task_deadline' : null
        if (type) transaction.set(doc(collection(db, 'notifications')), taskNotice(updated, event, recipient, type))
      }
    })

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
