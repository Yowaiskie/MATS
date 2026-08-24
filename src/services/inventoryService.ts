import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  onSnapshot, 
  serverTimestamp 
} from 'firebase/firestore'
import { db } from '@/firebase/config'
import type { InventoryItem, ItemStatus } from '@/types/inventory'

const COLLECTION_NAME = 'inventory_items'

export const inventoryService = {
  // Real-time listener for inventory items
  subscribeItems: (
    callback: (items: InventoryItem[]) => void,
    includeArchived = false
  ) => {
    const colRef = collection(db, COLLECTION_NAME)
    const q = query(colRef)

    return onSnapshot(
      q,
      (snapshot) => {
        let items = snapshot.docs.map((docSnap) => {
          const data = docSnap.data()
          return {
            id: docSnap.id,
            ...data
          } as InventoryItem
        })

        if (!includeArchived) {
          items = items.filter(i => !i.isArchived)
        }

        items.sort((a, b) => {
          const catA = a.category || ''
          const catB = b.category || ''
          if (catA !== catB) return catA.localeCompare(catB)
          return (a.name || '').localeCompare(b.name || '')
        })

        callback(items)
      },
      (error) => {
        console.error('Error in inventory snapshot listener:', error)
      }
    )
  },

  // Fetch all items (one-time)
  getItems: async (includeArchived = false): Promise<InventoryItem[]> => {
    try {
      const colRef = collection(db, COLLECTION_NAME)
      const snap = await getDocs(colRef)
      let items = snap.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      })) as InventoryItem[]

      if (!includeArchived) {
        items = items.filter(i => !i.isArchived)
      }

      items.sort((a, b) => {
        const catA = a.category || ''
        const catB = b.category || ''
        if (catA !== catB) return catA.localeCompare(catB)
        return (a.name || '').localeCompare(b.name || '')
      })

      return items
    } catch (err) {
      console.error('Failed to get inventory items:', err)
      throw err
    }
  },

  // Get single item
  getItemById: async (id: string): Promise<InventoryItem | null> => {
    const docRef = doc(db, COLLECTION_NAME, id)
    const docSnap = await getDoc(docRef)
    if (!docSnap.exists()) return null
    return { id: docSnap.id, ...docSnap.data() } as InventoryItem
  },

  // Create new inventory item
  createItem: async (data: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt' | 'isArchived'>): Promise<string> => {
    const colRef = collection(db, COLLECTION_NAME)
    
    // Determine initial status based on quantity & condition
    let status: ItemStatus = data.status || 'In Stock'
    if (data.condition === 'Damaged / For Repair') {
      status = 'Under Maintenance'
    } else if (data.quantity === 0) {
      status = 'Out of Stock'
    } else if (data.quantity <= 2) {
      status = 'Low Stock'
    } else {
      status = 'In Stock'
    }

    const newDoc = await addDoc(colRef, {
      ...data,
      quantity: Number(data.quantity) || 0,
      status,
      isArchived: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })

    return newDoc.id
  },

  // Update existing inventory item
  updateItem: async (
    id: string,
    data: Partial<Omit<InventoryItem, 'id' | 'createdAt'>>,
    updatedByUid: string,
    updatedByName: string
  ): Promise<void> => {
    const docRef = doc(db, COLLECTION_NAME, id)
    
    const updatePayload: any = {
      ...data,
      updatedByUid,
      updatedByName,
      updatedAt: serverTimestamp()
    }

    if (data.quantity !== undefined) {
      updatePayload.quantity = Number(data.quantity) || 0
      if (data.condition === 'Damaged / For Repair') {
        updatePayload.status = 'Under Maintenance'
      } else if (updatePayload.quantity === 0) {
        updatePayload.status = 'Out of Stock'
      } else if (updatePayload.quantity <= 2) {
        updatePayload.status = 'Low Stock'
      } else {
        updatePayload.status = 'In Stock'
      }
    }

    await updateDoc(docRef, updatePayload)
  },

  // Fast quantity adjustment (e.g. +1 / -1)
  adjustQuantity: async (
    id: string,
    delta: number,
    currentQuantity: number,
    currentCondition: string,
    updatedByUid: string,
    updatedByName: string
  ): Promise<number> => {
    const newQty = Math.max(0, currentQuantity + delta)
    let newStatus: ItemStatus = 'In Stock'
    if (currentCondition === 'Damaged / For Repair') {
      newStatus = 'Under Maintenance'
    } else if (newQty === 0) {
      newStatus = 'Out of Stock'
    } else if (newQty <= 2) {
      newStatus = 'Low Stock'
    } else {
      newStatus = 'In Stock'
    }

    const docRef = doc(db, COLLECTION_NAME, id)
    await updateDoc(docRef, {
      quantity: newQty,
      status: newStatus,
      updatedByUid,
      updatedByName,
      updatedAt: serverTimestamp()
    })

    return newQty
  },

  // Archive / Restore item
  archiveItem: async (
    id: string,
    isArchived: boolean,
    updatedByUid: string,
    updatedByName: string
  ): Promise<void> => {
    const docRef = doc(db, COLLECTION_NAME, id)
    await updateDoc(docRef, {
      isArchived,
      updatedByUid,
      updatedByName,
      updatedAt: serverTimestamp()
    })
  },

  // Permanent Delete Item
  deleteItem: async (id: string): Promise<void> => {
    const docRef = doc(db, COLLECTION_NAME, id)
    await deleteDoc(docRef)
  },

  // ==========================================
  // Category Management
  // ==========================================
  subscribeCategories: (callback: (categories: { id: string; name: string; description?: string }[]) => void) => {
    const colRef = collection(db, 'inventory_categories')
    const q = query(colRef)

    return onSnapshot(
      q,
      (snapshot) => {
        const categories = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data()
        })) as { id: string; name: string; description?: string }[]

        categories.sort((a, b) => a.name.localeCompare(b.name))
        callback(categories)
      },
      (err) => {
        console.error('Error subscribing to categories:', err)
      }
    )
  },

  createCategory: async (
    name: string,
    description: string | undefined,
    userUid: string,
    userName: string
  ): Promise<string> => {
    const colRef = collection(db, 'inventory_categories')
    const docSnap = await addDoc(colRef, {
      name: name.trim(),
      description: description?.trim() || '',
      createdByUid: userUid,
      createdByName: userName,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })
    return docSnap.id
  },

  updateCategory: async (
    id: string,
    name: string,
    description?: string
  ): Promise<void> => {
    const docRef = doc(db, 'inventory_categories', id)
    await updateDoc(docRef, {
      name: name.trim(),
      description: description?.trim() || '',
      updatedAt: serverTimestamp()
    })
  },

  deleteCategory: async (id: string): Promise<void> => {
    const docRef = doc(db, 'inventory_categories', id)
    await deleteDoc(docRef)
  },

  seedDefaultCategories: async (
    userUid: string,
    userName: string
  ): Promise<void> => {
    const defaults = [
      'Recreation & Sports',
      'Liturgical & Sacristy',
      'Vestments & Robes',
      'Audio-Visual & Tech',
      'Facilities & Storage',
      'General Supplies'
    ]
    const colRef = collection(db, 'inventory_categories')
    const existingSnap = await getDocs(colRef)
    const existingNames = new Set(existingSnap.docs.map(d => d.data().name?.toLowerCase()))

    for (const catName of defaults) {
      if (!existingNames.has(catName.toLowerCase())) {
        await addDoc(colRef, {
          name: catName,
          description: '',
          createdByUid: userUid,
          createdByName: userName,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        })
      }
    }
  }
}
