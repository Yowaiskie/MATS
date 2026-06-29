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
      
      // Simple parse for commas, ignoring simple quotes
      const values = line.split(',').map(v => v.trim().replace(/^["']|["']$/g, ''))
      
      const firstName = values[firstNameIdx] || ''
      const lastName = values[lastNameIdx] || ''
      const middleName = middleNameIdx !== -1 ? values[middleNameIdx] : ''
      const suffix = suffixIdx !== -1 ? values[suffixIdx] : ''
      const nickname = nicknameIdx !== -1 ? values[nicknameIdx] : ''
      const rank = values[rankIdx] || ''
      
      let statusStr = (statusIdx !== -1 ? values[statusIdx] : 'active').toLowerCase()
      const status: 'active' | 'inactive' = (statusStr === 'inactive') ? 'inactive' : 'active'
      
      const phoneNumber = phoneIdx !== -1 ? values[phoneIdx] : ''

      const rowErrors: string[] = []
      
      // Validation Check: Required Fields
      if (!firstName) {
        rowErrors.push('Missing First Name')
      }
      if (!lastName) {
        rowErrors.push('Missing Last Name')
      }
      if (!rank) {
        rowErrors.push('Missing Rank')
      }

      // Validation Check: Phone Format
      if (phoneNumber) {
        const phoneRegex = /^\+?[0-9]{7,15}$/
        if (!phoneRegex.test(phoneNumber)) {
          rowErrors.push('Invalid Phone Number (7-15 digits)')
        }
      }

      // Duplicate Check: Compare first+last combination against Firestore or within import file
      const matchKey = `${firstName.toLowerCase().trim()}|${lastName.toLowerCase().trim()}`
      
      const existsInDb = existingMembers.some(m => 
        isDuplicateName(firstName, lastName, m.firstName, m.lastName)
      )
      const isDuplicate = existsInDb || importedKeys.has(matchKey)
      
      if (firstName && lastName) {
        importedKeys.add(matchKey)
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
        errors: rowErrors
      })
    }

    setPreviewRows(rows)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null
    setFile(selectedFile)
    
    if (selectedFile) {
      const reader = new FileReader()
      reader.onload = (event) => {
        const text = event.target?.result as string
        processCSVText(text)
      }
      reader.onerror = () => {
        setErrorMsg('Failed to read the file.')
      }
      reader.readAsText(selectedFile)
    } else {
      setPreviewRows([])
    }
  }

  const handleImportSubmit = async () => {
    const validRows = previewRows.filter(r => r.isValid)
    if (validRows.length === 0) {
      setErrorMsg('No valid rows available to import.')
      return
    }

    setImporting(true)
    setErrorMsg(null)
    
    try {
      const importPayload: MemberInput[] = validRows.map(row => ({
        firstName: row.firstName,
        middleName: row.middleName || undefined,
        lastName: row.lastName,
        suffix: row.suffix || undefined,
        nickname: row.nickname || undefined,
        rank: row.rank,
        status: row.status,
        phoneNumber: row.phoneNumber || undefined
      }))

      await onImport(importPayload)
      setSuccessMsg(`Successfully imported ${validRows.length} members!`)
      setFile(null)
      setPreviewRows([])
    } catch (err: any) {
      console.error(err)
      setErrorMsg(err.message || 'Import failed. Please try again.')
    } finally {
      setImporting(false)
    }
  }

  const validCount = previewRows.filter(r => r.isValid).length
  const totalCount = previewRows.length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60" onClick={onClose}></div>

      {/* Modal */}
      <div className="relative w-full max-w-2xl rounded-lg border border-gray-800 bg-gray-950 p-6 shadow-xl z-10 text-white flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-850">
          <div>
            <h3 className="text-base font-bold text-white">Import Members via CSV</h3>
            <p className="text-xs text-gray-400 mt-0.5">Upload a CSV file containing up to 1000 members.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Inner Content scrollable */}
        <div className="mt-4 flex-1 overflow-y-auto space-y-4 pr-1">
          {errorMsg && (
            <div className="rounded border border-red-900 bg-red-950/40 p-3 text-xs text-red-400">
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="rounded border border-green-900 bg-green-950/40 p-3 text-xs text-green-400">
              {successMsg}
            </div>
          )}

          {/* Setup controls */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded border border-gray-900 bg-gray-900/20">
            <div>
              <span className="block text-xs font-semibold text-gray-300">CSV Layout Guidelines</span>
              <span className="text-xxs text-gray-500 block mt-0.5">Requires "First Name", "Last Name" and "Rank" column headers.</span>
            </div>
            <button
              onClick={handleDownloadTemplate}
              className="rounded border border-gray-800 bg-gray-900 hover:bg-gray-800 px-3 py-1.5 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              Download Template (.csv)
            </button>
          </div>

          {/* File Picker */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
              Select CSV File
            </label>
            <input
              type="file"
              accept=".csv"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border file:border-gray-800 file:text-xs file:font-semibold file:bg-gray-900 file:text-white hover:file:bg-gray-800 file:cursor-pointer"
              disabled={importing}
            />
          </div>

          {/* Preview Grid */}
          {previewRows.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-gray-400 pb-1">
                <span>Previewing parsed records:</span>
                <span className="font-medium text-gray-300">
                  {validCount} of {totalCount} rows valid
                </span>
              </div>

              <div className="border border-gray-850 rounded overflow-hidden max-h-48 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-gray-900/60 sticky top-0 text-gray-400 uppercase tracking-wider text-xxs border-b border-gray-850">
                    <tr>
                      <th className="p-2.5">Member Name</th>
                      <th className="p-2.5">Rank</th>
                      <th className="p-2.5">Status</th>
                      <th className="p-2.5">Phone</th>
                      <th className="p-2.5 text-right">Validation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-900 bg-gray-950/40">
                    {previewRows.map((row, idx) => {
                      const computedFullname = getFullName(row)
                      return (
                        <tr key={idx} className={row.isValid ? '' : 'bg-red-950/10'}>
                          <td className="p-2.5 truncate max-w-[150px] font-medium text-white" title={computedFullname}>
                            {computedFullname || <span className="text-gray-600">Empty Name</span>}
                          </td>
                          <td className="p-2.5 truncate max-w-[100px] text-gray-300">
                            {row.rank || <span className="text-gray-600">Empty</span>}
                          </td>
                          <td className="p-2.5 text-gray-400 capitalize">{row.status}</td>
                          <td className="p-2.5 text-gray-400">{row.phoneNumber || '--'}</td>
                          <td className="p-2.5 text-right font-semibold">
                            {row.isDuplicate && (
                              <span className="inline-block rounded bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 px-1.5 py-0.5 text-xxs mr-1">
                                Duplicate
                              </span>
                            )}
                            {row.isValid ? (
                              <span className="text-green-500">Valid</span>
                            ) : (
                              <span className="text-red-500 text-xxs truncate block max-w-[155px]" title={row.errors.join(', ')}>
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
        <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-850 mt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-gray-850 bg-transparent px-4 py-2 text-xs font-semibold hover:bg-gray-900 transition-colors disabled:opacity-50"
            disabled={importing}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleImportSubmit}
            className="rounded bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-xs font-semibold text-white transition-colors disabled:opacity-50"
            disabled={importing || previewRows.length === 0 || validCount === 0}
          >
            {importing ? 'Importing...' : `Import (${validCount} Valid Rows)`}
          </button>
        </div>
      </div>
    </div>
  )
}
