import { OsShell } from '@/components/os/OsShell';
import { StatStrip } from '@/components/os/StatStrip';
import { ThemeBars } from '@/components/os/ThemeBars';
import { WeightBar } from '@/components/os/WeightBar';
import { formatAsOf, formatPct, formatScore, paperPortfolio, targetBook } from '@/lib/os-data';

export const metadata = {
  title: 'Book · OS',
  robots: { index: false, follow: false },
};

export default function BookPage() {
  const positions = [...targetBook.positions].sort((a, b) => b.weight_pct - a.weight_pct);
  const ceilings = targetBook.risk_ceilings_ref;

  return (
    <OsShell
      pathname="/os/book"
      eyebrow="Paper Act"
      title="Target book"
      subtitle={`First paper fills against live signals. Equity notional ${paperPortfolio.currency} ${paperPortfolio.equity.toLocaleString()} (sim). Live Act blocked until a venue rail is connected.`}
    >
      <StatStrip
        stats={[
          { label: 'Invested', value: formatPct(targetBook.invested_pct), hint: targetBook.status },
          { label: 'Cash', value: formatPct(targetBook.cash_pct), hint: 'Reserve' },
          {
            label: 'Fills',
            value: String(paperPortfolio.last_fill_count),
            hint: formatAsOf(paperPortfolio.updated),
          },
          {
            label: 'Live',
            value: paperPortfolio.live_blocked ? 'Blocked' : 'Open',
            hint: paperPortfolio.mode,
          },
        ]}
      />

      <div className="mb-8 grid gap-4 lg:grid-cols-3">
        <section className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] p-5 lg:col-span-2">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
            Positions
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-[var(--border)] text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
                <tr>
                  <th className="pb-2 font-bold">Symbol</th>
                  <th className="pb-2 font-bold">Weight</th>
                  <th className="pb-2 font-bold">Score</th>
                  <th className="pb-2 font-bold">Instrument</th>
                  <th className="pb-2 font-bold">Venue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {positions.map((p) => (
                  <tr key={p.symbol} className="hover:bg-white/[0.02]">
                    <td className="py-3.5">
                      <p className="font-semibold">{p.symbol}</p>
                      <p className="text-[11px] capitalize text-[var(--muted)]">{p.theme_bucket}</p>
                    </td>
                    <td className="py-3.5">
                      <WeightBar pct={p.weight_pct} max={ceilings.max_single_name_pct} />
                    </td>
                    <td className="py-3.5 font-mono">{formatScore(p.score)}</td>
                    <td className="py-3.5 font-mono text-xs">{p.instrument}</td>
                    <td className="py-3.5 text-xs text-[var(--muted)]">{p.venue}</td>
                  </tr>
                ))}
                <tr>
                  <td className="py-3.5 font-semibold text-[var(--muted)]">CASH</td>
                  <td className="py-3.5">
                    <WeightBar pct={targetBook.cash_pct} max={100} />
                  </td>
                  <td className="py-3.5 text-[var(--muted)]">—</td>
                  <td className="py-3.5 text-xs text-[var(--muted)]">USD</td>
                  <td className="py-3.5 text-xs text-[var(--muted)]">sim</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
            Theme exposure
          </h2>
          <ThemeBars exposure={targetBook.theme_exposure_pct} capPct={ceilings.max_single_theme_pct} />
          <p className="mt-5 text-[11px] leading-relaxed text-[var(--muted)]">
            Signed by {targetBook.vera_book_signed_by} · {formatAsOf(targetBook.vera_book_signed_at)}. Weights
            only — no mark-to-market invented here.
          </p>
        </section>
      </div>
    </OsShell>
  );
}
