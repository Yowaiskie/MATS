import React, { useState, useEffect } from 'react'
import type { Member, MemberInput } from '@/types/member'
import { ORDER_GROUPS, MEMBER_RANKS, ORDER_COLORS, getMemberOrders, formatMemberOrders } from '@/types/member'
import { isDuplicateName } from '@/utils/member'

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
    }
    setErrors({})
  }, [member, isOpen])

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
            <label htmlFor="modal-rank" className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Rank / Designation *
            </label>
            <select
              id="modal-rank"
              value={MEMBER_RANKS.includes(rank as any) ? rank : (rank ? 'custom' : '')}
              onChange={(e) => {
                if (e.target.value !== 'custom') {
                  setRank(e.target.value)
                } else if (!MEMBER_RANKS.includes(rank as any)) {
                  // Keep current custom value
                } else {
                  setRank('')
                }
              }}
              className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 transition-shadow duration-150 cursor-pointer"
              disabled={loading}
            >
              <option value="">-- Select Rank --</option>
              {MEMBER_RANKS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
              <option value="custom">Other / Custom Rank...</option>
            </select>

            {(!MEMBER_RANKS.includes(rank as any) && rank !== '') && (
              <input
                type="text"
                value={rank}
                onChange={(e) => setRank(e.target.value)}
                placeholder="Enter custom rank name"
                className="mt-2 block w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-800 focus:border-blue-500 focus:outline-none transition-shadow"
                disabled={loading}
              />
            )}
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
            <label htmlFor="modal-status" className="block text-[10px] font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Status *
            </label>
            <div className="relative">
              <select
                id="modal-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as 'active' | 'inactive' | 'suspended')}
                className="block w-full h-10 pl-3 pr-10 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-800 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition cursor-pointer shadow-2xs"
                disabled={loading}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="suspended">Suspended</option>
              </select>
              <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </div>
            </div>
          </div>

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
