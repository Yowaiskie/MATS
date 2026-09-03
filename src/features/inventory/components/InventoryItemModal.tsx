import React, { useState, useEffect, useMemo } from 'react'
import { Modal } from '@/components/Modal'
import { useAuth } from '@/features/authentication/AuthContext'
import { inventoryService } from '@/services/inventoryService'
import { 
  DEFAULT_INVENTORY_CATEGORIES, 
  INVENTORY_CONDITIONS, 
  INVENTORY_UNITS,
  type InventoryItem, 
  type InventoryCategory,
  type ItemCondition 
} from '@/types/inventory'

interface Props {
  isOpen: boolean
  onClose: () => void
  item?: InventoryItem
  categories?: InventoryCategory[]
  onSuccess: () => void
}

export const InventoryItemModal: React.FC<Props> = ({
  isOpen,
  onClose,
  item,
  categories = [],
  onSuccess
}) => {
  const { user, profile } = useAuth()
  
  const [name, setName] = useState('')
  const [category, setCategory] = useState<string>('Recreation & Sports')
  const [customCategory, setCustomCategory] = useState('')
  const [isCustomCategory, setIsCustomCategory] = useState(false)
  const [quantity, setQuantity] = useState('1')
  const [unit, setUnit] = useState('pcs')
  const [condition, setCondition] = useState<ItemCondition>('Good')
  const [storageLocation, setStorageLocation] = useState('')
  const [donorOrSource, setDonorOrSource] = useState('')
  const [notes, setNotes] = useState('')
  
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (item) {
      setName(item.name || '')
      setCategory(item.category || 'Recreation & Sports')
      setIsCustomCategory(false)
      setCustomCategory('')
      setQuantity(String(item.quantity ?? 1))
      setUnit(item.unit || 'pcs')
      setCondition(item.condition || 'Good')
      setStorageLocation(item.storageLocation || '')
      setDonorOrSource(item.donorOrSource || '')
      setNotes(item.notes || '')
    } else {
      setName('')
      setCategory('Recreation & Sports')
      setIsCustomCategory(false)
      setCustomCategory('')
      setQuantity('1')
      setUnit('pcs')
      setCondition('Good')
      setStorageLocation('')
      setDonorOrSource('')
      setNotes('')
    }
    setError(null)
  }, [item, isOpen])

  const handleQuantityChange = (val: string) => {
    // Numbers only
    const cleaned = val.replace(/\D/g, '')
    setQuantity(cleaned)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Please provide an item name.')
      return
    }

    const finalCategory = isCustomCategory ? customCategory.trim() : category
    if (!finalCategory) {
      setError('Please select or specify a category.')
      return
    }

    const numQty = parseInt(quantity, 10)
    if (isNaN(numQty) || numQty < 0) {
      setError('Please enter a valid positive quantity.')
      return
    }

    try {
      setSaving(true)
      setError(null)

      const userUid = user?.uid || 'system'
      const userName = profile?.displayName || user?.email || 'Ministry Officer'

      if (item) {
        // Edit existing item
        await inventoryService.updateItem(
          item.id,
          {
            name: name.trim(),
            category: finalCategory,
            quantity: numQty,
            unit: unit.trim() || 'pcs',
            condition,
            storageLocation: storageLocation.trim() || 'Ministry Storage',
            donorOrSource: donorOrSource.trim() || '',
            notes: notes.trim() || ''
          },
          userUid,
          userName
        )
      } else {
        // Create new item
        await inventoryService.createItem({
          name: name.trim(),
          category: finalCategory,
          quantity: numQty,
          unit: unit.trim() || 'pcs',
          condition,
          status: 'In Stock',
          storageLocation: storageLocation.trim() || 'Ministry Storage',
          donorOrSource: donorOrSource.trim() || '',
          notes: notes.trim() || '',
          createdByUid: userUid,
          createdByName: userName
        })
      }

      onSuccess()
      onClose()
    } catch (err: any) {
      console.error('Failed to save inventory item:', err)
      setError(err.message || 'Failed to save item. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  // Dynamic categories with fallback to defaults if empty, plus current item category
  const allCategoryOptions = useMemo(() => {
    const list = categories.length > 0
      ? categories.map(c => c.name)
      : [...DEFAULT_INVENTORY_CATEGORIES]
    if (item?.category && !list.includes(item.category)) {
      list.push(item.category)
    }
    return Array.from(new Set(list)).sort()
  }, [categories, item])

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={item ? 'Edit Inventory Item' : 'Add New Equipment / Item'}
      subtitle="Track parish and ministry assets, condition, and storage location"
      badge="Asset Masterlist"
      icon={
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      }
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {error && (
          <div className="p-3.5 bg-rose-50 text-rose-800 text-xs font-bold rounded-2xl border border-rose-200 animate-fade-in">
            {error}
          </div>
        )}

        {/* Item Name */}
        <div>
          <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1">
            Item Name *
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Spalding Basketball, Chess Set, GoG, Altar Bell..."
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
        </div>

        {/* Category & Custom Category */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Category <span className="text-red-500">*</span>
            </label>
            <select
              value={isCustomCategory ? 'custom' : category}
              onChange={(e) => {
                if (e.target.value === 'custom') {
                  setIsCustomCategory(true)
                } else {
                  setIsCustomCategory(false)
                  setCategory(e.target.value)
                }
              }}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              {allCategoryOptions.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
              <option value="custom">+ Type Custom Category...</option>
            </select>
          </div>

          {isCustomCategory ? (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Custom Category Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                placeholder="e.g. Musical Instruments"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Condition <span className="text-red-500">*</span>
              </label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value as ItemCondition)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                {INVENTORY_CONDITIONS.map((cond) => (
                  <option key={cond} value={cond}>
                    {cond}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {isCustomCategory && (
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Condition <span className="text-red-500">*</span>
            </label>
            <select
              value={condition}
              onChange={(e) => setCondition(e.target.value as ItemCondition)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              {INVENTORY_CONDITIONS.map((cond) => (
                <option key={cond} value={cond}>
                  {cond}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Quantity & Unit */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Quantity <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  const q = Math.max(0, (parseInt(quantity, 10) || 0) - 1)
                  setQuantity(String(q))
                }}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-sm cursor-pointer active:scale-95"
              >
                -
              </button>
              <input
                type="text"
                inputMode="numeric"
                required
                value={quantity}
                onChange={(e) => handleQuantityChange(e.target.value)}
                className="w-full text-center px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => {
                  const q = (parseInt(quantity, 10) || 0) + 1
                  setQuantity(String(q))
                }}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-sm cursor-pointer active:scale-95"
              >
                +
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Unit
            </label>
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              {INVENTORY_UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Storage Location */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Storage Location / Shelf
          </label>
          <input
            type="text"
            value={storageLocation}
            onChange={(e) => setStorageLocation(e.target.value)}
            placeholder="e.g. Ministry Locker 1, Sacristy Cabinet A, Gym Storage..."
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Donor / Source */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Donor / Acquisition Source (Optional)
          </label>
          <input
            type="text"
            value={donorOrSource}
            onChange={(e) => setDonorOrSource(e.target.value)}
            placeholder="e.g. Donated by Batch 2024, Parish Allocation..."
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Notes / Remarks */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Notes / Remarks (Optional)
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Complete pieces with timer, size Medium, etc."
            className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 sticky bottom-0 bg-white">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl shadow-md shadow-indigo-500/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
          >
            {saving ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <span>{item ? 'Save Changes' : 'Add Item'}</span>
            )}
          </button>
        </div>
      </form>
    </Modal>
  )
}
