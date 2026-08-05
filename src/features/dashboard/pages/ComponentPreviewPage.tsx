import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { Loading } from '@/components/Loading'

export const ComponentPreviewPage: React.FC = () => {
  // Modal Preview State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalType, setModalType] = useState<'form' | 'confirm' | 'alert'>('form')
  
  // Pagination Preview State
  const [currentPage, setCurrentPage] = useState(1)
  const totalItems = 42
  const pageSize = 10
  const totalPages = Math.ceil(totalItems / pageSize)

  const handlePrev = () => {
    if (currentPage > 1) setCurrentPage(prev => prev - 1)
  }
  const handleNext = () => {
    if (currentPage < totalPages) setCurrentPage(prev => prev + 1)
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-indigo-50/80 border border-indigo-200/80 rounded-2xl">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-indigo-600 text-white shadow-xs">
            UI Showcase Preview
          </span>
          <p className="text-xs font-semibold text-indigo-900">
            Preview of Enhanced Modals, Buttons, and Pagination Controls
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link 
            to="/dashboard-preview"
            className="text-xs font-extrabold text-indigo-700 hover:text-indigo-900 bg-white px-3 py-1.5 rounded-xl border border-indigo-200 shadow-2xs hover:bg-indigo-50 transition-colors"
          >
            ← Back to Dashboard Preview
          </Link>
        </div>
      </div>

      <div>
        <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">Component Design Showcase</h1>
        <p className="text-sm font-medium text-slate-500 mt-1">
          Interactive preview of enhanced Buttons, Modals, and Pagination.
        </p>
      </div>

      {/* SECTION 1: BUTTONS SHOWCASE */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-4">
        <div className="pb-3 border-b border-slate-100">
          <h3 className="text-base font-extrabold text-slate-900 tracking-tight">1. Enhanced Button System</h3>
          <p className="text-xs text-slate-500 font-medium mt-0.5">Clean gradients, subtle shadows, micro-scale animations, and icon pairings</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          {/* Primary Gradient Button */}
          <button className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-500/20 hover:shadow-lg hover:shadow-indigo-500/30 active:scale-95 transition-all cursor-pointer">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            <span>Primary Action</span>
          </button>

          {/* Secondary Soft Button */}
          <button className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 shadow-2xs active:scale-95 transition-all cursor-pointer">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
            </svg>
            <span>Secondary Action</span>
          </button>

          {/* Outline Button */}
          <button className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs text-slate-700 bg-white hover:bg-slate-50 border border-slate-200/80 shadow-2xs active:scale-95 transition-all cursor-pointer">
            <span>Outline Button</span>
          </button>

          {/* Danger Button */}
          <button className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs text-white bg-rose-600 hover:bg-rose-700 shadow-md shadow-rose-500/20 active:scale-95 transition-all cursor-pointer">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
            <span>Destructive Action</span>
          </button>
        </div>
      </div>

      {/* SECTION 2: MODAL DIALOG PREVIEW */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-4">
        <div className="pb-3 border-b border-slate-100">
          <h3 className="text-base font-extrabold text-slate-900 tracking-tight">2. Glassmorphic Modal Dialog</h3>
          <p className="text-xs text-slate-500 font-medium mt-0.5">Smooth backdrop blur, elevated cards, animated zoom entry, and header badges</p>
        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            onClick={() => { setModalType('form'); setIsModalOpen(true); }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-500/20 active:scale-95 transition-all cursor-pointer"
          >
            <span>Open Form Modal Preview</span>
          </button>

          <button
            onClick={() => { setModalType('confirm'); setIsModalOpen(true); }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-100 active:scale-95 transition-all cursor-pointer"
          >
            <span>Open Delete Confirmation Preview</span>
          </button>
        </div>
      </div>

      {/* SECTION 3: PAGINATION SHOWCASE */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-4">
        <div className="pb-3 border-b border-slate-100">
          <h3 className="text-base font-extrabold text-slate-900 tracking-tight">3. Compact Pill Pagination</h3>
          <p className="text-xs text-slate-500 font-medium mt-0.5">Clean page indicator chips, active highlight, responsive layout</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 overflow-hidden bg-white">
          <div className="p-4 text-xs font-semibold text-slate-500 bg-slate-50/50">
            Sample Table Content Area (Page {currentPage})
          </div>

          {/* Enhanced Pagination Control */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3.5 bg-slate-50/50 border-t border-slate-200/80 text-xs text-slate-500 font-sans select-none">
            <div>
              Showing <span className="font-extrabold text-slate-900">{(currentPage - 1) * pageSize + 1}</span> to{' '}
              <span className="font-extrabold text-slate-900">{Math.min(currentPage * pageSize, totalItems)}</span> of{' '}
              <span className="font-extrabold text-slate-900">{totalItems}</span> entries
            </div>

            <div className="flex items-center space-x-1.5">
              <button
                onClick={handlePrev}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-2xs cursor-pointer"
              >
                Previous
              </button>

              {[1, 2, 3, 4, 5].map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`h-7 w-7 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    currentPage === page
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {page}
                </button>
              ))}

              <button
                onClick={handleNext}
                disabled={currentPage >= totalPages}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-2xs cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 4: DUAL-MODE LOADING SYSTEM */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-4">
        <div className="pb-3 border-b border-slate-100">
          <h3 className="text-base font-extrabold text-slate-900 tracking-tight">4. Dual-Mode Loading System</h3>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Favicon Spinner for quick loads vs. Progress Bar with Percentage and Rotating Messages for long operations
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          {/* Quick Spinner Preview Card */}
          <div className="p-5 rounded-2xl border border-slate-200/80 bg-slate-50/40 flex flex-col items-center justify-center text-center space-y-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 bg-white px-2.5 py-1 rounded-full border border-slate-200 shadow-2xs">
              Quick Operation Mode (Fast)
            </span>
            <Loading variant="spinner" label="Loading MATS Data..." />
          </div>

          {/* Long Operation Progress Bar Card */}
          <div className="p-5 rounded-2xl border border-slate-200/80 bg-slate-50/40 flex flex-col items-center justify-center text-center space-y-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 bg-white px-2.5 py-1 rounded-full border border-slate-200 shadow-2xs">
              Long Operation Mode (Progress + Rotating Messages)
            </span>
            <Loading variant="bar" label="Generating Report Files" />
          </div>
        </div>
      </div>

      {/* DEMO MODAL COMPONENT */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Glass Backdrop */}
          <div 
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-md transition-opacity animate-in fade-in duration-200" 
            onClick={() => setIsModalOpen(false)} 
          />

          {/* Animated Modal Card */}
          <div className="relative w-full max-w-md rounded-3xl border border-slate-200/80 bg-white p-6 shadow-2xl z-10 animate-in fade-in zoom-in-95 duration-150">
            {modalType === 'form' ? (
              <div className="space-y-5">
                {/* Header */}
                <div className="flex items-start justify-between pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-500 text-white shadow-md shadow-indigo-500/20">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-base font-extrabold text-slate-900 tracking-tight">Create New Event</h3>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">Fill out the details to schedule a new ministry activity</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsModalOpen(false)}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                {/* Form Fields */}
                <div className="space-y-3.5">
                  <div>
                    <label className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                      Event Title <span className="text-rose-500">*</span>
                    </label>
                    <input 
                      type="text" 
                      placeholder="e.g. Annual General Assembly 2026"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/30 px-3.5 py-2.5 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none" 
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-wider mb-1">Stage</label>
                      <select className="w-full rounded-xl border border-slate-200 bg-slate-50/30 px-3.5 py-2.5 text-xs font-semibold text-slate-800 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none">
                        <option>Planning</option>
                        <option>Preparation</option>
                        <option>Ready</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-wider mb-1">Priority</label>
                      <select className="w-full rounded-xl border border-slate-200 bg-slate-50/30 px-3.5 py-2.5 text-xs font-semibold text-slate-800 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none">
                        <option>Medium</option>
                        <option>High</option>
                        <option>Critical</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-extrabold text-slate-700 uppercase tracking-wider mb-1">Description</label>
                    <textarea 
                      rows={3}
                      placeholder="Brief details about the event objective..."
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/30 px-3.5 py-2.5 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all outline-none resize-none" 
                    />
                  </div>
                </div>

                {/* Footer Bar */}
                <div className="-mx-6 -mb-6 p-4 mt-6 bg-slate-50/80 border-t border-slate-100 rounded-b-3xl flex justify-end gap-2.5">
                  <button 
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100/80 transition-all cursor-pointer shadow-2xs"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={() => setIsModalOpen(false)}
                    className="px-5 py-2.5 rounded-xl text-xs font-extrabold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-500/20 active:scale-95 transition-all cursor-pointer"
                  >
                    Create Event
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="p-3 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 shrink-0">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">Confirm Deletion</h3>
                    <p className="text-xs text-slate-500 font-medium mt-1">Are you sure you want to delete this item? This action cannot be undone.</p>
                  </div>
                </div>

                <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                  <button 
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-md shadow-rose-500/20 active:scale-95 transition-all cursor-pointer"
                  >
                    Yes, Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
