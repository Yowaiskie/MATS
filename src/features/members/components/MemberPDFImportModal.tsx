import React, { useState, useRef, useEffect } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import type { Member, MemberInput } from '@/types/member'
import { isDuplicateName, getFullName } from '@/utils/member'

// ─── Worker setup ────────────────────────────────────────────────────────────
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

// ─── Types ───────────────────────────────────────────────────────────────────
interface MemberPDFImportModalProps {
  isOpen: boolean
  onClose: () => void
  onImport: (inputs: MemberInput[]) => Promise<void>
  existingMembers: Member[]
}

interface PreviewRow {
  firstName: string
  lastName: string
  middleName: string
  suffix: string
  nickname: string
  homeAddress: string
  dateOfBirth: string
  contactNumber: string
  monthJoined: string
  dateOfInvestiture: string
  position: string
  order: string
  rank: string
  rawName: string
  isValid: boolean
  isDuplicate: boolean
  errors: string[]
}

// ─── Expected column headers ──────────────────────────────────────────────────
const EXPECTED_HEADERS = [
  'NAME',
  'NICK NAME',
  'HOME ADDRESS',
  'DATE OF BIRTH',
  'CONTACT NUMBER',
  'MONTH JOINED',
  'DATE OF INVESTITURE',
  'POSITION',
  'ORDER',
  'RANK',
] as const

type HeaderKey = typeof EXPECTED_HEADERS[number]

// ─── Name parser ──────────────────────────────────────────────────────────────
function parseName(raw: string): { firstName: string; lastName: string; middleName: string; suffix: string } {
  const cleaned = raw.trim()
  if (!cleaned) return { firstName: '', lastName: '', middleName: '', suffix: '' }

  const SUFFIXES = ['Jr.', 'Sr.', 'II', 'III', 'IV', 'V', 'Jr', 'Sr']

  if (cleaned.includes(',')) {
    const commaIdx = cleaned.indexOf(',')
    const lastPart = cleaned.slice(0, commaIdx).trim()
    const rest = cleaned.slice(commaIdx + 1).trim()
    const tokens = rest ? rest.split(/\s+/) : []
    let suffix = ''
    let filtered = tokens
    const lastToken = tokens[tokens.length - 1] || ''
    if (SUFFIXES.includes(lastToken)) {
      suffix = lastToken
      filtered = tokens.slice(0, -1)
    }
    const firstName = filtered[0] || ''
    const middleName = filtered.slice(1).join(' ')
    return { lastName: lastPart, firstName, middleName, suffix }
  }

  const tokens = cleaned.split(/\s+/)
  let suffix = ''
  let parts = tokens
  const lastToken = tokens[tokens.length - 1] || ''
  if (SUFFIXES.includes(lastToken)) {
    suffix = lastToken
    parts = tokens.slice(0, -1)
  }

  if (parts.length === 1) return { firstName: parts[0], lastName: '', middleName: '', suffix }
  if (parts.length === 2) return { firstName: parts[0], lastName: parts[1], middleName: '', suffix }
  return {
    firstName: parts[0],
    middleName: parts.slice(1, -1).join(' '),
    lastName: parts[parts.length - 1],
    suffix,
  }
}

// ─── PDF text extraction ──────────────────────────────────────────────────────
async function extractRowsFromPDF(file: File): Promise<string[][]> {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

  type TextItem = { x: number; y: number; text: string }
  const allItems: TextItem[] = []
  let globalPageY = 0

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const textContent = await page.getTextContent()
    const viewport = page.getViewport({ scale: 1 })

    for (const item of textContent.items) {
      if (!('str' in item) || !item.str.trim()) continue
      const x = (item as any).transform[4] as number
      const rawY = (item as any).transform[5] as number
      const y = globalPageY + (viewport.height - rawY)
      allItems.push({ x, y, text: item.str.trim() })
    }

    globalPageY += viewport.height + 20
  }

  if (allItems.length === 0) return []

  // Cluster by Y proximity
  const ROW_Y_TOLERANCE = 5
  allItems.sort((a, b) => a.y - b.y || a.x - b.x)

  const rows: TextItem[][] = []
  let currentRow: TextItem[] = [allItems[0]]

  for (let i = 1; i < allItems.length; i++) {
    const item = allItems[i]
    if (Math.abs(item.y - currentRow[0].y) <= ROW_Y_TOLERANCE) {
      currentRow.push(item)
    } else {
      rows.push([...currentRow].sort((a, b) => a.x - b.x))
      currentRow = [item]
    }
  }
  rows.push([...currentRow].sort((a, b) => a.x - b.x))

  return rows.map(row => row.map(item => item.text))
}

