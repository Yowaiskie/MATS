export type EventStage = 'Planning' | 'Preparation' | 'Ready' | 'Ongoing' | 'Completed' | 'Cancelled';
export type Priority = 'Low' | 'Medium' | 'High' | 'Critical';
export type TaskStatus = 'Not Started' | 'In Progress' | 'Waiting' | 'Blocked' | 'Completed' | 'Cancelled' | 'Overdue';

export interface Event {
  id: string;
  title: string;
  description: string;
  location: string;
  startDate: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  startTime?: string; // HH:MM
  endTime?: string; // HH:MM
  stage: EventStage;
  priority: Priority;
  headUid: string;
  headName: string;
  linkedScheduleId?: string;
  linkedFundRequestIds?: string[];
  createdByUid: string;
  createdByName: string;
  createdAt: any; // Firebase Timestamp
  updatedAt: any;
  isArchived: boolean;
}

export interface EventRole {
  id: string;
  eventId?: string; // If undefined, it's a global role. If defined, it's specific to an event.
  name: string; // e.g. "Head", "Logistics"
  description: string;
  createdAt: any;
}

export interface EventAssignment {
  id: string;
  eventId: string;
  memberUid: string;
  memberName: string;
  eventRoleId: string;
  eventRoleName: string;
  committeeName?: string;
  isHead: boolean; // Deprecated or mapped to isSubLeader
  isOverallHead?: boolean;
  isSubLeader?: boolean;
  assignedByUid: string;
  assignedByName: string;
  assignedAt: any;
}

export interface EventTask {
  id: string;
  eventId: string;
  title: string;
  description: string;
  priority: Priority;
  status: TaskStatus;
  assignedMemberUid: string | null;
  assignedMemberName: string | null;
  assignedRoleId: string | null;
  assignedRoleName: string | null;
  dependsOnTaskId: string | null;
  startDate: string | null; // YYYY-MM-DD
  dueDate: string | null; // YYYY-MM-DD
  estimatedHours: number | null;
  completedDate: string | null; // ISO string
  progressPercent: number; // 0-100
  createdByUid: string;
  createdByName: string;
  createdAt: any;
  updatedAt: any;
  isArchived: boolean;
  unreadByAssignee?: boolean;
}

export interface EventChecklistItem {
  id: string;
  taskId: string;
  eventId: string; // for easier global querying if needed
  title: string;
  completed: boolean;
  completedByUid: string | null;
  completedByName: string | null;
  completedAt: any | null;
  createdAt: any;
}

export interface EventTaskUpdate {
  id: string;
  taskId: string;
  eventId: string;
  message: string;
  progressPercent: number;
  authorUid: string;
  authorName: string;
  createdAt: any;
}

export interface EventComment {
  id: string;
  eventId: string;
  taskId?: string; // Optional: if present, it's a task comment, otherwise general event comment
  message: string;
  authorUid: string;
  authorName: string;
  mentions: string[]; // UIDs of mentioned users
  createdAt: any;
  updatedAt?: any;
}

export interface EventAttachment {
  id: string;
  eventId: string;
  taskId?: string;
  fileName: string;
  fileSize: number;
  contentType: string;
  downloadURL: string;
  storagePath: string;
  uploadedByUid: string;
  uploadedByName: string;
  uploadedAt: any;
}

export interface EventActivityLog {
  id: string;
  eventId: string;
  taskId?: string;
  action: string;
  description: string;
  performedByUid: string;
  performedByName: string;
  timestamp: any;
  metadata?: any;
}

export interface EventNotification {
  id: string;
  recipientUid: string;
  eventId: string;
  taskId?: string;
  title: string;
  message: string;
  type: 'TaskAssigned' | 'DeadlineNear' | 'TaskOverdue' | 'Mentioned' | 'EventUpdated' | 'EventCancelled' | 'TaskCompleted';
  isRead: boolean;
  isArchived: boolean;
  createdAt: any;
}
