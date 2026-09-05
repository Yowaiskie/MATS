import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { FinanceReportData } from '@/services/finance/reportService'

const formatDate = (d: Date): string => {
  return d.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  })
}

const formatTime = (d: Date): string => {
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
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

import type { SignatureConfig } from '@/types/signature'
import { renderPdfSignatures } from '@/utils/pdfSignatureHelper'
import { formatDocCodeWithDate, applyStandardPdfFooters } from '@/utils/pdfFooterHelper'

export interface FinancePdfOptions {
  documentTitle?: string
  signatureConfig?: SignatureConfig
}

export const downloadFinanceReportPdf = async (
  report: FinanceReportData,
  options?: FinancePdfOptions
): Promise<void> => {
  const now = new Date()
  const dateStr = formatDate(now)
  const timeStr = formatTime(now)

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

  // 2. Helper to draw Uniform Header
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

  // Document Title (Centered & Bold Underline Style)
  const titleText = (options?.documentTitle?.trim() || 'TREASURY FINANCIAL STATEMENT & REPORT').toUpperCase()
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(15, 23, 42)
  const titleWidth = doc.getTextWidth(titleText)
  const titleX = (pageWidth - titleWidth) / 2
  const titleY = 37
  doc.text(titleText, titleX, titleY)
  doc.setLineWidth(0.5)
  doc.setDrawColor(15, 23, 42)
  doc.line(titleX, titleY + 1.2, titleX + titleWidth, titleY + 1.2)

  // Sub-header Metadata Row
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(71, 85, 105)
  doc.text(`Covered Period: ${report.startDate} to ${report.endDate}`, 14, 45)
  doc.text(`Generated: ${dateStr} at ${timeStr}`, pageWidth - 14, 45, { align: 'right' })

  // Section: Executive Summary Boxes
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  doc.setTextColor(15, 23, 42)
  doc.text('EXECUTIVE FINANCIAL SUMMARY', 14, 53)

  const startY = 56
  const boxWidth = 42
  const boxHeight = 17
  const gap = 4.6

  // 1. Opening Balance Box
  doc.setDrawColor(226, 232, 240)
  doc.setFillColor(248, 250, 252)
  doc.roundedRect(14, startY, boxWidth, boxHeight, 2, 2, 'FD')
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(100, 116, 139)
  doc.text('OPENING BALANCE', 14 + boxWidth / 2, startY + 5.5, { align: 'center' })
  doc.setFontSize(9.5)
  doc.setTextColor(71, 85, 105)
  doc.text(`P ${report.openingBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 14 + boxWidth / 2, startY + 12.5, { align: 'center' })

  // 2. Total Inflow (Income) Box
  doc.setDrawColor(226, 232, 240)
  doc.setFillColor(248, 250, 252)
  doc.roundedRect(14 + boxWidth + gap, startY, boxWidth, boxHeight, 2, 2, 'FD')
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(100, 116, 139)
  doc.text('TOTAL INFLOW', 14 + boxWidth + gap + boxWidth / 2, startY + 5.5, { align: 'center' })
  doc.setFontSize(9.5)
  doc.setTextColor(22, 163, 74)
  doc.text(`+P ${report.totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 14 + boxWidth + gap + boxWidth / 2, startY + 12.5, { align: 'center' })

  // 3. Total Outflow (Expenses) Box
  doc.setDrawColor(226, 232, 240)
  doc.setFillColor(248, 250, 252)
  doc.roundedRect(14 + (boxWidth + gap) * 2, startY, boxWidth, boxHeight, 2, 2, 'FD')
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(100, 116, 139)
  doc.text('TOTAL OUTFLOW', 14 + (boxWidth + gap) * 2 + boxWidth / 2, startY + 5.5, { align: 'center' })
  doc.setFontSize(9.5)
  doc.setTextColor(220, 38, 38)
  doc.text(`-P ${report.totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 14 + (boxWidth + gap) * 2 + boxWidth / 2, startY + 12.5, { align: 'center' })

  // 4. Closing / Net Balance Box
  if (report.closingBalance >= 0) {
    doc.setDrawColor(187, 247, 208)
    doc.setFillColor(240, 253, 244)
    doc.setTextColor(21, 128, 61)
  } else {
    doc.setDrawColor(254, 202, 202)
    doc.setFillColor(254, 242, 242)
    doc.setTextColor(185, 28, 28)
  }
  doc.roundedRect(14 + (boxWidth + gap) * 3, startY, boxWidth, boxHeight, 2, 2, 'FD')
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'bold')
  doc.text('CLOSING BALANCE', 14 + (boxWidth + gap) * 3 + boxWidth / 2, startY + 5.5, { align: 'center' })
  doc.setFontSize(9.5)
  doc.text(`P ${report.closingBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 14 + (boxWidth + gap) * 3 + boxWidth / 2, startY + 12.5, { align: 'center' })

  let currentY = startY + boxHeight + 10

  // Section: Income Breakdown Table (Rendered only if entries exist)
  const incTableHead = [['#', 'CATEGORY / SOURCE', 'AMOUNT (P)']]
  const incTableBody = (report.incomeByCategory || [])
    .filter(item => item.total > 0)
    .sort((a, b) => b.total - a.total)
    .map((item, idx) => {
      return [
        String(idx + 1),
        item.categoryName.toUpperCase(),
        item.total.toLocaleString('en-US', { minimumFractionDigits: 2 })
      ]
    })

  if (incTableBody.length > 0) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(15, 23, 42)
    doc.text('1. INCOMES BY CATEGORY / SOURCE', 14, currentY)
    currentY += 3.5

    autoTable(doc, {
      startY: currentY,
      head: incTableHead,
      body: incTableBody,
      theme: 'grid',
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontSize: 8.5,
        fontStyle: 'bold',
        cellPadding: 2.8
      },
      bodyStyles: {
        fontSize: 8.5,
        textColor: [15, 23, 42],
        cellPadding: 2.5
      },
      columnStyles: {
        0: { cellWidth: 12, halign: 'center', fontStyle: 'bold' },
        1: { cellWidth: 125 },
        2: { cellWidth: 45, halign: 'right', textColor: [22, 163, 74], fontStyle: 'bold' }
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      margin: { left: 14, right: 14 },
      didDrawPage: d => {
        currentY = d.cursor ? d.cursor.y : currentY
      }
    })
    currentY = (doc as any).lastAutoTable.finalY + 9
  }

  // Section: Expense Breakdown Table (Rendered only if entries exist)
  const expTableHead = [['#', 'CATEGORY', 'AMOUNT (P)']]
  const expTableBody = (report.expenseByCategory || [])
    .filter(item => item.total > 0)
    .sort((a, b) => b.total - a.total)
    .map((item, idx) => {
      return [
        String(idx + 1),
        item.categoryName.toUpperCase(),
        item.total.toLocaleString('en-US', { minimumFractionDigits: 2 })
      ]
    })

  if (expTableBody.length > 0) {
    // Check page height before expenses section
    if (currentY > 225) {
      doc.addPage()
      currentY = 49
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(15, 23, 42)
    doc.text(incTableBody.length > 0 ? '2. EXPENSES BY CATEGORY' : '1. EXPENSES BY CATEGORY', 14, currentY)
    currentY += 3.5

    autoTable(doc, {
      startY: currentY,
      head: expTableHead,
      body: expTableBody,
      theme: 'grid',
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontSize: 8.5,
        fontStyle: 'bold',
        cellPadding: 2.8
      },
      bodyStyles: {
        fontSize: 8.5,
        textColor: [15, 23, 42],
        cellPadding: 2.5
      },
      columnStyles: {
        0: { cellWidth: 12, halign: 'center', fontStyle: 'bold' },
        1: { cellWidth: 125 },
        2: { cellWidth: 45, halign: 'right', textColor: [220, 38, 38], fontStyle: 'bold' }
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      margin: { left: 14, right: 14 },
      didDrawPage: d => {
        currentY = d.cursor ? d.cursor.y : currentY
      }
    })
    currentY = (doc as any).lastAutoTable.finalY + 9
  }

  // Section: Detailed Ledger Table
  if (report.ledgerEntries && report.ledgerEntries.length > 0) {
    if (currentY > 215) {
      doc.addPage()
      currentY = 49
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(15, 23, 42)
    doc.text('3. DETAILED TRANSACTION LEDGER ENTRIES', 14, currentY)
    currentY += 3.5

    const ledgerHead = [['#', 'DATE', 'REF NO', 'DESCRIPTION', 'IN (P)', 'OUT (P)', 'BALANCE (P)']]
    const ledgerBody = report.ledgerEntries.map((e, idx) => [
      String(idx + 1),
      e.date,
      (e.referenceNumber || '-').toUpperCase(),
      e.description.toUpperCase(),
      e.amountIn > 0 ? `+${e.amountIn.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '-',
      e.amountOut > 0 ? `-${e.amountOut.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '-',
      e.runningBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })
    ])

    autoTable(doc, {
      startY: currentY,
      head: ledgerHead,
      body: ledgerBody,
      theme: 'grid',
      showHead: 'everyPage',
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: 'bold',
        cellPadding: 2.6
      },
      bodyStyles: {
        fontSize: 7.5,
        textColor: [15, 23, 42],
        cellPadding: 2.4
      },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center', fontStyle: 'bold' },
        1: { cellWidth: 20 },
        2: { cellWidth: 24, fontStyle: 'bold' },
        3: { cellWidth: 64 },
        4: { cellWidth: 22, halign: 'right', textColor: [22, 163, 74], fontStyle: 'bold' },
        5: { cellWidth: 22, halign: 'right', textColor: [220, 38, 38], fontStyle: 'bold' },
        6: { cellWidth: 22, halign: 'right', fontStyle: 'bold' }
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      margin: { left: 14, right: 14, top: 49, bottom: 16 }
    })
    currentY = (doc as any).lastAutoTable.finalY + 8
  }

  // Section: Dynamic Signatures
  if (options?.signatureConfig?.enabled && options.signatureConfig.signatories.length > 0) {
    currentY = renderPdfSignatures(doc, options.signatureConfig.signatories, currentY, {
      leftMargin: 14,
      rightMargin: 14,
      bottomMargin: 18,
      topMarginOnNewPage: 49
    })
  }

  // Draw uniform header across all generated pages
  const totalPages = (doc as any).internal.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    drawUniformHeader()
  }

  // Apply uniform standard footer across all pages
  const docCode = formatDocCodeWithDate('FIN', report.endDate || now)
  applyStandardPdfFooters(doc, docCode, { leftMargin: 14, rightMargin: 14 })

  // Save the PDF
  const filename = `MATS_Financial_Report_${report.startDate}_to_${report.endDate}.pdf`
  doc.save(filename)
}
