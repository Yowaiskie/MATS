import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { MemberReportRow } from '@/services/reportService'

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

export interface MemberPdfOptions {
  dateRange?: { start?: string; end?: string }
  documentTitle?: string
  signatureConfig?: SignatureConfig
}

/**
 * Generates direct download landscape PDF report matching the official Finance header style.
 * Includes official parish title, ministry logo, custom document title with underline,
 * metadata row, attendance metrics, status badges, and dynamic signatures.
 */
export const downloadMembersReportPdf = async (
  rows: MemberReportRow[],
  options?: MemberPdfOptions | { start?: string; end?: string }
): Promise<void> => {
  const now = new Date()
  const dateStr = formatDate(now)
  const timeStr = formatTime(now)

  // Normalize options parameter (support legacy dateRange or new MemberPdfOptions)
  const opts: MemberPdfOptions = options && ('signatureConfig' in options || 'documentTitle' in options)
    ? (options as MemberPdfOptions)
    : { dateRange: options as { start?: string; end?: string } }

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  })

  const pageWidth = doc.internal.pageSize.getWidth()

  // 1. Prepare Logos for Header
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

  // 2. Helper to draw Uniform Header across all pages
  const drawUniformHeader = () => {
    // Dual Logos on Right Side (Parish & Ministry)
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
  }

  // 3. Document Title (Centered & Bold Underline Style matching Finance)
  const defaultTitle = 'MEMBER MASTERLIST & ATTENDANCE REPORT'
  const titleText = (opts.documentTitle?.trim() || defaultTitle).toUpperCase()
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14.5)
  doc.setTextColor(15, 23, 42)
  const titleWidth = doc.getTextWidth(titleText)
  const titleX = (pageWidth - titleWidth) / 2
  const titleY = 37
  doc.text(titleText, titleX, titleY)
  doc.setLineWidth(0.5)
  doc.setDrawColor(15, 23, 42)
  doc.line(titleX, titleY + 1.2, titleX + titleWidth, titleY + 1.2)

  // 4. Sub-header Metadata Row
  const dateRange = opts.dateRange
  const rangeSubtitle = dateRange?.start || dateRange?.end
    ? `${dateRange.start || 'Start'} to ${dateRange.end || 'Present'}`
    : 'All Time Records'

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(71, 85, 105)
  doc.text(`Covered Period: ${rangeSubtitle}`, 14, 45)
  doc.text(
    `Generated: ${dateStr} at ${timeStr} • Total Records: ${rows.length}`,
    pageWidth - 14,
    45,
    { align: 'right' }
  )

  // 5. Define Table Columns
  const tableHead = [
    [
      '#',
      'MEMBER NAME',
      'RANK',
      'PRESENT',
      'LATE',
      'ABSENT',
      'EXCUSED',
      'ATTENDANCE %',
      'STATUS',
      'TRIGGERING ABSENCES',
    ],
  ]

  const tableBody = rows.map((r, index) => {
    let triggering = '—'
    if (r.warningStatus === 'suspended' || r.warningStatus === 'warning') {
      const parts = []
      if (r.sundayAbsences > 0) parts.push(`${r.sundayAbsences} Sun`)
      if (r.weekdayAbsences > 0) parts.push(`${r.weekdayAbsences} Wkday`)
      if (r.meetingAbsences > 0) parts.push(`${r.meetingAbsences} Mtg`)
      triggering = parts.join(', ') || `${r.absent} Absences`
    }

    return [
      String(index + 1),
      r.name.toUpperCase(),
      (r.rank || '—').toUpperCase(),
      String(r.present),
      String(r.late),
      String(r.absent),
      String(r.excused),
      `${r.rate.toFixed(1)}%`,
      r.warningStatus.toUpperCase(),
      triggering,
    ]
  })

  // 6. Generate Table using autoTable
  autoTable(doc, {
    startY: 49,
    head: tableHead,
    body: tableBody,
    theme: 'grid',
    showHead: 'everyPage',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontSize: 8.5,
      fontStyle: 'bold',
      halign: 'left',
      cellPadding: 2.5,
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [15, 23, 42],
      cellPadding: 2.2,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10, fontStyle: 'bold' },                             // #
      1: { fontStyle: 'bold', cellWidth: 52 },                                               // Name
      2: { cellWidth: 26 },                                                                  // Rank
      3: { halign: 'center', cellWidth: 18 },
      4: { halign: 'center', cellWidth: 18 },
      5: { halign: 'center', cellWidth: 18 },
      6: { halign: 'center', cellWidth: 18 },
      7: { halign: 'right', fontStyle: 'bold', cellWidth: 24 },
      8: { halign: 'center', fontStyle: 'bold', cellWidth: 26 },                             // Status Badge
      9: { fontSize: 7.5, cellWidth: 'auto' },                                               // Triggering Absences
    },
    margin: { left: 14, right: 14, top: 49, bottom: 16 },
    didParseCell: (data) => {
      // Style Status column (Column 8)
      if (data.section === 'body' && data.column.index === 8) {
        const val = String(data.cell.raw)
        if (val === 'SUSPENDED') {
          data.cell.styles.textColor = [185, 28, 28] // Red 700
          data.cell.styles.fillColor = [254, 226, 226] // Red 100
        } else if (val === 'WARNING') {
          data.cell.styles.textColor = [180, 83, 9]  // Amber 700
          data.cell.styles.fillColor = [254, 243, 199] // Amber 100
        } else if (val === 'INACTIVE') {
          data.cell.styles.textColor = [71, 85, 105] // Slate 700
          data.cell.styles.fillColor = [241, 245, 249] // Slate 100
        } else {
          data.cell.styles.textColor = [21, 128, 61] // Emerald 700
          data.cell.styles.fillColor = [220, 252, 231] // Emerald 100
        }
      }

      // Style Triggering Absences column (Column 9) with high-contrast alert font colors
      if (data.section === 'body' && data.column.index === 9) {
        const rowStatus = String(data.row.cells[8].raw)
        if (rowStatus === 'SUSPENDED') {
          data.cell.styles.textColor = [185, 28, 28] // Strong Red text for Suspended absences
          data.cell.styles.fontStyle = 'bold'
        } else if (rowStatus === 'WARNING') {
          data.cell.styles.textColor = [180, 83, 9]  // Strong Amber text for Warning absences
          data.cell.styles.fontStyle = 'bold'
        } else {
          data.cell.styles.textColor = [148, 163, 184] // Muted slate text for ACTIVE ('—')
        }
      }
    }
  })

  let currentY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 8 : 49

  // 7. Draw dynamic signatures if enabled
  if (opts.signatureConfig?.enabled && opts.signatureConfig.signatories.length > 0) {
    currentY = renderPdfSignatures(doc, opts.signatureConfig.signatories, currentY, {
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
  const docCode = formatDocCodeWithDate('MEM', now)
  applyStandardPdfFooters(doc, docCode, { leftMargin: 14, rightMargin: 14 })

  const filename = `Ministry_Members_Report_${now.toISOString().split('T')[0]}.pdf`
  doc.save(filename)
}
