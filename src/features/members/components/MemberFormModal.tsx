import React, { useState, useEffect } from 'react'
import type { Member, MemberInput } from '@/types/member'
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
  const [status, setStatus] = useState<'active' | 'inactive'>('active')
  const [phoneNumber, setPhoneNumber] = useState('')
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
      setStatus(member.status === 'archived' ? 'active' : member.status)
      setPhoneNumber(member.phoneNumber || '')
    } else {
      setFirstName('')
      setMiddleName('')
      setLastName('')
      setSuffix('')
      setNickname('')
      setRank('')
      setStatus('active')
      setPhoneNumber('')
    }
    setErrors({})
  }, [member, isOpen])

  if (!isOpen) return null

  const validate = (): boolean => {
    const newErrors: { [key: string]: string } = {}
    
    if (!firstName.trim()) {
      newErrors.firstName = 'First Name is required.'
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
    
    if (!rank.trim()) {
      newErrors.rank = 'Rank is required.'
    }
    
    if (phoneNumber.trim()) {
      const phoneRegex = /^\+?[0-9]{7,15}$/
      if (!phoneRegex.test(phoneNumber.trim())) {
        newErrors.phoneNumber = 'Invalid phone number. Use 7-15 digits.'
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
        status,
        phoneNumber: phoneNumber.trim() || undefined,
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
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity" onClick={onClose}></div>

      {/* Modal Card */}
      <div className="relative w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl z-10 text-gray-800 flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <h3 className="text-sm font-bold text-gray-900">
            {member ? 'Edit Member' : 'Add New Member'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors cursor-pointer focus:outline-none">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
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
                className="mt-1 block w-full rounded-lg border border-gray-250 bg-white px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 transition-shadow duration-150"
                placeholder="John"
                disabled={loading}
              />
              {errors.firstName && <p className="mt-1 text-xs text-red-650 font-medium">{errors.firstName}</p>}
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
                className="mt-1 block w-full rounded-lg border border-gray-255 bg-white px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 transition-shadow duration-150"
                placeholder="Doe"
                disabled={loading}
              />
              {errors.lastName && <p className="mt-1 text-xs text-red-650 font-medium">{errors.lastName}</p>}
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
                className="mt-1 block w-full rounded-lg border border-gray-250 bg-white px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 transition-shadow duration-150"
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
                className="mt-1 block w-full rounded-lg border border-gray-250 bg-white px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 transition-shadow duration-150"
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
                className="mt-1 block w-full rounded-lg border border-gray-250 bg-white px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 transition-shadow duration-150"
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
            <input
              id="modal-rank"
              type="text"
              value={rank}
              onChange={(e) => setRank(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-250 bg-white px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 transition-shadow duration-150"
              placeholder="e.g. Coordinator, Brother, Sister"
              disabled={loading}
            />
            {errors.rank && <p className="mt-1 text-xs text-red-650 font-medium">{errors.rank}</p>}
          </div>

          {/* Phone Number */}
          <div>
            <label htmlFor="modal-phone" className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Phone Number
            </label>
            <input
              id="modal-phone"
              type="text"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-250 bg-white px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 transition-shadow duration-150"
              placeholder="e.g. +639123456789"
              disabled={loading}
            />
            {errors.phoneNumber && <p className="mt-1 text-xs text-red-655 font-medium">{errors.phoneNumber}</p>}
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
              className="mt-1 block w-full rounded-lg border border-gray-250 bg-white px-3 py-2 text-sm text-gray-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 transition-shadow duration-150"
              disabled={loading}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-100 sticky bottom-0 bg-white">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-200 bg-white hover:bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-700 hover:text-gray-900 transition-colors disabled:opacity-50 cursor-pointer shadow-sm animate-none"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-500 transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
