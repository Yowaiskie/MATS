import type { Schedule, ScheduleStatus, ScheduleTemplate } from '@/types/schedule'
import type { SchedulePublication } from '@/types/publication'
import type { Member } from '@/types/member'

/**
 * Dynamically computes a schedule's status based on current system time,
 * unless it has been explicitly marked as 'cancelled'.
 * 
 * Note: Version 1 time comparison assumes same-day bounds.
 * Schedules crossing midnight (e.g. 23:00 to 01:00) are not supported.
 */
export const getScheduleStatus = (
  schedule: Pick<Schedule, 'date' | 'startTime' | 'endTime' | 'status'>
): ScheduleStatus => {
  if (schedule.status === 'cancelled') {
    return 'cancelled'
  }

  const now = new Date()
  
  // Format local date YYYY-MM-DD
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const todayStr = `${year}-${month}-${day}`
  
  // Format local time HH:MM
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const currentTimeStr = `${hours}:${minutes}`

  if (schedule.date < todayStr) {
    return 'completed'
  } else if (schedule.date > todayStr) {
    return 'upcoming'
  } else {
    // Dates are equal, check time boundaries
    if (currentTimeStr < schedule.startTime) {
      return 'upcoming'
    } else if (currentTimeStr >= schedule.startTime && currentTimeStr <= schedule.endTime) {
      return 'ongoing'
    } else {
      return 'completed'
    }
  }
}

/**
 * Core validation logic to detect overlap between two schedules on the same day.
 * Overlap formula: startA < endB && startB < endA
 * 
 * Note: Does not support schedules crossing midnight.
 */
export const isTimeOverlapping = (
  startA: string,
  endA: string,
  startB: string,
  endB: string
): boolean => {
  return startA < endB && startB < endA
}

/**
 * Determines whether a schedule title represents a Holy Hour or Adoration devotion.
 */
export const isHolyHourSchedule = (title?: string): boolean => {
  if (!title) return false
  const lower = title.toLowerCase().trim()
  return (
    lower.includes('holy hour') ||
    lower.includes('holyhour') ||
    lower.includes('hora santa') ||
    lower.includes('adoration') ||
    lower.includes('benediction') ||
    lower.includes('santissimo') ||
    lower.includes('santissmo')
  )
}

/**
 * Determines whether a schedule title represents a meeting, formation, or rehearsal.
 */
export const isMeetingSchedule = (title?: string): boolean => {
  if (!title) return false
  const lower = title.toLowerCase().trim()
  return (
    lower.includes('meeting') ||
    lower.includes('formation') ||
    lower.includes('assembly') ||
    lower.includes('practice') ||
    lower.includes('rehearsal') ||
    lower.includes('orientation') ||
    lower.includes('pulong') ||
    lower.includes('workshop')
  )
}

/**
 * Determines whether a schedule title or category represents a Baptism / Binyag service.
 */
export const isBaptismSchedule = (
  schedule?: { title?: string; category?: string } | null
): boolean => {
  if (!schedule) return false
  const cat = (schedule.category || '').toLowerCase().trim()
  if (cat === 'binyag' || cat === 'baptism') return true
  const title = (schedule.title || '').toLowerCase().trim()
  return (
    title.includes('binyag') ||
    title.includes('baptism') ||
    title.includes('bautismo')
  )
}

/**
 * Detects whether a schedule is one of the corrupted legacy TEST dummy schedules.
 * Specifically checks for dummy test markers without template association, while preserving
 * legitimate Masses (such as "Testimony Mass", "Testimonial Service", "Test of Faith Mass", etc.).
 */
