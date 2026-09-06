import { OsShell } from '@/components/os/OsShell';
import { OsCard } from '@/components/os/OsCard';
import { ScoreBar } from '@/components/os/ScoreBar';
import { StatStrip } from '@/components/os/StatStrip';
import { ThemeBars } from '@/components/os/ThemeBars';
import { conviction, formatAsOf, formatPct, paperPortfolio, targetBook } from '@/lib/os-data';

export const metadata = {
  title: 'OS · Passive Blocks',
  robots: { index: false, follow: false },
};

export default function OsHomePage() {
  const top = [...conviction.rows].sort((a, b) => b.score - a.score).slice(0, 3);
  const ceilings = targetBook.risk_ceilings_ref;

  return (
    <OsShell
      pathname="/os"
      eyebrow="Personal operating system"
      title="Command"
      subtitle="Sense → Decide → Show → paper Act. Only Vera-signed lines appear here. Live trading stays blocked until a venue rail is connected."
    >
      <StatStrip
        stats={[
          {
            label: 'Invested',
            value: formatPct(targetBook.invested_pct),
            hint: 'Paper book',
          },
          {
            label: 'Cash',
            value: formatPct(targetBook.cash_pct),
            hint: 'Reserve',
          },
          {
            label: 'Lines',
            value: String(targetBook.positions.length),
            hint: 'Vera book-signed',
          },
          {
            label: 'Mode',
            value: paperPortfolio.live_blocked ? 'Paper' : 'Live',
            hint: paperPortfolio.live_blocked ? 'Live Act blocked' : 'Live rail on',
          },
        ]}
      />

      <div className="mb-8 grid gap-4 lg:grid-cols-5">
        <section className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] p-5 lg:col-span-3">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
              Top conviction
            </h2>
            <span className="font-mono text-[11px] text-[var(--muted)]">
              as of {formatAsOf(conviction.as_of)}
            </span>
          </div>
          <ul className="divide-y divide-[var(--border)]">
            {top.map((row) => (
              <li key={row.symbol} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="font-semibold tracking-tight">{row.symbol}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {row.instrument} · {row.theme_bucket} · {row.tier}
                  </p>
                </div>
                <ScoreBar score={row.score} />
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] p-5 lg:col-span-2">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
            Theme vs cap
          </h2>
          <ThemeBars exposure={targetBook.theme_exposure_pct} capPct={ceilings.max_single_theme_pct} />
          <p className="mt-4 text-[11px] text-[var(--muted)]">
            Ceilings DD {ceilings.max_drawdown_pct}% · IL {ceilings.max_il_budget_pct}% · name{' '}
            {ceilings.max_single_name_pct}% · theme {ceilings.max_single_theme_pct}%
          </p>
        </section>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <OsCard
          href="/os/conviction"
          label="Decide"
          title="Conviction ledger"
          description="Vera-signed scores across the paper universe. No inventable PnL."
          status="Signed"
          accent="ok"
          meta={`${conviction.rows.length} lines · ${formatAsOf(conviction.as_of)}`}
        />
        <OsCard
          href="/os/book"
          label="Act"
          title="Paper book"
          description="Target weights after first paper fills. Live Act remains blocked."
          status="Paper"
          accent="accent"
          meta={`${formatPct(targetBook.invested_pct)} invested`}
        />
        <OsCard
          href="/os/risk"
          label="Risk"
          title="Ceilings"
          description="Hard paper risk envelope Vera locked for unsupervised Act."
          status="Active"
          accent="warn"
          meta={`DD ${ceilings.max_drawdown_pct}% · IL ${ceilings.max_il_budget_pct}%`}
        />
        <OsCard
          href="/os/signal"
          label="Sense"
          title="Signal inbox"
          description="Roster and transcript ingest. Packs land here after Sam ships."
          status="Wiring"
          accent="neutral"
        />
        <OsCard
          href="/os/sources"
          label="Truth"
          title="Sources"
          description="Transcript and research provenance for every score claim."
          status="Soon"
          accent="neutral"
        />
      </div>
    </OsShell>
  );
}
