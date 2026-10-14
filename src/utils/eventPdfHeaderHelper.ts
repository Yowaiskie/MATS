import type jsPDF from 'jspdf'

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'Anonymous'
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = url
  })
}

/** Standard Events report header, matching the Contributions report. */
export async function createEventPdfHeader(doc: jsPDF): Promise<() => void> {
  const [logoParish, logoMinistry] = await Promise.all([
    loadImage('/parish-logo.png').catch(() => loadImage('/favicon/favicon.png')).catch(() => null),
    loadImage('/ministy_logo.jpg').catch(() => null)
  ])
  return () => {
    const width = doc.internal.pageSize.getWidth()
    if (logoParish && logoMinistry) {
      doc.addImage(logoParish, 'PNG', width - 48, 6.5, 16, 16)
      doc.addImage(logoMinistry, 'JPEG', width - 30, 6.5, 16, 16)
    } else if (logoMinistry) {
      doc.addImage(logoMinistry, 'JPEG', width - 28, 6.5, 16, 16)
    } else if (logoParish) {
      doc.addImage(logoParish, 'PNG', width - 28, 6.5, 16, 16)
    }
    doc.setFont('times', 'bolditalic')
    doc.setFontSize(16)
    doc.setTextColor(15, 23, 42)
    doc.text('Ministry of Altar Servers', 14, 14)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(51, 65, 85)
    doc.text('Sacred Heart of Jesus Parish - Mbs', 14, 19.5)
    doc.text('Pilar Rd., Morning Breeze Subdivision, Caloocan City', 14, 24)
    doc.setDrawColor(30, 41, 59)
    doc.setLineWidth(0.6)
    doc.line(14, 28, width - 14, 28)
  }
}
