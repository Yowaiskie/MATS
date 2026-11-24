import React from 'react'
import type { EventOptionalModule } from '@/types/event'
import { EVENT_OPTIONAL_MODULE_CONFIG } from '@/utils/eventModules'

interface EventModuleSelectorProps {
  selected: EventOptionalModule[]
  onChange: (next: EventOptionalModule[]) => void
  disabled?: boolean
}

export const EventModuleSelector: React.FC<EventModuleSelectorProps> = ({
  selected,
  onChange,
  disabled = false
}) => {
  const toggleModule = (key: EventOptionalModule) => {
    if (disabled) return
    if (selected.includes(key)) {
      onChange(selected.filter(m => m !== key))
    } else {
      onChange([...selected, key])
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
            Workspace Features
          </span>
          <p className="text-[11px] font-medium text-slate-500 mt-0.5">
            Select optional tabs to include. You can add or hide them anytime.
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Always on:</span>
          {['Overview', 'Team', 'Tasks'].map(core => (
            <span
              key={core}
              className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200/80"
            >
              {core}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {EVENT_OPTIONAL_MODULE_CONFIG.map(mod => {
          const isChecked = selected.includes(mod.key)
          return (
            <label
              key={mod.key}
              className={`flex items-start gap-3 p-3 min-h-[44px] rounded-xl border transition-all select-none ${
                disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
              } ${
                isChecked
                  ? 'bg-indigo-50/70 border-indigo-300 ring-1 ring-indigo-500/20'
                  : 'bg-slate-50/60 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
              }`}
            >
              <input
                type="checkbox"
                checked={isChecked}
                disabled={disabled}
                onChange={() => toggleModule(mod.key)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 shrink-0 cursor-pointer disabled:cursor-not-allowed"
              />
              <div className="min-w-0">
                <div className={`text-xs font-extrabold leading-tight ${isChecked ? 'text-indigo-950' : 'text-slate-800'}`}>
                  {mod.label}
                </div>
                <p className="text-[11px] font-medium text-slate-500 leading-snug mt-0.5">
                  {mod.description}
                </p>
              </div>
            </label>
          )
        })}
      </div>
    </div>
  )
}
