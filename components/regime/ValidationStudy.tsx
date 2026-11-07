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
            <p className="mt-2 text-sm text-[var(--muted)]">Verdict: {study.verdict}. Portfolio metrics: none. Ran {study.ranAt}.</p>
          </div>
          <ul className="mt-4 space-y-2 text-sm text-[var(--muted)]">
            {study.hypotheses.map((item) => (
              <li key={item.id}><span className="text-white">{item.id} {item.status}.</span> {item.because}</li>
            ))}
          </ul>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[var(--muted)]">{study.preExposure}</p>
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
          After this branch is merged and db/regime/002_paper_decisions.sql is applied, each saved refresh appends one frozen decision and one mark. The log does not rewrite a row. It is not turned on in production by this review.
          Status: {paper.status}. Decisions {paper.decisions}. Marks {paper.marks}.
          {paper.latest?.nav == null
            ? ` Latest mark: ${paper.latest?.navStatus ?? 'none'}${paper.latest?.reason ? `. ${paper.latest.reason}` : ''}`
            : ` Latest AUD unit NAV ${paper.latest.nav.toFixed(4)}.`}
        </p>
      </div>
    </section>
  );
}