export const isCorruptedLegacyTestSchedule = (schedule?: {
  title?: string
  templateId?: string
  metadata?: any
  category?: string
} | null): boolean => {
  if (!schedule) return false

  // 1. Explicit test metadata flags
  if (schedule.metadata?.isTest === true || schedule.metadata?.isTestGenerated === true) {
    return true
  }

  // 2. If it has a legitimate templateId from active parish templates, it is an official templated Mass
  if (schedule.templateId) {
    return false
  }

  const rawTitle = (schedule.title || '').trim()
  if (!rawTitle) return false
  const titleLower = rawTitle.toLowerCase()

  // 3. Exact match for dummy title 'test' or 'test mass'
  if (titleLower === 'test' || titleLower === 'test mass') {
    return true
  }

  // 4. Dummy test patterns: "TEST - 6:00 PM", "TEST (Slot)", "TEST [Daily]", "TEST: Slot", "TEST #1"
  // Does NOT match real words like "testimony", "testimonial", "testament", or phrases like "test of faith"
  const dummyPlaceholderPattern = /^test\s*([-:#/]\s*\d+|[-:#/]\s*[a-z0-9]|\(.*\)|\[.*\]|#\d+|\s+(slot|run|dummy|placeholder|debug|auto|gen\b))/i
  if (dummyPlaceholderPattern.test(rawTitle)) {
    return true
  }

  return false
}

/**
 * Determines whether a schedule is a Sunday Mass or a Saturday Anticipated Sunday Mass.
 * Saturday masses at or after 5:00 PM (17:00), or titled with 'anticipated' or evening time (e.g. 6pm / 6:00),
 * are categorized as Sunday (Anticipated) Mass.
 */
export const isSundayOrAnticipatedMass = (
  title: string,
  dateStr: string,
  startTime?: string
): boolean => {
  const titleLower = (title || '').toLowerCase().trim()

  // 1. Exclude corrupted test or debug schedules and baptism services
  if (isCorruptedLegacyTestSchedule({ title }) || isBaptismSchedule({ title })) {
    return false
  }

  // 2. Direct title check for 'anticipated'
  if (titleLower.includes('anticipated')) {
    return true
  }

  if (!dateStr) return false

  // 3. Parse YYYY-MM-DD in local time
  const parts = dateStr.split('-')
  if (parts.length < 3) return false

  const year = parseInt(parts[0], 10)
  const month = parseInt(parts[1], 10)
  const day = parseInt(parts[2], 10)

  if (isNaN(year) || isNaN(month) || isNaN(day)) return false

  const localDate = new Date(year, month - 1, day, 12, 0, 0)
  const dayOfWeek = localDate.getDay() // 0 = Sunday, 6 = Saturday

  const normTime = startTime ? startTime.trim().slice(0, 5) : ''

  // 4. Saturday evening / anticipated masses (5:00 PM / 17:00 or later, or official anticipated slot)
  if (dayOfWeek === 6) {
    if (normTime) {
      if (isOfficialRegularMassSlot(6, normTime)) {
        return true
      }
      const timeParts = normTime.split(':')
      const hours = parseInt(timeParts[0], 10)
      if (!isNaN(hours) && hours >= 17) {
        return true
      }
    }

    if (
      titleLower.includes('6:00') ||
      titleLower.includes('6pm') ||
      titleLower.includes('6 pm') ||
      titleLower.includes('5:00') ||
      titleLower.includes('5pm') ||
      titleLower.includes('5 pm') ||
      titleLower.includes('evening')
    ) {
      return true
    }
  }

  // 5. Sunday dates
  if (dayOfWeek === 0) {
    if (normTime) {
      // If start time is provided, verify it is an official Sunday regular mass or explicitly titled Sunday Mass
      if (isOfficialRegularMassSlot(0, normTime)) {
        return true
      }
      return (
        titleLower.includes('sunday mass') ||
        titleLower.includes('linggo') ||
        titleLower.includes('misa ng linggo')
      )
    }
    return true
  }

  return false
}

/**
 * Determines whether a requested slot summary (which may not contain a specific YYYY-MM-DD date)
 * represents a Sunday or Anticipated Mass slot based on dayOfWeek, dayName, title, and startTime.
 */
export const isSundaySlotSummary = (summary: {
  dayOfWeek?: number
  dayName?: string
  title?: string
  startTime?: string
}): boolean => {
  if (summary.dayOfWeek === 0 || summary.dayName?.toLowerCase() === 'sunday') {
    return true
  }
  const titleLower = (summary.title || '').toLowerCase().trim()
  if (titleLower.includes('anticipated') || titleLower.includes('sunday')) {
    return true
  }
  if (summary.dayOfWeek === 6 || summary.dayName?.toLowerCase() === 'saturday') {
    const normTime = summary.startTime ? summary.startTime.trim().slice(0, 5) : ''
    if (normTime) {
      const hours = parseInt(normTime.split(':')[0], 10)
      if (!isNaN(hours) && hours >= 17) return true
    }
    if (
      titleLower.includes('6:00') ||
      titleLower.includes('6pm') ||
      titleLower.includes('5:00') ||
      titleLower.includes('5pm') ||
      titleLower.includes('evening')
    ) {
      return true
    }
  }
  return false
}

export interface MemberQuotaStatus {
  sundayCount: number
  weekdayCount: number
  specialCount: number
  maxSundays: number
  maxWeekdays: number
  maxSpecial: number
  isSundayMaxed: boolean
  isWeekdayMaxed: boolean
  isSpecialMaxed: boolean
  isFullyMaxed: boolean
}

/**
 * Calculates whether an altar server has reached their quota limits for a publication
 * based on assigned pattern slots (official schedule assignments and provisional submissions).
 */
export const checkMemberQuotaStatus = (
  memberId: string,
  publication: Partial<SchedulePublication> | null | undefined,
  patterns: {
    sundayPatterns?: SchedulePattern[]
    weekdayPatterns?: SchedulePattern[]
    specialPatterns?: SchedulePattern[]
  }
): MemberQuotaStatus => {
  const isSpecialPub =
    publication?.publicationType === 'special_event' ||
    Boolean(publication?.enableStreetLocation) ||
    Boolean(publication?.includedDaysOfWeek && publication.includedDaysOfWeek.length > 0)

  const sundayPatterns = patterns.sundayPatterns || []
  const weekdayPatterns = patterns.weekdayPatterns || []
  const specialPatterns = patterns.specialPatterns || []

  if (isSpecialPub) {
    const isActualSpecialEvent = publication?.publicationType === 'special_event'
    const maxSpecial = isActualSpecialEvent
      ? (publication?.maxSpecialPerServer ?? 2)
      : (publication?.maxWeekdaysPerServer ?? 8)

    const specialCount = specialPatterns.filter(p => p.assignedMembers?.includes(memberId)).length
    const hasSpecial = specialPatterns.length > 0
    const isSpecialMaxed = hasSpecial && (specialCount >= maxSpecial || specialCount >= specialPatterns.length)

    return {
      sundayCount: 0,
      weekdayCount: 0,
      specialCount,
      maxSundays: 0,
      maxWeekdays: 0,
      maxSpecial,
      isSundayMaxed: true,
      isWeekdayMaxed: true,
      isSpecialMaxed,
      isFullyMaxed: hasSpecial ? isSpecialMaxed : false
    }
  }

  const maxSundays = publication?.maxSundaysPerServer ?? 4
  const maxWeekdays = publication?.maxWeekdaysPerServer ?? 8

  const hasSun = sundayPatterns.length > 0
  const hasWk = weekdayPatterns.length > 0

  const sundayCount = sundayPatterns.filter(p => p.assignedMembers?.includes(memberId)).length
  const weekdayCount = weekdayPatterns.filter(p => p.assignedMembers?.includes(memberId)).length

  const isSundayMaxed = !hasSun || sundayCount >= maxSundays || (hasSun && sundayCount >= sundayPatterns.length)
  const isWeekdayMaxed = !hasWk || weekdayCount >= maxWeekdays || (hasWk && weekdayCount >= weekdayPatterns.length)

  const isFullyMaxed = (!hasSun && !hasWk)
    ? false
    : isSundayMaxed && isWeekdayMaxed

  return {
    sundayCount,
    weekdayCount,
    specialCount: 0,
    maxSundays,
    maxWeekdays,
    maxSpecial: 0,
    isSundayMaxed,
    isWeekdayMaxed,
    isSpecialMaxed: true,
    isFullyMaxed
  }
}

/**
 * Determines whether a schedule represents a special mass / event (e.g. Fiesta, Wedding, Funeral, Baccalaureate, Nativity, Solemnity, etc.)
 * that is not part of the standard recurring Sunday/Weekday service schedule.
 */
export const isSpecialEventOrService = (
  schedule: { title?: string; category?: string }
): boolean => {
  if (isBaptismSchedule(schedule)) {
    return true
  }
  if (schedule.category === 'mass_sunday' || schedule.category === 'mass_weekday') {
    return false
  }
  if (schedule.category === 'special_event' || schedule.category === 'practice' || schedule.category === 'other') {
    return true
  }
  const title = (schedule.title || '').toLowerCase().trim()
  if (!title) return false

  return (
    // General special mass markers
    title.includes('special mass') ||
    title.includes('special service') ||
    title.includes('special event') ||
    title.includes('special') ||
    title.includes('espesyal') ||
    title.includes('misa sa nayon') ||
    title.includes('misa sa kalye') ||
    title.includes('street mass') ||
    title.includes('sitio mass') ||
    title.includes('purok mass') ||
    title.includes('block rosary') ||

    // Marian & Solemn Feasts (e.g. Nativity of Mary, Immaculate Conception, Assumption)
    title.includes('nativity') ||
    title.includes('kapanganakan') ||
    title.includes('annunciation') ||
    title.includes('pagpapahayag') ||
    title.includes('assumption') ||
    title.includes('pag-aakyat') ||
    title.includes('pagaakyat') ||
    title.includes('immaculate conception') ||
    title.includes('inmaculada concepcion') ||
    title.includes('immaculada') ||
    title.includes('visitation') ||
    title.includes('pagdalaw') ||
    title.includes('transfiguration') ||
    title.includes('pagbabagong-anyo') ||
    title.includes('presentation') ||
    title.includes('paghahandog') ||
    title.includes('ascension') ||
    title.includes('pentecost') ||
    title.includes('pentekostes') ||
    title.includes('corpus christi') ||

    // Feasts, Fiestas, Processions & Solemnities
    title.includes('fiesta') ||
    title.includes('pista') ||
    title.includes('feast') ||
    title.includes('kapistahan') ||
    title.includes('kapiyestahan') ||
    title.includes('patronal') ||
    title.includes('solemnity') ||
    title.includes('pontifical') ||
    title.includes('procession') ||
    title.includes('misa mayor') ||
    title.includes('vigil') ||

    // Lent, Holy Week & Paschal Triduum
    title.includes('ash wednesday') ||
    title.includes('miyerkules ng abo') ||
    title.includes('semana santa') ||
    title.includes('holy week') ||
    title.includes('palm sunday') ||
    title.includes('palaspas') ||
    title.includes('maundy thursday') ||
    title.includes('hwebes santo') ||
    title.includes('good friday') ||
    title.includes('biyernes santo') ||
    title.includes('black saturday') ||
    title.includes('sabado de gloria') ||
    title.includes('easter vigil') ||
    title.includes('salubong') ||
    title.includes('chrism') ||

    // Advent & Christmas Specials
    title.includes('simbang gabi') ||
    title.includes('misa de gallo') ||
    title.includes('misa de aguinaldo') ||
    title.includes('dawn mass') ||

    // Devotions & Memorials
    title.includes('novena') ||
    title.includes('nobena') ||
    title.includes('triduum') ||
    title.includes('triduo') ||
    title.includes('memorial') ||
    title.includes('commemoration') ||
    title.includes('paggunita') ||
    title.includes('healing mass') ||

    // Sacramental & Occasional Masses
    title.includes('wedding') ||
    title.includes('kasal') ||
    title.includes('matrimony') ||
    title.includes('funeral') ||
    title.includes('libing') ||
    title.includes('requiem') ||
    title.includes('baccalaureate') ||
    title.includes('confirmation') ||
    title.includes('kumpil') ||
    title.includes('first communion') ||
    title.includes('unang pakikinabang') ||
    title.includes('binyag') ||
    title.includes('bautismo') ||
    title.includes('baptism') ||

    // Ceremonial & Milestone Masses
    title.includes('ordination') ||
    title.includes('ordinasyon') ||
    title.includes('installation') ||
    title.includes('thanksgiving mass') ||
    title.includes('pasasalamat') ||
    title.includes('jubilee') ||
    title.includes('anniversary') ||
    title.includes('anibersaryo') ||
    title.includes('send-off') ||
    title.includes('send off') ||
    title.includes('commissioning') ||
    title.includes('investiture') ||
    title.includes('investitura') ||
    title.includes('blessing') ||
    title.includes('pagbabasbas') ||
    title.includes('dedication') ||
    title.includes('concelebrated') ||
    title.includes('concelebration')
  )
}

/**
 * Checks if a schedule should be included in a Publication based on dynamic publication settings.
 */
export const isScheduleIncludedInPublication = (
  schedule: Pick<Schedule, 'title' | 'date' | 'startTime' | 'status'> & {
    id?: string
    publicationId?: string
    category?: string
    templateId?: string
  },
  publication?: Partial<SchedulePublication> | null
): boolean => {
  if (schedule.status === 'cancelled') return false

  // Strict publication ownership check if both have IDs
  if (schedule.publicationId && publication?.id && schedule.publicationId !== publication.id) {
    return false
  }

  // Publication date range filtering (if schedule has date and publication has dates)
  if (schedule.date && publication?.startDate && schedule.date < publication.startDate) {
    return false
  }
  if (schedule.date && publication?.endDate && schedule.date > publication.endDate) {
    return false
  }

  const title = schedule.title || ''
  const titleLower = title.toLowerCase().trim()

  // 1. Custom Excluded Keywords check
  if (publication?.customExcludedKeywords && publication.customExcludedKeywords.length > 0) {
    const isCustomExcluded = publication.customExcludedKeywords.some(kw => {
      const cleanKw = kw.trim().toLowerCase()
      return cleanKw.length > 0 && titleLower.includes(cleanKw)
    })
    if (isCustomExcluded) return false
  }

  // 2. Specific Days of Week check (e.g. Every Thursday only)
  if (publication?.includedDaysOfWeek && publication.includedDaysOfWeek.length > 0) {
    if (schedule.date) {
      const parts = schedule.date.split('-').map(Number)
      if (parts.length === 3) {
        const d = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0)
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
        const currentDayName = dayNames[d.getDay()]
        const isDayMatched = publication.includedDaysOfWeek.some(day => 
          day.toLowerCase().trim() === currentDayName.toLowerCase().trim()
        )
        if (!isDayMatched) return false
      }
    }
  }

  // If publication explicitly enables street locations or has includedDaysOfWeek, and schedule matches day filters, include it
  if (publication?.enableStreetLocation || (publication?.includedDaysOfWeek && publication.includedDaysOfWeek.length > 0)) {
    if (isBaptismSchedule(schedule)) return false
    return true
  }

  // 3. Dedicated Special Occasion / Event Publication Mode
  if (publication?.publicationType === 'special_event') {
    if (isHolyHourSchedule(title) && publication?.includeHolyHour === false) return false
    if (isMeetingSchedule(title) && publication?.includeMeetings === false) return false
    if (isBaptismSchedule(schedule)) return false
    return true
  }

  // 4. Regular Mass Cycle Publication Mode (Default)
  // Baptisms / Binyag are sacramental rotation services, never part of regular mass publications
  if (isBaptismSchedule(schedule)) {
    return false
  }

  if (schedule.category === 'holy_hour' || isHolyHourSchedule(title)) {
    return publication?.includeHolyHour ?? false
  }

  if (schedule.category === 'meeting' || isMeetingSchedule(title)) {
    return publication?.includeMeetings ?? false
  }

  if (schedule.category === 'special_event' || isSpecialEventOrService(schedule)) {
    return publication?.includeSpecialEvents ?? false
  }

  // Exclude corrupted legacy test schedules from regular publications
  if (isCorruptedLegacyTestSchedule(schedule)) {
    return false
  }

  const isSunday = isSundayOrAnticipatedMass(title, schedule.date, schedule.startTime)
  if (isSunday) {
    return publication?.includeSundays ?? true
  } else {
    return publication?.includeWeekdays ?? true
  }
}

/**
 * Converts a 24-hour time string (HH:MM) to a 12-hour AM/PM format.
 * @param time24 - e.g. "14:30"
 * @returns e.g. "2:30 PM"
 */
export const formatTime12Hour = (time24: string): string => {
  if (!time24) return ''
  const [hourStr, minuteStr] = time24.split(':')
  if (!hourStr || !minuteStr) return time24

  let hour = parseInt(hourStr, 10)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  
  hour = hour % 12
  if (hour === 0) hour = 12

  return `${hour}:${minuteStr} ${ampm}`
}

/**
 * Checks if a member is eligible to participate in a schedule publication.
 * If allowedRanks is configured in the publication, matches member's rank/order/position.
 * By default (if not configured or for Squires), Squires are excluded unless explicitly allowed.
 */
export const isMemberEligibleForPublication = (
  member: Pick<Member, 'status' | 'rank' | 'order' | 'position'>,
  publication?: Partial<SchedulePublication> | null,
  includeSuspended: boolean = false
): boolean => {
  if (member.status !== 'active' && (!includeSuspended || member.status !== 'suspended')) return false

  const r = (member.rank || '').trim().toLowerCase()
  const o = (member.order || '').trim().toLowerCase()
  const p = (member.position || '').trim().toLowerCase()

  const allowedRanks = publication?.allowedRanks
  if (allowedRanks && allowedRanks.length > 0) {
    return allowedRanks.some(allowed => {
      const target = allowed.trim().toLowerCase()
      return r.includes(target) || o.includes(target) || p.includes(target)
    })
  }

  // Default behavior when allowedRanks is not configured: active non-squires
  return !(r.includes('squire') || o.includes('squire') || p.includes('squire'))
}

/**
 * Calculates approximate duration in months between two YYYY-MM-DD date strings.
 */
export const calculateMonthsBetween = (start: string, end: string): number => {
  if (!start || !end) return 1
  const d1 = new Date(start)
  const d2 = new Date(end)
  const diffDays = Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays <= 35) return 1
  if (diffDays <= 75) return 2
  if (diffDays <= 110) return 3
  return Math.max(1, Math.round(diffDays / 30))
}

