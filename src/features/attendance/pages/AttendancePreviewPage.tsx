import React, { useState } from 'react'
import { PreviewNavigation } from '@/features/preview/PreviewNavigation'
import { CustomSelect } from '@/components'

export const AttendancePreviewPage: React.FC = () => {
  const [selectedSession, setSelectedSession] = useState('Today Mass - 06:00 AM')

  const dummyAttendance = [
    { id: '1', name: 'Dela Cruz, Juan', rank: 'Junior Server', status: 'present' },
    { id: '2', name: 'Santos, Maria', rank: 'Senior Server', status: 'late' },
    { id: '3', name: 'Reyes, Carlo', rank: 'Master of Ceremonies', status: 'absent' },
    { id: '4', name: 'Garcia, Ana', rank: 'Junior Server', status: 'excused' },
  ]

  return (
    <div className="space-y-6 pb-12">
      <PreviewNavigation />

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">Attendance Tracker</h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Log and mark server presence, tardiness, or excused absences per service.
          </p>
        </div>

        <button className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-extrabold text-xs text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-500/20 active:scale-95 transition-all cursor-pointer">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          <span>Start New Attendance Session</span>
        </button>
      </div>

      {/* Session Select Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider whitespace-nowrap">Active Session:</span>
          <div className="w-full sm:w-72">
            <CustomSelect 
              value={selectedSession}
              onChange={(e) => setSelectedSession(e.target.value)}
              options={[
                { value: 'Today Mass - 06:00 AM', label: 'Today Mass - 06:00 AM' },
                { value: 'Sunday High Mass - 09:00 AM', label: 'Sunday High Mass - 09:00 AM' },
                { value: 'Evening Novena - 06:00 PM', label: 'Evening Novena - 06:00 PM' }
              ]}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
            Session Active
          </span>
        </div>
      </div>

      {/* Attendance Grid Card Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-black uppercase text-slate-400 tracking-wider">
              <tr>
                <th className="px-6 py-4">Server Name</th>
                <th className="px-6 py-4">Rank</th>
                <th className="px-6 py-4">Attendance Status</th>
                <th className="px-6 py-4 text-right">Quick Mark Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
              {dummyAttendance.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-6 py-4 font-extrabold text-slate-900">{item.name}</td>
                  <td className="px-6 py-4 text-slate-500 font-bold">{item.rank}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${
                      item.status === 'present' ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
                      : item.status === 'late' ? 'bg-amber-50 text-amber-700 border-amber-200/80'
                      : item.status === 'excused' ? 'bg-indigo-50 text-indigo-700 border-indigo-200/80'
                      : 'bg-rose-50 text-rose-700 border-rose-200/80'
                    }`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right space-x-1.5">
                    <button className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold transition-all shadow-2xs cursor-pointer">
                      Present
                    </button>
                    <button className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-extrabold transition-all shadow-2xs cursor-pointer">
                      Late
                    </button>
                    <button className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold transition-all shadow-2xs cursor-pointer">
                      Absent
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
