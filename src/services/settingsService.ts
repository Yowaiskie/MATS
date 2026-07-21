import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/firebase/config'
import { auditService } from '@/services/auditService'

const SETTINGS_COLLECTION = 'settings'
const REPORT_TEMPLATE_DOC = 'communityReport'
const POLICY_DOC = 'suspensionPolicy'

export const DEFAULT_REPORT_TEMPLATE = `{{scheduleDate}} ({{scheduleTitle}}, {{startTime}})

{{assignedMembers}}

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
  includeSundays: boolean // default true
  includeWeekdays: boolean // default false
  includeMeetings: boolean // default true
  updatedAt?: any
}

export const DEFAULT_POLICY_SETTINGS: SuspensionPolicySettings = {
  warningAbsenceThreshold: 2,
  suspensionAbsenceThreshold: 3,
  evaluationMonths: 1,
  includeSundays: true,
  includeWeekdays: false,
  includeMeetings: true
}

export const settingsService = {
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
  }
}
