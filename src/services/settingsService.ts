import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/firebase/config'
import { auditService } from '@/services/auditService'
import type { PermissionPreset } from '@/types/auth'
import type { SignaturePreset } from '@/types/signature'
import { DEFAULT_SIGNATURE_PRESETS } from '@/types/signature'
import type { QualificationPreset } from '@/types/attendanceCategory'
import { DEFAULT_QUALIFICATION_PRESETS } from '@/types/attendanceCategory'

const SETTINGS_COLLECTION = 'settings'
const REPORT_TEMPLATE_DOC = 'communityReport'
const POLICY_DOC = 'suspensionPolicy'
const SIGNATURE_PRESETS_DOC = 'signaturePresets'
const QUALIFICATION_PRESETS_DOC = 'qualificationPresets'
const LOCAL_STORAGE_PRESETS_KEY = 'mats_dynamic_signature_presets_v2'
const LOCAL_STORAGE_QUALIFICATION_KEY = 'mats_qualification_presets_v1'

export const DEFAULT_REPORT_TEMPLATE = `{{dayOfWeek}}, {{scheduleDate}} ({{scheduleTitle}}, {{startTime}})

{{assignedMembers}}

Squires:
{{squires}}

Other Servers:
{{otherServers}}`

export interface ReportSettings {
  template: string
  updatedAt?: any
}

export interface SuspensionPolicySettings {
  warningAbsenceThreshold: number // default 2
  suspensionAbsenceThreshold: number // default 3
  evaluationMonths: number // default 1 (0 = All Time)
  evaluationMonthStr?: string // e.g. "2026-07"
  includeSundays: boolean // default true
  includeWeekdays: boolean // default false
  includeMeetings: boolean // default true
  
  // Dynamic Unsuspension / Clearance Settings
  unsuspensionRequiresMeeting?: boolean // default true (must attend monthly meeting)
  unsuspensionRequiredMeetingMonths?: number // default 1 (number of distinct meeting months)
  unsuspensionRequiredMeetingCount?: number // backwards compatibility
  unsuspensionRequiresFormation?: boolean // default false
  unsuspensionRequiredFormationCount?: number // default 1
  autoPromptOnSchedulingSuspended?: boolean // default true
  excludeSuspendedFromAutoAssign?: boolean // default true
  updatedAt?: any
}

export const DEFAULT_POLICY_SETTINGS: SuspensionPolicySettings = {
  warningAbsenceThreshold: 2,
  suspensionAbsenceThreshold: 3,
  evaluationMonths: 1,
  evaluationMonthStr: '',
  includeSundays: true,
  includeWeekdays: false,
  includeMeetings: true,
  unsuspensionRequiresMeeting: true,
  unsuspensionRequiredMeetingMonths: 1,
  unsuspensionRequiredMeetingCount: 1,
  unsuspensionRequiresFormation: false,
  unsuspensionRequiredFormationCount: 1,
  autoPromptOnSchedulingSuspended: true,
  excludeSuspendedFromAutoAssign: true
}

const PRESETS_DOC = 'permissionPresets'
const PUBLIC_SCHEDULE_DOC = 'publicSchedule'

export interface PublicScheduleSettings {
  enabledMonth: number
  enabledYear: number
}

export const DEFAULT_PUBLIC_SCHEDULE_SETTINGS: PublicScheduleSettings = {
  enabledMonth: new Date().getMonth() + 1,
  enabledYear: new Date().getFullYear()
}


