import Link from 'next/link';
import { EmptyState } from '@/components/os/EmptyState';
import { OsShell } from '@/components/os/OsShell';
import { StatStrip } from '@/components/os/StatStrip';
import {
  formatAsOf,
  formatDate,
  hasSignalStatus,
  signalPack,
  stanceBadgeClass,
} from '@/lib/os-data';

export const metadata = {
  title: 'Signal · OS',
  robots: { index: false, follow: false },
};

const IMPLICATION_LABELS: Record<string, string> = {
  hold: 'Hold',
  hold_no_add: 'Hold · no add',
  hold_trim_watch: 'Hold · trim watch',
  trim: 'Trim',
  add_queue: 'Add queue',
  will_not_size: 'Will not size',
};

function senseStanceLabel(stance: string) {
  const s = stance.toUpperCase();
  if (s === 'OW') return 'OW';
  if (s === 'UW') return 'UW';
  if (s === 'N' || s === 'NEUTRAL') return 'N';
  return stance;
}

export default function OsSignalPage() {
  if (!hasSignalStatus(signalPack)) {
    return (
      <OsShell
        pathname="/os/signal"
        eyebrow="Sense"
        title="Signal inbox"
        subtitle="Weekly packs from Sam land here — themes, monitors, and regime notes that feed Decide. Sense never sizes the book."
      >
        <EmptyState
          title="No Signal packs yet"
          description="When the first weekly digest ships, you’ll see pack cards with focus themes, monitor hits, and deep links into Sources. Structure is ready; inbox is empty on purpose."
          waitingOn="Sam Signal"
          skeleton="signal"
        />
      </OsShell>
    );
  }

  const { status, brief, recent_signals } = signalPack;
  const themes = brief.themes ?? [];
  const falsifiers = brief.falsifiers ?? [];
  const implications = brief.paper_book_implications ?? {};
  const signals = [...recent_signals].sort((a, b) => b.date.localeCompare(a.date));
  const asOf = status.as_of || brief.as_of;

  return (
    <OsShell
      pathname="/os/signal"
      eyebrow="Sense"
      title="Signal inbox"
      subtitle="Adopted weekly pack — regime, theme Sense-stances, and recent roster hits. Sense never sizes the book; Act waits on Vera."
    >
      <StatStrip
        stats={[
          {
            label: 'Gate',
            value: status.gate.replace(/^GATE_/, ''),
            hint: status.paper_book_action ?? brief.paper_book_action ?? '—',
          },
          {
            label: 'As of',
            value: formatDate(asOf),
            hint: status.valid_until ? `valid → ${formatDate(status.valid_until)}` : 'Adopted pack',
          },
          {
            label: 'Themes',
            value: String(themes.length),
            hint: 'Sense stance calls',
          },
          {
            label: 'Signals',
            value: String(signals.length),
            hint:
              status.signals_json?.n_records != null
                ? `${status.signals_json.n_records} in corpus`
                : 'Recent roster',
          },
        ]}
      />

      <section className="mb-8 rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
            Regime
          </h2>
          <span className="rounded-full border border-[var(--border)] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
            Sense · not Act
          </span>
        </div>
        <p className="text-sm leading-relaxed text-foreground">{brief.regime_one_liner}</p>
        {status.note ? (
          <p className="mt-3 text-xs leading-relaxed text-[var(--muted)]">{status.note}</p>
        ) : null}
        <p className="mt-3 font-mono text-[11px] text-[var(--muted)]">
          {[status.author_sense ?? brief.author, status.adopted_by ?? brief.adopted_by]
            .filter(Boolean)
            .join(' → ')}
          {brief.adopted_at ? ` · adopted ${formatAsOf(brief.adopted_at)}` : null}
        </p>
        {status.conditions && status.conditions.length > 0 ? (
          <ul className="mt-4 space-y-1.5 border-t border-[var(--border)] pt-4">
            {status.conditions.map((c) => (
              <li key={c} className="flex gap-2 text-xs text-[var(--muted)]">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[var(--muted-foreground)]" />
                <span>{c}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="mb-8">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
              Theme Sense-stances
            </h2>
            <p className="mt-1 text-xs text-[var(--muted)]">
              OW / N / UW are Sense narrative stances — not investable ranks or book weights.
            </p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {themes.map((theme) => (
            <article
              key={theme.name}
              className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-sm font-semibold tracking-tight text-foreground">
                  {theme.name}
                </h3>
                <span
                  className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${stanceBadgeClass(theme.stance)}`}
                  title="Sense stance — not an investable rank"
                >
                  {senseStanceLabel(theme.stance)}
                </span>
              </div>
              <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
                Sense stance
              </p>
              <p className="mt-3 text-[11px] text-[var(--muted)]">
                {theme.citation_count} citation{theme.citation_count === 1 ? '' : 's'}
              </p>
            </article>
          ))}
        </div>
      </section>

      {Object.keys(implications).length > 0 ? (
        <section className="mb-8 overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)]">
          <div className="border-b border-[var(--border)] px-5 py-4">
            <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
              Sense implications
            </h2>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Narrative implications from the adopted pack — not Act orders. Paper book stays{' '}
              {status.paper_book_action ?? brief.paper_book_action ?? 'HOLD'} until Vera signs.
            </p>
          </div>
          <div className="grid gap-0 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(implications).map(([key, items]) =>
              items.length === 0 ? null : (
                <div
                  key={key}
                  className="border-b border-[var(--border)] px-5 py-4 sm:border-r sm:[&:nth-child(2n)]:border-r-0 lg:[&:nth-child(2n)]:border-r lg:[&:nth-child(3n)]:border-r-0"
                >
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
                    {IMPLICATION_LABELS[key] ?? key.replace(/_/g, ' ')}
                  </p>
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {items.map((item) => (
                      <li
                        key={item}
                        className="rounded-full border border-[var(--border)] bg-black/20 px-2 py-0.5 font-mono text-[11px] text-[var(--muted)]"
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ),
            )}
          </div>
        </section>
      ) : null}

      {falsifiers.length > 0 ? (
        <section className="mb-8 rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
            Falsifiers
          </h2>
          <ul className="space-y-2">
            {falsifiers.map((f) => (
              <li key={f} className="flex gap-2 text-sm leading-relaxed text-[var(--muted)]">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--status-warn)]" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mb-8 overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
              Recent signals
            </h2>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Roster hits feeding this pack — open Sources for the citation drawer.
            </p>
          </div>
          <Link
            href="/os/sources"
            className="rounded-full border border-[var(--border)] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[var(--accent-soft)] hover:border-[var(--accent)]/40"
          >
            Sources →
          </Link>
        </div>
        <ul className="divide-y divide-[var(--border)]">
          {signals.slice(0, 12).map((signal) => (
            <li key={`${signal.figure}-${signal.date}-${signal.title}`} className="px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold tracking-tight text-foreground">
                    {signal.url ? (
                      <a
                        href={signal.url}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:text-[var(--accent-soft)] hover:underline"
                      >
                        {signal.title}
                      </a>
                    ) : (
                      signal.title
                    )}
                  </p>
                  <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                    {[signal.figure, signal.org, signal.lane].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <span className="font-mono text-[11px] text-[var(--muted)]">
                  {formatDate(signal.date)}
                </span>
              </div>
              {signal.summary ? (
                <p className="mt-2 text-xs leading-relaxed text-[var(--muted)] line-clamp-3">
                  {signal.summary}
                </p>
              ) : null}
              {signal.calls?.length ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {signal.calls.map((call) => (
                    <span
                      key={`${call.asset}-${call.stance}`}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] ${stanceBadgeClass(call.stance)}`}
                    >
                      <span className="font-medium">{call.asset}</span>
                      <span className="font-bold uppercase tracking-wider opacity-80">
                        {call.stance}
                      </span>
                    </span>
                  ))}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
        {signals.length > 12 ? (
          <div className="border-t border-[var(--border)] px-5 py-3 text-center text-xs text-[var(--muted)]">
            Showing 12 of {signals.length} ·{' '}
            <Link href="/os/sources" className="text-[var(--accent-soft)] hover:underline">
              full citation drawer
            </Link>
          </div>
        ) : null}
      </section>
    </OsShell>
  );
}
