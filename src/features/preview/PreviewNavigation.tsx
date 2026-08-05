import React from 'react'
import { Link, useLocation } from 'react-router-dom'

export const PreviewNavigation: React.FC = () => {
  const location = useLocation()

  const links = [
    { name: 'Dashboard', path: '/dashboard-preview' },
    { name: 'Schedules', path: '/schedule-preview' },
    { name: 'Members', path: '/members-preview' },
    { name: 'Attendance', path: '/attendance-preview' },
    { name: 'Reports', path: '/reports-preview' },
    { name: 'Excuses', path: '/excuse-preview' },
    { name: 'Finance', path: '/finance-preview' },
    { name: 'Events', path: '/events-preview' },
    { name: 'UI Components', path: '/components-preview' },
  ]

  return (
    <div className="bg-slate-900 text-white rounded-2xl p-3 shadow-lg mb-6 select-none">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 px-2">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-black uppercase tracking-wider text-slate-200">
            MATS Module Redesign Preview Hub
          </span>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto w-full md:w-auto py-1">
          {links.map((link) => {
            const isActive = location.pathname === link.path
            return (
              <Link
                key={link.path}
                to={link.path}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                {link.name}
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
