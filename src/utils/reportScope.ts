import type { UserProfile } from '@/types/auth'

/** Reuses the Reports page's existing order scope for dashboard metrics. */
export function getReportOrderScope(profile: UserProfile | null | undefined): string | undefined {
  const assignedOrder = profile?.permissions?.assignedOrder || profile?.assignedOrder
  const isScoped = profile?.role === 'order_leader' || !!profile?.permissions?.assignedOrder
  return isScoped && assignedOrder ? assignedOrder : undefined
}
