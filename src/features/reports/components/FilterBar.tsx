import React from 'react'

interface FilterBarProps {
  activeTab: 'summary' | 'member' | 'schedule' | 'monthly'
  startDate: string
  endDate: string
  onStartDateChange: (val: string) => void
  onEndDateChange: (val: string) => void
  selectedYear: number
  onYearChange: (val: number) => void
  searchQuery: string
  onSearchQueryChange: (val: string) => void
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
}) => {
  const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i)

  return (
    <div className="flex flex-col md:flex-row gap-4 p-4 rounded-xl border border-gray-200 bg-white shadow-sm select-none">
      {/* Date range filters (Used by Summary, Member, Schedule tabs) */}
      {activeTab !== 'monthly' && (
        <>
          <div className="flex flex-col space-y-1.5 flex-1">
            <label htmlFor="filter-start" className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
              Start Date
            </label>
            <input
              id="filter-start"
              type="date"
              value={startDate}
              onChange={(e) => onStartDateChange(e.target.value)}
              className="block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-800 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div className="flex flex-col space-y-1.5 flex-1">
            <label htmlFor="filter-end" className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
              End Date
            </label>
            <input
              id="filter-end"
              type="date"
              value={endDate}
              onChange={(e) => onEndDateChange(e.target.value)}
              className="block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-800 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </>
      )}

      {/* Year filter (Only used by Monthly tab) */}
      {activeTab === 'monthly' && (
        <div className="flex flex-col space-y-1.5 w-full md:w-48">
          <label htmlFor="filter-year" className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
            Select Year
          </label>
          <select
            id="filter-year"
            value={selectedYear}
            onChange={(e) => onYearChange(Number(e.target.value))}
            className="block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-800 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          >
            {years.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      )}

      {/* Search Input (For Member and Schedule list queries) */}
      {(activeTab === 'member' || activeTab === 'schedule') && (
        <div className="flex flex-col space-y-1.5 flex-1">
          <label htmlFor="filter-search" className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
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
