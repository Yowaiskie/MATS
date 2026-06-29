# Firestore Collections

## users

- uid
- email
- role
- createdAt
- updatedAt

---

## members

- id
- firstName
- middleName
- lastName
- suffix
- nickname
- rank
- status
- phoneNumber
- createdAt
- updatedAt

---

## schedules

- id
- title
- date
- startTime
- endTime
- status
- assignedMembers (array of document IDs)
- createdAt
- updatedAt

---

## attendanceSessions

- id
- scheduleId
- locked
- finalizedAt
- finalizedBy
- createdAt
- updatedAt

---

## attendance

- id
- sessionId
- memberId
- scheduleId
- status
- remarks
- attendanceDate
- createdAt
- updatedAt

---

Relationships

Member (references)
  ↓
Schedule (assignedMembers array)
  ↓
AttendanceSession (scheduleId reference)
  ↓
Attendance (references sessionId, scheduleId, memberId)

