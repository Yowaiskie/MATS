import React, { useState, useEffect } from 'react'
import type { Member, MemberInput } from '@/types/member'
import { ORDER_GROUPS, MEMBER_RANKS } from '@/types/member'
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
  const [order, setOrder] = useState('')
  const [status, setStatus] = useState<'active' | 'inactive'>('active')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<{ [key: string]: string }>({})

  useEffect(() => {
    if (member) {
      setFirstName(member.firstName)
      setMiddleName(member.middleName || '')
      setLastName(member.lastName)
      setSuffix(member.suffix || '')
      setNickname(member.nickname || '')
      setRank(member.rank)
      setOrder(member.order || '')
      setStatus(member.status === 'archived' ? 'active' : member.status)
      setPhoneNumber(member.phoneNumber || '')
      setDateOfBirth(member.dateOfBirth || '')
    } else {
      setFirstName('')
      setMiddleName('')
      setLastName('')
      setSuffix('')
      setNickname('')
      setRank('')
      setOrder('')
      setStatus('active')
      setPhoneNumber('')
      setDateOfBirth('')
    }
    setErrors({})
  }, [member, isOpen])

  if (!isOpen) return null

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
      const phoneRegex = /^[0-9]{11}$/
      if (!phoneRegex.test(phoneNumber.trim())) {
        newErrors.phoneNumber = 'Phone number must be exactly 11 digits (e.g. 09123456789).'
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
      await onSubmit({
        firstName: firstName.trim(),
        middleName: middleName.trim() || undefined,
        lastName: lastName.trim(),
        suffix: suffix.trim() || undefined,
        nickname: nickname.trim() || undefined,
        rank: rank.trim(),
        order: order.trim() || undefined,
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
      <div className="relative w-full max-w-lg rounded-3xl border border-slate-200/80 bg-white p-6 shadow-2xl z-10 text-slate-800 flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
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

          {/* Order / Group (Optional) */}
          <div>
            <label htmlFor="modal-order" className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Order / Group <span className="text-gray-400 font-normal lowercase">(optional)</span>
            </label>
            <select
              id="modal-order"
              value={ORDER_GROUPS.includes(order as any) ? order : (order ? 'custom' : '')}
              onChange={(e) => {
                if (e.target.value !== 'custom') {
                  setOrder(e.target.value)
                } else if (!ORDER_GROUPS.includes(order as any)) {
                  // Keep current custom value
                } else {
                  setOrder('')
                }
              }}
              className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 transition-shadow duration-150"
              disabled={loading}
            >
              <option value="">-- No Order / Unassigned --</option>
              {ORDER_GROUPS.map((grp) => (
                <option key={grp} value={grp}>{grp}</option>
              ))}
              <option value="custom">Other / Custom Order Name...</option>
            </select>

            {(!ORDER_GROUPS.includes(order as any) && order !== '') && (
              <input
                type="text"
                value={order}
                onChange={(e) => setOrder(e.target.value)}
                placeholder="Enter custom order or group name"
                className="mt-2 block w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-800 focus:border-blue-500 focus:outline-none transition-shadow"
                disabled={loading}
              />
            )}
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

          {/* Phone Number */}
          <div>
            <label htmlFor="modal-phone" className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Phone Number
            </label>
            <input
              id="modal-phone"
              type="tel"
              maxLength={11}
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 11))}
              className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 transition-shadow duration-150"
              placeholder="e.g. 09123456789"
              disabled={loading}
            />
            {errors.phoneNumber && <p className="mt-1 text-xs text-red-600 font-medium">{errors.phoneNumber}</p>}
          </div>

          {/* Status */}
          <div>
            <label htmlFor="modal-status" className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Status *
            </label>
            <select
              id="modal-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')}
              className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 transition-shadow duration-150"
              disabled={loading}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
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
