import React, { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { EventForm, EventFormQuestion, EventFormResponse, CompanionEntry, AppointmentSlotAnswer } from '@/types/eventForm'
import type { Member } from '@/types/member'
import { ORDER_GROUPS } from '@/types/member'
import { eventFormQuestionService } from '@/services/eventFormQuestionService'
import { eventFormResponseService } from '@/services/eventFormResponseService'
import { memberService } from '@/services/memberService'
import { ConfirmModal } from '@/components/Dialog'
import { Button, CustomSelect, ActionMenu } from '@/components'
import { useToast } from '@/context/ToastContext'
import { downloadEventFormPdf } from '@/utils/eventFormPdfReport'
import { EditFormResponseModal } from './EditFormResponseModal'
import { DynamicSignatureConfig } from '@/components/signatures/DynamicSignatureConfig'
import type { SignatureConfig } from '@/types/signature'
import { DEFAULT_MINISTRY_NAME, DEFAULT_PARISH_NAME } from '@/types/signature'
import { formatContactNumber } from '@/utils/contactNumberHelper'

interface EventFormResponsesModalProps {
  isOpen: boolean
  onClose: () => void
  form: EventForm
}

export const EventFormResponsesModal: React.FC<EventFormResponsesModalProps> = ({
  isOpen,
  onClose,
  form
}) => {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [questions, setQuestions] = useState<EventFormQuestion[]>([])
  const [responses, setResponses] = useState<EventFormResponse[]>([])
  const [membersList, setMembersList] = useState<Member[]>([])
  const [membersMap, setMembersMap] = useState<Record<string, string>>({})
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState<'responded' | 'pending' | 'all'>('responded')
  const [orderFilter, setOrderFilter] = useState<string>('all')
  const [appointmentSlotFilter, setAppointmentSlotFilter] = useState<string>('all')
  const [selectedResponse, setSelectedResponse] = useState<EventFormResponse | null>(null)
  const [responseToEdit, setResponseToEdit] = useState<EventFormResponse | null>(null)
  const [responseToDelete, setResponseToDelete] = useState<EventFormResponse | null>(null)
  const [deleting, setDeleting] = useState(false)

  // PDF Export Modal Options State
  const [exportPdfModalOpen, setExportPdfModalOpen] = useState(false)
  const [pdfTitle, setPdfTitle] = useState('')
  const [pdfOrientation, setPdfOrientation] = useState<'landscape' | 'portrait'>('landscape')
  const [pdfSelectedQuestionIds, setPdfSelectedQuestionIds] = useState<string[]>([])
  const [pdfColumnLabels, setPdfColumnLabels] = useState<Record<string, string>>({})
  const [pdfFilterQuestionId, setPdfFilterQuestionId] = useState('')
  const [pdfFilterValue, setPdfFilterValue] = useState('')
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const [pdfSignatureConfig, setPdfSignatureConfig] = useState<SignatureConfig>({
    enabled: false,
    signatories: [
      {
        id: 'ev-sig-1',
        label: 'Prepared by:',
        name: 'Bro. BENAIKA LORENZO PARONABLE',
        title: `Admin Officer, ${DEFAULT_MINISTRY_NAME}`,
        organization: DEFAULT_PARISH_NAME,
        column: 1
      },
      {
        id: 'ev-sig-2',
        label: 'Noted by:',
        name: 'Bro. KYLE VINCENT MADRIAGA',
        title: `Coordinator, ${DEFAULT_MINISTRY_NAME}`,
        organization: DEFAULT_PARISH_NAME,
        column: 2
      }
    ]
  })

  const fetchData = async () => {
    if (!form.id) return
    setLoading(true)
    try {
      const [qs, rs, mems] = await Promise.all([
        queryClient.fetchQuery({
          queryKey: ['event-form-questions', form.id],
          queryFn: () => eventFormQuestionService.getQuestionsByFormId(form.id!),
          staleTime: 1000 * 60 * 3
        }),
        queryClient.fetchQuery({
          queryKey: ['event-form-responses', form.id],
          queryFn: () => eventFormResponseService.getResponsesByFormId(form.id!),
          staleTime: 1000 * 30
        }),
        queryClient.fetchQuery({
          queryKey: ['members', 'all'],
          queryFn: () => memberService.getMembers(true),
          staleTime: 1000 * 60 * 5
        })
      ])

      const map: Record<string, string> = {}
      mems.forEach(m => {
        map[m.id] = `${m.lastName}, ${m.firstName}${m.order ? ` (${m.order})` : ''}`
      })

      const sortedQs = [...qs].sort((a, b) => a.order - b.order)

      setQuestions(qs)
      setResponses(rs)
      setMembersList(mems)
      setMembersMap(map)

      // Initialize default PDF export settings
      setPdfTitle(`${form.title.toUpperCase()} REPORT`)
      setPdfSelectedQuestionIds(['respondent_name', ...sortedQs.map(q => q.id)])
      const defaultLabels: Record<string, string> = { respondent_name: 'Member / Respondent' }
      sortedQs.forEach(q => {
        defaultLabels[q.id] = q.question
      })
      setPdfColumnLabels(defaultLabels)
    } catch (err) {
      console.error('Failed to load form responses:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) fetchData()
  }, [isOpen, form.id, queryClient])

  if (!isOpen) return null

  const hasTargetMembers = questions.some(q => q.type === 'member_selector')

  const appointmentQuestions = questions.filter(
    q => q.type === 'appointment_slots' && q.appointmentConfig && q.appointmentConfig.length > 0
  )

  const formatQuestionAnswer = (q: EventFormQuestion, val: any): string => {
    if (val === undefined || val === null || val === '') return '-'

    if (q.type === 'appointment_slots') {
      if (typeof val === 'object' && val.date && val.timeRange) {
        const slotAns = val as AppointmentSlotAnswer
        const dateText = slotAns.dateLabel ? `${slotAns.dateLabel} (${slotAns.date})` : slotAns.date
        const labelText = slotAns.slotLabel ? ` [${slotAns.slotLabel}]` : ''
        return `${dateText} • ${slotAns.timeRange}${labelText}`
      }
      return String(val)
    }

    if (q.type === 'contact_number') {
      return formatContactNumber(String(val))
    }

    if (q.type === 'companion_repeater' && Array.isArray(val)) {
      return (val as unknown as CompanionEntry[])
        .map(c => `${c.name}${c.relationship ? ` (${c.relationship})` : ''}${c.notes ? ` - ${c.notes}` : ''}`)
        .join('; ')
    }

    if (q.type === 'member_selector' && typeof val === 'string') {
      return membersMap[val] || val
    }

    if (typeof val === 'string' && membersMap[val]) {
      return membersMap[val]
    }

    return Array.isArray(val) ? val.join(', ') : String(val)
  }

  const matchesSlotFilter = (r: EventFormResponse | undefined): boolean => {
    if (appointmentSlotFilter === 'all') return true
    if (!r || !r.answers) return false
    const [filterQId, filterDate, filterSlotId] = appointmentSlotFilter.split('::')
    const ans = r.answers[filterQId] as unknown as AppointmentSlotAnswer | undefined
    if (!ans || typeof ans !== 'object') return false
    return ans.date === filterDate && ans.slotId === filterSlotId
  }

  // Find form target member filter from member_selector question if present
  const memberSelectorQ = questions.find(q => q.type === 'member_selector' && q.memberFilterType && q.memberFilterType !== 'all')

  // Determine eligible members list matching the form's target audience
  const eligibleMembersList = hasTargetMembers
    ? membersList.filter(member => {
        if (!memberSelectorQ) return true
        const filterType = memberSelectorQ.memberFilterType
        const filterValue = memberSelectorQ.memberFilterValue
        if (!filterValue) return true

        const allowed = Array.isArray(filterValue) ? filterValue : [filterValue]

        if (filterType === 'order') {
          return !!member.order && allowed.includes(member.order)
        }
        if (filterType === 'rank') {
          return !!member.rank && allowed.includes(member.rank)
        }
        return true
      })
    : []

  // Map of memberId to response (if member submitted)
  const respondedMemberIds = new Set<string>()
  responses.forEach(r => {
    if (r.respondentMemberUid) {
      respondedMemberIds.add(r.respondentMemberUid)
    }
  })

  // Determine member list with response status
  const memberRows = eligibleMembersList.map(member => {
    const memberName = `${member.lastName}, ${member.firstName}`
    const response = responses.find(r => r.respondentMemberUid === member.id)
    const hasResponded = !!response
    return {
      member,
      memberName,
      hasResponded,
      response
    }
  })

  // Filter members based on order filter, tab filter, appointment slot filter, and search term
  const filteredMemberRows = memberRows.filter(row => {
    // 1. Order / Group Filter
    if (orderFilter !== 'all') {
      const memOrder = row.member.order || ''
      const memPosition = row.member.position || ''
      if (orderFilter === 'Officers') {
        const isOfficer = memOrder.toLowerCase().includes('officer') || 
                          memPosition.toLowerCase().includes('officer') ||
                          (memPosition && !memPosition.toLowerCase().includes('member'))
        if (!isOfficer) return false
      } else {
        if (!memOrder.toLowerCase().includes(orderFilter.toLowerCase())) return false
      }
    }

    // 2. Tab Filter (responded vs pending vs all)
    if (activeTab === 'responded' && !row.hasResponded) return false
    if (activeTab === 'pending' && row.hasResponded) return false

    // 3. Appointment Slot Filter
    if (appointmentSlotFilter !== 'all') {
      if (!row.hasResponded || !matchesSlotFilter(row.response)) return false
    }

    // 4. Search term
    const term = searchTerm.toLowerCase()
    if (!term) return true

    const nameMatch = row.memberName.toLowerCase().includes(term) ||
                      (row.member.firstName || '').toLowerCase().includes(term) ||
                      (row.member.lastName || '').toLowerCase().includes(term)
    const orderMatch = (row.member.order || '').toLowerCase().includes(term)
    const posMatch = (row.member.position || '').toLowerCase().includes(term)

    let answerMatch = false
    if (row.response) {
      answerMatch = Object.values(row.response.answers).some(val =>
        String(val).toLowerCase().includes(term)
      ) || (row.response.trackingNumber || '').toLowerCase().includes(term)
    }

    return nameMatch || orderMatch || posMatch || answerMatch
  })

  // Also handle non-member / guest responses in 'responded' or 'all' tab if applicable
  const guestResponses = responses.filter(r => !r.respondentMemberUid || !membersMap[r.respondentMemberUid])
  const filteredGuestResponses = guestResponses.filter(r => {
    if (activeTab === 'pending') return false
    if (!matchesSlotFilter(r)) return false
    const term = searchTerm.toLowerCase()
    if (!term) return true
    const trackingMatch = (r.trackingNumber || '').toLowerCase().includes(term)
    const nameMatch = (r.respondentMemberName || '').toLowerCase().includes(term)
    const emailMatch = (r.respondentEmail || '').toLowerCase().includes(term)
    const answerMatch = Object.values(r.answers).some(val =>
      String(val).toLowerCase().includes(term)
    )
    return trackingMatch || nameMatch || emailMatch || answerMatch
  })

  // Filter general submissions when there is no target member selector
  const filteredGeneralResponses = responses.filter(r => {
    if (!matchesSlotFilter(r)) return false
    const term = searchTerm.toLowerCase().trim()
    if (!term) return true
    const nameMatch = (r.respondentMemberName || '').toLowerCase().includes(term)
    const emailMatch = (r.respondentEmail || '').toLowerCase().includes(term)
    const answerMatch = Object.values(r.answers).some(val =>
      String(val).toLowerCase().includes(term)
    )
    return nameMatch || emailMatch || answerMatch
  })

  const totalRespondedCount = responses.length
  const totalPendingCount = eligibleMembersList.length - respondedMemberIds.size

  const activeFilteredResponses = hasTargetMembers
    ? [
        ...filteredMemberRows.map(r => r.response).filter((r): r is EventFormResponse => !!r),
        ...filteredGuestResponses
      ]
    : filteredGeneralResponses

  const handleExportCSV = () => {
    try {
      eventFormResponseService.exportResponsesToCSV(form, questions, activeFilteredResponses)
      toast.success('Export Started', 'Form responses have been exported to CSV.')
    } catch (err: any) {
      toast.error('Export Failed', err.message || 'Failed to export CSV.')
    }
  }

  const handleGeneratePdf = async () => {
    setGeneratingPdf(true)
    try {
      await downloadEventFormPdf(form, questions, responses, {
        documentTitle: pdfTitle || form.title.toUpperCase(),
        selectedQuestionIds: pdfSelectedQuestionIds,
        columnCustomLabels: pdfColumnLabels,
        filterQuestionId: pdfFilterQuestionId || undefined,
        filterValue: pdfFilterValue || undefined,
        orientation: pdfOrientation,
        membersMap,
        signatureConfig: pdfSignatureConfig.enabled ? pdfSignatureConfig : undefined
      })
      setExportPdfModalOpen(false)
      toast.success('PDF Generated', 'Form responses report has been downloaded.')
    } catch (err: any) {
      console.error('Failed to generate PDF report:', err)
      toast.error('PDF Generation Failed', err.message || 'Could not generate report.')
    } finally {
      setGeneratingPdf(false)
    }
  }

  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false)
  const [deletingAll, setDeletingAll] = useState(false)

  const handleDeleteResponse = async () => {
    if (!responseToDelete?.id) return
    setDeleting(true)
    try {
      await eventFormResponseService.deleteResponse(responseToDelete.id)
      if (form.id) {
        await queryClient.invalidateQueries({ queryKey: ['event-form-responses', form.id] })
        await queryClient.invalidateQueries({ queryKey: ['event-form-response-counts'] })
      }
      setResponseToDelete(null)
      await fetchData()
      toast.success('Response Deleted', 'Form response has been successfully deleted.')
    } catch (err: any) {
      console.error('Failed to delete response:', err)
      toast.error('Delete Failed', err.message || 'Failed to delete response.')
    } finally {
      setDeleting(false)
    }
  }

  const handleDeleteAllResponses = async () => {
    if (!form.id) return
    setDeletingAll(true)
    try {
      await eventFormResponseService.deleteAllResponsesByFormId(form.id)
      await queryClient.invalidateQueries({ queryKey: ['event-form-responses', form.id] })
      await queryClient.invalidateQueries({ queryKey: ['event-form-response-counts'] })
      setShowDeleteAllConfirm(false)
      await fetchData()
      toast.success('All Responses Deleted', 'All submitted responses have been removed.')
    } catch (err: any) {
      console.error('Failed to delete all responses:', err)
      toast.error('Delete Failed', err.message || 'Failed to delete responses.')
    } finally {
      setDeletingAll(false)
    }
  }

  const togglePdfColumn = (colId: string) => {
    setPdfSelectedQuestionIds(prev =>
      prev.includes(colId) ? prev.filter(id => id !== colId) : [...prev, colId]
    )
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-6xl h-[94vh] sm:h-[88vh] rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200/80 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 bg-white border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-extrabold text-sm shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                  Submissions
                </span>
                <h2 className="text-sm sm:text-base md:text-lg font-black text-slate-900 tracking-tight truncate max-w-xs sm:max-w-md">
                  {form.title}
                </h2>
                <span className="px-2 py-0.5 text-xs font-black bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100 font-mono">
                  {responses.length} Total
                </span>
              </div>
              <p className="text-[11px] sm:text-xs font-semibold text-slate-500 mt-0.5 line-clamp-1">
                Inspect dynamic submissions, generate PDF reports, or export to CSV.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 justify-end">
            <Button
              variant="primary"
              size="xs"
              className="sm:text-xs px-2.5 sm:px-3.5 py-1.5"
              onClick={() => setExportPdfModalOpen(true)}
              disabled={responses.length === 0}
            >
              Export PDF
            </Button>
            <Button
              variant="secondary"
              size="xs"
              className="sm:text-xs px-2.5 sm:px-3.5 py-1.5"
              onClick={handleExportCSV}
              disabled={responses.length === 0}
            >
              Export CSV
            </Button>
            <Button
              variant="danger"
              size="xs"
              className="sm:text-xs px-2.5 sm:px-3.5 py-1.5"
              onClick={() => setShowDeleteAllConfirm(true)}
              disabled={responses.length === 0}
            >
              Delete All
            </Button>
            <Button
              variant="secondary"
              size="xs"
              className="sm:text-xs px-2.5 sm:px-3.5 py-1.5"
              onClick={onClose}
            >
              Close
            </Button>
          </div>
        </div>

        {/* Sub-Header / Status & Filter Bar */}
        <div className="px-4 sm:px-6 py-3 bg-white border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {hasTargetMembers ? (
            <>
              {/* Status Tabs */}
              <div className="w-full lg:w-auto bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                {[
                  { key: 'all', label: 'All Target Members', count: eligibleMembersList.length },
                  { key: 'responded', label: 'Responded', count: totalRespondedCount },
                  { key: 'pending', label: 'Not Yet Answered', count: totalPendingCount }
                ].map((t) => {
                  const isActive = activeTab === t.key
                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setActiveTab(t.key as any)}
                      className={`inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-1.5 text-[11px] sm:text-xs font-bold rounded-xl transition-all duration-200 shrink-0 cursor-pointer ${
                        isActive
                          ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/25 ring-1 ring-blue-700/20'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
                      }`}
                    >
                      <span className="whitespace-nowrap">{t.label}</span>
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black leading-none ${
                        isActive ? 'bg-white text-blue-700' : 'bg-slate-200 text-slate-700'
                      }`}>
                        {t.count}
                      </span>
                    </button>
                  )
                })}
              </div>

                {/* Search & Order Filter Controls */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full lg:w-auto">
                  {/* Appointment Slot Filter Dropdown */}
                  {appointmentQuestions.length > 0 && (
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <span className="text-xs font-bold text-slate-500 whitespace-nowrap shrink-0">Slot:</span>
                      <CustomSelect
                        value={appointmentSlotFilter}
                        onChange={e => setAppointmentSlotFilter(e.target.value)}
                        options={[
                          { value: 'all', label: 'All Scheduled Slots' },
                          ...appointmentQuestions.flatMap(q =>
                            (q.appointmentConfig || []).flatMap(dateCfg =>
                              dateCfg.slots.map(slot => ({
                                value: `${q.id}::${dateCfg.date}::${slot.id}`,
                                label: `${dateCfg.label ? `${dateCfg.label}: ` : `${dateCfg.date}: `}${slot.startTime}-${slot.endTime}${slot.label ? ` (${slot.label})` : ''}`
                              }))
                            )
                          )
                        ]}
                        className="w-full sm:w-56"
                      />
                    </div>
                  )}

                  {/* Order Filter Dropdown */}
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <span className="text-xs font-bold text-slate-500 whitespace-nowrap shrink-0">Group:</span>
                    <CustomSelect
                      value={orderFilter}
                      onChange={e => setOrderFilter(e.target.value)}
                      options={[
                        { value: 'all', label: 'All Groups' },
                        ...ORDER_GROUPS.map(og => ({ value: og, label: og }))
                      ]}
                      className="w-full sm:w-44"
                    />
                  </div>

                  {/* Search Input */}
                  <input
                    type="text"
                    placeholder="Search member, order, answer..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full sm:w-60 p-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>
              </>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold">
                    All Responses ({filteredGeneralResponses.length})
                  </span>

                  {appointmentQuestions.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-500 whitespace-nowrap">Slot:</span>
                      <CustomSelect
                        value={appointmentSlotFilter}
                        onChange={e => setAppointmentSlotFilter(e.target.value)}
                        options={[
                          { value: 'all', label: 'All Scheduled Slots' },
                          ...appointmentQuestions.flatMap(q =>
                            (q.appointmentConfig || []).flatMap(dateCfg =>
                              dateCfg.slots.map(slot => ({
                                value: `${q.id}::${dateCfg.date}::${slot.id}`,
                                label: `${dateCfg.label ? `${dateCfg.label}: ` : `${dateCfg.date}: `}${slot.startTime}-${slot.endTime}${slot.label ? ` (${slot.label})` : ''}`
                              }))
                            )
                          )
                        ]}
                        className="w-48 sm:w-56"
                      />
                    </div>
                  )}
                </div>

                {/* Search Input */}
                <input
                  type="text"
                  placeholder="Search responses by name, email, answer..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full sm:w-72 p-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>
            )}
          </div>

          {/* Content Table */}
          <div className="flex-1 overflow-auto p-6 bg-slate-50">
            {/* Appointment Schedule & Real-Time Slot Occupancy Overview */}
            {!loading && appointmentQuestions.length > 0 && (
              <div className="mb-5 bg-white p-4.5 rounded-2xl border border-indigo-200/80 shadow-xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-100 pb-2.5">
                  <div className="flex items-center space-x-2">
                    <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </span>
                    <div>
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                        Appointment & Time Slot Booking Capacity
                      </h4>
                      <span className="text-[11px] text-slate-500 font-medium">
                        Click any slot to filter responses roster
                      </span>
                    </div>
                  </div>
                  {appointmentSlotFilter !== 'all' && (
                    <button
                      type="button"
                      onClick={() => setAppointmentSlotFilter('all')}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 underline self-start sm:self-auto cursor-pointer"
                    >
                      Clear Slot Filter
                    </button>
                  )}
                </div>

                <div className="space-y-4">
                  {appointmentQuestions.map(q => (
                    <div key={q.id} className="space-y-3">
                      <span className="text-xs font-bold text-indigo-900 block">{q.question}</span>
                      <div className="space-y-3">
                        {(q.appointmentConfig || []).map(dateCfg => {
                          const totalBookingsForDate = responses.filter(r => {
                            const ans = r.answers?.[q.id] as unknown as AppointmentSlotAnswer | undefined
                            return ans?.date === dateCfg.date
                          }).length

                          return (
                            <div key={dateCfg.id} className="bg-slate-50/60 p-3 rounded-xl border border-slate-200/80 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                                  <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                  <span>{dateCfg.label ? `${dateCfg.label} (${dateCfg.date})` : dateCfg.date}</span>
                                </span>
                                <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                                  {totalBookingsForDate} Booked Total
                                </span>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                                {dateCfg.slots.map(slot => {
                                  const filterKey = `${q.id}::${dateCfg.date}::${slot.id}`
                                  const isActive = appointmentSlotFilter === filterKey

                                  const bookedCount = responses.filter(r => {
                                    const ans = r.answers?.[q.id] as unknown as AppointmentSlotAnswer | undefined
                                    return ans?.date === dateCfg.date && ans?.slotId === slot.id
                                  }).length

                                  const maxCap = slot.maxCapacity || 0
                                  const hasCap = maxCap > 0
                                  const openSlots = hasCap ? Math.max(0, maxCap - bookedCount) : null
                                  const percent = hasCap ? Math.min(100, Math.round((bookedCount / maxCap) * 100)) : 0
                                  const isFull = hasCap && openSlots === 0

                                  return (
                                    <button
                                      key={slot.id}
                                      type="button"
                                      onClick={() => setAppointmentSlotFilter(isActive ? 'all' : filterKey)}
                                      className={`p-2.5 rounded-xl border transition cursor-pointer text-left ${
                                        isActive
                                          ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm ring-2 ring-indigo-400/50'
                                          : isFull
                                          ? 'bg-rose-50/60 border-rose-200 hover:border-rose-300'
                                          : openSlots !== null && openSlots <= 3
                                          ? 'bg-amber-50/60 border-amber-200 hover:border-amber-300'
                                          : 'bg-white border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30'
                                      }`}
                                    >
                                      <div className="flex items-center justify-between mb-1">
                                        <span className={`font-black text-xs truncate max-w-[130px] ${isActive ? 'text-white' : 'text-slate-900'}`}>
                                          {slot.startTime} - {slot.endTime}
                                        </span>
                                        {hasCap ? (
                                          isFull ? (
                                            <span className={`text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white text-rose-700' : 'bg-rose-100 text-rose-700 border border-rose-200'}`}>
                                              FULL
                                            </span>
                                          ) : (
                                            <span
                                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${
                                                isActive
                                                  ? 'bg-indigo-700 text-white border-indigo-500'
                                                  : openSlots! <= 3
                                                  ? 'bg-amber-100 text-amber-800 border-amber-200'
                                                  : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                              }`}
                                            >
                                              {openSlots} left
                                            </span>
                                          )
                                        ) : (
                                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isActive ? 'bg-indigo-700 text-indigo-100' : 'bg-slate-200 text-slate-700'}`}>
                                            Unlimited
                                          </span>
                                        )}
                                      </div>

                                      {slot.label && (
                                        <div className={`text-[11px] truncate font-medium mb-1 ${isActive ? 'text-indigo-100' : 'text-slate-600'}`}>
                                          {slot.label}
                                        </div>
                                      )}

                                      {hasCap && (
                                        <div className="mt-1">
                                          <div className={`w-full h-1.5 rounded-full overflow-hidden mb-1 ${isActive ? 'bg-indigo-800' : 'bg-slate-200'}`}>
                                            <div
                                              className={`h-full rounded-full transition-all duration-300 ${
                                                isActive
                                                  ? 'bg-white'
                                                  : isFull
                                                  ? 'bg-rose-500'
                                                  : percent >= 75
                                                  ? 'bg-amber-500'
                                                  : 'bg-emerald-500'
                                              }`}
                                              style={{ width: `${percent}%` }}
                                            />
                                          </div>
                                          <div className={`flex items-center justify-between text-[10px] font-medium ${isActive ? 'text-indigo-100' : 'text-slate-500'}`}>
                                            <span>{bookedCount} / {maxCap}</span>
                                            <span>{percent}%</span>
                                          </div>
                                        </div>
                                      )}

                                      {!hasCap && (
                                        <div className={`text-[10px] font-medium mt-1 ${isActive ? 'text-indigo-100' : 'text-slate-500'}`}>
                                          {bookedCount} booked
                                        </div>
                                      )}
                                    </button>
                                  )
                                })}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          {/* Category Slot Capacity & Open Slots Overview */}
          {!loading && questions.some(q => q.optionLimits && Object.keys(q.optionLimits).length > 0) && (
            <div className="mb-5 bg-white p-4.5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center space-x-2">
                  <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </span>
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                    Category Slot Capacity & Availability Overview
                  </h4>
                </div>
                <span className="text-[11px] text-slate-400 font-semibold">Real-time slot count</span>
              </div>

              <div className="space-y-4">
                {questions
                  .filter(q => q.optionLimits && Object.keys(q.optionLimits).length > 0)
                  .map(q => (
                    <div key={q.id} className="space-y-2">
                      <span className="text-xs font-bold text-slate-700 block">{q.question}</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                        {(q.options || []).map((opt, oIdx) => {
                          const maxSlots = q.optionLimits?.[opt] || 0
                          if (maxSlots <= 0) return null

                          const usedCount = responses.filter(r => {
                            const ans = r.answers?.[q.id]
                            if (Array.isArray(ans)) return ans.includes(opt)
                            return ans === opt
                          }).length

                          const openSlots = Math.max(0, maxSlots - usedCount)
                          const percent = Math.min(100, Math.round((usedCount / maxSlots) * 100))
                          const isFull = openSlots <= 0

                          return (
                            <div
                              key={oIdx}
                              className={`p-3 rounded-xl border transition ${
                                isFull
                                  ? 'bg-rose-50/60 border-rose-200'
                                  : openSlots <= 3
                                  ? 'bg-amber-50/60 border-amber-200'
                                  : 'bg-slate-50 border-slate-200'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="font-bold text-xs text-slate-900 truncate max-w-[140px]" title={opt}>
                                  {opt}
                                </span>
                                {isFull ? (
                                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200">
                                    FULL
                                  </span>
                                ) : (
                                  <span
                                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                      openSlots <= 3
                                        ? 'bg-amber-100 text-amber-800 border-amber-200'
                                        : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                    }`}
                                  >
                                    {openSlots} open left
                                  </span>
                                )}
                              </div>

                              {/* Progress Bar */}
                              <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden mb-1">
                                <div
                                  className={`h-full rounded-full transition-all duration-300 ${
                                    isFull
                                      ? 'bg-rose-500'
                                      : percent >= 75
                                      ? 'bg-amber-500'
                                      : 'bg-emerald-500'
                                  }`}
                                  style={{ width: `${percent}%` }}
                                />
                              </div>

                              <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium">
                                <span>{usedCount} / {maxSlots} filled</span>
                                <span>{percent}%</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {loading ? (
            <div className="p-12 text-center text-xs font-semibold text-slate-500">Loading form responses...</div>
          ) : hasTargetMembers ? (
            filteredMemberRows.length === 0 && filteredGuestResponses.length === 0 ? (
              <div className="p-8 sm:p-12 text-center text-slate-500 bg-white rounded-2xl border border-slate-200">
                <p className="text-sm font-bold">No records found</p>
                <p className="text-xs mt-1 text-slate-400">Try adjusting your status tab, order filter, or search keywords.</p>
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden md:block bg-white border border-slate-200 rounded-2xl overflow-x-auto shadow-xs">
                  <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
                    <thead>
                      <tr className="bg-slate-100/70 text-slate-700 font-bold border-b border-slate-200">
                        <th className="p-3.5">Member / Respondent</th>
                        <th className="p-3.5">Order / Group</th>
                        <th className="p-3.5">Status</th>
                        {questions.map(q => (
                          <th key={q.id} className="p-3.5 min-w-[180px] max-w-[320px] whitespace-normal" title={q.question}>
                            {q.question}
                          </th>
                        ))}
                        <th className="p-3.5">Submitted At</th>
                        <th className="p-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {/* Render Member Rows */}
                      {filteredMemberRows.map(row => {
                        const r = row.response
                        const submittedDateStr = r?.submittedAt && typeof r.submittedAt === 'object' && 'seconds' in r.submittedAt
                          ? new Date((r.submittedAt as any).seconds * 1000).toLocaleString()
                          : String(r?.submittedAt || '-')

                        return (
                          <tr key={row.member.id} className="hover:bg-slate-50 transition-colors group">
                            <td className="p-3.5 font-bold text-slate-900">
                              {row.memberName}
                            </td>
                            <td className="p-3.5 font-medium text-slate-600">
                              {row.member.order || row.member.position || '-'}
                            </td>
                            <td className="p-3.5">
                              {row.hasResponded ? (
                                <span className="px-2.5 py-1 text-[11px] font-bold bg-emerald-100 text-emerald-800 rounded-full inline-flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                  Responded
                                </span>
                              ) : (
                                <span className="px-2.5 py-1 text-[11px] font-bold bg-amber-100 text-amber-800 rounded-full inline-flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                  Not Yet Answered
                                </span>
                              )}
                            </td>

                            {/* Question Answers */}
                            {questions.map(q => {
                              if (!r) {
                                return <td key={q.id} className="p-3.5 text-slate-300 italic">-</td>
                              }
                              const val = r.answers[q.id]
                              const displayVal = formatQuestionAnswer(q, val)
                              return (
                                <td key={q.id} className="p-3.5 min-w-[180px] max-w-[320px] whitespace-normal break-words" title={displayVal}>
                                  {displayVal}
                                </td>
                              )
                            })}

                            <td className="p-3.5 text-slate-500">{r ? submittedDateStr : '-'}</td>
                            <td className="p-3.5 text-right">
                              {r ? (
                                <ActionMenu
                                  triggerVariant="meatball"
                                  tooltip="Response Options"
                                  size="xs"
                                  items={[
                                    {
                                      label: 'View Details',
                                      icon: (
                                        <svg className="w-3.5 h-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                      ),
                                      onClick: () => setSelectedResponse(r)
                                    },
                                    {
                                      label: 'Edit Response',
                                      icon: (
                                        <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                      ),
                                      onClick: () => setResponseToEdit(r)
                                    },
                                    {
                                      label: 'Delete Response',
                                      variant: 'danger',
                                      icon: (
                                        <svg className="w-3.5 h-3.5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                      ),
                                      onClick: () => setResponseToDelete(r)
                                    }
                                  ]}
                                />
                              ) : (
                                <span className="text-slate-400 text-[11px] italic">No submission</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}

                      {/* Guest Responses if any */}
                      {filteredGuestResponses.map(r => {
                        const submittedDateStr = r.submittedAt && typeof r.submittedAt === 'object' && 'seconds' in r.submittedAt
                          ? new Date((r.submittedAt as any).seconds * 1000).toLocaleString()
                          : String(r.submittedAt || '-')

                        return (
                          <tr key={r.id || Math.random()} className="hover:bg-slate-50 transition-colors group bg-slate-50/50">
                            <td className="p-3.5 font-bold text-slate-900">
                              {r.respondentMemberName || 'Guest / Non-Member'}
                            </td>
                            <td className="p-3.5 font-medium text-slate-400 italic">Guest</td>
                            <td className="p-3.5">
                              <span className="px-2.5 py-1 text-[11px] font-bold bg-blue-100 text-blue-800 rounded-full inline-flex items-center gap-1">
                                Responded
                              </span>
                            </td>
                            {questions.map(q => {
                              const val = r.answers[q.id]
                              const displayVal = formatQuestionAnswer(q, val)
                              return (
                                <td key={q.id} className="p-3.5 min-w-[180px] max-w-[320px] whitespace-normal break-words" title={displayVal}>
                                  {displayVal}
                                </td>
                              )
                            })}
                            <td className="p-3.5 text-slate-500">{submittedDateStr}</td>
                            <td className="p-3.5 text-right">
                              <ActionMenu
                                triggerVariant="meatball"
                                tooltip="Response Options"
                                size="xs"
                                items={[
                                  {
                                    label: 'View Details',
                                    icon: (
                                      <svg className="w-3.5 h-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                      </svg>
                                    ),
                                    onClick: () => setSelectedResponse(r)
                                  },
                                  {
                                    label: 'Edit Response',
                                    icon: (
                                      <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                      </svg>
                                    ),
                                    onClick: () => setResponseToEdit(r)
                                  },
                                  {
                                    label: 'Delete Response',
                                    variant: 'danger',
                                    icon: (
                                      <svg className="w-3.5 h-3.5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                    ),
                                    onClick: () => setResponseToDelete(r)
                                  }
                                ]}
                              />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards View */}
                <div className="md:hidden space-y-3">
                  {filteredMemberRows.map(row => {
                    const r = row.response
                    const submittedDateStr = r?.submittedAt && typeof r.submittedAt === 'object' && 'seconds' in r.submittedAt
                      ? new Date((r.submittedAt as any).seconds * 1000).toLocaleString()
                      : String(r?.submittedAt || '-')

                    return (
                      <div key={row.member.id} className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <h4 className="font-bold text-xs sm:text-sm text-slate-900 truncate">{row.memberName}</h4>
                            <span className="text-[11px] font-semibold text-slate-500 block mt-0.5">
                              {row.member.order || row.member.position || 'Altar Server'}
                            </span>
                          </div>
                          {row.hasResponded ? (
                            <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 rounded-full inline-flex items-center gap-1 shrink-0">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              Responded
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 rounded-full inline-flex items-center gap-1 shrink-0">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                              Not Answered
                            </span>
                          )}
                        </div>

                        {r && (
                          <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs">
                            {questions.slice(0, 3).map(q => {
                              const val = r.answers[q.id]
                              const displayVal = formatQuestionAnswer(q, val)
                              return (
                                <div key={q.id} className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                                  <span className="text-[10px] font-bold uppercase text-slate-400 block line-clamp-1">{q.question}</span>
                                  <span className="text-slate-800 font-medium text-xs break-words">{displayVal}</span>
                                </div>
                              )
                            })}
                            {questions.length > 3 && (
                              <span className="text-[10px] text-slate-400 italic block">+{questions.length - 3} more questions</span>
                            )}
                            <div className="text-[10px] text-slate-400 font-medium">
                              Submitted: {submittedDateStr}
                            </div>
                          </div>
                        )}

                        {r && (
                          <div className="pt-2 border-t border-slate-100 flex items-center justify-end">
                            <ActionMenu
                              triggerVariant="meatball"
                              tooltip="Response Options"
                              size="xs"
                              items={[
                                {
                                  label: 'View Details',
                                  icon: (
                                    <svg className="w-3.5 h-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                  ),
                                  onClick: () => setSelectedResponse(r)
                                },
                                {
                                  label: 'Edit Response',
                                  icon: (
                                    <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                  ),
                                  onClick: () => setResponseToEdit(r)
                                },
                                {
                                  label: 'Delete Response',
                                  variant: 'danger',
                                  icon: (
                                    <svg className="w-3.5 h-3.5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  ),
                                  onClick: () => setResponseToDelete(r)
                                }
                              ]}
                            />
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {/* Guest responses in mobile */}
                  {filteredGuestResponses.map(r => {
                    const submittedDateStr = r.submittedAt && typeof r.submittedAt === 'object' && 'seconds' in r.submittedAt
                      ? new Date((r.submittedAt as any).seconds * 1000).toLocaleString()
                      : String(r.submittedAt || '-')

                    return (
                      <div key={r.id || Math.random()} className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <h4 className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                              {r.respondentMemberName || 'Guest / Non-Member'}
                            </h4>
                            <span className="text-[11px] font-semibold text-slate-400 italic block mt-0.5">
                              Guest Respondent
                            </span>
                          </div>
                          <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-100 text-blue-800 rounded-full shrink-0">
                            Responded
                          </span>
                        </div>

                        <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs">
                          {questions.slice(0, 3).map(q => {
                            const val = r.answers[q.id]
                            const displayVal = formatQuestionAnswer(q, val)
                            return (
                              <div key={q.id} className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                                <span className="text-[10px] font-bold uppercase text-slate-400 block line-clamp-1">{q.question}</span>
                                <span className="text-slate-800 font-medium text-xs break-words">{displayVal}</span>
                              </div>
                            )
                          })}
                          <div className="text-[10px] text-slate-400 font-medium">
                            Submitted: {submittedDateStr}
                          </div>
                        </div>

                        <div className="pt-2 border-t border-slate-100 flex items-center justify-end">
                          <ActionMenu
                            triggerVariant="meatball"
                            tooltip="Response Options"
                            size="xs"
                            items={[
                              {
                                label: 'View Details',
                                icon: (
                                  <svg className="w-3.5 h-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  </svg>
                                ),
                                onClick: () => setSelectedResponse(r)
                              },
                              {
                                label: 'Edit Response',
                                icon: (
                                  <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                ),
                                onClick: () => setResponseToEdit(r)
                              },
                              {
                                label: 'Delete Response',
                                variant: 'danger',
                                icon: (
                                  <svg className="w-3.5 h-3.5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                ),
                                onClick: () => setResponseToDelete(r)
                              }
                            ]}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )
          ) : (
            /* Direct Submissions List (when no target members are set) */
            filteredGeneralResponses.length === 0 ? (
              <div className="p-8 sm:p-12 text-center text-slate-500 bg-white rounded-2xl border border-slate-200">
                <p className="text-sm font-bold">No responses submitted yet</p>
                <p className="text-xs mt-1 text-slate-400">Responses will appear here once participants submit the form.</p>
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden md:block bg-white border border-slate-200 rounded-2xl overflow-x-auto shadow-xs">
                  <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
                    <thead>
                      <tr className="bg-slate-100/70 text-slate-700 font-bold border-b border-slate-200">
                        <th className="p-3.5 w-12 text-slate-400">#</th>
                        <th className="p-3.5">Respondent</th>
                        {questions.map(q => (
                          <th key={q.id} className="p-3.5 min-w-[180px] max-w-[320px] whitespace-normal" title={q.question}>
                            {q.question}
                          </th>
                        ))}
                        <th className="p-3.5">Submitted At</th>
                        <th className="p-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {filteredGeneralResponses.map((r, rIdx) => {
                        const submittedDateStr = r.submittedAt && typeof r.submittedAt === 'object' && 'seconds' in r.submittedAt
                          ? new Date((r.submittedAt as any).seconds * 1000).toLocaleString()
                          : String(r.submittedAt || '-')

                        return (
                          <tr key={r.id || rIdx} className="hover:bg-slate-50 transition-colors group">
                            <td className="p-3.5 text-slate-400 font-mono text-[11px]">{rIdx + 1}</td>
                            <td className="p-3.5">
                              <div className="font-bold text-slate-900">{r.respondentMemberName || 'Guest / Public User'}</div>
                              {r.respondentEmail && (
                                <div className="text-[11px] text-slate-500 font-normal">{r.respondentEmail}</div>
                              )}
                            </td>
                            {questions.map(q => {
                              const val = r.answers[q.id]
                              const displayVal = formatQuestionAnswer(q, val)
                              return (
                                <td key={q.id} className="p-3.5 min-w-[180px] max-w-[320px] whitespace-normal break-words" title={displayVal}>
                                  {displayVal}
                                </td>
                              )
                            })}
                            <td className="p-3.5 text-slate-500">{submittedDateStr}</td>
                            <td className="p-3.5 text-right">
                              <ActionMenu
                                triggerVariant="meatball"
                                tooltip="Response Options"
                                size="xs"
                                items={[
                                  {
                                    label: 'View Details',
                                    icon: (
                                      <svg className="w-3.5 h-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                      </svg>
                                    ),
                                    onClick: () => setSelectedResponse(r)
                                  },
                                  {
                                    label: 'Edit Response',
                                    icon: (
                                      <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                      </svg>
                                    ),
                                    onClick: () => setResponseToEdit(r)
                                  },
                                  {
                                    label: 'Delete Response',
                                    variant: 'danger',
                                    icon: (
                                      <svg className="w-3.5 h-3.5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                    ),
                                    onClick: () => setResponseToDelete(r)
                                  }
                                ]}
                              />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards View */}
                <div className="md:hidden space-y-3">
                  {filteredGeneralResponses.map((r, rIdx) => {
                    const submittedDateStr = r.submittedAt && typeof r.submittedAt === 'object' && 'seconds' in r.submittedAt
                      ? new Date((r.submittedAt as any).seconds * 1000).toLocaleString()
                      : String(r.submittedAt || '-')

                    return (
                      <div key={r.id || rIdx} className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <span className="text-[10px] font-mono text-slate-400">#{rIdx + 1}</span>
                            <h4 className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                              {r.respondentMemberName || 'Guest / Public User'}
                            </h4>
                            {r.respondentEmail && (
                              <span className="text-[11px] text-slate-500 block truncate">{r.respondentEmail}</span>
                            )}
                          </div>
                          <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 rounded-full shrink-0">
                            Submitted
                          </span>
                        </div>

                        <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs">
                          {questions.slice(0, 3).map(q => {
                            const val = r.answers[q.id]
                            const displayVal = formatQuestionAnswer(q, val)
                            return (
                              <div key={q.id} className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                                <span className="text-[10px] font-bold uppercase text-slate-400 block line-clamp-1">{q.question}</span>
                                <span className="text-slate-800 font-medium text-xs break-words">{displayVal}</span>
                              </div>
                            )
                          })}
                          {questions.length > 3 && (
                            <span className="text-[10px] text-slate-400 italic block">+{questions.length - 3} more questions</span>
                          )}
                          <div className="text-[10px] text-slate-400 font-medium">
                            Submitted: {submittedDateStr}
                          </div>
                        </div>

                        <div className="pt-2 border-t border-slate-100 flex items-center justify-end">
                          <ActionMenu
                            triggerVariant="meatball"
                            tooltip="Response Options"
                            size="xs"
                            items={[
                              {
                                label: 'View Details',
                                icon: (
                                  <svg className="w-3.5 h-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  </svg>
                                ),
                                onClick: () => setSelectedResponse(r)
                              },
                              {
                                label: 'Edit Response',
                                icon: (
                                  <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                ),
                                onClick: () => setResponseToEdit(r)
                              },
                              {
                                label: 'Delete Response',
                                variant: 'danger',
                                icon: (
                                  <svg className="w-3.5 h-3.5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                ),
                                onClick: () => setResponseToDelete(r)
                              }
                            ]}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )
          )}
        </div>
      </div>

      {/* Response Detail Sub-Modal */}
      {selectedResponse && (
        <div className="fixed inset-0 z-60 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white max-w-xl w-full rounded-2xl sm:rounded-3xl shadow-2xl p-4 sm:p-6 border border-slate-200 space-y-4 max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b pb-3 shrink-0">
              <div className="min-w-0 flex-1 pr-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Response Detail</span>
                <h3 className="text-sm sm:text-base font-black text-slate-900 truncate">
                  {selectedResponse.respondentMemberName || (selectedResponse.respondentMemberUid ? membersMap[selectedResponse.respondentMemberUid] : '') || 'Anonymous / Guest'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedResponse(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer shrink-0"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-3 flex-1 overflow-y-auto pr-1 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl space-y-1 border border-slate-200">
                <p><strong className="text-slate-600">Respondent Name:</strong> {selectedResponse.respondentMemberName || (selectedResponse.respondentMemberUid ? membersMap[selectedResponse.respondentMemberUid] : '') || 'N/A'}</p>
                <p><strong className="text-slate-600">Respondent Email:</strong> {selectedResponse.respondentEmail || 'N/A'}</p>
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">Submitted Answers</h4>
                {questions.map((q, idx) => {
                  const val = selectedResponse.answers[q.id]
                  const displayVal = formatQuestionAnswer(q, val)

                  return (
                    <div key={q.id} className="p-3 border border-slate-200 rounded-xl bg-white space-y-1">
                      <p className="font-bold text-slate-900">#{idx + 1}. {q.question}</p>
                      {q.type === 'contact_number' && val ? (
                        <div className="text-slate-800 bg-slate-50 p-2.5 rounded-lg font-medium border border-slate-100 flex items-center justify-between">
                          <span className="font-mono font-bold text-slate-900">{displayVal}</span>
                          <a
                            href={`tel:${String(val).replace(/[^0-9\+]/g, '')}`}
                            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded-md border border-indigo-200 transition"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                            <span>Call</span>
                          </a>
                        </div>
                      ) : (
                        <p className="text-slate-800 bg-slate-50 p-2.5 rounded-lg font-medium border border-slate-100 break-words">{displayVal}</p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 shrink-0">
              <Button
                variant="secondary"
                size="sm"
                className="w-full sm:w-auto"
                onClick={() => {
                  const resp = selectedResponse
                  setSelectedResponse(null)
                  setResponseToEdit(resp)
                }}
              >
                Edit Response
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="w-full sm:w-auto"
                onClick={() => setSelectedResponse(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Response Sub-Modal */}
      {responseToEdit && (
        <EditFormResponseModal
          isOpen={!!responseToEdit}
          onClose={() => setResponseToEdit(null)}
          onSaved={fetchData}
          form={form}
          questions={questions}
          response={responseToEdit}
          membersList={membersList}
          membersMap={membersMap}
        />
      )}

      {/* Delete Response Confirmation Modal */}
      <ConfirmModal
        isOpen={!!responseToDelete}
        onClose={() => setResponseToDelete(null)}
        onConfirm={handleDeleteResponse}
        loading={deleting}
        title="Delete Form Response"
        message={`Are you sure you want to delete the submitted response from "${
          responseToDelete?.respondentMemberName || (responseToDelete?.respondentMemberUid ? membersMap[responseToDelete.respondentMemberUid] : '') || 'this user'
        }"? This action cannot be undone.`}
        confirmLabel="Delete Response"
        variant="danger"
      />

      {/* Delete All Responses Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteAllConfirm}
        onClose={() => setShowDeleteAllConfirm(false)}
        onConfirm={handleDeleteAllResponses}
        loading={deletingAll}
        title="Delete All Form Responses"
        message={`Are you sure you want to PERMANENTLY DELETE ALL ${responses.length} responses submitted for "${form.title}"? This action cannot be undone.`}
        confirmLabel="Delete All Responses"
        variant="danger"
      />

      {/* Dynamic PDF Export Options Modal */}
      {exportPdfModalOpen && (
        <div className="fixed inset-0 z-60 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white max-w-xl w-full rounded-2xl sm:rounded-3xl shadow-2xl p-4 sm:p-6 border border-slate-200 space-y-4 font-sans max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b pb-3 shrink-0">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">PDF Report Configurator</span>
                <h3 className="text-sm sm:text-base font-black text-slate-900">Customize PDF Report Export</h3>
              </div>
              <button
                type="button"
                onClick={() => setExportPdfModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer shrink-0"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4 flex-1 overflow-y-auto pr-1 text-xs">
              {/* Document Title Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">PDF Report Header Title</label>
                <input
                  type="text"
                  value={pdfTitle}
                  onChange={e => setPdfTitle(e.target.value)}
                  placeholder="e.g. PILGRIMAGE 2026 LIST OF PARTICIPANTS & COMPANIONS"
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-xs bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-bold"
                />
              </div>

              {/* Filter Rows Config */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Filter Question (Optional)</label>
                  <CustomSelect
                    value={pdfFilterQuestionId}
                    onChange={e => {
                      setPdfFilterQuestionId(e.target.value)
                      setPdfFilterValue('')
                    }}
                    options={[
                      { value: '', label: 'Include All Responses' },
                      ...questions.map(q => ({ value: q.id, label: q.question }))
                    ]}
                  />
                </div>

                {pdfFilterQuestionId && (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Filter Value Equals</label>
                    {(() => {
                      const selQ = questions.find(q => q.id === pdfFilterQuestionId)
                      if (selQ && selQ.options && selQ.options.length > 0) {
                        return (
                          <CustomSelect
                            value={pdfFilterValue}
                            onChange={e => setPdfFilterValue(e.target.value)}
                            options={[
                              { value: '', label: 'Select option...' },
                              ...selQ.options.map(opt => ({ value: opt, label: opt }))
                            ]}
                          />
                        )
                      }
                      if (selQ && selQ.type === 'appointment_slots' && selQ.appointmentConfig) {
                        const slotOptions = selQ.appointmentConfig.flatMap(dateCfg =>
                          dateCfg.slots.map(slot => ({
                            value: `${dateCfg.date}|${slot.id}`,
                            label: `${dateCfg.label ? `${dateCfg.label}: ` : `${dateCfg.date}: `}${slot.startTime}-${slot.endTime}${slot.label ? ` (${slot.label})` : ''}`
                          }))
                        )
                        return (
                          <CustomSelect
                            value={pdfFilterValue}
                            onChange={e => setPdfFilterValue(e.target.value)}
                            options={[
                              { value: '', label: 'Select appointment slot...' },
                              ...slotOptions
                            ]}
                          />
                        )
                      }
                      if (selQ && selQ.type === 'yes_no') {
                        return (
                          <CustomSelect
                            value={pdfFilterValue}
                            onChange={e => setPdfFilterValue(e.target.value)}
                            options={[
                              { value: '', label: 'Select option...' },
                              { value: 'Yes', label: 'Yes' },
                              { value: 'No', label: 'No' }
                            ]}
                          />
                        )
                      }
                      return (
                        <input
                          type="text"
                          value={pdfFilterValue}
                          onChange={e => setPdfFilterValue(e.target.value)}
                          placeholder="e.g. Yes"
                          className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                        />
                      )
                    })()}
                  </div>
                )}
              </div>

              {/* Page Orientation */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">PDF Layout Orientation</label>
                <div className="flex space-x-3">
                  <label className={`flex-1 flex items-center justify-center p-2.5 border rounded-xl cursor-pointer text-xs font-bold transition ${pdfOrientation === 'landscape' ? 'bg-blue-50 border-blue-500 text-blue-800' : 'bg-white border-slate-200 text-slate-600'}`}>
                    <input
                      type="radio"
                      name="pdf_orientation"
                      checked={pdfOrientation === 'landscape'}
                      onChange={() => setPdfOrientation('landscape')}
                      className="mr-2"
                    />
                    Landscape (Wide)
                  </label>
                  <label className={`flex-1 flex items-center justify-center p-2.5 border rounded-xl cursor-pointer text-xs font-bold transition ${pdfOrientation === 'portrait' ? 'bg-blue-50 border-blue-500 text-blue-800' : 'bg-white border-slate-200 text-slate-600'}`}>
                    <input
                      type="radio"
                      name="pdf_orientation"
                      checked={pdfOrientation === 'portrait'}
                      onChange={() => setPdfOrientation('portrait')}
                      className="mr-2"
                    />
                    Portrait (Tall)
                  </label>
                </div>
              </div>

              {/* Columns Selector & Custom Column Names */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Select & Rename Columns to Include in PDF</label>
                <div className="space-y-2 max-h-52 overflow-y-auto p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  {/* Respondent Name Field */}
                  <div className="flex items-center space-x-2 p-2 bg-white rounded-lg border border-slate-200">
                    <input
                      type="checkbox"
                      checked={pdfSelectedQuestionIds.includes('respondent_name')}
                      onChange={() => togglePdfColumn('respondent_name')}
                      className="h-4 w-4 text-blue-600 rounded-md shrink-0"
                    />
                    <span className="text-xs font-bold text-slate-800 shrink-0 min-w-[110px] sm:min-w-[130px]">Member / Respondent</span>
                    {pdfSelectedQuestionIds.includes('respondent_name') && (
                      <input
                        type="text"
                        value={pdfColumnLabels['respondent_name'] || ''}
                        onChange={e => setPdfColumnLabels(prev => ({ ...prev, respondent_name: e.target.value }))}
                        placeholder="Column Header Label in PDF"
                        className="flex-1 min-w-0 p-1.5 border border-slate-200 rounded-md text-[11px] bg-slate-50"
                      />
                    )}
                  </div>

                  {/* Form Questions */}
                  {questions.map(q => {
                    const isChecked = pdfSelectedQuestionIds.includes(q.id)
                    return (
                      <div key={q.id} className="flex items-center space-x-2 p-2 bg-white rounded-lg border border-slate-200">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => togglePdfColumn(q.id)}
                          className="h-4 w-4 text-blue-600 rounded-md shrink-0"
                        />
                        <span className="text-xs font-bold text-slate-800 shrink-0 min-w-[110px] sm:min-w-[130px] line-clamp-1 max-w-[140px] sm:max-w-none" title={q.question}>
                          {q.question}
                        </span>
                        {isChecked && (
                          <input
                            type="text"
                            value={pdfColumnLabels[q.id] || q.question}
                            onChange={e => setPdfColumnLabels(prev => ({ ...prev, [q.id]: e.target.value }))}
                            placeholder="Column Header Label in PDF"
                            className="flex-1 min-w-0 p-1.5 border border-slate-200 rounded-md text-[11px] bg-slate-50"
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Dynamic Signatures Configuration */}
              <DynamicSignatureConfig
                value={pdfSignatureConfig}
                onChange={setPdfSignatureConfig}
                defaultPresetName="General"
              />
            </div>

            <div className="pt-3 border-t flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 shrink-0">
              <Button
                variant="secondary"
                size="sm"
                className="w-full sm:w-auto"
                onClick={() => setExportPdfModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                className="w-full sm:w-auto"
                onClick={handleGeneratePdf}
                loading={generatingPdf}
                disabled={generatingPdf || pdfSelectedQuestionIds.length === 0}
              >
                Download PDF Report
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
