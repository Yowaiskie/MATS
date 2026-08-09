import React, { useEffect, useState } from 'react'

export const PWAUpdatePrompt: React.FC = () => {
  const [showPrompt, setShowPrompt] = useState(false)

  useEffect(() => {
    const handleUpdate = () => setShowPrompt(true)
    window.addEventListener('pwaUpdateAvailable', handleUpdate)
    return () => window.removeEventListener('pwaUpdateAvailable', handleUpdate)
  }, [])

  if (!showPrompt) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:w-96 z-[999] bg-white border border-indigo-200 shadow-2xl rounded-2xl p-3 md:p-4 flex flex-col gap-2 md:gap-3 animate-in slide-in-from-bottom-5">
      <div className="flex gap-3 items-start">
        <div className="bg-indigo-100 text-indigo-600 p-2 rounded-full shrink-0">
          <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </div>
        <div>
          <h3 className="font-bold text-slate-800 text-sm">Update Available</h3>
          <p className="text-[11px] md:text-xs text-slate-500 mt-0.5 md:mt-1 leading-snug">A new version of MATS is ready. Update now to get the latest features and bug fixes.</p>
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-1 md:mt-1">
        <button 
          onClick={() => setShowPrompt(false)} 
          className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
        >
          Dismiss
        </button>
        <button 
          onClick={() => window.location.reload()} 
          className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-all active:scale-95 cursor-pointer"
        >
          Update Now
        </button>
      </div>
    </div>
  )
}
