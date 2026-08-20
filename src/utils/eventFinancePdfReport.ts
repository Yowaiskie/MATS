import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

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

export interface EventFinanceReportData {
  eventName: string
  totalIncome: number
  totalExpense: number
  totalTransfer: number
  balance: number
  incomeByCategory: Record<string, number>
  expenseByCategory: Record<string, number>
}

export const downloadEventFinanceReportPdf = async (
  data: EventFinanceReportData
): Promise<void> => {
  const now = new Date()
  const dateStr = formatDate(now)
  const timeStr = formatTime(now)

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  // 1. Prepare Logo for Header
  let logoImg: HTMLImageElement | null = null
  try {
    logoImg = await loadImage('/ministy_logo.jpg')
  } catch {
    try {
      logoImg = await loadImage('/favicon/favicon.png')
    } catch {
      try {
        logoImg = await loadImage('/favicon/icon-192.png')
      } catch {
        // Fallback if image not found
      }
    }
  }

  // 2. Helper to draw Uniform Header & Footer on every page
  const drawUniformHeader = (pageNumber: number, totalPages: number) => {
    // Single Ministry Logo on Right Side
    if (logoImg) {
      doc.addImage(logoImg, 'JPEG', pageWidth - 26, 8, 15, 15)
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

    // Footer on bottom of page
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(148, 163, 184)
    doc.text(
      `Page ${pageNumber} of ${totalPages} - MATS Official Event Financial Report`,
      pageWidth / 2,
      pageHeight - 8,
      { align: 'center' }
    )
  }

  // Document Title (Centered & Bold Underline Style)
  const titleText = `EVENT FINANCIAL STATEMENT: ${data.eventName.toUpperCase()}`
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13.5)
  doc.setTextColor(15, 23, 42)
  const titleWidth = doc.getTextWidth(titleText)
  const titleX = (pageWidth - titleWidth) / 2
  const titleY = 37
  doc.text(titleText, titleX, titleY)
  doc.setLineWidth(0.5)
  doc.setDrawColor(15, 23, 42)
  doc.line(titleX, titleY + 1.2, titleX + titleWidth, titleY + 1.2)

  // Sub-header Metadata Row
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(71, 85, 105)
  doc.text(`Event: ${data.eventName}`, 14, 45)
  doc.text(`Generated: ${dateStr} at ${timeStr}`, pageWidth - 14, 45, { align: 'right' })

  // Section: Executive Summary Boxes
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  doc.setTextColor(15, 23, 42)
  doc.text('EXECUTIVE FINANCIAL SUMMARY', 14, 53)

  const startY = 56
  const hasTransfers = data.totalTransfer > 0
  const boxHeight = 17

  if (hasTransfers) {
    const boxWidth = 42
    const gap = 4.6

    // 1. Total Income Box
    doc.setDrawColor(226, 232, 240)
    doc.setFillColor(248, 250, 252)
    doc.roundedRect(14, startY, boxWidth, boxHeight, 2, 2, 'FD')
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(100, 116, 139)
    doc.text('TOTAL INCOME', 14 + boxWidth / 2, startY + 5.5, { align: 'center' })
    doc.setFontSize(9.5)
    doc.setTextColor(22, 163, 74)
    doc.text(`+P ${data.totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 14 + boxWidth / 2, startY + 12.5, { align: 'center' })

    // 2. Total Expenses Box
    doc.setDrawColor(226, 232, 240)
    doc.setFillColor(248, 250, 252)
    doc.roundedRect(14 + boxWidth + gap, startY, boxWidth, boxHeight, 2, 2, 'FD')
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(100, 116, 139)
    doc.text('TOTAL EXPENSES', 14 + boxWidth + gap + boxWidth / 2, startY + 5.5, { align: 'center' })
    doc.setFontSize(9.5)
    doc.setTextColor(220, 38, 38)
    doc.text(`-P ${data.totalExpense.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 14 + boxWidth + gap + boxWidth / 2, startY + 12.5, { align: 'center' })

    // 3. Transfer to Fund Box
    doc.setDrawColor(226, 232, 240)
    doc.setFillColor(248, 250, 252)
    doc.roundedRect(14 + (boxWidth + gap) * 2, startY, boxWidth, boxHeight, 2, 2, 'FD')
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(100, 116, 139)
    doc.text('TRANSFER TO FUND', 14 + (boxWidth + gap) * 2 + boxWidth / 2, startY + 5.5, { align: 'center' })
    doc.setFontSize(9.5)
    doc.setTextColor(37, 99, 235)
    doc.text(`P ${data.totalTransfer.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 14 + (boxWidth + gap) * 2 + boxWidth / 2, startY + 12.5, { align: 'center' })

    // 4. Remaining Balance Box
    if (data.balance >= 0) {
      doc.setDrawColor(187, 247, 208)
      doc.setFillColor(240, 253, 244)
      doc.setTextColor(21, 128, 61)
    } else {
      doc.setDrawColor(254, 202, 202)
      doc.setFillColor(254, 242, 242)
      doc.setTextColor(185, 28, 28)
    }
    doc.roundedRect(14 + (boxWidth + gap) * 3, startY, boxWidth, boxHeight, 2, 2, 'FD')
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'bold')
    doc.text('REMAINING BALANCE', 14 + (boxWidth + gap) * 3 + boxWidth / 2, startY + 5.5, { align: 'center' })
    doc.setFontSize(9.5)
    doc.text(`P ${data.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 14 + (boxWidth + gap) * 3 + boxWidth / 2, startY + 12.5, { align: 'center' })
  } else {
    // 3 Boxes layout when no transfers exist (182mm available width)
    const gap = 5
    const boxWidth = 57.33

    // 1. Total Income Box
    doc.setDrawColor(226, 232, 240)
    doc.setFillColor(248, 250, 252)
    doc.roundedRect(14, startY, boxWidth, boxHeight, 2, 2, 'FD')
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(100, 116, 139)
    doc.text('TOTAL INCOME', 14 + boxWidth / 2, startY + 5.5, { align: 'center' })
    doc.setFontSize(10)
    doc.setTextColor(22, 163, 74)
    doc.text(`+P ${data.totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 14 + boxWidth / 2, startY + 12.5, { align: 'center' })

    // 2. Total Expenses Box
    doc.setDrawColor(226, 232, 240)
    doc.setFillColor(248, 250, 252)
    doc.roundedRect(14 + boxWidth + gap, startY, boxWidth, boxHeight, 2, 2, 'FD')
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(100, 116, 139)
    doc.text('TOTAL EXPENSES', 14 + boxWidth + gap + boxWidth / 2, startY + 5.5, { align: 'center' })
    doc.setFontSize(10)
    doc.setTextColor(220, 38, 38)
    doc.text(`-P ${data.totalExpense.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 14 + boxWidth + gap + boxWidth / 2, startY + 12.5, { align: 'center' })

    // 3. Remaining Balance Box
    if (data.balance >= 0) {
      doc.setDrawColor(187, 247, 208)
      doc.setFillColor(240, 253, 244)
      doc.setTextColor(21, 128, 61)
    } else {
      doc.setDrawColor(254, 202, 202)
      doc.setFillColor(254, 242, 242)
      doc.setTextColor(185, 28, 28)
    }
    doc.roundedRect(14 + (boxWidth + gap) * 2, startY, boxWidth, boxHeight, 2, 2, 'FD')
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'bold')
    doc.text('REMAINING BALANCE', 14 + (boxWidth + gap) * 2 + boxWidth / 2, startY + 5.5, { align: 'center' })
    doc.setFontSize(10)
    doc.text(`P ${data.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 14 + (boxWidth + gap) * 2 + boxWidth / 2, startY + 12.5, { align: 'center' })
  }

  let currentY = startY + boxHeight + 10

  // Section: Income Breakdown Table (Rendered only if entries exist)
  const incTableHead = [['#', 'SOURCE / SPONSOR', 'AMOUNT (P)']]
  const incTableBody = Object.entries(data.incomeByCategory || {})
    .filter(([_, amount]) => amount > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([source, amount], idx) => [
      String(idx + 1),
      source.toUpperCase(),
      amount.toLocaleString('en-US', { minimumFractionDigits: 2 })
    ])

  if (incTableBody.length > 0) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(15, 23, 42)
    doc.text('1. INCOMES BY SOURCE / SPONSOR', 14, currentY)
    currentY += 3.5

    autoTable(doc, {
      startY: currentY,
      head: incTableHead,
      body: incTableBody,
      theme: 'grid',
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontSize: 8.5,
        fontStyle: 'bold',
        cellPadding: 2.8
      },
      bodyStyles: {
        fontSize: 8.5,
        textColor: [15, 23, 42],
        cellPadding: 2.5
      },
      columnStyles: {
        0: { cellWidth: 12, halign: 'center', fontStyle: 'bold' },
        1: { cellWidth: 125 },
        2: { cellWidth: 45, halign: 'right', textColor: [22, 163, 74], fontStyle: 'bold' }
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      margin: { left: 14, right: 14 },
      didDrawPage: d => {
        currentY = d.cursor ? d.cursor.y : currentY
      }
    })
    currentY = (doc as any).lastAutoTable.finalY + 9
  }

  // Section: Expense Breakdown Table (Rendered only if entries exist)
  const expTableHead = [['#', 'ITEM / SERVICE', 'AMOUNT (P)']]
  const expTableBody = Object.entries(data.expenseByCategory || {})
    .filter(([_, amount]) => amount > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([item, amount], idx) => [
      String(idx + 1),
      item.toUpperCase(),
      amount.toLocaleString('en-US', { minimumFractionDigits: 2 })
    ])

  if (expTableBody.length > 0) {
    // Check page height before expenses section
    if (currentY > 225) {
      doc.addPage()
      currentY = 49
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(15, 23, 42)
    doc.text(incTableBody.length > 0 ? '2. EXPENSES BY ITEM / SERVICE' : '1. EXPENSES BY ITEM / SERVICE', 14, currentY)
    currentY += 3.5

    autoTable(doc, {
      startY: currentY,
      head: expTableHead,
      body: expTableBody,
      theme: 'grid',
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontSize: 8.5,
        fontStyle: 'bold',
        cellPadding: 2.8
      },
      bodyStyles: {
        fontSize: 8.5,
        textColor: [15, 23, 42],
        cellPadding: 2.5
      },
      columnStyles: {
        0: { cellWidth: 12, halign: 'center', fontStyle: 'bold' },
        1: { cellWidth: 125 },
        2: { cellWidth: 45, halign: 'right', textColor: [220, 38, 38], fontStyle: 'bold' }
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      margin: { left: 14, right: 14 },
      didDrawPage: d => {
        currentY = d.cursor ? d.cursor.y : currentY
      }
    })
  }

  // Draw uniform header and footer across all generated pages
  const totalPages = (doc as any).internal.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    drawUniformHeader(i, totalPages)
  }

  // Save PDF
  const safeEventName = data.eventName.replace(/[^a-z0-9]/gi, '_').toLowerCase()
  const filename = `Event_Finance_Report_${safeEventName}_${now.toISOString().split('T')[0]}.pdf`
  doc.save(filename)
}
