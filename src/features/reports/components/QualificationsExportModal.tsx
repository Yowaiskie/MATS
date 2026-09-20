import React, { useState } from 'react'
import { Modal } from '@/components/Modal'
import { Button } from '@/components'
import { DynamicSignatureConfig } from '@/components/signatures/DynamicSignatureConfig'
import type { SignatureConfig } from '@/types/signature'
import { DEFAULT_MINISTRY_NAME, DEFAULT_PARISH_NAME } from '@/types/signature'
import type { MemberQualificationResult, CategoryRule } from '@/types/attendanceCategory'
import { downloadQualificationsReportPdf } from '@/utils/qualificationPdfReport'

interface QualificationsExportModalProps {
  isOpen: boolean
  onClose: () => void
  results: MemberQualificationResult[]
  dateRange?: { start?: string; end?: string }
  presetName?: string
  activeRules: CategoryRule[]
}

export const QualificationsExportModal: React.FC<QualificationsExportModalProps> = ({
  isOpen,
  onClose,
  results,
  dateRange,
  presetName,
  activeRules
}) => {
  const [documentTitle, setDocumentTitle] = useState('Member Attendance Evaluation & Renewal Qualifications')
  const [signatureConfig, setSignatureConfig] = useState<SignatureConfig>({
    enabled: true,
    signatories: [
      {
        id: 'qual-sig-1',
        label: 'Prepared by:',
        name: 'Bro. BENAIKA LORENZO PARONABLE',
        title: `Admin Officer, ${DEFAULT_MINISTRY_NAME}`,
        organization: DEFAULT_PARISH_NAME,
        column: 1
      },
      {
        id: 'qual-sig-2',
        label: 'Verified by:',
        name: 'Bro. KYLE VINCENT MADRIAGA',
        title: `Coordinator, ${DEFAULT_MINISTRY_NAME}`,
        organization: DEFAULT_PARISH_NAME,
        column: 2
      },
      {
        id: 'qual-sig-3',
        label: 'Approved by:',
        name: 'Rev. Fr. ILDEFONSO DE GUZMAN JR.',
        title: 'Parish Priest',
        organization: DEFAULT_PARISH_NAME,
        column: 2
      }
    ]
  })
  const [isGenerating, setIsGenerating] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  if (!isOpen) return null

  const handleDownload = async () => {
    setIsGenerating(true)
    setErrorMsg(null)
    try {
      await downloadQualificationsReportPdf(results, {
        dateRange,
        documentTitle: documentTitle.trim() || 'Member Attendance Evaluation & Renewal Qualifications',
        presetName,
        activeRules,
        signatureConfig: signatureConfig.enabled ? signatureConfig : undefined
      })
      onClose()
    } catch (err: any) {
      console.error('Failed to generate Qualifications PDF report:', err)
      setErrorMsg(err.message || 'Failed to generate PDF document.')
    } finally {
      setIsGenerating(false)
    }
  }

  const qualifiedCount = results.filter(r => r.isQualified).length
  const deficientCount = results.length - qualifiedCount

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Export Renewal & Qualification Roster PDF"
      subtitle="Configure signatories, document title, and generate an official printable PDF evaluation roster"
      badge="PDF Export"
      icon={
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      }
      maxWidth="2xl"
    >
      <div className="space-y-5 max-h-[75vh] overflow-y-auto pr-1 text-xs">
        {errorMsg && (
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 font-bold text-xs animate-fade-in">
            {errorMsg}
          </div>
        )}

        {/* Report Overview Settings */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight">Roster Summary</h4>
              <p className="text-xs font-semibold text-slate-500 mt-0.5">
                Evaluation Period: <span className="font-bold text-slate-700">{dateRange?.start || 'Start'}</span> to{' '}
                <span className="font-bold text-slate-700">{dateRange?.end || 'Present'}</span>
                {presetName && (
                  <span className="ml-2 font-bold text-indigo-600">({presetName})</span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-black">
                {results.length} Evaluated
              </span>
              <span className="px-2 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-extrabold">
                {qualifiedCount} Qualified
              </span>
              <span className="px-2 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-extrabold">
                {deficientCount} Deficient
              </span>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1">
              Custom Document Header Title
            </label>
            <input
              type="text"
              value={documentTitle}
              onChange={e => setDocumentTitle(e.target.value)}
              placeholder="Member Attendance Evaluation & Renewal Qualifications"
              className="w-full p-2.5 text-xs font-bold border border-slate-200 rounded-xl bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            />
          </div>
        </div>

        {/* Dynamic Signature Configuration */}
        <DynamicSignatureConfig
          value={signatureConfig}
          onChange={setSignatureConfig}
          defaultPresetName="Qualifications"
        />

        {/* Action Buttons */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3 sticky bottom-0 bg-white">
          <Button
            type="button"
            variant="outline"
            size="dense"
            onClick={onClose}
            disabled={isGenerating}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            size="dense"
            onClick={handleDownload}
            loading={isGenerating}
            disabled={results.length === 0}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>Generate & Download PDF</span>
          </Button>
        </div>
      </div>
    </Modal>
  )
}
