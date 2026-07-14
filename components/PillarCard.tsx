import Link from 'next/link'
import { PillarBadge } from './PillarBadge'
import { PILLARS, PillarSlug } from '@/lib/pillars'

interface PillarCardProps {
  name: string
  slug: string
  yieldRange: string
  oneLiner: string
  bestFor: string
  href: string
}

export function PillarCard({ name, slug, yieldRange, oneLiner, bestFor, href }: PillarCardProps) {
  const pillar = PILLARS[slug as PillarSlug]
  return (
    <Link href={href} className="block group">
      <div
        className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-6 hover:border-blue-400/20 transition-colors h-full"
        style={{ borderTopColor: pillar.accent, borderTopWidth: '2px' }}
      >
        <div className="mb-4">
          <PillarBadge name={name} textClass={pillar.textClass} borderClass={pillar.borderClass} />
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
