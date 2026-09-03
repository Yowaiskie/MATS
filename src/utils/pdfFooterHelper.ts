import type jsPDF from 'jspdf'

/**
 * Formats a given date (or current date) into MMDDYY format.
 * E.g., September 3, 2026 -> 090326
 */
export const formatDocCodeWithDate = (prefix: string, dateInput?: Date | string): string => {
  let validDate = new Date()
  if (dateInput) {
    const parsed = typeof dateInput === 'string' ? new Date(dateInput.replace(/-/g, '/')) : dateInput
    if (!isNaN(parsed.getTime())) {
      validDate = parsed
    }
  }

  const mm = String(validDate.getMonth() + 1).padStart(2, '0')
  const dd = String(validDate.getDate()).padStart(2, '0')
  const yy = String(validDate.getFullYear()).slice(-2)

  return `${prefix}-${mm}${dd}${yy}`
}

export interface StandardFooterOptions {
  leftMargin?: number
  rightMargin?: number
  bottomMargin?: number
  footerLineOffset?: number
}

/**
 * Draws the standard uniform footer on a single page of jsPDF:
 * - Line across bottom margin
 * - Left: MAS-KoA-SHJP.mbs
 * - Center: [pageNumber]
 * - Right: <fileCodeWithDate> (e.g., LQR-090326)
 */
export const drawStandardPdfFooter = (
  doc: jsPDF,
  pageNumber: number,
  fileCodeWithDate: string,
  options?: StandardFooterOptions
): void => {
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  const leftMargin = options?.leftMargin ?? 14
  const rightMargin = options?.rightMargin ?? 14
  const bottomMargin = options?.bottomMargin ?? 7.5
  const lineY = pageHeight - (options?.footerLineOffset ?? 11.5)
  const textY = pageHeight - bottomMargin

  // 1. Horizontal Divider Line
  doc.setDrawColor(15, 23, 42)
  doc.setLineWidth(0.5)
  doc.line(leftMargin, lineY, pageWidth - rightMargin, lineY)

  // 2. Footer Text
  doc.setFont('times', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(15, 23, 42)

  // Left
  doc.text('MAS-KoA-SHJP.mbs', leftMargin, textY, { align: 'left' })

  // Center: [1], [2], etc.
  doc.text(`[${pageNumber}]`, pageWidth / 2, textY, { align: 'center' })

  // Right: e.g. LQR-090326
  doc.text(fileCodeWithDate, pageWidth - rightMargin, textY, { align: 'right' })
}

/**
 * Applies the uniform footer across all pages in the jsPDF document.
 */
export const applyStandardPdfFooters = (
  doc: jsPDF,
  fileCodeWithDate: string,
  options?: StandardFooterOptions
): void => {
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    drawStandardPdfFooter(doc, i, fileCodeWithDate, options)
  }
}
