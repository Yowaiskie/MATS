import { doc, getDoc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore'
import { db } from '@/firebase/config'
import { auditService } from '@/services/auditService'
import type { MaintenanceSettings } from '@/types/maintenance'
import { DEFAULT_MAINTENANCE_SETTINGS } from '@/types/maintenance'

const SETTINGS_COLLECTION = 'settings'
const MAINTENANCE_DOC = 'maintenanceMode'
const CACHE_TTL_MS = 60 * 1000 // 60-second in-memory cache TTL to prevent redundant Firestore getDoc reads

let cachedSettings: MaintenanceSettings | null = null
let cacheTimestamp = 0

export const maintenanceService = {
  /**
   * Fetches the current Maintenance Mode settings from Firestore with lightweight in-memory caching.
   * If force = false and cache is fresh (< 60s), returns cached settings with 0 Firestore read cost.
   */
  async getMaintenanceSettings(force = false): Promise<MaintenanceSettings> {
    const now = Date.now()
    if (!force && cachedSettings && now - cacheTimestamp < CACHE_TTL_MS) {
      return cachedSettings
    }

    try {
      const docRef = doc(db, SETTINGS_COLLECTION, MAINTENANCE_DOC)
      const snap = await getDoc(docRef)

      if (snap.exists()) {
        const data = snap.data()
        const settings: MaintenanceSettings = {
          enabled: Boolean(data.enabled),
          message: data.message || DEFAULT_MAINTENANCE_SETTINGS.message,
          expectedEndAt: data.expectedEndAt || '',
          allowedUserUids: Array.isArray(data.allowedUserUids) ? data.allowedUserUids : [],
          updatedAt: data.updatedAt,
          updatedBy: data.updatedBy || ''
        }
        cachedSettings = settings
        cacheTimestamp = Date.now()
        return settings
      }

      cachedSettings = DEFAULT_MAINTENANCE_SETTINGS
      cacheTimestamp = Date.now()
      return DEFAULT_MAINTENANCE_SETTINGS
    } catch (err) {
      console.warn('Failed to get maintenance settings (using fallback/cached):', err)
      return cachedSettings || DEFAULT_MAINTENANCE_SETTINGS
    }
  },

  /**
   * Saves updated Maintenance Mode settings to Firestore and logs an audit record.
   * Automatically refreshes cache.
   */
  async saveMaintenanceSettings(
    settings: MaintenanceSettings,
    performedBy = 'Coordinator'
  ): Promise<void> {
    const docRef = doc(db, SETTINGS_COLLECTION, MAINTENANCE_DOC)
    const payload = {
      enabled: Boolean(settings.enabled),
      message: (settings.message || DEFAULT_MAINTENANCE_SETTINGS.message).trim(),
      expectedEndAt: (settings.expectedEndAt || '').trim(),
      allowedUserUids: Array.isArray(settings.allowedUserUids) ? settings.allowedUserUids : [],
      updatedAt: serverTimestamp(),
      updatedBy: performedBy
    }

    await setDoc(docRef, payload, { merge: true })

    // Update in-memory cache immediately
    cachedSettings = {
      ...payload,
      updatedAt: new Date()
    }
    cacheTimestamp = Date.now()

    // Structured audit logging
    const statusText = payload.enabled ? 'ENABLED' : 'DISABLED'
    const allowedCount = payload.allowedUserUids.length
    await auditService.logAction(
      'SETTINGS_UPDATE',
      'settings',
      `Maintenance Mode ${statusText} by ${performedBy} (Allowed users: ${allowedCount})`,
      performedBy,
      payload
    )
  },

  /**
   * Subscribes to real-time updates for Maintenance Mode settings.
   * Single active listener per app instance. Updates local cache automatically on incoming snapshots.
   */
  subscribeToMaintenanceSettings(
    onChange: (settings: MaintenanceSettings) => void
  ): () => void {
    const docRef = doc(db, SETTINGS_COLLECTION, MAINTENANCE_DOC)
    return onSnapshot(
      docRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data()
          const settings: MaintenanceSettings = {
            enabled: Boolean(data.enabled),
            message: data.message || DEFAULT_MAINTENANCE_SETTINGS.message,
            expectedEndAt: data.expectedEndAt || '',
            allowedUserUids: Array.isArray(data.allowedUserUids) ? data.allowedUserUids : [],
            updatedAt: data.updatedAt,
            updatedBy: data.updatedBy || ''
          }
          cachedSettings = settings
          cacheTimestamp = Date.now()
          onChange(settings)
        } else {
          cachedSettings = DEFAULT_MAINTENANCE_SETTINGS
          cacheTimestamp = Date.now()
          onChange(DEFAULT_MAINTENANCE_SETTINGS)
        }
      },
      (err) => {
        console.warn('Maintenance settings snapshot warning (retaining current state):', err)
      }
    )
  }
}
