import React, { useState, useEffect } from 'react'
import { Card } from '@/components/Card'
import { settingsService, DEFAULT_REPORT_TEMPLATE } from '@/services/settingsService'
import { generateCommunityReport } from '@/utils/communityReport'
import { AlertModal, ConfirmModal } from '@/components/Dialog'
import type { Schedule } from '@/types/schedule'
import type { Member } from '@/types/member'
import { useAuth } from '@/features/authentication/AuthContext'
import { ReportTemplateEditor } from '../components/ReportTemplateEditor'
import { PolicySettingsCard } from '../components/PolicySettingsCard'

const mockSchedule: Schedule = {
  id: 'mock-123',
  title: 'Sunday Mass',
  date: '2026-06-28',
  startTime: '06:00',
  endTime: '07:30',
  status: 'completed',
  assignedMembers: ['m-1', 'm-2', 'm-3'],
  createdAt: '',
  updatedAt: ''
}

const mockAssignedMembers: Member[] = [
  { id: 'm-1', firstName: 'Michael', lastName: 'Camarador', rank: 'Knight', status: 'active', createdAt: '', updatedAt: '' },
  { id: 'm-2', firstName: 'Lance', lastName: 'Caoili', rank: 'Acolyte', status: 'active', createdAt: '', updatedAt: '' },
  { id: 'm-3', firstName: 'Patrick', lastName: 'Jacobo', rank: 'Acolyte', status: 'active', createdAt: '', updatedAt: '' },
  { id: 'm-6', firstName: 'Juan', lastName: 'Dela Cruz', rank: 'Squires', status: 'active', createdAt: '', updatedAt: '' }
]

const mockFormState = {
  'm-1': { status: 'present' as const, remarks: '' },
  'm-2': { status: 'absent' as const, remarks: '' },
  'm-3': { status: 'present' as const, remarks: '' },
  'm-6': { status: 'present' as const, remarks: '' }
}

const mockUnassignedMembers: Member[] = [
  { id: 'm-4', firstName: 'Genesis', lastName: 'Delagon', rank: 'Knight', status: 'active', createdAt: '', updatedAt: '' },
  { id: 'm-5', firstName: 'Marcial', lastName: 'Rimando', rank: 'Acolyte', status: 'active', createdAt: '', updatedAt: '' }
]

type TabId = 'policy' | 'template'

const ShieldIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
)

const FileTextIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
)

const CopyIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
)

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'policy', label: 'Attendance Policy', icon: <ShieldIcon className="w-4 h-4" /> },
  { id: 'template', label: 'Report Template', icon: <FileTextIcon className="w-4 h-4" /> }
]

export const SettingsPage: React.FC = () => {
  const { profile } = useAuth()
  const [activeTab, setActiveTab] = useState<TabId>('policy')
  const [template, setTemplate] = useState('')
  const [originalTemplate, setOriginalTemplate] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [confirmRestore, setConfirmRestore] = useState(false)
  const [copied, setCopied] = useState(false)

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
      await settingsService.saveReportTemplate(template, profile?.email || 'Admin')
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
    setConfirmRestore(true)
  }

  const previewText = generateCommunityReport(
    template || DEFAULT_REPORT_TEMPLATE,
    mockSchedule,
    mockAssignedMembers,
    mockFormState,
    mockUnassignedMembers
  )

  const handleCopyPreview = async () => {
    try {
      await navigator.clipboard.writeText(previewText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy preview text:', err)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">System Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Configure parameters and message layouts for the Ministry of Altar Servers.</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 sm:gap-1 p-1 bg-gray-100 rounded-xl w-full sm:w-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center justify-center sm:justify-start gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer min-h-[44px] ${
              activeTab === tab.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span className="text-gray-500">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <Card>
          <div className="py-16 flex flex-col items-center justify-center space-y-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
            <span className="text-xs text-gray-500">Loading system settings...</span>
          </div>
        </Card>
      ) : (
        <div>
          {activeTab === 'policy' ? (
            <PolicySettingsCard
              onNotifySuccess={(msg) => setSuccessMsg(msg)}
              onNotifyError={(msg) => setError(msg)}
            />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 flex flex-col min-h-0">
                <ReportTemplateEditor
                  value={template}
                  onChange={setTemplate}
                  onRestoreDefault={handleRestoreDefault}
                  onSave={handleSave}
                  saving={saving}
                  isDirty={template !== originalTemplate}
                />
              </div>

              <div className="lg:col-span-5 flex flex-col min-h-0">
                <Card className="p-0 border border-gray-200 shadow-xs flex flex-col flex-1">
                  <div className="shrink-0 px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                      <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Live Mock Preview</h3>
                    </div>

                    <button
                      type="button"
                      onClick={handleCopyPreview}
                      className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-md transition-colors cursor-pointer min-h-[32px]"
                    >
                      <CopyIcon className="w-3.5 h-3.5" />
                      {copied ? 'Copied!' : 'Copy Sample'}
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-3">
                    <div className="rounded-xl border border-gray-200 bg-gray-50/80 p-4 text-xs font-mono text-gray-800 whitespace-pre-wrap select-text leading-relaxed">
                      {previewText || <span className="text-gray-400 italic">No output text generated.</span>}
                    </div>

                    <div className="rounded-lg bg-gray-50 p-2.5 border border-gray-100 text-[11px] text-gray-500 flex items-center justify-between">
                      <span>Showing sample Sunday Mass schedule</span>
                      <span className="font-mono text-gray-400">{previewText.length} chars</span>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          )}
        </div>
      )}

      <ConfirmModal
        isOpen={confirmRestore}
        onClose={() => setConfirmRestore(false)}
        onConfirm={() => {
          setTemplate(DEFAULT_REPORT_TEMPLATE)
          setConfirmRestore(false)
        }}
        variant="warning"
        title="Restore Default Template"
        message="Are you sure you want to restore the default report template? Any unsaved edits will be discarded."
        confirmLabel="Restore Default"
      />

      <AlertModal
        isOpen={!!error}
        onClose={() => setError(null)}
        variant="error"
        title="Error"
        message={error ?? ''}
      />

      <AlertModal
        isOpen={!!successMsg}
        onClose={() => setSuccessMsg(null)}
        variant="success"
        title="Success"
        message={successMsg ?? ''}
      />
    </div>
  )
}
