import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Member } from '@/types/member'
import { getFullName } from '@/utils/member'
import type { SignatureConfig } from '@/types/signature'
import { renderPdfSignatures } from '@/utils/pdfSignatureHelper'
import { formatDocCodeWithDate, applyStandardPdfFooters } from '@/utils/pdfFooterHelper'

export type ExportPreset = 'all' | 'names_only' | 'summary' | 'custom'

export interface MemberExportColumn {
  id: string
  label: string
  getValue: (member: Member, index: number) => string
  pdfWidth?: number
  halign?: 'left' | 'center' | 'right'
}

export const ALL_MEMBER_COLUMNS: MemberExportColumn[] = [
  {
    id: 'index',
    label: '#',
    getValue: (_m, idx) => String(idx + 1),
    pdfWidth: 8,
    halign: 'center'
  },
  {
    id: 'fullName',
    label: 'Full Name',
    getValue: (m) => getFullName(m, false),
    pdfWidth: 42,
    halign: 'left'
  },
  {
    id: 'nickname',
    label: 'Nickname',
    getValue: (m) => m.nickname || '—',
    pdfWidth: 20,
    halign: 'left'
  },
  {
    id: 'rank',
    label: 'Rank',
    getValue: (m) => m.rank || '—',
    pdfWidth: 24,
    halign: 'left'
  },
  {
    id: 'order',
    label: 'Order / Group',
    getValue: (m) => m.order || 'Unassigned',
    pdfWidth: 28,
    halign: 'left'
  },
  {
    id: 'phoneNumber',
    label: 'Phone Number',
    getValue: (m) => m.phoneNumber || '—',
    pdfWidth: 26,
    halign: 'left'
  },
  {
    id: 'homeAddress',
    label: 'Home Address',
    getValue: (m) => m.homeAddress || '—',
    pdfWidth: 42,
    halign: 'left'
  },
  {
    id: 'dateOfBirth',
    label: 'Date of Birth',
    getValue: (m) => m.dateOfBirth || '—',
    pdfWidth: 24,
    halign: 'center'
  },
  {
    id: 'dateOfInvestiture',
    label: 'Date of Investiture',
    getValue: (m) => m.dateOfInvestiture || '—',
    pdfWidth: 25,
    halign: 'center'
  },
  {
    id: 'monthJoined',
    label: 'Month Joined',
    getValue: (m) => m.monthJoined || '—',
    pdfWidth: 24,
    halign: 'center'
  },
  {
    id: 'position',
    label: 'Position',
    getValue: (m) => {
      const pos = (m.position || '').trim()
      if (!pos) return '—'
      if (/^ol$/i.test(pos)) return 'Order Leader'
      if (/^ol\b/i.test(pos)) return pos.replace(/^ol\b/i, 'Order Leader')
      return pos
    },
    pdfWidth: 28,
    halign: 'left'
  }
]

export const NAMES_ONLY_COLUMNS: MemberExportColumn[] = [
  {
    id: 'index',
    label: '#',
    getValue: (_m, idx) => String(idx + 1),
    pdfWidth: 10,
    halign: 'center'
  },
  {
    id: 'fullName',
    label: 'Full Name',
    getValue: (m) => getFullName(m, false),
    pdfWidth: 60,
    halign: 'left'
  },
  {
    id: 'nickname',
    label: 'Nickname',
    getValue: (m) => m.nickname || '—',
    pdfWidth: 30,
    halign: 'left'
  },
  {
    id: 'rank',
    label: 'Rank',
    getValue: (m) => m.rank || '—',
    pdfWidth: 35,
    halign: 'left'
  },
  {
    id: 'order',
    label: 'Order / Group',
    getValue: (m) => m.order || 'Unassigned',
    pdfWidth: 45,
    halign: 'left'
  }
]

export const SUMMARY_COLUMNS: MemberExportColumn[] = [
  {
    id: 'index',
    label: '#',
    getValue: (_m, idx) => String(idx + 1),
    pdfWidth: 10,
    halign: 'center'
  },
  {
    id: 'fullName',
    label: 'Full Name',
    getValue: (m) => getFullName(m, false),
    pdfWidth: 50,
    halign: 'left'
  },
  {
    id: 'rank',
    label: 'Rank',
    getValue: (m) => m.rank || '—',
    pdfWidth: 28,
    halign: 'left'
  },
  {
    id: 'order',
    label: 'Order / Group',
    getValue: (m) => m.order || 'Unassigned',
    pdfWidth: 34,
    halign: 'left'
  },
  {
    id: 'phoneNumber',
    label: 'Phone Number',
    getValue: (m) => m.phoneNumber || '—',
    pdfWidth: 32,
    halign: 'left'
  },
  {
    id: 'position',
    label: 'Position',
    getValue: (m) => {
      const pos = (m.position || '').trim()
      if (!pos) return '—'
      if (/^ol$/i.test(pos)) return 'Order Leader'
      if (/^ol\b/i.test(pos)) return pos.replace(/^ol\b/i, 'Order Leader')
      return pos
    },
    pdfWidth: 30,
    halign: 'left'
  }
]

