import React, { useState, useEffect } from 'react'
import type { EventForm, EventFormQuestion, EventFormResponse } from '@/types/eventForm'
import { eventFormQuestionService } from '@/services/eventFormQuestionService'
import { eventFormResponseService } from '@/services/eventFormResponseService'
import { memberService } from '@/services/memberService'
import { ConfirmModal } from '@/components/Dialog'
import { downloadEventFormPdf } from '@/utils/eventFormPdfReport'

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
  const [loading, setLoading] = useState(true)
  const [questions, setQuestions] = useState<EventFormQuestion[]>([])
  const [responses, setResponses] = useState<EventFormResponse[]>([])
  const [membersMap, setMembersMap] = useState<Record<string, string>>({})
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedResponse, setSelectedResponse] = useState<EventFormResponse | null>(null)
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

  const fetchData = async () => {
    if (!form.id) return
    setLoading(true)
    try {
      const [qs, rs, mems] = await Promise.all([
        eventFormQuestionService.getQuestionsByFormId(form.id),
        eventFormResponseService.getResponsesByFormId(form.id),
        memberService.getMembers(true)
      ])

      const map: Record<string, string> = {}
      mems.forEach(m => {
        map[m.id] = `${m.lastName}, ${m.firstName}${m.order ? ` (${m.order})` : ''}`
      })

      const sortedQs = [...qs].sort((a, b) => a.order - b.order)

      setQuestions(qs)
      setResponses(rs)
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
  }, [isOpen, form.id])

  if (!isOpen) return null

  const filteredResponses = responses.filter(r => {
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

  const handleExportCSV = () => {
    eventFormResponseService.exportResponsesToCSV(form, questions, filteredResponses)
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
        membersMap
      })
      setExportPdfModalOpen(false)
    } catch (err) {
      console.error('Failed to generate PDF report:', err)
    } finally {
      setGeneratingPdf(false)
    }
  }

  const handleDeleteResponse = async () => {
    if (!responseToDelete?.id) return
    setDeleting(true)
    try {
      await eventFormResponseService.deleteResponse(responseToDelete.id)
      setResponseToDelete(null)
      await fetchData()
    } catch (err) {
      console.error('Failed to delete response:', err)
    } finally {
      setDeleting(false)
    }
  }

  const togglePdfColumn = (colId: string) => {
    setPdfSelectedQuestionIds(prev =>
      prev.includes(colId) ? prev.filter(id => id !== colId) : [...prev, colId]
    )
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-6xl h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-xl font-bold text-slate-900">Form Responses: {form.title}</h2>
              <span className="px-2.5 py-0.5 text-xs font-bold bg-blue-100 text-blue-700 rounded-full">
                {responses.length} Total
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Inspect dynamic submissions, generate PDF reports, or export to CSV.</p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={() => setExportPdfModalOpen(true)}
              disabled={responses.length === 0}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer disabled:opacity-50 flex items-center space-x-1.5 shadow-xs"
            >
              <span>Export PDF Report</span>
            </button>
            <button
              type="button"
              onClick={handleExportCSV}
              disabled={responses.length === 0}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            >
              <span>Export CSV</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="px-6 py-3 bg-white border-b border-slate-200 flex items-center justify-between">
          <input
            type="text"
            placeholder="Search responses by name or answer..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-80 p-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
          />
          <span className="text-xs text-slate-500 font-medium">
            Showing {filteredResponses.length} of {responses.length} responses
          </span>
        </div>

        {/* Content Table */}
        <div className="flex-1 overflow-auto p-6 bg-slate-50">
          {loading ? (
            <div className="p-12 text-center text-xs font-semibold text-slate-500">Loading form responses...</div>
          ) : filteredResponses.length === 0 ? (
            <div className="p-12 text-center text-slate-500 bg-white rounded-2xl border border-slate-200">
              <p className="text-sm font-bold">No responses found</p>
              <p className="text-xs mt-1 text-slate-400">Submissions will appear here once users respond to the published form.</p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-x-auto shadow-xs">
              <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
                <thead>
                  <tr className="bg-slate-100/70 text-slate-700 font-bold border-b border-slate-200">
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
                  {filteredResponses.map(r => {
                    const submittedDateStr = r.submittedAt && typeof r.submittedAt === 'object' && 'seconds' in r.submittedAt
                      ? new Date((r.submittedAt as any).seconds * 1000).toLocaleString()
                      : String(r.submittedAt || '-')

                    const respName = r.respondentMemberName || (r.respondentMemberUid ? membersMap[r.respondentMemberUid] : '') || 'Anonymous / Guest'

                    return (
                      <tr key={r.id} className="hover:bg-slate-50 transition-colors group">
                        <td className="p-3.5 font-semibold text-slate-900">
                          {respName}
                        </td>
                        {questions.map(q => {
                          const val = r.answers[q.id]
                          let displayVal = '-'
                          if (val !== undefined && val !== null && val !== '') {
                            if (q.type === 'member_selector' && typeof val === 'string') {
                              displayVal = membersMap[val] || val
                            } else if (typeof val === 'string' && membersMap[val]) {
                              displayVal = membersMap[val]
                            } else {
                              displayVal = Array.isArray(val) ? val.join(', ') : String(val)
                            }
                          }
                          return (
                            <td key={q.id} className="p-3.5 min-w-[180px] max-w-[320px] whitespace-normal break-words" title={displayVal}>
                              {displayVal}
                            </td>
                          )
                        })}
                        <td className="p-3.5 text-slate-500">{submittedDateStr}</td>
                        <td className="p-3.5 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              type="button"
                              onClick={() => setSelectedResponse(r)}
                              className="px-3 py-1.5 text-xs font-bold text-blue-600 hover:bg-blue-50 border border-blue-200 rounded-lg transition-colors cursor-pointer"
                            >
                              View Detail
                            </button>
                            <button
                              type="button"
                              onClick={() => setResponseToDelete(r)}
                              className="px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 border border-red-200 rounded-lg transition-colors cursor-pointer"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Response Detail Sub-Modal */}
      {selectedResponse && (
        <div className="fixed inset-0 z-60 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white max-w-xl w-full rounded-2xl shadow-xl p-6 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Response Detail</span>
                <h3 className="text-base font-black text-slate-900">
                  {selectedResponse.respondentMemberName || (selectedResponse.respondentMemberUid ? membersMap[selectedResponse.respondentMemberUid] : '') || 'Anonymous / Guest'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedResponse(null)}
                className="text-slate-400 hover:text-slate-600 font-bold px-2 py-1 rounded-md cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl space-y-1 border border-slate-200">
                <p><strong className="text-slate-600">Respondent Name:</strong> {selectedResponse.respondentMemberName || (selectedResponse.respondentMemberUid ? membersMap[selectedResponse.respondentMemberUid] : '') || 'N/A'}</p>
                <p><strong className="text-slate-600">Respondent Email:</strong> {selectedResponse.respondentEmail || 'N/A'}</p>
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">Submitted Answers</h4>
                {questions.map((q, idx) => {
                  const val = selectedResponse.answers[q.id]
                  let displayVal = '-'
                  if (val !== undefined && val !== null && val !== '') {
                    if (q.type === 'member_selector' && typeof val === 'string') {
                      displayVal = membersMap[val] || val
                    } else if (typeof val === 'string' && membersMap[val]) {
                      displayVal = membersMap[val]
                    } else {
                      displayVal = Array.isArray(val) ? val.join(', ') : String(val)
                    }
                  }

                  return (
                    <div key={q.id} className="p-3 border border-slate-200 rounded-xl bg-white space-y-1">
                      <p className="font-bold text-slate-900">#{idx + 1}. {q.question}</p>
                      <p className="text-slate-800 bg-slate-50 p-2.5 rounded-lg font-medium border border-slate-100">{displayVal}</p>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="pt-2 text-right">
              <button
                type="button"
                onClick={() => setSelectedResponse(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 font-bold text-xs rounded-xl text-slate-700 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
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

      {/* Dynamic PDF Export Options Modal */}
      {exportPdfModalOpen && (
        <div className="fixed inset-0 z-60 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white max-w-xl w-full rounded-2xl shadow-2xl p-6 border border-slate-200 space-y-4 font-sans">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">PDF Report Configurator</span>
                <h3 className="text-base font-black text-slate-900">Customize PDF Report Export</h3>
              </div>
              <button
                type="button"
                onClick={() => setExportPdfModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold px-2 py-1 rounded-md cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1 text-xs">
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
                  <select
                    value={pdfFilterQuestionId}
                    onChange={e => {
                      setPdfFilterQuestionId(e.target.value)
                      setPdfFilterValue('')
                    }}
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  >
                    <option value="">Include All Responses</option>
                    {questions.map(q => (
                      <option key={q.id} value={q.id}>
                        {q.question}
                      </option>
                    ))}
                  </select>
                </div>

                {pdfFilterQuestionId && (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Filter Value Equals</label>
                    {(() => {
                      const selQ = questions.find(q => q.id === pdfFilterQuestionId)
                      if (selQ && selQ.options && selQ.options.length > 0) {
                        return (
                          <select
                            value={pdfFilterValue}
                            onChange={e => setPdfFilterValue(e.target.value)}
                            className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                          >
                            <option value="">Select option...</option>
                            {selQ.options.map((opt, oIdx) => (
                              <option key={oIdx} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        )
                      }
                      if (selQ && selQ.type === 'yes_no') {
                        return (
                          <select
                            value={pdfFilterValue}
                            onChange={e => setPdfFilterValue(e.target.value)}
                            className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                          >
                            <option value="">Select option...</option>
                            <option value="Yes">Yes</option>
                            <option value="No">No</option>
                          </select>
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
                      className="h-4 w-4 text-blue-600 rounded-md"
                    />
                    <span className="text-xs font-bold text-slate-800 shrink-0 min-w-[130px]">Member / Respondent</span>
                    {pdfSelectedQuestionIds.includes('respondent_name') && (
                      <input
                        type="text"
                        value={pdfColumnLabels['respondent_name'] || ''}
                        onChange={e => setPdfColumnLabels(prev => ({ ...prev, respondent_name: e.target.value }))}
                        placeholder="Column Header Label in PDF"
                        className="flex-1 p-1.5 border border-slate-200 rounded-md text-[11px] bg-slate-50"
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
                          className="h-4 w-4 text-blue-600 rounded-md"
                        />
                        <span className="text-xs font-bold text-slate-800 shrink-0 min-w-[130px] line-clamp-1" title={q.question}>
                          {q.question}
                        </span>
                        {isChecked && (
                          <input
                            type="text"
                            value={pdfColumnLabels[q.id] || q.question}
                            onChange={e => setPdfColumnLabels(prev => ({ ...prev, [q.id]: e.target.value }))}
                            placeholder="Column Header Label in PDF"
                            className="flex-1 p-1.5 border border-slate-200 rounded-md text-[11px] bg-slate-50"
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setExportPdfModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleGeneratePdf}
                disabled={generatingPdf || pdfSelectedQuestionIds.length === 0}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-xs disabled:opacity-50"
              >
                {generatingPdf ? 'Generating PDF Report...' : 'Download PDF Report'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
