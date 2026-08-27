import type jsPDF from 'jspdf'
import type { SignatoryItem } from '@/types/signature'

export interface PdfSignatureOptions {
  leftMargin?: number
  rightMargin?: number
  bottomMargin?: number
  topMarginOnNewPage?: number
  lineWidth?: number
  onNewPageRequired?: () => void
}

/**
 * Renders dynamic signature blocks at the bottom of a jsPDF document.
 * Automatically checks for page overflow and supports 2-column or 1-column layouts.
 *
 * @returns The final Y position on the active page.
 */
export const renderPdfSignatures = (
  doc: jsPDF,
  signatories: SignatoryItem[],
  startY: number,
  options: PdfSignatureOptions = {}
): number => {
  if (!signatories || signatories.length === 0) {
    return startY
  }

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const leftMargin = options.leftMargin ?? 14
  const rightMargin = options.rightMargin ?? 14
  const bottomMargin = options.bottomMargin ?? 10
  const topMarginOnNewPage = options.topMarginOnNewPage ?? 42
  const contentWidth = pageWidth - leftMargin - rightMargin

  // Split into columns
  const col1Signatories = signatories.filter(s => s.column === 1 || !s.column)
  const col2Signatories = signatories.filter(s => s.column === 2)

  // Block metrics - compact & proportional
  const sigBlockHeight = 22 // Height per signature block in mm
  const sigGap = 4 // Vertical gap between stacked signatures in the same column

  const maxColCount = Math.max(col1Signatories.length, col2Signatories.length)
  const totalRequiredHeight = maxColCount * sigBlockHeight + Math.max(0, maxColCount - 1) * sigGap + 2

  let currentY = startY + 2

  // Check if signatures fit on current page
  if (currentY + totalRequiredHeight > pageHeight - bottomMargin) {
    doc.addPage()
    if (options.onNewPageRequired) {
      options.onNewPageRequired()
    }
    currentY = topMarginOnNewPage
  }

  // Column coordinate calculations
  const colWidth = Math.min(80, (contentWidth - 10) / 2)
  const col1X = leftMargin
  const col2X = leftMargin + contentWidth - colWidth
  const signatureLineLength = options.lineWidth ?? Math.min(76, colWidth)

  // Helper to draw a single signature block
  const drawSignatory = (sig: SignatoryItem, x: number, y: number) => {
    let blockY = y

    // 1. Role Label (e.g. "Prepared by:", "Approved by:")
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(30, 41, 59)
    doc.text(sig.label || 'Authorized Signature:', x, blockY)

    // 2. Space for Signature (optional image, or clear writing area)
    const signAreaY = blockY + 9
    if (sig.signatureImageUrl) {
      try {
        doc.addImage(sig.signatureImageUrl, 'PNG', x + 4, blockY + 1, 40, 8)
      } catch (err) {
        console.warn('Failed to draw signature image in PDF:', err)
      }
    }

    // 3. Signature Underline
    doc.setDrawColor(15, 23, 42)
    doc.setLineWidth(0.4)
    doc.line(x, signAreaY, x + signatureLineLength, signAreaY)

    // 4. Signatory Full Name (Bold Uppercase)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(15, 23, 42)
    const formattedName = sig.name?.trim() ? sig.name.trim().toUpperCase() : 'NAME / SIGNATURE'
    doc.text(formattedName, x, signAreaY + 3.8)

    // 5. Title / Position
    let nextTextY = signAreaY + 7.2
    if (sig.title?.trim()) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.setTextColor(51, 65, 85)
      doc.text(sig.title.trim(), x, nextTextY)
      nextTextY += 3.2
    }

    // 6. Organization / Parish
    if (sig.organization?.trim()) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.setTextColor(71, 85, 105)
      doc.text(sig.organization.trim(), x, nextTextY)
    }
  }

  // Draw Column 1
  let y1 = currentY
  col1Signatories.forEach(sig => {
    drawSignatory(sig, col1X, y1)
    y1 += sigBlockHeight + sigGap
  })

  // Draw Column 2
  let y2 = currentY
  col2Signatories.forEach(sig => {
    drawSignatory(sig, col2X, y2)
    y2 += sigBlockHeight + sigGap
  })

  return Math.max(y1, y2)
}
