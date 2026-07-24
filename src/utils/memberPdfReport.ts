import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { MemberReportRow } from '@/services/reportService'

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

/**
 * Generates direct download landscape PDF report.
 * Removes redundant "Member Status" column and styles "Triggering Absences" text
 * with alert highlight colors for easy readability.
 */
export const downloadMembersReportPdf = async (
  rows: MemberReportRow[],
  dateRange?: { start?: string; end?: string }
): Promise<void> => {
  const now = new Date()
  const dateStr = formatDate(now)
  const timeStr = formatTime(now)

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  })

  // Try loading logo
  try {
    const logoImg = await loadImage('/ministy_logo.jpg')
    doc.addImage(logoImg, 'JPEG', 14, 10, 14, 14)
  } catch (err) {
    console.warn('Logo image could not be loaded for PDF:', err)
  }

  // Header Title
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(15, 23, 42)
  doc.text('Ministry of Altar Servers', 32, 16)

  // Subtitle
  const rangeSubtitle = dateRange?.start || dateRange?.end
    ? `Period: ${dateRange.start || 'Start'} to ${dateRange.end || 'Present'}`
    : 'All Time Records'

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(37, 99, 235)
  doc.text(`Member Performance & Attendance Report (${rangeSubtitle})`, 32, 22)

  // Metadata Right
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(100, 116, 139)
  doc.text(`Generated: ${dateStr} at ${timeStr}`, 283, 16, { align: 'right' })
  doc.text(`Total Members: ${rows.length}`, 283, 21, { align: 'right' })

  // Divider Line
  doc.setDrawColor(37, 99, 235)
  doc.setLineWidth(0.5)
  doc.line(14, 27, 283, 27)

  // Table Headers (Removed "Member Status" column)
  const tableHead = [[
    '#',
    'Server Name',
    'Assigned',
    'Present',
    'Late',
    'Absent',
    'Excused',
    'Rate',
    'Status',
    'Triggering Absences'
  ]]

  const tableBody = rows.map((r, idx) => {
    let relevantMissed = r.missedSchedules

    // Filter relevant missed schedules depending on warningCategory
    if (r.warningCategory === 'sunday') {
      relevantMissed = r.missedSchedules.filter(m => m.isSunday)
    } else if (r.warningCategory === 'weekday') {
      relevantMissed = r.missedSchedules.filter(m => !m.isSunday && !m.isMeeting)
    } else if (r.warningCategory === 'meeting') {
      relevantMissed = r.missedSchedules.filter(m => m.isMeeting)
    }

    // Format triggering absences text
    let absentsFormatted = '—'
    if (r.warningStatus !== 'active') {
      if (relevantMissed.length > 0) {
        absentsFormatted = relevantMissed
          .map(item => `${item.date} • ${item.title}`)
          .join('\n')
      } else {
        absentsFormatted = `Absence threshold exceeded (${r.policyAbsencesCount} mark/s)`
      }
    }

    const statusLabel = r.warningStatus === 'suspended'
      ? 'SUSPENDED'
      : r.warningStatus === 'warning'
      ? 'WARNING'
      : r.warningStatus === 'inactive'
      ? 'INACTIVE'
      : 'ACTIVE'

    return [
      idx + 1,
      r.name,
      r.totalAssigned,
      r.present,
      r.late,
      r.absent,
      r.excused,
      `${r.rate}%`,
      statusLabel,
      absentsFormatted
    ]
  })

  autoTable(doc, {
    startY: 31,
    head: tableHead,
    body: tableBody,
    theme: 'grid',
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [51, 65, 85],
      fontSize: 8.5,
      fontStyle: 'bold',
      halign: 'left',
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [51, 65, 85],
      valign: 'middle',
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { fontStyle: 'bold', cellWidth: 48 },
      2: { halign: 'center', cellWidth: 20 },
      3: { halign: 'center', textColor: [22, 163, 74], fontStyle: 'bold', cellWidth: 18 },  // Present
      4: { halign: 'center', textColor: [217, 119, 6], fontStyle: 'bold', cellWidth: 16 },  // Late
      5: { halign: 'center', textColor: [220, 38, 38], fontStyle: 'bold', cellWidth: 18 },  // Absent
      6: { halign: 'center', cellWidth: 18 },
      7: { halign: 'right', fontStyle: 'bold', cellWidth: 20 },
      8: { halign: 'center', fontStyle: 'bold', cellWidth: 26 },                             // Status Badge
      9: { fontSize: 7.5, cellWidth: 'auto' },                                               // Triggering Absences
    },
    didParseCell: (data) => {
      // Style Status column (Column 8)
      if (data.section === 'body' && data.column.index === 8) {
        const val = String(data.cell.raw)
        if (val === 'SUSPENDED') {
          data.cell.styles.textColor = [185, 28, 28] // Red 700
          data.cell.styles.fillColor = [254, 226, 226] // Red 100
        } else if (val === 'WARNING') {
          data.cell.styles.textColor = [180, 83, 9]  // Amber 700
          data.cell.styles.fillColor = [254, 243, 199] // Amber 100
        } else if (val === 'INACTIVE') {
          data.cell.styles.textColor = [71, 85, 105] // Slate 700
          data.cell.styles.fillColor = [241, 245, 249] // Slate 100
        } else {
          data.cell.styles.textColor = [21, 128, 61] // Emerald 700
          data.cell.styles.fillColor = [220, 252, 231] // Emerald 100
        }
      }

      // Style Triggering Absences column (Column 9) with high-contrast alert font colors
      if (data.section === 'body' && data.column.index === 9) {
        const rowStatus = String(data.row.cells[8].raw)
        if (rowStatus === 'SUSPENDED') {
          data.cell.styles.textColor = [185, 28, 28] // Strong Red text for Suspended absences
          data.cell.styles.fontStyle = 'bold'
        } else if (rowStatus === 'WARNING') {
          data.cell.styles.textColor = [180, 83, 9]  // Strong Amber text for Warning absences
          data.cell.styles.fontStyle = 'bold'
        } else {
          data.cell.styles.textColor = [148, 163, 184] // Muted slate text for ACTIVE ('—')
        }
      }
    },
    didDrawPage: (data) => {
      const pageCount = doc.getNumberOfPages()
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(148, 163, 184)
      doc.text(
        'MATS Portal • Official Ministry Report',
        14,
        202
      )
      doc.text(
        `Page ${data.pageNumber} of ${pageCount}`,
        283,
        202,
        { align: 'right' }
      )
    },
  })

  const filename = `Ministry_Members_Report_${now.toISOString().split('T')[0]}.pdf`
  doc.save(filename)
}