/**
 * Formats a YYYY-MM-DD date string with full or short day of week (e.g. "Tuesday, Sep 18, 2026").
 */
export const formatScheduleDateWithDay = (
  dateStr: string, 
  options: { shortDay?: boolean; shortMonth?: boolean } = {}
): string => {
  if (!dateStr) return ''
  const parts = dateStr.split('-')
  if (parts.length !== 3) return dateStr
  const year = parseInt(parts[0], 10)
  const month = parseInt(parts[1], 10)
  const day = parseInt(parts[2], 10)
  const dateObj = new Date(year, month - 1, day)
  if (isNaN(dateObj.getTime())) return dateStr

  const fullDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const shortDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

  const dayName = options.shortDay ? shortDays[dateObj.getDay()] : fullDays[dateObj.getDay()]
  const m = months[month - 1] || parts[1]

  return `${dayName}, ${m} ${day}, ${year}`
}

/**
 * Gets the maximum allowed servers of a specific rank for a given schedule slot in a publication.
 * Returns undefined if rank quotas are not enabled or not defined for this rank.
 */
export const getRankLimitForSlot = (
  publication: Partial<SchedulePublication> | null | undefined,
  rank: string | undefined,
  isSunday: boolean = false,
  isSpecial: boolean = false
): number | undefined => {
  if (!publication || !publication.enableRankQuotas || !rank) return undefined

  const normalizedRank = rank.trim()

  // 1. Special event specific quota
  if (isSpecial && publication.specialRankQuotas) {
    const matchedKey = Object.keys(publication.specialRankQuotas).find(
      k => k.toLowerCase() === normalizedRank.toLowerCase()
    )
    if (matchedKey && publication.specialRankQuotas[matchedKey] !== undefined) {
      return publication.specialRankQuotas[matchedKey]
    }
  }

  // 2. Sunday specific quota
  if (isSunday && publication.sundayRankQuotas) {
    const matchedKey = Object.keys(publication.sundayRankQuotas).find(
      k => k.toLowerCase() === normalizedRank.toLowerCase()
    )
    if (matchedKey && publication.sundayRankQuotas[matchedKey] !== undefined) {
      return publication.sundayRankQuotas[matchedKey]
    }
  }

  // 3. Weekday specific quota
  if (!isSunday && !isSpecial && publication.weekdayRankQuotas) {
    const matchedKey = Object.keys(publication.weekdayRankQuotas).find(
      k => k.toLowerCase() === normalizedRank.toLowerCase()
    )
    if (matchedKey && publication.weekdayRankQuotas[matchedKey] !== undefined) {
      return publication.weekdayRankQuotas[matchedKey]
    }
  }

  // 4. Default rank slot quotas
  if (publication.rankSlotQuotas) {
    const matchedKey = Object.keys(publication.rankSlotQuotas).find(
      k => k.toLowerCase() === normalizedRank.toLowerCase()
    )
    if (matchedKey && publication.rankSlotQuotas[matchedKey] !== undefined) {
      return publication.rankSlotQuotas[matchedKey]
    }
  }

  return undefined
}

