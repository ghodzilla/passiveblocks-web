/**
 * FIG-01 · Hero paradox — bull cluster vs blank kill switch.
 * Cite: letters/2026-09-21-graphics.md · no ETF/stables on hero.
 */
const BULL_CHIPS = [
  { name: 'Jordi Visser', date: '09-06', note: 'bullish/high · BTC/ETH/SOL/tokenization' },
  { name: 'Jordi Visser', date: '08-30', note: 'prior bull seat' },
  { name: 'Jordi Visser', date: '08-23', note: 'prior bull seat' },
  { name: 'Luke Gromen', date: '08-28', note: 'prior bull seat' },
  { name: 'Arthur Hayes', date: '08-21', note: 'prior bull seat' },
  { name: 'Tom Lee', date: '09-02', note: 'prior bull seat' },
] as const;

export function Fig01HeroParadox() {
  return (
    <figure
      id="fig-01-hero-bull-vs-blank-kill"
      aria-label="Paradox graphic: left side lists thickened crypto bull cites including Jordi 6 Sep; right side shows Howell falsifier 4 unrebutted and an empty GLI cell marked INSUFFICIENT."
      className="overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)]"
    >
      <figcaption className="border-b border-[var(--border)] px-5 py-4 sm:px-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
          FIG-01 · Hero
        </p>
        <h3 className="mt-1 text-lg font-bold tracking-tight text-foreground sm:text-xl">
          The bull side got louder. The kill switch is still blank.
        </h3>
      </figcaption>

      <div className="grid lg:grid-cols-2">
        <div className="border-b border-[var(--border)] p-5 sm:p-6 lg:border-b-0 lg:border-r">
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--accent-soft)]">
              Bull cluster thickened
            </p>
            <span className="os-stamp os-stamp--show">OW · split only</span>
          </div>
          <ul className="flex flex-wrap gap-2">
            {BULL_CHIPS.map((chip) => (
              <li
                key={`${chip.name}-${chip.date}`}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--border-strong)] bg-black/30 px-3 py-1.5"
              >
                <span className="text-xs font-semibold text-foreground">{chip.name}</span>
                <span className="font-mono text-[10px] text-[var(--accent-soft)]">{chip.date}</span>
                <span className="hidden text-[10px] text-[var(--muted)] sm:inline">{chip.note}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[11px] leading-relaxed text-[var(--muted)]">
            Voices, not scores. Jordi 09-06 thickens the bull side — it is not a Howell rebuttal.
          </p>
        </div>

        <div className="relative flex flex-col justify-between gap-4 p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
              Falsifier #4 / GLI cell
            </p>
            <span className="os-stamp border-[var(--status-warn)]/30 bg-[var(--status-warn)]/10 text-[var(--status-warn)]">
              Howell #4 · LIVE
            </span>
          </div>

          <div
            className="relative flex min-h-[140px] flex-1 flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--border-strong)] bg-black/20 px-4 py-8"
            style={{
              backgroundImage:
                'repeating-linear-gradient(-45deg, transparent, transparent 6px, rgba(255,255,255,0.015) 6px, rgba(255,255,255,0.015) 7px)',
            }}
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
              GLI · global-liquidity momentum
            </p>
            <p className="mt-3 font-mono text-2xl font-semibold tracking-tight text-[var(--muted)] sm:text-3xl">
              INSUFFICIENT
            </p>
            <p className="mt-2 text-xs text-[var(--muted)]">Hole. Not zero.</p>
          </div>

          <p className="mt-4 text-[11px] leading-relaxed text-[var(--muted)]">
            Michael Howell 11 Aug near-term crypto bear unrebutted. ETF week and stables stay off this
            panel — they do not fill the cell.
          </p>
        </div>
      </div>
    </figure>
  );
}
