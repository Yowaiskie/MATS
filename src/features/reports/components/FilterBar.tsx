import React from 'react'
import { FilterDropdown, DatePicker } from '@/components'
import type { SchedulePublication } from '@/types/publication'

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
  publications?: SchedulePublication[]
  selectedPublicationId?: string
  onPublicationChange?: (pubId: string) => void
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
  publications = [],
  selectedPublicationId = '',
  onPublicationChange,
}) => {
  const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i)

  return (
    <div className="flex flex-col md:flex-row gap-4 p-4 rounded-xl border border-slate-200/80 bg-white shadow-2xs select-none">
      {/* Schedule Cycle / Publication Selector */}
      {publications.length > 0 && (activeTab === 'member' || activeTab === 'schedule' || activeTab === 'summary') && (
        <div className="flex flex-col space-y-1.5 w-full md:w-64">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
            <span>Operating Schedule Cycle</span>
            {selectedPublicationId && selectedPublicationId !== 'custom' && (
              <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                Active Cycle
              </span>
            )}
          </label>
          <FilterDropdown
            value={selectedPublicationId || 'custom'}
            onChange={(val) => onPublicationChange?.(val)}
            allLabel="Custom Date Range"
            options={[
              ...publications.map(p => ({
                key: p.id,
                label: p.status === 'published' ? `● ${p.name} (Active)` : `${p.name}`,
                dot: p.status === 'published' ? 'bg-emerald-500' : 'bg-slate-400'
              })),
              { key: 'custom', label: 'Custom Date Range', dot: 'bg-indigo-400' }
            ]}
          />
        </div>
      )}


      {/* Custom Date Range Pickers */}
      {activeTab !== 'monthly' && (
        <>
          <div className="flex flex-col space-y-1.5 flex-1">
            <label htmlFor="filter-start" className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Start Date
            </label>
            <DatePicker
              id="filter-start"
              value={startDate}
              onChange={(val) => onStartDateChange(val)}
              placeholder="Select start date"
              maxDate={endDate || undefined}
            />
          </div>

          <div className="flex flex-col space-y-1.5 flex-1">
            <label htmlFor="filter-end" className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              End Date
            </label>
            <DatePicker
              id="filter-end"
              value={endDate}
              onChange={(val) => onEndDateChange(val)}
              placeholder="Select end date"
              minDate={startDate || undefined}
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
