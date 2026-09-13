import React, { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/features/authentication/AuthContext'
import { inventoryService } from '@/services/inventoryService'
import { authService } from '@/services/authService'
import { 
  type InventoryItem, 
  type InventoryCategory,
  INVENTORY_CONDITIONS 
} from '@/types/inventory'
import { InventoryItemModal } from '../components/InventoryItemModal'
import { ManageInventoryCategoriesModal } from '../components/ManageInventoryCategoriesModal'
import { PasswordConfirmModal } from '@/components/Dialog'
import { Card } from '@/components/Card'

export const InventoryPage: React.FC = () => {
  const { user, profile, canAction } = useAuth()
  
  const [items, setItems] = useState<InventoryItem[]>([])
  const [categories, setCategories] = useState<InventoryCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [showArchived, setShowArchived] = useState(false)
  
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedCondition, setSelectedCondition] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')
  
  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isCategoriesModalOpen, setIsCategoriesModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<InventoryItem | undefined>(undefined)
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string; name: string }>({ isOpen: false, id: '', name: '' })
  const [archiveConfirm, setArchiveConfirm] = useState<{ isOpen: boolean; id: string; name: string; isArchived: boolean }>({ isOpen: false, id: '', name: '', isArchived: false })

  const isAuthorized = canAction('canManageInventory') || profile?.role === 'admin' || profile?.role === 'coordinator'

  // Subscribe to items
  useEffect(() => {
    setLoading(true)
    const unsubscribe = inventoryService.subscribeItems((fetchedItems) => {
      setItems(fetchedItems)
      setLoading(false)
    }, showArchived)

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe()
      }
    }
  }, [showArchived])

  // Subscribe to dynamic categories
  useEffect(() => {
    const unsubCats = inventoryService.subscribeCategories((fetchedCats) => {
      setCategories(fetchedCats as InventoryCategory[])
    })

    return () => {
      if (typeof unsubCats === 'function') {
        unsubCats()
      }
    }
  }, [])

  // Categories shown in slide bar: from DB + from existing items
  const allCategoryNames = useMemo(() => {
    const catNamesFromDb = categories.map(c => c.name)
    const catNamesFromItems = items.map(i => i.category).filter(Boolean) as string[]
    const combined = Array.from(new Set([...catNamesFromDb, ...catNamesFromItems])).sort()
    return combined
  }, [categories, items])

  // Category item counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: items.length }
    items.forEach((item) => {
      const cat = item.category || 'General Supplies'
      counts[cat] = (counts[cat] || 0) + 1
    })
    return counts
  }, [items])

  // Filtered items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Category Filter
      if (selectedCategory !== 'all' && item.category !== selectedCategory) {
        return false
      }
      // Condition Filter
      if (selectedCondition !== 'all' && item.condition !== selectedCondition) {
        return false
      }
      // Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        const matchName = item.name.toLowerCase().includes(query)
        const matchCat = (item.category || '').toLowerCase().includes(query)
        const matchLoc = (item.storageLocation || '').toLowerCase().includes(query)
        const matchNotes = (item.notes || '').toLowerCase().includes(query)
        const matchDonor = (item.donorOrSource || '').toLowerCase().includes(query)
        if (!matchName && !matchCat && !matchLoc && !matchNotes && !matchDonor) {
          return false
        }
      }
      return true
    })
  }, [items, selectedCategory, selectedCondition, searchQuery])

  // KPI Metrics
  const metrics = useMemo(() => {
    const activeList = items.filter(i => !i.isArchived)
    const totalItems = activeList.length
    const totalUnits = activeList.reduce((sum, i) => sum + (Number(i.quantity) || 0), 0)
    const goodConditionCount = activeList.filter(i => i.condition === 'Good' || i.condition === 'Brand New').length
    const damagedCount = activeList.filter(i => i.condition === 'Damaged / For Repair').length
    return {
      totalItems,
      totalUnits,
      goodConditionCount,
      damagedCount
    }
  }, [items])

  // Quick Quantity Adjustment
  const handleQuickAdjust = async (item: InventoryItem, delta: number) => {
    if (!isAuthorized) return
    try {
      const userUid = user?.uid || 'system'
      const userName = profile?.displayName || user?.email || 'Ministry Officer'
      await inventoryService.adjustQuantity(
        item.id,
        delta,
        item.quantity,
        item.condition,
        userUid,
        userName
      )
    } catch (err) {
      console.error('Failed to adjust quantity:', err)
    }
  }

  // Handle Archive / Restore
  const handleConfirmArchive = async (password: string) => {
    if (!user || !profile || !archiveConfirm.id) return
    try {
      await authService.verifyPassword(password)
      const userUid = user.uid
      const userName = profile.displayName || user.email || 'Ministry Officer'
      await inventoryService.archiveItem(archiveConfirm.id, !archiveConfirm.isArchived, userUid, userName)
      setArchiveConfirm({ isOpen: false, id: '', name: '', isArchived: false })
    } catch (err: any) {
      console.error(err)
      throw new Error(err.message || 'Verification failed. Password may be incorrect.')
    }
  }

  // Handle Delete
  const handleConfirmDelete = async (password: string) => {
    if (!user || !deleteConfirm.id) return
    try {
      await authService.verifyPassword(password)
      await inventoryService.deleteItem(deleteConfirm.id)
      setDeleteConfirm({ isOpen: false, id: '', name: '' })
    } catch (err: any) {
      console.error(err)
      throw new Error(err.message || 'Verification failed. Password may be incorrect.')
    }
  }

  const getConditionBadge = (condition: string) => {
    switch (condition) {
      case 'Brand New':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200'
      case 'Good':
        return 'bg-blue-50 text-blue-700 border-blue-200'
      case 'Fair / Usable':
        return 'bg-amber-50 text-amber-800 border-amber-200'
      case 'Damaged / For Repair':
        return 'bg-red-50 text-red-700 border-red-200'
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200'
    }
  }

  const getStatusBadge = (status: string, qty: number) => {
    if (qty === 0 || status === 'Out of Stock') {
      return <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-red-100 text-red-700 uppercase">Out of Stock</span>
    }
    if (status === 'Under Maintenance') {
      return <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-rose-100 text-rose-800 uppercase">Maintenance</span>
    }
    if (qty <= 2 || status === 'Low Stock') {
      return <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-amber-100 text-amber-800 uppercase">Low Stock</span>
    }
    return <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-emerald-100 text-emerald-800 uppercase">In Stock</span>
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Ministry Inventory
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
            Track sports equipment, games, liturgical gear, robes, and ministry property.
          </p>
        </div>

        {isAuthorized && (
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <button
              type="button"
              onClick={() => setIsCategoriesModalOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs sm:text-sm font-bold border border-slate-200/80 transition-all cursor-pointer active:scale-95 shrink-0"
              title="Manage Inventory Categories"
            >
              <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              <span>Categories</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setEditingItem(undefined)
                setIsModalOpen(true)
              }}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-blue-500/25 transition-all cursor-pointer active:scale-95 shrink-0"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              <span>Add Item</span>
            </button>
          </div>
        )}
      </div>

      {/* KPI Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="p-4 bg-white border border-slate-200/80 shadow-2xs rounded-2xl flex items-center gap-3.5">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Total Items</span>
            <span className="text-xl font-extrabold text-slate-900">{metrics.totalItems}</span>
          </div>
        </Card>

        <Card className="p-4 bg-white border border-slate-200/80 shadow-2xs rounded-2xl flex items-center gap-3.5">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
            </svg>
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Total Quantity</span>
            <span className="text-xl font-extrabold text-slate-900">{metrics.totalUnits}</span>
          </div>
        </Card>

        <Card className="p-4 bg-white border border-slate-200/80 shadow-2xs rounded-2xl flex items-center gap-3.5">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Good Condition</span>
            <span className="text-xl font-extrabold text-emerald-700">{metrics.goodConditionCount}</span>
          </div>
        </Card>

        <Card className="p-4 bg-white border border-slate-200/80 shadow-2xs rounded-2xl flex items-center gap-3.5">
          <div className="p-3 bg-red-50 text-red-600 rounded-xl shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Needs Attention</span>
            <span className="text-xl font-extrabold text-red-600">{metrics.damagedCount}</span>
          </div>
        </Card>
      </div>

      {/* Modern Swipeable Segmented Category Navigation Bar */}
      <div className="bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden py-0.5 px-0.5 flex-1">
          {[
            { key: 'all', label: 'All Items' },
            ...allCategoryNames.map(c => ({ key: c, label: c }))
          ].map((cat) => {
            const isActive = selectedCategory === cat.key
            const count = categoryCounts[cat.key] || 0
            return (
              <button
                key={cat.key}
                type="button"
                onClick={() => setSelectedCategory(cat.key)}
                className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl transition-all duration-200 shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/25 ring-1 ring-blue-700/20'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
                }`}
              >
                <span className="whitespace-nowrap">{cat.label}</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black leading-none ${
                  isActive ? 'bg-white text-blue-700' : 'bg-slate-200 text-slate-700'
                }`}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Global Archive Filter Toggle */}
        <button
          type="button"
          onClick={() => setShowArchived(!showArchived)}
          title={showArchived ? 'Hide Archived Records' : 'Show Archived Records'}
          className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border transition-all shrink-0 cursor-pointer ${
            showArchived
              ? 'bg-amber-100 text-amber-900 border-amber-300 shadow-xs'
              : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 border-slate-200/80 shadow-2xs'
          }`}
        >
          <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
          </svg>
          <span className="hidden md:inline">{showArchived ? 'Hide Archives' : 'Archives'}</span>
        </button>
      </div>

      {/* Filter Bar: Search, Condition Filter, View Switcher */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search Bar */}
        <div className="relative flex-1">
          <svg className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search items, storage locations, notes..."
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
          />
        </div>

        {/* Condition Filter */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <div className="relative">
            <select
              value={selectedCondition}
              onChange={(e) => setSelectedCondition(e.target.value)}
              className="h-10 pl-3.5 pr-10 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 appearance-none focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 shadow-2xs cursor-pointer transition"
            >
              <option value="all">All Conditions</option>
              {INVENTORY_CONDITIONS.map((cond) => (
                <option key={cond} value={cond}>
                  {cond}
                </option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </div>
          </div>

          {/* View Mode Toggle (Grid / Table) */}
          <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200/80">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              title="Grid Card View"
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === 'grid' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              title="Table View"
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === 'table' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="flex items-center justify-center p-16 bg-white rounded-2xl border border-slate-200 shadow-2xs">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent" />
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-16 px-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
          </div>
          <h3 className="text-sm font-bold text-slate-800">No inventory items found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchQuery ? 'Try adjusting your search query or filters.' : 'Click "+ Add Item" above to start cataloging ministry equipment.'}
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        /* Grid Cards View */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredItems.map((item) => (
            <Card
              key={item.id}
              className={`p-4 rounded-2xl border transition-all duration-200 flex flex-col justify-between ${
                item.isArchived
                  ? 'bg-amber-50/40 border-amber-200'
                  : 'bg-white border-slate-200/80 hover:shadow-md'
              }`}
            >
              <div className="space-y-3">
                {/* Top Tags */}
                <div className="flex items-start justify-between gap-2">
                  <span className="px-2.5 py-1 text-[10px] font-extrabold uppercase rounded-lg bg-slate-100 text-slate-700">
                    {item.category}
                  </span>
                  {getStatusBadge(item.status, item.quantity)}
                </div>

                {/* Name */}
                <div>
                  <h3 className="text-base font-bold text-slate-900 leading-snug">
                    {item.name}
                  </h3>
                  <div className="flex items-center gap-1.5 mt-1 text-slate-500 text-xs font-semibold">
                    <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="truncate">{item.storageLocation || 'Unassigned Location'}</span>
                  </div>
                </div>

                {/* Condition Badge & Notes */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 text-[11px] font-bold rounded-md border ${getConditionBadge(item.condition)}`}>
                      {item.condition}
                    </span>
                    {item.donorOrSource && (
                      <span className="text-[10px] font-medium text-slate-500 truncate" title={item.donorOrSource}>
                        From: {item.donorOrSource}
                      </span>
                    )}
                  </div>
                  {item.notes && (
                    <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-xl border border-slate-100 line-clamp-2">
                      {item.notes}
                    </p>
                  )}
                </div>
              </div>

              {/* Bottom Quantity Control & Actions */}
              <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                {/* Quantity Pill with +/- */}
                <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200/80">
                  {isAuthorized && (
                    <button
                      type="button"
                      onClick={() => handleQuickAdjust(item, -1)}
                      title="Minus 1"
                      className="w-6 h-6 flex items-center justify-center rounded-lg bg-white text-slate-700 hover:bg-slate-200 font-black text-xs shadow-2xs cursor-pointer active:scale-90"
                    >
                      -
                    </button>
                  )}
                  <span className="px-2 text-xs font-black text-slate-900 whitespace-nowrap">
                    {item.quantity} {item.unit}
                  </span>
                  {isAuthorized && (
                    <button
                      type="button"
                      onClick={() => handleQuickAdjust(item, 1)}
                      title="Add 1"
                      className="w-6 h-6 flex items-center justify-center rounded-lg bg-white text-slate-700 hover:bg-slate-200 font-black text-xs shadow-2xs cursor-pointer active:scale-90"
                    >
                      +
                    </button>
                  )}
                </div>

                {/* Actions Button */}
                {isAuthorized && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingItem(item)
                        setIsModalOpen(true)
                      }}
                      title="Edit Item"
                      className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all cursor-pointer"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>

                    <button
                      type="button"
                      onClick={() => setArchiveConfirm({ isOpen: true, id: item.id, name: item.name, isArchived: item.isArchived })}
                      title={item.isArchived ? 'Restore' : 'Archive'}
                      className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all cursor-pointer"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                      </svg>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeleteConfirm({ isOpen: true, id: item.id, name: item.name })}
                      title="Delete Permanently"
                      className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        /* Detailed Table View */
        <Card className="overflow-hidden border border-slate-200/80 shadow-2xs rounded-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Item Name</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3 text-center">Quantity</th>
                  <th className="px-4 py-3">Condition</th>
                  <th className="px-4 py-3">Storage Location</th>
                  <th className="px-4 py-3">Status</th>
                  {isAuthorized && <th className="px-4 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-3 font-bold text-slate-900">
                      <div>{item.name}</div>
                      {item.notes && <div className="text-[11px] font-normal text-slate-500">{item.notes}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700">
                        {item.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center font-bold">
                      <div className="inline-flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-xl">
                        {isAuthorized && (
                          <button
                            type="button"
                            onClick={() => handleQuickAdjust(item, -1)}
                            className="w-5 h-5 flex items-center justify-center rounded bg-white text-slate-700 hover:bg-slate-200 font-black cursor-pointer"
                          >
                            -
                          </button>
                        )}
                        <span className="px-1 text-slate-900 font-extrabold">{item.quantity} {item.unit}</span>
                        {isAuthorized && (
                          <button
                            type="button"
                            onClick={() => handleQuickAdjust(item, 1)}
                            className="w-5 h-5 flex items-center justify-center rounded bg-white text-slate-700 hover:bg-slate-200 font-black cursor-pointer"
                          >
                            +
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md border ${getConditionBadge(item.condition)}`}>
                        {item.condition}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 font-medium">{item.storageLocation || '-'}</td>
                    <td className="px-4 py-3">{getStatusBadge(item.status, item.quantity)}</td>
                    {isAuthorized && (
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingItem(item)
                              setIsModalOpen(true)
                            }}
                            className="p-1 text-slate-500 hover:text-blue-600 rounded transition-all cursor-pointer"
                            title="Edit"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => setArchiveConfirm({ isOpen: true, id: item.id, name: item.name, isArchived: item.isArchived })}
                            className="p-1 text-slate-500 hover:text-amber-600 rounded transition-all cursor-pointer"
                            title={item.isArchived ? 'Restore' : 'Archive'}
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirm({ isOpen: true, id: item.id, name: item.name })}
                            className="p-1 text-slate-500 hover:text-red-600 rounded transition-all cursor-pointer"
                            title="Delete"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Add / Edit Item Modal */}
      <InventoryItemModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setEditingItem(undefined)
        }}
        item={editingItem}
        categories={categories}
        onSuccess={() => {}}
      />

      {/* Manage Categories Modal */}
      <ManageInventoryCategoriesModal
        isOpen={isCategoriesModalOpen}
        onClose={() => setIsCategoriesModalOpen(false)}
        categories={categories}
        items={items}
      />

      {/* Password Confirm Delete Modal */}
      <PasswordConfirmModal
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, id: '', name: '' })}
        onConfirm={handleConfirmDelete}
        title={`Delete "${deleteConfirm.name}"`}
        message={`Are you sure you want to permanently delete this inventory item? This action cannot be undone.`}
        confirmLabel="Delete Permanently"
      />

      {/* Password Confirm Archive Modal */}
      <PasswordConfirmModal
        isOpen={archiveConfirm.isOpen}
        onClose={() => setArchiveConfirm({ isOpen: false, id: '', name: '', isArchived: false })}
        onConfirm={handleConfirmArchive}
        title={`${archiveConfirm.isArchived ? 'Restore' : 'Archive'} "${archiveConfirm.name}"`}
        message={`This will ${archiveConfirm.isArchived ? 'restore the item to the active inventory' : 'move the item to the archives'}. Please verify your password to proceed.`}
        confirmLabel={archiveConfirm.isArchived ? 'Restore Item' : 'Archive Item'}
      />
    </div>
  )
}
