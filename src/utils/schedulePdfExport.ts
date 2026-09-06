import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatDocCodeWithDate, drawStandardPdfFooter } from '@/utils/pdfFooterHelper'

export interface SundayMassSlotExport {
  id: string
  dayName: 'Saturday' | 'Sunday'
  timeLabel: string
  servers: string[]
}

export interface WeekdayMassRowExport {
  timeLabel: string
  monday: string[]
  tuesday: string[]
  wednesday: string[]
  thursday: string[]
  friday: string[]
  saturday: string[]
}

export interface LiturgicalCelebrationExport {
  id: string
  celebration: string
  timeAndDate: string
  vestment: string
}

export interface ServiceScheduleExportData {
  monthYearTitle: string // e.g. "DECEMBER 2025"
  sundayMasses: SundayMassSlotExport[]
  weekdayMasses: WeekdayMassRowExport[]
  celebrations: LiturgicalCelebrationExport[]
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

/**
 * Generates the jsPDF Document object for the Service Assignment Schedule.
 * Compactly calibrated to fit on exactly 1 Long Bond Paper (8.5 x 13 in) Landscape page.
 */
export const generateSchedulePdfDoc = async (
  data: ServiceScheduleExportData
): Promise<jsPDF> => {
  // Long Bond Paper: 8.5 x 13 inches in Landscape (330.2 mm width x 215.9 mm height)
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: [215.9, 330.2]
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const leftMargin = 10
  const rightMargin = 10
  const contentWidth = pageWidth - leftMargin - rightMargin

  // 1. Prepare Logos
  let logoLeft: HTMLImageElement | null = null
  let logoRight: HTMLImageElement | null = null

  try {
    logoLeft = await loadImage('/parish-logo.png')
  } catch {
    try {
      logoLeft = await loadImage('/favicon/favicon.png')
    } catch {
      try {
        logoLeft = await loadImage('/favicon/icon-192.png')
      } catch {
        // Fallback
      }
    }
  }

  try {
    logoRight = await loadImage('/ministy_logo.jpg')
  } catch {
    // Fallback
  }

  // 2. Draw Uniform Official Header
  // Left: Parish Information
  doc.setFont('times', 'bolditalic')
  doc.setFontSize(15)
  doc.setTextColor(15, 23, 42)
  doc.text('Ministry of Altar Servers', leftMargin, 11)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(30, 41, 59)
  doc.text('SACRED HEART OF JESUS PARISH - MBS', leftMargin, 16)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(71, 85, 105)
  doc.text('Pilar Rd., Morning Breeze Subdivision, Caloocan City', leftMargin, 20)

  // Center: Dual Logos
  const logoSize = 17
  const centerCenterX = pageWidth / 2
  const logoTopY = 5.5
  if (logoLeft && logoRight) {
    doc.addImage(logoLeft, 'PNG', centerCenterX - logoSize - 2, logoTopY, logoSize, logoSize)
    doc.addImage(logoRight, 'JPEG', centerCenterX + 2, logoTopY, logoSize, logoSize)
  } else if (logoRight) {
    doc.addImage(logoRight, 'JPEG', centerCenterX - logoSize / 2, logoTopY, logoSize, logoSize)
  } else if (logoLeft) {
    doc.addImage(logoLeft, 'PNG', centerCenterX - logoSize / 2, logoTopY, logoSize, logoSize)
  }

  // Right: Title & Month/Year
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13.5)
  doc.setTextColor(15, 23, 42)
  const mainTitleText = 'Service Assignment Schedule'
  const titleWidth = doc.getTextWidth(mainTitleText)
  const titleRightX = pageWidth - rightMargin - titleWidth
  doc.text(mainTitleText, titleRightX, 13)

  // Underline for title
  doc.setDrawColor(15, 23, 42)
  doc.setLineWidth(0.5)
  doc.line(titleRightX, 14.2, titleRightX + titleWidth, 14.2)

