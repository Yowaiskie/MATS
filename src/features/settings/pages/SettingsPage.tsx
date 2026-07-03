import React, { useState, useEffect, useRef } from 'react'
import { Card } from '@/components/Card'
import { settingsService, DEFAULT_REPORT_TEMPLATE } from '@/services/settingsService'
import { generateCommunityReport } from '@/utils/communityReport'
import type { Schedule } from '@/types/schedule'
import type { Member } from '@/types/member'

// Mock data for the Live Preview function
const mockSchedule: Schedule = {
  id: 'mock-123',
  title: 'Sunday Mass',
  date: 'June 28, 2026',
  startTime: '6:00 AM',
  endTime: '7:30 AM',
  status: 'completed',
  assignedMembers: ['m-1', 'm-2', 'm-3'],
  createdAt: '',
  updatedAt: ''
}

const mockAssignedMembers: Member[] = [
  { id: 'm-1', firstName: 'Michael', lastName: 'Camarador', rank: 'Knight', status: 'active', createdAt: '', updatedAt: '' },
  { id: 'm-2', firstName: 'Lance', lastName: 'Caoili', rank: 'Acolyte', status: 'active', createdAt: '', updatedAt: '' },
  { id: 'm-3', firstName: 'Patrick', lastName: 'Jacobo', rank: 'Acolyte', status: 'active', createdAt: '', updatedAt: '' }
]

const mockFormState = {
  'm-1': { status: 'present' as const, remarks: '' },
  'm-2': { status: 'absent' as const, remarks: '' },
  'm-3': { status: 'present' as const, remarks: '' }
}

const mockUnassignedMembers: Member[] = [
  { id: 'm-4', firstName: 'Genesis', lastName: 'Delagon', rank: 'Knight', status: 'active', createdAt: '', updatedAt: '' },
  { id: 'm-5', firstName: 'Marcial', lastName: 'Rimando', rank: 'Acolyte', status: 'active', createdAt: '', updatedAt: '' }
]

const tokenGroups = [
  {
    title: 'Schedule Information',
    tokens: [
      { label: '📅 Schedule Date', value: '{{scheduleDate}}' },
      { label: '⛪ Schedule Title', value: '{{scheduleTitle}}' },
      { label: '🕒 Start Time', value: '{{startTime}}' },
      { label: '🕓 End Time', value: '{{endTime}}' },
    ]
  },
  {
    title: 'Attendance Statistics',
    tokens: [
      { label: '✅ Present Count', value: '{{presentCount}}' },
      { label: '🟡 Late Count', value: '{{lateCount}}' },
      { label: '❌ Absent Count', value: '{{absentCount}}' },
      { label: '🟢 Excused Count', value: '{{excusedCount}}' },
    ]
  },
  {
    title: 'Member Lists',
    tokens: [
      { label: '👥 Assigned Members', value: '{{assignedMembers}}' },
      { label: '🙋 Other Servers', value: '{{otherServers}}' },
    ]
  }
]

