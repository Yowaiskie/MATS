import React, { useState, useEffect } from 'react'
import { Modal } from '@/components/Modal'
import { DynamicSignatureConfig } from '@/components/signatures/DynamicSignatureConfig'
import type { SignatureConfig, SignatoryItem } from '@/types/signature'
import type { FinanceFundRequest } from '@/types/finance'
import { downloadFundRequisitionPdf } from '@/utils/fundRequisitionPdf'

interface FundRequisitionExportModalProps {
  isOpen: boolean
  onClose: () => void
  request: FinanceFundRequest | null
}

export const FundRequisitionExportModal: React.FC<FundRequisitionExportModalProps> = ({
  isOpen,
  onClose,
  request
}) => {
  const [docDate, setDocDate] = useState('')
  const [fromMinistry, setFromMinistry] = useState('The MINISTRY OF ALTAR SERVERS')
  const [purpose, setPurpose] = useState('')
  const [participants, setParticipants] = useState('N/A')
  const [dateNeeded, setDateNeeded] = useState('')
  const [venue, setVenue] = useState('N/A')
  const [assembly, setAssembly] = useState('N/A')

  const [signatureConfig, setSignatureConfig] = useState<SignatureConfig>({
    enabled: true,
    signatories: []
  })
  const [isGenerating, setIsGenerating] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (request) {
      setDocDate(request.dateNeeded || new Date().toISOString().slice(0, 10))
      setFromMinistry(request.fromMinistry || 'The MINISTRY OF ALTAR SERVERS')
      setPurpose(request.purpose || request.title || '')
      setParticipants(request.participants || 'N/A')
      setDateNeeded(request.dateNeeded || '')
      setVenue(request.venue || 'N/A')
      setAssembly(request.assembly || 'N/A')

      const defaultSignatories: SignatoryItem[] = [
        {
          id: 'sig-req-1',
          label: 'Requesting officer:',
          name: request.requestedByName || 'Bro. CHRYSLER DAVID',
          title: 'Treasurer, Ministry of Altar Servers',
          organization: 'Sacred Heart of Jesus Parish - MBS',
          column: 1
        },
        {
          id: 'sig-req-2',
          label: 'Approved by:',
          name: request.approvedByName || 'Bro. KYLE VINCENT MADRIAGA',
          title: 'Coordinator, Ministry of Altar Servers',
          organization: 'Sacred Heart of Jesus Parish - MBS',
          column: 2
        }
      ]

      setSignatureConfig({
        enabled: true,
        signatories: defaultSignatories
      })
    }
  }, [request])

  if (!isOpen || !request) return null

  const items = request.expectedExpenses && request.expectedExpenses.length > 0
    ? request.expectedExpenses
    : [
        {
          id: '1',
          intendedUse: request.purpose || request.title,
          unitPrice: `₱${(request.requestedAmount || 0).toLocaleString()}`,
          quantity: '1 lot',
          amount: request.requestedAmount || 0
        }
      ]

  const totalAmount = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)

  const handleDownload = async () => {
    setIsGenerating(true)
    setErrorMsg(null)
    try {
      await downloadFundRequisitionPdf(request, {
        documentDate: docDate,
        fromMinistry: fromMinistry.trim() || 'The MINISTRY OF ALTAR SERVERS',
        purpose: purpose.trim(),
        participants: participants.trim(),
        dateNeeded: dateNeeded.trim(),
        venue: venue.trim(),
        assembly: assembly.trim(),
        signatureConfig: signatureConfig.enabled ? signatureConfig : undefined
      })
      onClose()
    } catch (err: any) {
      console.error('Failed to generate Fund Requisition PDF:', err)
      setErrorMsg(err.message || 'Failed to generate PDF document.')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Export Fund Requisition Voucher PDF" maxWidth="2xl">
      <div className="space-y-5 max-h-[78vh] overflow-y-auto pr-1 text-xs">
        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-bold text-xs">
            {errorMsg}
          </div>
        )}

        {/* Voucher Header Details Card */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                Official Requisition
              </span>
              <h4 className="text-sm font-black text-slate-900 mt-1">{request.title}</h4>
              <p className="text-[11px] font-mono text-slate-500">Ref: {request.referenceNumber}</p>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-500 font-medium block">Total Expected Allocation</span>
              <span className="text-base font-black text-blue-700">₱{totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                From (Requester Unit)
              </label>
              <input
                type="text"
                value={fromMinistry}
                onChange={e => setFromMinistry(e.target.value)}
                className="w-full p-2.5 text-xs font-semibold border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                Voucher Date
              </label>
              <input
                type="date"
                value={docDate}
                onChange={e => setDocDate(e.target.value)}
                className="w-full p-2.5 text-xs font-semibold border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                Purpose
              </label>
              <input
                type="text"
                value={purpose}
                onChange={e => setPurpose(e.target.value)}
                className="w-full p-2.5 text-xs font-semibold border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                Date Needed
              </label>
              <input
                type="date"
                value={dateNeeded}
                onChange={e => setDateNeeded(e.target.value)}
                className="w-full p-2.5 text-xs font-semibold border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                Venue
              </label>
              <input
                type="text"
                value={venue}
                onChange={e => setVenue(e.target.value)}
                className="w-full p-2.5 text-xs font-semibold border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                Participants
              </label>
              <input
                type="text"
                value={participants}
                onChange={e => setParticipants(e.target.value)}
                className="w-full p-2.5 text-xs font-semibold border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                Assembly / Gathering Time
              </label>
              <input
                type="text"
                value={assembly}
                onChange={e => setAssembly(e.target.value)}
                className="w-full p-2.5 text-xs font-semibold border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Expected Expenses Preview Table */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-tight flex items-center gap-1.5">
              <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Expected Expenses ({items.length} items)</span>
            </h4>
            <span className="text-xs font-black text-slate-800">
              Total: ₱{totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <th className="p-2.5 text-left">Intended Use</th>
                  <th className="p-2.5 text-center">Unit Price</th>
                  <th className="p-2.5 text-center">Quantity</th>
                  <th className="p-2.5 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item, idx) => (
                  <tr key={item.id || idx} className="hover:bg-slate-50">
                    <td className="p-2.5 font-medium text-slate-900">{item.intendedUse}</td>
                    <td className="p-2.5 text-center text-slate-600 font-mono text-[11px]">{item.unitPrice}</td>
                    <td className="p-2.5 text-center text-slate-600">{item.quantity}</td>
                    <td className="p-2.5 text-right font-bold text-slate-900 font-mono">
                      ₱{Number(item.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Dynamic Signatures Config */}
        <DynamicSignatureConfig
          value={signatureConfig}
          onChange={setSignatureConfig}
          defaultPresetName="Requisition (2 Signatures)"
        />

        {/* Modal Action Buttons */}
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
                <span>Download Fund Requisition PDF</span>
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  )
}
