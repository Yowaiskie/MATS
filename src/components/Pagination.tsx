import React from 'react'

export interface PaginationProps {
  currentPage: number
  totalItems?: number
  totalPages?: number
  pageSize?: number
  onPageChange: (page: number) => void
  className?: string
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalItems,
  totalPages,
  pageSize = 10,
  onPageChange,
  className = '',
}) => {
  const calculatedTotalPages = totalPages !== undefined
    ? totalPages
    : (totalItems !== undefined ? Math.max(1, Math.ceil(totalItems / pageSize)) : 1)

  const hasItems = totalItems !== undefined
  if ((hasItems && totalItems === 0) || calculatedTotalPages <= 1) return null

  const startItem = (currentPage - 1) * pageSize + 1
  const endItem = hasItems ? Math.min(currentPage * pageSize, totalItems) : currentPage * pageSize

  const handlePrev = () => {
    if (currentPage > 1) onPageChange(currentPage - 1)
  }

  const handleNext = () => {
    if (currentPage < calculatedTotalPages) onPageChange(currentPage + 1)
  }

  // Generate page numbers
  const getPageNumbers = () => {
    const pages: (number | string)[] = []
    const maxVisible = 5

    if (calculatedTotalPages <= maxVisible) {
      for (let i = 1; i <= calculatedTotalPages; i++) pages.push(i)
    } else {
      pages.push(1)
      if (currentPage > 3) pages.push('...')

      const start = Math.max(2, currentPage - 1)
      const end = Math.min(calculatedTotalPages - 1, currentPage + 1)

      for (let i = start; i <= end; i++) {
        if (!pages.includes(i)) pages.push(i)
      }

      if (currentPage < calculatedTotalPages - 2) pages.push('...')
      pages.push(calculatedTotalPages)
    }

    return pages
  }

  return (
    <div className={`flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3.5 bg-slate-50/50 border-t border-slate-200/80 text-xs text-slate-500 font-sans select-none rounded-b-2xl ${className}`}>
      <div>
        {hasItems ? (
          <>
            Showing <span className="font-extrabold text-slate-900">{startItem}</span> to{' '}
            <span className="font-extrabold text-slate-900">{endItem}</span> of{' '}
            <span className="font-extrabold text-slate-900">{totalItems}</span> entries
          </>
        ) : (
          <>
            Showing Page <span className="font-extrabold text-slate-900">{currentPage}</span> of{' '}
            <span className="font-extrabold text-slate-900">{calculatedTotalPages}</span>
          </>
        )}
      </div>

      <div className="flex items-center space-x-1.5">
        <button
          onClick={handlePrev}
          disabled={currentPage === 1}
          className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-2xs cursor-pointer"
        >
          Previous
        </button>

        {getPageNumbers().map((p, idx) =>
          typeof p === 'number' ? (
            <button
              key={idx}
              onClick={() => onPageChange(p)}
              className={`h-7 w-7 rounded-xl text-xs font-black transition-all cursor-pointer ${
                currentPage === p
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {p}
            </button>
          ) : (
            <span key={idx} className="px-1 text-slate-400">
              {p}
            </span>
          )
        )}

        <button
          onClick={handleNext}
          disabled={currentPage >= calculatedTotalPages}
          className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-2xs cursor-pointer"
        >
          Next
        </button>
      </div>
    </div>
  )
}
