import type { PaperMarkPayload } from '@/lib/regime/paperLog';

interface StudyRow {
  id: string;
  role: string;
  url: string;
  availability: string;
  httpStatus: number | null;
  bytes: number;
  sha256: string | null;
  note: string;
}

interface StudyFile {
  ranAt: string;
  command: string;
  fullStrategy: string;
  verdict: string;
  reason: string;
  hypotheses: { id: string; status: string; because: string }[];
  preExposure: string;
  metrics: null;
  omitted: string[];
  blocking?: string;
  survivorship?: string;
  credit?: {
    observationCount: number;
    firstObservation: string | null;
    lastObservation: string | null;
    firstCreditZObservation: string | null;
    firstFullWindowObservation: string | null;
    creditZObservationCount: number;
    fullWindowObservationCount: number;
    earliestDecisionDate: string | null;
    latestDecisionDate: string | null;
    completedReplayDates: number;
    rule: string;
    constraint: string;
    failClosed: string;
  };
  cftc?: { publication: string };
  paperLog?: { state: string; activated: boolean; operationalPaperNav: boolean; captures: string; limits: string; activation: string };
  rows: StudyRow[];
}

interface PathSummary {
  start: string;
  end: string;
  cagr: number | null;
  maxDrawdown: number | null;
  sharpe: number | null;
  averageGross: number;
  timeInMarket: number;
  turnover: number;
  trades: number;
  unitNavEnd: number;
  firstHalfCagr: number | null;
  secondHalfCagr: number | null;
  firstHalfDrawdown: number | null;
  secondHalfDrawdown: number | null;
  returnPerDrawdown: number | null;
  dayBasis: string;
}

export interface ReplayView {
  ranAt: string;
  command: string;
  reason: string;
  restricted: string[];
  taxes: string;
  currency: string;
  costBps: number;
  cashYieldBps: number;
  clock: string;
  coverage: {
    weekdayDecisions: number;
    spySessions: number;
    replayedSessions: number;
    droppedNoLaterAsxSession: string[];
    holidaysSkipped: string[];
    creditBelow252: string[];
    creditShortOf756: number;
    firstFullCreditWindow: string | null;
  };
  audit: { date: string; vintage: string; hyCount: number; hyLast: string | null; dgs2: number }[];
  production: {
    failClosedDays: number;
    failClosedDates: string[];
    regimeCounts: Record<string, number>;
    omissionsSample: string[];
    exposureByAction?: Record<string, { days: number; averageGross: number }>;
    summary: PathSummary | null;
  };
  priceOnlyDiagnostic: { label: string; summary: PathSummary | null };
  staticSixtyForty: { label: string; summary: PathSummary | null };
  spySameContributions: { label: string; summary: PathSummary | null };
  spyLumpSum?: { label: string; funding: string; summary: PathSummary | null };
  hypotheses: {
    h1: string;
    h2: string;
    because: string;
    timeInMarket: { production: number | null; priceOnly: number | null };
  } | null;
  metricsNote: string;
}

