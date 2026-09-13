import React from 'react'
import { FilterDropdown } from '@/components'

interface FilterBarProps {
  activeTab: 'summary' | 'member' | 'schedule' | 'monthly' | 'holyhour' | 'qualifications'
  startDate: string
  endDate: string
  onStartDateChange: (val: string) => void
  onEndDateChange: (val: string) => void
  selectedYear: number
  onYearChange: (val: number) => void
  searchQuery: string
  onSearchQueryChange: (val: string) => void
  statusFilter?: string
  onStatusFilterChange?: (val: string) => void
}

export const FilterBar: React.FC<FilterBarProps> = ({
  activeTab,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  selectedYear,
  onYearChange,
  searchQuery,
  onSearchQueryChange,
  statusFilter = 'all',
  onStatusFilterChange,
}) => {
  const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i)

  return (
    <div className="flex flex-col md:flex-row gap-4 p-4 rounded-xl border border-slate-200/80 bg-white shadow-2xs select-none">
      {/* Date Presets for Member / Schedule tabs */}
      {(activeTab === 'member' || activeTab === 'schedule') && (
        <div className="flex flex-col space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Quick Date Presets
          </label>
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => {
                const now = new Date()
                const start = new Date(now.getFullYear(), now.getMonth(), 1)
                const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
                onStartDateChange(start.toISOString().split('T')[0])
                onEndDateChange(end.toISOString().split('T')[0])
              }}
              className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 transition cursor-pointer"
            >
              This Month
            </button>
            <button
              type="button"
              onClick={() => {
                const now = new Date()
                const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
                const end = new Date(now.getFullYear(), now.getMonth(), 0)
                onStartDateChange(start.toISOString().split('T')[0])
                onEndDateChange(end.toISOString().split('T')[0])
              }}
              className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 transition cursor-pointer"
            >
              Last Month
            </button>
            <button
              type="button"
              onClick={() => {
                const now = new Date()
                const start = new Date(now.getFullYear(), 0, 1)
                const end = new Date(now.getFullYear(), 11, 31)
                onStartDateChange(start.toISOString().split('T')[0])
                onEndDateChange(end.toISOString().split('T')[0])
              }}
              className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 transition cursor-pointer"
            >
              This Year
            </button>
          </div>
        </div>
      )}

      {/* Custom Date Range Pickers */}
      {activeTab !== 'monthly' && (
        <>
          <div className="flex flex-col space-y-1.5 flex-1">
            <label htmlFor="filter-start" className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Start Date
            </label>
            <input
              id="filter-start"
              type="date"
              value={startDate}
              onChange={(e) => onStartDateChange(e.target.value)}
              className="block w-full rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 cursor-pointer font-medium"
            />
          </div>

          <div className="flex flex-col space-y-1.5 flex-1">
            <label htmlFor="filter-end" className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              End Date
            </label>
            <input
              id="filter-end"
              type="date"
              value={endDate}
              onChange={(e) => onEndDateChange(e.target.value)}
              className="block w-full rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 cursor-pointer font-medium"
            />
          </div>
        </>
      )}

      {/* Year filter (Only used by Monthly tab) */}
      {activeTab === 'monthly' && (
        <div className="flex flex-col space-y-1.5 w-full md:w-48">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Select Year
          </label>
          <FilterDropdown
            value={String(selectedYear)}
            onChange={(val) => onYearChange(Number(val))}
            options={years.map(y => ({
              key: String(y),
              label: String(y),
              dot: 'bg-indigo-500',
            }))}
          />
        </div>
      )}

      {/* Suspension Status Filter (Only for Member tab) */}
      {activeTab === 'member' && onStatusFilterChange && (
        <div className="flex flex-col space-y-1.5 w-full md:w-56">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Evaluation Status
          </label>
          <FilterDropdown
            value={statusFilter}
            onChange={(val) => onStatusFilterChange(val)}
            allLabel="All Statuses"
            options={[
              { key: 'all', label: 'All Statuses', dot: 'bg-slate-400' },
              { key: 'active', label: 'Active / Good Standing', dot: 'bg-emerald-500' },
              { key: 'warning', label: 'Warning Only', dot: 'bg-amber-500' },
              { key: 'suspended', label: 'Suspended Only', dot: 'bg-rose-500' },
              { key: 'inactive', label: 'Inactive (0 Serves)', dot: 'bg-slate-300' },
            ]}
          />
        </div>
      )}

      {/* Search Input (For Member and Schedule list queries) */}
      {(activeTab === 'member' || activeTab === 'schedule') && (
        <div className="flex flex-col space-y-1.5 flex-1">
          <label htmlFor="filter-search" className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            {activeTab === 'member' ? 'Search Member Name' : 'Search Service Title'}
          </label>
          <input
            id="filter-search"
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder={activeTab === 'member' ? 'e.g. Dela Cruz' : 'e.g. Sunday Morning'}
            className="block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </div>
      )}
    </div>
  )
}
