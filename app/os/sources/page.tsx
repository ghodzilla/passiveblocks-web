import { EmptyState } from '@/components/os/EmptyState';
import { OsShell } from '@/components/os/OsShell';
import { StatStrip } from '@/components/os/StatStrip';
import {
  formatDate,
  hasSignalStatus,
  parseBriefCitation,
  signalPack,
  stanceBadgeClass,
} from '@/lib/os-data';

export const metadata = {
  title: 'Sources · OS',
  robots: { index: false, follow: false },
};

type FigureBucket = {
  figure: string;
  org?: string;
  lanes: string[];
  urls: { title: string; url: string; date: string }[];
  themes: string[];
  signalCount: number;
};

export default function OsSourcesPage() {
  if (!hasSignalStatus(signalPack)) {
    return (
      <OsShell
        pathname="/os/sources"
        eyebrow="Truth"
        title="Sources"
        subtitle="Citation drawer for every investable claim. Sense ≠ Decide — unsigned or insufficient evidence never becomes a live score."
      >
        <EmptyState
          title="Citation drawer standing by"
          description="Rows will list transcript packs, theme notes, and monitor hits behind each Vera-signed line — or flag INSUFFICIENT_EVIDENCE. Nothing to cite until Signal packs and ledger links arrive."
          waitingOn="Sense corpus"
          skeleton="sources"
        />
      </OsShell>
    );
  }

  const { brief, recent_signals } = signalPack;
  const themes = brief.themes ?? [];
  const signals = [...recent_signals].sort((a, b) => b.date.localeCompare(a.date));

  const byFigure = new Map<string, FigureBucket>();
  for (const signal of signals) {
    const key = signal.figure;
    const existing = byFigure.get(key) ?? {
      figure: signal.figure,
      org: signal.org,
      lanes: [],
      urls: [],
      themes: [],
      signalCount: 0,
    };
    existing.signalCount += 1;
    if (signal.org && !existing.org) existing.org = signal.org;
    if (signal.lane && !existing.lanes.includes(signal.lane)) existing.lanes.push(signal.lane);
    if (signal.url) {
      existing.urls.push({ title: signal.title, url: signal.url, date: signal.date });
    }
    for (const theme of signal.themes ?? []) {
      if (!existing.themes.includes(theme)) existing.themes.push(theme);
    }
    byFigure.set(key, existing);
  }

  const figures = Array.from(byFigure.values()).sort((a, b) => b.signalCount - a.signalCount);
  const briefCitations = themes.flatMap((theme) =>
    (theme.citations ?? []).map((raw) => ({
      theme: theme.name,
      stance: theme.stance,
      citation: parseBriefCitation(raw),
    })),
  );
  const urlCount = signals.filter((s) => Boolean(s.url)).length;

  return (
    <OsShell
      pathname="/os/sources"
      eyebrow="Truth"
      title="Sources"
      subtitle="Citation drawer derived from the live Sense pack — figures, URLs, themes, and brief citations. Sense ≠ Decide; this drawer does not size the book."
    >
      <StatStrip
        stats={[
          {
            label: 'Figures',
            value: String(figures.length),
            hint: 'Roster in recent pack',
          },
          {
            label: 'URLs',
            value: String(urlCount),
            hint: 'Linked transcripts / talks',
          },
          {
            label: 'Themes',
            value: String(themes.length),
            hint: 'Brief theme calls',
          },
          {
            label: 'Citations',
            value: String(briefCitations.length),
            hint: 'Brief pipe refs',
          },
        ]}
      />

      <section className="mb-8 overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)]">
        <div className="border-b border-[var(--border)] px-5 py-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
            Figures · recent signals
          </h2>
        </div>
        <ul className="divide-y divide-[var(--border)]">
          {figures.map((fig) => (
            <li key={fig.figure} className="px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold tracking-tight text-foreground">{fig.figure}</p>
                  <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                    {[fig.org, fig.lanes.join(' · ')].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                  {fig.signalCount} signal{fig.signalCount === 1 ? '' : 's'}
                </span>
              </div>

              {fig.urls.length > 0 ? (
                <ul className="mt-3 space-y-1.5">
                  {fig.urls.map((item) => (
                    <li key={item.url} className="flex flex-wrap items-baseline gap-2 text-sm">
                      <span className="font-mono text-[11px] text-[var(--muted)]">
                        {formatDate(item.date)}
                      </span>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[var(--accent-soft)] hover:underline"
                      >
                        {item.title}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}

              {fig.themes.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {fig.themes.map((theme) => (
                    <span
                      key={theme}
                      className="rounded-full border border-[var(--border)] bg-black/20 px-2 py-0.5 text-[10px] text-[var(--muted)]"
                    >
                      {theme}
                    </span>
                  ))}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      {briefCitations.length > 0 ? (
        <section className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)]">
          <div className="border-b border-[var(--border)] px-5 py-4">
            <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
              Brief citations
            </h2>
            <p className="mt-1 text-xs text-[var(--muted)]">
              From Sense theme calls in the adopted pack — provenance only.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-[var(--border)] bg-black/20 text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
                <tr>
                  <th className="px-4 py-3 font-bold">Theme</th>
                  <th className="px-4 py-3 font-bold">Stance</th>
                  <th className="px-4 py-3 font-bold">Figure</th>
                  <th className="px-4 py-3 font-bold">Title / ref</th>
                  <th className="px-4 py-3 font-bold">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {briefCitations.map(({ theme, stance, citation }, idx) => (
                  <tr key={`${theme}-${citation.raw}-${idx}`} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3.5 text-[var(--muted)]">{theme}</td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${stanceBadgeClass(stance)}`}
                      >
                        {stance}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-medium">
                      {citation.figure ?? '—'}
                    </td>
                    <td className="max-w-md px-4 py-3.5">
                      {citation.url ? (
                        <a
                          href={citation.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[var(--accent-soft)] hover:underline"
                        >
                          {citation.title ?? citation.url}
                        </a>
                      ) : (
                        <span className="text-[var(--muted)]">
                          {citation.title ?? citation.raw}
                        </span>
                      )}
                      {citation.source ? (
                        <p className="mt-1 font-mono text-[10px] text-[var(--muted-foreground)]">
                          {citation.source}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs text-[var(--muted)]">
                      {citation.date ? formatDate(citation.date) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </OsShell>
  );
}
