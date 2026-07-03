import React, { useState } from 'react'

interface CommunityReportModalProps {
  isOpen: boolean
  onClose: () => void
  reportText: string
}

export const CommunityReportModal: React.FC<CommunityReportModalProps> = ({
  isOpen,
  onClose,
  reportText,
}) => {
  const [copied, setCopied] = useState(false)

  if (!isOpen) return null

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(reportText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy text:', err)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 transition-opacity" 
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative w-full max-w-lg rounded-lg border border-gray-800 bg-gray-950 p-6 shadow-xl z-10 text-white flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-900">
          <div>
            <h3 className="text-base font-bold text-white">Facebook Community Attendance Report</h3>
            <p className="text-xs text-gray-400 mt-0.5">Copy formatted attendance text for group chat sharing.</p>
          </div>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-white transition-colors cursor-pointer"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Textarea Area */}
        <div className="mt-4 flex-1 overflow-hidden flex flex-col">
          <textarea
            readOnly
            value={reportText}
            onClick={(e) => (e.target as HTMLTextAreaElement).select()}
            className="flex-1 w-full rounded border border-gray-900 bg-gray-900 p-4 text-xs font-mono text-gray-300 focus:outline-none resize-none min-h-[250px] overflow-y-auto"
          />
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-900 mt-4">
          <button
            onClick={onClose}
            className="rounded border border-gray-850 bg-transparent px-4 py-2 text-xs font-semibold hover:bg-gray-900 text-gray-300 hover:text-white transition-colors cursor-pointer"
          >
            Close
          </button>
          <button
            onClick={handleCopy}
            className="rounded bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-xs font-semibold text-white transition-colors cursor-pointer"
          >
            {copied ? 'Copied!' : 'Copy to Clipboard'}
          </button>
        </div>
      </div>
    </div>
  )
}
