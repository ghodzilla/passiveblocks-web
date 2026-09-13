import { OsShell } from '@/components/os/OsShell';
import { MetricTile } from '@/components/os/MetricTile';
import {
  formatAsOf,
  formatUsd,
  formatVintage,
  paperEquityCurve,
  paperMarks,
} from '@/lib/os-data';
import results from '@/data/os/results.json';

export const metadata = {
  title: 'Results · OS',
  robots: { index: false, follow: false },
};

type QuarterRow = {
  symbol: string;
  quarter: string;
  revenue: string;
  profit: string;
  margin: string;
  capex: string;
  notable: string;
};

type NowRow = {
  symbol: string;
  next: string;
  watch: string;
  latest: string;
};

function fmtPrice(v: number | string) {
  if (typeof v === 'string') return v;
  if (v >= 1000) return v.toLocaleString('en-US', { maximumFractionDigits: 2 });
  return v.toLocaleString('en-US', { maximumFractionDigits: 4 });
}

function fmtPnlPct(v: number | string) {
  if (typeof v === 'string') return v;
  const sign = v > 0 ? '+' : '';
  return `${sign}${v.toFixed(2)}%`;
}

function fmtPnlUsd(v: number | string) {
  if (typeof v === 'string') return v;
  const sign = v > 0 ? '+' : v < 0 ? '−' : '';
  const abs = Math.abs(v);
  return `${sign}${abs.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}`.replace(
    '$-',
    '−$',
  );
}

function pnlTone(v: number | string): 'ok' | 'bad' | 'neutral' {
  if (typeof v !== 'number') return 'neutral';
  if (v > 0) return 'ok';
  if (v < 0) return 'bad';
  return 'neutral';
}

