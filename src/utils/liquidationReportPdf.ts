import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { FinanceFundRequest } from '@/types/finance'
import type { SignatureConfig } from '@/types/signature'
import { renderPdfSignatures } from '@/utils/pdfSignatureHelper'

const formatDateUpper = (d: Date | string): string => {
  if (!d) return ''
  const dateObj = typeof d === 'string' ? new Date(d.replace(/-/g, '/')) : d
  if (isNaN(dateObj.getTime())) return String(d).toUpperCase()
  return dateObj.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).toUpperCase()
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

export interface LiquidationReportPdfOptions {
  liquidationTo?: string
  liquidationToTitle?: string
  liquidationFrom?: string
  liquidationSubject?: string
  liquidationDate?: string
  signatureConfig?: SignatureConfig
  tablePadding?: number
  sectionSpacing?: number
  signatureTopMargin?: number
}

export const generateLiquidationReportPdfDoc = async (
  request: FinanceFundRequest,
  options?: LiquidationReportPdfOptions
): Promise<jsPDF> => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  const tablePadding = options?.tablePadding ?? 1.4
  const sectionSpacing = options?.sectionSpacing ?? 4.0
  const signatureTopMargin = options?.signatureTopMargin ?? 5.0

  // 1. Load Logo
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

  // 2. Uniform Header & Footer Helper
  const drawUniformHeaderAndFooter = (pageNumber: number, totalPages: number) => {
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

    // Footer
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(148, 163, 184)
    doc.text(
      `Page ${pageNumber} of ${totalPages} - MATS Official Liquidation Report (Ref: ${request.referenceNumber})`,
      pageWidth / 2,
      pageHeight - 8,
      { align: 'center' }
    )
  }

  drawUniformHeaderAndFooter(1, 1)

  let cursorY = 32

  // Top Right: Date
  const rawDate = options?.liquidationDate || request.liquidationDate || (request.liquidatedAt ? new Date() : new Date())
  const repDateStr = formatDateUpper(rawDate)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(15, 23, 42)
  doc.text(repDateStr, pageWidth - 14, cursorY, { align: 'right' })

  // Spacing between Date and To: header block
  cursorY += 5

  // Header Lines: To, From, Re
  const toName = options?.liquidationTo?.trim() || request.liquidationTo?.trim() || 'Rev. Fr. ILDEFONSO DE GUZMAN JR.'
  const toTitle = options?.liquidationToTitle?.trim() || 'Parish Priest'
  const fromName = options?.liquidationFrom?.trim() || request.liquidationFrom?.trim() || 'MINISTRY OF ALTAR SERVERS'
  const reSubject = options?.liquidationSubject?.trim() || 'Liquidation Report'

  // To:
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.text('To:', 14, cursorY)
  doc.setFont('helvetica', 'bold')
  doc.text(toName, 30, cursorY)
  cursorY += 4.5
  doc.setFont('helvetica', 'normal')
  doc.text(toTitle, 30, cursorY)
  cursorY += 5

  // From:
  doc.setFont('helvetica', 'normal')
  doc.text('From:', 14, cursorY)
  doc.setFont('helvetica', 'bold')
  doc.text(fromName, 30, cursorY)
  cursorY += 5

  // Re:
  doc.setFont('helvetica', 'normal')
  doc.text('Re:', 14, cursorY)
  doc.setFont('helvetica', 'normal')
  doc.text(reSubject, 30, cursorY)
  cursorY += 4.5

  // Horizontal separator line under memo header
  doc.setDrawColor(15, 23, 42)
  doc.setLineWidth(0.6)
  doc.line(14, cursorY, pageWidth - 14, cursorY)
  cursorY += 4

  // 1. Section: BUDGET INFO | SPONSORS
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('BUDGET INFO | SPONSORS', 14, cursorY)
  cursorY += 1.5

  const budgetSources = request.budgetSources !== undefined
    ? request.budgetSources
    : [
        {
          id: 'b1',
          description: `Parish Allocation (Ref: ${request.referenceNumber})`,
          amount: Number(request.releasedAmount || request.requestedAmount || 0)
        }
      ]

  const totalBudget = budgetSources.reduce((sum, b) => sum + (Number(String(b.amount || 0).replace(/,/g, '')) || 0), 0)

  const budgetTableBody = budgetSources.length > 0
    ? budgetSources.map(b => [
        b.description || '-',
        `P ${(Number(String(b.amount || 0).replace(/,/g, '')) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      ])
    : [
        ['NO RECORDED BUDGET / INCOME', 'P 0.00']
      ]

  budgetTableBody.push([
    { content: 'TOTAL AMOUNT RECEIVED', styles: { fontStyle: 'bold', fontSize: 9, halign: 'center' } } as any,
    { content: `P ${totalBudget.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, styles: { fontStyle: 'bold', fontSize: 9, halign: 'right' } } as any
  ])

  autoTable(doc, {
    startY: cursorY,
    head: [['BUDGET / SOURCE DESCRIPTION', 'AMOUNT']],
    body: budgetTableBody,
    theme: 'grid',
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'center',
      lineColor: [15, 23, 42],
      lineWidth: 0.25
    },
    bodyStyles: {
      textColor: [15, 23, 42],
      fontSize: 8,
      lineColor: [15, 23, 42],
      lineWidth: 0.2,
      cellPadding: tablePadding
    },
    columnStyles: {
      0: { halign: 'left', cellWidth: 130 },
      1: { halign: 'right', cellWidth: 52 }
    },
    styles: { font: 'helvetica', overflow: 'linebreak' },
    margin: { left: 14, right: 14 }
  })

  let table1Y = (doc as any).lastAutoTable?.finalY || cursorY + 20

  // 2. Section: EXPENSES
  cursorY = table1Y + sectionSpacing
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('EXPENSES', 14, cursorY)
  cursorY += 1.5

  const expenses = request.liquidationExpenses !== undefined
    ? request.liquidationExpenses
    : (request.expectedExpenses && request.expectedExpenses.length > 0)
    ? request.expectedExpenses.map(e => ({
        id: e.id,
        orNumber: 'NO O.R',
        description: e.intendedUse,
        amount: Number(String(e.amount || 0).replace(/,/g, '')) || 0
      }))
    : request.totalSpent
    ? [
        {
          id: 'e1',
          orNumber: 'NO O.R',
          description: request.purpose || request.title || 'Actual Procurement Expenses',
          amount: Number(request.totalSpent || 0)
        }
      ]
    : []

  const totalExpenses = expenses.reduce((sum, e) => sum + (Number(String(e.amount || 0).replace(/,/g, '')) || 0), 0)

  const expenseTableBody = expenses.length > 0
    ? expenses.map(e => [
        e.orNumber || 'NO O.R',
        e.description || '-',
        `P ${(Number(String(e.amount || 0).replace(/,/g, '')) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      ])
    : [
        ['-', 'NO RECORDED EXPENSES', 'P 0.00']
      ]

  expenseTableBody.push([
    { content: 'TOTAL', colSpan: 2, styles: { fontStyle: 'bold', fontSize: 9, halign: 'center' } } as any,
    { content: `P ${totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, styles: { fontStyle: 'bold', fontSize: 9, halign: 'right' } } as any
  ])

  autoTable(doc, {
    startY: cursorY,
    head: [['O.R. NUMBER', 'EXPENSE DESCRIPTION', 'AMOUNT']],
    body: expenseTableBody,
    theme: 'grid',
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'center',
      lineColor: [15, 23, 42],
      lineWidth: 0.25
    },
    bodyStyles: {
      textColor: [15, 23, 42],
      fontSize: 8,
      lineColor: [15, 23, 42],
      lineWidth: 0.2,
      cellPadding: tablePadding
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 40 },
      1: { halign: 'left', cellWidth: 90 },
      2: { halign: 'right', cellWidth: 52 }
    },
    styles: { font: 'helvetica', overflow: 'linebreak' },
    margin: { left: 14, right: 14 }
  })

  let table2Y = (doc as any).lastAutoTable?.finalY || cursorY + 20

  // 3. Section: SUMMARY Table
  cursorY = table2Y + sectionSpacing
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('SUMMARY', 14, cursorY)
  cursorY += 1.5

  const returnedVal = Math.max(0, totalBudget - totalExpenses)
  const reimbursedVal = Math.max(0, totalExpenses - totalBudget)

  const summaryRows = [
    [
      { content: 'BUDGET', styles: { fontStyle: 'bold' as const, halign: 'center' as const } },
      { content: `P ${totalBudget.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, styles: { halign: 'center' as const } }
    ],
    [
      { content: 'EXPENSES', styles: { fontStyle: 'bold' as const, halign: 'center' as const } },
      { content: `P ${totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, styles: { halign: 'right' as const } }
    ],
    [
      { content: 'RETURNED', styles: { fontStyle: 'bold' as const, halign: 'center' as const } },
      { content: `P ${returnedVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, styles: { halign: 'right' as const } }
    ],
    [
      { content: 'REIMBURSED', styles: { fontStyle: 'bold' as const, halign: 'center' as const } },
      { content: `P ${reimbursedVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, styles: { halign: 'right' as const } }
    ]
  ]

  autoTable(doc, {
    startY: cursorY,
    body: summaryRows,
    theme: 'grid',
    bodyStyles: {
      textColor: [15, 23, 42],
      fontSize: 8.5,
      lineColor: [15, 23, 42],
      lineWidth: 0.2,
      cellPadding: tablePadding
    },
    columnStyles: {
      0: { cellWidth: 55 },
      1: { cellWidth: 127 }
    },
    styles: { font: 'helvetica' },
    margin: { left: 14, right: 14 }
  })

  let table3Y = (doc as any).lastAutoTable?.finalY || cursorY + 20

  // 4. Signatures
  const signatories = options?.signatureConfig?.enabled && options.signatureConfig.signatories?.length > 0
    ? options.signatureConfig.signatories
    : [
        {
          id: 'liq-sig-1',
          label: 'Prepared by:',
          name: request.liquidatedByName || request.requestedByName || 'TREASURER / OFFICER',
          title: 'Treasurer, Ministry of Altar Servers',
          organization: 'Sacred Heart of Jesus Parish - MBS',
          column: 1 as const
        },
        {
          id: 'liq-sig-2',
          label: 'Noted by:',
          name: request.approvedByName || 'Bro. KYLE VINCENT MADRIAGA',
          title: 'Coordinator, Ministry of Altar Servers',
          organization: 'Sacred Heart of Jesus Parish - MBS',
          column: 2 as const
        },
        {
          id: 'liq-sig-3',
          label: 'Approved by:',
          name: toName || 'Rev. Fr. ILDEFONSO DE GUZMAN JR.',
          title: 'Parish Priest',
          organization: 'Sacred Heart of Jesus Parish - MBS',
          column: 2 as const
        }
      ]

  renderPdfSignatures(doc, signatories, table3Y + signatureTopMargin, {
    leftMargin: 14,
    rightMargin: 14,
    lineWidth: 70,
    bottomMargin: 10,
    onNewPageRequired: () => {
      const pageCount = doc.getNumberOfPages()
      drawUniformHeaderAndFooter(pageCount, pageCount)
    }
  })

  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(148, 163, 184)
    doc.text(
      `Page ${i} of ${totalPages} - MATS Official Liquidation Report (Ref: ${request.referenceNumber})`,
      pageWidth / 2,
      pageHeight - 8,
      { align: 'center' }
    )
  }

  return doc
}

export const downloadLiquidationReportPdf = async (
  request: FinanceFundRequest,
  options?: LiquidationReportPdfOptions
): Promise<void> => {
  const doc = await generateLiquidationReportPdfDoc(request, options)
  const safeFilename = `Liquidation_Report_${request.referenceNumber || 'Report'}_${request.dateNeeded || 'Date'}.pdf`
  doc.save(safeFilename)
}

export const getLiquidationReportPdfBlobUrl = async (
  request: FinanceFundRequest,
  options?: LiquidationReportPdfOptions
): Promise<string> => {
  const doc = await generateLiquidationReportPdfDoc(request, options)
  const blob = doc.output('blob')
  return URL.createObjectURL(blob)
}
