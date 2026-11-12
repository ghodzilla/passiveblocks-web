import { CORR_WARN } from '@/lib/regime/correlation';
import { signalHealthSentence } from '@/lib/regime/health';
import { trendWord, type GateCheck } from '@/lib/regime/gates';
import type { IdeasReport, IdeaStatus } from '@/lib/regime/ideas';
import { checklistLines, plainDrivers, stanceWords } from '@/lib/regime/plain';
import { sydneyClock, sessionDateLabel } from '@/lib/regime/time';
import { Chip, type ChipTone } from './ui/Chip';

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
  confirmed: 'Buy',
  hold: 'Hold',
  watch: 'Watch',
  avoid: 'Avoid',
};

const STATUS_TONE: Record<IdeaStatus, ChipTone> = {
  confirmed: 'buy',
  hold: 'hold',
  watch: 'watch',
  avoid: 'off',
};

const HEALTH_WORD = {
  healthy: 'Holding up lately',
  degraded: 'Weak lately',
  retired: 'Turned off',
  unknown: 'Not enough evidence',
} as const;

function spikeText(z: number | null): string {
  if (z == null || !Number.isFinite(z)) return '—';
  const shown = `${z > 0 ? '+' : ''}${z.toFixed(1)}`;
  return Math.abs(z) >= 1.5 ? `${shown} · spike (blocks buy)` : `${shown} · normal`;
}

function holdText(weight: number | undefined, bookAud: number | null): string {
  if (weight == null || !(weight > 0)) return '—';
  const share = `${(weight * 100).toFixed(1)}%`;
  if (bookAud == null) return share;
  return `A$${Math.round(weight * bookAud).toLocaleString('en-AU')} · ${share}`;
}

function stopText(symbol: string, stop: number | null, qty: number | null, last: number | null): string | null {
  if (stop == null) return null;
  const currency = symbol.endsWith('.AX') ? 'A$' : 'US$';
  const below = last != null && last > 0 ? ` (${(((last - stop) / last) * 100).toFixed(1)}% below)` : '';
  const units = qty == null ? '' : ` · ${qty.toFixed(1)} units`;
  return `Sell-stop ${currency}${stop.toFixed(2)}${below}${units}`;
}

