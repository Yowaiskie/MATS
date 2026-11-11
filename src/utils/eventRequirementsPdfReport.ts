import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { EventRequirement, RequirementMemberRow } from '@/types/eventRequirement'
import type { SignatureConfig } from '@/types/signature'
import { renderPdfSignatures } from '@/utils/pdfSignatureHelper'
import { applyStandardPdfFooters, formatDocCodeWithDate } from '@/utils/pdfFooterHelper'
import { createEventPdfHeader } from '@/utils/eventPdfHeaderHelper'

interface ReportData {
  eventName: string
  rows: RequirementMemberRow[]
  requirements: EventRequirement[]
  filterDescription: string
}

export interface RequirementsPdfOptions {
  documentTitle: string
  signatureConfig: SignatureConfig
  orientation?: 'portrait' | 'landscape'
}

export async function downloadEventRequirementsPdf(data: ReportData, options: RequirementsPdfOptions): Promise<void> {
  if (!data.rows.length) throw new Error('No members to export.')
  const orientation = options.orientation ?? 'landscape'
  const pdf = new jsPDF({ orientation, unit: 'mm', format: 'a4' })
  const width = pdf.internal.pageSize.getWidth()
  const drawEventHeader = await createEventPdfHeader(pdf)
  const now = new Date()
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(13.5)
  const titleLines = pdf.splitTextToSize(options.documentTitle.trim().toUpperCase(), width - 28) as string[]
  const dateText = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase()
  const dateY = 37 + titleLines.length * 6 + 3
  const tableTop = dateY + 8

  const drawHeader = () => {
    drawEventHeader()
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(13.5)
    pdf.setTextColor(15, 23, 42)
    titleLines.forEach((line, index) => {
      const y = 37 + index * 6
      pdf.text(line, width / 2, y, { align: 'center' })
      const halfWidth = pdf.getTextWidth(line) / 2
      pdf.setLineWidth(0.5)
      pdf.line(width / 2 - halfWidth, y + 1.2, width / 2 + halfWidth, y + 1.2)
    })
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(10)
    pdf.setTextColor(15, 23, 42)
    pdf.text(dateText, width - 14, dateY, { align: 'right' })
  }

  // Keep each requirement readable; repeat identity and overall status for each group.
  const groups: EventRequirement[][] = []
  const groupSize = orientation === 'portrait' ? 3 : 5
  for (let i = 0; i < data.requirements.length; i += groupSize) groups.push(data.requirements.slice(i, i + groupSize))
  if (!groups.length) groups.push([])
  let finalY = tableTop
  groups.forEach((group, index) => {
    if (index) pdf.addPage()
    const rankWidth = orientation === 'portrait' ? 21 : 24
    const memberWidth = group.length ? (orientation === 'portrait' ? 48 : 55) : width - 28 - rankWidth - 28
    autoTable(pdf, {
      startY: tableTop,
      margin: { top: tableTop, bottom: 20, left: 14, right: 14 },
      head: [['Member', 'Rank', ...group.map(r => r.title), 'Overall']],
      body: data.rows.map(row => [row.name, row.rank, ...group.map(r => row.cells[r.id]), `${row.status}\n${row.completed}/${row.required} done`]),
      styles: { fontSize: 8, cellPadding: 3, overflow: 'linebreak' },
      headStyles: { fillColor: [30, 41, 59], textColor: 255 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 0: { cellWidth: memberWidth }, 1: { cellWidth: rankWidth }, [group.length + 2]: { cellWidth: 28 } },
      rowPageBreak: 'avoid',
      didDrawPage: () => drawHeader(),
      didParseCell: hook => {
        if (hook.section !== 'body') return
        const text = hook.cell.text[0]
        if (text === 'Done' || text === 'Complete') hook.cell.styles.textColor = [4, 120, 87]
        if (text === 'Pending' || text === 'Incomplete') hook.cell.styles.textColor = [180, 83, 9]
      },
      didDrawCell: hook => { if (hook.section === 'body') finalY = hook.cell.y + hook.cell.height }
    })
  })
  if (options.signatureConfig.enabled) {
    renderPdfSignatures(pdf, options.signatureConfig.signatories, finalY + 10, { bottomMargin: 20, topMarginOnNewPage: tableTop, onNewPageRequired: drawHeader })
  }
  applyStandardPdfFooters(pdf, formatDocCodeWithDate('ERR', now))
  const filename = data.eventName.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 80) || 'Event'
  pdf.save(`${filename}_Requirements_${now.toISOString().slice(0, 10)}.pdf`)
}
