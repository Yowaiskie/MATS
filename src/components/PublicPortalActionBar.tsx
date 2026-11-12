import { useState, type FC } from 'react'

export interface PublicPortalActionBarProps {
  title: string
  type?: 'publication' | 'eventForm' | 'excuse' | 'generic'
  publicUrl: string
  status: 'draft' | 'published' | 'closed' | 'archived'
  responsesCount?: number
  responsesLabel?: string
  deadlineText?: string
  onPreview?: () => void
  onCopyLink?: () => void
  onViewResponses?: () => void
  onEdit?: () => void
  onToggleStatus?: (nextStatus: 'draft' | 'published' | 'closed') => void
  className?: string
}

export const PublicPortalActionBar: FC<PublicPortalActionBarProps> = ({
  title,
  type = 'generic',
  publicUrl,
  status,
  responsesCount = 0,
  responsesLabel = 'Submissions',
  deadlineText,
  onPreview,
  onCopyLink,
  onViewResponses,
  onEdit,
  onToggleStatus,
  className = '',
}) => {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      if (onCopyLink) {
        onCopyLink()
      } else if (publicUrl) {
        await navigator.clipboard.writeText(publicUrl)
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 2200)
    } catch {
      // Fallback if clipboard API restricted
      setCopied(true)
      setTimeout(() => setCopied(false), 2200)
    }
  }

  const handlePreview = () => {
    if (onPreview) {
      onPreview()
    } else if (publicUrl) {
      window.open(publicUrl, '_blank', 'noopener,noreferrer')
    }
  }

  const getStatusBadge = () => {
    switch (status) {
      case 'published':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Open (Live)
          </span>
        )
      case 'closed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            Closed
          </span>
        )
      case 'archived':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
            <span className="w-2 h-2 rounded-full bg-slate-400" />
            Archived
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
            <span className="w-2 h-2 rounded-full bg-blue-400" />
            Draft
          </span>
        )
    }
  }

  return (
    <div className={`bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all p-4 md:p-5 ${className}`}>
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 mb-3.5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
            {type === 'publication' ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            ) : type === 'eventForm' ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            )}
          </div>
          <div>
            <h4 className="font-bold text-slate-800 text-base leading-snug">{title}</h4>
            {deadlineText && (
              <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {deadlineText}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {getStatusBadge()}
        </div>
      </div>

      {/* Action Buttons Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {/* Preview Button */}
          <button
            type="button"
            onClick={handlePreview}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 hover:text-slate-900 border border-slate-200 transition-all active:scale-95 cursor-pointer"
            title="Preview public portal in new tab"
          >
            <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <span>Preview</span>
          </button>

          {/* Copy Link Button */}
          <button
            type="button"
            onClick={handleCopy}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer border ${
              copied
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                : 'text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border-indigo-200'
            }`}
            title="Copy public link to clipboard"
          >
            {copied ? (
              <>
                <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span>Copied!</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span>Copy Link</span>
              </>
            )}
          </button>

          {/* Submissions Counter & View Button */}
          {onViewResponses && (
            <button
              type="button"
              onClick={onViewResponses}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 transition-all active:scale-95 cursor-pointer"
            >
              <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              <span>{responsesLabel}</span>
              <span className="px-1.5 py-0.5 rounded-full text-[11px] font-extrabold bg-indigo-100 text-indigo-700">
                {responsesCount}
              </span>
            </button>
          )}
        </div>

        {/* Secondary Actions (Edit & Status) */}
        <div className="flex items-center gap-1.5 ml-auto sm:ml-0">
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all active:scale-95 cursor-pointer"
              title="Edit settings and fields"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              <span>Edit</span>
            </button>
          )}

          {onToggleStatus && (
            <button
              type="button"
              onClick={() => onToggleStatus(status === 'published' ? 'closed' : 'published')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all active:scale-95 cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span>{status === 'published' ? 'Close' : 'Open'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