export function IdeasPanel({
  ideas,
  risk,
  auditNote = null,
  held = {},
  bookAud = null,
}: {
  ideas: IdeasReport;
  risk: { symbol: string; stop: number | null; qty: number | null; weight: number; verdict: string; gates: GateCheck[]; dip: string | null }[];
  auditNote?: string | null;
  held?: Record<string, number>;
  bookAud?: number | null;
}) {
  const riskBySymbol = new Map(risk.map((line) => [line.symbol, line]));
  const fetched = ideas.pricesFetchedAt ? sydneyClock(ideas.pricesFetchedAt) : null;
  const candidates = ideas.rows.filter((row) => row.status !== 'avoid');
  const avoided = ideas.rows.filter((row) => row.status === 'avoid');

  return (
    <section className="mt-2" id="macro-plays">
      <p className="max-w-3xl text-[15px] leading-relaxed text-[var(--text-2)]">
        One fund is capped at {pct(ideas.singlePositionCap)} of the book and one stock at {pct(ideas.systematicCap)}.
      </p>
      {auditNote ? <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--text-2)]">{auditNote}</p> : null}

      {ideas.crowding.warning ? (
        <div className="mt-4 rounded-[var(--radius-xl)] border border-amber-300/50 bg-amber-400/15 px-5 py-4">
          <p className="text-xs font-semibold text-[var(--call-watch)]">These holdings are moving together</p>
          <p className="mt-2 text-base font-semibold leading-relaxed text-[var(--text-1)]">{ideas.crowding.warning}</p>
        </div>
      ) : (
        <p className="mt-4 text-sm text-[var(--text-2)]">
          {ideas.crowding.average == null
            ? ideas.crowding.gap
            : `Holdings aren't moving in lockstep (${ideas.crowding.average.toFixed(2)}; sizes shrink above ${CORR_WARN.toFixed(2)}).`}
        </p>
      )}

      {ideas.overlap.groups.length > 0 ? (
        <div className="mt-4 rounded-[var(--radius-lg)] border border-amber-300/40 bg-[var(--surface-1)] px-4 py-4">
          <h3 className="text-sm font-bold text-[var(--text-1)]">The same bet, counted twice</h3>
          <p className="mt-1 text-sm text-[var(--text-2)]">
            These are really the same bet, so together they are capped at {pct(ideas.overlap.cap)} of the book.
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            {ideas.overlap.groups.map((group) => (
              <li key={group.symbols.join('-')}>
                <span className="font-mono text-xs text-[var(--text-2)]">{group.symbols.join(' · ')}</span>
                <span className="ml-2 text-[var(--text-3)]">
                  combined {pct(group.combinedBefore, 1)} → {pct(group.combinedAfter, 1)}
                </span>
                <p className="text-xs text-[var(--text-3)]">{group.reason}</p>
              </li>
            ))}
          </ul>
          {ideas.overlap.gap ? <p className="mt-2 text-xs text-[var(--call-watch)]">{ideas.overlap.gap}</p> : null}
        </div>
      ) : ideas.overlap.gap ? (
        <p className="mt-3 text-xs text-[var(--call-watch)]">{ideas.overlap.gap}</p>
      ) : null}

      {ideas.defensiveOnly ? (
        <div className="mt-4 rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface-1)] px-5 py-4">
          <p className="text-base font-semibold leading-relaxed text-[var(--text-1)]">On a sit-tight day this list keeps defensive holdings and cash. New share, crypto, and theme buys stay at 0%.</p>
          <p className="mt-2 text-sm text-[var(--text-2)]">Crypto and silver are listed under Themes.</p>
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {ideas.playbook.map((row) => (
          <article key={row.id} className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-1)] px-4 py-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-sm font-bold text-[var(--text-1)]">{row.label}</h3>
              <p className="text-xs font-semibold text-[var(--text-2)]" title="Today is the lean after the sit-tight rule. The usual lean is the written map for this regime, before that rule.">
                {stanceWords(row.printStance, row.mapStance).today}
                {stanceWords(row.printStance, row.mapStance).usual ? ` · ${stanceWords(row.printStance, row.mapStance).usual}` : ''}
              </p>
            </div>
            <p className="mt-2 font-mono text-xs text-[var(--text-3)]">{row.symbols.join(' · ')}</p>
            <p className="mt-2 text-sm leading-relaxed text-[var(--text-2)]">{row.rationale}</p>
            <p className="mt-2 text-xs text-[var(--text-3)]">{plainDrivers(row.drivers)}</p>
          </article>
        ))}
      </div>

      {ideas.watchlistNote ? <p className="mt-4 text-sm text-[var(--call-watch)]">{ideas.watchlistNote}</p> : null}

      <div className="mt-6 grid gap-3 md:hidden">
        {candidates.map((row) => {
          const line = riskBySymbol.get(row.symbol);
          const stop = stopText(row.symbol, line?.stop ?? null, line?.qty ?? null, row.signals.lastClose);
          return (
            <article key={row.symbol} className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-1)] px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <p className="font-semibold text-[var(--text-1)]">{row.name} <span className="font-mono text-xs font-normal text-[var(--text-3)]">{row.symbol}</span></p>
                <Chip tone={STATUS_TONE[row.status]}>{STATUS_LABEL[row.status]}</Chip>
              </div>
              <p className="mt-2 text-sm text-[var(--text-2)]">You hold {holdText(held[row.symbol], bookAud)}</p>
              {stop ? <p className="mt-1 text-xs text-[var(--text-3)]">{stop}</p> : null}
              {line?.verdict ? <p className="mt-2 text-sm leading-relaxed text-[var(--text-2)]">{line.verdict}</p> : null}
              {line?.dip ? <p className="mt-2 text-sm font-semibold text-[var(--text-1)]">{line.dip}</p> : null}
            </article>
          );
        })}
      </div>

      <div className="mt-6 hidden overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-1)] md:block">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="text-xs text-[var(--text-3)]">
            <tr>
              <th className="px-3 py-2 font-semibold">Name</th>
              <th className="px-3 py-2 font-semibold" title="The gain from 12 months ago to 1 month ago, skipping the last month.">Past year</th>
              <th className="px-3 py-2 font-semibold" title="Whether the last price is above its 200-day average.">Long-term trend</th>
              <th className="px-3 py-2 font-semibold" title="Typical yearly up-and-down, from the last month.">How jumpy</th>
              <th className="px-3 py-2 font-semibold" title="How unusual the last 5 sessions are. Above 1.5 blocks a buy.">Recent spike</th>
              <th className="px-3 py-2 font-semibold">You hold</th>
              <th className="px-3 py-2 font-semibold">Today</th>
              <th className="px-3 py-2 font-semibold" title="The exchange session date.">Price date</th>
            </tr>
          </thead>
          <tbody>
            {candidates.length === 0 ? (
              <tr className="border-t border-[var(--border)]">
                <td colSpan={8} className="px-3 py-4 text-sm text-[var(--text-2)]">Nothing to buy or watch in this table today.</td>
              </tr>
            ) : null}
            {candidates.map((row) => {
              const line = riskBySymbol.get(row.symbol);
              const stop = stopText(row.symbol, line?.stop ?? null, line?.qty ?? null, row.signals.lastClose);
              return (
                <tr key={row.symbol} className="border-t border-[var(--border)] align-top">
                  <td className="px-3 py-3">
                    <p className="font-semibold text-[var(--text-1)]">{row.symbol} <span className="font-normal text-[var(--text-3)]">{row.name}</span></p>
                    <p className="mt-1 text-xs text-[var(--text-3)]">{row.venue} · {row.sleeve}</p>
                    <p className="mt-2 max-w-md text-xs leading-relaxed text-[var(--text-2)]">{row.rationale}</p>
                    <p className="mt-1 text-xs text-[var(--text-3)]" title="Each number is a score versus that series’ own history. Negative is tighter or less supportive.">{plainDrivers(row.drivers)}</p>
                    <p className="mt-2 text-xs leading-relaxed text-[var(--text-2)]">{row.invalidation}</p>
                    {line?.verdict ? <p className="mt-2 text-xs leading-relaxed text-[var(--text-1)]">{line.verdict}</p> : null}
                    {line?.gates?.length ? (
                      <details className="mt-1">
                        <summary className="min-h-11 cursor-pointer text-xs text-[var(--call-hold)]">Why?</summary>
                        <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-[var(--text-2)]">{checklistLines(line.gates)}</p>
                      </details>
                    ) : null}
                    {line?.dip ? <p className="mt-2 text-xs font-semibold text-[var(--text-1)]">{line.dip}</p> : null}
                  </td>
                  <td className="px-3 py-3 font-mono text-xs text-[var(--text-2)]">{pct(row.signals.momentum12_1, 1)}</td>
                  <td className="px-3 py-3 font-mono text-xs text-[var(--text-2)]">{trendWord(row.signals.above200)}</td>
                  <td className="px-3 py-3 font-mono text-xs text-[var(--text-2)]">{pct(row.signals.annVol20, 1)}</td>
                  <td className="px-3 py-3 font-mono text-xs text-[var(--text-2)]">{spikeText(row.signals.reversionZ)}</td>
                  <td className="px-3 py-3 font-mono text-xs text-[var(--text-2)]">{holdText(held[row.symbol], bookAud)}</td>
                  <td className="px-3 py-3">
                    <Chip tone={STATUS_TONE[row.status]}>{STATUS_LABEL[row.status]}</Chip>
                    {row.status === 'confirmed' ? <p className="mt-2 font-mono text-xs text-[var(--text-2)]">{pct(line?.weight ?? row.maxWeight, 1)}</p> : null}
                    {stop ? <p className="mt-1 text-xs text-[var(--text-3)]">{stop}</p> : null}
                    {row.priceStale ? <p className="mt-2 text-xs text-[var(--call-watch)]">Stale price</p> : null}
                  </td>
                  <td className="px-3 py-3 font-mono text-xs text-[var(--text-2)]">{sessionDateLabel(row.signals.asOf)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {avoided.length > 0 ? (
        <div className="mt-4">
          <h3 className="text-sm font-bold text-[var(--text-1)]">Avoid today</h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {avoided.map((row) => (
              <li key={row.symbol}>
                <Chip tone="off">{`${row.symbol} · ${row.name}`}</Chip>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-6">
        <h3 className="text-sm font-bold text-[var(--text-1)]">Are the checks still useful?</h3>
        <p className="mt-1 max-w-3xl text-sm text-[var(--text-2)]">
          Each check is graded against what prices did next. Turned-off checks are ignored. Weak ones count half.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="text-xs text-[var(--text-3)]">
              <tr>
                <th className="py-2 pr-3 font-semibold">Check</th>
                <th className="py-2 pr-3 font-semibold" title="−1 to +1; above 0 means it pointed the right way.">Accuracy score</th>
                <th className="py-2 pr-3 font-semibold" title="Share of samples where the check pointed the right way.">Right %</th>
                <th className="py-2 pr-3 font-semibold">Samples</th>
                <th className="py-2 font-semibold">Health</th>
              </tr>
            </thead>
            <tbody className="font-mono text-xs">
              {ideas.signalHealth.map((signal) => (
                <tr key={signal.id} className="border-t border-[var(--border)]">
                  <td className="py-2 pr-3 font-sans text-[var(--text-1)]">{signal.label}</td>
                  <td className="py-2 pr-3 text-[var(--text-2)]">{num(signal.ic, 2)}</td>
                  <td className="py-2 pr-3 text-[var(--text-2)]">{signal.hitRate == null ? '—' : pct(signal.hitRate, 0)}</td>
                  <td className="py-2 pr-3 text-[var(--text-2)]">{signal.samples}</td>
                  <td className="py-2 font-sans text-xs font-semibold text-[var(--text-2)]">
                    {HEALTH_WORD[signal.status]}
                    <p className="mt-1 font-normal text-[var(--text-3)]">{signalHealthSentence(signal)}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {ideas.gaps.length > 0 ? (
        <ul className="mt-4 space-y-1 text-sm text-[var(--call-watch)]">
          {ideas.gaps.map((gap) => (
            <li key={gap}>{gap}</li>
          ))}
        </ul>
      ) : null}

      <p className="mt-4 text-xs leading-relaxed text-[var(--text-3)]">
        Prices: Yahoo Finance daily closes (dividends included){fetched ? `, downloaded ${fetched}` : ''}. A missing price is left blank.
      </p>
    </section>
  );
}