export const DEFAULT_PERMISSION_PRESETS: PermissionPreset[] = [
  {
    id: 'preset_attendance_taker',
    name: 'Attendance Taker',
    description: 'Take & save attendance only',
    icon: 'clipboard',
    role: 'user',
    allowedModules: ['dashboard', 'schedules', 'attendance'],
    canTakeAttendance: true,
    canFinalizeAttendance: false,
    canViewSchedules: true,
    canManageSchedules: false,
    canViewReports: false,
    canExportReports: false,
    canViewFinanceDashboard: false,
    canAddIncome: false,
    canEditIncome: false,
    canDeleteIncome: false,
    canCreateFundRequest: false,
    canApproveFundRequest: false,
    canRejectFundRequest: false,
    canReleaseFunds: false,
    canSubmitLiquidation: false,
    canReviewLiquidation: false,
    canViewFinanceReports: false,
    canExportFinanceReports: false,
    canManageFinanceCategories: false,
    canCloseFinancePeriod: false,
    canReopenFinancePeriod: false,
    canManageEvents: false,
    canViewProjects: false,
    canCreateProjects: false,
    canEditProjects: false,
    canDeleteProjects: false,
    canDeleteEvents: false,
    canAssignTasks: false,
    canManageAssignments: false,
    canUpdateOwnTasks: false,
    canUpdateAnyTask: false,
    canDeleteTasks: false,
    canCommentProjects: false,
    canUploadProjectFiles: false,
    canViewProjectReports: false,
    canArchiveProjects: false,
    canViewEventFinance: false,
    canAddEventIncome: false,
    canAddEventExpense: false,
    canEditEventFinance: false,
    canVoidEventFinance: false,
    canTransferEventFunds: false,
    canManageEventFinanceCategories: false,
    canViewEventForms: false,
    canCreateEventForms: false,
    canEditEventForms: false,
    canPublishEventForms: false,
    canViewEventFormResponses: false,
    canExportEventFormResponses: false,
    canArchiveEventForms: false,
    canViewEventContributions: false,
    canAddEventContributions: false,
    canEditEventContributions: false,
    canVoidEventContributions: false,
    canManageEventContributionPurposes: false,
    canExportEventContributions: false,
    canViewInventory: false,
    canManageInventory: false,
    canViewMembers: true,
    canManageMembers: false,
    canDeleteMembers: false,
    canReviewExcuses: false,
    canApproveExcuses: false,
    canDeleteExcuses: false,
    canBroadcast: false
  },
  {
    id: 'preset_order_leader',
    name: 'Order Leader',
    description: 'Reports scoped to assigned order',
    icon: 'users',
    role: 'order_leader',
    allowedModules: ['dashboard', 'schedules', 'attendance', 'reports'],
    canTakeAttendance: true,
    canFinalizeAttendance: false,
    canViewSchedules: true,
    canManageSchedules: false,
    canViewReports: true,
    canExportReports: true,
    canViewFinanceDashboard: false,
    canAddIncome: false,
    canEditIncome: false,
    canDeleteIncome: false,
    canCreateFundRequest: false,
    canApproveFundRequest: false,
    canRejectFundRequest: false,
    canReleaseFunds: false,
    canSubmitLiquidation: false,
    canReviewLiquidation: false,
    canViewFinanceReports: false,
    canExportFinanceReports: false,
    canManageFinanceCategories: false,
    canCloseFinancePeriod: false,
    canReopenFinancePeriod: false,
    canManageEvents: false,
    canViewProjects: false,
    canCreateProjects: false,
    canEditProjects: false,
    canDeleteProjects: false,
    canDeleteEvents: false,
    canAssignTasks: false,
    canManageAssignments: false,
    canUpdateOwnTasks: false,
    canUpdateAnyTask: false,
    canDeleteTasks: false,
    canCommentProjects: false,
    canUploadProjectFiles: false,
    canViewProjectReports: false,
    canArchiveProjects: false,
    canViewEventFinance: false,
    canAddEventIncome: false,
    canAddEventExpense: false,
    canEditEventFinance: false,
    canVoidEventFinance: false,
    canTransferEventFunds: false,
    canManageEventFinanceCategories: false,
    canViewEventForms: false,
    canCreateEventForms: false,
    canEditEventForms: false,
    canPublishEventForms: false,
    canViewEventFormResponses: false,
    canExportEventFormResponses: false,
    canArchiveEventForms: false,
    canViewEventContributions: false,
    canAddEventContributions: false,
    canEditEventContributions: false,
    canVoidEventContributions: false,
    canManageEventContributionPurposes: false,
    canExportEventContributions: false,
    canViewInventory: false,
    canManageInventory: false,
    canViewMembers: true,
    canManageMembers: false,
    canDeleteMembers: false,
    canReviewExcuses: false,
    canApproveExcuses: false,
    canDeleteExcuses: false,
    canBroadcast: false
  },
  {
    id: 'preset_admin',
    name: 'Full Admin',
    description: 'Full system control and configuration',
    icon: 'shield',
    role: 'admin',
    allowedModules: ['dashboard', 'schedules', 'attendance', 'reports', 'members', 'finance', 'events', 'inventory', 'excuses', 'users', 'settings', 'audit', 'changePassword'],
    canTakeAttendance: true,
    canFinalizeAttendance: true,
    canViewSchedules: true,
    canManageSchedules: true,
    canViewReports: true,
    canExportReports: true,
    canViewFinanceDashboard: true,
    canAddIncome: true,
    canEditIncome: true,
    canDeleteIncome: true,
    canCreateFundRequest: true,
    canApproveFundRequest: true,
    canRejectFundRequest: true,
    canReleaseFunds: true,
    canSubmitLiquidation: true,
    canReviewLiquidation: true,
    canViewFinanceReports: true,
    canExportFinanceReports: true,
    canManageFinanceCategories: true,
    canCloseFinancePeriod: true,
    canReopenFinancePeriod: true,
    canManageEvents: true,
    canViewProjects: true,
    canCreateProjects: true,
    canEditProjects: true,
    canDeleteProjects: true,
    canDeleteEvents: true,
    canAssignTasks: true,
    canManageAssignments: true,
    canUpdateOwnTasks: true,
    canUpdateAnyTask: true,
    canDeleteTasks: true,
    canCommentProjects: true,
    canUploadProjectFiles: true,
    canViewProjectReports: true,
    canArchiveProjects: true,
    canViewEventFinance: true,
    canAddEventIncome: true,
    canAddEventExpense: true,
    canEditEventFinance: true,
    canVoidEventFinance: true,
    canTransferEventFunds: true,
    canManageEventFinanceCategories: true,
    canViewEventForms: true,
    canCreateEventForms: true,
    canEditEventForms: true,
    canPublishEventForms: true,
    canViewEventFormResponses: true,
    canExportEventFormResponses: true,
    canArchiveEventForms: true,
    canViewEventContributions: true,
    canAddEventContributions: true,
    canEditEventContributions: true,
    canVoidEventContributions: true,
    canManageEventContributionPurposes: true,
    canExportEventContributions: true,
    canViewInventory: true,
    canManageInventory: true,
    canViewMembers: true,
    canManageMembers: true,
    canDeleteMembers: true,
    canReviewExcuses: true,
    canApproveExcuses: true,
    canDeleteExcuses: true,
    canBroadcast: true
  }
]

