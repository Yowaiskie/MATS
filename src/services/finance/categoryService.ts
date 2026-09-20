import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc,
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
   * Updates an existing category.
   */
  async updateCategory(
    id: string,
    name: string,
    color: string | undefined,
    _updatedByUid: string,
    updatedByName: string
  ): Promise<void> {
    try {
      const docRef = doc(db, CATEGORIES_COLLECTION, id)
      await updateDoc(docRef, {
        name,
        color: color || '',
        updatedAt: serverTimestamp()
      })

      await auditService.logAction(
        'CATEGORY_UPDATE',
        'settings',
        `Finance category '${name}' was updated by ${updatedByName}`,
        updatedByName,
        { categoryId: id, categoryName: name }
      )
    } catch (err) {
      console.error('Failed to update finance category:', err)
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
  },

  /**
   * Restores an archived category.
   */
  async restoreCategory(
    id: string,
    name: string,
    _restoredByUid: string,
    restoredByName: string
  ): Promise<void> {
    try {
      const docRef = doc(db, CATEGORIES_COLLECTION, id)
      await updateDoc(docRef, {
        isArchived: false,
        archivedAt: null,
        archivedByUid: null,
        archivedByName: null
      })

      await auditService.logAction(
        'CATEGORY_RESTORE',
        'settings',
        `Finance category '${name}' was restored by ${restoredByName}`,
        restoredByName,
        { categoryId: id, categoryName: name }
      )
    } catch (err) {
      console.error('Failed to restore finance category:', err)
      throw err
    }
  },

  /**
   * Permanently deletes a category.
   */
  async deleteCategory(
    id: string,
    name: string,
    _deletedByUid: string,
    deletedByName: string
  ): Promise<void> {
    try {
      const docRef = doc(db, CATEGORIES_COLLECTION, id)
      await deleteDoc(docRef)

      await auditService.logAction(
        'CATEGORY_DELETE',
        'settings',
        `Permanently deleted finance category '${name}'`,
        deletedByName,
        { categoryId: id, categoryName: name }
      )
    } catch (err) {
      console.error('Failed to permanently delete finance category:', err)
      throw err
    }
  },

  /**
   * Bulk permanently deletes categories.
   */
  async bulkDeleteCategories(
    items: { id: string, name: string }[],
    deletedByUid: string,
    deletedByName: string
  ): Promise<void> {
    for (const item of items) {
      await this.deleteCategory(item.id, item.name, deletedByUid, deletedByName)
    }
  },

  /**
   * Bulk archives categories.
   */
  async bulkArchiveCategories(
    items: { id: string, name: string }[],
    archivedByUid: string,
    archivedByName: string
  ): Promise<void> {
    for (const item of items) {
      await this.archiveCategory(item.id, item.name, archivedByUid, archivedByName)
    }
  },

  /**
   * Bulk restores categories.
   */
  async bulkRestoreCategories(
    items: { id: string, name: string }[],
    restoredByUid: string,
    restoredByName: string
  ): Promise<void> {
    for (const item of items) {
      await this.restoreCategory(item.id, item.name, restoredByUid, restoredByName)
    }
  }
}
