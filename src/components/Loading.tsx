import React, { useState, useEffect } from 'react'

interface LoadingProps {
  /**
   * 'spinner' = Quick spinner with favicon logo inside a spinning ring
   * 'bar' = Progress bar with percentage and rotating text for long operations
   */
  variant?: 'spinner' | 'bar'
  label?: string
  className?: string
  onComplete?: () => void
}

const ROTATING_TEXTS = [
  'Hang tight...',
  'Fetching latest records...',
  'Processing data...',
  'Connecting to servers...',
  'Almost done...'
]

export const Loading: React.FC<LoadingProps> = ({
  variant = 'spinner',
  label,
  className = '',
  onComplete
}) => {
  // Progress bar states
  const [progress, setProgress] = useState(0)
  const [textIndex, setTextIndex] = useState(0)

  useEffect(() => {
    if (variant !== 'bar') return

    // Smooth progressive 0% to 100% increment
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          if (onComplete) onComplete()
          // Reset to 0 after reaching 100% for demo loop preview
          return 0
        }
        // Smooth incremental progress step (1% to 3%)
        const step = Math.floor(Math.random() * 4) + 1
        return Math.min(prev + step, 100)
      })
    }, 120)

    // Rotating text message interval
    const textInterval = setInterval(() => {
      setTextIndex(prev => (prev + 1) % ROTATING_TEXTS.length)
    }, 1500)

    return () => {
      clearInterval(progressInterval)
      clearInterval(textInterval)
    }
  }, [variant, onComplete])

  if (variant === 'spinner') {
    return (
      <div className={`flex flex-col items-center justify-center p-6 space-y-4 select-none ${className}`}>
        {/* Favicon Logo inside Spinning Ring */}
        <div className="relative flex items-center justify-center h-16 w-16">
          {/* Outer Spinning Ring */}
          <div className="absolute inset-0 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin" />
          
          {/* Favicon Logo in Center */}
          <div className="h-10 w-10 rounded-full bg-white p-1 shadow-2xs border border-slate-100 overflow-hidden z-10 flex items-center justify-center">
            <img 
              src="/favicon/favicon.png" 
              alt="MATS Logo" 
              className="h-full w-full object-contain"
              onError={(e) => {
                // Fallback to text logo if image fails to load
                (e.target as HTMLElement).style.display = 'none'
              }}
            />
          </div>
        </div>

        {/* Optional Label */}
        <p className="text-xs font-extrabold text-slate-600 tracking-tight">
          {label || 'Loading...'}
        </p>
      </div>
    )
  }

  // Long Operation Loading Bar Variant
  return (
    <div className={`flex flex-col items-center justify-center p-6 max-w-sm w-full mx-auto space-y-4 select-none ${className}`}>
      {/* Percentage & Dynamic Text Row */}
      <div className="w-full flex items-center justify-between text-xs font-extrabold">
        <span className="text-indigo-600 transition-all duration-300 animate-in fade-in">
          {ROTATING_TEXTS[textIndex]}
        </span>
        <span className="text-slate-900 bg-slate-100 px-2 py-0.5 rounded-full font-mono">
          {progress}%
        </span>
      </div>

      {/* Progress Bar Track */}
      <div className="w-full bg-slate-100 rounded-full h-3 p-0.5 border border-slate-200/80 overflow-hidden shadow-2xs">
        <div 
          className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-blue-600 to-indigo-600 transition-all duration-300 shadow-xs"
          style={{ width: `${progress}%` }}
        />
      </div>

      {label && (
        <p className="text-[11px] font-semibold text-slate-400">
          {label}
        </p>
      )}
    </div>
  )
}
