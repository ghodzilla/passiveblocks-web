import { OsShell } from '@/components/os/OsShell';
import { formatVintage } from '@/lib/os-data';
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

  return (
    <OsShell
      pathname="/os/results"
      eyebrow="Sense"
      title="Results"
      subtitle="Latest quarter, and where the money is going. Not a score. Not Act."
    >
      <p className="mb-6 text-xs text-[var(--muted)]">
        Last full refresh {refresh}.{' '}
        <span className="os-stamp os-stamp--sense">Now · {refresh}</span>{' '}
        <span className="ml-1 os-stamp">Prior snapshot · {quarterlyVintage}</span>
      </p>

      <div className="mb-8 max-w-3xl space-y-3 text-sm leading-relaxed text-foreground">
        <p>{results.lead}</p>
        <ul className="space-y-2 text-[var(--muted)]">
          {results.watch.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p className="text-xs text-[var(--muted)]">{results.as_of_note}</p>
      </div>

      <section className="mb-12">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
              What is happening now
            </h2>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-[var(--muted)]">
              {nowCaption}
            </p>
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

      <details className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-black/15">
        <summary className="cursor-pointer px-4 py-3 text-sm">
          <span className="font-semibold">Prior snapshot</span>
          <span className="ml-2 text-xs text-[var(--muted)]">
            Latest quarterly results · {quarterlyVintage}. Not current. The 26 Aug print sits in What is happening now.
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
