import { PillarBadge } from './PillarBadge'
import { PILLARS, PillarSlug } from '@/lib/pillars'

interface YieldRow {
  rank: number
  name: string
  pillar: string
  pillarSlug: PillarSlug
  yield: string
  riskLabel: 'Low' | 'Med' | 'High'
}

interface RankedYieldsTableProps {
  rows: YieldRow[]
}

const riskColors: Record<string, string> = {
  Low: 'text-green-400 border-green-400/30',
  Med: 'text-amber-400 border-amber-400/30',
  High: 'text-red-400 border-red-400/30',
}

export function RankedYieldsTable({ rows }: RankedYieldsTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/[0.07] text-xs font-bold uppercase tracking-widest text-white/30">
            <th className="text-left py-3 pr-4 w-10">#</th>
            <th className="text-left py-3 pr-4">Opportunity</th>
            <th className="text-left py-3 pr-4">Category</th>
            <th className="text-right py-3 pr-4">Yield</th>
            <th className="text-right py-3">Risk</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const pillar = PILLARS[row.pillarSlug]
            return (
              <tr key={row.rank} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                <td className="py-4 pr-4 text-white/30 font-mono text-xs">{row.rank}</td>
                <td className="py-4 pr-4 font-semibold text-white/90">{row.name}</td>
                <td className="py-4 pr-4">
                  <PillarBadge
                    name={row.pillar}
                    textClass={pillar.textClass}
                    borderClass={pillar.borderClass}
                  />
                </td>
                <td className="py-4 pr-4 text-right font-bold text-white/90">{row.yield}</td>
                <td className="py-4 text-right">
                  <span className={`text-xs font-bold uppercase tracking-widest rounded-full px-2 py-0.5 border ${riskColors[row.riskLabel]}`}>
                    {row.riskLabel}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
