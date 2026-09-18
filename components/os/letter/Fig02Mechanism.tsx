/**
 * FIG-02 · Mechanism — three-column crypto split.
 * Exact card cells only; Col C does NOT adjudicate GLI.
 */
const CARD_CELLS = [
  { label: 'Farside BTC · 1–4 Sep', value: '+770.0 US$m', asOf: '2026-09-04', tone: 'ok' as const },
  { label: 'Farside ETH · 1–4 Sep', value: '+127.7 US$m', asOf: '2026-09-04', tone: 'ok' as const },
  { label: 'SoSoValue BTC', value: '−46.6464 US$m', asOf: '2026-09-08', tone: 'bad' as const },
  { label: 'SoSoValue ETH', value: '−24.2921 US$m', asOf: '2026-09-08', tone: 'bad' as const },
  {
    label: 'Stables USD-pegged',
    value: '~$309.850bn',
    delta: '7d +$1.440bn',
    asOf: '2026-09-08',
    tone: 'ok' as const,
  },
] as const;

export function Fig02Mechanism() {
  return (
    <figure
      id="fig-02-mechanism-crypto-split"
      aria-label="Three-column diagram: bull voice cluster; unrebutted Howell falsifier 4; liquidity card prints that explicitly do not adjudicate global liquidity."
      className="overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)]"
    >
      <figcaption className="border-b border-[var(--border)] px-5 py-4 sm:px-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
          FIG-02 · Mechanism
        </p>
        <h3 className="mt-1 text-lg font-bold tracking-tight text-foreground sm:text-xl">
          Crypto OW is a split — not one call
        </h3>
      </figcaption>

      <div className="grid gap-0 lg:grid-cols-3">
        <div className="border-b border-[var(--border)] p-5 lg:border-b-0 lg:border-r">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--accent-soft)]">
            Col A · Bull cluster
          </p>
          <p className="mt-3 font-mono text-sm font-semibold text-foreground">
            OW · low_to_medium · split only
          </p>
          <p className="mt-1 text-[11px] text-[var(--muted)]">Decide 2026-09-19</p>
          <ul className="mt-4 space-y-2 text-xs text-[var(--muted)]">
            <li>
              <span className="font-semibold text-foreground">New-wave thicken:</span> Jordi 09-06
              (er5mqvbDQU8)
            </li>
            <li>Prior: Visser · Gromen · Hayes · Lee</li>
            <li className="text-[var(--muted-foreground)]">Stance/voice tiles — not fake % weights</li>
          </ul>
        </div>

        <div className="border-b border-[var(--border)] p-5 lg:border-b-0 lg:border-r">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--status-warn)]">
            Col B · Kill switch
          </p>
          <p className="mt-3 text-sm font-semibold text-foreground">Howell · 11 Aug</p>
          <p className="mt-1 text-[11px] text-[var(--muted)]">Falsifier #4 · live unrebutted</p>
          <div className="mt-4 rounded-[var(--radius-md)] border border-dashed border-[var(--border-strong)] bg-black/20 px-3 py-3">
            <p className="font-mono text-xs text-[var(--muted)]">Jordi 09-06 ≠ rebuttal</p>
            <p className="mt-2 text-[11px] leading-relaxed text-[var(--muted)]">
              Falling-liquidity momentum vs debasement-crypto bid — voice still open.
            </p>
          </div>
        </div>

        <div className="p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
              Col C · Card cells
            </p>
            <span className="os-pill os-pill--insufficient">do not adjudicate GLI</span>
          </div>
          <ul className="space-y-2">
            {CARD_CELLS.map((cell) => (
              <li
                key={cell.label}
                className="rounded-[var(--radius-md)] border border-[var(--border)] bg-black/25 px-3 py-2"
              >
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
                  {cell.label}
                </p>
                <p
                  className={`mt-0.5 font-mono text-sm font-semibold ${
                    cell.tone === 'ok' ? 'text-[var(--status-ok)]' : 'text-[var(--status-danger)]'
                  }`}
                >
                  {cell.value}
                  {'delta' in cell && cell.delta ? (
                    <span className="ml-2 text-xs font-normal text-[var(--status-ok)]">{cell.delta}</span>
                  ) : null}
                </p>
                <p className="mt-0.5 text-[10px] text-[var(--muted)]">as-of {cell.asOf}</p>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-widest text-[var(--muted)]">→</span>
            <span className="relative inline-flex items-center rounded-full border border-[var(--border)] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">
              <span className="absolute inset-x-1 top-1/2 h-px -translate-y-1/2 bg-[var(--status-danger)]/70" />
              <span className="relative">clears #4</span>
            </span>
          </div>
        </div>
      </div>
    </figure>
  );
}
