import React, { createContext, useContext, useState, useCallback } from 'react'

export type ToastType = 'success' | 'info' | 'warning' | 'error'

export interface ToastItem {
  id: string
  type: ToastType
  title: string
  message: string
  duration?: number
}

interface ToastContextValue {
  toasts: ToastItem[]
  showToast: (type: ToastType, title: string, message: string, duration?: number) => void
  removeToast: (id: string) => void
  toast: {
    success: (title: string, message?: string, duration?: number) => void
    info: (title: string, message?: string, duration?: number) => void
    warning: (title: string, message?: string, duration?: number) => void
    error: (title: string, message?: string, duration?: number) => void
  }
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const showToast = useCallback((type: ToastType, title: string, message: string = '', duration: number = 4000) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const newToast: ToastItem = { id, type, title, message, duration }

    setToasts((prev) => [...prev, newToast])

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id)
      }, duration)
    }
  }, [removeToast])

  const toast = {
    success: (title: string, message?: string, duration?: number) => showToast('success', title, message || '', duration),
    info: (title: string, message?: string, duration?: number) => showToast('info', title, message || '', duration),
    warning: (title: string, message?: string, duration?: number) => showToast('warning', title, message || '', duration),
    error: (title: string, message?: string, duration?: number) => showToast('error', title, message || '', duration),
  }

  return (
    <ToastContext.Provider value={{ toasts, showToast, removeToast, toast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </ToastContext.Provider>
  )
}

export const useToast = (): ToastContextValue => {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

export const ToastContainer: React.FC<{
  toasts: ToastItem[]
  onDismiss: (id: string) => void
}> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null

  return (
    <div
      className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2.5 max-w-sm w-[calc(100vw-2rem)] sm:w-96 pointer-events-none select-none"
      role="region"
      aria-live="polite"
      aria-label="Notifications"
    >
      {toasts.map((t) => {
        const isSuccess = t.type === 'success'
        const isInfo = t.type === 'info'
        const isWarning = t.type === 'warning'
        const isError = t.type === 'error'

        const bgClass = isSuccess
          ? 'bg-white border-emerald-300 text-emerald-950 shadow-emerald-500/10'
          : isInfo
          ? 'bg-white border-blue-300 text-blue-950 shadow-blue-500/10'
          : isWarning
          ? 'bg-white border-amber-300 text-amber-950 shadow-amber-500/10'
          : 'bg-white border-rose-300 text-rose-950 shadow-rose-500/10'

        const iconBgClass = isSuccess
          ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
          : isInfo
          ? 'bg-blue-50 text-blue-600 border-blue-200'
          : isWarning
          ? 'bg-amber-50 text-amber-600 border-amber-200'
          : 'bg-rose-50 text-rose-600 border-rose-200'

        return (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-3 p-3.5 sm:p-4 rounded-2xl border shadow-xl transition-all duration-200 animate-in slide-in-from-bottom-5 fade-in ${bgClass}`}
          >
            {/* Icon Box */}
            <div className={`p-2 rounded-xl border shrink-0 ${iconBgClass}`}>
              {isSuccess && (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              )}
              {isInfo && (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                </svg>
              )}
              {isWarning && (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              )}
              {isError && (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </div>

            {/* Text details */}
            <div className="flex-1 min-w-0 pt-0.5">
              <h5 className="text-xs font-black tracking-tight leading-tight">{t.title}</h5>
              {t.message && (
                <p className="text-[11px] font-medium text-slate-600 mt-0.5 leading-relaxed break-words">
                  {t.message}
                </p>
              )}
            </div>

            {/* Dismiss Close Button */}
            <button
              type="button"
              onClick={() => onDismiss(t.id)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition shrink-0 cursor-pointer -mr-1 -mt-1"
              aria-label="Dismiss notification"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )
      })}
    </div>
  )
}