export interface SlotRankBreakdownItem {
  rank: string
  current: number
  limit?: number
  isFull: boolean
}

/**
 * Computes rank breakdown for assigned members in a slot against publication rank limits.
 */
export const getSlotRankBreakdown = (
  assignedMemberIds: string[],
  members: Member[],
  publication?: Partial<SchedulePublication> | null,
  isSunday: boolean = false,
  isSpecial: boolean = false
): {
  items: SlotRankBreakdownItem[]
  isRankFull: (rank: string) => boolean
  counts: Record<string, number>
} => {
  const counts: Record<string, number> = {
    Chevaliers: 0,
    Paladins: 0,
    Squires: 0
  }

  const memberMap = new Map(members.map(m => [m.id, m]))
  assignedMemberIds.forEach(id => {
    const mem = memberMap.get(id)
    if (mem && mem.rank) {
      const r = mem.rank.trim()
      counts[r] = (counts[r] || 0) + 1
    }
  })

  const ranksToCheck = publication?.allowedRanks && publication.allowedRanks.length > 0
    ? publication.allowedRanks
    : ['Chevaliers', 'Paladins']

  const items: SlotRankBreakdownItem[] = ranksToCheck.map(r => {
    const current = counts[r] || 0
    const limit = getRankLimitForSlot(publication, r, isSunday, isSpecial)
    const isFull = limit !== undefined && current >= limit
    return { rank: r, current, limit, isFull }
  })

  const isRankFull = (rank: string): boolean => {
    const limit = getRankLimitForSlot(publication, rank, isSunday, isSpecial)
    if (limit === undefined) return false
    const current = counts[rank] || 0
    return current >= limit
  }

  return { items, isRankFull, counts }
}