// ─── Parse extracted rows into preview data ───────────────────────────────────
function parseRows(rawRows: string[][], existingMembers: Member[]): { rows: PreviewRow[]; headerError: string | null } {
  if (rawRows.length === 0) return { rows: [], headerError: 'No readable text found in PDF.' }

  // Find header row
  let headerRowIdx = -1
  let colPositions: Partial<Record<HeaderKey, number>> = {}

  for (let i = 0; i < Math.min(rawRows.length, 20); i++) {
    const rowText = rawRows[i].map(c => c.toUpperCase().trim())
    const combined = rowText.join(' ')

    const matched: Partial<Record<HeaderKey, number>> = {}
    for (const header of EXPECTED_HEADERS) {
      const idx = rowText.findIndex(cell => cell.includes(header) || header.includes(cell))
      if (idx !== -1) matched[header] = idx
    }

    const matchCount = Object.keys(matched).length
    if (matchCount >= 3 && (matched['NAME'] !== undefined || matched['RANK'] !== undefined)) {
      // Also handle multi-word headers that might be split across cells
      // (e.g. "NICK" and "NAME" as two separate cells)
      // Try combining adjacent cells to find split headers
      if (matched['NICK NAME'] === undefined) {
        for (let j = 0; j < rowText.length - 1; j++) {
          if ((rowText[j] + ' ' + rowText[j + 1]).includes('NICK NAME')) {
            matched['NICK NAME'] = j
          }
        }
      }
      if (matched['HOME ADDRESS'] === undefined) {
        for (let j = 0; j < rowText.length - 1; j++) {
          if ((rowText[j] + ' ' + rowText[j + 1]).includes('HOME ADDRESS') || combined.includes('HOME ADDRESS')) {
            const idx2 = rowText.findIndex(c => c.includes('HOME') || c.includes('ADDRESS'))
            if (idx2 !== -1) matched['HOME ADDRESS'] = idx2
          }
        }
      }
      if (matched['DATE OF BIRTH'] === undefined && combined.includes('BIRTH')) {
        const idx2 = rowText.findIndex(c => c.includes('BIRTH') || c.includes('DATE'))
        if (idx2 !== -1) matched['DATE OF BIRTH'] = idx2
      }
      if (matched['CONTACT NUMBER'] === undefined && combined.includes('CONTACT')) {
        const idx2 = rowText.findIndex(c => c.includes('CONTACT') || c.includes('NUMBER'))
        if (idx2 !== -1) matched['CONTACT NUMBER'] = idx2
      }
      if (matched['MONTH JOINED'] === undefined && combined.includes('JOINED')) {
        const idx2 = rowText.findIndex(c => c.includes('MONTH') || c.includes('JOINED'))
        if (idx2 !== -1) matched['MONTH JOINED'] = idx2
      }
      if (matched['DATE OF INVESTITURE'] === undefined && combined.includes('INVESTITURE')) {
        const idx2 = rowText.findIndex(c => c.includes('INVESTITURE'))
        if (idx2 !== -1) matched['DATE OF INVESTITURE'] = idx2
      }

      headerRowIdx = i
      colPositions = matched
      break
    }
  }

  if (headerRowIdx === -1) {
    return {
      rows: [],
      headerError: `Could not detect column headers. Make sure the PDF has these headers: ${EXPECTED_HEADERS.join(', ')}`,
    }
  }

  const importedKeys = new Set<string>()
  const previewRows: PreviewRow[] = []

  for (let i = headerRowIdx + 1; i < rawRows.length; i++) {
    const cols = rawRows[i]
    if (cols.every(c => !c.trim())) continue

    const getCel = (key: HeaderKey): string => {
      const idx = colPositions[key]
      if (idx === undefined) return ''
      return (cols[idx] || '').trim()
    }

    const rawName = getCel('NAME')
    const nickname = getCel('NICK NAME')
    const homeAddress = getCel('HOME ADDRESS')
    const dateOfBirth = getCel('DATE OF BIRTH')
    const contactNumber = getCel('CONTACT NUMBER')
    const monthJoined = getCel('MONTH JOINED')
    const dateOfInvestiture = getCel('DATE OF INVESTITURE')
    const position = getCel('POSITION')
    const order = getCel('ORDER')
    const rank = getCel('RANK')

    if (!rawName && !rank) continue

    // Skip rows that are just repeating headers
    if (rawName.toUpperCase() === 'NAME') continue

    const { firstName, lastName, middleName, suffix } = parseName(rawName)
    const rowErrors: string[] = []

    if (!rawName.trim()) rowErrors.push('Name is required.')
    else if (!firstName) rowErrors.push('Could not parse first name.')
    // if (!rank) rowErrors.push('Rank is required.')

    let isDuplicate = false
    if (firstName && lastName) {
      isDuplicate = existingMembers.some(m => isDuplicateName(firstName, lastName, m.firstName, m.lastName))
    }

    const nameKey = `${firstName.toLowerCase()}|${lastName.toLowerCase()}`
    if (firstName && lastName) {
      if (importedKeys.has(nameKey)) {
        rowErrors.push('Duplicate entry in PDF.')
      } else {
        importedKeys.add(nameKey)
      }
    }

    previewRows.push({
      firstName, lastName, middleName, suffix,
      nickname, homeAddress, dateOfBirth, contactNumber,
      monthJoined, dateOfInvestiture, position, order, rank,
      rawName,
      isValid: rowErrors.length === 0,
      isDuplicate,
      errors: rowErrors,
    })
  }

  return { rows: previewRows, headerError: null }
}