  // Month & Year
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12.5)
  doc.setTextColor(15, 23, 42)
  const monthText = data.monthYearTitle.trim().toUpperCase()
  const monthWidth = doc.getTextWidth(monthText)
  doc.text(monthText, pageWidth - rightMargin - monthWidth, 21.5)

  // Header bottom border line
  doc.setDrawColor(15, 23, 42)
  doc.setLineWidth(0.5)
  doc.line(leftMargin, 25, pageWidth - rightMargin, 25)

  let currentY = 29.5

  // --- SECTION 1: SUNDAY MASSES (ACV) ---
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.setTextColor(15, 23, 42)
  doc.text('SUNDAY MASSES (ACV)', pageWidth / 2, currentY, { align: 'center' })
  currentY += 2

  const sundaySlots = data.sundayMasses.length > 0 ? data.sundayMasses : []
  const satSlots = sundaySlots.filter(s => s.dayName === 'Saturday')
  const sunSlots = sundaySlots.filter(s => s.dayName === 'Sunday')

  const serversColWidth = 16

  const headRow1: any[] = [
    { content: '', styles: { fillColor: [217, 225, 242] } }
  ]
  if (satSlots.length > 0) {
    headRow1.push({
      content: 'Saturday',
      colSpan: satSlots.length,
      styles: { halign: 'center', fillColor: [226, 240, 217], fontStyle: 'bold' as const, fontSize: 8 }
    })
  }
  if (sunSlots.length > 0) {
    headRow1.push({
      content: 'Sunday',
      colSpan: sunSlots.length,
      styles: { halign: 'center', fillColor: [226, 240, 217], fontStyle: 'bold' as const, fontSize: 8 }
    })
  }

  const headRow2: any[] = [
    { content: '', styles: { fillColor: [217, 225, 242] } }
  ]
  sundaySlots.forEach(slot => {
    headRow2.push({
      content: slot.timeLabel,
      styles: { halign: 'center', fillColor: [226, 240, 217], fontStyle: 'bold' as const, fontSize: 6.8 }
    })
  })

  // Body Row: "Servers" on the left, then list of servers in each column
  const bodyRow: any[] = [
    {
      content: 'Servers',
      styles: {
        fillColor: [217, 225, 242],
        fontStyle: 'bold' as const,
        halign: 'center',
        valign: 'middle',
        fontSize: 8
      }
    }
  ]

  sundaySlots.forEach(slot => {
    const listText = slot.servers.length > 0 ? slot.servers.join('\n') : '----'
    bodyRow.push({
      content: listText,
      styles: {
        fillColor: [255, 255, 255],
        halign: 'center',
        valign: 'top',
        fontSize: 7,
        cellPadding: 1.5
      }
    })
  })

  autoTable(doc, {
    startY: currentY,
    margin: { left: leftMargin, right: rightMargin },
    head: [headRow1, headRow2],
    body: [bodyRow],
    theme: 'grid',
    styles: {
      lineColor: [0, 0, 0],
      lineWidth: 0.25,
      textColor: [0, 0, 0],
      overflow: 'linebreak'
    },
    columnStyles: {
      0: { cellWidth: serversColWidth }
    }
  })

  currentY = (doc as any).lastAutoTable.finalY + 5

  // --- SECTION 2: WEEKDAY MASSES (SSV) ---
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.setTextColor(15, 23, 42)
  doc.text('WEEKDAY MASSES (SSV)', pageWidth / 2, currentY, { align: 'center' })
  currentY += 2

  const weekdayCols = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const weekdayHead: any[] = [
    { content: 'Time \\ Day', styles: { fillColor: [217, 225, 242], halign: 'center', fontStyle: 'bold' as const, fontSize: 7.5 } },
    ...weekdayCols.map(day => ({
      content: day,
      styles: { fillColor: [226, 240, 217], halign: 'center', fontStyle: 'bold' as const, fontSize: 7.5 }
    }))
  ]

  const weekdayBodyRows: any[] = data.weekdayMasses.map(row => {
    return [
      {
        content: row.timeLabel,
        styles: { fillColor: [217, 225, 242], halign: 'center', valign: 'middle', fontStyle: 'bold' as const, fontSize: 7.5 }
      },
      { content: row.monday.length > 0 ? row.monday.join('\n') : '----', styles: { halign: 'center', valign: 'middle', fontSize: 7 } },
      { content: row.tuesday.length > 0 ? row.tuesday.join('\n') : '----', styles: { halign: 'center', valign: 'middle', fontSize: 7 } },
      { content: row.wednesday.length > 0 ? row.wednesday.join('\n') : '----', styles: { halign: 'center', valign: 'middle', fontSize: 7 } },
      { content: row.thursday.length > 0 ? row.thursday.join('\n') : '----', styles: { halign: 'center', valign: 'middle', fontSize: 7 } },
      { content: row.friday.length > 0 ? row.friday.join('\n') : '----', styles: { halign: 'center', valign: 'middle', fontSize: 7 } },
      { content: row.saturday.length > 0 ? row.saturday.join('\n') : '----', styles: { halign: 'center', valign: 'middle', fontSize: 7 } }
    ]
  })

  const timeDayWidth = 26
  const dayColWidth = (contentWidth - timeDayWidth) / 6

  autoTable(doc, {
    startY: currentY,
    margin: { left: leftMargin, right: rightMargin },
    head: [weekdayHead],
    body: weekdayBodyRows,
    theme: 'grid',
    styles: {
      lineColor: [0, 0, 0],
      lineWidth: 0.25,
      textColor: [0, 0, 0],
      cellPadding: 1.8,
      overflow: 'linebreak'
    },
    columnStyles: {
      0: { cellWidth: timeDayWidth },
      1: { cellWidth: dayColWidth },
      2: { cellWidth: dayColWidth },
      3: { cellWidth: dayColWidth },
      4: { cellWidth: dayColWidth },
      5: { cellWidth: dayColWidth },
      6: { cellWidth: dayColWidth }
    }
  })

  currentY = (doc as any).lastAutoTable.finalY + 5

  // --- SECTION 3: OTHER LITURGICAL CELEBRATIONS ---
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.setTextColor(15, 23, 42)
  doc.text('OTHER LITURGICAL CELEBRATIONS', pageWidth / 2, currentY, { align: 'center' })
  currentY += 2

  const celebrationsHead: any[] = [
    { content: 'Celebration', styles: { fillColor: [226, 240, 217], halign: 'center', fontStyle: 'bold' as const, fontSize: 8 } },
    { content: 'Time and Date', styles: { fillColor: [226, 240, 217], halign: 'center', fontStyle: 'bold' as const, fontSize: 8 } },
    { content: 'Vestment', styles: { fillColor: [226, 240, 217], halign: 'center', fontStyle: 'bold' as const, fontSize: 8 } }
  ]

  const celebrationsBody: any[] = data.celebrations.map(c => [
    {
      content: c.celebration,
      styles: { fillColor: [217, 225, 242], halign: 'center', valign: 'middle', fontStyle: 'bold' as const, fontSize: 7.5 }
    },
    {
      content: c.timeAndDate,
      styles: { fillColor: [255, 255, 255], halign: 'center', valign: 'middle', fontSize: 7.5, cellPadding: 2 }
    },
    {
      content: c.vestment,
      styles: { fillColor: [255, 255, 255], halign: 'center', valign: 'middle', fontSize: 7.5, cellPadding: 2 }
    }
  ])

  const celebColWidth = 42
  const vestmentColWidth = 65
  const timeDateColWidth = contentWidth - celebColWidth - vestmentColWidth

  autoTable(doc, {
    startY: currentY,
    margin: { left: leftMargin, right: rightMargin },
    head: [celebrationsHead],
    body: celebrationsBody,
    theme: 'grid',
    styles: {
      lineColor: [0, 0, 0],
      lineWidth: 0.25,
      textColor: [0, 0, 0],
      overflow: 'linebreak'
    },
    columnStyles: {
      0: { cellWidth: celebColWidth },
      1: { cellWidth: timeDateColWidth },
      2: { cellWidth: vestmentColWidth }
    }
  })

  // 3. Draw Standard Uniform Footer
  const docCode = formatDocCodeWithDate('SAS')
  drawStandardPdfFooter(doc, 1, docCode, {
    leftMargin,
    rightMargin,
    bottomMargin: 6,
    footerLineOffset: 9
  })

  return doc
}

/**
 * Downloads the generated PDF to user's device.
 */
export const downloadSchedulePdfLongLandscape = async (
  data: ServiceScheduleExportData,
  filename?: string
): Promise<void> => {
  const doc = await generateSchedulePdfDoc(data)
  const docCode = formatDocCodeWithDate('SAS')
  const finalFilename = filename || `${docCode}.pdf`
  doc.save(finalFilename)
}

/**
 * Directly prints the generated PDF.
 */
export const printSchedulePdf = async (
  data: ServiceScheduleExportData
): Promise<void> => {
  const doc = await generateSchedulePdfDoc(data)
  doc.autoPrint()
  const blob = doc.output('blob')
  const blobUrl = URL.createObjectURL(blob)
  const printWindow = window.open(blobUrl, '_blank')
  if (printWindow) {
    printWindow.focus()
  } else {
    // Fallback if popup blocked
    const iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    iframe.src = blobUrl
    document.body.appendChild(iframe)
    iframe.onload = () => {
      iframe.contentWindow?.focus()
      iframe.contentWindow?.print()
    }
  }
}

/**
 * Backward compatibility alias
 */
export const downloadSchedulePdfLongPortrait = downloadSchedulePdfLongLandscape