export const getColumnsForPreset = (preset: ExportPreset, customColumnIds?: string[]): MemberExportColumn[] => {
  switch (preset) {
    case 'names_only':
      return NAMES_ONLY_COLUMNS
    case 'summary':
      return SUMMARY_COLUMNS
    case 'custom':
      if (customColumnIds && customColumnIds.length > 0) {
        return ALL_MEMBER_COLUMNS.filter(c => customColumnIds.includes(c.id))
      }
      return ALL_MEMBER_COLUMNS
    case 'all':
    default:
      return ALL_MEMBER_COLUMNS
  }
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

const sanitizeCsvCell = (val: string): string => {
  if (val === null || val === undefined) return '""'
  const str = String(val)
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return `"${str}"`
}

/**
 * Checks if a member is classified as a Squire.
 */
export const isSquire = (m: Member): boolean => {
  const rank = (m.rank || '').trim().toLowerCase()
  const order = (m.order || '').trim().toLowerCase()
  return rank.includes('squire') || order.includes('squire')
}

/**
 * Exports members directly to clean tabular CSV (without parish header).
 */
export const exportMembersToCsv = (
  members: Member[],
  columns: MemberExportColumn[],
  filenamePrefix = 'MATS_Members'
): void => {
  const headers = columns.map(c => sanitizeCsvCell(c.label)).join(',')
  const rows = members.map((member, index) => {
    return columns.map(col => sanitizeCsvCell(col.getValue(member, index))).join(',')
  })

  const csvContent = [headers, ...rows].join('\r\n')
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const dateStr = new Date().toISOString().split('T')[0]
  link.setAttribute('href', url)
  link.setAttribute('download', `${filenamePrefix}_${dateStr}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export type PaperSize = 'long' | 'a4' | 'letter'

export interface MemberPdfExportOptions {
  documentTitle?: string
  scopeLabel?: string
  signatureConfig?: SignatureConfig
  filenamePrefix?: string
  paperSize?: PaperSize
}

/**
 * Generates an official, branded PDF Member Report with parish header, title,
 * dynamic columns, separate Squires table, and optional dynamic signatures.
 */
export const exportMembersToPdf = async (
  members: Member[],
  columns: MemberExportColumn[],
  options?: MemberPdfExportOptions
): Promise<void> => {
  const now = new Date()

  // Use landscape if more than 5 columns or if wide columns are selected
  const isLandscape = columns.length > 5
  const paperSize: PaperSize = options?.paperSize || 'long'

  // Map paper size: 'long' = Long Bond Paper (8.5 x 13 in / Folio), 'a4' = A4, 'letter' = Short / Letter
  let docFormat: string | [number, number] = [215.9, 330.2]
  if (paperSize === 'a4') {
    docFormat = 'a4'
  } else if (paperSize === 'letter') {
    docFormat = 'letter'
  }

  const doc = new jsPDF({
    orientation: isLandscape ? 'landscape' : 'portrait',
    unit: 'mm',
    format: docFormat,
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const leftMargin = 12
  const rightMargin = 12
  const availableWidth = pageWidth - leftMargin - rightMargin

  // 1. Prepare Logos
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

  // 2. Uniform Header across all pages
  const drawUniformHeader = () => {
    // Dual Logos on Right Side (Parish & Ministry)
    if (logoParish && logoMinistry) {
      doc.addImage(logoParish, 'PNG', pageWidth - 45, 8, 14, 14)
      doc.addImage(logoMinistry, 'JPEG', pageWidth - 28, 8, 14, 14)
    } else if (logoMinistry) {
      doc.addImage(logoMinistry, 'JPEG', pageWidth - 26, 8, 15, 15)
    } else if (logoParish) {
      doc.addImage(logoParish, 'PNG', pageWidth - 26, 8, 15, 15)
    }

    // Parish Text on Left
    doc.setFont('times', 'bolditalic')
    doc.setFontSize(15)
    doc.setTextColor(15, 23, 42)
    doc.text('Ministry of Altar Servers', leftMargin, 14)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)
    doc.setTextColor(51, 65, 85)
    doc.text('Sacred Heart of Jesus Parish - Mbs', leftMargin, 19.5)
    doc.text('Pilar Rd., Morning Breeze Subdivision, Caloocan City', leftMargin, 24)

    // Divider Line
    doc.setDrawColor(30, 41, 59)
    doc.setLineWidth(0.6)
    doc.line(leftMargin, 28, pageWidth - rightMargin, 28)
  }

  // 3. Document Title
  const defaultTitle = 'MEMBER MASTERLIST REPORT'
  const titleText = (options?.documentTitle?.trim() || defaultTitle).toUpperCase()
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13.5)
  doc.setTextColor(15, 23, 42)
  const titleWidth = doc.getTextWidth(titleText)
  const titleX = (pageWidth - titleWidth) / 2
  const titleY = 35.5
  doc.text(titleText, titleX, titleY)
  doc.setLineWidth(0.5)
  doc.setDrawColor(15, 23, 42)
  doc.line(titleX, titleY + 1.2, titleX + titleWidth, titleY + 1.2)

  // 4. Split Official Members and Squires
  const officialMembers = members.filter(m => !isSquire(m))
  const squireMembers = members.filter(m => isSquire(m))

  // Table Data Preparation & Dynamic Full-Width Proportional Column Width Calculation
  const tableHead = [columns.map(c => c.label.toUpperCase())]

  const indexCol = columns.find(c => c.id === 'index')
  const fixedIndexWidth = indexCol ? (columns.length <= 6 ? 12 : 9) : 0
  const flexibleColumns = columns.filter(c => c.id !== 'index')

  const totalFlexBaseWidth = flexibleColumns.reduce((sum, col) => sum + (col.pdfWidth || 25), 0)
  const remainingWidth = availableWidth - fixedIndexWidth

  // Dynamic column styling with 100% full-width distribution across availableWidth
  const colStyles: Record<number, any> = {}
  columns.forEach((col, idx) => {
    if (col.id === 'index') {
      colStyles[idx] = {
        halign: 'center',
        cellWidth: fixedIndexWidth,
      }
    } else {
      const baseW = col.pdfWidth || 25
      const scaledW = totalFlexBaseWidth > 0
        ? Math.floor((baseW / totalFlexBaseWidth) * remainingWidth * 100) / 100
        : Math.floor(remainingWidth / flexibleColumns.length)
      colStyles[idx] = {
        halign: col.halign || 'left',
        cellWidth: scaledW,
        ...(col.id === 'fullName' ? { fontStyle: 'bold' } : {})
      }
    }
  })

  const isCompact = columns.length <= 6
  const isDense = columns.length >= 9

  const tableHeadFontSize = isCompact ? 8.5 : isDense ? 7 : 8
  const tableHeadPadding = isCompact ? 2.5 : isDense ? 1.8 : 2.2
  const tableBodyFontSize = isCompact ? 8 : isDense ? 6.8 : 7.5
  const tableBodyPadding = isCompact ? 2.3 : isDense ? 1.6 : 2.0

  let currentY = 41

  // 5. Render Official Members Table
  if (officialMembers.length > 0) {
    const officialBody = officialMembers.map((member, index) => {
      return columns.map(col => col.getValue(member, index))
    })

    autoTable(doc, {
      startY: currentY,
      head: tableHead,
      body: officialBody,
      theme: 'grid',
      showHead: 'everyPage',
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontSize: tableHeadFontSize,
        fontStyle: 'bold',
        halign: 'left',
        cellPadding: tableHeadPadding,
      },
      bodyStyles: {
        fontSize: tableBodyFontSize,
        textColor: [15, 23, 42],
        cellPadding: tableBodyPadding,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: colStyles,
      margin: { left: leftMargin, right: rightMargin, top: 41, bottom: 16 }
    })

    currentY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 8 : 41
  }

  // 6. Render Squires Table (Separate Table Below)
  if (squireMembers.length > 0) {
    // If not enough room on the current page for heading + table header + a few rows, create a new page
    if (currentY > pageHeight - 38) {
      doc.addPage()
      currentY = 41
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(30, 41, 59)
    doc.text('SQUIRES', leftMargin, currentY)
    currentY += 3.5

    const squireBody = squireMembers.map((member, index) => {
      return columns.map(col => col.getValue(member, index))
    })

    autoTable(doc, {
      startY: currentY,
      head: tableHead,
      body: squireBody,
      theme: 'grid',
      showHead: 'everyPage',
      headStyles: {
        fillColor: [51, 65, 85], // Slate 700 tone for Squires section header
        textColor: [255, 255, 255],
        fontSize: tableHeadFontSize,
        fontStyle: 'bold',
        halign: 'left',
        cellPadding: tableHeadPadding,
      },
      bodyStyles: {
        fontSize: tableBodyFontSize,
        textColor: [15, 23, 42],
        cellPadding: tableBodyPadding,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: colStyles,
      margin: { left: leftMargin, right: rightMargin, top: 41, bottom: 16 }
    })

    currentY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 8 : 41
  }

  // 7. Dynamic signatures if enabled
  if (options?.signatureConfig?.enabled && options.signatureConfig.signatories.length > 0) {
    currentY = renderPdfSignatures(doc, options.signatureConfig.signatories, currentY, {
      leftMargin,
      rightMargin,
      bottomMargin: 18,
      topMarginOnNewPage: 41
    })
  }

  // 8. Uniform header across all pages
  const totalPages = (doc as any).internal.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    drawUniformHeader()
  }

  // Apply uniform standard footer across all pages with OML document code
  const docCode = formatDocCodeWithDate('OML', now)
  applyStandardPdfFooters(doc, docCode, { leftMargin, rightMargin })

  const prefix = options?.filenamePrefix || 'MATS_Members_Report'
  const filename = `${prefix}_${now.toISOString().split('T')[0]}.pdf`
  doc.save(filename)
}
