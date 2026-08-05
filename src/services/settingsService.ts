import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/firebase/config'
import { auditService } from '@/services/auditService'
import type { PermissionPreset } from '@/types/auth'

const SETTINGS_COLLECTION = 'settings'
const REPORT_TEMPLATE_DOC = 'communityReport'
const POLICY_DOC = 'suspensionPolicy'

export const DEFAULT_REPORT_TEMPLATE = `{{scheduleDate}} ({{scheduleTitle}}, {{startTime}})

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
  updatedAt?: any
}

export const DEFAULT_POLICY_SETTINGS: SuspensionPolicySettings = {
  warningAbsenceThreshold: 2,
  suspensionAbsenceThreshold: 3,
  evaluationMonths: 1,
  evaluationMonthStr: '',
  includeSundays: true,
  includeWeekdays: false,
  includeMeetings: true
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
    canReopenFinancePeriod: false
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
    canReopenFinancePeriod: false
  },
  {
    id: 'preset_admin',
    name: 'Full Admin',
    description: 'Full system control and configuration',
    icon: 'shield',
    role: 'admin',
    allowedModules: ['dashboard', 'schedules', 'attendance', 'reports', 'members', 'users', 'settings', 'audit', 'finance'],
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
    canReopenFinancePeriod: true
  }
]

export const settingsService = {
  /**
   * Fetches custom permission presets from Firestore.
   */
  async getPermissionPresets(): Promise<PermissionPreset[]> {
    try {
      const docRef = doc(db, SETTINGS_COLLECTION, PRESETS_DOC)
      const docSnap = await getDoc(docRef)
      if (docSnap.exists() && docSnap.data().presets) {
        return docSnap.data().presets as PermissionPreset[]
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
   */
  async getReportTemplate(): Promise<string> {
    try {
      const docRef = doc(db, SETTINGS_COLLECTION, REPORT_TEMPLATE_DOC)
      const docSnap = await getDoc(docRef)
      
      if (docSnap.exists()) {
        const data = docSnap.data() as ReportSettings
        if (data.template !== undefined) {
          return data.template
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
  }
}

