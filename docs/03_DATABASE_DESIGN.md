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
- fullname
- community
- rank
- status
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

