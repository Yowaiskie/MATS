import React, { useState, useEffect } from 'react'
import { Card } from '@/components/Card'
import { settingsService, DEFAULT_REPORT_TEMPLATE } from '@/services/settingsService'
import { generateCommunityReport } from '@/utils/communityReport'
import { AlertModal, ConfirmModal } from '@/components/Dialog'
import type { Schedule } from '@/types/schedule'
import type { Member } from '@/types/member'
import { useAuth } from '@/features/authentication/AuthContext'
import { ReportTemplateEditor } from '../components/ReportTemplateEditor'

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

export const SettingsPage: React.FC = () => {
  const { profile } = useAuth()
  const [template, setTemplate] = useState('')
  const [originalTemplate, setOriginalTemplate] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [confirmRestore, setConfirmRestore] = useState(false)
  const [copied, setCopied] = useState(false)

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

  // Generate live preview text dynamically as user types
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
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">System Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Configure parameters and message layouts for the Ministry of Altar Servers.</p>
      </div>

      {loading ? (
        <Card>
          <div className="py-16 flex flex-col items-center justify-center space-y-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
            <span className="text-xs text-gray-500">Loading system settings...</span>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Template Editor Column */}
          <div className="lg:col-span-7">
            <ReportTemplateEditor
              value={template}
              onChange={setTemplate}
              onRestoreDefault={handleRestoreDefault}
              onSave={handleSave}
              saving={saving}
              isDirty={template !== originalTemplate}
            />
          </div>

          {/* Live Preview Column */}
          <div className="lg:col-span-5 sticky top-6">
            <Card className="p-0 overflow-hidden border border-gray-200 shadow-xs">
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
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
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-md transition-colors cursor-pointer"
                >
                  {copied ? '✓ Copied!' : '📋 Copy Sample'}
                </button>
              </div>

              <div className="p-4 space-y-3">
                <div className="rounded-xl border border-gray-200 bg-gray-50/80 p-4 text-xs font-mono text-gray-800 whitespace-pre-wrap select-text leading-relaxed min-h-[320px] max-h-[500px] overflow-y-auto">
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

      {/* Restore Default Template Confirm */}
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

      {/* Error Alert Modal */}
      <AlertModal
        isOpen={!!error}
        onClose={() => setError(null)}
        variant="error"
        title="Error"
        message={error ?? ''}
      />

      {/* Success Alert Modal */}
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
