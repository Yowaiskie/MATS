import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const formatDate = (d: Date): string => {
  return d.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

const formatTime = (d: Date): string => {
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

const loadImage = (url: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'Anonymous'
    img.onload = () => resolve(img)
    img.onerror = (err) => reject(err)
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
    format: 'a4',
  })

  // Try loading logo
  try {
    const logoImg = await loadImage('/favicon/icon-192.png')
    doc.addImage(logoImg, 'PNG', 14, 10, 14, 14)
  } catch (err) {
    console.warn('Logo image could not be loaded for PDF:', err)
  }

  // Header Title
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(15, 23, 42)
  doc.text('Ministry of Altar Servers', 32, 16)

  // Subtitle
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(37, 99, 235)
  // Check if string fits, truncate if needed
  let evName = data.eventName
  if (evName.length > 40) {
    evName = evName.substring(0, 40) + '...'
  }
  doc.text(`Event Financial Report: ${evName}`, 32, 22)

  // Metadata Right
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(100, 116, 139)
  doc.text(`Generated: ${dateStr} at ${timeStr}`, 196, 16, { align: 'right' })

  // Divider Line
  doc.setDrawColor(37, 99, 235)
  doc.setLineWidth(0.5)
  doc.line(14, 27, 196, 27)

  // Executive Summary Section
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(15, 23, 42)
  doc.text('Executive Summary', 14, 40)

  // Draw Summary Boxes
  const startY = 45
  const boxWidth = 42
  const boxHeight = 18
  const gap = 4.5
  
  // Total Income Box
  doc.setDrawColor(226, 232, 240)
  doc.setFillColor(248, 250, 252)
  doc.roundedRect(14, startY, boxWidth, boxHeight, 2, 2, 'FD')
  doc.setFontSize(8)
  doc.setTextColor(100, 116, 139)
  doc.text('Total Income', 14 + boxWidth/2, startY + 6, { align: 'center' })
  doc.setFontSize(11)
  doc.setTextColor(22, 163, 74) // green-600
  doc.text(`P ${data.totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 14 + boxWidth/2, startY + 13, { align: 'center' })

  // Total Expenses Box
  doc.setDrawColor(226, 232, 240)
  doc.setFillColor(248, 250, 252)
  doc.roundedRect(14 + boxWidth + gap, startY, boxWidth, boxHeight, 2, 2, 'FD')
  doc.setFontSize(8)
  doc.setTextColor(100, 116, 139)
  doc.text('Total Expenses', 14 + boxWidth + gap + boxWidth/2, startY + 6, { align: 'center' })
  doc.setFontSize(11)
  doc.setTextColor(220, 38, 38) // red-600
  doc.text(`P ${data.totalExpense.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 14 + boxWidth + gap + boxWidth/2, startY + 13, { align: 'center' })

  // Transferred Box
  doc.setDrawColor(226, 232, 240)
  doc.setFillColor(248, 250, 252)
  doc.roundedRect(14 + (boxWidth + gap)*2, startY, boxWidth, boxHeight, 2, 2, 'FD')
  doc.setFontSize(8)
  doc.setTextColor(100, 116, 139)
  doc.text('Transferred', 14 + (boxWidth + gap)*2 + boxWidth/2, startY + 6, { align: 'center' })
  doc.setFontSize(11)
  doc.setTextColor(37, 99, 235) // blue-600
  doc.text(`P ${data.totalTransfer.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 14 + (boxWidth + gap)*2 + boxWidth/2, startY + 13, { align: 'center' })

  // Remaining Balance Box
  if (data.balance >= 0) {
    doc.setDrawColor(187, 247, 208)
    doc.setFillColor(240, 253, 244)
    doc.setTextColor(21, 128, 61)
  } else {
    doc.setDrawColor(254, 202, 202)
    doc.setFillColor(254, 242, 242)
    doc.setTextColor(185, 28, 28)
  }
  doc.roundedRect(14 + (boxWidth + gap)*3, startY, boxWidth, boxHeight, 2, 2, 'FD')
  doc.setFontSize(8)
  doc.text('Remaining Balance', 14 + (boxWidth + gap)*3 + boxWidth/2, startY + 6, { align: 'center' })
  doc.setFontSize(11)
  doc.text(`P ${data.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 14 + (boxWidth + gap)*3 + boxWidth/2, startY + 13, { align: 'center' })

  let currentY = startY + boxHeight + 15

  // Income Breakdown Table
  const incTableHead = [['Source / Sponsor', 'Amount (P)']]
  const incTableBody = Object.entries(data.incomeByCategory)
    .sort((a,b) => b[1] - a[1])
    .map(([source, amount]) => [
      source,
      amount.toLocaleString('en-US', { minimumFractionDigits: 2 })
    ])

  if (incTableBody.length > 0) {
    autoTable(doc, {
      startY: currentY,
      head: incTableHead,
      body: incTableBody,
      theme: 'grid',
      headStyles: {
        fillColor: [241, 245, 249],
        textColor: [51, 65, 85],
        fontSize: 9,
        fontStyle: 'bold',
      },
      bodyStyles: {
        fontSize: 9,
        textColor: [51, 65, 85],
      },
      columnStyles: {
        1: { halign: 'right', textColor: [22, 163, 74], fontStyle: 'bold' } // green
      },
      margin: { left: 14, right: 14 },
      didDrawPage: (data) => {
        currentY = data.cursor ? data.cursor.y : currentY
      }
    })
    currentY = (doc as any).lastAutoTable.finalY + 15
  } else {
    doc.setFontSize(10)
    doc.setTextColor(100, 116, 139)
    doc.text('No income recorded.', 14, currentY)
    currentY += 15
  }

  // Expense Breakdown Table
  const expTableHead = [['Item / Service', 'Amount (P)']]
  const expTableBody = Object.entries(data.expenseByCategory)
    .sort((a,b) => b[1] - a[1])
    .map(([item, amount]) => [
      item,
      amount.toLocaleString('en-US', { minimumFractionDigits: 2 })
    ])

  if (expTableBody.length > 0) {
    autoTable(doc, {
      startY: currentY,
      head: expTableHead,
      body: expTableBody,
      theme: 'grid',
      headStyles: {
        fillColor: [241, 245, 249],
        textColor: [51, 65, 85],
        fontSize: 9,
        fontStyle: 'bold',
      },
      bodyStyles: {
        fontSize: 9,
        textColor: [51, 65, 85],
      },
      columnStyles: {
        1: { halign: 'right', textColor: [220, 38, 38], fontStyle: 'bold' } // red
      },
      margin: { left: 14, right: 14 }
    })
  } else {
    doc.setFontSize(10)
    doc.setTextColor(100, 116, 139)
    doc.text('No expenses recorded.', 14, currentY)
  }

  // Footer
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(148, 163, 184)
    doc.text('MATS Portal • Official Ministry Report', 14, 285)
    doc.text(`Page ${i} of ${pageCount}`, 196, 285, { align: 'right' })
  }

  // Use a safer filename
  const safeEventName = data.eventName.replace(/[^a-z0-9]/gi, '_').toLowerCase()
  const filename = `Event_Finance_Report_${safeEventName}_${now.toISOString().split('T')[0]}.pdf`
  doc.save(filename)
}
