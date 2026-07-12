import Link from 'next/link'
import { PillarBadge } from './PillarBadge'

interface PillarCardProps {
  name: string
  slug: string
  accent: string
  yieldRange: string
  oneLiner: string
  bestFor: string
  href: string
}

export function PillarCard({ name, accent, yieldRange, oneLiner, bestFor, href }: PillarCardProps) {
  return (
    <Link href={href} className="block group">
      <div
        className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-6 hover:border-blue-400/20 transition-colors h-full"
        style={{ borderTopColor: accent, borderTopWidth: '2px' }}
      >
        <div className="mb-4">
          <PillarBadge name={name} accent={accent} />
        </div>
        <div className="text-2xl font-extrabold text-white mb-2">{yieldRange}</div>
        <p className="text-white/60 text-sm mb-3">{oneLiner}</p>
        <p className="text-xs text-white/40">
          <span className="text-white/50 font-semibold">Best for:</span> {bestFor}
        </p>
      </div>
    </Link>
  )
}
