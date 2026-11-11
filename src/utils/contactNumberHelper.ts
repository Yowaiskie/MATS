/**
 * Unified Contact Number (Mobile / Landline) Helper
 * Supports Philippine 11-digit mobile numbers (09XX-XXX-XXXX) and landlines (local 7-8 digits or area-code 10-11 digits)
 * Strictly limits raw numeric digits to maximum 11 digits with zero emojis.
 */

export type DetectedContactType = 'mobile' | 'landline' | 'unknown'

/**
 * Extracts raw numeric digits only, strictly capping the length at 11 digits.
 */
export const getRawContactDigits = (val: string | null | undefined): string => {
  if (!val) return ''
  return String(val).replace(/\D/g, '').slice(0, 11)
}

/**
 * Detects whether the input is a Mobile number, Landline, or Unknown.
 */
export const detectContactType = (val: string | null | undefined): DetectedContactType => {
  const raw = getRawContactDigits(val)
  if (!raw) return 'unknown'

  // Philippine Mobile numbers begin with '09'
  if (raw.startsWith('09')) {
    return 'mobile'
  }

  // Philippine Landlines begin with '0' (area code like 02, 046, etc.) or local digits (8, 7, 2, 3, etc.)
  if (raw.startsWith('0') || ['8', '7', '2', '3', '4', '5', '6'].includes(raw[0])) {
    return 'landline'
  }

  return 'unknown'
}

/**
 * Formats a raw contact string into a clean, human-readable format.
 * Strictly caps at 11 digits maximum.
 */
export const formatContactNumber = (val: string | null | undefined): string => {
  const raw = getRawContactDigits(val)
  if (!raw) return ''

  // 1. Mobile Format (09XX-XXX-XXXX, max 11 digits)
  if (raw.startsWith('09')) {
    if (raw.length <= 4) return raw
    if (raw.length <= 7) return `${raw.slice(0, 4)}-${raw.slice(4)}`
    return `${raw.slice(0, 4)}-${raw.slice(4, 7)}-${raw.slice(7, 11)}`
  }

  // 2. Metro Manila Landline with 02 Area Code (02-XXXX-XXXX, 10 digits)
  if (raw.startsWith('02')) {
    if (raw.length <= 2) return raw
    if (raw.length <= 6) return `${raw.slice(0, 2)}-${raw.slice(2)}`
    return `${raw.slice(0, 2)}-${raw.slice(2, 6)}-${raw.slice(6, 10)}`
  }

  // 3. Provincial Landline with 3-digit Area Code (0XX-XXX-XXXX, 10-11 digits)
  if (raw.startsWith('0')) {
    if (raw.length <= 3) return raw
    if (raw.length <= 6) return `${raw.slice(0, 3)}-${raw.slice(3)}`
    return `${raw.slice(0, 3)}-${raw.slice(3, 6)}-${raw.slice(6, 11)}`
  }

  // 4. Local 8-Digit Landline (e.g. 8123-4567, 7123-4567)
  if (raw.length <= 4) return raw
  if (raw.length <= 8) return `${raw.slice(0, 4)}-${raw.slice(4, 8)}`

  // 5. Generic format (up to 11 digits)
  return `${raw.slice(0, 4)}-${raw.slice(4, 7)}-${raw.slice(7, 11)}`
}

/**
 * Validates completeness of the contact number.
 */
export const isValidContactNumber = (val: string | null | undefined, required: boolean = false): boolean => {
  const raw = getRawContactDigits(val)
  if (!raw) return !required

  // If mobile, must be complete 11 digits
  if (raw.startsWith('09')) {
    return raw.length === 11
  }

  // If area-code landline (starts with 0), must have at least 10 digits
  if (raw.startsWith('0')) {
    return raw.length >= 10 && raw.length <= 11
  }

  // If local landline, must have at least 7 or 8 digits
  return raw.length >= 7 && raw.length <= 8
}
