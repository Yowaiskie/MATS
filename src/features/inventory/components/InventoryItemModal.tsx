import React, { useState, useEffect, useMemo } from 'react'
import { Modal } from '@/components/Modal'
import { Button, CustomSelect, useToast } from '@/components'
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
  const { toast } = useToast()
  
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
        await inventoryService.updateItem(
          item.id,
          {
            name: name.trim(),
            category: finalCategory,
            quantity: numQty,
            unit: unit.trim() || 'pcs',
            condition,
            storageLocation: storageLocation.trim() || undefined,
            donorOrSource: donorOrSource.trim() || undefined,
            notes: notes.trim() || undefined
          },
          userUid,
          userName
        )
        toast.success('Item Updated', `"${name.trim()}" has been updated in inventory.`)
      } else {
        await inventoryService.createItem({
          name: name.trim(),
          category: finalCategory,
          quantity: numQty,
          unit: unit.trim() || 'pcs',
          condition,
          status: 'In Stock',
          storageLocation: storageLocation.trim() || '',
          donorOrSource: donorOrSource.trim() || undefined,
          notes: notes.trim() || undefined,
          createdByUid: userUid,
          createdByName: userName
        })
        toast.success('Item Added', `"${name.trim()}" has been added to inventory.`)
      }

      onSuccess()
      onClose()
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Failed to save inventory item.')
      toast.error('Save Failed', err.message || 'Failed to save inventory item.')
    } finally {
      setSaving(false)
    }
  }

  const allCategoryOptions = useMemo(() => {
    const namesFromProps = categories.map(c => c.name)
    const combined = Array.from(new Set([...DEFAULT_INVENTORY_CATEGORIES, ...namesFromProps]))
    return combined.sort()
  }, [categories])

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={item ? 'Edit Inventory Item' : 'Add Inventory Item'}
      subtitle="Manage physical ministry assets, gear, and supplies"
      badge="Inventory"
      maxWidth="lg"
      footer={
        <>
          <Button
            type="button"
            variant="secondary"
            size="dense"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="inventory-item-form"
            variant="primary"
            size="dense"
            loading={saving}
            loadingText={item ? 'Saving...' : 'Adding...'}
          >
            {item ? 'Save Changes' : 'Add Item'}
          </Button>
        </>
      }
    >
      <form id="inventory-item-form" onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl">
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
            className="w-full h-10 px-3.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition shadow-2xs"
          />
        </div>

        {/* Category & Custom Category */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <CustomSelect
              label="Category"
              required
              value={isCustomCategory ? 'custom' : category}
              onChange={(e) => {
                const val = e.target.value
                if (val === 'custom') {
                  setIsCustomCategory(true)
                } else {
                  setIsCustomCategory(false)
                  setCategory(val)
                }
              }}
              options={[
                ...allCategoryOptions.map((cat) => ({ value: cat, label: cat })),
                { value: 'custom', label: '+ Type Custom Category...' }
              ]}
            />
          </div>

          {isCustomCategory ? (
            <div>
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1">
                Custom Category Name *
              </label>
              <input
                type="text"
                required
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                placeholder="e.g. Musical Instruments"
                className="w-full h-10 px-3.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition shadow-2xs"
              />
            </div>
          ) : (
            <div>
              <CustomSelect
                label="Condition"
                required
                value={condition}
                onChange={(e) => setCondition(e.target.value as ItemCondition)}
                options={INVENTORY_CONDITIONS.map((cond) => ({ value: cond, label: cond }))}
              />
            </div>
          )}
        </div>

        {isCustomCategory && (
          <div>
            <CustomSelect
              label="Condition"
              required
              value={condition}
              onChange={(e) => setCondition(e.target.value as ItemCondition)}
              options={INVENTORY_CONDITIONS.map((cond) => ({ value: cond, label: cond }))}
            />
          </div>
        )}

        {/* Quantity & Unit */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1">
              Quantity *
            </label>
            <input
              type="text"
              required
              value={quantity}
              onChange={(e) => handleQuantityChange(e.target.value)}
              placeholder="1"
              className="w-full h-10 px-3.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition shadow-2xs"
            />
          </div>

          <div>
            <CustomSelect
              label="Unit"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              options={INVENTORY_UNITS.map((u) => ({ value: u, label: u }))}
            />
          </div>
        </div>

        {/* Storage Location */}
        <div>
          <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1">
            Storage Location (Optional)
          </label>
          <input
            type="text"
            value={storageLocation}
            onChange={(e) => setStorageLocation(e.target.value)}
            placeholder="e.g. Sacristy Cabinet 2, Altar Server Room Locker 4..."
            className="w-full h-10 px-3.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition shadow-2xs"
          />
        </div>

        {/* Donor / Source */}
        <div>
          <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1">
            Donor / Source / Procurement (Optional)
          </label>
          <input
            type="text"
            value={donorOrSource}
            onChange={(e) => setDonorOrSource(e.target.value)}
            placeholder="e.g. Donated by Batch 2024, Parish Allocation..."
            className="w-full h-10 px-3.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition shadow-2xs"
          />
        </div>

        {/* Notes / Remarks */}
        <div>
          <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1">
            Notes / Remarks (Optional)
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Complete pieces with timer, size Medium, etc."
            className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition shadow-2xs"
          />
        </div>
      </form>
    </Modal>
  )
}
