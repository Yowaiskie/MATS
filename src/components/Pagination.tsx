import React from 'react'

interface PaginationProps {
  currentPage: number
  totalItems: number
  pageSize?: number
  onPageChange: (page: number) => void
  className?: string
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalItems,
  pageSize = 10,
  onPageChange,
  className = '',
}) => {
  const totalPages = Math.ceil(totalItems / pageSize)

  if (totalItems === 0 || totalPages <= 1) return null

  const startItem = (currentPage - 1) * pageSize + 1
  const endItem = Math.min(currentPage * pageSize, totalItems)

  const handlePrev = () => {
    if (currentPage > 1) onPageChange(currentPage - 1)
  }

  const handleNext = () => {
    if (currentPage < totalPages) onPageChange(currentPage + 1)
  }

  // Generate page numbers
  const getPageNumbers = () => {
    const pages: (number | string)[] = []
    const maxVisible = 5

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      pages.push(1)
      if (currentPage > 3) pages.push('...')

      const start = Math.max(2, currentPage - 1)
      const end = Math.min(totalPages - 1, currentPage + 1)

      for (let i = start; i <= end; i++) {
        if (!pages.includes(i)) pages.push(i)
      }

      if (currentPage < totalPages - 2) pages.push('...')
      pages.push(totalPages)
    }

    return pages
  }

  return (
    <div className={`flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-white border-t border-gray-200/80 text-xs text-gray-600 font-sans select-none rounded-b-xl ${className}`}>
      <div>
        Showing <span className="font-bold text-gray-900">{startItem}</span> to{' '}
        <span className="font-bold text-gray-900">{endItem}</span> of{' '}
        <span className="font-bold text-gray-900">{totalItems}</span> entries
      </div>

      <div className="flex items-center space-x-1">
        <button
          onClick={handlePrev}
          disabled={currentPage === 1}
          className="px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          Previous
        </button>

        {getPageNumbers().map((p, idx) =>
          typeof p === 'number' ? (
            <button
              key={idx}
              onClick={() => onPageChange(p)}
              className={`h-7 w-7 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                currentPage === p
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {p}
            </button>
          ) : (
            <span key={idx} className="px-1 text-gray-400">
              {p}
            </span>
          )
        )}

        <button
          onClick={handleNext}
          disabled={currentPage < totalPages}
          className="px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          Next
        </button>
      </div>
    </div>
  )
}
