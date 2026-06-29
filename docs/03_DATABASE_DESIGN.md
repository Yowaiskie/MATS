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
- time
- createdAt
- updatedAt

---

## scheduleAssignments

- id
- scheduleId
- memberId
- createdAt

---

## attendance

- id
- memberId
- scheduleId
- status
- remarks
- attendanceDate
- createdAt
- updatedAt

---

Relationships

Member

↓

Schedule Assignment

↓

Schedule

↓

Attendance

