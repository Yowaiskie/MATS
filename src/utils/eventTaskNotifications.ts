import type { Event, EventTask } from '@/types/event'
import type { UserProfile } from '@/types/auth'
import type { AppNotification } from '@/types/notification'

export function isOwnEventTask(task: EventTask, profile: Pick<UserProfile, 'uid' | 'memberId' | 'displayName'> | null | undefined): boolean {
  if (!profile) return false
  if (task.assignedMemberUid) return task.assignedMemberUid === profile.uid || task.assignedMemberUid === profile.memberId
  // Name-only tasks must first resolve to a unique team member ID.
  return false
}

export function isActiveEventTask(task: EventTask, event: Event | undefined): boolean {
  return !!event && !event.isArchived && !['Completed', 'Cancelled'].includes(event.stage) && !task.isArchived && !['Completed', 'Cancelled'].includes(task.status)
}

export function getTaskReminderStage(dueDate: string | null | undefined, now = new Date()): AppNotification['reminderStage'] | null {
  if (!dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return null
  const due = Date.parse(`${dueDate}T00:00:00Z`)
  if (!Number.isFinite(due) || new Date(due).toISOString().slice(0, 10) !== dueDate) return null
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
  const days = Math.round((due - Date.parse(`${today}T00:00:00Z`)) / 86400000)
  if (days < 0) return 'overdue'
  if (days === 0) return 'due_today'
  if (days === 1) return 'one_day'
  if (days <= 3) return 'three_days'
  return null
}
