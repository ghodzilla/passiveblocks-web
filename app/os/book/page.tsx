import { ActDeskStrip } from '@/components/os/ActDeskStrip';
import { OsShell } from '@/components/os/OsShell';
import { StatStrip } from '@/components/os/StatStrip';
import { ThemeBars } from '@/components/os/ThemeBars';
import { WeightBar } from '@/components/os/WeightBar';
import {
  formatAsOf,
  formatPct,
  formatScore,
  formatThemeLabel,
  formatUsd,
  hasPaperPartialActBook,
  paperPartialActLabel,
  paperPortfolio,
  targetBook,
} from '@/lib/os-data';

/** Book theme map. NVDA is AI; TSM stays Semis. Copper added for PARTIAL densify. */
const BOOK_THEME_LABELS: Record<string, string> = {
  metals: 'Metals',
  crypto: 'Crypto',
  semis: 'Semis',
  ai: 'AI',
  energy: 'Energy',
  copper: 'Copper',
};

function bookThemeLabel(theme: string) {
  const key = theme.trim().toLowerCase();
  return BOOK_THEME_LABELS[key] ?? formatThemeLabel(theme);
}

export const metadata = {
  title: 'Book · OS',
  robots: { index: false, follow: false },
};

export default function BookPage() {
  const positions = [...targetBook.positions].sort((a, b) => b.weight_pct - a.weight_pct);
  const ceilings = targetBook.risk_ceilings_ref;
  const paperPartial = hasPaperPartialActBook(targetBook);
  const partialLabel = paperPartial ? paperPartialActLabel(targetBook) : null;
  const equity =
    typeof paperPortfolio.equity === 'number' ? paperPortfolio.equity : 100_000;

  return (
    <OsShell
      pathname="/os/book"
      eyebrow="Paper Act"
      title="Target book"
      subtitle={`First paper fills against live signals. Equity notional ${paperPortfolio.currency} ${equity.toLocaleString()} (sim). Live Act blocked until a venue rail is connected.`}
    >
      <StatStrip
        stats={[
          {
            label: 'NAV',
            value:
              typeof paperPortfolio.nav === 'number'
                ? formatUsd(paperPortfolio.nav)
                : '—',
            hint:
              paperPortfolio.marked_at
                ? `Marked ${formatAsOf(paperPortfolio.marked_at)}`
                : 'Paper',
          },
          {
            label: 'P&L %',
            value:
              typeof paperPortfolio.pnl_pct === 'number'
                ? `${paperPortfolio.pnl_pct > 0 ? '+' : ''}${paperPortfolio.pnl_pct.toFixed(2)}%`
                : '—',
            hint: 'vs USD 100k · public closes',
          },
          {
            label: 'Cash',
            value: formatPct(targetBook.cash_pct),
            hint: paperPartial
              ? `Invested ${formatPct(targetBook.invested_pct)} · PARTIAL`
              : '~30% explicit reserve',
          },
          {
            label: 'Live',
            value: paperPortfolio.live_blocked ? 'Blocked' : 'Open',
            hint: paperPortfolio.mode,
          },
        ]}
      />

      <ActDeskStrip />

      <div className="mb-8 grid gap-4 lg:grid-cols-3">
        <section className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] p-5 lg:col-span-2">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="os-stamp os-stamp--act">Paper · not live</span>
            <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
              Paper positions
            </h2>
          </div>
          {partialLabel ? (
            <p className="mb-3 text-[11px] font-semibold tracking-wide text-[var(--muted-foreground)]">
              {partialLabel}
            </p>
          ) : null}
          <p className="mb-3 text-[11px] text-[var(--muted)]">
            {positions.length} Vera book-signed lines · cash {formatPct(targetBook.cash_pct)} ·
            invested {formatPct(targetBook.invested_pct)} · not live-eligible funding.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-[var(--border)] text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
                <tr>
                  <th className="pb-2 font-bold">Symbol</th>
                  <th className="pb-2 font-bold">Theme</th>
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
                    </td>
                    <td className="py-3.5 text-sm">{bookThemeLabel(p.theme_bucket)}</td>
                    <td className="py-3.5">
                      <WeightBar pct={p.weight_pct} max={ceilings.max_single_name_pct} />
                    </td>
                    <td className="py-3.5 font-mono">
                      {typeof p.score === 'number' ? formatScore(p.score ?? 0) : '—'}
                    </td>
                    <td className="py-3.5 font-mono text-xs">{p.instrument}</td>
                    <td className="py-3.5 text-xs text-[var(--muted)]">{p.venue}</td>
                  </tr>
                ))}
                <tr>
                  <td className="py-3.5 font-semibold text-[var(--muted)]">CASH</td>
                  <td className="py-3.5 text-xs text-[var(--muted)]">—</td>
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
          <ThemeBars
            exposure={targetBook.theme_exposure_pct}
            capPct={ceilings.max_single_theme_pct}
            labels={BOOK_THEME_LABELS}
          />
          <p className="mt-5 text-[11px] leading-relaxed text-[var(--muted)]">
            Signed by {targetBook.vera_book_signed_by} · {formatAsOf(targetBook.vera_book_signed_at)}.
            Weights from feed only. Show ≠ Act. Paper only · not live funding.
            {paperPartial
              ? ` Live-promote ${targetBook.live_promote ?? 0}. Refused names are not Act weights.`
              : ''}
          </p>
        </section>
      </div>
    </OsShell>
  );
}