const deduplicatePresets = (list: SignaturePreset[]): SignaturePreset[] => {
  const seenIds = new Set<string>()
  const seenNames = new Set<string>()
  const result: SignaturePreset[] = []

  for (const item of list) {
    if (!item || !item.name) continue
    const normName = item.name.trim().toLowerCase()
    if (seenIds.has(item.id) || seenNames.has(normName)) {
      continue
    }
    seenIds.add(item.id)
    seenNames.add(normName)
    result.push(item)
  }

  return result
}

export const settingsService = {
  /**
   * Fetches custom permission presets from Firestore.
   */
  async getPermissionPresets(): Promise<PermissionPreset[]> {
    try {
      const docRef = doc(db, SETTINGS_COLLECTION, PRESETS_DOC)
      const docSnap = await getDoc(docRef)
      if (docSnap.exists() && docSnap.data().presets) {
        const storedPresets = docSnap.data().presets as PermissionPreset[]
        const adminDefault = DEFAULT_PERMISSION_PRESETS.find(p => p.id === 'preset_admin') || DEFAULT_PERMISSION_PRESETS[2]
        return storedPresets.map(preset => {
          if (preset.role === 'admin' || preset.id === 'preset_admin') {
            return {
              ...adminDefault,
              ...preset,
              allowedModules: Array.from(new Set([...(preset.allowedModules || []), ...adminDefault.allowedModules])),
              ...Object.fromEntries(
                Object.entries(adminDefault).filter(([k]) => k.startsWith('can') && (adminDefault as any)[k] === true)
              )
            }
          }
          return preset
        })
      }
      return DEFAULT_PERMISSION_PRESETS
    } catch (err) {
      console.error('Failed to load permission presets:', err)
      return DEFAULT_PERMISSION_PRESETS
    }
  },

  /**
   * Saves updated permission presets to Firestore.
   */
  async savePermissionPresets(presets: PermissionPreset[], performedBy = 'System'): Promise<void> {
    const docRef = doc(db, SETTINGS_COLLECTION, PRESETS_DOC)
    await setDoc(docRef, {
      presets,
      updatedAt: serverTimestamp()
    }, { merge: true })

    await auditService.logAction(
      'SETTINGS_UPDATE',
      'settings',
      `Updated dynamic system permission presets (${presets.length} presets)`,
      performedBy,
      { presetsCount: presets.length }
    )
  },

  /**
   * Fetches the custom report template from Firestore.
   * If it doesn't exist, returns the default template.
   * Auto-migrates old templates that use {{scheduleDate}} without {{dayOfWeek}}
   * by prepending {{dayOfWeek}}, before each {{scheduleDate}} occurrence.
   */
  async getReportTemplate(): Promise<string> {
    try {
      const docRef = doc(db, SETTINGS_COLLECTION, REPORT_TEMPLATE_DOC)
      const docSnap = await getDoc(docRef)
      
      if (docSnap.exists()) {
        const data = docSnap.data() as ReportSettings
        if (data.template !== undefined) {
          let template = data.template

          // Auto-migration: prepend {{dayOfWeek}}, before {{scheduleDate}} if not already present
          if (template.includes('{{scheduleDate}}') && !template.includes('{{dayOfWeek}}')) {
            template = template.replace(/\{\{scheduleDate\}\}/g, '{{dayOfWeek}}, {{scheduleDate}}')
            // Save the migrated template back to Firestore silently
            await setDoc(docRef, { template, updatedAt: serverTimestamp() }, { merge: true })
          }

          return template
        }
      }
      return DEFAULT_REPORT_TEMPLATE;
    } catch (err) {
      console.error('Failed to get report template settings:', err)
      return DEFAULT_REPORT_TEMPLATE;
    }
  },

  /**
   * Saves the custom report template to Firestore.
   */
  async saveReportTemplate(template: string, performedBy = 'System'): Promise<void> {
    const docRef = doc(db, SETTINGS_COLLECTION, REPORT_TEMPLATE_DOC)
    await setDoc(docRef, {
      template,
      updatedAt: serverTimestamp(),
    }, { merge: true })

    await auditService.logAction(
      'SETTINGS_UPDATE',
      'settings',
      'Updated Facebook community report template in settings',
      performedBy,
      { template }
    )
  },

  /**
   * Fetches the dynamic attendance & suspension policy settings from Firestore.
   */
  async getPolicySettings(): Promise<SuspensionPolicySettings> {
    try {
      const docRef = doc(db, SETTINGS_COLLECTION, POLICY_DOC)
      const docSnap = await getDoc(docRef)

      if (docSnap.exists()) {
        const data = docSnap.data()
        return {
          warningAbsenceThreshold: data.warningAbsenceThreshold ?? DEFAULT_POLICY_SETTINGS.warningAbsenceThreshold,
          suspensionAbsenceThreshold: data.suspensionAbsenceThreshold ?? DEFAULT_POLICY_SETTINGS.suspensionAbsenceThreshold,
          evaluationMonths: data.evaluationMonths ?? DEFAULT_POLICY_SETTINGS.evaluationMonths,
          includeSundays: data.includeSundays ?? DEFAULT_POLICY_SETTINGS.includeSundays,
          includeWeekdays: data.includeWeekdays ?? DEFAULT_POLICY_SETTINGS.includeWeekdays,
          includeMeetings: data.includeMeetings ?? DEFAULT_POLICY_SETTINGS.includeMeetings
        }
      }
      return DEFAULT_POLICY_SETTINGS
    } catch (err) {
      console.error('Failed to get policy settings:', err)
      return DEFAULT_POLICY_SETTINGS
    }
  },

  /**
   * Saves the dynamic attendance & suspension policy settings to Firestore.
   */
  async savePolicySettings(settings: SuspensionPolicySettings, performedBy = 'System'): Promise<void> {
    const docRef = doc(db, SETTINGS_COLLECTION, POLICY_DOC)
    const payload = {
      warningAbsenceThreshold: Number(settings.warningAbsenceThreshold),
      suspensionAbsenceThreshold: Number(settings.suspensionAbsenceThreshold),
      evaluationMonths: Number(settings.evaluationMonths),
      includeSundays: Boolean(settings.includeSundays),
      includeWeekdays: Boolean(settings.includeWeekdays),
      includeMeetings: Boolean(settings.includeMeetings),
      updatedAt: serverTimestamp()
    }

    await setDoc(docRef, payload, { merge: true })

    const categories = [settings.includeSundays && 'Sun', settings.includeWeekdays && 'Weekday', settings.includeMeetings && 'Meeting'].filter(Boolean).join(', ')
    await auditService.logAction(
      'SETTINGS_UPDATE',
      'settings',
      `Updated attendance suspension policy (Warning: ${settings.warningAbsenceThreshold}, Suspension: ${settings.suspensionAbsenceThreshold}, Duration: ${settings.evaluationMonths}m, Categories: ${categories})`,
      performedBy,
      payload
    )
  },

  /**
   * Fetches the public schedule configuration from Firestore.
   */
  async getPublicScheduleSettings(): Promise<PublicScheduleSettings> {
    try {
      const docRef = doc(db, SETTINGS_COLLECTION, PUBLIC_SCHEDULE_DOC)
      const docSnap = await getDoc(docRef)

      if (docSnap.exists()) {
        const data = docSnap.data()
        return {
          enabledMonth: data.enabledMonth ?? DEFAULT_PUBLIC_SCHEDULE_SETTINGS.enabledMonth,
          enabledYear: data.enabledYear ?? DEFAULT_PUBLIC_SCHEDULE_SETTINGS.enabledYear
        }
      }
      return DEFAULT_PUBLIC_SCHEDULE_SETTINGS
    } catch (err) {
      console.error('Failed to get public schedule settings:', err)
      return DEFAULT_PUBLIC_SCHEDULE_SETTINGS
    }
  },

  /**
   * Saves the public schedule configuration to Firestore.
   */
  async savePublicScheduleSettings(settings: PublicScheduleSettings, performedBy = 'System'): Promise<void> {
    const docRef = doc(db, SETTINGS_COLLECTION, PUBLIC_SCHEDULE_DOC)
    const payload = {
      enabledMonth: Number(settings.enabledMonth),
      enabledYear: Number(settings.enabledYear),
      updatedAt: serverTimestamp()
    }

    await setDoc(docRef, payload, { merge: true })

    await auditService.logAction(
      'SETTINGS_UPDATE',
      'settings',
      `Updated public schedule settings (Month: ${settings.enabledMonth}, Year: ${settings.enabledYear})`,
      performedBy,
      payload
    )
  },

  /**
   * Fetches the dynamic signature presets from Firestore (with localStorage fallback).
   */
  async getSignaturePresets(): Promise<SignaturePreset[]> {
    try {
      const docRef = doc(db, SETTINGS_COLLECTION, SIGNATURE_PRESETS_DOC)
      const docSnap = await getDoc(docRef)

      let rawList: SignaturePreset[] = []

      if (docSnap.exists()) {
        const data = docSnap.data()
        if (data.presets && Array.isArray(data.presets) && data.presets.length > 0) {
          rawList = data.presets
        }
      }

      if (rawList.length === 0) {
        try {
          const stored = localStorage.getItem(LOCAL_STORAGE_PRESETS_KEY)
          if (stored) {
            const parsed = JSON.parse(stored)
            if (Array.isArray(parsed) && parsed.length > 0) {
              rawList = parsed
            }
          }
        } catch {}
      }

      // Combine defaults with custom presets cleanly without duplicates
      const combined = [...DEFAULT_SIGNATURE_PRESETS, ...rawList]
      const deduplicated = deduplicatePresets(combined)

      try {
        localStorage.setItem(LOCAL_STORAGE_PRESETS_KEY, JSON.stringify(deduplicated))
      } catch {}

      return deduplicated
    } catch (err) {
      console.error('Failed to get signature presets from Firestore:', err)
      return DEFAULT_SIGNATURE_PRESETS
    }
  },

  /**
   * Saves dynamic signature presets to Firestore and localStorage with strict deduplication.
   */
  async saveSignaturePresets(presets: SignaturePreset[], performedBy = 'System'): Promise<void> {
    const deduplicated = deduplicatePresets(presets)
    const docRef = doc(db, SETTINGS_COLLECTION, SIGNATURE_PRESETS_DOC)
    const payload = {
      presets: deduplicated,
      updatedAt: serverTimestamp()
    }

    await setDoc(docRef, payload, { merge: true })

    try {
      localStorage.setItem(LOCAL_STORAGE_PRESETS_KEY, JSON.stringify(deduplicated))
    } catch {}

    await auditService.logAction(
      'SETTINGS_UPDATE',
      'settings',
      `Updated dynamic signature presets (${deduplicated.length} presets configured)`,
      performedBy,
      payload
    )
  },

  /**
   * Retrieves qualification presets from Firestore with fallback to localStorage & defaults.
   */
  async getQualificationPresets(): Promise<QualificationPreset[]> {
    try {
      const docRef = doc(db, SETTINGS_COLLECTION, QUALIFICATION_PRESETS_DOC)
      const docSnap = await getDoc(docRef)
      let customList: QualificationPreset[] = []

      if (docSnap.exists() && docSnap.data().presets) {
        customList = docSnap.data().presets as QualificationPreset[]
      } else {
        try {
          const cached = localStorage.getItem(LOCAL_STORAGE_QUALIFICATION_KEY)
          if (cached) {
            customList = JSON.parse(cached)
          }
        } catch {}
      }

      // Merge defaults with custom presets by unique ID
      const map = new Map<string, QualificationPreset>()
      DEFAULT_QUALIFICATION_PRESETS.forEach(p => map.set(p.id, p))
      customList.forEach(p => map.set(p.id, p))

      const result = Array.from(map.values())
      try {
        localStorage.setItem(LOCAL_STORAGE_QUALIFICATION_KEY, JSON.stringify(result))
      } catch {}

      return result
    } catch (err) {
      console.error('Failed to get qualification presets:', err)
      return DEFAULT_QUALIFICATION_PRESETS
    }
  },

  /**
   * Saves qualification presets to Firestore and localStorage.
   */
  async saveQualificationPresets(presets: QualificationPreset[], performedBy = 'System'): Promise<void> {
    const docRef = doc(db, SETTINGS_COLLECTION, QUALIFICATION_PRESETS_DOC)
    const payload = {
      presets,
      updatedAt: serverTimestamp()
    }

    await setDoc(docRef, payload, { merge: true })

    try {
      localStorage.setItem(LOCAL_STORAGE_QUALIFICATION_KEY, JSON.stringify(presets))
    } catch {}

    await auditService.logAction(
      'SETTINGS_UPDATE',
      'settings',
      `Updated qualification criteria presets (${presets.length} presets saved)`,
      performedBy,
      payload
    )
  }
}


