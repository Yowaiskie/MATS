import React, { useState } from 'react'
import { Modal } from '@/components/Modal'
import { useAuth } from '@/features/authentication/AuthContext'
import { inventoryService } from '@/services/inventoryService'
import { type InventoryItem, type InventoryCategory } from '@/types/inventory'

interface Props {
  isOpen: boolean
  onClose: () => void
  categories: InventoryCategory[]
  items: InventoryItem[]
}

export const ManageInventoryCategoriesModal: React.FC<Props> = ({
  isOpen,
  onClose,
  categories,
  items
}) => {
  const { user, profile } = useAuth()
  
  const [newCatName, setNewCatName] = useState('')
  const [newCatDesc, setNewCatDesc] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [editingCatId, setEditingCatId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  // Count items per category
  const getItemCountForCategory = (catName: string) => {
    return items.filter(i => (i.category || '').toLowerCase() === catName.toLowerCase()).length
  }

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCatName.trim()) {
      setError('Please enter a category name.')
      return
    }

    // Check duplicate
    const exists = categories.some(c => c.name.toLowerCase() === newCatName.trim().toLowerCase())
    if (exists) {
      setError(`Category "${newCatName.trim()}" already exists.`)
      return
    }

    try {
      setAdding(true)
      setError(null)
      const userUid = user?.uid || 'system'
      const userName = profile?.displayName || user?.email || 'Ministry Officer'
      await inventoryService.createCategory(newCatName.trim(), newCatDesc.trim(), userUid, userName)
      setNewCatName('')
      setNewCatDesc('')
    } catch (err: any) {
      console.error('Failed to create category:', err)
      setError(err.message || 'Failed to add category.')
    } finally {
      setAdding(false)
    }
  }

  const handleStartEdit = (cat: InventoryCategory) => {
    setEditingCatId(cat.id)
    setEditName(cat.name)
  }

  const handleSaveEdit = async (catId: string) => {
    if (!editName.trim()) return
    try {
      setSavingEdit(true)
      await inventoryService.updateCategory(catId, editName.trim())
      setEditingCatId(null)
    } catch (err: any) {
      console.error('Failed to update category:', err)
      setError(err.message || 'Failed to update category.')
    } finally {
      setSavingEdit(false)
    }
  }

  const handleDeleteCategory = async (cat: InventoryCategory) => {
    const count = getItemCountForCategory(cat.name)
    if (count > 0) {
      if (!confirm(`Warning: There are ${count} items currently assigned to "${cat.name}". Are you sure you want to delete this category?`)) {
        return
      }
    } else {
      if (!confirm(`Are you sure you want to delete category "${cat.name}"?`)) {
        return
      }
    }

    try {
      await inventoryService.deleteCategory(cat.id)
    } catch (err: any) {
      console.error('Failed to delete category:', err)
      setError(err.message || 'Failed to delete category.')
    }
  }

  const [seeding, setSeeding] = useState(false)

  const handleSeedDefaults = async () => {
    try {
      setSeeding(true)
      setError(null)
      const userUid = user?.uid || 'system'
      const userName = profile?.displayName || user?.email || 'Ministry Officer'
      await inventoryService.seedDefaultCategories(userUid, userName)
    } catch (err: any) {
      console.error('Failed to seed categories:', err)
      setError(err.message || 'Failed to load default categories.')
    } finally {
      setSeeding(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Manage Inventory Categories"
      subtitle="Categorize and configure equipment and item categories"
      badge="Category Settings"
      icon={
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
        </svg>
      }
      maxWidth="xl"
    >
      <div className="space-y-5 text-xs">
        {error && (
          <div className="p-3.5 bg-rose-50 text-rose-800 text-xs font-bold rounded-2xl border border-rose-200 animate-fade-in">
            {error}
          </div>
        )}

        {/* Add New Category Card */}
        <form onSubmit={handleAddCategory} className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
              New Classification
            </span>
            <span className="text-xs font-black text-slate-800 uppercase tracking-tight">
              Create Category
            </span>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            <input
              type="text"
              required
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder="Category Name (e.g. Board Games, Outdoor Gear)..."
              className="flex-1 px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="submit"
              disabled={adding}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-indigo-500/20 cursor-pointer active:scale-95 disabled:opacity-50 shrink-0 flex items-center justify-center gap-1"
            >
              {adding ? 'Adding...' : 'Add Category'}
            </button>
          </div>
        </form>

        {/* Category List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">
              Configured Categories ({categories.length})
            </span>
            {categories.length === 0 && (
              <button
                type="button"
                onClick={handleSeedDefaults}
                disabled={seeding}
                className="text-[11px] font-bold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
              >
                {seeding ? 'Loading defaults...' : '+ Load Default Categories'}
              </button>
            )}
          </div>

          <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto border border-slate-200/80 rounded-2xl bg-white shadow-2xs">
            {categories.length === 0 ? (
              <div className="p-6 text-center space-y-2">
                <div className="text-xs text-slate-500 font-medium">
                  No custom categories configured yet.
                </div>
                <button
                  type="button"
                  onClick={handleSeedDefaults}
                  disabled={seeding}
                  className="px-3.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  {seeding ? 'Loading Defaults...' : '+ Click to Load Default Preset Categories'}
                </button>
              </div>
            ) : (
              categories.map((cat) => {
                const itemCount = getItemCountForCategory(cat.name)
                const isEditing = editingCatId === cat.id

                return (
                  <div key={cat.id} className="p-3 flex items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors">
                    {isEditing ? (
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="flex-1 px-2.5 py-1.5 bg-white border border-blue-400 rounded-lg text-xs font-bold text-slate-800 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(cat.id)}
                          disabled={savingEdit}
                          className="px-2.5 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold cursor-pointer hover:bg-blue-700"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingCatId(null)}
                          className="px-2.5 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold cursor-pointer hover:bg-slate-200"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                          <span className="text-xs font-bold text-slate-900 truncate">
                            {cat.name}
                          </span>
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-100 text-slate-600 shrink-0">
                            {itemCount} {itemCount === 1 ? 'item' : 'items'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleStartEdit(cat)}
                            title="Rename"
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteCategory(cat)}
                            title="Delete Category"
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  )
}
