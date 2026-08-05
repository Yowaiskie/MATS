import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp, 
  query, 
  orderBy
} from 'firebase/firestore'
import { db } from '@/firebase/config'
import type { FinanceCategory } from '@/types/finance'
import { auditService } from '@/services/auditService'

const CATEGORIES_COLLECTION = 'financeCategories'

export const categoryService = {
  /**
   * Fetches all categories, sorting alphabetically.
   */
  async getCategories(includeArchived = false): Promise<FinanceCategory[]> {
    try {
      const colRef = collection(db, CATEGORIES_COLLECTION)
      const q = query(colRef, orderBy('name', 'asc'))

      const querySnapshot = await getDocs(q)
      let categories: FinanceCategory[] = []
      
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data()
        categories.push({
          id: docSnap.id,
          name: data.name,
          icon: data.icon,
          color: data.color,
          createdAt: data.createdAt,
          createdByUid: data.createdByUid,
          createdByName: data.createdByName,
          isArchived: !!data.isArchived,
          archivedAt: data.archivedAt,
          archivedByUid: data.archivedByUid,
          archivedByName: data.archivedByName
        })
      })
      
      if (!includeArchived) {
        categories = categories.filter(c => !c.isArchived)
      }

      return categories
    } catch (err) {
      console.error('Failed to get finance categories:', err)
      throw err
    }
  },

  /**
   * Creates a new category.
   */
  async createCategory(
    name: string,
    icon: string | undefined,
    color: string | undefined,
    createdByUid: string,
    createdByName: string
  ): Promise<string> {
    try {
      const colRef = collection(db, CATEGORIES_COLLECTION)
      const docRef = await addDoc(colRef, {
        name,
        icon: icon || '',
        color: color || '',
        isArchived: false,
        createdByUid,
        createdByName,
        createdAt: serverTimestamp()
      })

      await auditService.logAction(
        'CATEGORY_CREATE',
        'settings',
        `Finance category '${name}' was created by ${createdByName}`,
        createdByName,
        { categoryId: docRef.id, categoryName: name }
      )

      return docRef.id
    } catch (err) {
      console.error('Failed to create finance category:', err)
      throw err
    }
  },

  /**
   * Archives (soft-deletes) a category.
   */
  async archiveCategory(
    id: string,
    name: string,
    archivedByUid: string,
    archivedByName: string
  ): Promise<void> {
    try {
      const docRef = doc(db, CATEGORIES_COLLECTION, id)
      await updateDoc(docRef, {
        isArchived: true,
        archivedAt: serverTimestamp(),
        archivedByUid,
        archivedByName
      })

      await auditService.logAction(
        'CATEGORY_ARCHIVE',
        'settings',
        `Finance category '${name}' was archived by ${archivedByName}`,
        archivedByName,
        { categoryId: id, categoryName: name }
      )
    } catch (err) {
      console.error('Failed to archive finance category:', err)
      throw err
    }
  }
}
