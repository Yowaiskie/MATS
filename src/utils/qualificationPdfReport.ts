import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { MemberQualificationResult, CategoryRule } from '@/types/attendanceCategory'
import { SCHEDULE_CATEGORIES } from '@/types/attendanceCategory'
import { getFullName } from '@/utils/member'
import type { SignatureConfig } from '@/types/signature'
import { renderPdfSignatures } from '@/utils/pdfSignatureHelper'
import { formatDocCodeWithDate, applyStandardPdfFooters } from '@/utils/pdfFooterHelper'

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

export interface QualificationPdfOptions {
  dateRange?: { start?: string; end?: string }
  documentTitle?: string
  presetName?: string
  activeRules: CategoryRule[]
  signatureConfig?: SignatureConfig
}

/**
 * Generates an official landscape PDF report for Member Qualifications & Renewal.
 * Uniform styling with dual logos, parish header, criteria summary, color-coded badges, footers, and signatures.
 */
export const downloadQualificationsReportPdf = async (
  results: MemberQualificationResult[],
  options: QualificationPdfOptions
): Promise<void> => {
  const now = new Date()
  const dateStr = formatDate(now)
  const timeStr = formatTime(now)

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

  // 2. Helper to draw Uniform Header across pages
  const drawUniformHeader = () => {
    if (logoParish && logoMinistry) {
      doc.addImage(logoParish, 'PNG', pageWidth - 48, 6.5, 16, 16)
      doc.addImage(logoMinistry, 'JPEG', pageWidth - 30, 6.5, 16, 16)
    } else if (logoMinistry) {
      doc.addImage(logoMinistry, 'JPEG', pageWidth - 28, 6.5, 16, 16)
    } else if (logoParish) {
      doc.addImage(logoParish, 'PNG', pageWidth - 28, 6.5, 16, 16)
    }

    doc.setFont('times', 'bolditalic')
    doc.setFontSize(16)
    doc.setTextColor(15, 23, 42)
    doc.text('Ministry of Altar Servers', 14, 14)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(51, 65, 85)
    doc.text('Sacred Heart of Jesus Parish - Mbs', 14, 19.5)
    doc.text('Pilar Rd., Morning Breeze Subdivision, Caloocan City', 14, 24)

    // Horizontal Divider Line
    doc.setDrawColor(30, 41, 59)
    doc.setLineWidth(0.6)
    doc.line(14, 28, pageWidth - 14, 28)
  }

  // 3. Document Title
  const defaultTitle = 'MEMBER ATTENDANCE EVALUATION & RENEWAL QUALIFICATIONS REPORT'
  const titleText = (options.documentTitle?.trim() || defaultTitle).toUpperCase()
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13.5)
  doc.setTextColor(15, 23, 42)
  const titleWidth = doc.getTextWidth(titleText)
  const titleX = (pageWidth - titleWidth) / 2
  const titleY = 36
  doc.text(titleText, titleX, titleY)
  doc.setLineWidth(0.5)
  doc.setDrawColor(15, 23, 42)
  doc.line(titleX, titleY + 1.2, titleX + titleWidth, titleY + 1.2)

  // 4. Sub-header Metadata Row
  const dateRange = options.dateRange
  const rangeSubtitle = dateRange?.start || dateRange?.end
    ? `${dateRange.start || 'Start'} to ${dateRange.end || 'Present'}`
    : 'All Time Records'

  const qualifiedCount = results.filter(r => r.isQualified).length
  const deficientCount = results.length - qualifiedCount

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(71, 85, 105)
  doc.text(`Covered Period: ${rangeSubtitle}  •  Preset: ${options.presetName || 'Custom Criteria'}`, 14, 43)
  doc.text(
    `Generated: ${dateStr} at ${timeStr}  •  Total: ${results.length} (Qualified: ${qualifiedCount}, Deficient: ${deficientCount})`,
    pageWidth - 14,
    43,
    { align: 'right' }
  )

  // Criteria Rule Summary String
  const criteriaSummary = options.activeRules.map(r => {
    const catMeta = SCHEDULE_CATEGORIES.find(c => c.key === r.category)
    const label = r.category === 'all' ? 'Overall Attendance' : (catMeta?.shortLabel || r.category)
    return `${label}: Min ${r.minRate || 0}%`
  }).join('  •  ')

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(100, 116, 139)
  doc.text(`Qualification Rules: ${criteriaSummary || 'None specified'}`, 14, 48)

  // 5. Table Data Rows
  const tableRows = results.map((r, idx) => {
    const ogf = r.categoryStats['formation']
    const mtg = r.categoryStats['meeting']
    const sun = r.categoryStats['mass_sunday']

    return [
      (idx + 1).toString(),
      getFullName(r.member).toUpperCase(),
      r.member.rank || '-',
      r.member.order || '-',
      ogf && ogf.totalHeld > 0 ? `${ogf.rate.toFixed(0)}% (${ogf.present}/${ogf.totalHeld})` : '-',
      mtg && mtg.totalHeld > 0 ? `${mtg.rate.toFixed(0)}% (${mtg.present}/${mtg.totalHeld})` : '-',
      sun && sun.totalHeld > 0 ? `${sun.rate.toFixed(0)}% (${sun.present}/${sun.totalHeld})` : '-',
      `${r.overallRate.toFixed(1)}%`,
      r.isQualified ? 'QUALIFIED' : 'DEFICIENT',
      r.deficiencies.length > 0 ? r.deficiencies.join(', ') : 'None'
    ]
  })

  // 6. Draw Table
  autoTable(doc, {
    startY: 52,
    head: [[
      '#',
      'Name of Altar Server',
      'Rank',
      'Order / Group',
      'Formation (OGF)',
      'Monthly Meetings',
      'Sunday Masses',
      'Overall %',
      'Status',
      'Remarks / Deficiencies'
    ]],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center',
      cellPadding: 2.5
    },
    bodyStyles: {
      fontSize: 7.5,
      cellPadding: 2,
      textColor: [15, 23, 42]
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 9 },
      1: { fontStyle: 'bold', cellWidth: 50 },
      2: { cellWidth: 26 },
      3: { cellWidth: 32 },
      4: { halign: 'center', cellWidth: 26 },
      5: { halign: 'center', cellWidth: 26 },
      6: { halign: 'center', cellWidth: 26 },
      7: { halign: 'center', fontStyle: 'bold', cellWidth: 20 },
      8: { halign: 'center', fontStyle: 'bold', cellWidth: 22 },
      9: { cellWidth: 'auto', fontSize: 7 }
    },
    margin: { left: 14, right: 14, top: 32, bottom: 20 },
    didDrawPage: () => {
      drawUniformHeader()
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 8) {
        if (data.cell.raw === 'QUALIFIED') {
          data.cell.styles.textColor = [16, 149, 93]
          data.cell.styles.fontStyle = 'bold'
        } else if (data.cell.raw === 'DEFICIENT') {
          data.cell.styles.textColor = [225, 29, 72]
          data.cell.styles.fontStyle = 'bold'
        }
      }
    }
  })

  // 7. Dynamic Signatures Section
  const finalY = (doc as any).lastAutoTable?.finalY ?? 60
  if (options.signatureConfig?.enabled && options.signatureConfig.signatories.length > 0) {
    renderPdfSignatures(doc, options.signatureConfig.signatories, finalY + 8, {
      leftMargin: 14,
      rightMargin: 14,
      onNewPageRequired: () => {
        drawUniformHeader()
      }
    })
  }

  // 8. Apply Standard Footers on all pages
  const docCode = formatDocCodeWithDate('MATS-QUAL', now)
  applyStandardPdfFooters(doc, docCode, {
    leftMargin: 14,
    rightMargin: 14
  })

  // 9. Save PDF
  const filename = `MATS_Renewal_Qualifications_${options.presetName ? options.presetName.replace(/\s+/g, '_') : 'Report'}_${options.dateRange?.start || 'Start'}_to_${options.dateRange?.end || 'Present'}.pdf`
  doc.save(filename)
}