export const SettingsPage: React.FC = () => {
  const [template, setTemplate] = useState('')
  const [originalTemplate, setOriginalTemplate] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(true)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const insertToken = (token: string) => {
    const textarea = textareaRef.current
    if (!textarea) {
      setTemplate(prev => prev + token)
      return
    }

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const text = textarea.value

    const before = text.substring(0, start)
    const after = text.substring(end, text.length)

    const newText = before + token + after
    setTemplate(newText)

    const newPos = start + token.length
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(newPos, newPos)
    }, 0)
  }

  // Load baseline template settings
  const loadTemplate = async () => {
    setLoading(true)
    setError(null)
    try {
      const fetched = await settingsService.getReportTemplate()
      setTemplate(fetched)
      setOriginalTemplate(fetched)
    } catch (err) {
      console.error(err)
      setError('Failed to load report template.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTemplate()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSuccessMsg(null)
    try {
      await settingsService.saveReportTemplate(template)
      setOriginalTemplate(template)
      setSuccessMsg('Template settings successfully saved!')
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Failed to save template.')
    } finally {
      setSaving(false)
    }
  }

  const handleRestoreDefault = () => {
    if (window.confirm('Are you sure you want to restore the default report template? Any unsaved edits will be discarded.')) {
      setTemplate(DEFAULT_REPORT_TEMPLATE)
    }
  }

  // Generate live preview text dynamically as user types
  const previewText = generateCommunityReport(
    template || DEFAULT_REPORT_TEMPLATE,
    mockSchedule,
    mockAssignedMembers,
    mockFormState,
    mockUnassignedMembers
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">System Settings</h1>
        <p className="text-sm text-gray-400 mt-1">Configure parameters and message layouts for the Ministry of Altar Servers.</p>
      </div>

      {/* Notifications */}
      {error && (
        <div className="rounded border border-red-900 bg-red-950/40 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {successMsg && (
        <div className="rounded border border-green-900 bg-green-950/40 p-4 text-sm text-green-400 animate-pulse">
          {successMsg}
        </div>
      )}

      {loading ? (
        <Card>
          <div className="py-16 flex flex-col items-center justify-center space-y-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
            <span className="text-xs text-gray-500">Loading system settings...</span>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Template Editor */}
          <Card>
            <div className="p-4 border-b border-gray-900 flex justify-between items-center bg-gray-950/20">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Report Template Editor</h3>
              <button
                onClick={handleRestoreDefault}
                className="text-xs font-semibold text-red-400 hover:text-red-300 transition-colors cursor-pointer"
              >
                Restore Default Template
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              <div className="rounded bg-indigo-950/30 border border-indigo-850/40 p-3 text-xxs text-gray-400">
                💡 <span className="font-semibold text-indigo-300">Click any field below</span> to insert it into your report template at the cursor position.
              </div>
              
              {/* Placeholders helper tags grouped */}
              <div className="space-y-3 pb-2">
                {tokenGroups.map((group) => (
                  <div key={group.title} className="space-y-1">
                    <span className="text-xxs font-bold text-gray-500 uppercase tracking-wide block">{group.title}</span>
                    <div className="flex flex-wrap gap-1.5">
                      {group.tokens.map((token) => (
                        <button
                          key={token.value}
                          type="button"
                          onClick={() => insertToken(token.value)}
                          className="inline-flex items-center gap-1.5 bg-gray-900 hover:bg-gray-805 border border-gray-800 rounded px-2.5 py-1 text-xxs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer select-none"
                          title={`Insert ${token.value}`}
                        >
                          {token.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <textarea
                ref={textareaRef}
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                className="w-full min-h-[350px] rounded border border-gray-900 bg-gray-950 p-4 text-xs font-mono text-gray-200 focus:outline-none focus:border-indigo-500 resize-y"
                placeholder="Paste or write report template layout here..."
              />

              <div className="flex items-center justify-between pt-2 border-t border-gray-900 bg-gray-950/10">
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className="rounded border border-gray-850 px-4 py-2 text-xs font-semibold text-gray-300 hover:bg-gray-900 hover:text-white transition-colors cursor-pointer"
                >
                  {showPreview ? 'Hide Live Preview' : 'Show Live Preview'}
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || template === originalTemplate}
                  className="rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-5 py-2 text-xs font-semibold text-white transition-colors cursor-pointer"
                >
                  {saving ? 'Saving...' : 'Save Template'}
                </button>
              </div>
            </div>
          </Card>

          {/* Live Preview Display */}
          {showPreview && (
            <Card>
              <div className="p-4 border-b border-gray-900 bg-gray-950/20">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Live Mock Preview</h3>
              </div>
              <div className="p-4 flex flex-col h-[85%]">
                <div className="flex-1 rounded border border-gray-900 bg-gray-950 p-4 text-xs font-mono text-gray-300 overflow-y-auto whitespace-pre-wrap select-text leading-relaxed">
                  {previewText}
                </div>
                <p className="text-xxs text-gray-500 mt-3 text-center italic">
                  * Dynamic values and count parameters represent a sample Sunday Mass service.
                </p>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
