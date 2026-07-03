import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  serverTimestamp 
} from 'firebase/firestore'
import { db } from '@/firebase/config'
import type { ScheduleTemplate, ScheduleTemplateInput } from '@/types/schedule'
import type { Member } from '@/types/member'
import { isTimeOverlapping } from '@/utils/scheduleUtils'
import { getFullName } from '@/utils/member'
import { scheduleService } from './scheduleService'

const TEMPLATES_COLLECTION = 'scheduleTemplates'

export const recurringService = {
  /**
   * Fetches all schedule templates from Firestore.
   */
  async getTemplates(): Promise<ScheduleTemplate[]> {
    const ref = collection(db, TEMPLATES_COLLECTION)
    const snapshot = await getDocs(ref)
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as ScheduleTemplate[]
  },

  /**
   * Adds a new schedule template.
   */
  async addTemplate(input: ScheduleTemplateInput): Promise<string> {
    const ref = collection(db, TEMPLATES_COLLECTION)
    const docRef = await addDoc(ref, {
      name: input.name.trim(),
      title: input.title.trim(),
      dayOfWeek: input.dayOfWeek,
      startTime: input.startTime,
      endTime: input.endTime,
      assignedMembers: input.assignedMembers || [],
      active: input.active,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })
    return docRef.id
  },

  /**
   * Updates an existing template.
   */
  async updateTemplate(id: string, input: Partial<ScheduleTemplateInput>): Promise<void> {
    const ref = doc(db, TEMPLATES_COLLECTION, id)
    const updateData: any = {
      updatedAt: serverTimestamp()
    }
    if (input.name !== undefined) updateData.name = input.name.trim()
    if (input.title !== undefined) updateData.title = input.title.trim()
    if (input.dayOfWeek !== undefined) updateData.dayOfWeek = input.dayOfWeek
    if (input.startTime !== undefined) updateData.startTime = input.startTime
    if (input.endTime !== undefined) updateData.endTime = input.endTime
    if (input.assignedMembers !== undefined) updateData.assignedMembers = input.assignedMembers
    if (input.active !== undefined) updateData.active = input.active

    await updateDoc(ref, updateData)
  },

  /**
   * Deletes a template.
   */
  async deleteTemplate(id: string): Promise<void> {
    const ref = doc(db, TEMPLATES_COLLECTION, id)
    await deleteDoc(ref)
  },

  /**
   * Helper to parse a standard CSV line handling optional quote encapsulations.
   */
  parseCSVLine(line: string): string[] {
    const result: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    result.push(current.trim())
    return result
  },

  /**
   * Matches a member's name against a list of active member profiles.
   * Matches either "FirstName LastName" or "LastName, FirstName" or "FirstNameLastName".
   */
  findMemberByName(name: string, activeMembers: Member[]): Member | undefined {
    const normalizedQuery = name.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
    if (!normalizedQuery) return undefined
    
    return activeMembers.find(m => {
      const fullName1 = `${m.firstName}${m.lastName}`.toLowerCase().replace(/[^a-z0-9]/g, '')
      const fullName2 = `${m.lastName}${m.firstName}`.toLowerCase().replace(/[^a-z0-9]/g, '')
      const fullName3 = `${m.lastName},${m.firstName}`.toLowerCase().replace(/[^a-z0-9]/g, '')
      const getFullNameStr = getFullName(m).toLowerCase().replace(/[^a-z0-9]/g, '')
      
      return normalizedQuery === fullName1 || 
             normalizedQuery === fullName2 || 
             normalizedQuery === fullName3 ||
             normalizedQuery === getFullNameStr
    })
  },

  /**
   * Generates weekly schedules based on selected templates and date range.
   * Skip duplicate schedules and logs validation errors.
   */
  async generateSchedules(
    startDate: string,
    endDate: string,
    templates: ScheduleTemplate[],
    allMembers: Member[]
  ): Promise<{ created: number; skipped: number; duplicates: number; validationErrors: string[] }> {
    const result = {
      created: 0,
      skipped: 0,
      duplicates: 0,
      validationErrors: [] as string[]
    }

    if (startDate > endDate) {
      result.validationErrors.push('Start Date must be before or equal to End Date.')
      return result
    }

    // Load all existing schedules to check for duplicate entries and assignment conflicts in memory
    const existingSchedules = await scheduleService.getSchedules()

    // Parse date bounds
    const start = new Date(startDate)
    const end = new Date(endDate)

    // Weekday names mapping
    const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

    // Iterate through each date in the range
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const currentWeekday = weekdays[d.getDay()]
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

      // Check templates matching this day of week
      const matchingTemplates = templates.filter(t => t.active && t.dayOfWeek === currentWeekday)

      for (const temp of matchingTemplates) {
        // 1. Time range check
        if (temp.startTime >= temp.endTime) {
          result.validationErrors.push(
            `Template "${temp.name}": Start time (${temp.startTime}) must be before end time (${temp.endTime}).`
          )
          result.skipped++
          continue
        }

        // 2. Duplicate schedule check (same title, date, startTime)
        const isDuplicate = existingSchedules.some(s => 
          s.title.toLowerCase() === temp.title.toLowerCase() &&
          s.date === dateStr &&
          s.startTime === temp.startTime
        )

        if (isDuplicate) {
          result.duplicates++
          result.skipped++
          continue
        }

        // 3. Validation for default assigned members (active check & conflict check)
        const validAssignedIds: string[] = []
        let hasConflict = false

        for (const memberId of temp.assignedMembers) {
          const member = allMembers.find(m => m.id === memberId)
          if (!member) {
            result.validationErrors.push(
              `Date ${dateStr} - Template "${temp.name}": Assigned member ID "${memberId}" not found.`
            )
            hasConflict = true
            break
          }
          if (member.status !== 'active') {
            result.validationErrors.push(
              `Date ${dateStr} - Template "${temp.name}": Member ${getFullName(member)} is archived and cannot be assigned.`
            )
            hasConflict = true
            break
          }

          // Check assignment overlap conflicts on this date
          const conflicting = existingSchedules.find(s => 
            s.date === dateStr &&
            s.status !== 'cancelled' &&
            s.assignedMembers.includes(memberId) &&
            isTimeOverlapping(temp.startTime, temp.endTime, s.startTime, s.endTime)
          )

          if (conflicting) {
            result.validationErrors.push(
              `Date ${dateStr} - Template "${temp.name}": Member ${getFullName(member)} is already assigned to "${conflicting.title}" (${conflicting.startTime} - ${conflicting.endTime}).`
            )
            hasConflict = true
            break
          }

          validAssignedIds.push(memberId)
        }

        if (hasConflict) {
          result.skipped++
          continue
        }

        // 4. Create the schedule doc in Firestore
        try {
          const newId = await scheduleService.addSchedule({
            title: temp.title,
            date: dateStr,
            startTime: temp.startTime,
            endTime: temp.endTime,
            status: 'upcoming',
            assignedMembers: validAssignedIds
          })

          // Add to in-memory list to catch conflicts in subsequent generator iterations
          existingSchedules.push({
            id: newId,
            title: temp.title,
            date: dateStr,
            startTime: temp.startTime,
            endTime: temp.endTime,
            status: 'upcoming',
            assignedMembers: validAssignedIds,
            createdAt: new Date(),
            updatedAt: new Date()
          })

          result.created++
        } catch (err: any) {
          result.validationErrors.push(`Failed to save generated schedule for date ${dateStr}: ${err.message}`)
          result.skipped++
        }
      }
    }

    return result
  },

  /**
   * Parses and validates CSV rows before saving.
   * Returns rows categorized as valid, invalid, duplicate, or having unknown members.
   */
  async validateCSV(
    csvText: string,
    allMembers: Member[]
  ): Promise<{
    validRows: any[]
    invalidRows: any[]
    duplicates: any[]
    unknownMembers: string[]
  }> {
    const result = {
      validRows: [] as any[],
      invalidRows: [] as any[],
      duplicates: [] as any[],
      unknownMembers: [] as string[]
    }

    const lines = csvText.split(/\r?\n/)
    if (lines.length <= 1) return result

    // Load existing schedules for duplicate/conflict checks
    const existingSchedules = await scheduleService.getSchedules()

    // Parse each row
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      const columns = this.parseCSVLine(line)
      if (columns.length < 4) {
        result.invalidRows.push({
          rowNum: i + 1,
          line,
          error: 'Format error: Missing columns (must have Title, Date, Start Time, End Time).'
        })
        continue
      }

      const title = columns[0]
      const date = columns[1]
      const startTime = columns[2]
      const endTime = columns[3]
      const membersStr = columns[4] || ''

      // Date format validation: simple YYYY-MM-DD check
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/
      if (!dateRegex.test(date)) {
        result.invalidRows.push({
          rowNum: i + 1,
          title,
          date,
          error: `Invalid date format "${date}" (must be YYYY-MM-DD).`
        })
        continue
      }

      // Time format validation: simple HH:MM check
      const timeRegex = /^\d{2}:\d{2}$/
      if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
        result.invalidRows.push({
          rowNum: i + 1,
          title,
          date,
          error: `Invalid time format (must be HH:MM).`
        })
        continue
      }

      if (startTime >= endTime) {
        result.invalidRows.push({
          rowNum: i + 1,
          title,
          date,
          error: `Start time (${startTime}) must be before end time (${endTime}).`
        })
        continue
      }

      // Duplicate schedule check (same title, date, startTime)
      const isDuplicate = existingSchedules.some(s => 
        s.title.toLowerCase() === title.toLowerCase() &&
        s.date === date &&
        s.startTime === startTime
      )

      if (isDuplicate) {
        result.duplicates.push({
          rowNum: i + 1,
          title,
          date,
          startTime,
          endTime
        })
        continue
      }

      // Parse members
      const memberNames = membersStr.split('|').map(n => n.trim()).filter(Boolean)
      const assignedIds: string[] = []
      const warnings: string[] = []
      let hasConflict = false
      let conflictMsg = ''

      for (const name of memberNames) {
        const matched = this.findMemberByName(name, allMembers)
        
        if (!matched) {
          warnings.push(name)
          if (!result.unknownMembers.includes(name)) {
            result.unknownMembers.push(name)
          }
          continue
        }

        if (matched.status !== 'active') {
          conflictMsg = `Member "${name}" is archived and cannot be assigned.`
          hasConflict = true
          break
        }

        // Check overlapping assignment conflicts on this date
        const conflicting = existingSchedules.find(s => 
          s.date === date &&
          s.status !== 'cancelled' &&
          s.assignedMembers.includes(matched.id) &&
          isTimeOverlapping(startTime, endTime, s.startTime, s.endTime)
        )

        if (conflicting) {
          conflictMsg = `Conflict: ${getFullName(matched)} is already assigned to "${conflicting.title}" (${conflicting.startTime} - ${conflicting.endTime}).`
          hasConflict = true
          break
        }

        assignedIds.push(matched.id)
      }

      if (hasConflict) {
        result.invalidRows.push({
          rowNum: i + 1,
          title,
          date,
          error: conflictMsg
        })
        continue
      }

      result.validRows.push({
        rowNum: i + 1,
        title,
        date,
        startTime,
        endTime,
        assignedMembers: assignedIds,
        memberNames: memberNames,
        warnings
      })
    }

    return result
  },

  /**
   * Commits the validated CSV rows to Firestore.
   */
  async importSchedules(validRows: any[]): Promise<number> {
    let importedCount = 0
    for (const row of validRows) {
      await scheduleService.addSchedule({
        title: row.title,
        date: row.date,
        startTime: row.startTime,
        endTime: row.endTime,
        status: 'upcoming',
        assignedMembers: row.assignedMembers
      })
      importedCount++
    }
    return importedCount
  }
}
