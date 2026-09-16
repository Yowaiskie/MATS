import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useNotificationContext } from '@/context/NotificationContext'

export const BroadcastHeaderBanner: React.FC = () => {
  const navigate = useNavigate()
  const { activeBroadcast, dismissBroadcast } = useNotificationContext()

  if (!activeBroadcast) return null

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation()
    dismissBroadcast(activeBroadcast.id)
  }

  const handleActionClick = () => {
    if (activeBroadcast?.actionUrl) {
      navigate(activeBroadcast.actionUrl)
    }
  }

  const isUrgent = activeBroadcast.priority === 'urgent'
  const isImportant = activeBroadcast.priority === 'important'

  // Card theme styling
  const cardStyle = isUrgent
    ? {
        container: 'bg-gradient-to-r from-rose-500/10 via-red-500/5 to-rose-500/10 border-rose-200/90 text-rose-950 shadow-rose-500/5',
        iconBg: 'bg-rose-600 text-white shadow-rose-500/30',
        badge: 'bg-rose-100 text-rose-800 border-rose-200',
        title: 'text-rose-950',
        body: 'text-rose-800/90',
        button: 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20',
        dismiss: 'text-rose-400 hover:text-rose-700 hover:bg-rose-100/60'
      }
    : isImportant
    ? {
        container: 'bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-amber-500/10 border-amber-200/90 text-amber-950 shadow-amber-500/5',
        iconBg: 'bg-amber-500 text-white shadow-amber-500/30',
        badge: 'bg-amber-100 text-amber-800 border-amber-200',
        title: 'text-amber-950',
        body: 'text-amber-800/90',
        button: 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/20',
        dismiss: 'text-amber-400 hover:text-amber-700 hover:bg-amber-100/60'
      }
    : {
        container: 'bg-gradient-to-r from-blue-500/10 via-indigo-500/5 to-blue-500/10 border-blue-200/90 text-slate-900 shadow-blue-500/5',
        iconBg: 'bg-blue-600 text-white shadow-blue-500/30',
        badge: 'bg-blue-100 text-blue-800 border-blue-200',
        title: 'text-slate-900',
        body: 'text-slate-700',
        button: 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20',
        dismiss: 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
      }

  return (
    <div
      className={`relative w-full rounded-2xl sm:rounded-3xl border p-4 sm:p-5 shadow-sm transition-all duration-300 animate-in fade-in slide-in-from-top-3 mb-6 ${cardStyle.container}`}
      role="alert"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Left Icon & Text Content */}
        <div className="flex items-start gap-3.5 min-w-0 flex-1">
          {/* Glowing Animated Icon */}
          <div className="relative shrink-0 mt-0.5">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-md ${cardStyle.iconBg}`}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.115-1.564-.442a22.25 22.25 0 01-1.332-2.918m2.031-1.314A22.5 22.5 0 0019.5 12a22.5 22.5 0 00-7.16-3.84m0 9.18A22.5 22.5 0 0119.5 12m0 0a22.5 22.5 0 00-7.16-3.84"
                />
              </svg>
            </div>
          </div>

          {/* Texts */}
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${cardStyle.badge}`}>
                {isUrgent ? 'Urgent Alert' : isImportant ? 'Important Notice' : 'Ministry Announcement'}
              </span>
              <span className="text-[11px] font-semibold opacity-70">
                Posted by {activeBroadcast.createdByName || 'Administrator'}
              </span>
            </div>

            <h3 className={`text-sm sm:text-base font-extrabold tracking-tight ${cardStyle.title}`}>
              {activeBroadcast.title}
            </h3>

            <p className={`text-xs leading-relaxed ${cardStyle.body}`}>
              {activeBroadcast.message}
            </p>
          </div>
        </div>

        {/* Right Action & Dismiss Controls */}
        <div className="flex items-center justify-end gap-2.5 shrink-0 self-end sm:self-center pt-2 sm:pt-0 border-t sm:border-t-0 border-black/5 w-full sm:w-auto">
          {activeBroadcast.actionUrl && (
            <button
              type="button"
              onClick={handleActionClick}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer ${cardStyle.button}`}
            >
              <span>{activeBroadcast.actionLabel || 'View Record'}</span>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </button>
          )}

          <button
            type="button"
            onClick={handleDismiss}
            className={`p-2 rounded-xl transition-colors cursor-pointer ${cardStyle.dismiss}`}
            title="Dismiss for this session"
            aria-label="Dismiss announcement"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
