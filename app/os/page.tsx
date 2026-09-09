import { LiquidityCard } from '@/components/os/LiquidityCard';
import { OsShell } from '@/components/os/OsShell';
import { OsCard } from '@/components/os/OsCard';
import { RosterSplit } from '@/components/os/RosterSplit';
import { ScoreBar } from '@/components/os/ScoreBar';
import { StatStrip } from '@/components/os/StatStrip';
import { ThemeBars } from '@/components/os/ThemeBars';
import { convictionShow, formatAsOf, formatPct, formatThemeLabel, hasSignalStatus, paperPortfolio, signalPack, targetBook } from '@/lib/os-data';

export const metadata = {
  title: 'OS · Passive Blocks',
  robots: { index: false, follow: false },
};

export default function OsHomePage() {
  const top = [...convictionShow.show_rows].sort((a, b) => b.score - a.score).slice(0, 3);
  const ceilings = targetBook.risk_ceilings_ref;
  const signalLive = hasSignalStatus(signalPack);

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

      <RosterSplit />

      {signalLive ? (
        <section className="os-weather mb-8">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
              Adopted weather
            </h2>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">
              not the open question
            </span>
          </div>
          <p className="text-sm leading-relaxed text-[var(--muted)]">{signalPack.brief.regime_one_liner}</p>
          <p className="mt-2 text-[11px] text-[var(--muted)]">
            Adopted pack one-liner. Paper {signalPack.status.paper_book_action ?? 'HOLD'} stays copy, not a fill.
          </p>
        </section>
      ) : null}

      <LiquidityCard variant="teaser" />

      <div className="mb-8 grid gap-4 lg:grid-cols-5">
        <section className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] p-5 lg:col-span-3">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="os-stamp os-stamp--show">Show · not Act</span>
              <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
                Top conviction
              </h2>
            </div>
            <span className="font-mono text-[11px] text-[var(--muted)]">
              as of {formatAsOf(convictionShow.as_of)}
            </span>
          </div>
          <p className="mb-3 text-[11px] text-[var(--muted)]">
            Score ladder below the split. Not the thesis. Show rows never size the book.
          </p>
          <ul className="divide-y divide-[var(--border)]">
            {top.map((row) => (
              <li key={row.symbol} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="font-semibold tracking-tight">{row.symbol}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {formatThemeLabel(row.primary_theme)} · {row.tier} · {row.vera_decision.replace(/^SIGN_/, '')}
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
          description="Vera line-signed Show TOP100 vs 8 Vera Act book weights. Show ≠ Act."
          stamp="show"
          meta={`${convictionShow.show_rows.length} Show · ${convictionShow.book_rows.length} book · ${formatAsOf(convictionShow.as_of)}`}
        />
        <OsCard
          href="/os/book"
          label="Act"
          title="Paper book"
          description="Target weights after first paper fills. Live Act remains blocked."
          stamp="act"
          meta={`Paper · ${formatPct(targetBook.invested_pct)} invested`}
        />
        <OsCard
          href="/os/risk"
          label="Risk"
          title="Ceilings"
          description="Hard paper risk envelope Vera locked for unsupervised Act."
          stamp="act"
          meta={`Signed · DD ${ceilings.max_drawdown_pct}% · IL ${ceilings.max_il_budget_pct}%`}
        />
        <OsCard
          href="/os/signal"
          label="Sense"
          title="Signal inbox"
          description="Open Howell vs debasement split, then flow prints. Adopted weather sits under the split. Sense never sizes the book."
          stamp="sense"
          meta={
            signalLive
              ? `Live · ${signalPack.recent_signals.length} signals · ${signalPack.brief.themes.length} themes`
              : 'Waiting · pack not present'
          }
        />
        <OsCard
          href="/os/sources"
          label="Truth"
          title="Sources"
          description="Figures, URLs, and brief citations derived from the Sense pack."
          stamp="sense"
          meta={
            signalLive
              ? `Live · ${new Set(signalPack.recent_signals.map((s) => s.figure)).size} figures`
              : 'Waiting · pack not present'
          }
        />
      </div>
    </OsShell>
  );
}
