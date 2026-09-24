export interface OrderRotationSettings {
  enabled: boolean
  rotationSequence: string[] // ['Order of San Pedro', 'Order of San Juan', 'Order of San Tiago', 'Order of San Andres']
  targetKeywords: string[]   // ['Holy Hour', 'Binyag', 'Baptism']
  targetCategories: string[] // ['holy_hour']
  includeSuspended: boolean  // default false
  updatedAt?: any
}

export const DEFAULT_ORDER_ROTATION_SETTINGS: OrderRotationSettings = {
  enabled: true,
  rotationSequence: [
    'Order of San Pedro',
    'Order of San Juan',
    'Order of San Tiago',
    'Order of San Andres'
  ],
  targetKeywords: ['Holy Hour', 'Binyag', 'Baptism'],
  targetCategories: ['holy_hour'],
  includeSuspended: false
}

export interface RotationAssignmentPlanItem {
  scheduleId: string
  scheduleTitle: string
  date: string
  startTime: string
  endTime: string
  assignedOrderGroup: string
  assignedMemberIds: string[]
  assignedMemberNames: string[]
  existingAssignedCount: number
  isAlreadyAssigned: boolean
}
