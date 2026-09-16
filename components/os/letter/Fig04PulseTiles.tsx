/**
 * FIG-04 · Pulse tiles — exact table from graphics md.
 * Tile 6 = INSUFFICIENT dashed. Optional 7th HY OAS labeled as spread proxy.
 */
import { MetricTile } from '@/components/os/MetricTile';

const TILES = [
  {
    label: 'Farside BTC · 1–4 Sep sum',
    value: '+770.0 US$m',
    meta: 'as-of 2026-09-04 · farside.co.uk/btc/',
    tone: 'ok' as const,
  },
  {
    label: 'Farside ETH · 1–4 Sep sum',
    value: '+127.7 US$m',
    meta: 'as-of 2026-09-04 · farside.co.uk/eth/',
    tone: 'ok' as const,
  },
  {
    label: 'Stables · level / 7d',
    value: '~$309.850bn',
    delta: '+$1.440bn 7d',
    meta: 'as-of 2026-09-08 · DefiLlama',
    tone: 'ok' as const,
  },
  {
    label: 'ON RRP',
    value: '$0.626bn',
    meta: 'as-of 2026-09-08 · FRED RRPONTSYD',
    tone: 'neutral' as const,
  },
  {
    label: 'TGA closing',
    value: '$888,923m',
    meta: 'as-of 2026-09-04 · Treasury Fiscal Data DTS',
    tone: 'neutral' as const,
  },
] as const;

export function Fig04PulseTiles() {
  return (
    <figure
      id="fig-04-pulse-tiles"
      aria-label="Six large pulse tiles: Farside Bitcoin and Ethereum early-September sums, stablecoin level and seven-day change, overnight RRP, TGA closing balance, and an INSUFFICIENT tile for the Howell global-liquidity cell."
      className="space-y-4"
    >
      <figcaption>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
          FIG-04 · Pulse
        </p>
        <h3 className="mt-1 text-lg font-bold tracking-tight text-foreground">Pulse · as-of stamped</h3>
      </figcaption>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TILES.map((tile) => (
          <MetricTile key={tile.label} {...tile} />
        ))}

        <article
          className="rounded-[var(--radius-lg)] border border-dashed border-[var(--border-strong)] bg-black/15 px-4 py-4"
          style={{
            backgroundImage:
              'repeating-linear-gradient(-45deg, transparent, transparent 6px, rgba(255,255,255,0.02) 6px, rgba(255,255,255,0.02) 7px)',
          }}
        >
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
            GLI / Howell #4 cell
          </p>
          <p className="mt-2 font-mono text-2xl font-semibold tracking-tight text-[var(--muted)]">
            INSUFFICIENT
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">Hole. Not zero.</p>
          <p className="mt-2 text-[11px] text-[var(--muted)]">brief falsifier #4 · unrebutted</p>
        </article>

        <article className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-black/25 px-4 py-4 sm:col-span-2 lg:col-span-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
                ICE BofA US HY OAS
              </p>
              <p className="mt-2 font-mono text-2xl font-semibold tracking-tight text-foreground">2.68%</p>
            </div>
            <p className="text-[11px] text-[var(--muted)]">
              as-of 2026-09-07 · FRED BAMLH0A0HYM2 ·{' '}
              <span className="font-semibold">spread proxy, not a flow</span>
            </p>
          </div>
        </article>
      </div>
    </figure>
  );
}
