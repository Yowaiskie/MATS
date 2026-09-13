import React, { useState } from 'react'
import { Modal } from '@/components/Modal'
import { DynamicSignatureConfig } from '@/components/signatures/DynamicSignatureConfig'
import type { SignatureConfig } from '@/types/signature'
import { DEFAULT_MINISTRY_NAME, DEFAULT_PARISH_NAME } from '@/types/signature'
import type { EventContribution } from '@/types/eventContribution'
import { downloadEventContributionReportPdf } from '@/utils/eventContributionPdfReport'

interface EventContributionExportModalProps {
  isOpen: boolean
  onClose: () => void
  eventName: string
  contributions: EventContribution[]
  filterDescription?: string
}

export const EventContributionExportModal: React.FC<EventContributionExportModalProps> = ({
  isOpen,
  onClose,
  eventName,
  contributions,
  filterDescription
}) => {
  const [documentTitle, setDocumentTitle] = useState(`EVENT CONTRIBUTIONS REPORT: ${eventName.toUpperCase()}`)
  const [signatureConfig, setSignatureConfig] = useState<SignatureConfig>({
    enabled: true,
    signatories: [
      {
        id: 'ec-sig-1',
        label: 'Prepared by:',
        name: 'Bro. CHRYSLER DAVID',
        title: `Treasurer, ${DEFAULT_MINISTRY_NAME}`,
        organization: DEFAULT_PARISH_NAME,
        column: 1
      },
      {
        id: 'ec-sig-2',
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
      await downloadEventContributionReportPdf(
        {
          eventName,
          contributions,
          filterDescription
        },
        {
          documentTitle: documentTitle.trim() || `EVENT CONTRIBUTIONS REPORT: ${eventName.toUpperCase()}`,
          signatureConfig: signatureConfig.enabled ? signatureConfig : undefined
        }
      )
      onClose()
    } catch (err: any) {
      console.error('Failed to generate Event Contribution PDF report:', err)
      setErrorMsg(err.message || 'Failed to generate PDF document.')
    } finally {
      setIsGenerating(false)
    }
  }

  const validContributions = contributions.filter(c => c.status !== 'voided')
  const totalAmount = validContributions.reduce((sum, c) => sum + c.amount, 0)

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Export Event Contributions Report PDF"
      subtitle={`Export official list of recorded contributions for ${eventName}`}
      badge="Contributions Report"
      icon={
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      }
      maxWidth="2xl"
    >
      <div className="space-y-5 max-h-[75vh] overflow-y-auto pr-1 text-xs">
        {errorMsg && (
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 font-bold text-xs">
            {errorMsg}
          </div>
        )}

        {/* Report Overview Settings */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200/80">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                Contributions Overview
              </span>
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight mt-1">{eventName}</h4>
              <p className="text-[11px] font-medium text-slate-500">
                {filterDescription ? `Filter: ${filterDescription}` : 'All Contributions Logged'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-black font-mono">
                PHP {totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} ({validContributions.length} records)
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
              placeholder={`EVENT CONTRIBUTIONS REPORT: ${eventName.toUpperCase()}`}
              className="w-full p-2.5 text-xs font-bold border border-slate-200 rounded-xl bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 uppercase transition-all"
            />
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
            disabled={isGenerating || contributions.length === 0}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl shadow-md shadow-indigo-500/20 active:scale-95 transition cursor-pointer"
          >
            {isGenerating ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Compiling PDF...</span>
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
