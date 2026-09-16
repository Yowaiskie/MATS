import React, { useState } from 'react'
import { Modal } from '@/components/Modal'
import { Button } from '@/components'
import { DynamicSignatureConfig } from '@/components/signatures/DynamicSignatureConfig'
import type { SignatureConfig } from '@/types/signature'
import { DEFAULT_MINISTRY_NAME, DEFAULT_PARISH_NAME } from '@/types/signature'
import type { MemberReportRow } from '@/services/reportService'
import { downloadMembersReportPdf, type PaperSize } from '@/utils/memberPdfReport'

interface MemberReportExportModalProps {
  isOpen: boolean
  onClose: () => void
  rows: MemberReportRow[]
  dateRange?: { start?: string; end?: string }
}

export const MemberReportExportModal: React.FC<MemberReportExportModalProps> = ({
  isOpen,
  onClose,
  rows,
  dateRange
}) => {
  const [paperSize, setPaperSize] = useState<PaperSize>('long')
  const [documentTitle, setDocumentTitle] = useState('Ministry of Altar Servers')
  const [signatureConfig, setSignatureConfig] = useState<SignatureConfig>({
    enabled: true,
    signatories: [
      {
        id: 'mem-sig-1',
        label: 'Prepared by:',
        name: 'Bro. BENAIKA LORENZO PARONABLE',
        title: `Admin Officer, ${DEFAULT_MINISTRY_NAME}`,
        organization: DEFAULT_PARISH_NAME,
        column: 1
      },
      {
        id: 'mem-sig-2',
        label: 'Noted by:',
        name: 'Bro. KYLE VINCENT MADRIAGA',
        title: `Coordinator, ${DEFAULT_MINISTRY_NAME}`,
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
      await downloadMembersReportPdf(rows, {
        dateRange,
        documentTitle: documentTitle.trim() || 'Ministry of Altar Servers',
        signatureConfig: signatureConfig.enabled ? signatureConfig : undefined,
        paperSize
      })
      onClose()
    } catch (err: any) {
      console.error('Failed to generate Member Masterlist PDF report:', err)
      setErrorMsg(err.message || 'Failed to generate PDF document.')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Export Member Masterlist & Attendance PDF"
      subtitle="Configure signatories, date range, and export official printable PDF document"
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
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight">Report Details</h4>
              <p className="text-xs font-semibold text-slate-500 mt-0.5">
                Period: <span className="font-bold text-slate-700">{dateRange?.start || 'Start'}</span> to{' '}
                <span className="font-bold text-slate-700">{dateRange?.end || 'Present'}</span>
              </p>
            </div>
            <div>
              <span className="px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-black">
                {rows.length} Members Listed
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
              placeholder="Ministry of Altar Servers"
              className="w-full p-2.5 text-xs font-bold border border-slate-200 rounded-xl bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                Paper Size
              </label>
              <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                {paperSize === 'long' ? '8.5" × 13" (Folio)' : paperSize === 'a4' ? 'A4 Size' : '8.5" × 11" (Letter)'}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {[
                { id: 'long', label: 'Long Bond Paper', desc: '8.5" × 13" (Folio - Standard)' },
                { id: 'a4', label: 'A4 Size', desc: '210 × 297 mm' },
                { id: 'letter', label: 'Short / Letter', desc: '8.5" × 11" (215.9 × 279.4 mm)' }
              ].map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPaperSize(p.id as PaperSize)}
                  className={`p-2.5 text-left rounded-xl border transition-all cursor-pointer ${
                    paperSize === p.id
                      ? 'bg-indigo-50/90 border-indigo-500 text-indigo-950 ring-1 ring-indigo-500/50 shadow-2xs font-bold'
                      : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="font-bold text-xs">{p.label}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{p.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Dynamic Signature Configuration */}
        <DynamicSignatureConfig
          value={signatureConfig}
          onChange={setSignatureConfig}
          defaultPresetName="General"
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
            disabled={rows.length === 0}
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
