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

export type PaperSize = 'long' | 'a4' | 'letter'

export interface MemberPdfOptions {
  dateRange?: { start?: string; end?: string }
  documentTitle?: string
  signatureConfig?: SignatureConfig
  paperSize?: PaperSize
  reportType?: 'standard' | 'pastoral_evaluation'
  evaluationsMap?: Record<string, string>
  selectedRanks?: string[]
}

/**
 * Generates direct download landscape PDF report matching the official Finance header style.
 * Includes official parish title, ministry logo, custom document title with underline,
 * metadata row, attendance metrics, status badges, and dynamic signatures.
 */
import {
  buildMemberReportTableData,
  type MemberReportTableData
} from './eventFormConsolidation.ts'

export { buildMemberReportTableData, type MemberReportTableData }

export const downloadMembersReportPdf = async (
  rows: MemberReportRow[],
  options?: MemberPdfOptions | { start?: string; end?: string }
): Promise<void> => {
  const now = new Date()
  const dateStr = formatDate(now)
  const timeStr = formatTime(now)

  // Normalize options parameter (support legacy dateRange or new MemberPdfOptions)
  const opts: MemberPdfOptions = options && (
    'signatureConfig' in options ||
    'documentTitle' in options ||
    'paperSize' in options ||
    'reportType' in options ||
    'evaluationsMap' in options
  )
    ? (options as MemberPdfOptions)
    : { dateRange: options as { start?: string; end?: string } }

  const isPastoral = opts.reportType === 'pastoral_evaluation'
  const paperSize: PaperSize = opts.paperSize || 'long'
  let docFormat: string | [number, number] = [215.9, 330.2]
  if (paperSize === 'a4') {
    docFormat = 'a4'
  } else if (paperSize === 'letter') {
    docFormat = 'letter'
  }

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: docFormat,
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const leftMargin = 14
  const rightMargin = 14

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
    doc.text('Ministry of Altar Servers', leftMargin, 14)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(51, 65, 85)
    doc.text('Sacred Heart of Jesus Parish - Mbs', leftMargin, 19.5)
    doc.text('Pilar Rd., Morning Breeze Subdivision, Caloocan City', leftMargin, 24)

    // Horizontal Header Divider Line
    doc.setDrawColor(30, 41, 59)
    doc.setLineWidth(0.6)
    doc.line(leftMargin, 28, pageWidth - rightMargin, 28)
  }

  // 3. Document Title (Centered & Bold Underline Style matching Finance)
  const defaultTitle = isPastoral
    ? 'ALTAR SERVERS PASTORAL EVALUATION & ATTENDANCE REPORT'
    : 'MEMBER MASTERLIST & ATTENDANCE REPORT'
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

  const rankSubtitle = opts.selectedRanks && opts.selectedRanks.length > 0
    ? ` • Ranks: ${opts.selectedRanks.join(', ')}`
    : ''

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(71, 85, 105)
  doc.text(`Covered Period: ${rangeSubtitle}${rankSubtitle}`, leftMargin, 45)
  doc.text(
    `Generated: ${dateStr} at ${timeStr} • Total Records: ${rows.length}`,
    pageWidth - rightMargin,
    45,
    { align: 'right' }
  )

  // 5. Define Table Columns and Rows
  const { tableHead, tableBody } = buildMemberReportTableData(rows, opts)

  // Column styling per report type
  const columnStyles = isPastoral
    ? {
        0: { halign: 'center' as const, cellWidth: 10, fontStyle: 'bold' as const },
        1: { fontStyle: 'bold' as const, cellWidth: 46 },
        2: { cellWidth: 26 },
        3: { halign: 'center' as const, cellWidth: 16 },
        4: { halign: 'center' as const, cellWidth: 16 },
        5: { halign: 'center' as const, cellWidth: 16 },
        6: { halign: 'center' as const, fontStyle: 'bold' as const, cellWidth: 22 },
        7: { cellWidth: 'auto' as const, fontSize: 8 },
      }
    : {
        0: { halign: 'center' as const, cellWidth: 10, fontStyle: 'bold' as const },
        1: { fontStyle: 'bold' as const, cellWidth: 52 },
        2: { cellWidth: 26 },
        3: { halign: 'center' as const, cellWidth: 18 },
        4: { halign: 'center' as const, cellWidth: 18 },
        5: { halign: 'center' as const, cellWidth: 18 },
        6: { halign: 'center' as const, cellWidth: 18 },
        7: { halign: 'right' as const, fontStyle: 'bold' as const, cellWidth: 24 },
        8: { halign: 'center' as const, fontStyle: 'bold' as const, cellWidth: 26 },
        9: { fontSize: 7.5, cellWidth: 'auto' as const },
      }

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
    columnStyles: columnStyles as any,
    margin: { left: leftMargin, right: rightMargin, top: 49, bottom: 16 },
    didParseCell: (data) => {
      if (isPastoral) {
        if (data.section === 'body') {
          const rowObj = rows[data.row.index]
          if (rowObj && rowObj.rate <= 10) {
            // Highlight the entire row in soft red for rate <= 10% (inactive rule)
            data.cell.styles.fillColor = [254, 226, 226]
            if (data.column.index === 6) {
              data.cell.styles.textColor = [185, 28, 28]
              data.cell.styles.fontStyle = 'bold'
            }
          }
        }
        return
      }

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
      leftMargin,
      rightMargin,
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
  const docCode = formatDocCodeWithDate(isPastoral ? 'EVAL' : 'MEM', now)
  applyStandardPdfFooters(doc, docCode, { leftMargin, rightMargin })

  const filename = isPastoral
    ? `Pastoral_Evaluation_Report_${now.toISOString().split('T')[0]}.pdf`
    : `Ministry_Members_Report_${now.toISOString().split('T')[0]}.pdf`
  doc.save(filename)
}
