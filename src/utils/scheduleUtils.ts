import type { Schedule, ScheduleStatus } from '@/types/schedule'
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
 * Determines whether a schedule is a Sunday Mass or a Saturday Anticipated Sunday Mass.
 * Saturday masses at or after 5:00 PM (17:00), or titled with 'anticipated' or evening time (e.g. 6pm / 6:00),
 * are categorized as Sunday (Anticipated) Mass.
 */
export const isSundayOrAnticipatedMass = (
  title: string,
  dateStr: string,
  startTime?: string
): boolean => {
  const titleLower = title.toLowerCase()

  // 1. Direct title check for 'sunday' or 'anticipated'
  if (titleLower.includes('sunday') || titleLower.includes('anticipated')) {
    return true
  }

  if (!dateStr) return false

  // 2. Parse YYYY-MM-DD in local time
  const parts = dateStr.split('-')
  if (parts.length < 3) return false

  const year = parseInt(parts[0], 10)
  const month = parseInt(parts[1], 10)
  const day = parseInt(parts[2], 10)

  if (isNaN(year) || isNaN(month) || isNaN(day)) return false

  const localDate = new Date(year, month - 1, day)
  const dayOfWeek = localDate.getDay() // 0 = Sunday, 6 = Saturday

  // 3. Sunday dates
  if (dayOfWeek === 0) {
    return true
  }

  // 4. Saturday evening / anticipated masses (5:00 PM / 17:00 or later, or 6pm/6:00/evening in title)
  if (dayOfWeek === 6) {
    if (startTime) {
      const timeParts = startTime.split(':')
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

  return false
}

/**
 * Determines whether a schedule represents a special mass / event (e.g. Fiesta, Wedding, Funeral, Baccalaureate, Nativity, Solemnity, etc.)
 * that is not part of the standard recurring Sunday/Weekday service schedule.
 */
export const isSpecialEventOrService = (
  schedule: { title?: string; category?: string }
): boolean => {
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
  schedule: Pick<Schedule, 'title' | 'date' | 'startTime' | 'status'> & { category?: string },
  publication?: Partial<SchedulePublication> | null
): boolean => {
  if (schedule.status === 'cancelled') return false

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

  // 2. Holy Hour Check (Default: false)
  if (isHolyHourSchedule(title)) {
    return publication?.includeHolyHour ?? false
  }

  // 3. Meeting / Formation Check (Default: false)
  if (isMeetingSchedule(title)) {
    return publication?.includeMeetings ?? false
  }

  // 4. Special Event / Special Mass Check (Default: false in regular publications)
  if (isSpecialEventOrService(schedule)) {
    return false
  }

  // 5. Sunday / Weekday Mass Check (Defaults: true)
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

