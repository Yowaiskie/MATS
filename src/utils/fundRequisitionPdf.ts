import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { FinanceFundRequest, FundRequestSource } from '@/types/finance'
import type { SignatureConfig } from '@/types/signature'
import { renderPdfSignatures } from '@/utils/pdfSignatureHelper'
import { formatDocCodeWithDate, applyStandardPdfFooters } from '@/utils/pdfFooterHelper'

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

export interface FundRequisitionPdfOptions {
  documentDate?: string
  fromMinistry?: string
  fundSource?: FundRequestSource
  purpose?: string
  participants?: string
  dateNeeded?: string
  venue?: string
  assembly?: string
  signatureConfig?: SignatureConfig
}

export const downloadFundRequisitionPdf = async (
  request: FinanceFundRequest,
  options?: FundRequisitionPdfOptions
): Promise<void> => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
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

  // 2. Uniform Header Helper
  const drawUniformHeader = () => {
    // Dual Logos on Right Side (Parish & Ministry)
    if (logoParish && logoMinistry) {
      doc.addImage(logoParish, 'PNG', pageWidth - 44, 5.5, 13, 13)
      doc.addImage(logoMinistry, 'JPEG', pageWidth - 28, 5.5, 13, 13)
    } else if (logoMinistry) {
      doc.addImage(logoMinistry, 'JPEG', pageWidth - 28, 5.5, 13, 13)
    } else if (logoParish) {
      doc.addImage(logoParish, 'PNG', pageWidth - 28, 5.5, 13, 13)
    }

    // Left Parish Text
    doc.setFont('times', 'bolditalic')
    doc.setFontSize(14)
    doc.setTextColor(0, 0, 0)
    doc.text('Ministry of Altar Servers', 14, 10.5)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(0, 0, 0)
    doc.text('Sacred Heart of Jesus Parish - Mbs', 14, 15)
    doc.setFont('helvetica', 'normal')
    doc.text('Pilar Rd., Morning Breeze Subdivision, Caloocan City', 14, 19)

    // Horizontal Header Divider Line
    doc.setDrawColor(0, 0, 0)
    doc.setLineWidth(0.65)
    doc.line(14, 22, pageWidth - 14, 22)
  }

  // Draw Page 1 header
  drawUniformHeader()

  let cursorY = 27

  // Top Right: Requisition Date
  const rawDate = options?.documentDate || request.dateNeeded || (request.createdAt ? new Date() : new Date())
  const reqDateStr = formatDateUpper(rawDate)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.setTextColor(0, 0, 0)
  doc.text(reqDateStr, pageWidth - 14, cursorY, { align: 'right' })

  // Spacing between Date and Details block (no line above From)
  cursorY += 6

  // Details block
  const lineHeight = 4.8
  const labelX = 14
  const valueX = 38

  const fromText = options?.fromMinistry?.trim() || request.fromMinistry?.trim() || 'The MINISTRY OF ALTAR SERVERS'
  const purposeVal = options?.purpose || request.purpose || request.title || 'N/A'
  const participantsVal = options?.participants || request.participants || 'N/A'
  const dateNeededVal = formatDateUpper(options?.dateNeeded || request.dateNeeded || '') || 'N/A'
  const venueVal = options?.venue || request.venue || 'N/A'
  const assemblyVal = options?.assembly || request.assembly || 'N/A'

  // From
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(0, 0, 0)
  doc.text('From:', labelX, cursorY)
  doc.text(fromText, valueX, cursorY)
  cursorY += lineHeight

  // Purpose
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(0, 0, 0)
  doc.text('Purpose:', labelX, cursorY)
  doc.text(purposeVal, valueX, cursorY)
  cursorY += lineHeight

  // Participants
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 0, 0)
  doc.text('Participants:', labelX, cursorY)
  doc.setFont('helvetica', 'normal')
  doc.text(participantsVal, valueX, cursorY)
  cursorY += lineHeight

  // Date needed
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 0, 0)
  doc.text('Date needed:', labelX, cursorY)
  doc.text(dateNeededVal, valueX, cursorY)
  cursorY += lineHeight

  // Venue
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 0, 0)
  doc.text('Venue:', labelX, cursorY)
  doc.setFont('helvetica', 'normal')
  doc.text(venueVal, valueX, cursorY)
  cursorY += lineHeight

  // Assembly
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 0, 0)
  doc.text('Assembly:', labelX, cursorY)
  doc.setFont('helvetica', 'normal')
  doc.text(assemblyVal, valueX, cursorY)

  // Bottom line of details block
  cursorY += 2
  doc.setDrawColor(0, 0, 0)
  doc.setLineWidth(0.65)
  doc.line(14, cursorY, pageWidth - 14, cursorY)

  // Section title: Expected Expenses:
  cursorY += 5
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.setTextColor(0, 0, 0)
  doc.text('Expected Expenses:', 14, cursorY)
  cursorY += 2.5

  // Prepare table data
  const expenses = (request.expectedExpenses && request.expectedExpenses.length > 0)
    ? request.expectedExpenses
    : [
        {
          id: '1',
          intendedUse: request.purpose || request.title || 'General Fund Allocation',
          unitPrice: `₱${(request.requestedAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
          quantity: '1 lot',
          amount: Number(request.requestedAmount) || 0
        }
      ]

  const totalAmount = expenses.reduce((sum, item) => sum + (Number(String(item.amount || 0).replace(/,/g, '')) || 0), 0)

  const tableBody = expenses.map(item => [
    item.intendedUse || '-',
    item.unitPrice || '-',
    item.quantity || '-',
    `P ${(Number(String(item.amount || 0).replace(/,/g, '')) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  ])

  // Append Total row
  tableBody.push([
    { content: 'TOTAL', colSpan: 3, styles: { fontStyle: 'bold', fontSize: 10, halign: 'left', textColor: [0, 0, 0] } } as any,
    { content: `P ${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, styles: { fontStyle: 'bold', fontSize: 10, halign: 'right', textColor: [0, 0, 0] } } as any
  ])

  autoTable(doc, {
    startY: cursorY,
    head: [['Intended Use', 'Unit Price', 'Quantity', 'Amount']],
    body: tableBody,
    theme: 'grid',
    headStyles: {
      fillColor: [242, 242, 242],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: 9.5,
      halign: 'center',
      lineColor: [0, 0, 0],
      lineWidth: 0.35
    },
    bodyStyles: {
      textColor: [0, 0, 0],
      fontSize: 9,
      lineColor: [0, 0, 0],
      lineWidth: 0.25,
      cellPadding: 2.2
    },
    columnStyles: {
      0: { halign: 'left', cellWidth: 65 },
      1: { halign: 'center', cellWidth: 45 },
      2: { halign: 'center', cellWidth: 40 },
      3: { halign: 'right', cellWidth: 32 }
    },
    styles: {
      font: 'helvetica',
      overflow: 'linebreak'
    },
    margin: { left: 14, right: 14 }
  })

  // Final table Y coordinate
  const lastTableY = (doc as any).lastAutoTable?.finalY || cursorY + 40

  // Render Signatures
  const signatories = options?.signatureConfig?.enabled && options.signatureConfig.signatories?.length > 0
    ? options.signatureConfig.signatories
    : [
        {
          id: 'req-sig-1',
          label: 'Requesting officer:',
          name: request.requestedByName || 'REQUESTING OFFICER',
          title: 'Officer, Ministry of Altar Servers',
          organization: 'Sacred Heart of Jesus Parish - MBS',
          column: 1 as const
        },
        {
          id: 'req-sig-2',
          label: 'Approved by:',
          name: request.approvedByName || 'Bro. KYLE VINCENT MADRIAGA',
          title: 'Coordinator, Ministry of Altar Servers',
          organization: 'Sacred Heart of Jesus Parish - MBS',
          column: 2 as const
        }
      ]

  renderPdfSignatures(doc, signatories, lastTableY + 8, {
    leftMargin: 14,
    rightMargin: 14,
    lineWidth: 70,
    bottomMargin: 14,
    onNewPageRequired: () => {
      drawUniformHeader()
    }
  })

  // Apply uniform standard footer across all pages
  const docCode = formatDocCodeWithDate('FRQ', options?.documentDate || request.dateNeeded || request.createdAt)
  applyStandardPdfFooters(doc, docCode, { leftMargin: 14, rightMargin: 14 })

  // Trigger download
  const safeFilename = `Fund_Requisition_${request.referenceNumber || 'Voucher'}_${request.dateNeeded || 'Date'}.pdf`
  doc.save(safeFilename)
}
