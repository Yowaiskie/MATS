export type UserRole = 'admin' | 'user'

export interface UserProfile {
  uid: string
  email: string
  displayName?: string
  role: UserRole
  createdAt?: string
  updatedAt?: string
}
