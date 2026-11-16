import React, { useState } from 'react'
import { Modal } from '@/components/Modal'
import type { EventFormQuestion, QuestionType } from '@/types/eventForm'

interface ImportQuestionsModalProps {
  isOpen: boolean
  onClose: () => void
  eventId: string
  onImport: (newQuestions: EventFormQuestion[], replaceExisting: boolean) => void
}

type TabMode = 'templates' | 'csv' | 'paste'

interface ParsedQuestionPreview {
  question: string
  type: QuestionType
  required: boolean
  options?: string[]
  lowRatingLabel?: string
  highRatingLabel?: string
}

export const ImportQuestionsModal: React.FC<ImportQuestionsModalProps> = ({
  isOpen,
  onClose,
  eventId,
  onImport,
}) => {
  const [activeTab, setActiveTab] = useState<TabMode>('templates')
  const [replaceExisting, setReplaceExisting] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [csvFileName, setCsvFileName] = useState<string | null>(null)
  const [parsedItems, setParsedItems] = useState<ParsedQuestionPreview[]>([])
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  if (!isOpen) return null

  // 1-Click Templates definition
  const getTemplateQuestions = (templateType: 'altar_server_eval' | 'general_survey'): ParsedQuestionPreview[] => {
    if (templateType === 'altar_server_eval') {
      return [
        {
          question: 'Pangalan ng Altar Server',
          type: 'member_selector',
          required: true,
        },
        {
          question: 'Punctuality & Preparedness',
          type: 'rating',
          required: true,
          lowRatingLabel: '1 - Often Late / Unprepared',
          highRatingLabel: '5 - Always Early & Ready',
        },
        {
          question: 'Altar Decorum & Reverence',
          type: 'rating',
          required: true,
          lowRatingLabel: '1 - Distracted / Needs Supervision',
          highRatingLabel: '5 - Deeply Reverent & Solemn',
        },
        {
          question: 'Liturgical Proficiency',
          type: 'rating',
          required: true,
          lowRatingLabel: '1 - Needs Retraining',
          highRatingLabel: '5 - Fully Proficient in All Duties',
        },
        {
          question: 'Attitude & Fraternal Obedience',
          type: 'rating',
          required: true,
          lowRatingLabel: '1 - Uncooperative',
          highRatingLabel: '5 - Exemplary Humility & Service',
        },
        {
          question: 'Officer Recommendation',
          type: 'multiple_choice',
          required: true,
          options: [
            'Recommended for Rank Promotion',
            'Maintain Good Standing',
            'Assign for Refresher Mentoring',
            'Pastoral Guidance Needed',
          ],
        },
      ]
    }

    return [
      { question: 'Participant Full Name', type: 'name_selector', required: true },
      { question: 'Contact Number', type: 'contact_number', required: true },
      {
        question: 'Overall Event Rating',
        type: 'rating',
        required: true,
        lowRatingLabel: '1 - Poor',
        highRatingLabel: '5 - Excellent',
      },
      {
        question: 'Will you recommend this ministry event to others?',
        type: 'yes_no',
        required: true,
      },
      { question: 'Suggestions & Pastoral Remarks', type: 'long_text', required: false },
    ]
  }

  // Parse CSV or TSV raw text
  const parseRawTextToQuestions = (text: string): ParsedQuestionPreview[] => {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0)

    if (lines.length === 0) return []

    const validTypes: QuestionType[] = [
      'short_text',
      'long_text',
      'contact_number',
      'multiple_choice',
      'checkbox',
      'dropdown',
      'yes_no',
      'number',
      'date',
      'time',
      'appointment_slots',
      'name_selector',
      'member_selector',
      'relationship_selector',
      'companion_repeater',
      'section_header',
      'rating',
    ]

    const results: ParsedQuestionPreview[] = []

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      // Skip header row if matches "question" or "type"
      if (i === 0 && (line.toLowerCase().includes('question') || line.toLowerCase().includes('type'))) {
        continue
      }

      // Check delimiter (Tab or Comma or Pipe)
      let parts: string[] = []
      if (line.includes('\t')) {
        parts = line.split('\t').map((p) => p.trim())
      } else if (line.includes(',')) {
        // Simple CSV splitter respecting basic quotes
        parts = line
          .split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
          .map((p) => p.replace(/^"|"$/g, '').trim())
      } else if (line.includes('|')) {
        parts = line.split('|').map((p) => p.trim())
      } else {
        // Plain line of text (treat as short_text question)
        parts = [line]
      }

      const rawQuestion = parts[0] || ''
      if (!rawQuestion) continue

      // Clean leading numbering like "1. ", "1) "
      const cleanQuestion = rawQuestion.replace(/^\d+[.)]\s*/, '').trim()

      const rawType = (parts[1] || '').toLowerCase().replace(/\s+/g, '_')
      let matchedType: QuestionType = 'short_text'

      if (rawType.includes('rating') || rawType.includes('star') || rawType.includes('scale')) {
        matchedType = 'rating'
      } else if (rawType.includes('member') || rawType.includes('server')) {
        matchedType = 'member_selector'
      } else if (rawType.includes('name') || rawType.includes('participant')) {
        matchedType = 'name_selector'
      } else if (rawType.includes('multi') || rawType.includes('choice') || rawType.includes('radio')) {
        matchedType = 'multiple_choice'
      } else if (rawType.includes('check')) {
        matchedType = 'checkbox'
      } else if (rawType.includes('drop')) {
        matchedType = 'dropdown'
      } else if (rawType.includes('long') || rawType.includes('para') || rawType.includes('essay')) {
        matchedType = 'long_text'
      } else if (rawType.includes('yes') || rawType.includes('no') || rawType.includes('binary')) {
        matchedType = 'yes_no'
      } else if (rawType.includes('num')) {
        matchedType = 'number'
      } else if (rawType.includes('date')) {
        matchedType = 'date'
      } else if (validTypes.includes(rawType as QuestionType)) {
        matchedType = rawType as QuestionType
      }

      const rawRequired = (parts[2] || '').toLowerCase()
      const isRequired = rawRequired === 'yes' || rawRequired === 'true' || rawRequired === '1' || rawRequired === ''

      // Parse options (comma or semicolon separated, or pipe)
      let parsedOptions: string[] | undefined
      if (parts[3]) {
        parsedOptions = parts[3]
          .split(/[;,]/)
          .map((o) => o.trim())
          .filter((o) => o.length > 0)
      } else if (matchedType === 'multiple_choice' || matchedType === 'dropdown' || matchedType === 'checkbox') {
        parsedOptions = ['Option 1', 'Option 2']
      }

      const lowLabel = parts[4] || (matchedType === 'rating' ? '1 - Needs Improvement' : undefined)
      const highLabel = parts[5] || (matchedType === 'rating' ? '5 - Excellent' : undefined)

      results.push({
        question: cleanQuestion,
        type: matchedType,
        required: isRequired,
        options: parsedOptions,
        lowRatingLabel: lowLabel,
        highRatingLabel: highLabel,
      })
    }

    return results
  }

  // Handle CSV File upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null)
    const file = e.target.files?.[0]
    if (!file) return

    setCsvFileName(file.name)
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string
        const parsed = parseRawTextToQuestions(content)
        if (parsed.length === 0) {
          setErrorMsg('No valid questions found in this CSV file.')
          setParsedItems([])
        } else {
          setParsedItems(parsed)
        }
      } catch (err: any) {
        setErrorMsg('Failed to parse CSV file: ' + err.message)
      }
    }
    reader.readAsText(file)
  }

  // Handle Paste parsing
  const handleParsePaste = () => {
    setErrorMsg(null)
    if (!pasteText.trim()) {
      setErrorMsg('Please paste your questions or spreadsheet text first.')
      return
    }
    const parsed = parseRawTextToQuestions(pasteText)
    if (parsed.length === 0) {
      setErrorMsg('Could not detect any questions. Please check format.')
      setParsedItems([])
    } else {
      setParsedItems(parsed)
    }
  }

  // Download Sample CSV
  const handleDownloadSampleCsv = () => {
    const csvContent = [
      'Question,Type,Required,Options,LowLabel,HighLabel',
      'Pangalan ng Altar Server,member_selector,Yes,,,',
      'Punctuality & Preparedness,rating,Yes,,1 - Often Late / Unprepared,5 - Always Early & Ready',
      'Altar Decorum & Reverence,rating,Yes,,1 - Distracted / Needs Supervision,5 - Deeply Reverent & Solemn',
      'Liturgical Proficiency,rating,Yes,,1 - Needs Retraining,5 - Fully Proficient in All Duties',
      'Attitude & Fraternal Obedience,rating,Yes,,1 - Uncooperative,5 - Exemplary Humility & Service',
      'Officer Recommendation,multiple_choice,Yes,"Recommended for Rank Promotion;Maintain Good Standing;Assign for Refresher Mentoring;Pastoral Guidance Needed",,',
      'Additional Comments,long_text,No,,,',
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', 'MATS_Form_Questions_Sample.csv')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // Confirm import
  const handleConfirmImport = (itemsToImport: ParsedQuestionPreview[]) => {
    if (itemsToImport.length === 0) return

    const now = Date.now()
    const converted: EventFormQuestion[] = itemsToImport.map((item, idx) => ({
      id: `q_${now}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
      formId: '',
      eventId,
      type: item.type,
      question: item.question,
      required: item.required,
      order: idx + 1,
      options: item.options,
      maxRating: item.type === 'rating' ? 5 : undefined,
      ratingScaleType: item.type === 'rating' ? 'stars' : undefined,
      lowRatingLabel: item.lowRatingLabel,
      highRatingLabel: item.highRatingLabel,
    }))

    onImport(converted, replaceExisting)
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Import Questions to Form"
      subtitle="Instantly load pre-built evaluation templates, upload a CSV spreadsheet, or paste from clipboard."
      badge="Quick Builder"
      maxWidth="2xl"
    >
      <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1 text-xs">
        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-bold text-xs flex items-center justify-between">
            <span>{errorMsg}</span>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              className="text-rose-500 hover:text-rose-800 text-sm font-bold ml-2 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Tab Buttons */}
        <div className="flex border-b border-slate-200 gap-1">
          <button
            type="button"
            onClick={() => {
              setActiveTab('templates')
              setErrorMsg(null)
            }}
            className={`px-4 py-2 text-xs font-bold transition border-b-2 cursor-pointer ${
              activeTab === 'templates'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            1-Click Templates
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('csv')
              setErrorMsg(null)
            }}
            className={`px-4 py-2 text-xs font-bold transition border-b-2 cursor-pointer ${
              activeTab === 'csv'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Upload CSV File
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('paste')
              setErrorMsg(null)
            }}
            className={`px-4 py-2 text-xs font-bold transition border-b-2 cursor-pointer ${
              activeTab === 'paste'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Copy-Paste Text / Sheet
          </button>
        </div>

        {/* TAB 1: 1-Click Templates */}
        {activeTab === 'templates' && (
          <div className="space-y-3 pt-2">
            <p className="text-slate-500 text-xs">
              Select an official pre-built evaluation rubric to populate questions automatically:
            </p>

            <div className="grid grid-cols-1 gap-3">
              {/* Altar Server Pastoral Evaluation */}
              <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-200/80 flex flex-col justify-between gap-3 hover:bg-indigo-50 transition">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-indigo-600 text-white font-black text-[10px] uppercase tracking-wide">
                      Recommended
                    </span>
                    <h4 className="font-black text-slate-900 text-sm">Altar Server Pastoral Evaluation (6 Questions)</h4>
                  </div>
                  <p className="text-slate-600 text-xs leading-relaxed">
                    Includes <strong>Pangalan ng Bata</strong> (Member Selector), <strong>4 Core Pillars</strong> (Punctuality, Altar Decorum, Liturgical Proficiency, Attitude) using 1-5 Star Ratings, and <strong>Officer Recommendation</strong>.
                  </p>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-indigo-100">
                  <span className="text-[11px] font-bold text-slate-500">6 Questions • Star Rating Ready</span>
                  <button
                    type="button"
                    onClick={() => handleConfirmImport(getTemplateQuestions('altar_server_eval'))}
                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold rounded-xl text-xs cursor-pointer shadow-xs transition"
                  >
                    Load This Template
                  </button>
                </div>
              </div>

              {/* General Ministry Survey */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col justify-between gap-3 hover:bg-slate-100/70 transition">
                <div className="space-y-1">
                  <h4 className="font-bold text-slate-800 text-sm">General Ministry & Activity Feedback (5 Questions)</h4>
                  <p className="text-slate-500 text-xs leading-relaxed">
                    Standard survey with Participant Name, Contact Number, 1-5 Star Event Rating, Yes/No Recommendation, and Long Text Comments.
                  </p>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                  <span className="text-[11px] font-bold text-slate-400">5 Questions • Survey Format</span>
                  <button
                    type="button"
                    onClick={() => handleConfirmImport(getTemplateQuestions('general_survey'))}
                    className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-900 active:scale-95 text-white font-bold rounded-xl text-xs cursor-pointer shadow-xs transition"
                  >
                    Load This Template
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: CSV File Upload */}
        {activeTab === 'csv' && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <p className="text-slate-500 text-xs">Upload a CSV file containing questions and types:</p>
              <button
                type="button"
                onClick={handleDownloadSampleCsv}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 underline flex items-center gap-1 cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download Sample CSV
              </button>
            </div>

            <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-300 rounded-2xl bg-slate-50 hover:bg-slate-100 cursor-pointer transition">
              <svg className="w-8 h-8 text-slate-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <span className="text-xs font-bold text-slate-700">
                {csvFileName ? `Selected: ${csvFileName}` : 'Click to browse or drop .csv file here'}
              </span>
              <span className="text-[11px] text-slate-400 mt-0.5">Supports Question, Type, Required, Options</span>
              <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>
        )}

        {/* TAB 3: Copy-Paste */}
        {activeTab === 'paste' && (
          <div className="space-y-3 pt-2">
            <p className="text-slate-500 text-xs">
              Paste rows copied directly from Excel, Google Sheets, or Notepad:
            </p>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={`Example:\nPangalan ng Bata\tmember_selector\tYes\nPunctuality & Preparedness\trating\tYes\nAltar Decorum\trating\tYes\nRecommendation\tmultiple_choice\tYes\tPromotion;Good Standing;Mentoring`}
              rows={5}
              className="w-full p-3 rounded-xl border border-slate-300 bg-slate-50 font-mono text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 shadow-2xs transition"
            />
            <button
              type="button"
              onClick={handleParsePaste}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-900 active:scale-95 text-white font-bold rounded-xl text-xs cursor-pointer transition"
            >
              Parse Pasted Text
            </button>
          </div>
        )}

        {/* Preview of Parsed Items */}
        {parsedItems.length > 0 && (
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 mt-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                Questions Preview ({parsedItems.length} items detected)
              </span>
              <button
                type="button"
                onClick={() => setParsedItems([])}
                className="text-[11px] font-bold text-rose-600 hover:text-rose-800 cursor-pointer"
              >
                Clear Preview
              </button>
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {parsedItems.map((item, idx) => (
                <div
                  key={idx}
                  className="p-2 rounded-xl bg-white border border-slate-200/80 flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 font-black text-[10px] flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <span className="font-bold text-slate-800 truncate text-xs">{item.question}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-bold text-[10px] uppercase">
                      {item.type}
                    </span>
                    {item.required && (
                      <span className="px-1.5 py-0.5 rounded-md bg-rose-50 text-rose-700 font-extrabold text-[10px]">
                        Req
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Options & Action Footer */}
        <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={replaceExisting}
              onChange={(e) => setReplaceExisting(e.target.checked)}
              className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
            />
            <span className="text-xs font-semibold text-slate-700">
              Replace existing questions (unchecked = append to current list)
            </span>
          </label>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs cursor-pointer transition"
            >
              Cancel
            </button>
            {parsedItems.length > 0 && (
              <button
                type="button"
                onClick={() => handleConfirmImport(parsedItems)}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs cursor-pointer shadow-sm transition active:scale-95"
              >
                Import {parsedItems.length} Question{parsedItems.length > 1 ? 's' : ''}
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}
