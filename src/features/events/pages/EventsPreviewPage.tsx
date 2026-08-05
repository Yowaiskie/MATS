import React from 'react'
import { PreviewNavigation } from '@/features/preview/PreviewNavigation'

export const EventsPreviewPage: React.FC = () => {
  const dummyEvents = [
    { id: '1', title: 'Grand Feast Mass 2026', date: '2026-09-15', stage: 'Preparation', head: 'Juan Dela Cruz' },
    { id: '2', title: 'Ministry Recollection & Retreat', date: '2026-10-02', stage: 'Planning', head: 'Maria Santos' },
    { id: '3', title: 'Altar Server Formation Workshop', date: '2026-08-20', stage: 'Ready', head: 'Carlo Reyes' },
  ]

  return (
    <div className="space-y-6 pb-12">
      <PreviewNavigation />

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">Ministry Events</h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Manage event workspaces, task kanban boards, team assignments, and timelines.
          </p>
        </div>

        <button className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-extrabold text-xs text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-500/20 active:scale-95 transition-all cursor-pointer">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          <span>Create New Event</span>
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-black uppercase text-slate-400 tracking-wider">
              <tr>
                <th className="px-6 py-4">Event Title</th>
                <th className="px-6 py-4">Start Date</th>
                <th className="px-6 py-4">Stage</th>
                <th className="px-6 py-4">Event Head</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
              {dummyEvents.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-6 py-4 font-extrabold text-indigo-600">{item.title}</td>
                  <td className="px-6 py-4 font-semibold text-slate-600">📅 {item.date}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200/80">
                      {item.stage}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-700">{item.head}</td>
                  <td className="px-6 py-4 text-right">
                    <button className="px-3.5 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-extrabold transition-all cursor-pointer">
                      Open Workspace
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
