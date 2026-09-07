import React from 'react'

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

  // Check if startDate and endDate represent a specific full month (YYYY-MM)
  const monthValue = (() => {
    if (!startDate || !endDate) return ''
    const sParts = startDate.split('-')
    const eParts = endDate.split('-')
    if (sParts.length === 3 && eParts.length === 3) {
      const [sY, sM, sD] = sParts
      const [eY, eM, eD] = eParts
      if (sY === eY && sM === eM && sD === '01') {
        const lastDay = new Date(parseInt(sY, 10), parseInt(sM, 10), 0).getDate()
        if (parseInt(eD, 10) === lastDay) {
          return `${sY}-${sM}`
        }
      }
    }
    return ''
  })()

  return (
    <div className="flex flex-col md:flex-row gap-4 p-4 rounded-xl border border-gray-200 bg-white shadow-sm select-none">
      {/* Date range & Month Picker filters (Used by Summary, Member, Schedule tabs) */}
      {activeTab !== 'monthly' && (
        <>
          <div className="flex flex-col space-y-1.5 w-full md:w-52">
            <label htmlFor="filter-month-select" className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
              Select Month
            </label>
            <input
              id="filter-month-select"
              type="month"
              value={monthValue}
              onChange={(e) => {
                const val = e.target.value
                if (!val) {
                  onStartDateChange('')
                  onEndDateChange('')
                  return
                }
                const [yearStr, monthStr] = val.split('-')
                const year = parseInt(yearStr, 10)
                const month = parseInt(monthStr, 10)
                const firstDay = `${year}-${String(month).padStart(2, '0')}-01`
                const lastDayNum = new Date(year, month, 0).getDate()
                const lastDay = `${year}-${String(month).padStart(2, '0')}-${String(lastDayNum).padStart(2, '0')}`
                onStartDateChange(firstDay)
                onEndDateChange(lastDay)
              }}
              className="block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-800 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 cursor-pointer font-medium"
            />
          </div>

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
            className="block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-800 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 cursor-pointer"
          >
            {years.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      )}

      {/* Suspension Status Filter (Only for Member tab) */}
      {activeTab === 'member' && onStatusFilterChange && (
        <div className="flex flex-col space-y-1.5 w-full md:w-56">
          <label htmlFor="filter-suspension" className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
            Evaluation Status
          </label>
          <select
            id="filter-suspension"
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
            className="block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-800 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active / Good Standing</option>
            <option value="warning">Warning Only</option>
            <option value="suspended">Suspended Only</option>
            <option value="inactive">Inactive (0 Serves)</option>
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
