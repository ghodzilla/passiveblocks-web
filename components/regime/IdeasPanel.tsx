import { CORR_WARN, DISPERSION_WINDOW } from '@/lib/regime/correlation';
import { trendWord } from '@/lib/regime/gates';
import type { IdeasReport, IdeaStatus } from '@/lib/regime/ideas';
import { melbourneClock, sessionDateLabel } from '@/lib/regime/time';

function pct(value: number | null, digits = 0): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${(value * 100).toFixed(digits)}%`;
}

function num(value: number | null, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(digits)}`;
}

const STATUS_LABEL: Record<IdeaStatus, string> = {
  confirmed: 'Confirmed',
  watch: 'Watch',
  avoid: 'Avoid',
};

const STATUS_CLASS: Record<IdeaStatus, string> = {
  confirmed: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200',
  watch: 'border-amber-300/40 bg-amber-400/10 text-amber-100',
  avoid: 'border-rose-400/40 bg-rose-500/10 text-rose-100',
};

const STANCE_CLASS = {
  prefer: 'text-emerald-200',
  neutral: 'text-[var(--muted)]',
  avoid: 'text-rose-200',
};

export function IdeasPanel({ ideas, risk }: {
  ideas: IdeasReport;
  risk?: { symbol: string; stop: number | null; qty: number | null; weight: number; note: string; dip: string | null }[];
}) {
  const riskBySymbol = new Map((risk ?? []).map((line) => [line.symbol, line]));
  const fetched = melbourneClock(ideas.pricesFetchedAt);
  const candidates = ideas.rows.filter((row) => row.status !== 'avoid');
  const avoided = ideas.rows.filter((row) => row.status === 'avoid');

  return (
    <section className="mt-10" id="macro-plays">
      <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[var(--accent-soft)]">Macro plays and stock ideas</p>
      <h2 className="text-lg font-bold tracking-tight">Playbook, then quant confirmation</h2>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--muted)]">
        The regime map names liquid US and ASX ETFs an Australian investor can actually trade. Each idea uses one checklist: theme, regime, the 200-day average, 12–1 momentum, stretch, and the drawdown halt. The first failed gate is the sentence under the name. A size is shown only when every gate passes. The volatility target is the fallback only when high and low are missing. Caps stay at {pct(ideas.singlePositionCap)} for an ETF and {pct(ideas.systematicCap)} for a stock.
      </p>

      {ideas.crowding.warning ? (
        <div className="mt-4 rounded-[var(--radius-xl)] border border-amber-300/50 bg-amber-400/15 px-5 py-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-amber-100">Crowding and correlation</p>
          <p className="mt-2 text-base font-semibold leading-relaxed text-white">{ideas.crowding.warning}</p>
        </div>
      ) : (
        <p className="mt-4 text-sm text-[var(--muted)]">
          {ideas.crowding.average == null
            ? ideas.crowding.gap
            : `Average pairwise correlation ${ideas.crowding.average.toFixed(2)} across ${ideas.crowding.names} names. At or below ${CORR_WARN.toFixed(2)}, so suggested weights are not scaled.`}
          {ideas.crowding.dispersion != null ? ` ${DISPERSION_WINDOW}-day dispersion ${(ideas.crowding.dispersion * 100).toFixed(1)}%.` : ''}
        </p>
      )}

      {ideas.overlap.groups.length > 0 ? (
        <div className="mt-4 rounded-[var(--radius-lg)] border border-amber-300/40 bg-black/25 px-4 py-4">
          <h3 className="text-sm font-bold">Overlap</h3>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Confirmed ideas that are the same AI or megacap exposure, or whose correlation is at least 0.80, are capped together at {pct(ideas.overlap.cap)}.
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            {ideas.overlap.groups.map((group) => (
              <li key={group.symbols.join('-')}>
                <span className="font-mono text-xs">{group.symbols.join(' · ')}</span>
                <span className="ml-2 text-[var(--muted)]">
                  combined {pct(group.combinedBefore, 1)} → {pct(group.combinedAfter, 1)}
                </span>
                <p className="text-xs text-[var(--muted)]">{group.reason}</p>
              </li>
            ))}
          </ul>
          {ideas.overlap.gap ? <p className="mt-2 text-xs text-[var(--status-warn)]">{ideas.overlap.gap}</p> : null}
        </div>
      ) : ideas.overlap.gap ? (
        <p className="mt-3 text-xs text-[var(--status-warn)]">{ideas.overlap.gap}</p>
      ) : null}

      {ideas.defensiveOnly ? (
        <div className="mt-4 rounded-[var(--radius-xl)] border border-rose-400/40 bg-rose-500/10 px-5 py-4">
          <p className="text-base font-semibold leading-relaxed text-white">{ideas.banner}</p>
          <p className="mt-2 text-sm text-white/75">
            Candidates are limited to defensive and cash expressions. Equity beta, cyclicals, and the stock watchlist are not sized on this print.
          </p>
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {ideas.playbook.map((row) => (
          <article key={row.id} className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-black/25 px-4 py-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-sm font-bold">{row.label}</h3>
              <p className={`text-[11px] font-bold uppercase tracking-wider ${STANCE_CLASS[row.printStance]}`}>
                This print · {row.printStance}
                {row.printStance !== row.mapStance ? ` · map ${row.mapStance}` : ''}
              </p>
            </div>
            <p className="mt-2 font-mono text-xs text-[var(--muted)]">{row.symbols.join(' · ')}</p>
            <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{row.rationale}</p>
            <p className="mt-2 text-xs text-white/55">{row.drivers}</p>
          </article>
        ))}
      </div>

      {ideas.watchlistNote ? <p className="mt-4 text-sm text-[var(--status-warn)]">{ideas.watchlistNote}</p> : null}

      <div className="mt-6 overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--border)] bg-black/25">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="text-[10px] uppercase tracking-widest text-[var(--muted)]">
            <tr>
              <th className="px-3 py-2 font-bold">Idea</th>
              <th className="px-3 py-2 font-bold">Status</th>
              <th className="px-3 py-2 font-bold">12–1</th>
              <th className="px-3 py-2 font-bold">200d</th>
              <th className="px-3 py-2 font-bold">20d vol</th>
              <th className="px-3 py-2 font-bold">5d z</th>
              <th className="px-3 py-2 font-bold">Max weight</th>
              <th className="px-3 py-2 font-bold">As of (session)</th>
            </tr>
          </thead>
          <tbody>
            {candidates.length === 0 ? (
              <tr className="border-t border-[var(--border)]">
                <td colSpan={8} className="px-3 py-4 text-sm text-[var(--muted)]">No confirmed or watch candidates on this print.</td>
              </tr>
            ) : null}
            {candidates.map((row) => (
              <tr key={row.symbol} className="border-t border-[var(--border)] align-top">
                <td className="px-3 py-3">
                  <p className="font-semibold">{row.symbol} <span className="font-normal text-[var(--muted)]">{row.name}</span></p>
                  <p className="mt-1 text-[11px] uppercase tracking-wider text-white/40">{row.venue} · {row.sleeve}</p>
                  <p className="mt-2 max-w-md text-xs leading-relaxed text-[var(--muted)]">{row.rationale}</p>
                  <p className="mt-1 text-xs text-white/55">{row.drivers}</p>
                  <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">{row.invalidation}</p>
                  {riskBySymbol.get(row.symbol)?.note ? (
                    <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-white/70">{riskBySymbol.get(row.symbol)?.note}</p>
                  ) : null}
                  {riskBySymbol.get(row.symbol)?.dip ? (
                    <p className="mt-2 text-xs font-semibold text-emerald-200">{riskBySymbol.get(row.symbol)?.dip}</p>
                  ) : null}
                </td>
                <td className="px-3 py-3">
                  <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${STATUS_CLASS[row.status]}`}>
                    {STATUS_LABEL[row.status]}
                  </span>
                  {riskBySymbol.get(row.symbol)?.dip ? (
                    <span className="mt-2 inline-block rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-200">
                      Dip
                    </span>
                  ) : null}
                  {row.priceStale ? <p className="mt-2 text-[11px] text-[var(--status-warn)]">Stale price</p> : null}
                </td>
                <td className="px-3 py-3 font-mono text-xs">{pct(row.signals.momentum12_1, 1)}</td>
                <td className="px-3 py-3 font-mono text-xs">{trendWord(row.signals.above200)}</td>
                <td className="px-3 py-3 font-mono text-xs">{pct(row.signals.annVol20, 1)}</td>
                <td className="px-3 py-3 font-mono text-xs">{num(row.signals.reversionZ)}</td>
                <td className="px-3 py-3 font-mono text-xs">
                  {pct(riskBySymbol.get(row.symbol)?.weight ?? row.maxWeight, 1)}
                  {riskBySymbol.get(row.symbol)?.stop != null ? (
                    <p className="mt-1 text-[11px] text-[var(--muted)]">stop {riskBySymbol.get(row.symbol)?.stop?.toFixed(2)} · qty {riskBySymbol.get(row.symbol)?.qty?.toFixed(2) ?? '—'}</p>
                  ) : null}
                </td>
                <td className="px-3 py-3 font-mono text-xs">{sessionDateLabel(row.signals.asOf)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {avoided.length > 0 ? (
        <div className="mt-4">
          <h3 className="text-sm font-bold">Avoid on this print</h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {avoided.map((row) => (
              <li key={row.symbol} className="rounded-full border border-rose-400/30 px-2.5 py-1 text-[11px] text-rose-100">
                {row.symbol}
                <span className="ml-1 text-white/45">{row.signals.asOf ?? 'no price'}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-6">
        <h3 className="text-sm font-bold">Signal health</h3>
        <p className="mt-1 max-w-3xl text-sm text-[var(--muted)]">
          Cross-sectional information coefficient and hit rate, sampled every 5th date, keeping up to 120 samples of a 20-day forward return. Fewer than 40 samples stays unknown and the default gates remain. A retired signal drops out of the blend and stops being a confirmation gate. If both 12–1 momentum and the 200-day trend are retired, nothing new is confirmed.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="text-[10px] uppercase tracking-widest text-[var(--muted)]">
              <tr>
                <th className="py-2 pr-3 font-bold">Signal</th>
                <th className="py-2 pr-3 font-bold">IC</th>
                <th className="py-2 pr-3 font-bold">Hit rate</th>
                <th className="py-2 pr-3 font-bold">Samples</th>
                <th className="py-2 font-bold">Health</th>
              </tr>
            </thead>
            <tbody className="font-mono text-xs">
              {ideas.signalHealth.map((signal) => (
                <tr key={signal.id} className="border-t border-[var(--border)]">
                  <td className="py-2 pr-3 font-sans">{signal.label}</td>
                  <td className="py-2 pr-3">{num(signal.ic, 2)}</td>
                  <td className="py-2 pr-3">{signal.hitRate == null ? '—' : pct(signal.hitRate, 0)}</td>
                  <td className="py-2 pr-3">{signal.samples}</td>
                  <td className={`py-2 font-sans text-[11px] font-bold uppercase tracking-wider ${signal.status === 'retired' ? 'text-rose-200' : signal.status === 'degraded' ? 'text-amber-100' : signal.status === 'healthy' ? 'text-emerald-200' : 'text-[var(--muted)]'}`}>
                    {signal.status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {ideas.gaps.length > 0 ? (
        <ul className="mt-4 space-y-1 text-sm text-[var(--status-warn)]">
          {ideas.gaps.map((gap) => (
            <li key={gap}>{gap}</li>
          ))}
        </ul>
      ) : null}

      <p className="mt-4 text-xs leading-relaxed text-[var(--muted)]">
        Prices are adjusted daily closes from the Yahoo chart endpoint, which does not need a paid key. {ideas.pricesFetchedAt ? `Book fetched ${fetched} Australia/Melbourne.` : 'The price book has not been fetched.'} The date on each row is that name&apos;s exchange session, not a Melbourne clock. A missing bar is left blank. No price is filled in.
      </p>
      <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">
        Educational research for the owner. Not financial advice, not a recommendation to buy or sell any security, and not a personalised instruction to size a position. Confirmed means this playbook and these simple signals agree. It is not a forecast.
      </p>
    </section>
  );
}
