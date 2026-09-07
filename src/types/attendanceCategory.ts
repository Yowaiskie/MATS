import type { Member } from '@/types/member'

export type ScheduleCategoryKey = 
  | 'formation'              // On-Going Formation (OGF), Seminars, Recollections
  | 'meeting'                // Monthly General Meetings, Assemblies, Officers Meetings
  | 'meeting_and_formation'  // Combined: Meeting & OGF held together
  | 'mass_sunday'            // Sunday & Saturday Anticipated Masses
  | 'mass_weekday'           // Weekday / Regular Daily Masses
  | 'holy_hour'              // Holy Hour & Adoration
  | 'practice'               // Practices, Rehearsals, Dry-Runs
  | 'special_event'          // Fiesta, Pontifical, Processions, Solemnities
  | 'other'                  // Miscellaneous

export interface ScheduleCategoryMeta {
  key: ScheduleCategoryKey
  label: string
  shortLabel: string
  description: string
  badgeColor: string // Tailwind classes for badge
  defaultTargetRate?: number // e.g. 60
}

export const SCHEDULE_CATEGORIES: ScheduleCategoryMeta[] = [
  {
    key: 'formation',
    label: 'On-Going Formation (OGF)',
    shortLabel: 'Formation / OGF',
    description: 'Monthly formations, seminars, workshops, and recollections',
    badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
    defaultTargetRate: 60
  },
  {
    key: 'meeting',
    label: 'Monthly Meeting / Assembly',
    shortLabel: 'Meeting',
    description: 'General assemblies, monthly meetings, and officer meetings',
    badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
    defaultTargetRate: 60
  },
  {
    key: 'meeting_and_formation',
    label: 'Meeting & OGF (Combined)',
    shortLabel: 'Meeting & OGF',
    description: 'Sessions where both monthly meeting and formation are conducted together',
    badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    defaultTargetRate: 60
  },
  {
    key: 'mass_sunday',
    label: 'Sunday Mass / Anticipated',
    shortLabel: 'Sunday Mass',
    description: 'Sunday regular services and Saturday anticipated evening masses',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    defaultTargetRate: 50
  },
  {
    key: 'mass_weekday',
    label: 'Weekday Mass',
    shortLabel: 'Weekday Mass',
    description: 'Monday through Saturday morning / weekday mass schedules',
    badgeColor: 'bg-slate-50 text-slate-700 border-slate-200',
    defaultTargetRate: 30
  },
  {
    key: 'holy_hour',
    label: 'Holy Hour / Adoration',
    shortLabel: 'Holy Hour',
    description: 'First Friday adoration, holy hour devotions, and benedictions',
    badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
    defaultTargetRate: 40
  },
  {
    key: 'practice',
    label: 'Practice / Rehearsal',
    shortLabel: 'Practice',
    description: 'Liturgical practice, major feast rehearsals, and training runs',
    badgeColor: 'bg-teal-50 text-teal-700 border-teal-200',
    defaultTargetRate: 50
  },
  {
    key: 'special_event',
    label: 'Special Event / Fiesta',
    shortLabel: 'Special Event',
    description: 'Feast days, pontifical masses, processions, and solemnities',
    badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
    defaultTargetRate: 50
  }
]

export interface CategoryRule {
  id: string
  category: ScheduleCategoryKey | 'all'
  minRate?: number        // e.g. 60 for 60%
  minAttended?: number    // e.g. 3 sessions attended
  required: boolean       // true = mandatory to pass
}

export interface QualificationPreset {
  id: string
  name: string
  description?: string
  rules: CategoryRule[]
  defaultDateRangeMonths?: number // e.g. 6 or 12
  isSystemDefault?: boolean
}

export const DEFAULT_QUALIFICATION_PRESETS: QualificationPreset[] = [
  {
    id: 'preset-annual-renewal',
    name: 'Annual Server Renewal (Standard)',
    description: 'Requires at least 60% Formation, 60% Meetings, and 50% Sunday Masses for annual renewal clearance.',
    isSystemDefault: true,
    defaultDateRangeMonths: 12,
    rules: [
      { id: 'rule-ogf', category: 'formation', minRate: 60, required: true },
      { id: 'rule-meeting', category: 'meeting', minRate: 60, required: true },
      { id: 'rule-sunday', category: 'mass_sunday', minRate: 50, required: true }
    ]
  },
  {
    id: 'preset-promotion-investiture',
    name: 'Promotion & Investiture Clearance',
    description: 'Strict qualification requiring at least 80% Formation and 75% Overall attendance.',
    isSystemDefault: true,
    defaultDateRangeMonths: 6,
    rules: [
      { id: 'rule-ogf-promo', category: 'formation', minRate: 80, required: true },
      { id: 'rule-overall-promo', category: 'all', minRate: 75, required: true }
    ]
  },
  {
    id: 'preset-good-standing',
    name: 'Active Server Standing Check',
    description: 'General active standing check requiring at least 50% Overall attendance.',
    isSystemDefault: true,
    defaultDateRangeMonths: 3,
    rules: [
      { id: 'rule-overall-standing', category: 'all', minRate: 50, required: true }
    ]
  }
]

export interface MemberCategoryStat {
  category: ScheduleCategoryKey | 'all'
  categoryLabel: string
  totalHeld: number        // Total sessions of this category in date range
  totalAssigned: number    // Total sessions member was assigned to
  present: number
  late: number
  absent: number
  excused: number
  rate: number             // Attendance rate percentage (0 - 100)
  targetRate?: number
  meetsRule: boolean
  ruleFeedback?: string
}

export interface MemberQualificationResult {
  member: Member
  categoryStats: Record<string, MemberCategoryStat>
  overallRate: number
  totalAttended: number
  totalHeld: number
  isQualified: boolean
  passedRulesCount: number
  totalRulesCount: number
  deficiencies: string[]   // Description of failed criteria (e.g. "OGF: 45% (Needs >= 60%)")
}
