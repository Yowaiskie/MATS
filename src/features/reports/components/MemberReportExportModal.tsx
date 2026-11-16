import React, { useState, useEffect, useMemo } from 'react'
import { Modal } from '@/components/Modal'
import { Button, CustomSelect, useToast } from '@/components'
import { DynamicSignatureConfig } from '@/components/signatures/DynamicSignatureConfig'
import type { SignatureConfig } from '@/types/signature'
import { DEFAULT_MINISTRY_NAME, DEFAULT_PARISH_NAME } from '@/types/signature'
import type { MemberReportRow } from '@/services/reportService'
import { downloadMembersReportPdf, type PaperSize } from '@/utils/memberPdfReport'
import { eventFormService } from '@/services/eventFormService'
import { eventFormQuestionService } from '@/services/eventFormQuestionService'
import { eventFormResponseService } from '@/services/eventFormResponseService'
import { memberService } from '@/services/memberService'
import type { EventForm } from '@/types/eventForm'
import { MEMBER_RANKS } from '@/types/member'
import {
  consolidateFormEvaluations,
  generateSmartAttendancePresets,
  type OfficerSubmissionFeedback
} from '@/utils/eventFormConsolidation'

interface MemberReportExportModalProps {
  isOpen: boolean
  onClose: () => void
  rows: MemberReportRow[]
  dateRange?: { start?: string; end?: string }
  initialRankFilter?: string
}

