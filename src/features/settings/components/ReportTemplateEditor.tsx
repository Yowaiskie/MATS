import React, { useRef } from 'react'

export interface TokenItem {
  key: string
  label: string
  icon: string
  color: string
}

export const TOKENS: TokenItem[] = [
  { key: '{{scheduleDate}}', label: 'Schedule Date', icon: '🗓️', color: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' },
  { key: '{{scheduleTitle}}', label: 'Schedule Title', icon: '📌', color: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' },
  { key: '{{startTime}}', label: 'Start Time', icon: '⏰', color: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' },
  { key: '{{endTime}}', label: 'End Time', icon: '⏳', color: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' },
  { key: '{{assignedMembers}}', label: 'Assigned Members List', icon: '👥', color: 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100' },
  { key: '{{otherServers}}', label: 'Other Servers List', icon: '➕', color: 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100' },
  { key: '{{presentCount}}', label: 'Present Count', icon: '✅', color: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' },
  { key: '{{lateCount}}', label: 'Late Count', icon: '🟡', color: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' },
  { key: '{{absentCount}}', label: 'Absent Count', icon: '❌', color: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' },
  { key: '{{excusedCount}}', label: 'Excused Count', icon: '📝', color: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' },
]

export const PRESETS = [
  {
    name: 'Standard Format',
    template: `{{scheduleDate}} ({{scheduleTitle}}, {{startTime}})\n\n{{assignedMembers}}\n\nOther Servers:\n{{otherServers}}`
  },
  {
    name: 'Detailed Format with Stats',
    template: `{{scheduleDate}} - {{scheduleTitle}}\nTime: {{startTime}} to {{endTime}}\n\nAttendance Summary:\nPresent: {{presentCount}} | Late: {{lateCount}} | Absent: {{absentCount}} | Excused: {{excusedCount}}\n\nAssigned Members:\n{{assignedMembers}}\n\nOther Servers:\n{{otherServers}}`
  },
  {
    name: 'Simple Member List',
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

export const ReportTemplateEditor: React.FC<ReportTemplateEditorProps> = ({
  value,
  onChange,
  onRestoreDefault,
  onSave,
  saving,
  isDirty,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
      {/* Header Bar */}
      <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/60 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Report Template Editor</h3>
          <p className="text-[11px] text-gray-500 mt-0.5">Customize the layout for generated Facebook/Messenger reports</p>
        </div>

        {/* Quick Presets Dropdown */}
        <div className="flex items-center gap-3">
          <select
            onChange={(e) => {
              const selected = PRESETS.find(p => p.name === e.target.value)
              if (selected) onChange(selected.template)
            }}
            defaultValue=""
            className="text-xs bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 font-medium text-gray-700 focus:outline-none focus:border-blue-500 cursor-pointer shadow-2xs"
          >
            <option value="" disabled>Load Preset...</option>
            {PRESETS.map((p) => (
              <option key={p.name} value={p.name}>{p.name}</option>
            ))}
          </select>

          <button
            type="button"
            onClick={onRestoreDefault}
            className="text-xs font-semibold text-gray-500 hover:text-red-600 transition-colors cursor-pointer"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Variables Toolbar */}
      <div className="p-4 bg-gray-50/30 border-b border-gray-100 space-y-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
          Click to insert variable into template:
        </span>
        <div className="flex flex-wrap gap-1.5">
          {TOKENS.map((token) => (
            <button
              key={token.key}
              type="button"
              onClick={() => insertToken(token.key)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${token.color} transition-all cursor-pointer shadow-2xs hover:scale-[1.02] active:scale-95`}
            >
              <span className="text-xs">{token.icon}</span>
              <span>{token.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Clean Textarea */}
      <div className="p-4 flex-1 flex flex-col space-y-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={12}
          className="w-full flex-1 rounded-lg border border-gray-200 bg-white p-4 text-xs font-mono text-gray-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 leading-relaxed resize-none"
          placeholder="Type template text here..."
        />

        <div className="flex items-center justify-between text-[11px] text-gray-400">
          <span>Variables like <code className="bg-gray-100 px-1 py-0.5 rounded text-blue-600 font-mono">{"{{scheduleDate}}"}</code> will be replaced with real data.</span>
          <span>{value.length} characters</span>
        </div>
      </div>

      {/* Footer / Save Bar */}
      <div className="px-5 py-3.5 bg-gray-50/60 border-t border-gray-100 flex items-center justify-between">
        <span className={`text-xs font-medium ${isDirty ? 'text-amber-600' : 'text-gray-400'}`}>
          {isDirty ? '● Unsaved changes' : 'All changes saved'}
        </span>

        <button
          type="button"
          onClick={onSave}
          disabled={saving || !isDirty}
          className="rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 px-5 py-2 text-xs font-semibold text-white transition-colors cursor-pointer shadow-sm flex items-center gap-1.5"
        >
          {saving ? 'Saving...' : 'Save Template'}
        </button>
      </div>
    </div>
  )
}
