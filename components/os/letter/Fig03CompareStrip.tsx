/**
 * FIG-03 · Compare strip — Farside week vs SoSoValue session vs stables 7d.
 * Exact cited values only. Footer: GLI INSUFFICIENT.
 */
const COLUMNS = [
  {
    title: 'Farside week',
    asOf: '2026-09-04',
    rows: [
      { label: 'BTC ETF net · 1–4 Sep sum', value: '+770.0 US$m', tone: 'ok' as const },
      { label: 'ETH ETF net · 1–4 Sep sum', value: '+127.7 US$m', tone: 'ok' as const },
    ],
    source: 'farside.co.uk',
  },
  {
    title: 'SoSoValue session',
    asOf: '2026-09-08',
    rows: [
      { label: 'BTC ETF net', value: '−46.6464 US$m', tone: 'bad' as const },
      { label: 'ETH ETF net', value: '−24.2921 US$m', tone: 'bad' as const },
    ],
    source: 'sosovalue.com',
  },
  {
    title: 'Stables 7d',
    asOf: '2026-09-08',
    rows: [
      { label: 'USD-pegged circulating', value: '~$309.850bn', tone: 'neutral' as const },
      { label: '7d change', value: '+$1.440bn', tone: 'ok' as const },
    ],
    source: 'DefiLlama',
  },
] as const;

function toneClass(tone: 'ok' | 'bad' | 'neutral') {
  if (tone === 'ok') return 'text-[var(--status-ok)]';
  if (tone === 'bad') return 'text-[var(--status-danger)]';
  return 'text-foreground';
}

export function Fig03CompareStrip() {
  return (
    <figure
      id="fig-03-compare-farside-sosovalue-stables"
      aria-label="Compare strip showing early-September Farside ETF inflows, one SoSoValue post-holiday outflow session, and stablecoin seven-day increase, with a footer that the Howell GLI cell remains insufficient."
      className="overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)]"
    >
      <figcaption className="border-b border-[var(--border)] px-5 py-4 sm:px-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
          FIG-03 · Compare
        </p>
        <h3 className="mt-1 text-lg font-bold tracking-tight text-foreground sm:text-xl">
          Bridge prints ≠ GLI test
        </h3>
      </figcaption>

      <div className="grid gap-0 sm:grid-cols-3">
        {COLUMNS.map((col, i) => (
          <div
            key={col.title}
            className={`p-5 ${i < COLUMNS.length - 1 ? 'border-b border-[var(--border)] sm:border-b-0 sm:border-r' : ''}`}
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
              {col.title}
            </p>
            <p className="mt-1 text-[10px] text-[var(--muted)]">
              as-of {col.asOf} · {col.source}
            </p>
            <ul className="mt-4 space-y-3">
              {col.rows.map((row) => (
                <li key={row.label}>
                  <p className="text-[11px] text-[var(--muted)]">{row.label}</p>
                  <p className={`mt-0.5 font-mono text-xl font-semibold tracking-tight ${toneClass(row.tone)}`}>
                    {row.value}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <footer className="border-t border-dashed border-[var(--border-strong)] bg-black/20 px-5 py-3 sm:px-6">
        <p className="text-xs leading-relaxed text-[var(--muted)]">
          <span className="font-semibold text-[var(--muted-foreground)]">
            GLI / Howell falsifier cell: INSUFFICIENT
          </span>{' '}
          (Hole. Not zero.) — these three columns do not fill it.
        </p>
        <p className="mt-1 text-[10px] text-[var(--muted-foreground)]">
          Live twin footnote: Farside 08 Sep complete BTC −46.6 / ETH −24.3 US$m — same direction as
          SoSoValue; still not GLI.
        </p>
      </footer>
    </figure>
  );
}
