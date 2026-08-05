import React from 'react'

interface CardProps {
  title?: string
  description?: string
  children: React.ReactNode
  className?: string
}

export const Card: React.FC<CardProps> = ({ title, description, children, className = '' }) => {
  return (
    <div className={`rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xs hover:shadow-xs transition-all duration-200 ${className}`}>
      {title && (
        <div className="mb-4">
          <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">{title}</h3>
          {description && <p className="text-xs text-slate-500 mt-0.5 font-medium">{description}</p>}
        </div>
      )}
      {children}
    </div>
  )
}
