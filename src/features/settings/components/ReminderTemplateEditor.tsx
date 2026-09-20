import React, { useRef, useState } from 'react'
import { Button, CustomSelect } from '@/components'

type TokenCategory = 'content' | 'datetime' | 'system' | 'stats'

export interface TokenItem {
  key: string
  label: string
  category: TokenCategory
  borderColor: string
  dotColor: string
  bgColor: string
  textColor: string
}

const CATEGORY_LABELS: Record<TokenCategory, string> = {
  content: 'Message Content',
  datetime: 'Date & Time',
  system: 'Ministry & Links',
  stats: 'Counts & Stats'
}

export const TOKENS: TokenItem[] = [
  { key: '{{schedules}}', label: 'Schedules List', category: 'content', borderColor: 'border-blue-200', dotColor: 'bg-blue-500', bgColor: 'bg-blue-50', textColor: 'text-blue-700' },
  { key: '{{customNote}}', label: 'Custom Note / Remarks', category: 'content', borderColor: 'border-amber-200', dotColor: 'bg-amber-500', bgColor: 'bg-amber-50', textColor: 'text-amber-700' },
  { key: '{{scheduleCount}}', label: 'Pending Schedules Count', category: 'stats', borderColor: 'border-emerald-200', dotColor: 'bg-emerald-500', bgColor: 'bg-emerald-50', textColor: 'text-emerald-700' },
  { key: '{{portalUrl}}', label: 'Portal Link URL', category: 'system', borderColor: 'border-indigo-200', dotColor: 'bg-indigo-500', bgColor: 'bg-indigo-50', textColor: 'text-indigo-700' },
  { key: '{{ministryName}}', label: 'Ministry Name', category: 'system', borderColor: 'border-purple-200', dotColor: 'bg-purple-500', bgColor: 'bg-purple-50', textColor: 'text-purple-700' },
  { key: '{{currentDate}}', label: 'Current Date', category: 'datetime', borderColor: 'border-blue-200', dotColor: 'bg-blue-500', bgColor: 'bg-blue-50', textColor: 'text-blue-700' },
]

const groupedTokens = TOKENS.reduce((acc, token) => {
  if (!acc[token.category]) acc[token.category] = []
  acc[token.category].push(token)
  return acc
}, {} as Record<TokenCategory, TokenItem[]>)

export const REMINDER_PRESETS = [
  {
    name: 'Tagalog Formal (Default)',
    description: 'Detailed Tagalog reminder with ministry header and portal link',
    template: `PAALALA: HINDI PA NAKUKUHA ANG ATTENDANCE / PENDING SCHEDULES\n{{ministryName}}\n\nPaalala po sa mga may pending na attendance sa mga sumusunod na schedule:\n\n{{schedules}}\n\n{{customNote}}\n\nPaki-record po ang inyong attendance sa MATS Portal o ipaalam po sa Ministry Officers kung may concern sa inyong attendance.\n\nPortal Link: {{portalUrl}}\n\nThank you po!`
  },
  {
    name: 'Tagalog Compact',
    description: 'Concise bulleted reminder for quick group chat updates',
    template: `[PAALALA: PENDING ATTENDANCE]\n{{ministryName}}\n\nMay {{scheduleCount}} pending schedule(s) na kailangang i-record ang attendance:\n\n{{schedules}}\n\n{{customNote}}\nPortal Link: {{portalUrl}}`
  },
  {
    name: 'English Standard',
    description: 'Clean English notice format',
    template: `REMINDER: PENDING / UNTAKEN ATTENDANCE\n{{ministryName}}\n\nPlease be reminded to record attendance for the following pending schedule(s):\n\n{{schedules}}\n\n{{customNote}}\n\nPlease log your attendance in the MATS Portal or notify Ministry Officers.\nPortal Link: {{portalUrl}}\n\nThank you!`
  }
]

interface ReminderTemplateEditorProps {
  value: string
  onChange: (val: string) => void
  onRestoreDefault: () => void
  onSave: () => void
  saving: boolean
  isDirty: boolean
}

const ChevronIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
  </svg>
)

export const ReminderTemplateEditor: React.FC<ReminderTemplateEditorProps> = ({
  value,
  onChange,
  onRestoreDefault,
  onSave,
  saving,
  isDirty,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [showTokens, setShowTokens] = useState(true)

  const insertToken = (tokenKey: string) => {
    const textarea = textareaRef.current
    if (!textarea) {
      onChange(value + tokenKey)
      return
    }

    const start = textarea.selectionStart || 0
    const end = textarea.selectionEnd || 0
    const before = value.substring(0, start)
    const after = value.substring(end, value.length)

    const updated = before + tokenKey + after
    onChange(updated)

    const newPos = start + tokenKey.length
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(newPos, newPos)
    }, 0)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col flex-1 min-h-0">
      <div className="shrink-0 px-5 py-4 border-b border-gray-100 bg-gray-50/60">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Pending Reminder Template</h3>
            <p className="text-xs text-gray-500 mt-0.5">Customize the GC text template for untaken attendance reminders</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-48">
              <CustomSelect
                value=""
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                  const selected = REMINDER_PRESETS.find(p => p.name === e.target.value)
                  if (selected) onChange(selected.template)
                }}
                options={[
                  { value: '', label: 'Load Preset...', disabled: true },
                  ...REMINDER_PRESETS.map(p => ({ value: p.name, label: p.name }))
                ]}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="dense"
              onClick={onRestoreDefault}
              className="text-gray-500 hover:text-red-600"
            >
              Reset
            </Button>
          </div>
        </div>
      </div>

      <div className="shrink-0 border-b border-gray-100">
        <button
          type="button"
          onClick={() => setShowTokens(!showTokens)}
          className="lg:hidden flex items-center gap-2 w-full px-5 py-2.5 text-xs font-semibold text-gray-500 hover:text-gray-700 transition-colors cursor-pointer"
        >
          <ChevronIcon className={`h-3 w-3 transition-transform ${showTokens ? 'rotate-90' : ''}`} />
          Template Variables {showTokens ? '(Hide)' : '(Show)'}
        </button>
        <div className={`${showTokens ? 'block' : 'hidden'} lg:block px-5 py-3 space-y-3`}>
          {(Object.keys(groupedTokens) as TokenCategory[]).map((category) => (
            <div key={category}>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5 block">
                {CATEGORY_LABELS[category]}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {groupedTokens[category].map((token) => (
                  <button
                    key={token.key}
                    type="button"
                    onClick={() => insertToken(token.key)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border ${token.borderColor} ${token.bgColor} ${token.textColor} transition-all cursor-pointer shadow-sm hover:scale-[1.02] active:scale-95 min-h-[32px]`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${token.dotColor} shrink-0`} />
                    <span>{token.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="p-4 flex flex-col">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={8}
            className="w-full rounded-lg border border-gray-200 bg-white p-4 text-xs font-mono text-gray-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 leading-relaxed resize-none min-h-[140px]"
            placeholder="Type reminder template text here..."
          />
          <div className="flex items-center justify-between text-xs text-gray-400 mt-2">
            <span>Variables like <code className="bg-gray-100 px-1 py-0.5 rounded text-blue-600 font-mono">{"{{schedules}}"}</code> will be replaced with real data.</span>
            <span className="font-mono">{value.length} chars</span>
          </div>
        </div>
      </div>

      <div className="shrink-0 px-5 py-3.5 bg-white border-t border-gray-100 flex items-center justify-between">
        <span className={`text-xs font-medium ${isDirty ? 'text-amber-600' : 'text-gray-400'}`}>
          {isDirty ? '● Unsaved changes' : 'All changes saved'}
        </span>
        <Button
          type="button"
          variant="primary"
          size="default"
          onClick={onSave}
          loading={saving}
          disabled={!isDirty}
        >
          Save Template
        </Button>
      </div>
    </div>
  )
}
