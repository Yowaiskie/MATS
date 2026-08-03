import React, { useState, useEffect } from 'react'
import { memberService } from '@/services/memberService'
import { scheduleService } from '@/services/scheduleService'
import { excuseService } from '@/services/excuseService'
import type { Member } from '@/types/member'
import type { Schedule } from '@/types/schedule'
import { AlertModal } from '@/components/Dialog'

export const PublicExcusePage: React.FC = () => {
  const [mode, setMode] = useState<'submit' | 'track'>('submit')
  const [step, setStep] = useState<1 | 2 | 3>(1)
  
  // Verification State
  const [members, setMembers] = useState<Member[]>([])
  const [selectedMemberId, setSelectedMemberId] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [verificationError, setVerificationError] = useState('')
  
  // Excuse Request State
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [selectedScheduleIds, setSelectedScheduleIds] = useState<Set<string>>(new Set())
  const [reason, setReason] = useState('')
  const [trackingNumber, setTrackingNumber] = useState('')
  const [loading, setLoading] = useState(false)

  // Tracking State
  const [trackInput, setTrackInput] = useState('')
  const [trackedExcuse, setTrackedExcuse] = useState<any | null>(null)
  const [trackError, setTrackError] = useState('')

  // Dialog State
  const [alertModal, setAlertModal] = useState<{ title: string; message: string; variant: 'error' | 'success' | 'info' } | null>(null)

  useEffect(() => {
    memberService.getMembers().then(mems => setMembers(mems.filter(m => m.status === 'active')))
  }, [])

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setVerificationError('')
    
    const member = members.find(m => m.id === selectedMemberId)
    if (!member) {
      setVerificationError('Please select a member.')
      return
    }
    
    // Check Date of Birth matching
    if (!member.dateOfBirth) {
      setVerificationError('No Date of Birth is registered on your profile. Please contact an Administrator to update your profile before you can submit an excuse.')
      return
    }

    if (member.dateOfBirth !== dateOfBirth) {
      setVerificationError('Date of Birth does not match our records.')
      return
    }

    // Load member's schedules
    setLoading(true)
    try {
      const allSchedules = await scheduleService.getSchedules()
      const upcoming = allSchedules.filter(s => 
        s.assignedMembers?.includes(selectedMemberId) && 
        new Date(s.date) >= new Date()
      )
      setSchedules(upcoming)
      setStep(2)
    } catch (err) {
      setVerificationError('Failed to load schedules.')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedScheduleIds.size === 0) {
      setAlertModal({ variant: 'error', title: 'Missing Information', message: 'Please select at least one schedule.' })
      return
    }
    if (!reason.trim()) {
      setAlertModal({ variant: 'error', title: 'Missing Information', message: 'Please provide a reason.' })
      return
    }

    setLoading(true)
    try {
      const trackNo = await excuseService.submitExcuseRequest({
        memberId: selectedMemberId,
        schedules: Array.from(selectedScheduleIds),
        reason
      })
      setTrackingNumber(trackNo)
      setStep(3)
    } catch (err) {
      setAlertModal({ variant: 'error', title: 'Submission Failed', message: 'Failed to submit excuse request. Please try again.' })
    } finally {
      setLoading(false)
    }
  }

  const toggleSchedule = (id: string) => {
    const next = new Set(selectedScheduleIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedScheduleIds(next)
  }

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault()
    setTrackError('')
    setTrackedExcuse(null)
    if (!trackInput.trim()) return

    setLoading(true)
    try {
      const excuse = await excuseService.getExcuseRequestByTrackingNumber(trackInput.trim())
      if (!excuse) {
        setTrackError('Tracking number not found.')
      } else {
        setTrackedExcuse(excuse)
      }
    } catch (err) {
      setTrackError('Failed to retrieve request.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-4 font-sans">
      <div className="bg-white max-w-md w-full rounded-3xl shadow-xl p-8 border border-slate-200">
        <div className="flex justify-center mb-6">
          <img src="/favicon/favicon.png" alt="Logo" className="w-16 h-16 rounded-full border shadow-sm object-cover" />
        </div>
        <h1 className="text-2xl font-black text-center text-slate-900 mb-6">Excuse Requests</h1>

        <div className="flex border-b mb-6">
          <button 
            className={`flex-1 pb-3 text-sm font-bold transition-all ${mode === 'submit' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
            onClick={() => { setMode('submit'); setStep(1); }}
          >
            File Excuse
          </button>
          <button 
            className={`flex-1 pb-3 text-sm font-bold transition-all ${mode === 'track' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
            onClick={() => { setMode('track'); setTrackedExcuse(null); setTrackError(''); }}
          >
            Track Status
          </button>
        </div>

        {mode === 'submit' && step === 1 && (
          <form onSubmit={handleVerify} className="space-y-4">
            <div>
              <label className="block text-xs font-extrabold text-slate-500 uppercase mb-2">Member Name</label>
              <select 
                value={selectedMemberId} 
                onChange={e => setSelectedMemberId(e.target.value)}
                className="w-full p-3 border rounded-xl text-sm bg-slate-50"
                required
              >
                <option value="">Select your name...</option>
                {members.sort((a,b) => a.lastName.localeCompare(b.lastName)).map(m => (
                  <option key={m.id} value={m.id}>{m.lastName}, {m.firstName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-extrabold text-slate-500 uppercase mb-2">Date of Birth</label>
              <input 
                type="date" 
                value={dateOfBirth} 
                onChange={e => setDateOfBirth(e.target.value)}
                className="w-full p-3 border rounded-xl text-sm bg-slate-50"
                required
              />
            </div>
            {verificationError && <p className="text-red-500 text-xs font-bold">{verificationError}</p>}
            <button type="submit" disabled={loading} className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl mt-4 hover:bg-indigo-700 transition">
              {loading ? 'Verifying...' : 'Verify'}
            </button>
          </form>
        )}

        {mode === 'submit' && step === 2 && (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-xs font-extrabold text-slate-500 uppercase mb-2">Select Schedules</label>
              {schedules.length === 0 ? (
                <p className="text-sm text-slate-500 bg-slate-50 p-4 rounded-xl">No upcoming assigned schedules found.</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                  {schedules.map(s => (
                    <label key={s.id} className="flex items-center gap-3 p-3 border rounded-xl hover:bg-slate-50 cursor-pointer transition">
                      <input 
                        type="checkbox" 
                        checked={selectedScheduleIds.has(s.id)}
                        onChange={() => toggleSchedule(s.id)}
                        className="w-4 h-4 text-indigo-600"
                      />
                      <span className="text-sm font-semibold">{s.title || 'Schedule'} - {s.date} {s.startTime}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-extrabold text-slate-500 uppercase mb-2">Reason</label>
              <textarea 
                value={reason} 
                onChange={e => setReason(e.target.value)}
                className="w-full p-3 border rounded-xl text-sm bg-slate-50 h-24"
                placeholder="Please state your reason for filing an excuse..."
                required
              />
            </div>
            <button type="submit" disabled={loading || selectedScheduleIds.size === 0} className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 transition disabled:opacity-50">
              {loading ? 'Submitting...' : 'Submit Excuse Request'}
            </button>
          </form>
        )}

        {mode === 'submit' && step === 3 && (
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl font-black">✓</div>
            <h2 className="text-xl font-black text-slate-900 mb-2">Submitted Successfully</h2>
            <p className="text-slate-500 text-sm mb-6">Your request is now pending review.</p>
            <div className="bg-slate-50 border p-4 rounded-xl mb-6">
              <span className="block text-xs font-bold text-slate-400 uppercase">Tracking Number</span>
              <span className="block text-2xl font-black tracking-widest text-indigo-600">{trackingNumber}</span>
            </div>
            <button onClick={() => setStep(1)} className="text-sm font-bold text-indigo-600 hover:underline cursor-pointer">
              Submit Another Request
            </button>
          </div>
        )}

        {mode === 'track' && (
          <div className="space-y-6">
            <form onSubmit={handleTrack} className="space-y-4">
              <div>
                <label className="block text-xs font-extrabold text-slate-500 uppercase mb-2">Tracking Number</label>
                <input 
                  type="text" 
                  value={trackInput} 
                  onChange={e => setTrackInput(e.target.value)}
                  className="w-full p-3 border rounded-xl text-sm bg-slate-50 uppercase"
                  placeholder="EX-YYYYMM-00000"
                  required
                />
              </div>
              {trackError && <p className="text-red-500 text-xs font-bold">{trackError}</p>}
              <button type="submit" disabled={loading} className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 transition disabled:opacity-50 cursor-pointer">
                {loading ? 'Searching...' : 'Track Request'}
              </button>
            </form>

            {trackedExcuse && (
              <div className="p-5 border rounded-2xl bg-slate-50 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase">Status</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                    trackedExcuse.status === 'approved' ? 'bg-green-100 text-green-700' :
                    trackedExcuse.status === 'rejected' ? 'bg-red-100 text-red-700' :
                    'bg-amber-100 text-amber-700'
                  }`}>
                    {trackedExcuse.status}
                  </span>
                </div>
                
                {trackedExcuse.status === 'rejected' && trackedExcuse.rejectionReason && (
                  <div>
                    <span className="block text-xs font-bold text-slate-500 uppercase mb-1">Reason for Rejection</span>
                    <p className="text-sm text-slate-700 bg-white p-3 border rounded-xl">{trackedExcuse.rejectionReason}</p>
                  </div>
                )}
                
                {trackedExcuse.status === 'approved' && trackedExcuse.adminRemarks && (
                  <div>
                    <span className="block text-xs font-bold text-slate-500 uppercase mb-1">Admin Remarks</span>
                    <p className="text-sm text-slate-700 bg-white p-3 border rounded-xl">{trackedExcuse.adminRemarks}</p>
                  </div>
                )}

                <div>
                  <span className="block text-xs font-bold text-slate-500 uppercase mb-1">Your Reason</span>
                  <p className="text-sm text-slate-700 bg-white p-3 border rounded-xl">{trackedExcuse.reason}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <AlertModal
        isOpen={!!alertModal}
        onClose={() => setAlertModal(null)}
        variant={alertModal?.variant || 'error'}
        title={alertModal?.title || 'Alert'}
        message={alertModal?.message || ''}
      />
    </div>
  )
}
