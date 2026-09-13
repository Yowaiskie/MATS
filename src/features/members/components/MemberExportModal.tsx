import React, { useState, useMemo } from 'react'
import { Modal } from '@/components/Modal'
import { DynamicSignatureConfig } from '@/components/signatures/DynamicSignatureConfig'
import type { SignatureConfig } from '@/types/signature'
import { DEFAULT_MINISTRY_NAME, DEFAULT_PARISH_NAME } from '@/types/signature'
import type { Member } from '@/types/member'
import { ORDER_GROUPS, MEMBER_RANKS, getMemberOrders } from '@/types/member'
import {
  ALL_MEMBER_COLUMNS,
  getColumnsForPreset,
  exportMembersToCsv,
  exportMembersToPdf,
  type ExportPreset
} from '@/utils/memberExport'

interface MemberExportModalProps {
  isOpen: boolean
  onClose: () => void
  members: Member[]
  selectedMemberIds?: Set<string>
  showArchived?: boolean
  initialScope?: 'all' | 'selected' | 'order'
}

export const MemberExportModal: React.FC<MemberExportModalProps> = ({
  isOpen,
  onClose,
  members,
  selectedMemberIds,
  showArchived = false,
  initialScope = 'all'
}) => {
  const [format, setFormat] = useState<'pdf' | 'csv'>('pdf')
  const [scopeType, setScopeType] = useState<'all' | 'order' | 'selected'>(
    selectedMemberIds && selectedMemberIds.size > 0 && initialScope === 'selected'
      ? 'selected'
      : 'all'
  )
  const [selectedOrder, setSelectedOrder] = useState<string>('all')
  const [selectedRank, setSelectedRank] = useState<string>('all')
  const [preset, setPreset] = useState<ExportPreset>('summary')
  const [customColumns, setCustomColumns] = useState<string[]>([
    'index',
    'fullName',
    'rank',
    'order',
    'status',
    'phoneNumber'
  ])

  // PDF settings
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
  const [isExporting, setIsExporting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Filtered members for export based on choices
  const exportMembers = useMemo(() => {
    let list = members

    if (scopeType === 'selected' && selectedMemberIds && selectedMemberIds.size > 0) {
      list = list.filter(m => selectedMemberIds.has(m.id))
    }

    if (scopeType === 'order') {
      if (selectedOrder !== 'all') {
        if (selectedOrder === 'none') {
          list = list.filter(m => getMemberOrders(m.order).length === 0)
        } else {
          list = list.filter(m => getMemberOrders(m.order).includes(selectedOrder))
        }
      }
    }

    if (selectedRank !== 'all') {
      list = list.filter(m => m.rank === selectedRank)
    }

    return list
  }, [members, scopeType, selectedOrder, selectedRank, selectedMemberIds])

  // Active columns to include
  const activeColumns = useMemo(() => {
    return getColumnsForPreset(preset, customColumns)
  }, [preset, customColumns])

  if (!isOpen) return null

  const handleToggleCustomColumn = (colId: string) => {
    setCustomColumns(prev => {
      if (prev.includes(colId)) {
        if (prev.length <= 1) return prev // Keep at least one
        return prev.filter(id => id !== colId)
      } else {
        return [...prev, colId]
      }
    })
  }

  const handleDownload = async () => {
    if (exportMembers.length === 0) {
      setErrorMsg('No members match the selected criteria to export.')
      return
    }

    setIsExporting(true)
    setErrorMsg(null)

    try {
      let scopeLabel = showArchived ? 'Archived Members' : 'Active Members'
      if (scopeType === 'selected') {
        scopeLabel = `Selected Members (${exportMembers.length})`
      } else if (scopeType === 'order') {
        scopeLabel = selectedOrder === 'all' ? 'All Orders' : selectedOrder === 'none' ? 'Unassigned Orders' : selectedOrder
      }
      if (selectedRank !== 'all') {
        scopeLabel += ` • Rank: ${selectedRank}`
      }

      const fileSafeScope = scopeLabel.replace(/[^a-zA-Z0-9_-]/g, '_')
      const filenamePrefix = `MATS_Members_${fileSafeScope}`

      if (format === 'csv') {
        // Direct clean tabular CSV (without parish header as requested)
        exportMembersToCsv(exportMembers, activeColumns, filenamePrefix)
        onClose()
      } else {
        // PDF with official parish header, title, and signatures
        await exportMembersToPdf(exportMembers, activeColumns, {
          documentTitle: documentTitle.trim() || 'Ministry of Altar Servers',
          scopeLabel,
          signatureConfig: signatureConfig.enabled ? signatureConfig : undefined,
          filenamePrefix
        })
        onClose()
      }
    } catch (err: any) {
      console.error('Failed to export members:', err)
      setErrorMsg(err.message || 'Failed to export member records.')
    } finally {
      setIsExporting(false)
    }
  }

  const hasSelection = selectedMemberIds && selectedMemberIds.size > 0

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Export Members Masterlist"
      subtitle="Export parish roster, attendance records, or filtered member groups"
      badge="Member Export"
      icon={
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
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

        {/* 1. Format Selection Toggle */}
        <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
          <div>
            <span className="block text-[11px] font-black text-slate-800 uppercase tracking-tight">Export Format</span>
            <span className="text-[11px] text-slate-500">
              {format === 'pdf' ? 'Official branded PDF with parish header & signatures' : 'Clean tabular CSV spreadsheet for Excel & Sheets'}
            </span>
          </div>

          <div className="flex items-center bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
            <button
              type="button"
              onClick={() => setFormat('pdf')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                format === 'pdf'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>PDF Document</span>
            </button>
            <button
              type="button"
              onClick={() => setFormat('csv')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                format === 'csv'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              <span>CSV Spreadsheet</span>
            </button>
          </div>
        </div>

        {/* 2. Scope Filter (All vs Per Order Group vs Selected) */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight">1. Member Scope</h4>
            <span className="px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-[11px] font-extrabold">
              {exportMembers.length} member{exportMembers.length === 1 ? '' : 's'} to export
            </span>
          </div>

          {/* Scope Radios */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <label
              className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition ${
                scopeType === 'all'
                  ? 'bg-blue-50/70 border-blue-400 text-blue-900'
                  : 'border-slate-200 hover:bg-slate-50 text-slate-700'
              }`}
            >
              <input
                type="radio"
                name="scopeType"
                checked={scopeType === 'all'}
                onChange={() => setScopeType('all')}
                className="text-blue-600 focus:ring-blue-500"
              />
              <span className="text-xs font-bold">
                {showArchived ? 'All Archived' : 'All Active Members'}
              </span>
            </label>

            <label
              className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition ${
                scopeType === 'order'
                  ? 'bg-blue-50/70 border-blue-400 text-blue-900'
                  : 'border-slate-200 hover:bg-slate-50 text-slate-700'
              }`}
            >
              <input
                type="radio"
                name="scopeType"
                checked={scopeType === 'order'}
                onChange={() => setScopeType('order')}
                className="text-blue-600 focus:ring-blue-500"
              />
              <span className="text-xs font-bold">Filter by Order Group</span>
            </label>

            <label
              className={`flex items-center gap-2 p-2.5 rounded-xl border transition ${
                !hasSelection
                  ? 'opacity-40 cursor-not-allowed border-slate-200 text-slate-400'
                  : scopeType === 'selected'
                  ? 'bg-blue-50/70 border-blue-400 text-blue-900 cursor-pointer'
                  : 'border-slate-200 hover:bg-slate-50 text-slate-700 cursor-pointer'
              }`}
            >
              <input
                type="radio"
                name="scopeType"
                disabled={!hasSelection}
                checked={scopeType === 'selected'}
                onChange={() => setScopeType('selected')}
                className="text-blue-600 focus:ring-blue-500"
              />
              <span className="text-xs font-bold">
                Selected ({selectedMemberIds?.size || 0})
              </span>
            </label>
          </div>

          {/* Sub-filters for Order Group and Rank */}
          {scopeType === 'order' && (
            <div className="p-3 bg-slate-50/90 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1">
                  Choose Order Group:
                </label>
                <div className="relative">
                  <select
                    value={selectedOrder}
                    onChange={e => setSelectedOrder(e.target.value)}
                    className="w-full h-10 pl-3.5 pr-10 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 appearance-none focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition cursor-pointer shadow-2xs"
                  >
                    <option value="all">All Orders</option>
                    {ORDER_GROUPS.map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                    <option value="none">Unassigned / No Order</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1">
                  Filter by Rank (Optional):
                </label>
                <div className="relative">
                  <select
                    value={selectedRank}
                    onChange={e => setSelectedRank(e.target.value)}
                    className="w-full h-10 pl-3.5 pr-10 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 appearance-none focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition cursor-pointer shadow-2xs"
                  >
                    <option value="all">All Ranks</option>
                    {MEMBER_RANKS.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          )}

          {scopeType === 'all' && (
            <div className="p-3 bg-slate-50/90 rounded-xl border border-slate-200 mt-2">
              <div className="flex items-center gap-3">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                  Filter Rank:
                </label>
                <div className="relative">
                  <select
                    value={selectedRank}
                    onChange={e => setSelectedRank(e.target.value)}
                    className="h-10 pl-3.5 pr-10 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 appearance-none focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition cursor-pointer shadow-2xs"
                  >
                    <option value="all">All Ranks</option>
                    {MEMBER_RANKS.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 3. Columns / Field Detail Selection */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight">2. Information / Columns</h4>
            <span className="text-[11px] font-bold text-slate-500">{activeColumns.length} columns included</span>
          </div>

          {/* Preset Buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { id: 'all', label: 'All Details', desc: 'Full profile info' },
              { id: 'names_only', label: 'Names Only', desc: 'Index, Name & Nickname' },
              { id: 'summary', label: 'Masterlist Summary', desc: 'Name, Rank, Order, Phone' },
              { id: 'custom', label: 'Custom Columns', desc: 'Pick specific fields' }
            ].map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => setPreset(item.id as ExportPreset)}
                className={`p-2.5 text-left rounded-xl border transition-all cursor-pointer ${
                  preset === item.id
                    ? 'bg-indigo-50 border-indigo-400 text-indigo-950 ring-1 ring-indigo-400/50'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="font-bold text-xs">{item.label}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">{item.desc}</div>
              </button>
            ))}
          </div>

          {/* Custom Column Checkboxes */}
          {preset === 'custom' && (
            <div className="p-3 bg-slate-50/90 rounded-xl border border-slate-200 mt-2 space-y-2">
              <span className="block text-[10px] font-black uppercase text-slate-500 tracking-wider">
                Select Columns to Include:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {ALL_MEMBER_COLUMNS.map(col => {
                  const isChecked = customColumns.includes(col.id)
                  return (
                    <label
                      key={col.id}
                      className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer select-none transition ${
                        isChecked
                          ? 'bg-white border-blue-300 font-bold text-blue-900 shadow-2xs'
                          : 'border-slate-200 text-slate-600 hover:bg-white'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleCustomColumn(col.id)}
                        className="rounded text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                      />
                      <span className="truncate">{col.label}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* 4. PDF Header & Dynamic Signatures (only for PDF format) */}
        {format === 'pdf' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-3">
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight">3. Document Title</h4>
              <input
                type="text"
                value={documentTitle}
                onChange={e => setDocumentTitle(e.target.value)}
                placeholder="Ministry of Altar Servers"
                className="w-full p-2.5 text-xs font-bold border border-slate-300 rounded-xl bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <DynamicSignatureConfig
              value={signatureConfig}
              onChange={setSignatureConfig}
              defaultPresetName="General"
            />
          </div>
        )}

        {/* Footer Actions */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3 sticky bottom-0 bg-white">
          <div className="text-[11px] font-bold text-slate-500">
            Ready to export <span className="text-slate-900 font-black">{exportMembers.length}</span> records ({format.toUpperCase()})
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isExporting}
              className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={isExporting || exportMembers.length === 0}
              className={`inline-flex items-center gap-2 px-5 py-2.5 text-xs font-black text-white rounded-xl shadow-md active:scale-95 transition cursor-pointer disabled:opacity-50 ${
                format === 'pdf'
                  ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/20'
                  : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20'
              }`}
            >
              {isExporting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Generating {format.toUpperCase()}...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span>Download {format.toUpperCase()}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