/**
 * Resolves a publication's submission deadline epoch in milliseconds.
 * Prefers publication.submissionDeadlineMs if present and valid;
 * otherwise parses publication.submissionDeadline.
 */
export const getPublicationDeadlineMs = (publication?: Partial<SchedulePublication> | null): number | null => {
  if (!publication) return null

  if (typeof publication.submissionDeadlineMs === 'number' && !isNaN(publication.submissionDeadlineMs)) {
    return publication.submissionDeadlineMs
  }

  if (publication.submissionDeadline && publication.submissionDeadline.trim()) {
    const parsed = new Date(publication.submissionDeadline.trim())
    const ms = parsed.getTime()
    if (!isNaN(ms)) {
      return ms
    }
  }

  return null
}

/**
 * Checks if a publication's submission deadline has passed.
 * Accepts an optional referenceTime (Date or timestamp in ms) to support
 * trustworthy server-side validation or simulation.
 * Uses >= comparison so the exact deadline moment is treated as closed.
 */
export const isPublicationDeadlinePassed = (
  publication?: Partial<SchedulePublication> | null,
  referenceTime?: number | Date
): boolean => {
  const deadlineMs = getPublicationDeadlineMs(publication)
  if (deadlineMs === null) return false

  const refMs = referenceTime instanceof Date
    ? referenceTime.getTime()
    : typeof referenceTime === 'number'
      ? referenceTime
      : Date.now()

  return refMs >= deadlineMs
}

export interface CountdownResult {
  hasDeadline: boolean
  isExpired: boolean
  totalSecondsRemaining: number
  days: number
  hours: number
  minutes: number
  seconds: number
  formatted: string
}

/**
 * Computes remaining time until a publication's deadline for real-time countdown display.
 */
export const getCountdownTimeRemaining = (
  publication?: Partial<SchedulePublication> | null,
  referenceTime?: number | Date
): CountdownResult => {
  const deadlineMs = getPublicationDeadlineMs(publication)
  if (deadlineMs === null) {
    return {
      hasDeadline: false,
      isExpired: false,
      totalSecondsRemaining: 0,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      formatted: 'No deadline'
    }
  }

  const refMs = referenceTime instanceof Date
    ? referenceTime.getTime()
    : typeof referenceTime === 'number'
      ? referenceTime
      : Date.now()

  const diffMs = deadlineMs - refMs
  if (diffMs <= 0) {
    return {
      hasDeadline: true,
      isExpired: true,
      totalSecondsRemaining: 0,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      formatted: 'Deadline expired'
    }
  }

  const totalSecs = Math.floor(diffMs / 1000)
  const days = Math.floor(totalSecs / 86400)
  const hours = Math.floor((totalSecs % 86400) / 3600)
  const minutes = Math.floor((totalSecs % 3600) / 60)
  const seconds = totalSecs % 60

  const formatted = days > 0
    ? `${days}d ${hours}h ${minutes}m ${seconds}s left`
    : `${hours}h ${minutes}m ${seconds}s left`

  return {
    hasDeadline: true,
    isExpired: false,
    totalSecondsRemaining: totalSecs,
    days,
    hours,
    minutes,
    seconds,
    formatted
  }
}