// ─── Component ────────────────────────────────────────────────────────────────
export const MemberPDFImportModal: React.FC<MemberPDFImportModalProps> = ({
  isOpen,
  onClose,
  onImport,
  existingMembers,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([])
  const [importing, setImporting] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) {
      setPreviewRows([])
      setErrorMsg(null)
      setSuccessMsg(null)
      setFileName(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null
    setPreviewRows([])
    setErrorMsg(null)
    setSuccessMsg(null)

    if (!file) { setFileName(null); return }
    setFileName(file.name)

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setErrorMsg('Please upload a valid PDF file (.pdf).')
      return
    }

    setParsing(true)
    try {
      const rawRows = await extractRowsFromPDF(file)
      const { rows, headerError } = parseRows(rawRows, existingMembers)

      if (headerError) {
        setErrorMsg(headerError)
      } else if (rows.length === 0) {
        setErrorMsg('No data rows were found after the header row. Make sure the PDF has member records.')
      } else {
        setPreviewRows(rows)
      }
    } catch (err: any) {
      console.error(err)
      setErrorMsg(`Failed to parse PDF: ${err?.message || 'Unknown error. Check the browser console.'}`)
    } finally {
      setParsing(false)
    }
  }

  const handleImportSubmit = async () => {
    const validInputs: MemberInput[] = previewRows
      .filter(r => r.isValid)
      .map(r => ({
        firstName: r.firstName.trim(),
        middleName: r.middleName.trim() || undefined,
        lastName: r.lastName.trim(),
        suffix: r.suffix.trim() || undefined,
        nickname: r.nickname.trim() || undefined,
        homeAddress: r.homeAddress.trim() || undefined,
        dateOfBirth: r.dateOfBirth.trim() || undefined,
        rank: r.rank.trim(),
        status: 'active' as const,
        phoneNumber: r.contactNumber.trim() || undefined,
        monthJoined: r.monthJoined.trim() || undefined,
        dateOfInvestiture: r.dateOfInvestiture.trim() || undefined,
        position: r.position.trim() || undefined,
        order: r.order.trim() || undefined,
      }))

    if (validInputs.length === 0) return
    setImporting(true)
    setErrorMsg(null)
    setSuccessMsg(null)

    try {
      await onImport(validInputs)
      setSuccessMsg(`Successfully imported ${validInputs.length} member records from PDF!`)
      setPreviewRows([])
      setFileName(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err: any) {
      console.error(err)
      setErrorMsg('Failed to save records. Check Firestore permissions.')
    } finally {
      setImporting(false)
    }
  }

  const handleClose = () => {
    setPreviewRows([])
    setErrorMsg(null)
    setSuccessMsg(null)
    setFileName(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    onClose()
  }

  const validCount = previewRows.filter(r => r.isValid).length
  const totalCount = previewRows.length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md transition-opacity" onClick={handleClose} />

      <div className="relative w-full max-w-5xl rounded-3xl border border-slate-200/80 bg-white p-6 shadow-2xl z-10 text-slate-800 flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">

        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 bg-white">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-extrabold text-sm shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100 inline-block mb-0.5">
                PDF Document Extraction
              </span>
              <h3 className="text-base font-black text-slate-900 tracking-tight">Import Members from PDF</h3>
              <p className="text-xs font-semibold text-slate-500 mt-0.5">Extract and parse tabular member data directly from PDF rosters.</p>
            </div>
          </div>
          <button onClick={handleClose} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer focus:outline-none">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="mt-4 flex-1 space-y-4 overflow-y-auto pr-1">

          {errorMsg && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800 font-bold flex items-start gap-2 animate-fade-in">
              <svg className="h-4 w-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-800 font-bold flex items-start gap-2 animate-fade-in">
              <svg className="h-4 w-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{successMsg}</span>
            </div>
          )}

          {/* File picker */}
          <div className="p-4 rounded-lg border border-gray-200 bg-gray-50/50">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">
              Select PDF File
            </label>
            <input
              type="file"
              accept=".pdf,application/pdf"
              ref={fileInputRef}
              onChange={handleFileChange}
              disabled={importing || parsing}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border file:border-gray-200 file:text-xs file:font-semibold file:bg-white file:text-gray-700 hover:file:bg-gray-100 file:cursor-pointer transition-colors"
            />
            {fileName && !parsing && (
              <p className="mt-2 text-xs text-gray-500">
                Selected: <span className="font-semibold text-gray-700">{fileName}</span>
              </p>
            )}
          </div>

          {parsing && (
            <div className="flex items-center gap-3 p-3 rounded-lg border border-blue-100 bg-blue-50 text-xs text-blue-600">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent flex-shrink-0" />
              Extracting and parsing PDF text, please wait…
            </div>
          )}

          {/* Preview table */}
          {previewRows.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Parsed records preview:</span>
                <span className="font-bold text-gray-700">{validCount} of {totalCount} valid</span>
              </div>

              <div className="border border-gray-200 rounded-xl overflow-hidden max-h-80 overflow-y-auto">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse" style={{ minWidth: '900px' }}>
                    <thead className="bg-gray-50 sticky top-0 text-gray-400 uppercase tracking-wider text-[9px] border-b border-gray-200 font-bold z-10">
                      <tr>
                        <th className="p-2 whitespace-nowrap">Name</th>
                        <th className="p-2 whitespace-nowrap">Nick Name</th>
                        <th className="p-2 whitespace-nowrap">Home Address</th>
                        <th className="p-2 whitespace-nowrap">Date of Birth</th>
                        <th className="p-2 whitespace-nowrap">Contact No.</th>
                        <th className="p-2 whitespace-nowrap">Month Joined</th>
                        <th className="p-2 whitespace-nowrap">Date of Investiture</th>
                        <th className="p-2 whitespace-nowrap">Position</th>
                        <th className="p-2 whitespace-nowrap">Order</th>
                        <th className="p-2 whitespace-nowrap">Rank</th>
                        <th className="p-2 whitespace-nowrap text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {previewRows.map((row, idx) => {
                        const fullName = getFullName(row)
                        return (
                          <tr key={idx} className={row.isValid ? 'hover:bg-gray-50/30' : 'bg-red-50/40 hover:bg-red-50/60'}>
                            <td className="p-2 font-bold text-gray-900 max-w-[130px] truncate" title={fullName}>
                              {fullName || <span className="text-gray-400 italic">No Name</span>}
                            </td>
                            <td className="p-2 text-gray-600 max-w-[80px] truncate">{row.nickname || '--'}</td>
                            <td className="p-2 text-gray-600 max-w-[120px] truncate" title={row.homeAddress}>{row.homeAddress || '--'}</td>
                            <td className="p-2 text-gray-600 whitespace-nowrap">{row.dateOfBirth || '--'}</td>
                            <td className="p-2 text-gray-600 whitespace-nowrap">{row.contactNumber || '--'}</td>
                            <td className="p-2 text-gray-600 whitespace-nowrap">{row.monthJoined || '--'}</td>
                            <td className="p-2 text-gray-600 whitespace-nowrap">{row.dateOfInvestiture || '--'}</td>
                            <td className="p-2 text-gray-600 max-w-[80px] truncate">{row.position || '--'}</td>
                            <td className="p-2 text-gray-600">{row.order || '--'}</td>
                            <td className="p-2 text-gray-600">{row.rank || <span className="italic text-gray-400">—</span>}</td>
                            <td className="p-2 text-right font-semibold whitespace-nowrap">
                              {row.isDuplicate && (
                                <span className="inline-block rounded-md bg-amber-50 border border-amber-100 text-amber-600 px-1.5 py-0.5 text-[9px] mr-1">
                                  Duplicate
                                </span>
                              )}
                              {row.isValid
                                ? <span className="text-green-600 font-bold text-[10px]">✓ Valid</span>
                                : <span className="text-red-600 text-[10px] truncate block max-w-[140px]" title={row.errors.join(', ')}>{row.errors[0]}</span>
                              }
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100 mt-4 bg-white sticky bottom-0">
          <span className="text-[10px] font-bold text-slate-400">
            {totalCount > 0 && `${totalCount} record${totalCount !== 1 ? 's' : ''} detected · ${validCount} valid`}
          </span>
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={importing || parsing}
              className="rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-700 transition-all disabled:opacity-50 cursor-pointer shadow-2xs"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleImportSubmit}
              disabled={importing || parsing || validCount === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-5 py-2.5 text-xs font-black text-white transition-all disabled:opacity-50 cursor-pointer shadow-md shadow-indigo-500/20 active:scale-95"
            >
              {importing ? 'Importing…' : `Import PDF (${validCount} Valid)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
