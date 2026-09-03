import React, { useState, useRef } from 'react'
import type { Member, MemberInput } from '@/types/member'
import { isDuplicateName, getFullName } from '@/utils/member'

interface MemberImportModalProps {
  isOpen: boolean
  onClose: () => void
  onImport: (inputs: MemberInput[]) => Promise<void>
  existingMembers: Member[]
}

interface PreviewRow extends MemberInput {
  isValid: boolean
  isDuplicate: boolean
  errors: string[]
}

export const MemberImportModal: React.FC<MemberImportModalProps> = ({
  isOpen,
  onClose,
  onImport,
  existingMembers,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [, setFile] = useState<File | null>(null)
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([])
  const [importing, setImporting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  if (!isOpen) return null

  // Trigger download of standard template CSV file matching the master list
  const handleDownloadTemplate = () => {
    const headers = '#,NAME,NICKNAME,ADDRESS,DATE_OF_BIRTH,CONTACT_NUMBER,MONTH_JOINED,DATE_OF_INVESTITURE,POSITION,ORDER,RANK\n'
    const sampleRow = '01,"DOE, JOHN SMITH JR.",Johnny,"123 Main St., City",01-01-2000,09123456789,2020-01,"Jan 01, 2020",Member,Pal,Brother\n'
    const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent(headers + sampleRow)
    const link = document.createElement('a')
    link.setAttribute('href', csvContent)
    link.setAttribute('download', 'mats_member_template.csv')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Proper CSV line parser that respects quotes
  const parseCSVLine = (text: string): string[] => {
    const result: string[] = []
    let inQuotes = false
    let current = ''
    for (let i = 0; i < text.length; i++) {
      const char = text[i]
      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim().replace(/^["']|["']$/g, ''))
        current = ''
      } else {
        current += char
      }
    }
    result.push(current.trim().replace(/^["']|["']$/g, ''))
    return result
  }

  // Parse CSV content client-side
  const processCSVText = (text: string) => {
    setErrorMsg(null)
    setSuccessMsg(null)
    
    // Clean UTF-8 BOM if present
    const cleanedText = text.replace(/^\uFEFF/, '')
    
    // Normalize newlines and clean lines
    const lines = cleanedText.split(/\r?\n/).map(line => line.trim()).filter(line => line !== '')
    if (lines.length <= 1) {
      setErrorMsg('The uploaded file is empty or only contains headers.')
      setPreviewRows([])
      return
    }

    if (lines.length - 1 > 1000) {
      setErrorMsg('Import exceeds the maximum limit of 1000 rows.')
      setPreviewRows([])
      return
    }

    // Parse headers row
    const headerColumns = parseCSVLine(lines[0]).map(h => h.toLowerCase().replace(/\s+/g, ''))
    
    const findCol = (...aliases: string[]): number => {
      for (const alias of aliases) {
        const idx = headerColumns.indexOf(alias)
        if (idx !== -1) return idx
      }
      return -1
    }

    // Column indices support both formats (Master List format and old format)
    const colName = findCol('name', 'fullname')
    const colFirstName = findCol('firstname')
    const colLastName = findCol('lastname')
    const colMiddleName = findCol('middlename')
    const colSuffix = findCol('suffix')
    const colNickname = findCol('nickname')
    const colAddress = findCol('address', 'homeaddress')
    const colDob = findCol('date_of_birth', 'dateofbirth', 'dob', 'birthday')
    const colPhone = findCol('contact_number', 'contactnumber', 'phone', 'phonenumber')
    const colMonthJoined = findCol('month_joined', 'monthjoined')
    const colInvestiture = findCol('date_of_investiture', 'dateofinvestiture', 'investiture')
    const colPosition = findCol('position')
    const colOrder = findCol('order', 'ordergroup', 'group', 'order_group', 'order group', 'team')
    const colRank = findCol('rank')
    const colStatus = findCol('status')

    // At least Name or (First Name and Last Name) must be present
    if (colName === -1 && (colFirstName === -1 || colLastName === -1)) {
      setErrorMsg('Invalid CSV headers. Missing Name column (or First/Last Name columns).')
      setPreviewRows([])
      return
    }

    const rows: PreviewRow[] = []
    // Keep local set of imported names to flag duplicates within the same CSV upload
    const importedKeys = new Set<string>()

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]
      const cols = parseCSVLine(line)
      
      let firstName = ''
      let lastName = ''
      let middleName = ''
      let suffix = ''

      // Parse name fields
      if (colName !== -1 && cols[colName]) {
        // Master list format: "LASTNAME, FIRSTNAME MIDDLENAME SUFFIX"
        const nameParts = cols[colName].split(',')
        if (nameParts.length > 1) {
          lastName = nameParts[0].trim()
          firstName = nameParts[1].trim()
        } else {
          // Fallback if no comma
          firstName = cols[colName].trim()
        }
      } else {
        firstName = colFirstName !== -1 ? cols[colFirstName] || '' : ''
        lastName = colLastName !== -1 ? cols[colLastName] || '' : ''
        middleName = colMiddleName !== -1 ? cols[colMiddleName] || '' : ''
        suffix = colSuffix !== -1 ? cols[colSuffix] || '' : ''
      }
      
      const nickname = colNickname !== -1 ? cols[colNickname] || '' : ''
      const homeAddress = colAddress !== -1 ? cols[colAddress] || '' : ''
      const dateOfBirth = colDob !== -1 ? cols[colDob] || '' : ''
      const phoneNumber = colPhone !== -1 ? cols[colPhone] || '' : ''
      const monthJoined = colMonthJoined !== -1 ? cols[colMonthJoined] || '' : ''
      const dateOfInvestiture = colInvestiture !== -1 ? cols[colInvestiture] || '' : ''
      const position = colPosition !== -1 ? cols[colPosition] || '' : ''
      const order = colOrder !== -1 ? cols[colOrder] || '' : ''
      const rank = colRank !== -1 ? cols[colRank] || '' : ''
      
      let rawStatus = (colStatus !== -1 ? cols[colStatus] || '' : '').toLowerCase()
      const status: 'active' | 'inactive' | 'archived' = rawStatus === 'inactive' ? 'inactive' : 'active'

      const rowErrors: string[] = []
      
      if (!firstName && !lastName) rowErrors.push('Name is required.')
      
      // We don't make rank strictly required for import since the master list has some empty ranks
      // if (!rank) rowErrors.push('Rank is required.')
      
      if (phoneNumber) {
        const phoneRegex = /^[0-9\+\-\s\(\)]+$/ // Relaxed phone validation
        if (!phoneRegex.test(phoneNumber)) {
          rowErrors.push('Invalid phone format.')
        }
      }

      // Check duplicate name inside Firestore database
      let isDuplicate = false
      if (firstName || lastName) {
        isDuplicate = existingMembers.some(
          (m) => isDuplicateName(firstName, lastName, m.firstName, m.lastName)
        )
      }

      // Check duplicate name inside the same CSV upload
      const nameKey = `${firstName.toLowerCase().trim()}|${lastName.toLowerCase().trim()}`
      if (firstName || lastName) {
        if (importedKeys.has(nameKey)) {
          rowErrors.push('Duplicate record found in CSV.')
        } else {
          importedKeys.add(nameKey)
        }
      }

      rows.push({
        firstName,
        middleName,
        lastName,
        suffix,
        nickname,
        homeAddress,
        dateOfBirth,
        phoneNumber,
        monthJoined,
        dateOfInvestiture,
        position,
        order,
        rank,
        status,
        isValid: rowErrors.length === 0,
        isDuplicate,
        errors: rowErrors,
      })
    }

    setPreviewRows(rows)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null
    setFile(file)
    setPreviewRows([])
    setErrorMsg(null)
    setSuccessMsg(null)

    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        const text = event.target?.result as string
        processCSVText(text)
      }
      reader.readAsText(file)
    }
  }

  const handleImportSubmit = async () => {
    const validInputs = previewRows
      .filter(row => row.isValid)
      .map(row => ({
        firstName: row.firstName.trim(),
        middleName: row.middleName?.trim() || undefined,
        lastName: row.lastName.trim(),
        suffix: row.suffix?.trim() || undefined,
        nickname: row.nickname?.trim() || undefined,
        homeAddress: row.homeAddress?.trim() || undefined,
        dateOfBirth: row.dateOfBirth?.trim() || undefined,
        phoneNumber: row.phoneNumber?.trim() || undefined,
        monthJoined: row.monthJoined?.trim() || undefined,
        dateOfInvestiture: row.dateOfInvestiture?.trim() || undefined,
        position: row.position?.trim() || undefined,
        order: row.order?.trim() || undefined,
        rank: row.rank.trim(),
        status: row.status,
      }))

    if (validInputs.length === 0) return

    setImporting(true)
    setErrorMsg(null)
    setSuccessMsg(null)

    try {
      await onImport(validInputs)
      setSuccessMsg(`Successfully imported ${validInputs.length} member records!`)
      setPreviewRows([])
      if (fileInputRef.current) fileInputRef.current.value = ''
      setFile(null)
    } catch (err: any) {
      console.error(err)
      setErrorMsg('Failed to process bulk import. Check Firestore permissions.')
    } finally {
      setImporting(false)
    }
  }

  const handleClose = () => {
    setPreviewRows([])
    setErrorMsg(null)
    setSuccessMsg(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    setFile(null)
    onClose()
  }

  const validCount = previewRows.filter(r => r.isValid).length
  const totalCount = previewRows.length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md transition-opacity" onClick={handleClose}></div>

      {/* Modal Card */}
      <div className="relative w-full max-w-5xl rounded-3xl border border-slate-200/80 bg-white p-6 shadow-2xl z-10 text-slate-800 flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 bg-white">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-extrabold text-sm shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100 inline-block mb-0.5">
                Batch Processing
              </span>
              <h3 className="text-base font-black text-slate-900 tracking-tight">Bulk Import Members</h3>
              <p className="text-xs font-semibold text-slate-500 mt-0.5">Upload a CSV file based on the Master List template.</p>
            </div>
          </div>
          <button onClick={handleClose} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer focus:outline-none">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="mt-4 flex-1 space-y-4 overflow-y-auto pr-1">
          {errorMsg && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800 font-bold animate-fade-in">
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-800 font-bold animate-fade-in">
              {successMsg}
            </div>
          )}

          {/* Setup controls */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl border border-slate-200/80 bg-slate-50">
            <div>
              <span className="block text-xs font-black text-slate-800 uppercase tracking-tight">CSV Layout Guidelines</span>
              <span className="text-[11px] text-slate-500 block mt-0.5 leading-tight">Supports Master List format (NAME, NICKNAME, ADDRESS, etc.)</span>
            </div>
            <button
              onClick={handleDownloadTemplate}
              className="rounded-xl border border-slate-200 bg-white hover:bg-slate-100 px-3.5 py-2 text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-all shadow-2xs cursor-pointer whitespace-nowrap"
            >
              Download Template (.csv)
            </button>
          </div>

          {/* File Picker */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">
              Select CSV File
            </label>
            <input
              type="file"
              accept=".csv"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border file:border-gray-200 file:text-xs file:font-semibold file:bg-gray-50 file:text-gray-700 hover:file:bg-gray-100 file:cursor-pointer transition-colors"
              disabled={importing}
            />
          </div>

          {/* Preview Grid */}
          {previewRows.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-gray-500 pb-1">
                <span>Previewing parsed records:</span>
                <span className="font-bold text-gray-700">
                  {validCount} of {totalCount} rows valid
                </span>
              </div>

              <div className="border border-gray-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-gray-50 sticky top-0 text-gray-400 uppercase tracking-wider text-[10px] border-b border-gray-200 font-bold z-10">
                    <tr>
                      <th className="p-2.5">Name</th>
                      <th className="p-2.5">Nickname</th>
                      <th className="p-2.5">Address</th>
                      <th className="p-2.5">DOB</th>
                      <th className="p-2.5">Phone</th>
                      <th className="p-2.5">Joined</th>
                      <th className="p-2.5">Investiture</th>
                      <th className="p-2.5">Position</th>
                      <th className="p-2.5">Order</th>
                      <th className="p-2.5">Rank</th>
                      <th className="p-2.5 text-right">Validation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {previewRows.map((row, idx) => {
                      const computedFullname = getFullName(row as unknown as Member)
                      return (
                        <tr key={idx} className={row.isValid ? 'hover:bg-gray-50/20' : 'bg-red-50/40 hover:bg-red-50/60'}>
                          <td className="p-2.5 truncate max-w-[120px] font-bold text-gray-900" title={computedFullname}>
                            {computedFullname || <span className="text-gray-400 italic">Empty</span>}
                          </td>
                          <td className="p-2.5 truncate max-w-[80px] text-gray-600">{row.nickname || '--'}</td>
                          <td className="p-2.5 truncate max-w-[100px] text-gray-600" title={row.homeAddress}>{row.homeAddress || '--'}</td>
                          <td className="p-2.5 text-gray-500">{row.dateOfBirth || '--'}</td>
                          <td className="p-2.5 text-gray-500">{row.phoneNumber || '--'}</td>
                          <td className="p-2.5 text-gray-500">{row.monthJoined || '--'}</td>
                          <td className="p-2.5 text-gray-500 whitespace-nowrap">{row.dateOfInvestiture || '--'}</td>
                          <td className="p-2.5 text-gray-500">{row.position || '--'}</td>
                          <td className="p-2.5 text-gray-500">{row.order || '--'}</td>
                          <td className="p-2.5 text-gray-500">{row.rank || '--'}</td>
                          <td className="p-2.5 text-right font-semibold whitespace-nowrap">
                            {row.isDuplicate && (
                              <span className="inline-block rounded-md bg-blue-50 border border-blue-100 text-blue-600 px-1.5 py-0.5 text-[9px] mr-1">
                                Will Update
                              </span>
                            )}
                            {row.isValid ? (
                              <span className="text-green-600 font-bold">Valid</span>
                            ) : (
                              <span className="text-red-600 text-[10px] truncate max-w-[120px] inline-block align-bottom font-medium" title={row.errors.join(', ')}>
                                {row.errors[0]}
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Actions Footer */}
        <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100 mt-4 bg-white sticky bottom-0">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-700 transition-all disabled:opacity-50 cursor-pointer shadow-2xs"
            disabled={importing}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleImportSubmit}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-5 py-2.5 text-xs font-black text-white transition-all disabled:opacity-50 cursor-pointer shadow-md shadow-indigo-500/20 active:scale-95"
            disabled={importing || previewRows.length === 0 || validCount === 0}
          >
            {importing ? 'Importing...' : `Import (${validCount} Valid Rows)`}
          </button>
        </div>
      </div>
    </div>
  )
}
