import React, { useState } from 'react'
import { Modal } from '@/components/Modal'
import { DynamicSignatureConfig } from '@/components/signatures/DynamicSignatureConfig'
import type { SignatureConfig } from '@/types/signature'
import { DEFAULT_FINANCE_SIGNATORIES } from '@/types/signature'
import type { FinanceReportData } from '@/services/finance/reportService'
import { downloadFinanceReportPdf } from '@/utils/financePdfReport'

interface FinanceExportModalProps {
  isOpen: boolean
  onClose: () => void
  reportData: FinanceReportData | null
  startDate: string
  endDate: string
}

export const FinanceExportModal: React.FC<FinanceExportModalProps> = ({
  isOpen,
  onClose,
  reportData,
  startDate,
  endDate
}) => {
  const [documentTitle, setDocumentTitle] = useState('TREASURY FINANCIAL STATEMENT & REPORT')
  const [signatureConfig, setSignatureConfig] = useState<SignatureConfig>({
    enabled: true,
    signatories: DEFAULT_FINANCE_SIGNATORIES
  })
  const [isGenerating, setIsGenerating] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  if (!isOpen || !reportData) return null

  const handleDownload = async () => {
    setIsGenerating(true)
    setErrorMsg(null)
    try {
      await downloadFinanceReportPdf(reportData, {
        documentTitle: documentTitle.trim() || 'TREASURY FINANCIAL STATEMENT & REPORT',
        signatureConfig: signatureConfig.enabled ? signatureConfig : undefined
      })
      onClose()
    } catch (err: any) {
      console.error('Failed to generate Finance PDF report:', err)
      setErrorMsg(err.message || 'Failed to generate PDF document.')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Export Official Financial Statement PDF" maxWidth="2xl">
      <div className="space-y-5 max-h-[75vh] overflow-y-auto pr-1 text-xs">
        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-bold text-xs">
            {errorMsg}
          </div>
        )}

        {/* Basic Document Settings */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight">Report Information</h4>
              <p className="text-[11px] font-medium text-slate-500">
                Period: <span className="font-bold text-slate-700">{startDate}</span> to{' '}
                <span className="font-bold text-slate-700">{endDate}</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-[11px] font-extrabold">
                {reportData.ledgerEntries?.length || 0} Transactions
              </span>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
              Custom Document Title
            </label>
            <input
              type="text"
              value={documentTitle}
              onChange={e => setDocumentTitle(e.target.value)}
              placeholder="TREASURY FINANCIAL STATEMENT & REPORT"
              className="w-full p-2.5 text-xs font-bold border border-slate-300 rounded-xl bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 uppercase"
            />
          </div>
        </div>

        {/* Dynamic Signature Configuration Section */}
        <DynamicSignatureConfig
          value={signatureConfig}
          onChange={setSignatureConfig}
          defaultPresetName="Treasury Standard"
        />

        {/* Action Buttons */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3 sticky bottom-0 bg-white">
          <button
            type="button"
            onClick={onClose}
            disabled={isGenerating}
            className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={isGenerating}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-black text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl shadow-md shadow-blue-500/20 active:scale-95 transition cursor-pointer"
          >
            {isGenerating ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Generating Document...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span>Generate & Download PDF</span>
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  )
}
