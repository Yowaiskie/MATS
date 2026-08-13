import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { EventForm, EventFormQuestion, EventFormResponse } from '@/types/eventForm'

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

export interface EventFormPdfOptions {
  documentTitle: string
  selectedQuestionIds: string[] // List of question IDs or special fields like 'respondent_name', 'submitted_at'
  columnCustomLabels?: Record<string, string> // Custom column label overrides
  filterQuestionId?: string
  filterValue?: string
  orientation?: 'portrait' | 'landscape'
  membersMap?: Record<string, string>
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

  // 1. Draw Official Header (Single Ministry Logo on Right Side)
  let logoImg: HTMLImageElement | null = null
  try {
    logoImg = await loadImage('/ministy_logo.jpg')
  } catch {
    try {
      logoImg = await loadImage('/favicon/icon-192.png')
    } catch {
      // Fallback if image not found
    }
  }

  // Single logo on upper right
  if (logoImg) {
    doc.addImage(logoImg, 'JPEG', pageWidth - 26, 8, 15, 15)
  }

  // Left Parish Text
  doc.setFont('times', 'bolditalic')
  doc.setFontSize(15)
  doc.setTextColor(15, 23, 42)
  doc.text('Ministry of Altar Servers', 14, 14)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(51, 65, 85)
  doc.text('Sacred Heart of Jesus Parish - Mbs', 14, 19)
  doc.text('Pilar Rd., Morning Breeze Subdivision, Caloocan City', 14, 23)

  // Horizontal Header Divider Line
  doc.setDrawColor(30, 41, 59)
  doc.setLineWidth(0.6)
  doc.line(14, 27, pageWidth - 14, 27)

  // 2. Document Title (Centered & Bold Underline Style)
  const titleText = options.documentTitle.trim() || form.title.toUpperCase()
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(15, 23, 42)
  const titleWidth = doc.getTextWidth(titleText)
  const titleX = (pageWidth - titleWidth) / 2
  const titleY = 35
  doc.text(titleText, titleX, titleY)
  doc.setLineWidth(0.4)
  doc.line(titleX, titleY + 1, titleX + titleWidth, titleY + 1)

  // Sub-header Metadata Row
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(100, 116, 139)
  doc.text(`Generated: ${dateStr} at ${timeStr}`, 14, 42)

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
    return name.replace(/\s*\([^)]*\)/g, '').trim()
  }

  // 3. Alphabetical Sort A-Z by Respondent Name
  filteredResponses.sort((a, b) => {
    const nameA = getCleanMemberName(a)
    const nameB = getCleanMemberName(b)
    return nameA.localeCompare(nameB)
  })

  doc.text(`Total Records: ${filteredResponses.length}`, pageWidth - 14, 42, { align: 'right' })

  // 4. Prepare Table Columns & Rows with Sequential Numbering (#)
  const sortedQuestions = [...questions].sort((a, b) => a.order - b.order)

  // Ensure 'respondent_name' is ALWAYS the first column right after '#' if selected
  let orderedColIds = [...options.selectedQuestionIds]
  if (orderedColIds.includes('respondent_name')) {
    orderedColIds = ['respondent_name', ...orderedColIds.filter(id => id !== 'respondent_name')]
  }

  // Build Headers: starts with '#' numbering column
  const tableHeaders: string[] = ['#']
  const columnKeys: string[] = []

  orderedColIds.forEach(colId => {
    if (colId === 'respondent_name') {
      tableHeaders.push(options.columnCustomLabels?.[colId] || 'Member / Respondent')
      columnKeys.push(colId)
    } else if (colId === 'respondent_email') {
      tableHeaders.push(options.columnCustomLabels?.[colId] || 'Email')
      columnKeys.push(colId)
    } else if (colId === 'submitted_at') {
      tableHeaders.push(options.columnCustomLabels?.[colId] || 'Submitted Date')
      columnKeys.push(colId)
    } else {
      const q = sortedQuestions.find(item => item.id === colId)
      if (q) {
        tableHeaders.push(options.columnCustomLabels?.[colId] || q.question)
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
        rowCells.push(r.respondentEmail || '-')
      } else if (key === 'submitted_at') {
        const submittedDateStr = r.submittedAt && typeof r.submittedAt === 'object' && 'seconds' in r.submittedAt
          ? new Date((r.submittedAt as any).seconds * 1000).toLocaleDateString()
          : String(r.submittedAt || '-')
        rowCells.push(submittedDateStr)
      } else {
        const q = sortedQuestions.find(item => item.id === key)
        const val = r.answers[key]
        let displayVal = '-'
        if (val !== undefined && val !== null && val !== '') {
          if (q && q.type === 'member_selector' && typeof val === 'string') {
            const rawName = membersMap[val] || val
            displayVal = rawName.replace(/\s*\([^)]*\)/g, '').trim()
          } else if (typeof val === 'string' && membersMap[val]) {
            displayVal = membersMap[val].replace(/\s*\([^)]*\)/g, '').trim()
          } else {
            displayVal = Array.isArray(val) ? val.join(', ') : String(val)
          }
        }
        rowCells.push(displayVal)
      }
    })

    return rowCells
  })

  // 5. Draw AutoTable
  autoTable(doc, {
    startY: 46,
    head: [tableHeaders],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontSize: 8.5,
      fontStyle: 'bold',
      halign: 'left',
      cellPadding: 2.5
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [51, 65, 85],
      cellPadding: 2.5
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center', fontStyle: 'bold' } // '#' numbering column styling
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    margin: { left: 14, right: 14, top: 46, bottom: 16 },
    didDrawPage: (data) => {
      // Footer page numbers
      const pageCount = (doc as any).internal.getNumberOfPages()
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.setTextColor(148, 163, 184)
      doc.text(
        `Page ${data.pageNumber} of ${pageCount} - MATS Official Event Form Report`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 8,
        { align: 'center' }
      )
    }
  })

  // Save PDF
  const safeTitle = form.title.toLowerCase().replace(/[^a-z0-9]/g, '_')
  const filename = `${safeTitle}_report_${now.toISOString().split('T')[0]}.pdf`
  doc.save(filename)
}
