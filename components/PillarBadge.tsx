import React from 'react'

interface PillarBadgeProps {
  name: string
  accent: string
  className?: string
}

export function PillarBadge({ name, accent, className = '' }: PillarBadgeProps) {
  return (
    <span
      className={`text-xs font-bold uppercase tracking-widest rounded-full px-3 py-1 border ${className}`}
      style={{ color: accent, borderColor: `${accent}4d` }}
    >
      {name}
    </span>
  )
}
