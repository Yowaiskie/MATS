export type AttendanceStatus = 'present' | 'late' | 'absent' | 'excused'

export interface AttendanceSession {
  id: string
  scheduleId: string
  locked: boolean
  finalizedAt?: any // Firestore Timestamp or null
  finalizedBy?: string | null // admin email/UID
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
  createdAt: any
  updatedAt: any
}

export interface AttendanceInput {
  id?: string // Include if updating existing record
  memberId: string
  status: AttendanceStatus
  remarks?: string
}
