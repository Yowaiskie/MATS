export type NotificationType = 'attendance_reminder' | 'admin_broadcast' | 'system_alert'
export type NotificationPriority = 'urgent' | 'important' | 'info'
export type NotificationTarget = 'all' | 'officers' | 'admins'

export interface AppNotification {
  id: string
  type: NotificationType
  title: string
  message: string
  priority: NotificationPriority
  targetAudience: NotificationTarget
  targetMemberIds?: string[] // IDs of specific assigned members
  scheduleId?: string
  actionUrl?: string
  actionLabel?: string
  createdBy: string
  createdByName?: string
  createdAt: any
  expiresAt?: any // Timestamp or ISO string when the broadcast expires
  durationHours?: number // 0 = indefinite, 1, 6, 12, 24, 72, 168
  readBy?: string[] // UIDs who have marked as read
}

export interface ScheduleAttendanceAlert {
  scheduleId: string
  scheduleTitle: string
  date: string
  startTime: string
  endTime: string
  isAssignedToCurrentUser: boolean
  assignedMemberIds: string[]
  assignedMemberNames: string[]
  attendanceStatus: 'pending' | 'draft' | 'finalized'
}

export interface PushNotificationProgress {
  active: boolean
  current: number
  total: number
  percentage: number
  statusLabel: string
}