export const MemberReportExportModal: React.FC<MemberReportExportModalProps> = ({
  isOpen,
  onClose,
  rows,
  dateRange,
  initialRankFilter
}) => {
  const { toast } = useToast()

  const storageDraftKey = useMemo(() => {
    const rangeTag = dateRange?.start && dateRange?.end ? `${dateRange.start}_${dateRange.end}` : 'default'
    return `mats_pastoral_evaluations_draft_${rangeTag}`
  }, [dateRange?.start, dateRange?.end])

  // Report Type: standard or pastoral_evaluation
  const [reportType, setReportType] = useState<'standard' | 'pastoral_evaluation'>('standard')
  const [paperSize, setPaperSize] = useState<PaperSize>('long')
  const [documentTitle, setDocumentTitle] = useState('Ministry of Altar Servers')

  // Distinct available ranks in current rows
  const availableRanks = useMemo(() => {
    const rankSet = new Set<string>()
    MEMBER_RANKS.forEach(r => rankSet.add(r))
    rows.forEach(r => {
      if (r.rank && r.rank.trim()) rankSet.add(r.rank.trim())
    })
    return Array.from(rankSet)
  }, [rows])

  // Selected ranks filter (empty array means all ranks included)
  const [selectedRanks, setSelectedRanks] = useState<string[]>(() =>
    initialRankFilter && initialRankFilter !== 'all' ? [initialRankFilter] : []
  )

  // Sync initial rank filter when modal opens
  useEffect(() => {
    if (initialRankFilter && initialRankFilter !== 'all') {
      setSelectedRanks([initialRankFilter])
    } else {
      setSelectedRanks([])
    }
  }, [initialRankFilter, isOpen])

  // Rows filtered by chosen ranks
  const filteredRows = useMemo(() => {
    if (selectedRanks.length === 0) return rows
    return rows.filter(r => {
      const memberRank = r.rank?.trim() || 'Unassigned'
      return selectedRanks.includes(memberRank)
    })
  }, [rows, selectedRanks])

  const toggleRank = (rank: string) => {
    setSelectedRanks(prev => {
      if (prev.includes(rank)) {
        return prev.filter(r => r !== rank)
      } else {
        return [...prev, rank]
      }
    })
  }

  const handleSelectAllRanks = () => {
    setSelectedRanks([])
  }

  const handleSelectOnlyRank = (rank: string) => {
    setSelectedRanks([rank])
  }

  // Evaluations state: memberId -> evaluation sentence
  const [evaluations, setEvaluations] = useState<Record<string, string>>({})
  // Feedback attribution map: memberId -> list of officer feedback
  const [officerFeedbackMap, setOfficerFeedbackMap] = useState<Record<string, OfficerSubmissionFeedback[]>>({})
  // Selected member to view detailed officer feedback breakdown
  const [viewingFeedbackMember, setViewingFeedbackMember] = useState<{
    memberId: string
    name: string
    feedback: OfficerSubmissionFeedback[]
  } | null>(null)

  // Event forms loading
  const [availableForms, setAvailableForms] = useState<EventForm[]>([])
  const [selectedFormId, setSelectedFormId] = useState<string>('')
  const [isLoadingForms, setIsLoadingForms] = useState(false)
  const [isConsolidating, setIsConsolidating] = useState(false)

  // Standard signature config
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

  // Load available forms & saved drafts on modal open
  useEffect(() => {
    if (!isOpen) return

    // Load available event forms
    const loadForms = async () => {
      try {
        setIsLoadingForms(true)
        const forms = await eventFormService.getAllForms()
        setAvailableForms(forms)
        if (forms.length > 0 && !selectedFormId) {
          // Default to first form or one with 'evaluation' in title
          const evalForm = forms.find(f => f.title.toLowerCase().includes('evaluat') || f.title.toLowerCase().includes('pastoral'))
          setSelectedFormId(evalForm?.id || forms[0]?.id || '')
        }
      } catch (err) {
        console.error('Failed to load event forms:', err)
      } finally {
        setIsLoadingForms(false)
      }
    }

    loadForms()

    // Restore draft from localStorage if present
    try {
      const saved = localStorage.getItem(storageDraftKey)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed && typeof parsed === 'object') {
          setEvaluations(parsed)
        }
      }
    } catch {
      // Ignore JSON parse errors
    }
  }, [isOpen, storageDraftKey])

  // Save evaluations draft to localStorage
  useEffect(() => {
    if (Object.keys(evaluations).length > 0) {
      try {
        localStorage.setItem(storageDraftKey, JSON.stringify(evaluations))
      } catch {
        // Ignore quota errors
      }
    }
  }, [evaluations, storageDraftKey])

  // Adjust document title and signatories when switching report type
  const handleReportTypeChange = (newType: 'standard' | 'pastoral_evaluation') => {
    setReportType(newType)
    if (newType === 'pastoral_evaluation') {
      setDocumentTitle('ALTAR SERVERS PASTORAL EVALUATION & ATTENDANCE REPORT')
      setSignatureConfig({
        enabled: true,
        signatories: [
          {
            id: 'eval-sig-1',
            label: 'Prepared by:',
            name: 'Bro. BENAIKA LORENZO PARONABLE',
            title: `Admin Officer, ${DEFAULT_MINISTRY_NAME}`,
            organization: DEFAULT_PARISH_NAME,
            column: 1
          },
          {
            id: 'eval-sig-2',
            label: 'Noted by:',
            name: 'Bro. KYLE VINCENT MADRIAGA',
            title: `Coordinator, ${DEFAULT_MINISTRY_NAME}`,
            organization: DEFAULT_PARISH_NAME,
            column: 2
          },
          {
            id: 'eval-sig-3',
            label: 'Received & Approved by:',
            name: 'REV. FR. ILDEFONSO DE GUZMAN JR.',
            title: 'Parish Priest / Spiritual Director',
            organization: DEFAULT_PARISH_NAME,
            column: 2
          }
        ]
      })

      // If evaluations are empty, pre-fill with smart presets
      if (Object.keys(evaluations).length === 0) {
        handleAutoFillSmartPresets()
      }
    } else {
      setDocumentTitle('Ministry of Altar Servers')
      setSignatureConfig({
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
    }
  }

  // Import evaluations from selected event form
  const handleImportFromForm = async () => {
    if (!selectedFormId) {
      toast.warning('No Form Selected', 'Please select an event form to import from.')
      return
    }

    try {
      setIsConsolidating(true)
      const [questions, responses, allMembers] = await Promise.all([
        eventFormQuestionService.getQuestionsByFormId(selectedFormId),
        eventFormResponseService.getResponsesByFormId(selectedFormId),
        memberService.getMembers()
      ])

      if (responses.length === 0) {
        toast.info('No Responses Found', 'The selected form does not have any submitted responses yet.')
        setIsConsolidating(false)
        return
      }

      // Build attendance map from rows
      const attendanceMap: Record<string, { rate: number; rank?: string }> = {}
      for (const r of rows) {
        attendanceMap[r.memberId] = { rate: r.rate, rank: r.rank }
      }

      const consolidated = consolidateFormEvaluations({
        questions,
        responses,
        members: allMembers,
        attendanceMap
      })

      if (consolidated.length === 0) {
        toast.warning(
          'No Member Matches',
          'Could not correlate form responses with active member records. Make sure the form includes a Member Selector question.'
        )
        setIsConsolidating(false)
        return
      }

      // Merge into evaluations map and feedback map
      const newEvals: Record<string, string> = { ...evaluations }
      const newFeedbackMap: Record<string, OfficerSubmissionFeedback[]> = { ...officerFeedbackMap }

      for (const item of consolidated) {
        newEvals[item.memberId] = item.synthesizedNarrative
        if (item.detailedOfficerFeedback.length > 0) {
          newFeedbackMap[item.memberId] = item.detailedOfficerFeedback
        }
      }

      setEvaluations(newEvals)
      setOfficerFeedbackMap(newFeedbackMap)

      toast.success(
        'Evaluations Consolidated',
        `Successfully imported and synthesized pastoral evaluations for ${consolidated.length} altar servers from ${responses.length} officer submissions.`
      )
    } catch (err: any) {
      console.error('Failed to consolidate evaluations:', err)
      toast.error('Import Failed', err.message || 'Could not process event form responses.')
    } finally {
      setIsConsolidating(false)
    }
  }

  // Auto-fill smart presets based on attendance rates
  const handleAutoFillSmartPresets = () => {
    const membersData = filteredRows.map(r => ({
      id: r.memberId,
      attendanceRate: r.rate,
      name: r.name
    }))
    const presets = generateSmartAttendancePresets(membersData)
    setEvaluations(prev => ({
      ...presets,
      ...prev // Preserve already customized entries
    }))
    toast.success('Smart Presets Applied', `Generated natural varied evaluations for ${filteredRows.length} altar servers based on attendance rates.`)
  }

  // Clear all evaluations
  const handleClearEvaluations = () => {
    setEvaluations({})
    setOfficerFeedbackMap({})
    localStorage.removeItem(storageDraftKey)
    toast.info('Draft Cleared', 'Reset all evaluations.')
  }

  const handleDownload = async () => {
    setIsGenerating(true)
    setErrorMsg(null)
    try {
      await downloadMembersReportPdf(filteredRows, {
        dateRange,
        documentTitle: documentTitle.trim() || 'Ministry of Altar Servers',
        signatureConfig: signatureConfig.enabled ? signatureConfig : undefined,
        paperSize,
        reportType,
        evaluationsMap: reportType === 'pastoral_evaluation' ? evaluations : undefined,
        selectedRanks: selectedRanks.length > 0 ? selectedRanks : undefined
      })
      onClose()
    } catch (err: any) {
      console.error('Failed to generate Member Masterlist PDF report:', err)
      setErrorMsg(err.message || 'Failed to generate PDF document.')
    } finally {
      setIsGenerating(false)
    }
  }

  // Count evaluated members in current filtered pool
  const evaluatedCount = useMemo(() => {
    return filteredRows.filter(r => !!evaluations[r.memberId]?.trim()).length
  }, [filteredRows, evaluations])

  const inactiveMembersCount = useMemo(() => {
    return filteredRows.filter(r => r.rate <= 10).length
  }, [filteredRows])

  if (!isOpen) return null

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={reportType === 'pastoral_evaluation' ? 'Export Pastoral Evaluation Report (for Parish Priest)' : 'Export Member Masterlist & Attendance PDF'}
      subtitle={
        reportType === 'pastoral_evaluation'
          ? 'Official pastoral assessment report with multi-officer evaluation consolidation, natural narrative sentences, and inactive highlighting'
          : 'Configure signatories, date range, and export official printable PDF document'
      }
      badge={reportType === 'pastoral_evaluation' ? 'Parish Priest Report' : 'PDF Export'}
      icon={
        <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      }
      maxWidth="3xl"
    >
      <div className="space-y-5 max-h-[80vh] overflow-y-auto pr-1 text-xs">
        {errorMsg && (
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 font-bold text-xs animate-fade-in">
            {errorMsg}
          </div>
        )}

        {/* 1. REPORT TYPE TOGGLE */}
        <div className="p-3.5 rounded-2xl bg-indigo-50/60 border border-indigo-200/80 space-y-2">
          <label className="block text-[10px] font-black uppercase tracking-wider text-indigo-900">
            Select Report Format
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleReportTypeChange('standard')}
              className={`p-3 text-left rounded-xl border transition-all cursor-pointer ${
                reportType === 'standard'
                  ? 'bg-white border-indigo-600 shadow-sm ring-2 ring-indigo-500/20'
                  : 'bg-indigo-50/40 border-indigo-100 hover:bg-white/80 text-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-slate-900">Standard Masterlist Report</span>
                {reportType === 'standard' && (
                  <span className="w-2 h-2 rounded-full bg-indigo-600" />
                )}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Full 10-column roster with detailed status, excused counts, and policy triggering absences.
              </p>
            </button>

            <button
              type="button"
              onClick={() => handleReportTypeChange('pastoral_evaluation')}
              className={`p-3 text-left rounded-xl border transition-all cursor-pointer ${
                reportType === 'pastoral_evaluation'
                  ? 'bg-white border-indigo-600 shadow-sm ring-2 ring-indigo-500/20'
                  : 'bg-indigo-50/40 border-indigo-100 hover:bg-white/80 text-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-indigo-950 flex items-center gap-1.5">
                  <span>Pastoral Evaluation Report</span>
                  <span className="bg-amber-100 text-amber-800 text-[9px] px-1.5 py-0.2 rounded-md font-black">Kura Paroko</span>
                </span>
                {reportType === 'pastoral_evaluation' && (
                  <span className="w-2 h-2 rounded-full bg-indigo-600" />
                )}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                8-column official assessment (Name, Rank, Present, Late, Absent, Rate %, Inactive rule &lt;= 10%, Evaluation sentence).
              </p>
            </button>
          </div>
        </div>

        {/* 2. RANK FILTER (KASAMA SA REPORT) */}
        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                <span>Filter by Rank (Kasama sa Report)</span>
              </label>
              <p className="text-[11px] text-slate-500">
                Piliin kung anong ranks lang ang isasama sa official document na ito.
              </p>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleSelectAllRanks}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                  selectedRanks.length === 0
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
                }`}
              >
                All Ranks ({rows.length})
              </button>
              {selectedRanks.length > 0 && (
                <button
                  type="button"
                  onClick={handleSelectAllRanks}
                  className="px-2 py-1 rounded-lg text-[10px] font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 transition cursor-pointer"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Rank Selection Chips */}
          <div className="flex flex-wrap gap-2 pt-0.5">
            {availableRanks.map(rank => {
              const count = rows.filter(r => (r.rank?.trim() || 'Unassigned') === rank).length
              const isSelected = selectedRanks.includes(rank)
              const isOnlyThisSelected = selectedRanks.length === 1 && selectedRanks[0] === rank

              return (
                <div
                  key={rank}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all select-none ${
                    isSelected
                      ? 'bg-blue-50/90 border-blue-400 text-blue-950 font-black shadow-2xs ring-1 ring-blue-400/40'
                      : selectedRanks.length === 0
                      ? 'bg-white border-slate-200 text-slate-800 font-bold hover:border-slate-300'
                      : 'bg-slate-100/60 border-slate-200 text-slate-400 font-normal hover:bg-white hover:text-slate-700'
                  }`}
                >
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedRanks.length === 0 || isSelected}
                      onChange={() => toggleRank(rank)}
                      className="h-3.5 w-3.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                    />
                    <span className="text-xs">{rank}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-bold ${
                      isSelected
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-slate-100 text-slate-500'
                    }`}>
                      {count}
                    </span>
                  </label>

                  {/* 1-click Quick "Only" button */}
                  {!isOnlyThisSelected && count > 0 && (
                    <button
                      type="button"
                      onClick={() => handleSelectOnlyRank(rank)}
                      className="text-[9px] font-bold text-slate-400 hover:text-blue-700 hover:underline cursor-pointer pl-1 border-l border-slate-200"
                      title={`Isama lang ang ${rank}`}
                    >
                      Only
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {/* Filter Status Summary */}
          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
            <span>
              Showing <strong className="text-slate-900 font-black">{filteredRows.length}</strong> of{' '}
              <strong className="text-slate-700">{rows.length}</strong> members
            </span>
            {selectedRanks.length > 0 && (
              <span className="font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
                Filtered: {selectedRanks.join(', ')}
              </span>
            )}
          </div>
        </div>

        {/* 3. PASTORAL EVALUATION WORKFLOW ACCELERATOR */}
        {reportType === 'pastoral_evaluation' && (
          <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/90 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-200/60 pb-2.5">
              <div>
                <h4 className="text-xs font-black text-amber-950 uppercase tracking-tight flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span>Automated Evaluation Workflow</span>
                </h4>
                <p className="text-[11px] text-amber-800/90 mt-0.5">
                  Consolidate multi-officer evaluations from Event Forms or generate smart presets instantly without writing sentences one-by-one.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="px-2 py-0.5 rounded-md bg-white border border-amber-300 text-amber-900 font-bold text-[11px]">
                  {evaluatedCount} of {filteredRows.length} Evaluated
                </span>
                {inactiveMembersCount > 0 && (
                  <span className="px-2 py-0.5 rounded-md bg-red-100 border border-red-200 text-red-700 font-bold text-[11px]" title="Rate <= 10% flagged as Inactive">
                    {inactiveMembersCount} Inactive (≤ 10%)
                  </span>
                )}
              </div>
            </div>

            {/* Event Form Import Bar */}
            <div className="space-y-2">
              <label className="block text-[10px] font-black uppercase tracking-wider text-amber-900">
                Option 1: Import from Officers Event Form
              </label>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="flex-1">
                  <CustomSelect
                    value={selectedFormId}
                    onChange={e => setSelectedFormId(e.target.value)}
                    disabled={isLoadingForms || availableForms.length === 0}
                    options={[
                      { value: '', label: isLoadingForms ? 'Loading forms...' : availableForms.length === 0 ? 'No event forms found' : '-- Select Evaluation Form --' },
                      ...availableForms.map(f => ({
                        value: f.id || '',
                        label: `${f.title} (${f.status})`
                      }))
                    ]}
                  />
                </div>
                <Button
                  type="button"
                  variant="primary"
                  size="dense"
                  onClick={handleImportFromForm}
                  loading={isConsolidating}
                  disabled={!selectedFormId || isLoadingForms}
                  icon={
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                  }
                >
                  Import & Consolidate
                </Button>
              </div>
            </div>

            {/* Quick Actions Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-amber-200/50">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-900">
                Option 2: Smart Presets
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAutoFillSmartPresets}
                  className="px-2.5 py-1 rounded-lg bg-white hover:bg-amber-100/60 text-amber-900 font-bold text-xs border border-amber-300 transition cursor-pointer flex items-center gap-1 shadow-2xs"
                  title="Generate varied natural evaluations based on attendance percentages"
                >
                  <svg className="w-3 h-3 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                  <span>Auto-Fill All Smart Presets</span>
                </button>

                {Object.keys(evaluations).length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearEvaluations}
                    className="px-2 py-1 rounded-lg bg-white/80 hover:bg-rose-50 text-rose-700 font-bold text-xs border border-rose-200 transition cursor-pointer"
                  >
                    Clear All
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 4. INTERACTIVE MEMBER EVALUATION REVIEW TABLE (PASTORAL MODE) */}
        {reportType === 'pastoral_evaluation' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600">
                Member Evaluations & Pastoral Remarks ({filteredRows.length} Altar Servers)
              </label>
              <span className="text-[10px] text-slate-500 font-semibold">
                Edits autosaved locally
              </span>
            </div>

            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white divide-y divide-slate-100 max-h-80 overflow-y-auto shadow-2xs">
              {filteredRows.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 italic">
                  No altar servers match the selected rank filter. Click "All Ranks" above to view all members.
                </div>
              ) : (
                filteredRows.map((r, idx) => {
                  const evalText = evaluations[r.memberId] || ''
                  const officerFeedback = officerFeedbackMap[r.memberId] || []
                  const isInactive = r.rate <= 10

                  return (
                    <div
                      key={r.memberId}
                      className={`p-3 space-y-2 transition-colors ${
                        isInactive ? 'bg-rose-50/60' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-md bg-slate-200/80 text-slate-700 font-black text-[10px] flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <span className="font-black text-slate-900 text-xs">{r.name}</span>
                          <span className="text-[10px] text-slate-500 font-bold bg-slate-100 px-1.5 py-0.5 rounded-md">
                            {r.rank || 'Server'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {isInactive ? (
                            <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 border border-rose-200 font-black text-[10px]">
                              {r.rate.toFixed(1)}% (Inactive)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[10px]">
                              {r.rate.toFixed(1)}% Attendance
                            </span>
                          )}

                          {officerFeedback.length > 0 && (
                            <button
                              type="button"
                              onClick={() =>
                                setViewingFeedbackMember({
                                  memberId: r.memberId,
                                  name: r.name,
                                  feedback: officerFeedback
                                })
                              }
                              className="px-2 py-0.5 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold text-[10px] transition cursor-pointer flex items-center gap-1"
                              title="Click to see what officers specifically said about this member"
                            >
                              <svg className="w-3 h-3 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                              <span>Evaluated by {officerFeedback.length} {officerFeedback.length === 1 ? 'Officer' : 'Officers'}</span>
                            </button>
                          )}
                        </div>
                      </div>

                      <textarea
                        value={evalText}
                        onChange={e => {
                          const val = e.target.value
                          setEvaluations(prev => ({
                            ...prev,
                            [r.memberId]: val
                          }))
                        }}
                        rows={2}
                        placeholder="Enter pastoral evaluation for the parish priest..."
                        className={`w-full p-2 text-xs rounded-xl border focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition-all ${
                          isInactive
                            ? 'border-rose-300 bg-white text-rose-950 font-medium'
                            : 'border-slate-200 bg-white text-slate-800'
                        }`}
                      />
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}

        {/* 5. REPORT OVERVIEW SETTINGS */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight">Report Details</h4>
              <p className="text-xs font-semibold text-slate-500 mt-0.5">
                Period: <span className="font-bold text-slate-700">{dateRange?.start || 'Start'}</span> to{' '}
                <span className="font-bold text-slate-700">{dateRange?.end || 'Present'}</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              {selectedRanks.length > 0 && (
                <span className="px-2 py-0.5 rounded-lg bg-blue-100 text-blue-800 text-[10px] font-bold border border-blue-200">
                  Ranks: {selectedRanks.join(', ')}
                </span>
              )}
              <span className="px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-black">
                {filteredRows.length} Members Listed
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
              placeholder="ALTAR SERVERS PASTORAL EVALUATION & ATTENDANCE REPORT"
              className="w-full p-2.5 text-xs font-bold border border-slate-200 rounded-xl bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition-all"
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

        {/* 6. DYNAMIC SIGNATURE CONFIGURATION */}
        <DynamicSignatureConfig
          value={signatureConfig}
          onChange={setSignatureConfig}
          defaultPresetName={reportType === 'pastoral_evaluation' ? 'Evaluation' : 'General'}
        />

        {/* 7. ACTION BUTTONS */}
        <div className="pt-3 border-t border-slate-100 flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 sm:gap-3 sticky bottom-0 bg-white [&>button]:w-full [&>button]:sm:w-auto">
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
            disabled={filteredRows.length === 0}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>Generate & Download PDF ({filteredRows.length})</span>
          </Button>
        </div>
      </div>

      {/* OFFICER FEEDBACK AUDIT MODAL (WHO EVALUATED & WHAT THEY SAID) */}
      {viewingFeedbackMember && (
        <Modal
          isOpen={!!viewingFeedbackMember}
          onClose={() => setViewingFeedbackMember(null)}
          title={`Officer Evaluations: ${viewingFeedbackMember.name}`}
          subtitle="Specific ratings and pastoral remarks submitted by ministry officers"
          badge="Audit View"
          maxWidth="lg"
        >
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1 text-xs">
            {viewingFeedbackMember.feedback.map((fb, fbIdx) => (
              <div key={fb.responseId || fbIdx} className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <div>
                    <span className="font-black text-slate-900 text-xs">{fb.officerName}</span>
                    {fb.submittedAt && (
                      <span className="text-[10px] text-slate-400 block">
                        Submitted: {new Date(fb.submittedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  {fb.overallRating > 0 && (
                    <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 font-black text-xs border border-amber-200">
                      ★ {fb.overallRating.toFixed(1)} / 5.0
                    </span>
                  )}
                </div>

                {/* Ratings Breakdown */}
                {fb.ratings.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                      Ratings:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {fb.ratings.map(r => (
                        <div key={r.questionId} className="p-2 rounded-xl bg-white border border-slate-200/80 flex items-center justify-between text-[11px]">
                          <span className="text-slate-700 truncate mr-2" title={r.questionText}>{r.questionText}</span>
                          <span className="font-black text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-100">
                            {r.score}/{r.maxScore}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Remarks Breakdown */}
                {fb.remarks.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                      Officer Remarks:
                    </span>
                    <div className="space-y-1">
                      {fb.remarks.map((rem, rIdx) => (
                        <div key={rIdx} className="p-2.5 rounded-xl bg-white border border-slate-200/80 text-slate-800 text-xs italic">
                          &quot;{rem}&quot;
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}

            <div className="pt-2 flex justify-end">
              <Button
                type="button"
                variant="secondary"
                size="dense"
                onClick={() => setViewingFeedbackMember(null)}
              >
                Close Breakdown
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </Modal>
  )
}
