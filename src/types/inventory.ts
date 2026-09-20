export type ItemCategory = 
  | 'Recreation & Sports' 
  | 'Liturgical & Sacristy' 
  | 'Vestments & Robes' 
  | 'Audio-Visual & Tech' 
  | 'Facilities & Storage' 
  | 'General Supplies'

export type ItemCondition = 
  | 'Brand New' 
  | 'Good' 
  | 'Fair / Usable' 
  | 'Damaged / For Repair'

export type ItemStatus = 
  | 'In Stock' 
  | 'Low Stock' 
  | 'Out of Stock' 
  | 'Under Maintenance'

export interface InventoryCategory {
  id: string
  name: string
  description?: string
  color?: string
  createdAt: any
  createdByUid?: string
  createdByName?: string
}

export interface InventoryItem {
  id: string
  name: string
  category: ItemCategory | string
  quantity: number
  unit: string // 'pcs', 'sets', 'pairs', 'boxes', 'units'
  condition: ItemCondition
  status: ItemStatus
  storageLocation: string // e.g. "Ministry Locker 1", "Sacristy Shelf A", "Gym Bin"
  notes?: string
  donorOrSource?: string
  lastCheckedDate?: string
  isArchived: boolean
  createdAt: any
  updatedAt: any
  createdByUid: string
  createdByName: string
  updatedByUid?: string
  updatedByName?: string
}

export const DEFAULT_INVENTORY_CATEGORIES: string[] = [
  'Recreation & Sports',
  'Liturgical & Sacristy',
  'Vestments & Robes',
  'Audio-Visual & Tech',
  'Facilities & Storage',
  'General Supplies'
]

export const INVENTORY_CONDITIONS: ItemCondition[] = [
  'Brand New',
  'Good',
  'Fair / Usable',
  'Damaged / For Repair'
]

export const INVENTORY_UNITS = [
  'pcs',
  'sets',
  'pairs',
  'boxes',
  'balls',
  'boards',
  'units'
]
