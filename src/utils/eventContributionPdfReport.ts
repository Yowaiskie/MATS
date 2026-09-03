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

import type { SignatureConfig } from '@/types/signature'
import { renderPdfSignatures } from '@/utils/pdfSignatureHelper'
import { formatDocCodeWithDate, applyStandardPdfFooters } from '@/utils/pdfFooterHelper'

export interface ContributionReportData {
  eventName: string
  contributions: EventContribution[]
  filterDescription?: string
}

export interface ContributionPdfOptions {
  documentTitle?: string
  signatureConfig?: SignatureConfig
}

export const downloadEventContributionReportPdf = async (
  data: ContributionReportData,
  options?: ContributionPdfOptions
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
        // Fallback
      }
    }
  }

  // 2. Helper to draw Uniform Header on every page
  const drawUniformHeader = () => {
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
  }

  // 3. Document Title (Centered & Bold Underline Style)
  const defaultTitle = `EVENT CONTRIBUTIONS REPORT: ${data.eventName.toUpperCase()}`
  const titleText = (options?.documentTitle?.trim() || defaultTitle).toUpperCase()
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

  // 4. Sub-header Metadata Row
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(71, 85, 105)
  const leftMeta = data.filterDescription ? `Filter: ${data.filterDescription}` : `Event: ${data.eventName}`
  doc.text(leftMeta, 14, 45)
  doc.text(`Generated: ${dateStr} at ${timeStr}`, pageWidth - 14, 45, { align: 'right' })

  // 5. Summary Metrics Section (Total Received, Total Voided, Balance)
  const validContributions = data.contributions.filter(c => c.status !== 'voided')
  const totalAmount = validContributions.reduce((sum, c) => sum + c.amount, 0)
  const voidedCount = data.contributions.filter(c => c.status === 'voided').length

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  doc.setTextColor(15, 23, 42)
  doc.text('COLLECTIONS SUMMARY', 14, 53)

  // Summary Card
  doc.setDrawColor(226, 232, 240)
  doc.setFillColor(248, 250, 252)
  doc.roundedRect(14, 56, pageWidth - 28, 14, 2, 2, 'FD')

  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139)
  doc.text('Total Collections Recorded:', 18, 65)

  doc.setFont('helvetica', 'bold')
  doc.setTextColor(22, 163, 74)
  doc.text(`PHP ${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 62, 65)

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139)
  doc.text(`Valid Entries: ${validContributions.length}  |  Voided Entries: ${voidedCount}`, pageWidth - 18, 65, { align: 'right' })

  // 6. Table of Contributions
  const tableHead = [
    ['#', 'DATE', 'CONTRIBUTOR', 'PURPOSE', 'COLLECTOR (C/O)', 'METHOD', 'REF #', 'STATUS', 'AMOUNT']
  ]

  const tableBody = data.contributions.map((c, idx) => {
    let contributedDate = '-'
    if (c.contributedAt && typeof c.contributedAt === 'object' && 'seconds' in c.contributedAt) {
      contributedDate = new Date((c.contributedAt as any).seconds * 1000).toLocaleDateString()
    } else if (c.createdAt && typeof c.createdAt === 'object' && 'seconds' in c.createdAt) {
      contributedDate = new Date((c.createdAt as any).seconds * 1000).toLocaleDateString()
    }

    return [
      String(idx + 1),
      contributedDate,
      c.contributorName.toUpperCase(),
      c.purposeName.toUpperCase(),
      (c.collectedByName || '—').toUpperCase(),
      c.paymentMethod.toUpperCase(),
      (c.referenceNumber || '—').toUpperCase(),
      c.status.toUpperCase(),
      `P ${c.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
    ]
  })

  let currentY = 75

  autoTable(doc, {
    startY: currentY,
    head: tableHead,
    body: tableBody,
    theme: 'grid',
    showHead: 'everyPage',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
      cellPadding: 2.5
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [15, 23, 42],
      cellPadding: 2.2
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8, fontStyle: 'bold' },
      1: { cellWidth: 18 },
      2: { fontStyle: 'bold', cellWidth: 32 },
      3: { cellWidth: 26 },
      4: { cellWidth: 26 },
      5: { cellWidth: 16 },
      6: { cellWidth: 18 },
      7: { halign: 'center', cellWidth: 16 },
      8: { halign: 'right', fontStyle: 'bold', textColor: [15, 23, 42], cellWidth: 22 }
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    margin: { left: 14, right: 14, top: 49, bottom: 16 }
  })

  currentY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 8 : currentY + 8

  // 7. Draw dynamic signatures if enabled
  if (options?.signatureConfig?.enabled && options.signatureConfig.signatories.length > 0) {
    currentY = renderPdfSignatures(doc, options.signatureConfig.signatories, currentY, {
      leftMargin: 14,
      rightMargin: 14,
      bottomMargin: 18,
      topMarginOnNewPage: 49
    })
  }

  // 8. Draw uniform header across all generated pages
  const totalPages = (doc as any).internal.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    drawUniformHeader()
  }

  // Apply uniform standard footer across all pages
  const docCode = formatDocCodeWithDate('ECR', now)
  applyStandardPdfFooters(doc, docCode, { leftMargin: 14, rightMargin: 14 })

  const safeEventName = data.eventName.replace(/[^a-z0-9]/gi, '_').toLowerCase()
  const filename = `Contributions_Report_${safeEventName}_${now.toISOString().split('T')[0]}.pdf`
  doc.save(filename)
}
