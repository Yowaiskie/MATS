export interface MaintenanceSettings {
  enabled: boolean
  message: string
  expectedEndAt?: string
  allowedUserUids: string[]
  updatedAt?: any
  updatedBy?: string
}

export const DEFAULT_MAINTENANCE_SETTINGS: MaintenanceSettings = {
  enabled: false,
  message: 'MATS is currently under maintenance for routine updates and system enhancements. Please try again later.',
  expectedEndAt: '',
  allowedUserUids: []
}
