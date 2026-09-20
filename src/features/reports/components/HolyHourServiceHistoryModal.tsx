import React from 'react'
import { Modal } from '@/components/Modal'
import { Button } from '@/components'
import type { HolyHourServerStat } from '@/services/reportService'
import { getOrderBadgeStyle } from '@/types/member'

interface Props {
  isOpen: boolean
  onClose: () => void
  serverStat: HolyHourServerStat | null
  categoryLabel?: string
}

export const HolyHourServiceHistoryModal: React.FC<Props> = ({
  isOpen,
  onClose,
  serverStat,
  categoryLabel = 'Service'
}) => {
  if (!serverStat) return null

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${serverStat.name} — ${categoryLabel} Records`}
      subtitle="Complete chronological history of schedule service attendances"
      badge="Service History"
      icon={
        <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      }
      maxWidth="2xl"
    >
      <div className="space-y-4">
        {/* Server Header & Quick Metrics */}
        <div className="p-4 bg-gradient-to-br from-indigo-500/10 via-indigo-500/5 to-transparent rounded-2xl border border-indigo-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-black text-slate-900">{serverStat.name}</h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white border border-slate-200 text-slate-700">
                {serverStat.rank}
              </span>
              {serverStat.order && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getOrderBadgeStyle(serverStat.order)}`}>
                  {serverStat.order}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Altar Server Attendance Profile — {categoryLabel}
            </p>
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-auto justify-between sm:justify-end">
            <div className="text-center px-3 py-1.5 bg-white rounded-xl border border-indigo-200 shadow-2xs">
              <span className="block text-[10px] font-extrabold uppercase text-slate-400">Total Served</span>
              <span className="text-sm font-black text-indigo-600">{serverStat.totalServed}</span>
            </div>
            <div className="text-center px-3 py-1.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
              <span className="block text-[10px] font-extrabold uppercase text-slate-400">Rate</span>
              <span className="text-sm font-black text-slate-800">{serverStat.rate}%</span>
            </div>
          </div>
        </div>

        {/* Breakdown chips */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-xl text-center">
            <span className="block text-[10px] font-black uppercase tracking-wider text-emerald-800">Present</span>
            <span className="text-sm font-black text-emerald-700">{serverStat.present}</span>
          </div>
          <div className="p-2.5 bg-amber-50/70 border border-amber-200 rounded-xl text-center">
            <span className="block text-[10px] font-black uppercase tracking-wider text-amber-800">Late</span>
            <span className="text-sm font-black text-amber-700">{serverStat.late}</span>
          </div>
          <div className="p-2.5 bg-rose-50/70 border border-rose-200 rounded-xl text-center">
            <span className="block text-[10px] font-black uppercase tracking-wider text-rose-800">Absent</span>
            <span className="text-sm font-black text-rose-700">{serverStat.absent}</span>
          </div>
          <div className="p-2.5 bg-slate-100 border border-slate-200 rounded-xl text-center">
            <span className="block text-[10px] font-black uppercase tracking-wider text-slate-600">Excused</span>
            <span className="text-sm font-black text-slate-700">{serverStat.excused}</span>
          </div>
        </div>

        {/* History Table */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700 px-1">
            <span>Service History ({serverStat.serviceHistory.length} Schedules)</span>
            <span className="text-[10px] text-slate-400 font-normal">Sorted latest first</span>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
            {serverStat.serviceHistory.length > 0 ? (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px] sticky top-0 bg-slate-50 z-10">
                  <tr>
                    <th className="px-3.5 py-2.5">Date</th>
                    <th className="px-3.5 py-2.5">Schedule Title</th>
                    <th className="px-3 py-2.5 text-center">Time</th>
                    <th className="px-3 py-2.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {serverStat.serviceHistory.map((item, idx) => (
                    <tr key={`${item.scheduleId}-${idx}`} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-3.5 py-2.5 font-bold text-slate-800 whitespace-nowrap">
                        {item.date}
                      </td>
                      <td className="px-3.5 py-2.5 text-slate-700">
                        <div className="font-semibold text-slate-900">{item.title}</div>
                        {item.remarks && (
                          <span className="text-[10px] text-slate-400 italic block">{item.remarks}</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center text-slate-500 whitespace-nowrap font-mono text-[11px]">
                        {item.startTime} - {item.endTime}
                      </td>
                      <td className="px-3 py-2.5 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                            item.status === 'present'
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                              : item.status === 'late'
                              ? 'bg-amber-50 border-amber-200 text-amber-700'
                              : item.status === 'absent'
                              ? 'bg-rose-50 border-rose-200 text-rose-700'
                              : 'bg-slate-100 border-slate-300 text-slate-600'
                          }`}
                        >
                          {item.status}
                          {item.isOtherServer && (
                            <span className="text-[8px] bg-amber-200 text-amber-900 px-1 rounded font-bold">Other</span>
                          )}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="py-8 text-center text-xs text-slate-400 font-medium">
                No Holy Hour attendance logs recorded for this server yet.
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end pt-2 border-t border-slate-100">
          <Button
            type="button"
            variant="secondary"
            size="dense"
            onClick={onClose}
          >
            Close
          </Button>
        </div>
      </div>
    </Modal>
  )
}