function pct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${(value * 100).toFixed(1)}%`;
}

function PathRow({ label, summary }: { label: string; summary: PathSummary | null }) {
  if (!summary) return <p className="mt-2 text-sm text-[var(--muted)]">{label}: no completed path.</p>;
  return (
    <div className="mt-3 border-t border-white/10 pt-3">
      <p className="text-sm font-bold text-white">{label}</p>
      <p className="mt-1 text-sm text-[var(--muted)]">
        {summary.start} to {summary.end}. Unit NAV {summary.unitNavEnd.toFixed(3)}. CAGR {pct(summary.cagr)}. Max drawdown {pct(summary.maxDrawdown)}. Return per unit of drawdown {summary.returnPerDrawdown == null ? '—' : summary.returnPerDrawdown.toFixed(2)}. Sharpe {summary.sharpe == null ? '—' : summary.sharpe.toFixed(2)} with a risk-free rate of 0. Average gross {pct(summary.averageGross)}. Days invested {pct(summary.timeInMarket)}. Turnover {summary.turnover.toFixed(2)}. Trade days {summary.trades}.
      </p>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Earlier half CAGR {pct(summary.firstHalfCagr)}, drawdown {pct(summary.firstHalfDrawdown)}. Later half CAGR {pct(summary.secondHalfCagr)}, drawdown {pct(summary.secondHalfDrawdown)}.
      </p>
    </div>
  );
}

function ReplayResult({ replay }: { replay: ReplayView }) {
  const coverage = replay.coverage;
  return (
    <div className="mt-4 rounded-[var(--radius-xl)] border border-white/10 px-5 py-4">
      <h3 className="text-sm font-bold text-white">Point-in-time replay</h3>
      <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{replay.reason}</p>
      <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
        {coverage.weekdayDecisions} weekdays, {coverage.spySessions} SPY sessions, {coverage.replayedSessions} replayed. Holidays skipped: {coverage.holidaysSkipped.length}. Last session dropped because the file has no later ASX bar: {coverage.droppedNoLaterAsxSession.join(', ') || 'none'}. Credit below 252 observations: {coverage.creditBelow252.join(', ')}. Sessions with a credit z-score but short of 756 observations: {coverage.creditShortOf756}. First full credit window: {coverage.firstFullCreditWindow}. Fail-closed dates: {replay.production.failClosedDates.join(', ')}.
      </p>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Regime days: {Object.entries(replay.production.regimeCounts).map(([name, count]) => `${name} ${count}`).join(', ')}.
      </p>
      {replay.hypotheses ? (
        <p className="mt-2 text-sm leading-relaxed text-white">
          H1 {replay.hypotheses.h1}. H2 {replay.hypotheses.h2}. {replay.hypotheses.because} Time in market: production {pct(replay.hypotheses.timeInMarket.production)}, price-only diagnostic {pct(replay.hypotheses.timeInMarket.priceOnly)}.
        </p>
      ) : null}
      <PathRow label="Production rule, AUD paper book" summary={replay.production.summary} />
      <PathRow label="Price-only diagnostic" summary={replay.priceOnlyDiagnostic.summary} />
      <PathRow label="60% SPY / 40% cash, same contributions" summary={replay.staticSixtyForty.summary} />
      <PathRow label="SPY, same contributions" summary={replay.spySameContributions.summary} />
      {replay.spyLumpSum ? <PathRow label="SPY buy and hold, one unit and no later contribution" summary={replay.spyLumpSum.summary} /> : null}
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[var(--muted)]">
        {replay.restricted.map((note) => <li key={note}>{note}</li>)}
      </ul>
      <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">{replay.metricsNote} {replay.production.summary?.dayBasis} Cost {replay.costBps} bps. Cash yield {replay.cashYieldBps} bps. Taxes {replay.taxes}. {replay.currency}. {replay.clock}</p>
      <p className="mt-2 text-xs text-[var(--muted)]">Ran {replay.ranAt}. Command: {replay.command}.</p>
    </div>
  );
}

export function ValidationStudy({
  study,
  replay,
  paper,
}: {
  study: StudyFile | null;
  replay: ReplayView | null;
  paper: { status: string; decisions: number; marks: number; latest: PaperMarkPayload | null };
}) {
  return (
    <section className="mt-10" id="validation">
      <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[var(--accent-soft)]">Validation</p>
      <h2 className="text-lg font-bold tracking-tight">Has the rule been tested?</h2>
      {study ? (
        <>
          <div className="mt-4 rounded-[var(--radius-xl)] border border-amber-300/40 bg-amber-400/10 px-5 py-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-100">Full strategy: {study.fullStrategy.replaceAll('_', ' ')}</p>
            <p className="mt-2 text-sm leading-relaxed text-white">{study.reason}</p>
            <p className="mt-2 text-sm text-[var(--muted)]">
              This block is the earlier public-file availability study. Verdict: {study.verdict}. Completed replays in that study: {study.credit?.completedReplayDates ?? 0}. Portfolio metrics in that file: none. Ran {study.ranAt}.
            </p>
            {study.blocking ? <p className="mt-2 text-sm leading-relaxed text-white">{study.blocking}</p> : null}
          </div>
          {study.credit ? (
            <div className="mt-4 rounded-[var(--radius-lg)] border border-white/10 px-4 py-4 text-sm leading-relaxed text-[var(--muted)]">
              <h3 className="text-sm font-bold text-white">Credit window on the tested free FRED file</h3>
              <p className="mt-2">{study.credit.rule}</p>
              <p className="mt-2">{study.credit.constraint}</p>
              <p className="mt-2">
                {study.credit.observationCount} observations from {study.credit.firstObservation} to {study.credit.lastObservation}.
                First credit z-score observation: {study.credit.firstCreditZObservation}. Full 756-observation window from {study.credit.firstFullWindowObservation}
                {' '}({study.credit.fullWindowObservationCount} observations). Observations with a z-score: {study.credit.creditZObservationCount}.
                Earliest decision under a previous-day vintage: {study.credit.earliestDecisionDate}. Latest: {study.credit.latestDecisionDate}.
                Completed replays: {study.credit.completedReplayDates}.
              </p>
              <p className="mt-2">{study.credit.failClosed}</p>
            </div>
          ) : null}
          <ul className="mt-4 space-y-2 text-sm text-[var(--muted)]">
            {study.hypotheses.map((item) => (
              <li key={item.id}><span className="text-white">{item.id} {item.status}.</span> {item.because}</li>
            ))}
          </ul>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[var(--muted)]">{study.preExposure}</p>
          {study.survivorship ? <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--muted)]">{study.survivorship}</p> : null}
          {study.cftc ? <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--muted)]">{study.cftc.publication}</p> : null}
          <div className="mt-4 overflow-x-auto rounded-[var(--radius-xl)] border border-white/10">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-white/[0.03] text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-3">Input</th>
                  <th className="px-4 py-3">Availability</th>
                  <th className="px-4 py-3">Bytes</th>
                  <th className="px-4 py-3">What came back</th>
                </tr>
              </thead>
              <tbody>
                {study.rows.map((row) => (
                  <tr key={row.id} className="border-t border-white/10">
                    <td className="px-4 py-3 text-white">
                      {row.id}
                      <p className="text-[11px] font-normal text-[var(--muted)]">{row.role}</p>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{row.availability}</td>
                    <td className="px-4 py-3 font-mono text-xs">{row.bytes}</td>
                    <td className="px-4 py-3 text-xs text-[var(--muted)]">{row.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 max-w-3xl text-xs leading-relaxed text-[var(--muted)]">
            Command: {study.command}. Checksums are in research/regime-validation/manifest.json. Omitted: {study.omitted.join(' ')}
          </p>
        </>
      ) : (
        <p className="mt-4 text-sm text-[var(--muted)]">The validation artifact is not in this build.</p>
      )}
      {replay ? <ReplayResult replay={replay} /> : (
        <p className="mt-4 text-sm text-[var(--muted)]">The point-in-time replay file is not in this build.</p>
      )}
      <div className="mt-4 rounded-[var(--radius-lg)] border border-white/10 px-4 py-4">
        <h3 className="text-sm font-bold">Prospective paper log</h3>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
          {study?.paperLog
            ? `${study.paperLog.captures} ${study.paperLog.limits} ${study.paperLog.activation}`
            : 'The paper log is ledger code. It is not applied, and it is not a historical backtest.'}
          {' '}Database status: {paper.status}. Decisions {paper.decisions}. Marks {paper.marks}.
          {paper.latest?.nav == null
            ? ` Latest mark: ${paper.latest?.navStatus ?? 'none'}${paper.latest?.reason ? `. ${paper.latest.reason}` : ''}`
            : ` Latest AUD unit NAV ${paper.latest.nav.toFixed(4)}.`}
        </p>
      </div>
    </section>
  );
}
