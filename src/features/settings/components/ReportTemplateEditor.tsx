import React, { useRef, useState } from 'react'

type TokenCategory = 'datetime' | 'members' | 'stats'

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
  datetime: 'Date & Time',
  members: 'Members',
  stats: 'Attendance Stats'
}

export const TOKENS: TokenItem[] = [
  { key: '{{scheduleDate}}', label: 'Schedule Date', category: 'datetime', borderColor: 'border-blue-200', dotColor: 'bg-blue-500', bgColor: 'bg-blue-50', textColor: 'text-blue-700' },
  { key: '{{scheduleTitle}}', label: 'Schedule Title', category: 'datetime', borderColor: 'border-blue-200', dotColor: 'bg-blue-500', bgColor: 'bg-blue-50', textColor: 'text-blue-700' },
  { key: '{{startTime}}', label: 'Start Time', category: 'datetime', borderColor: 'border-blue-200', dotColor: 'bg-blue-500', bgColor: 'bg-blue-50', textColor: 'text-blue-700' },
  { key: '{{endTime}}', label: 'End Time', category: 'datetime', borderColor: 'border-blue-200', dotColor: 'bg-blue-500', bgColor: 'bg-blue-50', textColor: 'text-blue-700' },
  { key: '{{assignedMembers}}', label: 'Assigned Members', category: 'members', borderColor: 'border-indigo-200', dotColor: 'bg-indigo-500', bgColor: 'bg-indigo-50', textColor: 'text-indigo-700' },
  { key: '{{otherServers}}', label: 'Other Servers', category: 'members', borderColor: 'border-indigo-200', dotColor: 'bg-indigo-500', bgColor: 'bg-indigo-50', textColor: 'text-indigo-700' },
  { key: '{{presentCount}}', label: 'Present Count', category: 'stats', borderColor: 'border-emerald-200', dotColor: 'bg-emerald-500', bgColor: 'bg-emerald-50', textColor: 'text-emerald-700' },
  { key: '{{lateCount}}', label: 'Late Count', category: 'stats', borderColor: 'border-emerald-200', dotColor: 'bg-emerald-500', bgColor: 'bg-emerald-50', textColor: 'text-emerald-700' },
  { key: '{{absentCount}}', label: 'Absent Count', category: 'stats', borderColor: 'border-emerald-200', dotColor: 'bg-emerald-500', bgColor: 'bg-emerald-50', textColor: 'text-emerald-700' },
  { key: '{{excusedCount}}', label: 'Excused Count', category: 'stats', borderColor: 'border-emerald-200', dotColor: 'bg-emerald-500', bgColor: 'bg-emerald-50', textColor: 'text-emerald-700' },
]

const groupedTokens = TOKENS.reduce((acc, token) => {
  if (!acc[token.category]) acc[token.category] = []
  acc[token.category].push(token)
  return acc
}, {} as Record<TokenCategory, TokenItem[]>)

export const PRESETS = [
  {
    name: 'Standard',
    description: 'Basic schedule info with member list',
    template: `{{scheduleDate}} ({{scheduleTitle}}, {{startTime}})\n\n{{assignedMembers}}\n\nOther Servers:\n{{otherServers}}`
  },
  {
    name: 'Detailed',
    description: 'Full attendance summary with stats',
    template: `{{scheduleDate}} - {{scheduleTitle}}\nTime: {{startTime}} to {{endTime}}\n\nAttendance Summary:\nPresent: {{presentCount}} | Late: {{lateCount}} | Absent: {{absentCount}} | Excused: {{excusedCount}}\n\nAssigned Members:\n{{assignedMembers}}\n\nOther Servers:\n{{otherServers}}`
  },
  {
    name: 'Simple',
    description: 'Minimal date-title-members format',
    template: `{{scheduleDate}} - {{scheduleTitle}} ({{startTime}})\n\n{{assignedMembers}}`
  }
]

interface ReportTemplateEditorProps {
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

export const ReportTemplateEditor: React.FC<ReportTemplateEditorProps> = ({
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
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Report Template Editor</h3>
            <p className="text-xs text-gray-500 mt-0.5">Customize the layout for generated Facebook/Messenger reports</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              onChange={(e) => {
                const selected = PRESETS.find(p => p.name === e.target.value)
                if (selected) onChange(selected.template)
              }}
              defaultValue=""
              className="text-xs bg-white border border-gray-200 rounded-lg px-2.5 py-2 font-medium text-gray-700 focus:outline-none focus:border-blue-500 cursor-pointer shadow-sm min-h-[36px]"
            >
              <option value="" disabled>Load Preset...</option>
              {PRESETS.map((p) => (
                <option key={p.name} value={p.name}>{p.name}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={onRestoreDefault}
              className="text-xs font-semibold text-gray-500 hover:text-red-600 transition-colors px-2.5 py-2 cursor-pointer min-h-[36px]"
            >
              Reset
            </button>
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
                    <span className="hidden sm:inline">{token.label}</span>
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
            className="w-full rounded-lg border border-gray-200 bg-white p-4 text-xs font-mono text-gray-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 leading-relaxed resize-none min-h-[120px]"
            placeholder="Type template text here..."
          />
          <div className="flex items-center justify-between text-xs text-gray-400 mt-2">
            <span>Variables like <code className="bg-gray-100 px-1 py-0.5 rounded text-blue-600 font-mono">{"{{scheduleDate}}"}</code> will be replaced with real data.</span>
            <span className="font-mono">{value.length} chars</span>
          </div>
        </div>
      </div>

      <div className="shrink-0 px-5 py-3.5 bg-white border-t border-gray-100 flex items-center justify-between">
        <span className={`text-xs font-medium ${isDirty ? 'text-amber-600' : 'text-gray-400'}`}>
          {isDirty ? '\u25CF Unsaved changes' : 'All changes saved'}
        </span>
        <button
          type="button"
          onClick={onSave}
          disabled={saving || !isDirty}
          className="rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 px-5 py-2.5 text-sm font-semibold text-white transition-colors cursor-pointer shadow-sm flex items-center gap-1.5 min-h-[44px]"
        >
          {saving ? 'Saving...' : 'Save Template'}
        </button>
      </div>
    </div>
  )
}
