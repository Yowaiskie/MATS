import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/firebase/config'

const SETTINGS_COLLECTION = 'settings'
const REPORT_TEMPLATE_DOC = 'communityReport'

export const DEFAULT_REPORT_TEMPLATE = `{{scheduleDate}} ({{scheduleTitle}}, {{startTime}})

{{assignedMembers}}

Other Servers:
{{otherServers}}`

export interface ReportSettings {
  template: string
  updatedAt?: any
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
  async saveReportTemplate(template: string): Promise<void> {
    const docRef = doc(db, SETTINGS_COLLECTION, REPORT_TEMPLATE_DOC)
    await setDoc(docRef, {
      template,
      updatedAt: serverTimestamp(),
    }, { merge: true })
  }
}
