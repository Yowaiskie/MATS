import { collection, doc, getDoc, getDocs, onSnapshot, query, runTransaction, serverTimestamp, where, type Unsubscribe } from 'firebase/firestore'
import { auth, db } from '@/firebase/config'
import type { Event, EventAssignment, EventTask } from '@/types/event'
import type { UserProfile } from '@/types/auth'
import type { AppNotification } from '@/types/notification'
import { getTaskReminderStage, isActiveEventTask } from '@/utils/eventTaskNotifications'

export interface PersonalEventTask {
  task: EventTask
  event: Event
  recipient: string
}

export function taskNotice(task: EventTask, event: Event, recipient: string, type: 'event_task_assignment' | 'event_task_deadline' | 'event_task_reminder', stage?: AppNotification['reminderStage']) {
  const labels = { three_days: 'Due soon', one_day: 'Due tomorrow', due_today: 'Due today', overdue: 'Task overdue' }
  const title = type === 'event_task_assignment' ? 'New event task assignment' : type === 'event_task_deadline' ? 'Task deadline changed' : labels[stage!]
  return {
    type, title, message: `${task.title} — ${event.title}. ${task.dueDate ? `Deadline: ${task.dueDate}.` : 'No deadline set.'}`,
    priority: stage === 'overdue' ? 'urgent' : 'important', targetAudience: 'officers', targetMemberIds: [recipient],
    eventId: task.eventId, taskId: task.id, dueDate: task.dueDate || null,
    taskNotificationVersion: task.notificationVersion ?? 0,
    ...(stage ? { reminderStage: stage } : {}), deliveryMode: 'in_app_only',
    actionUrl: `/events/${encodeURIComponent(task.eventId)}?tab=tasks&task=${encodeURIComponent(task.id)}`,
    actionLabel: 'View Task', createdBy: auth.currentUser?.uid || task.createdByUid, createdByName: auth.currentUser?.displayName || 'MATS',
    createdAt: serverTimestamp(), readBy: []
  }
}

export const eventTaskNotificationService = {
  async resolveRecipient(task: Pick<EventTask, 'assignedMemberUid' | 'assignedMemberName' | 'eventId'>): Promise<string | null> {
    if (task.assignedMemberUid) return task.assignedMemberUid
    if (!task.assignedMemberName) return null
    const snapshot = await getDocs(query(collection(db, 'eventAssignments'), where('eventId', '==', task.eventId)))
    const recipients = new Set(snapshot.docs.map(d => d.data() as EventAssignment).filter(a => a.memberName === task.assignedMemberName).map(a => a.memberUid))
    return recipients.size === 1 ? [...recipients][0] : null
  },

  subscribeToPersonalTasks(profile: UserProfile, callback: (tasks: PersonalEventTask[]) => void): Unsubscribe {
    let stopped = false
    let revision = 0
    const unsubs: Unsubscribe[] = []
    const sources = new Map<string, EventTask[]>()
    let events = new Map<string, Event>()
    const ids = [...new Set([profile.uid, profile.memberId].filter((id): id is string => !!id))]
    const publish = async () => {
      const version = ++revision
      const candidates = [...new Map([...sources.values()].flat().map(t => [t.id, t])).values()]
      const personal = await Promise.all(candidates.map(async task => {
        const event = events.get(task.eventId)
        if (!event) return null
        const recipient = await this.resolveRecipient(task)
        return recipient && ids.includes(recipient) ? { task, event, recipient } : null
      }))
      if (!stopped && version === revision) callback(personal.filter((item): item is PersonalEventTask => !!item))
    }
    const reportError = (error: Error) => { console.warn('Event task notification subscription failed:', error); if (!stopped) callback([]) }
    const listen = (key: string, field: string, values: string[]) => {
      if (stopped || !values.length) return
      unsubs.push(onSnapshot(query(collection(db, 'eventTasks'), where(field, 'in', values)), snapshot => {
        sources.set(key, snapshot.docs.map(d => ({ ...d.data(), id: d.id }) as EventTask))
        void publish().catch(reportError)
      }, reportError))
    }
    unsubs.push(onSnapshot(collection(db, 'events'), snapshot => {
      events = new Map(snapshot.docs.map(d => [d.id, { ...d.data(), id: d.id } as Event]))
      void publish().catch(reportError)
    }, reportError))
    listen('ids', 'assignedMemberUid', ids)
    // Legacy names are only candidates; resolveRecipient verifies a unique team identity.
    void (async () => {
      const names = new Set([profile.displayName, profile.memberName].filter((name): name is string => !!name))
      if (profile.memberId) {
        const member = await getDoc(doc(db, 'members', profile.memberId))
        if (member.exists()) names.add(`${member.data().firstName} ${member.data().lastName}`)
      }
      listen('names', 'assignedMemberName', [...names])
    })().catch(reportError)
    return () => { stopped = true; revision++; unsubs.forEach(unsubscribe => unsubscribe()) }
  },

  async deliverReminder(item: PersonalEventTask, now = new Date()): Promise<void> {
    const recipient = item.recipient
    await runTransaction(db, async transaction => {
      const taskRef = doc(db, 'eventTasks', item.task.id)
      const [taskSnap, eventSnap] = await Promise.all([transaction.get(taskRef), transaction.get(doc(db, 'events', item.task.eventId))])
      if (!taskSnap.exists() || !eventSnap.exists()) return
      const task = { ...taskSnap.data(), id: taskSnap.id } as EventTask
      const event = { ...eventSnap.data(), id: eventSnap.id } as Event
      if (!isActiveEventTask(task, event) || task.assignedMemberName !== item.task.assignedMemberName || task.assignedMemberUid !== item.task.assignedMemberUid) return
      const stage = getTaskReminderStage(task.dueDate, now)
      if (!stage) return
      const key = JSON.stringify([task.notificationVersion ?? 0, recipient, task.dueDate, stage])
      const delivered = task.notificationDeliveryKeys ?? []
      if (delivered.includes(key)) return
      const noticeRef = doc(collection(db, 'notifications'))
      transaction.set(noticeRef, taskNotice(task, event, recipient, 'event_task_reminder', stage))
      transaction.update(taskRef, { notificationDeliveryKeys: [...delivered, key] })
    })
  }
}
