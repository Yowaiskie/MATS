import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { EventForm, EventFormQuestion, EventFormResponse, CompanionEntry } from '@/types/eventForm'

const formatDate = (d: Date): string => {
  return d.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  })
}

const formatTime = (d: Date): string => {
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
}

const loadImage = (url: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'Anonymous'
    img.onload = () => resolve(img)
    img.onerror = err => reject(err)
    img.src = url
  })
}

import type { SignatureConfig } from '@/types/signature'
import { renderPdfSignatures } from '@/utils/pdfSignatureHelper'
import { formatDocCodeWithDate, applyStandardPdfFooters } from '@/utils/pdfFooterHelper'

export interface EventFormPdfOptions {
  documentTitle: string
  selectedQuestionIds: string[] // List of question IDs or special fields like 'respondent_name', 'submitted_at'
  columnCustomLabels?: Record<string, string> // Custom column label overrides
  filterQuestionId?: string
  filterValue?: string
  orientation?: 'portrait' | 'landscape'
  membersMap?: Record<string, string>
  signatureConfig?: SignatureConfig
}

export const downloadEventFormPdf = async (
  form: EventForm,
  questions: EventFormQuestion[],
  responses: EventFormResponse[],
  options: EventFormPdfOptions
): Promise<void> => {
  const now = new Date()
  const dateStr = formatDate(now)
  const timeStr = formatTime(now)
  const orientation = options.orientation || 'landscape'

  const doc = new jsPDF({
    orientation,
    unit: 'mm',
    format: 'a4'
  })

  const pageWidth = doc.internal.pageSize.getWidth()

  // 1. Prepare Logos for Header on Every Page
  let logoParish: HTMLImageElement | null = null
  let logoMinistry: HTMLImageElement | null = null
  try {
    logoParish = await loadImage('/parish-logo.png')
  } catch {
    try {
      logoParish = await loadImage('/favicon/favicon.png')
    } catch {
      // Fallback
    }
  }

  try {
    logoMinistry = await loadImage('/ministy_logo.jpg')
  } catch {
    // Fallback
  }

  // 2. Document Title
  const titleText = (options.documentTitle.trim() || form.title).toUpperCase()

  // Filter Responses if configured
  let filteredResponses = responses
  if (options.filterQuestionId && options.filterValue) {
    filteredResponses = responses.filter(r => {
      const val = r.answers[options.filterQuestionId!]
      if (val === undefined || val === null) return false
      const targetStr = Array.isArray(val) ? val.join(', ') : String(val)
      return targetStr.toLowerCase().trim() === options.filterValue!.toLowerCase().trim()
    })
  }

  const membersMap = options.membersMap || {}

  // Helper to get clean name without Order group (e.g. "Bacolod, Iverjohn Cadfael")
  const getCleanMemberName = (r: EventFormResponse): string => {
    let name = r.respondentMemberName || (r.respondentMemberUid ? membersMap[r.respondentMemberUid] : '') || 'Anonymous'
    // Remove order parenthesis e.g. " (St. Jude)"
    return name.replace(/\s*\([^)]*\)/g, '').trim().toUpperCase()
  }

  // 3. Alphabetical Sort A-Z by Respondent Name
  filteredResponses.sort((a, b) => {
    const nameA = getCleanMemberName(a)
    const nameB = getCleanMemberName(b)
    return nameA.localeCompare(nameB)
  })

  // 4. Prepare Table Columns & Rows with Sequential Numbering (#)
  const sortedQuestions = [...questions].sort((a, b) => a.order - b.order)

  // Ensure 'respondent_name' is ALWAYS the first column right after '#' if selected
  let orderedColIds = [...options.selectedQuestionIds]
  if (orderedColIds.includes('respondent_name')) {
    orderedColIds = ['respondent_name', ...orderedColIds.filter(id => id !== 'respondent_name')]
  }

  // Build Headers: starts with '#' numbering column, uppercase all headers
  const tableHeaders: string[] = ['#']
  const columnKeys: string[] = []

  orderedColIds.forEach(colId => {
    if (colId === 'respondent_name') {
      tableHeaders.push((options.columnCustomLabels?.[colId] || 'Member / Respondent').toUpperCase())
      columnKeys.push(colId)
    } else if (colId === 'respondent_email') {
      tableHeaders.push((options.columnCustomLabels?.[colId] || 'Email').toUpperCase())
      columnKeys.push(colId)
    } else if (colId === 'submitted_at') {
      tableHeaders.push((options.columnCustomLabels?.[colId] || 'Submitted Date').toUpperCase())
      columnKeys.push(colId)
    } else {
      const q = sortedQuestions.find(item => item.id === colId)
      if (q) {
        tableHeaders.push((options.columnCustomLabels?.[colId] || q.question).toUpperCase())
        columnKeys.push(colId)
      }
    }
  })

  // Build Row Data with Numbering (1, 2, 3...)
  const tableRows = filteredResponses.map((r, rIdx) => {
    const rowCells: string[] = [String(rIdx + 1)]

    columnKeys.forEach(key => {
      if (key === 'respondent_name') {
        rowCells.push(getCleanMemberName(r))
      } else if (key === 'respondent_email') {
        rowCells.push((r.respondentEmail || '-').toUpperCase())
      } else if (key === 'submitted_at') {
        const submittedDateStr = r.submittedAt && typeof r.submittedAt === 'object' && 'seconds' in r.submittedAt
          ? new Date((r.submittedAt as any).seconds * 1000).toLocaleDateString()
          : String(r.submittedAt || '-')
        rowCells.push(submittedDateStr.toUpperCase())
      } else {
        const q = sortedQuestions.find(item => item.id === key)
        const val = r.answers[key]
        let displayVal = '-'
        if (val !== undefined && val !== null && val !== '') {
          if (q && q.type === 'companion_repeater' && Array.isArray(val)) {
            const companionEntries = (val as unknown as CompanionEntry[])
            if (companionEntries.length === 1) {
              const c = companionEntries[0]
              displayVal = `${c.name}${c.relationship ? ` (${c.relationship})` : ''}${c.notes ? ` - ${c.notes}` : ''}`
            } else {
              displayVal = companionEntries
                .map((c, idx) => `${idx + 1}. ${c.name}${c.relationship ? ` (${c.relationship})` : ''}${c.notes ? ` - ${c.notes}` : ''}`)
                .join('\n')
            }
          } else if (q && q.type === 'member_selector' && typeof val === 'string') {
            const rawName = membersMap[val] || val
            displayVal = rawName.replace(/\s*\([^)]*\)/g, '').trim()
          } else if (typeof val === 'string' && membersMap[val]) {
            displayVal = membersMap[val].replace(/\s*\([^)]*\)/g, '').trim()
          } else {
            displayVal = Array.isArray(val) ? val.join(', ') : String(val)
          }
        }
        rowCells.push(displayVal.toUpperCase())
      }
    })

    return rowCells
  })

  // Determine dynamic comfortable font sizes based on column count
  const isDense = tableHeaders.length > 5
  const headerFontSize = isDense ? 10 : 11.5
  const bodyFontSize = isDense ? 9.5 : 10.5
  const cellPadding = isDense ? 3 : 3.8

  const drawUniformHeader = () => {
    // 1. Draw Official Header (Dual Logos on Right Side: Parish & Ministry) on EVERY page
    if (logoParish && logoMinistry) {
      doc.addImage(logoParish, 'PNG', pageWidth - 48, 6.5, 16, 16)
      doc.addImage(logoMinistry, 'JPEG', pageWidth - 30, 6.5, 16, 16)
    } else if (logoMinistry) {
      doc.addImage(logoMinistry, 'JPEG', pageWidth - 28, 6.5, 16, 16)
    } else if (logoParish) {
      doc.addImage(logoParish, 'PNG', pageWidth - 28, 6.5, 16, 16)
    }

    // Left Parish Text
    doc.setFont('times', 'bolditalic')
    doc.setFontSize(16)
    doc.setTextColor(15, 23, 42)
    doc.text('Ministry of Altar Servers', 14, 14)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(51, 65, 85)
    doc.text('Sacred Heart of Jesus Parish - Mbs', 14, 19.5)
    doc.text('Pilar Rd., Morning Breeze Subdivision, Caloocan City', 14, 24)

    // Horizontal Header Divider Line
    doc.setDrawColor(30, 41, 59)
    doc.setLineWidth(0.6)
    doc.line(14, 28, pageWidth - 14, 28)

    // 2. Document Title (Centered & Bold Underline Style)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(15)
    doc.setTextColor(15, 23, 42)
    const titleWidth = doc.getTextWidth(titleText)
    const titleX = (pageWidth - titleWidth) / 2
    const titleY = 37
    doc.text(titleText, titleX, titleY)
    doc.setLineWidth(0.5)
    doc.line(titleX, titleY + 1.2, titleX + titleWidth, titleY + 1.2)

    // Sub-header Metadata Row
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.5)
    doc.setTextColor(71, 85, 105)
    doc.text(`Generated: ${dateStr} at ${timeStr}`, 14, 45)
    doc.text(`Total Records: ${filteredResponses.length}`, pageWidth - 14, 45, { align: 'right' })

  }

  // 5. Draw AutoTable
  autoTable(doc, {
    startY: 49,
    head: [tableHeaders],
    body: tableRows,
    theme: 'grid',
    showHead: 'everyPage',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontSize: headerFontSize,
      fontStyle: 'bold',
      halign: 'left',
      cellPadding: cellPadding
    },
    bodyStyles: {
      fontSize: bodyFontSize,
      textColor: [15, 23, 42],
      cellPadding: cellPadding,
      fontStyle: 'normal'
    },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center', fontStyle: 'bold' } // '#' numbering column styling
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    margin: { left: 14, right: 14, top: 49, bottom: 16 }
  })

  let currentY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 8 : 55

  // 6. Draw Dynamic Signatures
  if (options.signatureConfig?.enabled && options.signatureConfig.signatories.length > 0) {
    currentY = renderPdfSignatures(doc, options.signatureConfig.signatories, currentY, {
      leftMargin: 14,
      rightMargin: 14,
      bottomMargin: 18,
      topMarginOnNewPage: 49
    })
  }

  // 7. Draw uniform headers across all generated pages
  const totalPages = (doc as any).internal.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    drawUniformHeader()
  }

  // Apply uniform standard footer across all pages
  const docCode = formatDocCodeWithDate('EFRM', now)
  applyStandardPdfFooters(doc, docCode, { leftMargin: 14, rightMargin: 14 })

  // Save PDF
  const safeTitle = form.title.toLowerCase().replace(/[^a-z0-9]/g, '_')
  const filename = `${safeTitle}_report_${now.toISOString().split('T')[0]}.pdf`
  doc.save(filename)
}
