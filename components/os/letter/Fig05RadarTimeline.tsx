/**
 * FIG-05 · Optional radar timeline — dated watches only, no invented events.
 */
const WATCHES = [
  { date: '2026-09-29', note: 'Brief refresh / valid_until' },
  { date: 'Howell #4', note: 'Live unrebutted · GLI INSUFFICIENT' },
  { date: 'Copper N', note: 'Do-not-add · COPPER paper HOLD' },
  { date: 'Tom Lee 2026-09-01', note: 'PARTIAL (~19 lines) · gate condition' },
  { date: 'Card freshness', note: 'Last tape 2026-09-09 · later prints INSUFFICIENT' },
] as const;

export function Fig05RadarTimeline() {
  return (
    <figure
      id="fig-05-radar-timeline"
      aria-label="Timeline of dated watches including 29 Sep brief refresh, unrebutted Howell falsifier 4, copper neutral watch, and Tom Lee partial extract."
      className="overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)]"
    >
      <figcaption className="border-b border-[var(--border)] px-5 py-4 sm:px-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
          FIG-05 · Radar
        </p>
        <h3 className="mt-1 text-lg font-bold tracking-tight text-foreground">
          On the Radar · week watches
        </h3>
      </figcaption>

      <div className="relative px-5 py-6 sm:px-6">
        <div
          aria-hidden
          className="absolute left-5 right-5 top-[2.85rem] hidden h-px bg-[var(--border-strong)] sm:left-6 sm:right-6 md:block"
        />
        <ol className="grid gap-3 sm:grid-cols-2 md:grid-cols-5">
          {WATCHES.map((w) => (
            <li key={w.date} className="relative">
              <div className="mb-2 hidden h-2.5 w-2.5 rounded-full border-2 border-[var(--accent-soft)] bg-background md:block" />
              <span className="inline-flex rounded-full border border-[var(--border-strong)] bg-black/30 px-2.5 py-1 font-mono text-[10px] font-semibold text-[var(--accent-soft)]">
                {w.date}
              </span>
              <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">{w.note}</p>
            </li>
          ))}
        </ol>
      </div>
    </figure>
  );
}
