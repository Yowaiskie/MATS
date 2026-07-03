import React, { useState, useRef } from 'react'
import type { Member, MemberInput } from '@/types/member'
import { isDuplicateName, getFullName } from '@/utils/member'

interface MemberImportModalProps {
  isOpen: boolean
  onClose: () => void
  onImport: (inputs: MemberInput[]) => Promise<void>
  existingMembers: Member[]
}

interface PreviewRow {
  firstName: string
  middleName: string
  lastName: string
  suffix: string
  nickname: string
  rank: string
  status: 'active' | 'inactive'
  phoneNumber: string
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

  // Trigger download of standard template CSV file matching the split name fields
  const handleDownloadTemplate = () => {
    const headers = 'First Name,Last Name,Middle Name,Suffix,Nickname,Rank,Status,Phone Number\n'
    const sampleRow = 'John,Doe,Smith,Jr.,Johnny,Brother,active,+639123456789\n'
    const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent(headers + sampleRow)
    const link = document.createElement('a')
    link.setAttribute('href', csvContent)
    link.setAttribute('download', 'mats_member_template.csv')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
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
    const rawHeaders = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''))
    
    const firstNameIdx = rawHeaders.findIndex(h => h.toLowerCase() === 'first name')
    const lastNameIdx = rawHeaders.findIndex(h => h.toLowerCase() === 'last name')
    const middleNameIdx = rawHeaders.findIndex(h => h.toLowerCase() === 'middle name')
    const suffixIdx = rawHeaders.findIndex(h => h.toLowerCase() === 'suffix')
    const nicknameIdx = rawHeaders.findIndex(h => h.toLowerCase() === 'nickname')
    const rankIdx = rawHeaders.findIndex(h => h.toLowerCase() === 'rank')
    const statusIdx = rawHeaders.findIndex(h => h.toLowerCase() === 'status')
    const phoneIdx = rawHeaders.findIndex(h => h.toLowerCase() === 'phone number')

    if (firstNameIdx === -1 || lastNameIdx === -1 || rankIdx === -1) {
      setErrorMsg('Invalid CSV headers. "First Name", "Last Name" and "Rank" headers are required.')
      setPreviewRows([])
      return
    }

    const rows: PreviewRow[] = []
    // Keep local set of imported names to flag duplicates within the same CSV upload
    const importedKeys = new Set<string>()

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]
      
      // Simple parser for comma-separated, ignoring inner commas wrapped in quotes if simple
      const cols = line.split(',').map(c => c.trim().replace(/^["']|["']$/g, ''))
      
      const firstName = cols[firstNameIdx] || ''
      const lastName = cols[lastNameIdx] || ''
      const middleName = middleNameIdx !== -1 ? cols[middleNameIdx] || '' : ''
      const suffix = suffixIdx !== -1 ? cols[suffixIdx] || '' : ''
      const nickname = nicknameIdx !== -1 ? cols[nicknameIdx] || '' : ''
      const rank = cols[rankIdx] || ''
      
      let rawStatus = (statusIdx !== -1 ? cols[statusIdx] || '' : '').toLowerCase()
      const status = rawStatus === 'inactive' ? 'inactive' : 'active'
      const phoneNumber = phoneIdx !== -1 ? cols[phoneIdx] || '' : ''

      const rowErrors: string[] = []
      
      if (!firstName) rowErrors.push('First name is required.')
      if (!lastName) rowErrors.push('Last name is required.')
      if (!rank) rowErrors.push('Rank is required.')
      
      if (phoneNumber) {
        const phoneRegex = /^\+?[0-9]{7,15}$/
        if (!phoneRegex.test(phoneNumber)) {
          rowErrors.push('Invalid phone format.')
        }
      }

      // Check duplicate name inside Firestore database
      let isDuplicate = false
      if (firstName && lastName) {
        isDuplicate = existingMembers.some(
          (m) => isDuplicateName(firstName, lastName, m.firstName, m.lastName)
        )
      }

      // Check duplicate name inside the same CSV upload
      const nameKey = `${firstName.toLowerCase().trim()}|${lastName.toLowerCase().trim()}`
      if (firstName && lastName) {
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
        rank,
        status,
        phoneNumber,
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
        middleName: row.middleName.trim() || undefined,
        lastName: row.lastName.trim(),
        suffix: row.suffix.trim() || undefined,
        nickname: row.nickname.trim() || undefined,
        rank: row.rank.trim(),
        status: row.status,
        phoneNumber: row.phoneNumber.trim() || undefined,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity" onClick={handleClose}></div>

      {/* Modal Card */}
      <div className="relative w-full max-w-2xl rounded-xl border border-gray-200 bg-white p-6 shadow-xl z-10 text-gray-800 flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div>
            <h3 className="text-sm font-bold text-gray-900">Bulk Import Members</h3>
            <p className="text-xs text-gray-500 mt-0.5">Upload a CSV file with split first/last name fields.</p>
          </div>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-700 transition-colors cursor-pointer focus:outline-none">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="mt-4 flex-1 space-y-4 overflow-y-auto pr-1">
          {errorMsg && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-650">
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-xs text-green-600">
              {successMsg}
            </div>
          )}

          {/* Setup controls */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-lg border border-gray-200 bg-gray-50/50">
            <div>
              <span className="block text-xs font-bold text-gray-700">CSV Layout Guidelines</span>
              <span className="text-[10px] text-gray-500 block mt-0.5 leading-tight">Requires "First Name", "Last Name" and "Rank" column headers.</span>
            </div>
            <button
              onClick={handleDownloadTemplate}
              className="rounded-lg border border-gray-200 bg-white hover:bg-gray-50 px-3.5 py-2 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors shadow-sm cursor-pointer whitespace-nowrap"
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

              <div className="border border-gray-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-gray-50 sticky top-0 text-gray-400 uppercase tracking-wider text-[10px] border-b border-gray-200 font-bold z-10">
                    <tr>
                      <th className="p-2.5">Member Name</th>
                      <th className="p-2.5">Rank</th>
                      <th className="p-2.5">Status</th>
                      <th className="p-2.5">Phone</th>
                      <th className="p-2.5 text-right">Validation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {previewRows.map((row, idx) => {
                      const computedFullname = getFullName(row)
                      return (
                        <tr key={idx} className={row.isValid ? 'hover:bg-gray-50/20' : 'bg-red-50/40 hover:bg-red-50/60'}>
                          <td className="p-2.5 truncate max-w-[150px] font-bold text-gray-900" title={computedFullname}>
                            {computedFullname || <span className="text-gray-400 italic">Empty Name</span>}
                          </td>
                          <td className="p-2.5 truncate max-w-[100px] text-gray-600">
                            {row.rank || <span className="text-gray-400 italic">Empty</span>}
                          </td>
                          <td className="p-2.5 text-gray-500 capitalize">{row.status}</td>
                          <td className="p-2.5 text-gray-500">{row.phoneNumber || '--'}</td>
                          <td className="p-2.5 text-right font-semibold">
                            {row.isDuplicate && (
                              <span className="inline-block rounded-md bg-amber-50 border border-amber-100 text-amber-600 px-1.5 py-0.5 text-[9px] mr-1">
                                Duplicate
                              </span>
                            )}
                            {row.isValid ? (
                              <span className="text-green-600 font-bold">Valid</span>
                            ) : (
                              <span className="text-red-600 text-[10px] truncate block max-w-[155px] font-medium" title={row.errors.join(', ')}>
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
        <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-100 mt-4 bg-white">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg border border-gray-200 bg-white hover:bg-gray-550 px-4 py-2 text-xs font-semibold text-gray-700 hover:text-gray-900 transition-colors disabled:opacity-50 cursor-pointer shadow-sm animate-none"
            disabled={importing}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleImportSubmit}
            className="rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-2 text-xs font-bold text-white transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
            disabled={importing || previewRows.length === 0 || validCount === 0}
          >
            {importing ? 'Importing...' : `Import (${validCount} Valid Rows)`}
          </button>
        </div>
      </div>
    </div>
  )
}
