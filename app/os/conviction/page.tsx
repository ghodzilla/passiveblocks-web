import { OsShell } from '@/components/os/OsShell';
import { ScoreBar } from '@/components/os/ScoreBar';
import { StatStrip } from '@/components/os/StatStrip';
import { conviction, formatAsOf, formatScore } from '@/lib/os-data';

export const metadata = {
  title: 'Conviction · OS',
  robots: { index: false, follow: false },
};

const tierTone: Record<string, string> = {
  core: 'text-[var(--status-ok)] bg-[var(--status-ok)]/10 border-[var(--status-ok)]/25',
  growth: 'text-[var(--accent-soft)] bg-[var(--accent-muted)] border-[var(--accent)]/25',
  satellite: 'text-[var(--accent-soft)] bg-[var(--accent-muted)] border-[var(--accent)]/25',
  watch: 'text-[var(--status-warn)] bg-[var(--status-warn)]/10 border-[var(--status-warn)]/25',
  veto: 'text-[var(--status-danger)] bg-[var(--status-danger)]/10 border-[var(--status-danger)]/25',
};

function tierClass(tier: string) {
  return tierTone[tier.toLowerCase()] ?? tierTone.watch;
}

export default function ConvictionPage() {
  const rows = [...conviction.rows].sort((a, b) => b.score - a.score);
  const avg = rows.reduce((s, r) => s + r.score, 0) / Math.max(rows.length, 1);
  const vetoed = conviction.vera_line_sign_ref?.vetoed_symbols?.length ?? 0;

  return (
    <OsShell
      pathname="/os/conviction"
      eyebrow="Decide"
      title="Conviction ledger"
      subtitle={conviction.note}
    >
      <StatStrip
        stats={[
          { label: 'Lines', value: String(rows.length), hint: 'Vera book-signed' },
          { label: 'Avg score', value: formatScore(avg), hint: 'Equal-weight mean' },
          { label: 'As of', value: formatAsOf(conviction.as_of), hint: 'Melbourne' },
          {
            label: 'Vetoes',
            value: String(vetoed),
            hint: conviction.vera_signed ? 'Signed ledger' : 'Draft',
          },
        ]}
      />

      <div className="overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-[var(--border)] bg-black/20 text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
              <tr>
                <th className="px-4 py-3 font-bold">Symbol</th>
                <th className="px-4 py-3 font-bold">Score</th>
                <th className="px-4 py-3 font-bold">Tier</th>
                <th className="px-4 py-3 font-bold">Theme</th>
                <th className="px-4 py-3 font-bold">Instrument</th>
                <th className="px-4 py-3 font-bold">Why</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {rows.map((row) => (
                <tr key={row.symbol} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3.5">
                    <p className="font-semibold tracking-tight">{row.symbol}</p>
                    <p className="text-[11px] text-[var(--muted)]">{row.sleeve}</p>
                  </td>
                  <td className="px-4 py-3.5">
                    <ScoreBar score={row.score} />
                  </td>
                  <td className="px-4 py-3.5">
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${tierClass(row.tier)}`}
                    >
                      {row.tier}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 capitalize text-[var(--muted)]">{row.theme_bucket}</td>
                  <td className="px-4 py-3.5 font-mono text-xs text-foreground">{row.instrument}</td>
                  <td className="max-w-xs px-4 py-3.5 text-xs leading-relaxed text-[var(--muted)]">
                    {row.why}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </OsShell>
  );
}
