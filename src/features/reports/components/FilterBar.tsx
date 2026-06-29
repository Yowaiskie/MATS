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
    <div className="flex flex-col md:flex-row gap-4 p-4 rounded-lg border border-gray-800 bg-gray-950/40 select-none">
      {/* Date range filters (Used by Summary, Member, Schedule tabs) */}
      {activeTab !== 'monthly' && (
        <>
          <div className="flex flex-col space-y-1.5 flex-1">
            <label htmlFor="filter-start" className="text-xxs font-semibold uppercase tracking-wider text-gray-400">
              Start Date
            </label>
            <input
              id="filter-start"
              type="date"
              value={startDate}
              onChange={(e) => onStartDateChange(e.target.value)}
              className="block w-full rounded border border-gray-800 bg-gray-950 px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex flex-col space-y-1.5 flex-1">
            <label htmlFor="filter-end" className="text-xxs font-semibold uppercase tracking-wider text-gray-400">
              End Date
            </label>
            <input
              id="filter-end"
              type="date"
              value={endDate}
              onChange={(e) => onEndDateChange(e.target.value)}
              className="block w-full rounded border border-gray-800 bg-gray-950 px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
            />
          </div>
        </>
      )}

      {/* Year filter (Only used by Monthly tab) */}
      {activeTab === 'monthly' && (
        <div className="flex flex-col space-y-1.5 w-full md:w-48">
          <label htmlFor="filter-year" className="text-xxs font-semibold uppercase tracking-wider text-gray-400">
            Select Year
          </label>
          <select
            id="filter-year"
            value={selectedYear}
            onChange={(e) => onYearChange(Number(e.target.value))}
            className="block w-full rounded border border-gray-800 bg-gray-950 px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
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
          <label htmlFor="filter-search" className="text-xxs font-semibold uppercase tracking-wider text-gray-400">
            {activeTab === 'member' ? 'Search Member Name' : 'Search Service Title'}
          </label>
          <input
            id="filter-search"
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder={activeTab === 'member' ? 'e.g. Dela Cruz' : 'e.g. Sunday Morning'}
            className="block w-full rounded border border-gray-800 bg-gray-950 px-3 py-1.5 text-xs text-white placeholder-gray-650 focus:outline-none focus:border-indigo-500"
          />
        </div>
      )}
    </div>
  )
}