// ============================================================================
// Official Regular Mass Slots & Grouping Utilities
// ============================================================================

export interface OfficialMassSlot {
  dayOfWeek: number // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  startTime: string // HH:MM
  label: string
  isSundayOrAnticipated: boolean
}

export const OFFICIAL_REGULAR_MASS_SLOTS: OfficialMassSlot[] = [
  // Saturday Anticipated Mass
  { dayOfWeek: 6, startTime: '18:00', label: 'Saturday 6:00 PM Anticipated Mass', isSundayOrAnticipated: true },

  // Sunday Regular Masses
  { dayOfWeek: 0, startTime: '06:00', label: 'Sunday 6:00 AM', isSundayOrAnticipated: true },
  { dayOfWeek: 0, startTime: '07:30', label: 'Sunday 7:30 AM', isSundayOrAnticipated: true },
  { dayOfWeek: 0, startTime: '09:00', label: 'Sunday 9:00 AM', isSundayOrAnticipated: true },
  { dayOfWeek: 0, startTime: '16:00', label: 'Sunday 4:00 PM', isSundayOrAnticipated: true },
  { dayOfWeek: 0, startTime: '17:30', label: 'Sunday 5:30 PM', isSundayOrAnticipated: true },
  { dayOfWeek: 0, startTime: '19:00', label: 'Sunday 7:00 PM', isSundayOrAnticipated: true },

  // Weekday Daily Morning Masses (Mon - Fri 6:00 AM)
  { dayOfWeek: 1, startTime: '06:00', label: 'Monday 6:00 AM', isSundayOrAnticipated: false },
  { dayOfWeek: 2, startTime: '06:00', label: 'Tuesday 6:00 AM', isSundayOrAnticipated: false },
  { dayOfWeek: 3, startTime: '06:00', label: 'Wednesday 6:00 AM', isSundayOrAnticipated: false },
  { dayOfWeek: 4, startTime: '06:00', label: 'Thursday 6:00 AM', isSundayOrAnticipated: false },
  { dayOfWeek: 5, startTime: '06:00', label: 'Friday 6:00 AM', isSundayOrAnticipated: false },

  // Weekday Evening Masses (Wed & Fri 6:00 PM)
  { dayOfWeek: 3, startTime: '18:00', label: 'Wednesday 6:00 PM', isSundayOrAnticipated: false },
  { dayOfWeek: 5, startTime: '18:00', label: 'Friday 6:00 PM', isSundayOrAnticipated: false }
]

export const isOfficialRegularMassSlot = (dayOfWeek: number, startTime: string): boolean => {
  const normTime = (startTime || '').trim().slice(0, 5)
  return OFFICIAL_REGULAR_MASS_SLOTS.some(
    s => s.dayOfWeek === dayOfWeek && s.startTime === normTime
  )
}

const CANONICAL_WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const

const DAY_OF_WEEK_ALIASES: Record<string, string> = {
  '0': 'sunday', sun: 'sunday', sunday: 'sunday', linggo: 'sunday',
  '1': 'monday', mon: 'monday', monday: 'monday', lunes: 'monday',
  '2': 'tuesday', tue: 'tuesday', tues: 'tuesday', tuesday: 'tuesday', martes: 'tuesday',
  '3': 'wednesday', wed: 'wednesday', weds: 'wednesday', wednesday: 'wednesday', miyerkules: 'wednesday',
  '4': 'thursday', thu: 'thursday', thur: 'thursday', thurs: 'thursday', thursday: 'thursday', huwebes: 'thursday',
  '5': 'friday', fri: 'friday', friday: 'friday', biyernes: 'friday',
  '6': 'saturday', sat: 'saturday', saturday: 'saturday', sabado: 'saturday'
}

/**
 * Normalizes a day-of-week name, abbreviation, or numeric index (0-6) to a lowercase canonical weekday string.
 */
export const normalizeDayOfWeek = (day: string | number | undefined | null): string => {
  if (typeof day === 'number') {
    return CANONICAL_WEEKDAYS[day] || ''
  }
  const clean = String(day ?? '').trim().toLowerCase().replace(/\.$/, '')
  return DAY_OF_WEEK_ALIASES[clean] || clean
}

/**
 * Returns the current date in YYYY-MM-DD format within the parish timezone (default: Asia/Manila).
 */
export const getParishTodayDate = (parishTimeZone = 'Asia/Manila'): string => {
  const now = new Date()
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: parishTimeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(now)
  } catch {
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
}

/**
 * Checks whether a schedule occurrence is historical / immutable.
 * An occurrence is historical if:
 * 1. It is explicitly locked (isLocked === true) or attendance is finalized (attendanceFinalized === true).
 * 2. An effectiveDate (YYYY-MM-DD) is provided and the schedule date is strictly before the effectiveDate.
 * 3. Its date and startTime are in the past relative to the parish timezone wall-clock time (even if status is stale as 'upcoming').
 */
