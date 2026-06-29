import React from 'react'

interface CardProps {
  title?: string
  description?: string
  children: React.ReactNode
  className?: string
}

export const Card: React.FC<CardProps> = ({ title, description, children, className = '' }) => {
  return (
    <div className={`rounded-lg border border-gray-800 bg-gray-950 p-6 shadow-md ${className}`}>
      {title && (
        <div className="mb-4">
          <h3 className="text-base font-bold text-white tracking-tight">{title}</h3>
          {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
        </div>
      )}
      {children}
    </div>
  )
}