export default function ResultsPage() {
  const quarterly = results.quarterly.rows as QuarterRow[];
  const now = results.now.rows as NowRow[];
  const refresh = formatVintage(results.now.refreshed);
  const nowLayer = formatVintage(results.now.as_of);
  const quarterlyVintage = formatVintage(results.quarterly.as_of);
  const nowCaption = results.now.caption.replace(
    'Deep financials above stay the Jul snapshot.',
    'Deep financials stay the Jul snapshot, collapsed below as a prior snapshot.',
  );

  const totals = paperMarks.totals;
  const nav = totals.nav;
  const pnlPct = totals.pnl_pct;
  const pnlUsd = totals.pnl_usd;
  const navStr = typeof nav === 'number' ? formatUsd(nav) : String(nav);
  const pnlPctStr = fmtPnlPct(pnlPct);
  const pnlUsdStr = typeof pnlUsd === 'number' ? fmtPnlUsd(pnlUsd) : String(pnlUsd);
  const markedLabel = formatAsOf(paperMarks.marked_at);
  const curve = paperEquityCurve.points.filter((p) => typeof p.nav === 'number');
  const first = curve[0];
  const mid = curve[Math.floor(curve.length / 2)];
  const last = curve[curve.length - 1];
  const tone = pnlTone(pnlPct);

  const lead = [
    `Paper book NAV ${navStr} on ${totals.latest_mark_as_of ?? 'latest mark'} — ${pnlPctStr} vs USD 100,000 notional since the 6 Sep fills.`,
    `Entry prices are RECONSTRUCTED: fills were weights-only. Equities/ETFs use 4 Sep close (5–7 Sep closed: weekend + Labor Day); crypto uses 6 Sep UTC daily. Cash ~${paperMarks.cash_pct}% explicit — not a path-to-40%.`,
    `Show ≠ Act. This is paper MTM against public closes, not Conviction Show and not live capital. Source URL and as-of sit on every price cell. Hole. Not zero.`,
  ].join(' ');

  return (
    <OsShell
      pathname="/os/results"
      eyebrow="Sense · Paper"
      title="Results"
      subtitle="Paper track record first. Company prints demoted. Not a score. Show ≠ Act."
    >
      <p className="mb-6 text-xs text-[var(--muted)]">
        Marked {markedLabel}.{' '}
        <span className="os-stamp os-stamp--sense">Paper MTM · {markedLabel}</span>{' '}
        <span className="ml-1 os-stamp">Entry RECONSTRUCTED</span>{' '}
        <span className="ml-1 os-stamp">Show ≠ Act</span>
      </p>

      <div className="mb-6 max-w-3xl space-y-3 text-sm leading-relaxed text-foreground">
        <p>{lead}</p>
        <p className="text-xs text-[var(--muted)]">
          DD ceiling {paperMarks.max_dd_ceiling_pct}% for display comparison only — no breach events invented.
          {paperMarks.insufficient_symbols.length
            ? ` INSUFFICIENT: ${paperMarks.insufficient_symbols.join(', ')}.`
            : ' No INSUFFICIENT symbols this mark.'}{' '}
          Yahoo chart v8 daily closes.
        </p>
      </div>

      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile label="NAV" value={navStr} meta={`Paper · marked ${totals.latest_mark_as_of ?? '—'}`} tone={tone} />
        <MetricTile
          label="P&L %"
          value={pnlPctStr}
          delta={pnlUsdStr}
          meta="vs USD 100k notional"
          tone={tone}
        />
        <MetricTile
          label="Cash"
          value={`${paperMarks.cash_pct.toFixed(0)}%`}
          meta="Explicit reserve · not path-to-40%"
        />
        <MetricTile
          label="Invested"
          value={`${paperMarks.invested_pct.toFixed(0)}%`}
          meta="Vera-signed weights · paper"
        />
      </div>

      <section className="mb-10">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
              Equity curve
            </h2>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-[var(--muted)]">
              Daily NAV from fill date through latest mark. Weekend / holiday = last session carry. Entry day =
              notional (units sized to reconstructed closes).
            </p>
          </div>
          <span className="os-stamp">{paperEquityCurve.interval}</span>
        </div>
        <div className="overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-[var(--border)] bg-black/20 text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
                <tr>
                  <th className="px-4 py-3 font-bold">Date</th>
                  <th className="px-4 py-3 font-bold">NAV</th>
                  <th className="px-4 py-3 font-bold">P&L %</th>
                  <th className="px-4 py-3 font-bold">Source</th>
                </tr>
              </thead>
              <tbody>
                {[first, mid, last]
                  .filter(Boolean)
                  .filter((p, i, arr) => arr.findIndex((x) => x && x.date === p!.date) === i)
                  .map((p) => (
                    <tr key={p!.date} className="border-b border-[var(--border)]/70">
                      <td className="px-4 py-3 font-mono text-xs">{p!.date}</td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {typeof p!.nav === 'number' ? formatUsd(p!.nav) : String(p!.nav)}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{fmtPnlPct(p!.pnl_pct)}</td>
                      <td className="px-4 py-3 text-[11px] leading-relaxed text-[var(--muted)]">
                        {p!.date === first?.date
                          ? 'Entry day · reconstructed'
                          : p!.date === last?.date
                            ? 'Latest mark'
                            : 'Mid-window'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-[var(--border)] px-4 py-2 text-[11px] text-[var(--muted)]">
            Full daily series in <span className="font-mono">paper-equity-curve.json</span> ({curve.length} points).
            Paper only.
          </p>
        </div>
      </section>

      <section className="mb-12">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
              Per-line P&L
            </h2>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-[var(--muted)]">
              Entry RECONSTRUCTED from public daily closes (fills were weights-only). Every price cell carries
              source + as-of. Weights unchanged from Vera-signed book.
            </p>
          </div>
          <span className="os-stamp">Yahoo · daily close</span>
        </div>
        <div className="overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="border-b border-[var(--border)] bg-black/20 text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
                <tr>
                  <th className="px-4 py-3 font-bold">Symbol</th>
                  <th className="px-4 py-3 font-bold">Instr</th>
                  <th className="px-4 py-3 font-bold">Wt %</th>
                  <th className="px-4 py-3 font-bold">Entry</th>
                  <th className="px-4 py-3 font-bold">Mark</th>
                  <th className="px-4 py-3 font-bold">MV</th>
                  <th className="px-4 py-3 font-bold">P&L $</th>
                  <th className="px-4 py-3 font-bold">P&L %</th>
                </tr>
              </thead>
              <tbody>
                {paperMarks.positions.map((row) => (
                  <tr key={row.symbol} className="border-b border-[var(--border)]/70 align-top">
                    <td className="px-4 py-3 font-semibold tracking-tight">{row.symbol}</td>
                    <td className="px-4 py-3 font-mono text-xs">{row.instrument}</td>
                    <td className="px-4 py-3 font-mono text-xs">{row.weight_pct.toFixed(2)}</td>
                    <td className="px-4 py-3 text-xs">
                      <div className="font-mono">{fmtPrice(row.entry_price)}</div>
                      <div className="mt-1 text-[10px] text-[var(--muted)]">
                        as_of {row.entry_as_of ?? '—'} · RECONSTRUCTED
                      </div>
                      {row.entry_source_url ? (
                        <a
                          className="mt-0.5 block truncate text-[10px] text-[var(--muted)] underline-offset-2 hover:underline"
                          href={row.entry_source_url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          source
                        </a>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div className="font-mono">{fmtPrice(row.mark_price)}</div>
                      <div className="mt-1 text-[10px] text-[var(--muted)]">as_of {row.mark_as_of ?? '—'}</div>
                      {row.mark_source_url ? (
                        <a
                          className="mt-0.5 block truncate text-[10px] text-[var(--muted)] underline-offset-2 hover:underline"
                          href={row.mark_source_url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          source
                        </a>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {typeof row.market_value === 'number' ? formatUsd(row.market_value) : String(row.market_value)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{fmtPnlUsd(row.pnl_usd)}</td>
                    <td className="px-4 py-3 font-mono text-xs">{fmtPnlPct(row.pnl_pct)}</td>
                  </tr>
                ))}
                <tr className="border-b border-[var(--border)]/70 align-top bg-black/10">
                  <td className="px-4 py-3 font-semibold text-[var(--muted)]">CASH</td>
                  <td className="px-4 py-3 font-mono text-xs">USD</td>
                  <td className="px-4 py-3 font-mono text-xs">{paperMarks.cash.weight_pct.toFixed(2)}</td>
                  <td className="px-4 py-3 text-xs text-[var(--muted)]">1.00 · cash</td>
                  <td className="px-4 py-3 text-xs text-[var(--muted)]">1.00 · cash</td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {typeof paperMarks.cash.market_value === 'number'
                      ? formatUsd(paperMarks.cash.market_value)
                      : String(paperMarks.cash.market_value)}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">$0</td>
                  <td className="px-4 py-3 font-mono text-xs">0.00%</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="border-t border-[var(--border)] px-4 py-2 text-[11px] leading-relaxed text-[var(--muted)]">
            {paperMarks.entry_reconstructed_note} Cash ~{paperMarks.cash_pct}% explicit. Show ≠ Act. Paper only.
          </p>
        </div>
      </section>

      <details className="mb-8 rounded-[var(--radius-xl)] border border-[var(--border)] bg-black/15">
        <summary className="cursor-pointer px-4 py-3 text-sm">
          <span className="font-semibold">Fundamentals disclosure</span>
          <span className="ml-2 text-xs text-[var(--muted)]">
            Company next-report / watch · Sense layer · not paper MTM
          </span>
        </summary>
        <section className="border-t border-[var(--border)] px-4 py-4">
          <div className="mb-6 max-w-3xl space-y-3 text-sm leading-relaxed text-foreground">
            <p>{results.lead}</p>
            <ul className="space-y-2 text-[var(--muted)]">
              {results.watch.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <p className="text-xs text-[var(--muted)]">{results.as_of_note}</p>
          </div>

          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
                What is happening now
              </h2>
              <p className="mt-1 max-w-3xl text-xs leading-relaxed text-[var(--muted)]">{nowCaption}</p>
            </div>
            <span className="os-stamp os-stamp--sense">
              refreshed {refresh} · layer {nowLayer}
            </span>
          </div>
          <div className="overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="border-b border-[var(--border)] bg-black/20 text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
                  <tr>
                    <th className="px-4 py-3 font-bold">Ticker</th>
                    <th className="px-4 py-3 font-bold">Next report</th>
                    <th className="px-4 py-3 font-bold">What would move it</th>
                    <th className="px-4 py-3 font-bold">Latest print</th>
                  </tr>
                </thead>
                <tbody>
                  {now.map((row) => (
                    <tr key={row.symbol} className="border-b border-[var(--border)]/70 align-top">
                      <td className="px-4 py-3 font-semibold tracking-tight">{row.symbol}</td>
                      <td className="px-4 py-3 text-xs">{row.next}</td>
                      <td className="px-4 py-3 text-xs leading-relaxed text-[var(--muted)]">{row.watch}</td>
                      <td className="px-4 py-3 text-xs leading-relaxed">{row.latest}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </details>

      <details className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-black/15">
        <summary className="cursor-pointer px-4 py-3 text-sm">
          <span className="font-semibold">Prior snapshot</span>
          <span className="ml-2 text-xs text-[var(--muted)]">
            Latest quarterly results · {quarterlyVintage}. Not current. Not paper MTM.
          </span>
        </summary>
        <section className="border-t border-[var(--border)] px-4 py-4">
          <div className="mb-3">
            <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
              Latest quarterly results
            </h2>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-[var(--muted)]">
              {results.quarterly.caption}
            </p>
          </div>
          <div className="overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="border-b border-[var(--border)] bg-black/20 text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
                  <tr>
                    <th className="px-4 py-3 font-bold">Ticker</th>
                    <th className="px-4 py-3 font-bold">Quarter</th>
                    <th className="px-4 py-3 font-bold">Revenue</th>
                    <th className="px-4 py-3 font-bold">Profit</th>
                    <th className="px-4 py-3 font-bold">Margin / cash</th>
                    <th className="px-4 py-3 font-bold">Capex / R&D</th>
                    <th className="px-4 py-3 font-bold">Where the money is going</th>
                  </tr>
                </thead>
                <tbody>
                  {quarterly.map((row) => (
                    <tr key={row.symbol} className="border-b border-[var(--border)]/70 align-top">
                      <td className="px-4 py-3 font-semibold tracking-tight">{row.symbol}</td>
                      <td className="px-4 py-3 text-xs text-[var(--muted)]">{row.quarter}</td>
                      <td className="px-4 py-3 font-mono text-xs">{row.revenue}</td>
                      <td className="px-4 py-3 text-xs">{row.profit}</td>
                      <td className="px-4 py-3 text-xs">{row.margin}</td>
                      <td className="px-4 py-3 text-xs">{row.capex}</td>
                      <td className="px-4 py-3 text-xs leading-relaxed text-[var(--muted)]">{row.notable}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </details>
    </OsShell>
  );
}
