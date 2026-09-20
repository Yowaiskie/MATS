import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  orderBy, 
  limit, 
  serverTimestamp 
} from 'firebase/firestore'
import { db } from '@/firebase/config'
import type { AuditLog, AuditAction, AuditCategory } from '@/types/audit'

const AUDIT_COLLECTION = 'auditLogs'

const sanitizeData = (obj: any): any => {
  if (obj === undefined) return null;
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeData);
  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key] = sanitizeData(value);
    }
  }
  return result;
};

export const auditService = {
  /**
   * Logs a user/system action into the audit trail.
   */
  async logAction(
    action: AuditAction,
    category: AuditCategory,
    description: string,
    performedBy: string,
    details?: any
  ): Promise<string> {
    try {
      const auditRef = collection(db, AUDIT_COLLECTION)
      const sanitizedDetails = details ? sanitizeData(details) : null;
      
      const docRef = await addDoc(auditRef, {
        action,
        category,
        description,
        performedBy: performedBy || 'System',
        timestamp: serverTimestamp(),
        details: sanitizedDetails
      })
      return docRef.id
    } catch (err) {
      console.error('Failed to log audit action:', err)
      return ''
    }
  },

  /**
   * Retrieves audit logs sorted chronologically descending.
   */
  async getLogs(maxLimit = 100): Promise<AuditLog[]> {
    const auditRef = collection(db, AUDIT_COLLECTION)
    const q = query(auditRef, orderBy('timestamp', 'desc'), limit(maxLimit))
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as AuditLog[]
  }
}
