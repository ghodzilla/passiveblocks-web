import type { ReplaySummary } from '@/lib/regime/ownerCopy';
import balanced from '@/research/regime-validation/sixty-forty.json';

interface Series {
  label: string;
  cagr: number | null;
  maxDrawdown: number | null;
  note?: string;
}

function pct(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${(value * 100).toFixed(1)}%`;
}

function Bars({
  title,
  rows,
  pick,
  scale,
}: {
  title: string;
  rows: Series[];
  pick: (row: Series) => number | null;
  scale: number;
}) {
  return (
    <div>
      <h3 className="text-sm font-bold text-[var(--text-1)]">{title}</h3>
      <ul className="mt-3 grid gap-2">
        {rows.map((row) => {
          const value = pick(row);
          const width = value == null || !(scale > 0) ? 0 : Math.min(100, (Math.abs(value) / scale) * 100);
          return (
            <li key={`${title}-${row.label}`}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-[var(--text-2)]">{row.label}</span>
                <span className="font-mono text-xs tabular-nums text-[var(--text-1)]">{pct(value)}</span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-white/10" aria-hidden>
                <div className="h-2 rounded-full" style={{ width: `${width}%`, background: title === 'Worst fall' ? 'var(--call-sell)' : 'var(--call-hold)' }} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function BenchmarkBoard({
  rules,
  spy,
  mix,
  windowLabel,
}: {
  rules: ReplaySummary | null;
  spy: ReplaySummary | null;
  mix: ReplaySummary | null;
  windowLabel: string | null;
}) {
  const rows: Series[] = [
    { label: 'These rules', cagr: rules?.cagr ?? null, maxDrawdown: rules?.maxDrawdown ?? null },
    { label: 'S&P 500, same deposits', cagr: spy?.cagr ?? null, maxDrawdown: spy?.maxDrawdown ?? null },
    { label: 'Separate line: 60% S&P 500 / 40% cash, same deposits', cagr: mix?.cagr ?? null, maxDrawdown: mix?.maxDrawdown ?? null },
  ];
  const have = rows.some((row) => row.cagr != null || row.maxDrawdown != null);
  const cagrScale = Math.max(0.05, ...rows.map((row) => Math.abs(row.cagr ?? 0)));
  const ddScale = Math.max(0.05, ...rows.map((row) => Math.abs(row.maxDrawdown ?? 0)));
  return (
    <div className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface-1)] px-4 py-4">
      <h3 className="text-base font-bold text-[var(--text-1)]">Replay against the indexes</h3>
      <p className="mt-2 text-sm leading-relaxed text-[var(--text-2)]">
        {windowLabel ? `${windowLabel}. ` : ''}
        Bars are the stored yearly pace and the stored worst fall. A day-by-day line is not in the file, so none is drawn.
        VAS.AX is not in this replay next to the S&P 500, so no VAS bar is drawn.
      </p>
      <p className="mt-2 text-sm leading-relaxed text-[var(--text-1)]">
        60/40 is 60% SPY and 40% {balanced.bond} ({balanced.bondName}), put back to those weights on the {balanced.rebalance}, after {(balanced.oneWayBps / 100).toFixed(2)}% on each buy and each sell.
        From {balanced.start} to {balanced.end}, one dollar in that mix ended at {balanced.endingValue.toFixed(3)} ({(balanced.cagr * 100).toFixed(1)}% a year, worst fall {(balanced.maxDrawdown * 100).toFixed(1)}%).
        That path is fully invested. It is not the same monthly deposits as the bars. The cash bar is a separate comparison.
      </p>
      {have ? (
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <Bars title="Yearly pace" rows={rows} pick={(row) => row.cagr} scale={cagrScale} />
          <Bars title="Worst fall" rows={rows} pick={(row) => row.maxDrawdown} scale={ddScale} />
        </div>
      ) : (
        <p className="mt-3 text-sm text-[var(--text-3)]">No replay summary is stored in this build.</p>
      )}
    </div>
  );
}
