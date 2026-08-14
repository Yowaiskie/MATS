import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { EventContribution } from '@/types/eventContribution'

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

export interface ContributionReportData {
  eventName: string
  contributions: EventContribution[]
  filterDescription?: string
}

export const downloadEventContributionReportPdf = async (
  data: ContributionReportData
): Promise<void> => {
  const now = new Date()
  const dateStr = formatDate(now)
  const timeStr = formatTime(now)

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const pageWidth = doc.internal.pageSize.getWidth()

  // 1. Draw Official Header (Single Ministry Logo on Right Side - matching Event Forms PDF)
  let logoImg: HTMLImageElement | null = null
  try {
    logoImg = await loadImage('/ministy_logo.jpg')
  } catch {
    try {
      logoImg = await loadImage('/favicon/icon-192.png')
    } catch {
      // Fallback
    }
  }

  if (logoImg) {
    doc.addImage(logoImg, 'JPEG', pageWidth - 26, 8, 15, 15)
  }

  // Left Parish Branding
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

  // 2. Document Title (Centered & Bold Underline Style - matching Event Forms PDF)
  const titleText = `EVENT CONTRIBUTION REPORT: ${data.eventName.toUpperCase()}`
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
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

  // Active records metrics calculation
  const activeRecords = data.contributions.filter(c => c.status === 'recorded')
  const totalAmount = activeRecords.reduce((acc, c) => acc + c.amount, 0)

  doc.text(`Total Records: ${data.contributions.length} (${activeRecords.length} Active) | Total: PHP ${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, pageWidth - 14, 42, { align: 'right' })

  let currentY = 48

  // Detailed Records Table
  const tableHead = [['#', 'Contributor Name', 'Held By', 'Purpose', 'Payment Method', 'Ref #', 'Date', 'Link Status', 'Amount (PHP)']]
  const tableBody = data.contributions.map((c, index) => {
    let linkStatus = 'Not Linked'
    if (c.linkedFinanceIncomeId) {
      linkStatus = 'Linked'
    }
    const dateObj = c.contributedAt?.toDate ? c.contributedAt.toDate() : new Date(c.contributedAt as any)
    const formattedContributedDate = dateObj.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })

    const methodLabels: Record<string, string> = {
      cash: 'Cash',
      gcash: 'GCash',
      bank_transfer: 'Bank Transfer',
      other: 'Other'
    }

    return [
      (index + 1).toString(),
      c.contributorName,
      c.collectedByName || 'N/A',
      c.purposeName,
      methodLabels[c.paymentMethod] || c.paymentMethod,
      c.referenceNumber || '—',
      formattedContributedDate,
      c.status === 'voided' ? 'VOIDED' : linkStatus,
      c.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })
    ]
  })

  autoTable(doc, {
    startY: currentY,
    head: tableHead,
    body: tableBody,
    theme: 'grid',
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontSize: 8.5,
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [51, 65, 85],
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      8: { halign: 'right', fontStyle: 'bold', textColor: [15, 23, 42] }
    },
    margin: { left: 14, right: 14 },
    didDrawPage: (d) => {
      currentY = d.cursor ? d.cursor.y : currentY
    }
  })

  // Footer (matching Event Forms PDF)
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(148, 163, 184)
    doc.text('Ministry of Altar Servers • Sacred Heart of Jesus Parish - MBS', 14, 285)
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 14, 285, { align: 'right' })
  }

  const safeEventName = data.eventName.replace(/[^a-z0-9]/gi, '_').toLowerCase()
  const filename = `Contributions_Report_${safeEventName}_${now.toISOString().split('T')[0]}.pdf`
  doc.save(filename)
}
