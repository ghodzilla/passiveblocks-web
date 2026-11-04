import Image from 'next/image';
import Link from 'next/link';
import { DeskPanels } from '@/components/regime/DeskPanels';
import { IdeasPanel } from '@/components/regime/IdeasPanel';
import { MODEL_BUDGET, REGIME_LABEL, THRESHOLDS, type RegimeId } from '@/lib/regime/constants';
import { melbourneClock } from '@/lib/regime/time';
import type { RegimeView } from '@/lib/regime/view';
import type { HistoryPoint } from '@/lib/regime/types';

function formatZ(z: number | null): string {
  if (z == null || !Number.isFinite(z)) return '—';
  if (Math.abs(z) < 0.005) return '0.00';
  const sign = z > 0 ? '+' : '−';
  return `${sign}${Math.abs(z).toFixed(2)}`;
}

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function regimeTone(regime: RegimeId | null): string {
  if (regime === 'risk_on') return 'text-[var(--status-ok)]';
  if (regime === 'tightening') return 'text-[var(--status-warn)]';
  if (regime === 'crisis') return 'text-[var(--status-danger)]';
  return 'text-foreground';
}

const BAND: Record<RegimeId, string> = {
  risk_on: '#4ade80',
  transitional: '#94a3b8',
  tightening: '#fbbf24',
  crisis: '#f87171',
};

