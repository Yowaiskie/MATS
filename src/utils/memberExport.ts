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
    id: 'status',
    label: 'Status',
    getValue: (m) => (m.status || 'active').toUpperCase(),
    pdfWidth: 18,
    halign: 'center'
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
    pdfWidth: 40,
    halign: 'left'
  },
  {
    id: 'dateOfBirth',
    label: 'Date of Birth',
    getValue: (m) => m.dateOfBirth || '—',
    pdfWidth: 22,
    halign: 'center'
  },
  {
    id: 'dateOfInvestiture',
    label: 'Date of Investiture',
    getValue: (m) => m.dateOfInvestiture || '—',
    pdfWidth: 24,
    halign: 'center'
  },
  {
    id: 'monthJoined',
    label: 'Month Joined',
    getValue: (m) => m.monthJoined || '—',
    pdfWidth: 22,
    halign: 'center'
  },
  {
    id: 'position',
    label: 'Position',
    getValue: (m) => m.position || '—',
    pdfWidth: 25,
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
    pdfWidth: 48,
    halign: 'left'
  },
  {
    id: 'rank',
    label: 'Rank',
    getValue: (m) => m.rank || '—',
    pdfWidth: 26,
    halign: 'left'
  },
  {
    id: 'order',
    label: 'Order / Group',
    getValue: (m) => m.order || 'Unassigned',
    pdfWidth: 32,
    halign: 'left'
  },
  {
    id: 'status',
    label: 'Status',
    getValue: (m) => (m.status || 'active').toUpperCase(),
    pdfWidth: 20,
    halign: 'center'
  },
  {
    id: 'phoneNumber',
    label: 'Phone Number',
    getValue: (m) => m.phoneNumber || '—',
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

const sanitizeCsvCell = (val: string): string => {
  if (val === null || val === undefined) return '""'
  const str = String(val)
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return `"${str}"`
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

export interface MemberPdfExportOptions {
  documentTitle?: string
  scopeLabel?: string
  signatureConfig?: SignatureConfig
  filenamePrefix?: string
}

/**
 * Generates an official, branded PDF Member Report with parish header, title,
 * metadata info, dynamic columns, and optional dynamic signatures.
 */
export const exportMembersToPdf = async (
  members: Member[],
  columns: MemberExportColumn[],
  options?: MemberPdfExportOptions
): Promise<void> => {
  const now = new Date()
  const dateStr = formatDate(now)
  const timeStr = formatTime(now)

  // Use landscape if more than 5 columns or if wide columns are selected
  const isLandscape = columns.length > 5

  const doc = new jsPDF({
    orientation: isLandscape ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const pageWidth = doc.internal.pageSize.getWidth()

  // 1. Prepare Logo
  let logoImg: HTMLImageElement | null = null
  try {
    logoImg = await loadImage('/ministy_logo.jpg')
  } catch {
    try {
      logoImg = await loadImage('/favicon/favicon.png')
    } catch {
      // Fallback
    }
  }

  // 2. Uniform Header across all pages
  const drawUniformHeader = () => {
    // Ministry Logo on Right
    if (logoImg) {
      doc.addImage(logoImg, 'JPEG', pageWidth - 26, 8, 15, 15)
    }

    // Parish Text on Left
    doc.setFont('times', 'bolditalic')
    doc.setFontSize(15)
    doc.setTextColor(15, 23, 42)
    doc.text('Ministry of Altar Servers', 14, 14)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)
    doc.setTextColor(51, 65, 85)
    doc.text('Sacred Heart of Jesus Parish - Mbs', 14, 19.5)
    doc.text('Pilar Rd., Morning Breeze Subdivision, Caloocan City', 14, 24)

    // Divider Line
    doc.setDrawColor(30, 41, 59)
    doc.setLineWidth(0.6)
    doc.line(14, 28, pageWidth - 14, 28)
  }

  // 3. Document Title
  const defaultTitle = 'MEMBER MASTERLIST REPORT'
  const titleText = (options?.documentTitle?.trim() || defaultTitle).toUpperCase()
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
  const scopeText = options?.scopeLabel || 'All Active Members'
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(71, 85, 105)
  doc.text(`Scope / Filter: ${scopeText}`, 14, 44)
  doc.text(
    `Generated: ${dateStr} at ${timeStr} • Total Records: ${members.length}`,
    pageWidth - 14,
    44,
    { align: 'right' }
  )

  // 5. Table Data Preparation
  const tableHead = [columns.map(c => c.label.toUpperCase())]
  const tableBody = members.map((member, index) => {
    return columns.map(col => col.getValue(member, index))
  })

  // Dynamic column styling
  const colStyles: Record<number, any> = {}
  columns.forEach((col, idx) => {
    colStyles[idx] = {
      halign: col.halign || 'left',
      ...(col.pdfWidth ? { cellWidth: col.pdfWidth } : {}),
      ...(col.id === 'fullName' ? { fontStyle: 'bold' } : {})
    }
  })

  // 6. Generate Table
  autoTable(doc, {
    startY: 48,
    head: tableHead,
    body: tableBody,
    theme: 'grid',
    showHead: 'everyPage',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'left',
      cellPadding: 2.2,
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [15, 23, 42],
      cellPadding: 2,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: colStyles,
    margin: { left: 14, right: 14, top: 48, bottom: 16 },
    didParseCell: (data) => {
      // Find status column index
      const statusColIndex = columns.findIndex(c => c.id === 'status')
      if (statusColIndex !== -1 && data.section === 'body' && data.column.index === statusColIndex) {
        const val = String(data.cell.raw).toUpperCase()
        if (val === 'ACTIVE') {
          data.cell.styles.textColor = [21, 128, 61]
          data.cell.styles.fillColor = [220, 252, 231]
          data.cell.styles.fontStyle = 'bold'
        } else if (val === 'INACTIVE') {
          data.cell.styles.textColor = [180, 83, 9]
          data.cell.styles.fillColor = [254, 243, 199]
          data.cell.styles.fontStyle = 'bold'
        } else if (val === 'ARCHIVED') {
          data.cell.styles.textColor = [100, 116, 139]
          data.cell.styles.fillColor = [241, 245, 249]
        }
      }
    }
  })

  let currentY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 8 : 48

  // 7. Dynamic signatures if enabled
  if (options?.signatureConfig?.enabled && options.signatureConfig.signatories.length > 0) {
    currentY = renderPdfSignatures(doc, options.signatureConfig.signatories, currentY, {
      leftMargin: 14,
      rightMargin: 14,
      bottomMargin: 18,
      topMarginOnNewPage: 48
    })
  }

  // 8. Uniform header across all pages
  const totalPages = (doc as any).internal.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    drawUniformHeader()
  }

  // Apply uniform standard footer across all pages
  const docCode = formatDocCodeWithDate('MEM', now)
  applyStandardPdfFooters(doc, docCode, { leftMargin: 14, rightMargin: 14 })

  const prefix = options?.filenamePrefix || 'MATS_Members_Report'
  const filename = `${prefix}_${now.toISOString().split('T')[0]}.pdf`
  doc.save(filename)
}
