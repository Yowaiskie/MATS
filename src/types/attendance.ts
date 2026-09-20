export type AttendanceStatus = 'present' | 'late' | 'absent' | 'excused' | 'observer' | 'formation' | 'alumni'

export type ScheduleAttendanceState = 'finalized' | 'in_progress' | 'untaken' | 'none'

export interface AttendanceSession {
  id: string
  scheduleId: string
  locked: boolean
  hasRecords?: boolean
  finalizedAt?: any // Firestore Timestamp or null
  finalizedBy?: string | null // admin email/UID
  lastUpdatedBy?: string | null
  lastUpdatedAt?: any // Firestore Timestamp or null
  createdAt: any
  updatedAt: any
}

export interface AttendanceRecord {
  id: string
  sessionId: string
  memberId: string
  scheduleId: string
  status: AttendanceStatus
  remarks: string
  attendanceDate: string // YYYY-MM-DD
  isOtherServer?: boolean
  createdAt: any
  updatedAt: any
}

export interface AttendanceInput {
  id?: string // Include if updating existing record
  memberId: string
  status: AttendanceStatus
  remarks?: string
  isOtherServer?: boolean
}
