import Link from 'next/link';
import { ActDeskStrip } from '@/components/os/ActDeskStrip';
import { MetricTile } from '@/components/os/MetricTile';
import { OsShell } from '@/components/os/OsShell';
import { ScoreBar } from '@/components/os/ScoreBar';
import { WeightBar } from '@/components/os/WeightBar';
import {
  convictionShow,
  formatAsOf,
  formatPct,
  formatThemeLabel,
  hasSignalStatus,
  paperMarks,
  paperPortfolio,
  signalPack,
  targetBook,
} from '@/lib/os-data';

export const metadata = {
  title: 'OS · Passive Blocks',
  robots: { index: false, follow: false },
};

function fmtNav(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function fmtPnlUsd(v: number) {
  const sign = v > 0 ? '+' : v < 0 ? '\u2212' : '';
  const abs = Math.abs(v);
  return `${sign}${abs.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmtPnlPct(v: number) {
  const sign = v > 0 ? '+' : v < 0 ? '\u2212' : '';
  return `${sign}${Math.abs(v).toFixed(2)}%`;
}

function pnlTone(v: number): 'ok' | 'bad' | 'neutral' {
  if (v > 0) return 'ok';
  if (v < 0) return 'bad';
  return 'neutral';
}

export default function OsHomePage() {
  const totals = paperMarks.totals;
  const nav = typeof totals.nav === 'number' ? totals.nav : Number(totals.nav);
  const pnlUsd = typeof totals.pnl_usd === 'number' ? totals.pnl_usd : Number(totals.pnl_usd);
  const pnlPct = typeof totals.pnl_pct === 'number' ? totals.pnl_pct : Number(totals.pnl_pct);
  const cashPct = totals.cash_pct;
  const investedPct = totals.invested_pct;
  const cashUsd = totals.cash_usd;
  const markAsOf = totals.latest_mark_as_of ?? '—';
  const tone = pnlTone(pnlPct);

  const signalLive = hasSignalStatus(signalPack);
  const gate = signalLive ? signalPack.status.gate : null;
  const paperAction =
    signalLive
      ? signalPack.status.paper_book_action ?? signalPack.brief.paper_book_action ?? 'HOLD'
      : 'HOLD';
  const horizon = signalLive ? signalPack.status.valid_until ?? null : null;
  const triage = signalLive ? signalPack.brief.triage : undefined;
  const asOfBrief = signalLive ? signalPack.status.as_of ?? signalPack.brief.as_of : null;
  const horizonLabel = horizon
    ? new Intl.DateTimeFormat('en-AU', {
        timeZone: 'Australia/Melbourne',
        day: 'numeric',
        month: 'short',
      }).format(new Date(horizon))
    : null;

  const paperLines = [...targetBook.positions].sort((a, b) => b.weight_pct - a.weight_pct).slice(0, 4);
  const topShow = [...convictionShow.show_rows].sort((a, b) => b.score - a.score).slice(0, 3);
  const ceilings = targetBook.risk_ceilings_ref;

  return (
    <OsShell
      pathname="/os"
      eyebrow="Personal operating system"
      title="Command"
      subtitle="Number-first desk. Show ≠ Act. Paper labeled Paper · not live."
    >
      {/* 1. KPI row — white elevated cards */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricTile
          variant="elevated"
          label="NAV"
          value={fmtNav(nav)}
          meta={`Paper · marked ${markAsOf}`}
        />
        <MetricTile
          variant="elevated"
          label="P&L"
          value={fmtPnlPct(pnlPct)}
          delta={fmtPnlUsd(pnlUsd)}
          meta="vs USD 100k notional"
          tone={tone}
        />
        <MetricTile
          variant="elevated"
          label="Cash"
          value={formatPct(cashPct, 0)}
          meta={`${fmtNav(cashUsd)} reserve`}
        />
        <MetricTile
          variant="elevated"
          label="Invested"
          value={formatPct(investedPct, 0)}
          meta={`DD ceiling ${ceilings.max_drawdown_pct}% · display`}
        />
      </div>

      {/* 2. Soft status banner */}
      <div
        className="mb-4 flex items-start gap-3 rounded-[var(--radius-lg)] border border-[var(--accent)]/25 bg-[var(--accent-muted)] px-4 py-3"
        role="status"
      >
        <span className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-[var(--accent-soft)]">
          Next
        </span>
        <p className="text-sm leading-snug text-foreground">
          Paper {paperAction}
          {asOfBrief ? ` · brief ${asOfBrief}` : ''}
          {' · '}
          live Act empty until Vera book-sign + brief_ref
          {triage
            ? ` · triage ${triage.watch.count}/${triage.paper_test.count}/${triage.live_promote.count}`
            : ''}
        </p>
      </div>

      {/* 3. Minimal pills */}
      <div className="mb-8 flex flex-wrap items-center gap-2">
        <span className="os-stamp os-stamp--act">Paper</span>
        {gate ? <span className="os-stamp os-stamp--sense">{gate}</span> : null}
        {horizonLabel ? (
          <span className="os-stamp">Horizon · {horizonLabel}</span>
        ) : null}
        {triage ? (
          <>
            <span className="os-stamp">Watch {triage.watch.count}</span>
            <span className="os-stamp">Paper-test {triage.paper_test.count}</span>
            <span className="os-stamp">Live-promote {triage.live_promote.count}</span>
          </>
        ) : null}
        {paperMarks.entry_reconstructed ? (
          <span className="os-stamp">Entry RECONSTRUCTED</span>
        ) : null}
        {paperPortfolio.live_blocked ? (
          <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">
            Live Act blocked
          </span>
        ) : null}
      </div>

      {/* 4. Primary surface — Act desk (hard-empty until live book-sign) */}
      <ActDeskStrip />

      {/* Secondary — scarce paper book strip */}
      <section
        className="mb-8 rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] p-5"
        aria-label="Paper book"
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="os-stamp os-stamp--act">Paper · not live</span>
            <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
              Paper book
            </h2>
          </div>
          <Link
            href="/os/book"
            className="text-[11px] font-semibold text-[var(--accent-soft)] hover:underline"
          >
            Full book →
          </Link>
        </div>
        <ul className="divide-y divide-[var(--border)]">
          {paperLines.map((row) => (
            <li key={row.symbol} className="flex items-center justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="font-semibold tracking-tight">{row.symbol}</p>
                <p className="text-xs text-[var(--muted)]">
                  {formatThemeLabel(row.theme_bucket)} · {row.instrument}
                </p>
              </div>
              <WeightBar pct={row.weight_pct} max={ceilings.max_single_name_pct} />
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11px] text-[var(--muted)]">
          {targetBook.positions.length} Vera book-signed lines · cash {formatPct(cashPct, 0)} · not
          live-eligible funding.
        </p>
      </section>

      {/* Secondary — top conviction only (not research hero) */}
      <section
        className="mb-8 rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] p-5"
        aria-label="Top conviction"
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="os-stamp os-stamp--show">Show · not Act</span>
            <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
              Top conviction
            </h2>
          </div>
          <Link
            href="/os/conviction"
            className="text-[11px] font-semibold text-[var(--accent-soft)] hover:underline"
          >
            Ledger →
          </Link>
        </div>
        <ul className="divide-y divide-[var(--border)]">
          {topShow.map((row) => (
            <li key={row.symbol} className="flex items-center justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="font-semibold tracking-tight">{row.symbol}</p>
                <p className="text-xs text-[var(--muted)]">
                  {formatThemeLabel(row.primary_theme)} · {row.tier}
                </p>
              </div>
              <ScoreBar score={row.score} />
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11px] text-[var(--muted)]">
          as of {formatAsOf(convictionShow.as_of)} · Show rows never size the book.
        </p>
      </section>

      {/* Research demoted to links */}
      <nav className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-[var(--muted)]" aria-label="Research links">
        <Link href="/os/results" className="hover:text-foreground">
          Results
        </Link>
        <Link href="/os/signal" className="hover:text-foreground">
          Signal
        </Link>
        <Link href="/os/sources" className="hover:text-foreground">
          Sources
        </Link>
        <Link href="/os/liquidity" className="hover:text-foreground">
          Liquidity
        </Link>
        <Link href="/os/risk" className="hover:text-foreground">
          Risk
        </Link>
        <Link href="/os/conviction" className="hover:text-foreground">
          Conviction
        </Link>
      </nav>
    </OsShell>
  );
}
