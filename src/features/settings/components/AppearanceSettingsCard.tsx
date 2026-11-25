import React from 'react'
import { Card } from '@/components/Card'
import { useTheme } from '@/context/ThemeContext'
import type { ThemeMode } from '@/utils/theme'

const THEME_OPTIONS: { value: ThemeMode; label: string; description: string }[] = [
  { value: 'light', label: 'Light', description: 'Crisp bright surface' },
  { value: 'dark', label: 'Dark', description: 'Deep slate navy' },
  { value: 'system', label: 'System', description: 'Follow device theme' }
]

export const AppearanceSettingsCard: React.FC = () => {
  const { themeMode, isDark, setThemeMode, toggleTheme } = useTheme()

  return (
    <Card className="p-5 sm:p-6 border border-slate-200/80 shadow-2xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="h-10 w-10 rounded-2xl bg-indigo-50 border border-indigo-200/80 flex items-center justify-center text-indigo-600 shrink-0">
            {isDark ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900">Appearance &amp; Dark Mode</h2>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                isDark
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                  : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}>
                {isDark ? 'Dark Active' : 'Light Active'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Switch between Light and Deep Slate Dark Mode. Saved locally on this device (Web &amp; Android app).
            </p>
          </div>
        </div>

        {/* Instant Dark Mode Toggle Switch */}
        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
          <span className="text-xs font-bold text-slate-700">Dark Mode</span>
          <button
            type="button"
            role="switch"
            aria-checked={isDark}
            aria-label="Toggle Dark Mode"
            onClick={toggleTheme}
            className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/40 ${
              isDark
                ? 'bg-indigo-600 border-indigo-500'
                : 'bg-slate-200 border-slate-300'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
                isDark ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* 3-Way Mode Selector: Light / Dark / System */}
      <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-3 gap-2">
        {THEME_OPTIONS.map(opt => {
          const active = themeMode === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setThemeMode(opt.value)}
              className={`flex flex-col items-start px-3 py-2.5 min-h-[48px] rounded-xl border text-left transition-all cursor-pointer ${
                active
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-500/20'
                  : 'bg-slate-50/70 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <span className={`text-xs font-extrabold ${active ? 'text-white' : 'text-slate-900'}`}>
                {opt.label}
              </span>
              <span className={`text-[10px] font-medium mt-0.5 ${active ? 'text-indigo-100' : 'text-slate-500'}`}>
                {opt.description}
              </span>
            </button>
          )
        })}
      </div>
    </Card>
  )
}
