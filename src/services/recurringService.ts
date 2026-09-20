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

// Helper for fuzzy string matching (typo tolerance)
function getLevenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          Math.min(
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1 // deletion
          )
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

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
    
    // Exact match first
    const exactMatch = activeMembers.find(m => {
      const rawFirst = (m.firstName || '').trim()
      const first = rawFirst.toLowerCase().replace(/[^a-z0-9]/g, '')
      const last = (m.lastName || '').toLowerCase().replace(/[^a-z0-9]/g, '')
      const middle = (m.middleName || '').toLowerCase().replace(/[^a-z0-9]/g, '')
      const suffix = (m.suffix || '').toLowerCase().replace(/[^a-z0-9]/g, '')
      
      const fullName1 = `${first}${last}`
      const fullName2 = `${last}${first}`
      const getFullNameStr = getFullName(m).toLowerCase().replace(/[^a-z0-9]/g, '')
      
      const firstMiddleLast = `${first}${middle}${last}`
      const firstMiddleLastSuffix = `${first}${middle}${last}${suffix}`
      const firstLastSuffix = `${first}${last}${suffix}`
      
      // Overlap checking: if query tokens match member's first or last name
      const queryTokens = name.toLowerCase().split(/\s+/).map((t: string) => t.replace(/[^a-z0-9]/g, '')).filter(Boolean)
      
      if (
        normalizedQuery === fullName1 || 
        normalizedQuery === fullName2 || 
        normalizedQuery === getFullNameStr ||
        normalizedQuery === firstMiddleLast ||
        normalizedQuery === firstMiddleLastSuffix ||
        normalizedQuery === firstLastSuffix ||
        queryTokens.includes(first) ||
        (last && queryTokens.includes(last))
      ) {
        return true
      }
      
      if (middle) {
        const middleInitial = middle.charAt(0)
        if (
          normalizedQuery === `${first}${middleInitial}${last}` ||
          normalizedQuery === `${first}${middleInitial}${last}${suffix}` ||
          normalizedQuery === `${last}${first}${middleInitial}` ||
          normalizedQuery === `${first}${last}${middleInitial}`
        ) {
          return true
        }
      }

      // Handle multi-word first names (e.g. "Llew Clarrence") where user only types the first word ("Llew Garcia")
      if (rawFirst.includes(' ')) {
        const firstWord = rawFirst.split(/\s+/)[0].toLowerCase().replace(/[^a-z0-9]/g, '')
        if (
          normalizedQuery === `${firstWord}${last}` ||
          normalizedQuery === `${last}${firstWord}` ||
          normalizedQuery === `${firstWord}${middle}${last}` ||
          normalizedQuery === `${firstWord}${last}${suffix}` ||
          queryTokens.includes(firstWord)
        ) {
          return true
        }
      }

      return false
    })

    if (exactMatch) return exactMatch

    // Fallback: Fuzzy matching allowing 1 letter difference (Levenshtein distance <= 1)
    // Only attempt fuzzy match if the query is reasonably long to prevent accidental matches on short names
    if (normalizedQuery.length >= 5) {
      const fuzzyMatch = activeMembers.find(m => {
        const first = (m.firstName || '').toLowerCase().replace(/[^a-z0-9]/g, '')
        const last = (m.lastName || '').toLowerCase().replace(/[^a-z0-9]/g, '')
        const middle = (m.middleName || '').toLowerCase().replace(/[^a-z0-9]/g, '')
        const suffix = (m.suffix || '').toLowerCase().replace(/[^a-z0-9]/g, '')

        const options = [
          `${first}${last}`,
          `${last}${first}`,
          getFullName(m).toLowerCase().replace(/[^a-z0-9]/g, ''),
          `${first}${middle}${last}`,
          `${first}${middle}${last}${suffix}`,
          `${first}${last}${suffix}`
        ]

        if (middle) {
          const middleInitial = middle.charAt(0)
          options.push(`${first}${middleInitial}${last}`)
          options.push(`${first}${middleInitial}${last}${suffix}`)
        }

        // Return true if any option has a distance of 1
        return options.some(opt => {
          // Optimization: only calculate if length diff is <= 1
          if (Math.abs(opt.length - normalizedQuery.length) <= 1) {
            return getLevenshteinDistance(normalizedQuery, opt) <= 1
          }
          return false
        })
      })

      if (fuzzyMatch) return fuzzyMatch
    }

    return undefined
  },

  /**
   * Generates weekly schedules based on selected templates and date range.
   * Skip duplicate schedules and logs validation errors.
   */
  async generateSchedules(
    startDate: string,
    endDate: string,
    templates: ScheduleTemplate[]
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

    // Parse date bounds cleanly avoiding UTC timezone offsets
    const [sY, sM, sD] = startDate.split('-').map(Number)
    const [eY, eM, eD] = endDate.split('-').map(Number)
    const start = new Date(sY, sM - 1, sD)
    const end = new Date(eY, eM - 1, eD)

    // Weekday names mapping
    const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

    // Iterate through each date in the range
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const currentWeekday = weekdays[d.getDay()]
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

      // Check templates matching this day of week (case-insensitive)
      const matchingTemplates = templates.filter(t => 
        (t.active === undefined || t.active === true) && 
        t.dayOfWeek.toLowerCase().trim() === currentWeekday.toLowerCase().trim()
      )

      for (const temp of matchingTemplates) {
        // Fallback for endTime if not explicitly set
        let slotEndTime = temp.endTime
        if (!slotEndTime || temp.startTime >= slotEndTime) {
          const [h, m] = temp.startTime.split(':').map(Number)
          const nextH = (h + 1) % 24
          slotEndTime = `${String(nextH).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}`
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

        // 4. Create the schedule doc in Firestore
        try {
          const newId = await scheduleService.addSchedule({
            title: temp.title,
            date: dateStr,
            startTime: temp.startTime,
            endTime: slotEndTime,
            status: 'upcoming',
            assignedMembers: []
          })

          // Add to in-memory list to catch conflicts in subsequent generator iterations
          existingSchedules.push({
            id: newId,
            title: temp.title,
            date: dateStr,
            startTime: temp.startTime,
            endTime: slotEndTime,
            status: 'upcoming',
            assignedMembers: [],
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
    allMembers: Member[],
    manualMemberMap?: Record<string, string>
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

    // ── Header-driven column resolution ──────────────────────────────────────
    // Parse the header row and locate each required column by name so that
    // any column order (or extra leading columns) works correctly.
    const headerColumns = this.parseCSVLine(lines[0]).map(h => h.toLowerCase().replace(/\s+/g, ''))

    const findCol = (...aliases: string[]): number => {
      for (const alias of aliases) {
        const idx = headerColumns.indexOf(alias)
        if (idx !== -1) return idx
      }
      return -1
    }

    const colTitle   = findCol('title', 'name', 'scheduletitle')
    const colDate    = findCol('date', 'scheduledate')
    const colStart   = findCol('starttime', 'start time', 'start', 'starttime')
    const colEnd     = findCol('endtime', 'end time', 'end', 'endtime')
    const colMembers = findCol('assignedmembers', 'assignedservers', 'members', 'servers', 'member', 'server')

    if (colTitle === -1 || colDate === -1 || colStart === -1 || colEnd === -1) {
      result.invalidRows.push({
        rowNum: 1,
        error: 'Header row must include: Title, Date, Start Time, End Time.'
      })
      return result
    }

    // Parse each row
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      const columns = this.parseCSVLine(line)
      if (columns.length <= Math.max(colTitle, colDate, colStart, colEnd)) {
        result.invalidRows.push({
          rowNum: i + 1,
          line,
          error: 'Format error: Missing columns (must have Title, Date, Start Time, End Time).'
        })
        continue
      }

      const title      = columns[colTitle]?.trim() || ''
      const date       = columns[colDate]?.trim() || ''
      const startTime  = columns[colStart]?.trim() || ''
      const endTime    = columns[colEnd]?.trim() || ''
      const membersStr = (colMembers !== -1 ? columns[colMembers] : '') || ''

      // Flexible date parsing — normalise to YYYY-MM-DD
      const parsedDate = this.parseFlexibleDate(date)
      if (!parsedDate) {
        result.invalidRows.push({
          rowNum: i + 1,
          title,
          date,
          error: `Unrecognised date "${date}". Accepted formats: YYYY-MM-DD, Month D YYYY, D Month YYYY, MM/DD/YYYY, etc.`
        })
        continue
      }
      const normalizedDate = parsedDate

      // Time format validation: simple HH:MM check
      const timeRegex = /^\d{2}:\d{2}$/
      if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
        result.invalidRows.push({
          rowNum: i + 1,
          title,
          date: normalizedDate,
          error: `Invalid time format (must be HH:MM).`
        })
        continue
      }

      if (startTime >= endTime) {
        result.invalidRows.push({
          rowNum: i + 1,
          title,
          date: normalizedDate,
          error: `Start time (${startTime}) must be before end time (${endTime}).`
        })
        continue
      }

      // Identify if this is an update (same title, date, startTime)
      const existingSchedule = existingSchedules.find(s =>
        s.title.toLowerCase() === title.toLowerCase() &&
        s.date === normalizedDate &&
        s.startTime === startTime
      )
      
      const isUpdate = !!existingSchedule
      const existingId = existingSchedule?.id

      // Parse members
      const memberNames = membersStr.split('|').map(n => n.trim()).filter(Boolean)
      const assignedIds: string[] = []
      const warnings: string[] = []
      let hasConflict = false
      let conflictMsg = ''

      for (const name of memberNames) {
        let matched = this.findMemberByName(name, allMembers)
        
        // If a manual mapping exists for this unmatched name, use it
        if (!matched && manualMemberMap && manualMemberMap[name]) {
          matched = allMembers.find(m => m.id === manualMemberMap[name])
        }

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

        // Check overlapping assignment conflicts on this date (ignore self if updating)
        const conflicting = existingSchedules.find(s =>
          s.date === normalizedDate &&
          s.status !== 'cancelled' &&
          s.assignedMembers.includes(matched!.id) &&
          s.id !== existingId &&
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
          date: normalizedDate,
          error: conflictMsg
        })
        continue
      }

      result.validRows.push({
        rowNum: i + 1,
        title,
        date: normalizedDate,
        startTime,
        endTime,
        assignedMembers: assignedIds,
        memberNames: memberNames,
        warnings,
        isUpdate,
        existingId
      })
    }

    return result
  },

  /**
   * Commits the validated CSV rows to Firestore.
   */
  async importSchedules(validRows: any[]): Promise<{ created: number; updated: number }> {
    let createdCount = 0
    let updatedCount = 0
    for (const row of validRows) {
      if (row.isUpdate && row.existingId) {
        await scheduleService.updateSchedule(row.existingId, {
          title: row.title,
          date: row.date,
          startTime: row.startTime,
          endTime: row.endTime,
          assignedMembers: row.assignedMembers
        })
        updatedCount++
      } else {
        await scheduleService.addSchedule({
          title: row.title,
          date: row.date,
          startTime: row.startTime,
          endTime: row.endTime,
          status: 'upcoming',
          assignedMembers: row.assignedMembers
        })
        createdCount++
      }
    }
    return { created: createdCount, updated: updatedCount }
  },

  /**
   * Parses a wide variety of date string formats into YYYY-MM-DD.
   * Handles:
   *   - YYYY-MM-DD (ISO, pass-through)
   *   - Day-of-week prefix stripped: "Saturday, July 12, 2026" → "2026-07-12"
   *   - "Month D YYYY"  e.g. "July 12 2026" / "Jul 12, 2026"
   *   - "D Month YYYY"  e.g. "12 July 2026" / "12 Jul 2026"
   *   - MM/DD/YYYY, M/D/YYYY
   *   - DD/MM/YYYY (ambiguous — tried as MM/DD first; if month > 12 swaps)
   *   - MM-DD-YYYY, M-D-YYYY
   * Returns null when parsing fails.
   */
  parseFlexibleDate(raw: string): string | null {
    const MONTH_MAP: Record<string, number> = {
      january: 1,  jan: 1,
      february: 2, feb: 2,
      march: 3,    mar: 3,
      april: 4,    apr: 4,
      may: 5,
      june: 6,     jun: 6,
      july: 7,     jul: 7,
      august: 8,   aug: 8,
      september: 9,sep: 9,
      october: 10, oct: 10,
      november: 11,nov: 11,
      december: 12,dec: 12
    }

    const DAYS_OF_WEEK = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']

    const pad = (n: number) => String(n).padStart(2, '0')

    const toISO = (y: number, m: number, d: number): string | null => {
      if (y < 1900 || y > 2200) return null
      if (m < 1 || m > 12) return null
      if (d < 1 || d > 31) return null
      return `${y}-${pad(m)}-${pad(d)}`
    }

    // 1. Strip leading day-of-week (e.g. "Saturday, July 12, 2026" → "July 12, 2026")
    let s = raw.trim()
    const dowMatch = s.match(/^([a-zA-Z]+)[,\s]+(.+)$/)
    if (dowMatch && DAYS_OF_WEEK.includes(dowMatch[1].toLowerCase())) {
      s = dowMatch[2].trim()
    }

    // 2. ISO pass-through: YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const [y, m, d] = s.split('-').map(Number)
      return toISO(y, m, d)
    }

    // 3. Named month formats
    // "Month D[,] YYYY" or "Month D[,] YY"
    const mdy = s.match(/^([a-zA-Z]+)\s+(\d{1,2})[,\s]+(\d{2,4})$/)
    if (mdy) {
      const m = MONTH_MAP[mdy[1].toLowerCase()]
      const d = parseInt(mdy[2], 10)
      let y = parseInt(mdy[3], 10)
      if (y < 100) y += y < 50 ? 2000 : 1900
      if (m) return toISO(y, m, d)
    }

    // "D Month YYYY"
    const dmy = s.match(/^(\d{1,2})\s+([a-zA-Z]+)[,\s]+(\d{2,4})$/)
    if (dmy) {
      const d = parseInt(dmy[1], 10)
      const m = MONTH_MAP[dmy[2].toLowerCase()]
      let y = parseInt(dmy[3], 10)
      if (y < 100) y += y < 50 ? 2000 : 1900
      if (m) return toISO(y, m, d)
    }

    // "Month D" (no year — assume current year)
    const mdNoYear = s.match(/^([a-zA-Z]+)\s+(\d{1,2})$/)
    if (mdNoYear) {
      const m = MONTH_MAP[mdNoYear[1].toLowerCase()]
      const d = parseInt(mdNoYear[2], 10)
      const y = new Date().getFullYear()
      if (m) return toISO(y, m, d)
    }

    // 4. Numeric slash/dash formats: MM/DD/YYYY, DD/MM/YYYY, MM-DD-YYYY
    const numSlash = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/)
    if (numSlash) {
      let [, a, b, cStr] = numSlash
      let y = parseInt(cStr, 10)
      if (y < 100) y += y < 50 ? 2000 : 1900
      const n1 = parseInt(a, 10)
      const n2 = parseInt(b, 10)
      // If first number > 12 it must be DD/MM
      if (n1 > 12) return toISO(y, n2, n1)
      // Otherwise treat as MM/DD
      return toISO(y, n1, n2)
    }

    // 5. YYYY/MM/DD or YYYY-M-D variants not caught by ISO pass-through
    const ymd = s.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/)
    if (ymd) {
      return toISO(parseInt(ymd[1], 10), parseInt(ymd[2], 10), parseInt(ymd[3], 10))
    }

    return null
  },

  /**
   * Parses CSV content specifically to extract assigned servers grouped by Schedule Slots (Title, DayOfWeek, Time).
   * This is used by the Template Manager to import/assign server lists directly to Schedule Templates.
   */
  async extractTemplateAssignmentsFromCSV(
    csvText: string,
    activeMembers: Member[],
    manualMemberMap: Record<string, string> = {}
  ): Promise<{
    slots: Array<{
      key: string
      name: string
      title: string
      dayOfWeek: string
      startTime: string
      endTime: string
      assignedMemberIds: string[]
      assignedMemberNames: string[]
      unknownNames: string[]
    }>
    unknownMembers: string[]
  }> {
    const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0)
    if (lines.length === 0) return { slots: [], unknownMembers: [] }

    // Header inspection with flexible fallback column matching
    const headers = this.parseCSVLine(lines[0]).map(h => h.toLowerCase().trim())
    const titleIdx = headers.findIndex(h => h.includes('title') || h.includes('category') || h.includes('mass') || h.includes('event'))
    const dayIdx = headers.findIndex(h => h.includes('day') || h.includes('date'))
    const timeIdx = headers.findIndex(h => h.includes('time') || h.includes('start'))
    const endIdx = headers.findIndex(h => h.includes('end'))
    const assignedIdx = headers.findIndex(h => h.includes('server') || h.includes('member') || h.includes('assigned') || h.includes('name'))

    if (assignedIdx === -1 || (timeIdx === -1 && dayIdx === -1)) {
      throw new Error('Invalid CSV structure. Missing required columns (Day/Date, Time, Server Name).')
    }

    const parseTimeTo24 = (timeStr: string): string => {
      if (!timeStr) return '08:00'
      const clean = timeStr.trim().toUpperCase()
      const match = clean.match(/^(\d{1,2}):?(\d{2})?\s*(AM|PM)?$/)
      if (!match) return timeStr
      let h = parseInt(match[1], 10)
      const m = match[2] || '00'
      const ampm = match[3]
      if (ampm === 'PM' && h < 12) h += 12
      if (ampm === 'AM' && h === 12) h = 0
      return `${String(h).padStart(2, '0')}:${m}`
    }

    const parseEndTimeTo24 = (startTime24: string): string => {
      const [h, m] = startTime24.split(':').map(Number)
      const nextH = (h + 1) % 24
      return `${String(nextH).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}`
    }

    const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const weekdayMap: Record<string, string> = {
      sun: 'Sunday', sunday: 'Sunday',
      mon: 'Monday', monday: 'Monday',
      tue: 'Tuesday', tues: 'Tuesday', tuesday: 'Tuesday',
      wed: 'Wednesday', wednesday: 'Wednesday',
      thu: 'Thursday', thur: 'Thursday', thurs: 'Thursday', thursday: 'Thursday',
      fri: 'Friday', friday: 'Friday',
      sat: 'Saturday', saturday: 'Saturday'
    }
    
    // Grouping map by slotKey: `${title}_${dayOfWeek}_${startTime}`
    const slotMap: Record<string, {
      key: string
      name: string
      title: string
      dayOfWeek: string
      startTime: string
      endTime: string
      memberIdSet: Set<string>
      memberNameMap: Map<string, string> // id -> name
      unknownNamesSet: Set<string>
    }> = {}

    const globalUnknowns = new Set<string>()

    for (let i = 1; i < lines.length; i++) {
      const cols = this.parseCSVLine(lines[i])
      if (cols.length === 0) continue

      let rawCategory = (titleIdx !== -1 ? cols[titleIdx] : '')?.trim() || ''
      let rawDay = (dayIdx !== -1 ? cols[dayIdx] : '')?.trim() || ''
      let rawTime = (timeIdx !== -1 ? cols[timeIdx] : '')?.trim() || ''
      let rawEnd = (endIdx !== -1 ? cols[endIdx] : '')?.trim() || ''
      const assignedRaw = (assignedIdx !== -1 ? cols[assignedIdx] : '')?.trim() || ''

      if (!assignedRaw) continue

      // Resolve Day of Week
      let dayOfWeek = 'Sunday'
      if (rawDay) {
        const dClean = rawDay.toLowerCase().trim()
        if (weekdayMap[dClean]) {
          dayOfWeek = weekdayMap[dClean]
        } else {
          const normalizedDate = this.parseFlexibleDate(rawDay)
          if (normalizedDate) {
            const d = new Date(normalizedDate)
            if (!isNaN(d.getTime())) dayOfWeek = weekdays[d.getDay()]
          }
        }
      }

      // Resolve Title
      let title = rawCategory || `${dayOfWeek} Mass`
      if (title.toLowerCase() === 'sunday' || title.toLowerCase() === 'weekday') {
        title = `${title.charAt(0).toUpperCase() + title.slice(1)} Mass`
      }

      // Resolve Times
      const startTime = parseTimeTo24(rawTime)
      const endTime = rawEnd ? parseTimeTo24(rawEnd) : parseEndTimeTo24(startTime)

      const slotKey = `${title.toLowerCase()}_${dayOfWeek.toLowerCase()}_${startTime}`
      
      if (!slotMap[slotKey]) {
        slotMap[slotKey] = {
          key: slotKey,
          name: `${title} (${startTime})`,
          title,
          dayOfWeek,
          startTime,
          endTime,
          memberIdSet: new Set<string>(),
          memberNameMap: new Map<string, string>(),
          unknownNamesSet: new Set<string>()
        }
      }

      const slot = slotMap[slotKey]

      const rawNames = assignedRaw.split(/[|;]/).map(n => n.trim()).filter(Boolean)
      for (const rawName of rawNames) {
        let foundMember: Member | undefined
        if (manualMemberMap[rawName]) {
          foundMember = activeMembers.find(m => m.id === manualMemberMap[rawName])
        } else {
          foundMember = this.findMemberByName(rawName, activeMembers)
        }

        if (foundMember) {
          slot.memberIdSet.add(foundMember.id)
          slot.memberNameMap.set(foundMember.id, getFullName(foundMember))
        } else {
          slot.unknownNamesSet.add(rawName)
          globalUnknowns.add(rawName)
        }
      }
    }

    const slots = Object.values(slotMap).map(slot => ({
      key: slot.key,
      name: slot.name,
      title: slot.title,
      dayOfWeek: slot.dayOfWeek,
      startTime: slot.startTime,
      endTime: slot.endTime,
      assignedMemberIds: Array.from(slot.memberIdSet),
      assignedMemberNames: Array.from(slot.memberNameMap.values()),
      unknownNames: Array.from(slot.unknownNamesSet)
    }))

    return {
      slots,
      unknownMembers: Array.from(globalUnknowns)
    }
  }
}

