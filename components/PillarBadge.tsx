import React from 'react'

interface PillarBadgeProps {
  name: string
  textClass: string   // e.g. 'text-emerald-400'
  borderClass: string // e.g. 'border-emerald-400/30'
  className?: string
}

export function PillarBadge({ name, textClass, borderClass, className = '' }: PillarBadgeProps) {
  return (
    <span
      className={`text-xs font-bold uppercase tracking-widest rounded-full px-3 py-1 border ${textClass} ${borderClass} ${className}`}
    >
      {name}
    </span>
  )
}