function HistoryChart({ points }: { points: HistoryPoint[] }) {
  const data = points.filter((point) => point.composite != null && point.regime);
  if (data.length < 2) {
    return <p className="text-sm text-[var(--muted)]">Not enough history to chart yet.</p>;
  }
  const width = 800;
  const height = 240;
  const padL = 36;
  const padR = 12;
  const padT = 16;
  const padB = 28;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const y = (value: number) => padT + ((3 - value) / 6) * innerH;
  const slot = innerW / data.length;
  const line = data
    .map((point, index) => {
      const x = padL + slot * index + slot / 2;
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y(point.composite ?? 0).toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Composite score and regime history" className="h-auto w-full">
      {data.map((point, index) => (
        <rect
          key={point.date}
          x={padL + slot * index}
          y={padT}
          width={slot + 0.4}
          height={innerH}
          fill={BAND[point.regime ?? 'transitional']}
          opacity={0.16}
        />
      ))}
      {[3, 0, -3].map((level) => (
        <g key={level}>
          <line
            x1={padL}
            x2={width - padR}
            y1={y(level)}
            y2={y(level)}
            stroke={level === 0 ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.08)'}
          />
          <text x={0} y={y(level) + 4} fill="rgba(255,255,255,0.45)" fontSize="11">
            {level > 0 ? `+${level}` : `${level}`}
          </text>
        </g>
      ))}
      <path d={line} fill="none" stroke="#f4f4f5" strokeWidth="1.7" />
      <text x={padL} y={height - 8} fill="rgba(255,255,255,0.4)" fontSize="11">{data[0].date}</text>
      <text x={width - padR} y={height - 8} fill="rgba(255,255,255,0.4)" fontSize="11" textAnchor="end">
        {data[data.length - 1].date}
      </text>
    </svg>
  );
}

function ZBar({ z }: { z: number | null }) {
  const left = z == null ? 50 : ((Math.max(-3, Math.min(3, z)) + 3) / 6) * 100;
  return (
    <div className="relative mt-3 h-1.5 rounded-full bg-white/10" aria-hidden>
      <div className="absolute left-1/2 top-0 h-full w-px bg-white/25" />
      {z != null ? (
        <div
          className="absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-white shadow"
          style={{ left: `calc(${left}% - 5px)` }}
        />
      ) : null}
    </div>
  );
}

export function RegimeDashboard({ view }: { view: RegimeView }) {
  const { snapshot, ideas, desk, consistency } = view;
  const generated = melbourneClock(snapshot.generatedAt);
  const failedRules = consistency.rules.filter((rule) => !rule.pass);
  const bannerClass =
    snapshot.action === 'reduce_risk'
      ? 'border-rose-400/40 bg-rose-500/10'
      : snapshot.action === 'do_nothing'
        ? 'border-amber-300/40 bg-amber-400/10'
        : 'border-emerald-400/30 bg-emerald-400/10';
  const recent = snapshot.history.slice(-8).reverse();

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] opacity-80"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 12% -10%, rgba(59,130,246,0.22), transparent 55%), radial-gradient(ellipse 50% 40% at 90% 0%, rgba(248,113,113,0.08), transparent 50%)',
        }}
      />
      <header className="relative border-b border-[var(--border)]/80 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Image
                src="/passiveblocks_logo_cropped.png"
                alt="PassiveBlocks"
                width={148}
                height={34}
                className="h-8 w-auto"
                priority
              />
            </Link>
            <span className="rounded-full border border-[var(--accent)]/30 bg-[var(--accent-muted)] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-[var(--accent-soft)]">
              Owner only
            </span>
          </div>
          <div className="flex items-center gap-4">
            <form method="POST" action="/api/regime/logout">
              <button type="submit" className="text-xs text-[var(--muted)] transition-colors hover:text-foreground">
                Log out
              </button>
            </form>
            <Link href="/" className="text-xs text-[var(--muted)] transition-colors hover:text-foreground">
              Public site
            </Link>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12" data-regime={snapshot.regime ?? 'unavailable'} data-action={snapshot.action}>
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[var(--accent-soft)]">Macro regime engine</p>
        <h1 className={`text-3xl font-extrabold tracking-tight sm:text-4xl ${regimeTone(snapshot.regime)}`}>
          {snapshot.regimeLabel}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--muted)] sm:text-base">
          Phase 1 risk-budget switch. Positive composite is easier than the trailing window. The label uses hysteresis so it does not flip inside the hold band.
        </p>

        <section className={`mt-8 rounded-[var(--radius-xl)] border px-5 py-4 ${bannerClass}`}>
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">What to do</p>
          <p className="mt-2 text-base font-semibold leading-relaxed text-white sm:text-lg">{snapshot.message}</p>
          {!snapshot.actionable ? (
            <p className="mt-2 text-sm text-white/70">Shown scores are the last complete print. They are not a license to add risk while a core series is missing or stale.</p>
          ) : null}
        </section>

        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Tile label="Composite" value={formatZ(snapshot.composite)} meta={snapshot.weak ? 'Inside the no-edge band' : 'Winsorised trailing z'} />
          <Tile label="Vol target" value={pct(snapshot.effectiveBudget.volTarget)} meta={snapshot.budgetOverridden ? 'Effective · overridden' : 'Effective annual vol'} />
          <Tile label="Max gross" value={pct(snapshot.effectiveBudget.maxGross)} meta="Effective exposure cap" />
          <Tile label="Max net" value={pct(snapshot.effectiveBudget.maxNet)} meta={snapshot.effectiveBudget.maxNet === 0 ? 'No new net risk' : 'Effective net cap'} />
        </div>

        {failedRules.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--status-ok)]" data-consistency="pass">
            Consistency check: all {consistency.rules.length} rules pass
          </p>
        ) : (
          <div className="mt-4 rounded-[var(--radius-lg)] border border-rose-400/40 bg-rose-500/10 px-4 py-3" data-consistency="fail">
            <p className="text-sm font-semibold text-rose-100">
              Consistency check: {failedRules.length} of {consistency.rules.length} rules failed
            </p>
            <ul className="mt-2 space-y-1 text-sm text-rose-50">
              {failedRules.map((rule) => (
                <li key={rule.id}>{rule.detail}</li>
              ))}
            </ul>
          </div>
        )}

        <p className="mt-3 text-xs text-[var(--muted)]">
          Print {snapshot.printDate ?? '—'} · snapshot {generated} Australia/Melbourne · rules {snapshot.rulesVersion}
          {snapshot.modelBudget ? ` · model budget for this regime ${pct(snapshot.modelBudget.volTarget)} vol / ${pct(snapshot.modelBudget.maxGross)} gross / ${pct(snapshot.modelBudget.maxNet)} net` : ''}
        </p>

        <section className="mt-10">
          <h2 className="text-lg font-bold tracking-tight">Components</h2>
          <div className="mt-4 grid gap-3">
            {snapshot.components.map((component) => (
              <article key={component.id} className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-black/25 px-4 py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-sm font-bold">{component.label}</h3>
                  <p className="font-mono text-sm os-tabular text-foreground">
                    {formatZ(component.z)}
                    <span className="ml-3 text-xs text-[var(--muted)]">weight {Math.round(component.weight * 100)}%</span>
                  </p>
                </div>
                <ZBar z={component.z} />
                <p className="mt-3 text-sm text-[var(--muted)]">{component.reading}</p>
                <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">{component.detail}</p>
                <p className="mt-2 text-[11px] uppercase tracking-wider text-white/35">
                  {component.included ? 'In composite' : 'Excluded'}
                  {component.asOf ? ` · as of ${component.asOf}` : ''}
                </p>
                {component.gap ? (
                  <p className="mt-2 text-sm text-[var(--status-warn)]">{component.included ? 'Note: ' : 'Gap: '}{component.gap}</p>
                ) : null}
              </article>
            ))}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-bold tracking-tight">History</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">Weekly spine, causal z-scores, hysteresis applied in order. The AI column is the point-in-time blend. The live card drops a price leg older than 10 days.</p>
          <div className="mt-4 rounded-[var(--radius-lg)] border border-[var(--border)] bg-black/25 p-3 sm:p-4">
            <HistoryChart points={snapshot.history} />
            <ul className="mt-3 flex flex-wrap gap-3 text-[11px] uppercase tracking-wider text-[var(--muted)]">
              {(Object.keys(REGIME_LABEL) as RegimeId[]).map((id) => (
                <li key={id} className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ background: BAND[id] }} />
                  {REGIME_LABEL[id]}
                </li>
              ))}
            </ul>
          </div>
          {recent.length > 0 ? (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <caption className="sr-only">Recent composite prints</caption>
                <thead className="text-[10px] uppercase tracking-widest text-[var(--muted)]">
                  <tr>
                    <th className="py-2 pr-3 font-bold">Date</th>
                    <th className="py-2 pr-3 font-bold">Regime</th>
                    <th className="py-2 pr-3 font-bold">Composite</th>
                    <th className="py-2 pr-3 font-bold">Liq</th>
                    <th className="py-2 pr-3 font-bold">Policy</th>
                    <th className="py-2 pr-3 font-bold">Credit</th>
                    <th className="py-2 pr-3 font-bold">Growth</th>
                    <th className="py-2 pr-3 font-bold">Pos</th>
                    <th className="py-2 font-bold">AI</th>
                  </tr>
                </thead>
                <tbody className="font-mono text-xs os-tabular">
                  {recent.map((point) => (
                    <tr key={point.date} className="border-t border-[var(--border)]">
                      <td className="py-2 pr-3">{point.date}</td>
                      <td className="py-2 pr-3">{point.regime ? REGIME_LABEL[point.regime] : '—'}</td>
                      <td className="py-2 pr-3">{formatZ(point.composite)}</td>
                      <td className="py-2 pr-3">{formatZ(point.liquidity)}</td>
                      <td className="py-2 pr-3">{formatZ(point.policy)}</td>
                      <td className="py-2 pr-3">{formatZ(point.credit)}</td>
                      <td className="py-2 pr-3">{formatZ(point.growth)}</td>
                      <td className="py-2 pr-3">{formatZ(point.positioning)}</td>
                      <td className="py-2">{formatZ(point.ai)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-bold tracking-tight">Data freshness</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-[10px] uppercase tracking-widest text-[var(--muted)]">
                <tr>
                  <th className="py-2 pr-3 font-bold">Series</th>
                  <th className="py-2 pr-3 font-bold">As of</th>
                  <th className="py-2 pr-3 font-bold">Age</th>
                  <th className="py-2 pr-3 font-bold">Status</th>
                  <th className="py-2 font-bold">Source</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.freshness.map((row) => (
                  <tr key={row.id} className="border-t border-[var(--border)]">
                    <td className="py-2.5 pr-3">{row.label}</td>
                    <td className="py-2.5 pr-3 font-mono text-xs">{row.asOf ?? '—'}</td>
                    <td className="py-2.5 pr-3 font-mono text-xs">{row.ageDays == null ? '—' : `${row.ageDays}d`}</td>
                    <td className={`py-2.5 pr-3 text-xs font-bold uppercase tracking-wider ${row.stale ? 'text-[var(--status-danger)]' : 'text-[var(--status-ok)]'}`}>
                      {row.stale ? 'Stale' : 'Fresh'}
                    </td>
                    <td className="py-2.5">
                      <a href={row.href} className="text-[var(--accent-soft)] underline-offset-2 hover:underline" rel="noreferrer">
                        {row.source}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-[var(--muted)]">
            As-of dates in this table are the exchange session or the FRED observation date. They are not shifted into Melbourne. Clocks such as the snapshot time and the price fetch time are Australia/Melbourne.
          </p>
          {snapshot.gaps.length > 0 ? (
            <ul className="mt-4 space-y-2 text-sm text-[var(--status-warn)]">
              {snapshot.gaps.map((gap) => (
                <li key={gap}>{gap}</li>
              ))}
            </ul>
          ) : null}
        </section>

        <IdeasPanel ideas={ideas} risk={desk.lines} />
        <DeskPanels desk={desk} />

        <section className="mt-10 rounded-[var(--radius-lg)] border border-[var(--border)] bg-black/20 px-4 py-4">
          <h2 className="text-lg font-bold tracking-tight">Rules that bind</h2>
          <dl className="mt-3 grid gap-2 text-sm text-[var(--muted)] sm:grid-cols-2">
            <div>Risk-on entry: composite ≥ {THRESHOLDS.riskOnEnter} and liquidity z ≥ {THRESHOLDS.riskOnLiquidityMin}. Exit below {THRESHOLDS.riskOnExit} or liquidity z below {THRESHOLDS.riskOnLiquidityExit}.</div>
            <div>Tightening entry: composite ≤ {THRESHOLDS.tightEnter}. Hold until composite &gt; {THRESHOLDS.tightExit}.</div>
            <div>Crisis entry: composite ≤ {THRESHOLDS.crisisEnter}, or credit z ≤ {THRESHOLDS.crisisCreditEnter} with composite ≤ {THRESHOLDS.crisisCompositeConfirm}.</div>
            <div>No-edge band: |composite| &lt; {THRESHOLDS.weakAbsComposite} means do nothing.</div>
            <div>Budgets: risk-on {pct(MODEL_BUDGET.risk_on.volTarget)} / {pct(MODEL_BUDGET.risk_on.maxGross)} / {pct(MODEL_BUDGET.risk_on.maxNet)}. Transitional {pct(MODEL_BUDGET.transitional.volTarget)}. Tightening {pct(MODEL_BUDGET.tightening.volTarget)}. Crisis {pct(MODEL_BUDGET.crisis.volTarget)}.</div>
            <div>Missing components are dropped and the remaining weights are renormalised. A missing core series blocks action.</div>
            <div>AI capex and concentration has an 8% base weight. It is not required for a print. Concentration (SPY versus RSP) is sign-flipped.</div>
            <div>A tactical idea is sized only when Confirmed, and never above 20% of the book. A watchlist stock is capped at 2%. The sum stays inside the gross and net budget.</div>
            <div>Average pairwise correlation above 0.55 scales non-cash weights down, to half at 0.70. Confirmed AI/megacap names share a 25% group cap.</div>
            <div>A signal with a negative 20-day information coefficient and a hit rate under 48% is retired. Unknown health keeps the default gates.</div>
            <div>Themes (AI infrastructure, crypto, scarcity) switch on from written rules in a versioned config. A person reviews that list quarterly. The weekly job does not edit it.</div>
            <div>Risk size uses ATR(20). Stop is entry minus k times ATR (default k 2.5). Quantity is capital times 0.75% divided by the distance to the stop. Add only after +1R. A 10% paper drawdown blocks new entries.</div>
            <div>Buy the dip — confirmed only in Risk-On or Transitional, with the theme on, 10–20% below the 60-day high, and back above the 20-day average. Never in Tightening or Crisis, and never during the drawdown halt.</div>
          </dl>
        </section>

        <p className="mt-10 max-w-3xl text-xs leading-relaxed text-[var(--muted)]">
          Educational research tool for the owner. Not financial advice, not a solicitation to buy or sell any instrument, and not a forecast. The regime sets a risk budget. A Confirmed idea is a research label, not an order. Cash is a valid output.
        </p>
      </main>
    </div>
  );
}

function Tile({ label, value, meta }: { label: string; value: string; meta: string }) {
  return (
    <article className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-black/25 px-4 py-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">{label}</p>
      <p className="mt-2 font-mono text-2xl font-bold tracking-tight os-tabular">{value}</p>
      <p className="mt-2 text-[11px] text-[var(--muted)]">{meta}</p>
    </article>
  );
}
