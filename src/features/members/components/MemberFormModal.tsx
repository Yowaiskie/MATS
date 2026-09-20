import React, { useState, useEffect } from 'react'
import type { Member, MemberInput, SuspensionDurationType } from '@/types/member'
import { ORDER_GROUPS, MEMBER_RANKS, ORDER_COLORS, getMemberOrders, formatMemberOrders } from '@/types/member'
import { isDuplicateName } from '@/utils/member'
import { CustomSelect } from '@/components'

const SUSPENSION_PRESET_REASONS = [
  'Attendance Infractions',
  'Disciplinary Action',
  'Leave of Absence / Academic',
  'Personal / Health',
  'Conduct Violation',
  'Other / Custom'
]

const getTodayString = (): string => {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dt = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dt}`
}

const addMonthsToDate = (dateStr: string, months: number): string => {
  if (!dateStr) return ''
  const parts = dateStr.split('-').map(Number)
  if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) return ''
  const d = new Date(parts[0], parts[1] - 1 + months, parts[2])
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dt = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dt}`
}

interface MemberFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (input: MemberInput) => Promise<void>
  member?: Member | null
  existingMembers: Member[] // Pass full objects to check multiple keys for duplicates
}

export const MemberFormModal: React.FC<MemberFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  member,
  existingMembers,
}) => {
  const [firstName, setFirstName] = useState('')
  const [middleName, setMiddleName] = useState('')
  const [lastName, setLastName] = useState('')
  const [suffix, setSuffix] = useState('')
  const [nickname, setNickname] = useState('')
  const [rank, setRank] = useState('')
  const [selectedOrders, setSelectedOrders] = useState<string[]>([])
  const [customOrderInput, setCustomOrderInput] = useState('')
  const [status, setStatus] = useState<'active' | 'inactive' | 'suspended'>('active')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<{ [key: string]: string }>({})
  const [contactMode, setContactMode] = useState<'mobile' | 'landline'>('mobile')
  const [showHistoryOpen, setShowHistoryOpen] = useState(false)

  // Suspension Configuration State
  const [suspensionReason, setSuspensionReason] = useState('')
  const [selectedPresetReason, setSelectedPresetReason] = useState<string>('Attendance Infractions')
  const [suspensionStartDate, setSuspensionStartDate] = useState(getTodayString())
  const [suspensionDurationType, setSuspensionDurationType] = useState<SuspensionDurationType>('1_month')
  const [suspensionEndDate, setSuspensionEndDate] = useState(addMonthsToDate(getTodayString(), 1))

  useEffect(() => {
    if (member) {
      setFirstName(member.firstName)
      setMiddleName(member.middleName || '')
      setLastName(member.lastName)
      setSuffix(member.suffix || '')
      setNickname(member.nickname || '')
      setRank(member.rank)
      const parsedOrders = getMemberOrders(member.order)
      setSelectedOrders(parsedOrders)
      // Any custom order that is not in ORDER_GROUPS?
      const customOnes = parsedOrders.filter(o => !ORDER_GROUPS.includes(o as any))
      setCustomOrderInput(customOnes.join(', '))
      setStatus(member.status === 'archived' ? 'active' : member.status)
      const rawPhone = member.phoneNumber || ''
      setPhoneNumber(rawPhone)
      if (rawPhone.length >= 7 && rawPhone.length <= 10 && !rawPhone.startsWith('09')) {
        setContactMode('landline')
      } else {
        setContactMode('mobile')
      }
      setDateOfBirth(member.dateOfBirth || '')

      // Populate suspension state if already suspended
      const sReason = member.suspensionReason || ''
      setSuspensionReason(sReason)
      if (SUSPENSION_PRESET_REASONS.includes(sReason)) {
        setSelectedPresetReason(sReason)
      } else if (sReason) {
        setSelectedPresetReason('Other / Custom')
      } else {
        setSelectedPresetReason('Attendance Infractions')
      }

      const sStart = member.suspensionStartDate || getTodayString()
      setSuspensionStartDate(sStart)
      const sDur = member.suspensionDurationType || (member.suspensionEndDate ? 'custom' : '1_month')
      setSuspensionDurationType(sDur)
      setSuspensionEndDate(member.suspensionEndDate || (sDur === 'indefinite' ? '' : addMonthsToDate(sStart, 1)))
    } else {
      setFirstName('')
      setMiddleName('')
      setLastName('')
      setSuffix('')
      setNickname('')
      setRank('')
      setSelectedOrders([])
      setCustomOrderInput('')
      setStatus('active')
      setPhoneNumber('')
      setContactMode('mobile')
      setDateOfBirth('')
      setSuspensionReason('')
      setSelectedPresetReason('Attendance Infractions')
      const todayStr = getTodayString()
      setSuspensionStartDate(todayStr)
      setSuspensionDurationType('1_month')
      setSuspensionEndDate(addMonthsToDate(todayStr, 1))
    }
    setErrors({})
  }, [member, isOpen])

  // Recalculate end date whenever duration type or start date changes
  const handleDurationTypeChange = (type: SuspensionDurationType) => {
    setSuspensionDurationType(type)
    const baseStart = suspensionStartDate || getTodayString()
    if (type === '1_month') {
      setSuspensionEndDate(addMonthsToDate(baseStart, 1))
    } else if (type === '2_months') {
      setSuspensionEndDate(addMonthsToDate(baseStart, 2))
    } else if (type === '3_months') {
      setSuspensionEndDate(addMonthsToDate(baseStart, 3))
    } else if (type === 'indefinite') {
      setSuspensionEndDate('')
    }
  }

  const handleStartDateChange = (newStartDate: string) => {
    setSuspensionStartDate(newStartDate)
    if (suspensionDurationType === '1_month') {
      setSuspensionEndDate(addMonthsToDate(newStartDate, 1))
    } else if (suspensionDurationType === '2_months') {
      setSuspensionEndDate(addMonthsToDate(newStartDate, 2))
    } else if (suspensionDurationType === '3_months') {
      setSuspensionEndDate(addMonthsToDate(newStartDate, 3))
    }
  }

  if (!isOpen) return null

  const rawPhoneDigits = phoneNumber.replace(/\D/g, '')
  const isMobileValid = contactMode === 'mobile' && rawPhoneDigits.length === 11 && rawPhoneDigits.startsWith('09')
  const isLandlineValid = contactMode === 'landline' && rawPhoneDigits.length >= 7 && rawPhoneDigits.length <= 10
  const isPhoneValid = !rawPhoneDigits || (contactMode === 'mobile' ? isMobileValid : isLandlineValid)

  const validate = (): boolean => {
    const newErrors: { [key: string]: string } = {}
    
    if (!firstName.trim()) {
      newErrors.firstName = 'First Name is required.'
    }
    
    if (!dateOfBirth.trim()) {
      newErrors.dateOfBirth = 'Date of Birth is required for excuse verification.'
    }
    
    if (!lastName.trim()) {
      newErrors.lastName = 'Last Name is required.'
    }
    
    if (firstName.trim() && lastName.trim()) {
      const isDuplicate = existingMembers.some(
        (m) => 
          isDuplicateName(firstName, lastName, m.firstName, m.lastName) && 
          (!member || member.id !== m.id)
      )
      if (isDuplicate) {
        newErrors.firstName = 'A member with this combination of First Name and Last Name already exists.'
      }
    }
    
    if (phoneNumber.trim()) {
      if (contactMode === 'mobile') {
        if (!isMobileValid) {
          newErrors.phoneNumber = 'Mobile number must be exactly 11 digits starting with 09 (e.g. 09123456789).'
        }
      } else {
        if (!isLandlineValid) {
          newErrors.phoneNumber = 'Landline number must be 7 to 10 digits (e.g. 81234567).'
        }
      }
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setLoading(true)
    try {
      const standardSelected = selectedOrders.filter(o => ORDER_GROUPS.includes(o as any))
      const customOnes = customOrderInput
        .split(/[,/]+/)
        .map(s => s.trim())
        .filter(Boolean)
      const allOrdersCombined = Array.from(new Set([...standardSelected, ...customOnes]))
      const finalOrder = formatMemberOrders(allOrdersCombined) || undefined

      const finalSuspensionReason = status === 'suspended'
        ? (selectedPresetReason === 'Other / Custom' ? suspensionReason.trim() : (suspensionReason.trim() || selectedPresetReason))
        : undefined

      let finalHistory = member?.suspensionHistory || []
      if (member && member.status === 'suspended' && status !== 'suspended') {
        const d = new Date()
        const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        const completedRecord = {
          id: `susp-${Date.now()}-${member.id.slice(0, 5)}`,
          reason: member.suspensionReason || 'Manual Suspension',
          startDate: member.suspensionStartDate || '',
          endDate: member.suspensionEndDate || todayStr,
          durationType: member.suspensionDurationType || 'custom',
          completedAt: todayStr,
          liftedBy: 'Administrator',
          remarks: 'Restored to Active via profile edit.'
        }
        finalHistory = [...finalHistory, completedRecord]
      }

      await onSubmit({
        firstName: firstName.trim(),
        middleName: middleName.trim() || undefined,
        lastName: lastName.trim(),
        suffix: suffix.trim() || undefined,
        nickname: nickname.trim() || undefined,
        rank: rank.trim(),
        order: finalOrder,
        status,
        phoneNumber: phoneNumber.trim() || undefined,
        dateOfBirth: dateOfBirth.trim(),
        suspensionReason: status === 'suspended' ? finalSuspensionReason : undefined,
        suspensionStartDate: status === 'suspended' ? suspensionStartDate : undefined,
        suspensionEndDate: status === 'suspended' ? (suspensionDurationType === 'indefinite' ? undefined : suspensionEndDate) : undefined,
        suspensionDurationType: status === 'suspended' ? suspensionDurationType : undefined,
        suspensionHistory: finalHistory,
      })
      onClose()
    } catch (err) {
      console.error(err)
      setErrors({ submit: 'Failed to save member. Please try again.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Glassmorphic Backdrop */}
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-md transition-opacity animate-in fade-in duration-200" onClick={onClose}></div>

      {/* Modal Card */}
      <div className="relative w-full max-w-2xl rounded-3xl border border-slate-200/80 bg-white p-6 shadow-2xl z-10 text-slate-800 flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-extrabold text-sm shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                {member ? 'Edit Member Profile' : 'Add New Member'}
              </h3>
              <p className="text-xs font-semibold text-slate-400">Manage altar server information and rank</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer focus:outline-none">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 overflow-y-auto pr-1 flex-1" noValidate>
          {errors.submit && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-600">
              {errors.submit}
            </div>
          )}

          {/* First Name & Last Name */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="modal-firstname" className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">
                First Name *
              </label>
              <input
                id="modal-firstname"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 transition-shadow duration-150"
                placeholder="John"
                disabled={loading}
              />
              {errors.firstName && <p className="mt-1 text-xs text-red-600 font-medium">{errors.firstName}</p>}
            </div>

            <div>
              <label htmlFor="modal-lastname" className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Last Name *
              </label>
              <input
                id="modal-lastname"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 transition-shadow duration-150"
                placeholder="Doe"
                disabled={loading}
              />
              {errors.lastName && <p className="mt-1 text-xs text-red-600 font-medium">{errors.lastName}</p>}
            </div>
          </div>

          {/* Middle Name, Suffix & Nickname */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor="modal-middlename" className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Middle Name
              </label>
              <input
                id="modal-middlename"
                type="text"
                value={middleName}
                onChange={(e) => setMiddleName(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 transition-shadow duration-150"
                placeholder="Smith"
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="modal-suffix" className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Suffix
              </label>
              <input
                id="modal-suffix"
                type="text"
                value={suffix}
                onChange={(e) => setSuffix(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 transition-shadow duration-150"
                placeholder="Jr., III"
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="modal-nickname" className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Nickname
              </label>
              <input
                id="modal-nickname"
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 transition-shadow duration-150"
                placeholder="Johnny"
                disabled={loading}
              />
            </div>
          </div>

          {/* Rank */}
          <div>
            <CustomSelect
              label="Rank"
              required
              id="modal-rank"
              value={rank}
              onChange={(e) => setRank(e.target.value)}
              disabled={loading}
              options={[
                { value: '', label: 'Select Rank' },
                ...MEMBER_RANKS.map(r => ({ value: r, label: r }))
              ]}
            />
            {errors.rank && <p className="mt-1 text-xs text-red-600 font-medium">{errors.rank}</p>}
          </div>

          {/* Order / Group (Multi-select) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Order / Group <span className="text-gray-400 font-normal lowercase">(pwedeng pumili ng 2 o higit pa, e.g. San Pedro + Officers)</span>
              </label>
              {(selectedOrders.length > 0 || customOrderInput.trim()) && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedOrders([])
                    setCustomOrderInput('')
                  }}
                  className="text-[10px] font-semibold text-gray-400 hover:text-gray-600 transition cursor-pointer"
                >
                  Clear all
                </button>
              )}
            </div>

            {/* Toggleable Order Pills */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {ORDER_GROUPS.map((grp) => {
                const isSelected = selectedOrders.includes(grp)
                const theme = ORDER_COLORS[grp]
                return (
                  <button
                    key={grp}
                    type="button"
                    onClick={() => {
                      setSelectedOrders(prev =>
                        prev.includes(grp)
                          ? prev.filter(o => o !== grp)
                          : [...prev, grp]
                      )
                    }}
                    className={`flex items-center justify-between p-2 rounded-xl text-xs font-bold border transition-all cursor-pointer select-none ${
                      isSelected
                        ? `${theme?.bg || 'bg-blue-50'} ${theme?.border || 'border-blue-300'} ${theme?.text || 'text-blue-700'} shadow-2xs ring-1 ring-blue-300/60`
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <span className="truncate">{grp}</span>
                    {isSelected ? (
                      <svg className="w-3.5 h-3.5 shrink-0 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <span className="w-3.5 h-3.5 shrink-0 border border-gray-300 rounded-sm ml-1" />
                    )}
                  </button>
                )
              })}
            </div>

            {/* Optional Custom Group Input */}
            <div className="mt-2">
              <input
                type="text"
                value={customOrderInput}
                onChange={(e) => setCustomOrderInput(e.target.value)}
                placeholder="Other / Custom Group name (e.g. Master of Ceremony)"
                className="block w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-800 focus:border-blue-500 focus:outline-none transition-shadow"
                disabled={loading}
              />
            </div>
          </div>

          {/* Date of Birth */}
          <div>
            <label htmlFor="modal-dob" className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Date of Birth *
            </label>
            <input
              id="modal-dob"
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 transition-shadow duration-150"
              disabled={loading}
              required
            />
            {errors.dateOfBirth && <p className="mt-1 text-xs text-red-600 font-medium">{errors.dateOfBirth}</p>}
          </div>

          {/* Phone Number with Mobile / Landline Toggle and Live Validation */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="modal-phone" className="block text-[10px] font-bold uppercase tracking-wider text-slate-700">
                Contact Number
              </label>
              
              {/* Mode Switcher Tabs */}
              <div className="flex items-center bg-slate-200/60 p-0.5 rounded-lg border border-slate-300/50 text-[10px] font-bold">
                <button
                  type="button"
                  onClick={() => {
                    setContactMode('mobile')
                    setPhoneNumber(phoneNumber.replace(/\D/g, '').slice(0, 11))
                  }}
                  className={`px-2.5 py-1 rounded-md transition ${contactMode === 'mobile' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900 cursor-pointer'}`}
                >
                  Mobile (11 Digits)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setContactMode('landline')
                    setPhoneNumber(phoneNumber.replace(/\D/g, '').slice(0, 10))
                  }}
                  className={`px-2.5 py-1 rounded-md transition ${contactMode === 'landline' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900 cursor-pointer'}`}
                >
                  Landline (7-10)
                </button>
              </div>
            </div>

            {/* Input with dedicated right padding & status icon */}
            <div className="relative">
              <input
                id="modal-phone"
                type="tel"
                maxLength={contactMode === 'mobile' ? 11 : 10}
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, contactMode === 'mobile' ? 11 : 10))}
                className={`w-full h-10 pl-3.5 pr-10 rounded-xl border bg-white font-mono text-xs font-bold transition focus:outline-none focus:ring-2 ${
                  !rawPhoneDigits
                    ? 'border-slate-300 text-slate-900 focus:ring-blue-500/20 focus:border-blue-600'
                    : isPhoneValid
                    ? 'border-emerald-300 text-slate-900 focus:ring-emerald-500/20 focus:border-emerald-600'
                    : 'border-rose-300 text-rose-900 bg-rose-50/20 focus:ring-rose-500/20 focus:border-rose-600'
                }`}
                placeholder={contactMode === 'mobile' ? "e.g. 09171234567" : "e.g. 81234567"}
                disabled={loading}
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                {rawPhoneDigits ? (
                  isPhoneValid ? (
                    <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-rose-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                    </svg>
                  )
                ) : null}
              </div>
            </div>

            {/* Helper Text and Live Digit Count */}
            <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] font-medium pt-0.5">
              <span className={!rawPhoneDigits || isPhoneValid ? 'text-slate-500' : 'text-rose-600 font-semibold'}>
                {contactMode === 'mobile'
                  ? (isMobileValid ? 'Valid 11-digit mobile format.' : 'Mobile must be 11 digits starting with 09.')
                  : (isLandlineValid ? 'Valid landline length.' : 'Landline must be 7 to 10 digits.')}
              </span>
              <span className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${!rawPhoneDigits ? 'bg-slate-100 text-slate-500' : isPhoneValid ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                {rawPhoneDigits.length}/{contactMode === 'mobile' ? '11' : '7-10'}
              </span>
            </div>
            {errors.phoneNumber && <p className="text-xs text-rose-600 font-medium">{errors.phoneNumber}</p>}
          </div>

          {/* Status */}
          <div>
            <CustomSelect
              label="Status"
              required
              id="modal-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as 'active' | 'inactive' | 'suspended')}
              options={[
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
                { value: 'suspended', label: 'Suspended' }
              ]}
              disabled={loading}
            />
          </div>

          {/* Dedicated Suspension Configuration Panel */}
          {status === 'suspended' && (
            <div className="rounded-2xl border border-rose-200/90 bg-rose-50/40 p-4 space-y-4 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-2 border-b border-rose-100">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-rose-950 uppercase tracking-wide">Suspension Parameters</h4>
                    <p className="text-[11px] font-semibold text-rose-700/80">Configure reason, period, and clearance duration</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-200/70 text-rose-800 border border-rose-300/50">
                  Suspension Active
                </span>
              </div>

              {/* Suspension Reason Section */}
              <div className="space-y-2">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-rose-900">
                  Reason for Suspension *
                </label>

                {/* Preset Chips */}
                <div className="flex flex-wrap gap-1.5">
                  {SUSPENSION_PRESET_REASONS.map((preset) => {
                    const isSelected = selectedPresetReason === preset
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => {
                          setSelectedPresetReason(preset)
                          if (preset !== 'Other / Custom') {
                            setSuspensionReason(preset)
                          }
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer select-none ${
                          isSelected
                            ? 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-rose-50/60 hover:border-rose-300'
                        }`}
                      >
                        {preset}
                      </button>
                    )
                  })}
                </div>

                {/* Optional Custom Note / Reason Specification */}
                <div className="pt-1">
                  <input
                    type="text"
                    value={suspensionReason}
                    onChange={(e) => setSuspensionReason(e.target.value)}
                    placeholder={selectedPresetReason === 'Other / Custom' ? 'Specify custom suspension reason...' : 'Add remarks or specific details (optional)...'}
                    className="block w-full rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 focus:outline-none transition shadow-2xs font-medium"
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Duration & Period Picker */}
              <div className="space-y-3 pt-1 border-t border-rose-100">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-rose-900">
                    Suspension Duration & Calendar Period
                  </label>
                  <span className="text-[10px] font-bold text-rose-600 uppercase">
                    Mode: {suspensionDurationType.replace('_', ' ')}
                  </span>
                </div>

                {/* Duration Presets */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                  {[
                    { key: '1_month', label: '1 Month' },
                    { key: '2_months', label: '2 Months' },
                    { key: '3_months', label: '3 Months' },
                    { key: 'custom', label: 'Custom Date' },
                    { key: 'indefinite', label: 'Indefinite' },
                  ].map((dur) => {
                    const isSelected = suspensionDurationType === dur.key
                    return (
                      <button
                        key={dur.key}
                        type="button"
                        onClick={() => handleDurationTypeChange(dur.key as SuspensionDurationType)}
                        className={`py-1.5 px-2 rounded-xl text-xs font-bold text-center border transition-all cursor-pointer select-none ${
                          isSelected
                            ? 'bg-rose-700 text-white border-rose-700 shadow-2xs ring-1 ring-rose-400'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-rose-50/60'
                        }`}
                      >
                        {dur.label}
                      </button>
                    )
                  })}
                </div>

                {/* Start Date and End Date Pickers */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Start Date *
                    </label>
                    <input
                      type="date"
                      value={suspensionStartDate}
                      onChange={(e) => handleStartDateChange(e.target.value)}
                      className="block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/20 transition shadow-2xs font-semibold"
                      disabled={loading}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                      {suspensionDurationType === 'indefinite' ? 'End Date (Indefinite)' : 'End Date (Clearance Target)'}
                    </label>
                    {suspensionDurationType === 'indefinite' ? (
                      <div className="h-9 px-3 rounded-xl border border-dashed border-rose-300 bg-rose-50/30 flex items-center text-xs font-bold text-rose-700">
                        Until Manually Cleared
                      </div>
                    ) : (
                      <input
                        type="date"
                        value={suspensionEndDate}
                        onChange={(e) => setSuspensionEndDate(e.target.value)}
                        disabled={loading || suspensionDurationType !== 'custom'}
                        className={`block w-full rounded-xl border px-3 py-2 text-xs font-semibold transition shadow-2xs ${
                          suspensionDurationType === 'custom'
                            ? 'border-slate-300 bg-white text-slate-800 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20'
                            : 'border-slate-200 bg-slate-100 text-slate-600 cursor-not-allowed'
                        }`}
                      />
                    )}
                  </div>
                </div>

                {/* Live Summary Preview */}
                <div className="p-3 rounded-xl bg-white border border-rose-200 flex items-center gap-2.5 text-xs text-rose-900 font-semibold shadow-2xs">
                  <svg className="w-4 h-4 text-rose-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <div className="min-w-0">
                    <span>Active Period: </span>
                    <strong className="text-slate-900 font-black">{suspensionStartDate || 'Today'}</strong>
                    <span> to </span>
                    <strong className="text-slate-900 font-black">{suspensionDurationType === 'indefinite' ? 'Indefinite' : (suspensionEndDate || 'None')}</strong>
                    {suspensionReason && (
                      <span className="text-rose-700 block text-[11px] truncate mt-0.5">
                        Reason: {suspensionReason}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Past Suspension History Accordion (if member has completed past suspensions) */}
          {member && member.suspensionHistory && member.suspensionHistory.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2">
              <button
                type="button"
                onClick={() => setShowHistoryOpen(prev => !prev)}
                className="w-full flex items-center justify-between text-left cursor-pointer group"
              >
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-lg bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-black">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <span className="text-xs font-black text-slate-800">
                      Suspension History Log ({member.suspensionHistory.length})
                    </span>
                    <p className="text-[10px] text-slate-500 font-medium">Record of all previous served suspensions</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-slate-400 group-hover:text-slate-700 transition">
                  <span className="text-[10px] font-bold uppercase tracking-wider">{showHistoryOpen ? 'Hide' : 'View'}</span>
                  <svg className={`w-3.5 h-3.5 transition-transform ${showHistoryOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </div>
              </button>

              {showHistoryOpen && (
                <div className="space-y-2 pt-2 border-t border-slate-200/80 animate-in fade-in duration-100">
                  {member.suspensionHistory.map((rec, idx) => (
                    <div key={rec.id || idx} className="p-2.5 rounded-xl bg-white border border-slate-200 text-xs space-y-1">
                      <div className="flex items-center justify-between flex-wrap gap-1">
                        <span className="font-extrabold text-slate-900">{rec.reason}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Cleared / Completed
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center justify-between flex-wrap gap-1">
                        <span>Period: {rec.startDate} → {rec.endDate || 'Indefinite'}</span>
                        <span className="text-[10px] text-slate-400">Lifted by: {rec.liftedBy || 'System'}</span>
                      </div>
                      {rec.remarks && (
                        <p className="text-[10px] text-slate-400 italic pt-0.5 border-t border-slate-100">
                          {rec.remarks}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-100 sticky bottom-0 bg-white">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-700 transition-all disabled:opacity-50 cursor-pointer shadow-2xs"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-xl bg-indigo-600 hover:bg-indigo-700 px-4 py-2.5 text-xs font-extrabold text-white transition-all disabled:opacity-50 cursor-pointer shadow-md shadow-indigo-500/20 active:scale-95"
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
