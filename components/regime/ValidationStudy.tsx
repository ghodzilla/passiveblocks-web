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

export function ValidationStudy({
  study,
  paper,
}: {
  study: StudyFile | null;
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
            <p className="mt-2 text-sm text-[var(--muted)]">Verdict: {study.verdict}. Completed replay dates: 0. Portfolio metrics: none. Ran {study.ranAt}.</p>
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
