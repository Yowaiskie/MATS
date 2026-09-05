import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { FinanceFundRequest } from '@/types/finance'
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

  // Draw Page 1 header
  drawUniformHeader()

  let cursorY = 35

  // Top Right: Requisition Date
  const rawDate = options?.documentDate || request.dateNeeded || (request.createdAt ? new Date() : new Date())
  const reqDateStr = formatDateUpper(rawDate)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  doc.setTextColor(15, 23, 42)
  doc.text(reqDateStr, pageWidth - 14, cursorY, { align: 'right' })

  // Spacing between Date and From: header block
  cursorY += 9

  // Left: "From:  The MINISTRY OF ALTAR SERVERS"
  const fromText = options?.fromMinistry?.trim() || request.fromMinistry?.trim() || 'The MINISTRY OF ALTAR SERVERS'
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10.5)
  doc.text('From:', 14, cursorY)
  doc.setFont('helvetica', 'bold')
  doc.text(fromText, 32, cursorY)

  // Horizontal separator line under From
  cursorY += 6
  doc.setDrawColor(15, 23, 42)
  doc.setLineWidth(0.8)
  doc.line(14, cursorY, pageWidth - 14, cursorY)

  // Details block
  cursorY += 7
  const lineHeight = 6
  const labelX = 14
  const valueX = 42

  const purposeVal = options?.purpose || request.purpose || request.title || 'N/A'
  const participantsVal = options?.participants || request.participants || 'N/A'
  const dateNeededVal = formatDateUpper(options?.dateNeeded || request.dateNeeded || '') || 'N/A'
  const venueVal = options?.venue || request.venue || 'N/A'
  const assemblyVal = options?.assembly || request.assembly || 'N/A'

  // Purpose
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text('Purpose:', labelX, cursorY)
  doc.setFont('helvetica', 'bold')
  doc.text(purposeVal, valueX, cursorY)
  cursorY += lineHeight

  // Participants
  doc.setFont('helvetica', 'normal')
  doc.text('Participants:', labelX, cursorY)
  doc.setFont('helvetica', 'normal')
  doc.text(participantsVal, valueX, cursorY)
  cursorY += lineHeight

  // Date needed
  doc.setFont('helvetica', 'normal')
  doc.text('Date needed:', labelX, cursorY)
  doc.setFont('helvetica', 'bold')
  doc.text(dateNeededVal, valueX, cursorY)
  cursorY += lineHeight

  // Venue
  doc.setFont('helvetica', 'normal')
  doc.text('Venue:', labelX, cursorY)
  doc.setFont('helvetica', 'normal')
  doc.text(venueVal, valueX, cursorY)
  cursorY += lineHeight

  // Assembly
  doc.setFont('helvetica', 'normal')
  doc.text('Assembly:', labelX, cursorY)
  doc.setFont('helvetica', 'normal')
  doc.text(assemblyVal, valueX, cursorY)
  cursorY += lineHeight

  // Bottom line of details block
  cursorY += 1
  doc.setDrawColor(15, 23, 42)
  doc.setLineWidth(0.8)
  doc.line(14, cursorY, pageWidth - 14, cursorY)

  // Section title: Expected Expenses:
  cursorY += 7
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10.5)
  doc.text('Expected Expenses:', 14, cursorY)
  cursorY += 3

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
    { content: 'TOTAL', colSpan: 3, styles: { fontStyle: 'bold', fontSize: 10, halign: 'left' } } as any,
    { content: `P ${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, styles: { fontStyle: 'bold', fontSize: 10, halign: 'right' } } as any
  ])

  autoTable(doc, {
    startY: cursorY,
    head: [['Intended Use', 'Unit Price', 'Quantity', 'Amount']],
    body: tableBody,
    theme: 'grid',
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      fontSize: 9.5,
      halign: 'center',
      lineColor: [15, 23, 42],
      lineWidth: 0.3
    },
    bodyStyles: {
      textColor: [15, 23, 42],
      fontSize: 9,
      lineColor: [15, 23, 42],
      lineWidth: 0.2,
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
