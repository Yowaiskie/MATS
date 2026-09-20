import React, { useState, useEffect } from 'react'
import { Card } from '@/components/Card'
import { 
  settingsService, 
  DEFAULT_REPORT_TEMPLATE, 
  DEFAULT_REMINDER_TEMPLATE 
} from '@/services/settingsService'
import { generateCommunityReport } from '@/utils/communityReport'
import { generateUntakenScheduleReminderText } from '@/utils/untakenScheduleReport'
import { AlertModal, ConfirmModal } from '@/components/Dialog'
import { Button, useToast } from '@/components'
import type { Schedule } from '@/types/schedule'
import type { Member } from '@/types/member'
import { useAuth } from '@/features/authentication/AuthContext'
import { ReportTemplateEditor } from '../components/ReportTemplateEditor'
import { ReminderTemplateEditor } from '../components/ReminderTemplateEditor'
import { PolicySettingsCard } from '../components/PolicySettingsCard'
import { MaintenanceSettingsCard } from '../components/MaintenanceSettingsCard'
import { SignatureSettingsCard } from '../components/SignatureSettingsCard'

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

const mockUntakenSchedules: Schedule[] = [
  {
    id: 'mock-u1',
    title: 'Sunday High Mass',
    date: '2026-06-28',
    startTime: '06:00',
    endTime: '07:30',
    status: 'completed',
    assignedMembers: ['m-1', 'm-2'],
    createdAt: '',
    updatedAt: ''
  },
  {
    id: 'mock-u2',
    title: 'Youth Formation & General Assembly',
    date: '2026-06-28',
    startTime: '13:00',
    endTime: '15:00',
    status: 'completed',
    assignedMembers: ['m-3', 'm-4'],
    createdAt: '',
    updatedAt: ''
  }
]

type TabId = 'policy' | 'template' | 'reminder_template' | 'signatures' | 'maintenance'

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

const BellIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
  </svg>
)

const SignatureIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
  </svg>
)

const WrenchIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.83-5.83M11.42 15.17l2.496-3.03c.317-.384.74-.664 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l5.654-4.654m0 0l-3.03 2.496c-.102.468-.382.891-.766 1.208m0 0L3.75 10.5" />
  </svg>
)

const CopyIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
)

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'policy', label: 'Attendance Policy', icon: <ShieldIcon className="w-4 h-4" /> },
  { id: 'template', label: 'Report Template', icon: <FileTextIcon className="w-4 h-4" /> },
  { id: 'reminder_template', label: 'Reminder Template', icon: <BellIcon className="w-4 h-4" /> },
  { id: 'signatures', label: 'Signature Presets', icon: <SignatureIcon className="w-4 h-4" /> },
  { id: 'maintenance', label: 'Maintenance Mode', icon: <WrenchIcon className="w-4 h-4" /> }
]