export const isHistoricalScheduleOccurrence = (
  schedule: { date: string; startTime: string; status?: string; isLocked?: boolean; attendanceFinalized?: boolean; attendanceSessionFinalized?: boolean },
  effectiveDate?: string,
  parishTimeZone = 'Asia/Manila'
): boolean => {
  if (schedule.isLocked || schedule.attendanceFinalized || schedule.attendanceSessionFinalized || schedule.status === 'finalized' || schedule.status === 'completed') {
    return true
  }

  if (effectiveDate && schedule.date < effectiveDate) {
    return true
  }

  const now = new Date()
  let todayStr: string
  let currentTimeStr: string

  try {
    todayStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: parishTimeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(now)

    currentTimeStr = new Intl.DateTimeFormat('en-GB', {
      timeZone: parishTimeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(now)
  } catch {
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    todayStr = `${year}-${month}-${day}`
    const hours = String(now.getHours()).padStart(2, '0')
    const minutes = String(now.getMinutes()).padStart(2, '0')
    currentTimeStr = `${hours}:${minutes}`
  }

  if (schedule.date < todayStr) {
    return true
  }

  if (schedule.date === todayStr) {
    const cutoff = (schedule.startTime || '00:00').trim().slice(0, 5)
    if (cutoff <= currentTimeStr) {
      return true
    }
  }

  return schedule.status === 'completed'
}

export interface SchedulePattern {
  id: string
  date?: string
  dayOfWeek: number
  dayName: string
  startTime: string
  title?: string
  location?: string
  liturgicalColor?: string
  scheduleIds: string[]
  assignedMembers: string[]
  isSpecialEvent?: boolean
  templateId?: string
}

export interface GroupedPublicationPatterns {
  sundayPatterns: SchedulePattern[]
  weekdayPatterns: SchedulePattern[]
  specialPatterns: SchedulePattern[]
}

export interface GroupSchedulesOptions {
  activeTemplates?: ScheduleTemplate[]
  submissions?: Array<{
    memberId: string
    status: 'pending' | 'approved' | 'rejected'
    requestedScheduleIds: string[]
    slotSummaries?: Array<{
      scheduleIds?: string[]
      slotIndex?: number
      [key: string]: any
    }>
  }>
}

function applyProvisionalSubmissionsToPatterns(
  patterns: SchedulePattern[],
  submissions?: Array<{
    memberId: string
    status: 'pending' | 'approved' | 'rejected'
    requestedScheduleIds: string[]
    slotSummaries?: Array<{
      scheduleIds?: string[]
      slotIndex?: number
      [key: string]: any
    }>
  }>
) {
  if (!submissions || submissions.length === 0) return

  const activeSubmissions = submissions.filter(
    s => s.status === 'pending' || s.status === 'approved'
  )
  if (activeSubmissions.length === 0) return

  patterns.forEach(pattern => {
    const patternSchedSet = new Set(pattern.scheduleIds)
    const currentMembers = [...pattern.assignedMembers]

    for (const sub of activeSubmissions) {
      const isRequested = sub.requestedScheduleIds?.some(id => patternSchedSet.has(id))
      if (!isRequested) continue
      if (currentMembers.includes(sub.memberId)) continue

      const summary = sub.slotSummaries?.find(sm =>
        sm.scheduleIds?.some(id => patternSchedSet.has(id))
      )
      const slotIdx = summary?.slotIndex

      if (slotIdx !== undefined && slotIdx >= 0) {
        while (currentMembers.length <= slotIdx) {
          currentMembers.push('')
        }
        if (!currentMembers[slotIdx]) {
          currentMembers[slotIdx] = sub.memberId
        } else {
          const firstOpen = currentMembers.findIndex(m => !m)
          if (firstOpen !== -1) {
            currentMembers[firstOpen] = sub.memberId
          } else {
            currentMembers.push(sub.memberId)
          }
        }
      } else {
        const firstOpen = currentMembers.findIndex(m => !m)
        if (firstOpen !== -1) {
          currentMembers[firstOpen] = sub.memberId
        } else {
          currentMembers.push(sub.memberId)
        }
      }
    }

    pattern.assignedMembers = currentMembers
  })
}

/**
 * Groups publication schedules into recurring Sunday patterns, Weekday patterns, and Special patterns.
 * Excludes non-regular test schedules, isolates custom events into specialPatterns when enabled,
 * and preserves Saturday 6:00 PM Anticipated Mass and official Wednesday/Friday 6:00 PM Masses.
 * 
 * Dynamic template hook: When activeTemplates are provided (wired in Phase 4 via recurringService.getTemplates()),
 * they serve as the authoritative list of recurring templates. In the absence of loaded templates, official
 * parish slots (OFFICIAL_REGULAR_MASS_SLOTS) provide conservative fallback classification.
 */
export const groupSchedulesIntoPatterns = (
  schedules: Schedule[],
  publication?: Partial<SchedulePublication> | null,
  options?: GroupSchedulesOptions
): GroupedPublicationPatterns => {
  const isSpecialPub =
    publication?.publicationType === 'special_event' ||
    !!publication?.enableStreetLocation ||
    (publication?.includedDaysOfWeek && publication.includedDaysOfWeek.length > 0)

  if (isSpecialPub) {
    // For special events or dated street mass publications, group by each unique schedule slot chronologically
    const sortedSchedules = [...schedules]
      .filter(s => !isBaptismSchedule(s))
      .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date)
      return a.startTime.localeCompare(b.startTime)
    })

    const patternMap = new Map<string, SchedulePattern>()
    sortedSchedules.forEach(s => {
      const [y, m, d] = s.date.split('-').map(Number)
      const dObj = new Date(y, m - 1, d, 12, 0, 0)
      const dayOfWeek = isNaN(dObj.getTime()) ? 0 : dObj.getDay()
      const dayName = isNaN(dObj.getTime())
        ? s.date
        : dObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' }).toUpperCase()
      const patternKey = `${s.date}-${s.startTime}`

      if (!patternMap.has(patternKey)) {
        patternMap.set(patternKey, {
          id: s.id,
          date: s.date,
          dayOfWeek,
          dayName,
          startTime: s.startTime,
          title: s.title,
          location: s.location,
          liturgicalColor: s.liturgicalColor || publication?.liturgicalColor,
          scheduleIds: [s.id],
          assignedMembers: s.assignedMembers ? [...s.assignedMembers] : [],
          isSpecialEvent: true,
          templateId: s.templateId
        })
      } else {
        const existing = patternMap.get(patternKey)!
        if (!existing.scheduleIds.includes(s.id)) {
          existing.scheduleIds.push(s.id)
        }
        if (s.location && !existing.location) {
          existing.location = s.location
        }
        s.assignedMembers?.forEach(memId => {
          if (!existing.assignedMembers.includes(memId)) {
            existing.assignedMembers.push(memId)
          }
        })
      }
    })

    const specials = Array.from(patternMap.values())
    applyProvisionalSubmissionsToPatterns(specials, options?.submissions)
    return {
      sundayPatterns: [],
      weekdayPatterns: [],
      specialPatterns: specials
    }
  }

  // Regular Publication Mode
  const sundayMap = new Map<string, SchedulePattern>()
  const weekdayMap = new Map<string, SchedulePattern>()
  const specialMap = new Map<string, SchedulePattern>()

  schedules.forEach(s => {
    // 1. Exclude corrupted legacy test schedules and baptism services from all recurring mass grids
    if (isCorruptedLegacyTestSchedule(s) || isBaptismSchedule(s)) {
      return
    }

    // 2. Check if schedule is a special occasion, holy hour, or meeting
    const isSpecialCategory =
      s.category === 'special_event' ||
      s.category === 'holy_hour' ||
      s.category === 'meeting' ||
      isSpecialEventOrService(s) ||
      isHolyHourSchedule(s.title || '') ||
      isMeetingSchedule(s.title || '')

    if (isSpecialCategory) {
      // Only route to specialPatterns if enabled by publication settings
      const isAllowed =
        (s.category === 'holy_hour' || isHolyHourSchedule(s.title || '')) ? (publication?.includeHolyHour ?? false) :
        (s.category === 'meeting' || isMeetingSchedule(s.title || '')) ? (publication?.includeMeetings ?? false) :
        (publication?.includeSpecialEvents ?? false)

      if (isAllowed) {
        const [y, m, d] = s.date.split('-').map(Number)
        const dObj = new Date(y, m - 1, d, 12, 0, 0)
        const dayOfWeek = isNaN(dObj.getTime()) ? 0 : dObj.getDay()
        const dayName = isNaN(dObj.getTime())
          ? s.date
          : dObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' }).toUpperCase()
        const specialKey = `${s.date}-${s.startTime}`

        if (!specialMap.has(specialKey)) {
          specialMap.set(specialKey, {
            id: s.id,
            date: s.date,
            dayOfWeek,
            dayName,
            startTime: s.startTime,
            title: s.title,
            location: s.location,
            liturgicalColor: s.liturgicalColor || publication?.liturgicalColor,
            scheduleIds: [s.id],
            assignedMembers: s.assignedMembers ? [...s.assignedMembers] : [],
            isSpecialEvent: true,
            templateId: s.templateId
          })
        } else {
          const existing = specialMap.get(specialKey)!
          if (!existing.scheduleIds.includes(s.id)) {
            existing.scheduleIds.push(s.id)
          }
          if (s.location && !existing.location) {
            existing.location = s.location
          }
          s.assignedMembers?.forEach(memId => {
            if (!existing.assignedMembers.includes(memId)) {
              existing.assignedMembers.push(memId)
            }
          })
        }
      }
      return
    }

    // 3. Regular Sunday or Weekday Mass schedule
    const d = new Date(s.date + 'T00:00:00')
    const dayOfWeek = d.getDay()
    const normTime = (s.startTime || '').trim().slice(0, 5)

    // Check template match if active templates provided (dynamic template hook for Phase 4)
    let templateMatched = false
    if (options?.activeTemplates && options.activeTemplates.length > 0) {
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
      const matchedTemplate = options.activeTemplates.find(t => {
        if (s.templateId && t.id === s.templateId) return true
        const tDow = dayNames.indexOf(normalizeDayOfWeek(t.dayOfWeek))
        return tDow === dayOfWeek && (t.startTime || '').trim().slice(0, 5) === normTime
      })
      if (matchedTemplate && matchedTemplate.active !== false) {
        templateMatched = true
      }
    }

    // Check if this slot qualifies as an official regular mass slot
    const isOfficialSlot = isOfficialRegularMassSlot(dayOfWeek, normTime)

    // Conservative check: For recurring pattern grids, schedule must match official slot or active template
    // Or have an explicit regular Mass category/title (and not an unrecognized custom time)
    const qualifiesAsRegular = isOfficialSlot || templateMatched || (s.templateId !== undefined)

    if (!qualifiesAsRegular) {
      // If it doesn't match an official slot or template, do not leak into regular recurring grid
      return
    }

    const isSundayCycle = isSundayOrAnticipatedMass(s.title || '', s.date, s.startTime)
    const patternId = `${dayOfWeek}-${s.startTime}`
    const targetMap = isSundayCycle ? sundayMap : weekdayMap

    if (!targetMap.has(patternId)) {
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()
      targetMap.set(patternId, {
        id: patternId,
        dayOfWeek,
        dayName,
        startTime: s.startTime,
        title: s.title,
        location: s.location,
        liturgicalColor: s.liturgicalColor || publication?.liturgicalColor,
        scheduleIds: [],
        assignedMembers: [],
        templateId: s.templateId
      })
    }

    const pattern = targetMap.get(patternId)!
    if (!pattern.scheduleIds.includes(s.id)) {
      pattern.scheduleIds.push(s.id)
    }
    s.assignedMembers?.forEach(memId => {
      if (!pattern.assignedMembers.includes(memId)) {
        pattern.assignedMembers.push(memId)
      }
    })
  })

  const getSortWeight = (p: SchedulePattern) => {
    // Anticipated mass on Saturday goes before Sunday
    if (p.dayOfWeek === 6 && p.startTime >= '16:00') return -1
    return p.dayOfWeek
  }

  const sortPatterns = (patterns: SchedulePattern[]) => {
    return patterns.sort((a, b) => {
      const weightA = getSortWeight(a)
      const weightB = getSortWeight(b)
      if (weightA !== weightB) return weightA - weightB
      return a.startTime.localeCompare(b.startTime)
    })
  }

  const sundays = sortPatterns(Array.from(sundayMap.values()))
  const weekdays = sortPatterns(Array.from(weekdayMap.values()))
  const specials = Array.from(specialMap.values()).sort((a, b) => {
    if (a.date && b.date && a.date !== b.date) return a.date.localeCompare(b.date)
    return a.startTime.localeCompare(b.startTime)
  })

  applyProvisionalSubmissionsToPatterns(sundays, options?.submissions)
  applyProvisionalSubmissionsToPatterns(weekdays, options?.submissions)
  applyProvisionalSubmissionsToPatterns(specials, options?.submissions)

  return {
    sundayPatterns: sundays,
    weekdayPatterns: weekdays,
    specialPatterns: specials
  }
}