export const SettingsPage: React.FC = () => {
  const { profile } = useAuth()
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState<TabId>('policy')

  // Community Report Template state
  const [template, setTemplate] = useState('')
  const [originalTemplate, setOriginalTemplate] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmRestore, setConfirmRestore] = useState(false)
  const [copied, setCopied] = useState(false)

  // Untaken Reminder Template state
  const [reminderTemplate, setReminderTemplate] = useState('')
  const [originalReminderTemplate, setOriginalReminderTemplate] = useState('')
  const [savingReminder, setSavingReminder] = useState(false)
  const [confirmRestoreReminder, setConfirmRestoreReminder] = useState(false)
  const [copiedReminder, setCopiedReminder] = useState(false)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadTemplates = async () => {
    setLoading(true)
    setError(null)
    try {
      const [reportTpl, reminderTpl] = await Promise.all([
        settingsService.getReportTemplate(),
        settingsService.getReminderTemplate()
      ])
      setTemplate(reportTpl)
      setOriginalTemplate(reportTpl)
      setReminderTemplate(reminderTpl)
      setOriginalReminderTemplate(reminderTpl)
    } catch (err) {
      console.error(err)
      setError('Failed to load system templates.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTemplates()
  }, [])

  // Save Report Template
  const handleSaveReportTemplate = async () => {
    setSaving(true)
    setError(null)
    try {
      await settingsService.saveReportTemplate(template, profile?.email || 'Admin')
      setOriginalTemplate(template)
      toast.success('Report template settings successfully saved!')
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Failed to save report template.')
    } finally {
      setSaving(false)
    }
  }

  // Save Reminder Template
  const handleSaveReminderTemplate = async () => {
    setSavingReminder(true)
    setError(null)
    try {
      await settingsService.saveReminderTemplate(reminderTemplate, profile?.email || 'Admin')
      setOriginalReminderTemplate(reminderTemplate)
      toast.success('Reminder template settings successfully saved!')
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Failed to save reminder template.')
    } finally {
      setSavingReminder(false)
    }
  }

  // Preview Community Report
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

  // Preview Untaken Schedule Reminder
  const reminderPreviewText = generateUntakenScheduleReminderText({
    schedules: mockUntakenSchedules,
    customNote: 'Please wear complete vestments and record before 5 PM.',
    template: reminderTemplate || DEFAULT_REMINDER_TEMPLATE
  })

  const handleCopyReminderPreview = async () => {
    try {
      await navigator.clipboard.writeText(reminderPreviewText)
      setCopiedReminder(true)
      setTimeout(() => setCopiedReminder(false), 2000)
    } catch (err) {
      console.error('Failed to copy reminder preview text:', err)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">System Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Configure parameters and message layouts for the Ministry of Altar Servers.</p>
      </div>

      <div className="bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden w-full sm:w-fit">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all duration-200 shrink-0 cursor-pointer ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/25 ring-1 ring-blue-700/20'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
              }`}
            >
              <span className={isActive ? 'text-blue-100' : 'text-slate-400'}>{tab.icon}</span>
              <span className="whitespace-nowrap">{tab.label}</span>
            </button>
          )
        })}
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
          {activeTab === 'policy' && (
            <PolicySettingsCard
              onNotifySuccess={(msg) => toast.success(msg)}
              onNotifyError={(msg) => setError(msg)}
            />
          )}

          {activeTab === 'signatures' && (
            <SignatureSettingsCard
              onNotifySuccess={(msg) => toast.success(msg)}
              onNotifyError={(msg) => setError(msg)}
            />
          )}

          {activeTab === 'maintenance' && (
            <MaintenanceSettingsCard
              onNotifySuccess={(msg) => toast.success(msg)}
              onNotifyError={(msg) => setError(msg)}
            />
          )}

          {activeTab === 'template' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 flex flex-col min-h-0">
                <ReportTemplateEditor
                  value={template}
                  onChange={setTemplate}
                  onRestoreDefault={() => setConfirmRestore(true)}
                  onSave={handleSaveReportTemplate}
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

                    <Button
                      type="button"
                      variant="outline"
                      size="dense"
                      onClick={handleCopyPreview}
                      className="min-h-[32px] text-[11px]"
                    >
                      <CopyIcon className="w-3.5 h-3.5" />
                      {copied ? 'Copied!' : 'Copy Sample'}
                    </Button>
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

          {activeTab === 'reminder_template' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 flex flex-col min-h-0">
                <ReminderTemplateEditor
                  value={reminderTemplate}
                  onChange={setReminderTemplate}
                  onRestoreDefault={() => setConfirmRestoreReminder(true)}
                  onSave={handleSaveReminderTemplate}
                  saving={savingReminder}
                  isDirty={reminderTemplate !== originalReminderTemplate}
                />
              </div>

              <div className="lg:col-span-5 flex flex-col min-h-0">
                <Card className="p-0 border border-gray-200 shadow-xs flex flex-col flex-1">
                  <div className="shrink-0 px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                      </span>
                      <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">GC Reminder Preview</h3>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="dense"
                      onClick={handleCopyReminderPreview}
                      className="min-h-[32px] text-[11px]"
                    >
                      <CopyIcon className="w-3.5 h-3.5" />
                      {copiedReminder ? 'Copied!' : 'Copy Sample'}
                    </Button>
                  </div>

                  <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-3">
                    <div className="rounded-xl border border-gray-200 bg-slate-900 text-slate-100 p-4 text-xs font-mono whitespace-pre-wrap select-text leading-relaxed shadow-inner">
                      {reminderPreviewText || <span className="text-gray-400 italic">No output text generated.</span>}
                    </div>

                    <div className="rounded-lg bg-gray-50 p-2.5 border border-gray-100 text-[11px] text-gray-500 flex items-center justify-between">
                      <span>Showing sample untaken schedules reminder</span>
                      <span className="font-mono text-gray-400">{reminderPreviewText.length} chars</span>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Restore Default Modals */}
      <ConfirmModal
        isOpen={confirmRestore}
        onClose={() => setConfirmRestore(false)}
        onConfirm={() => {
          setTemplate(DEFAULT_REPORT_TEMPLATE)
          setConfirmRestore(false)
        }}
        variant="warning"
        title="Restore Default Report Template"
        message="Are you sure you want to restore the default community report template? Any unsaved edits will be discarded."
        confirmLabel="Restore Default"
      />

      <ConfirmModal
        isOpen={confirmRestoreReminder}
        onClose={() => setConfirmRestoreReminder(false)}
        onConfirm={() => {
          setReminderTemplate(DEFAULT_REMINDER_TEMPLATE)
          setConfirmRestoreReminder(false)
        }}
        variant="warning"
        title="Restore Default Reminder Template"
        message="Are you sure you want to restore the default pending attendance reminder template? Any unsaved edits will be discarded."
        confirmLabel="Restore Default"
      />

      <AlertModal
        isOpen={!!error}
        onClose={() => setError(null)}
        variant="error"
        title="Error"
        message={error ?? ''}
      />
    </div>
  )
}
