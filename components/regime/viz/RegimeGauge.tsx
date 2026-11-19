import { THRESHOLDS } from '@/lib/regime/constants';

function signed(value: number): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}`;
}

function polar(score: number, radius: number): { x: number; y: number } {
  const t = (Math.max(-3, Math.min(3, score)) + 3) / 6;
  const angle = Math.PI * (1 - t);
  return { x: 160 + radius * Math.cos(angle), y: 150 - radius * Math.sin(angle) };
}

function arc(from: number, to: number, radius: number): string {
  const start = polar(from, radius);
  const end = polar(to, radius);
  return `M ${start.x.toFixed(1)} ${start.y.toFixed(1)} A ${radius} ${radius} 0 0 1 ${end.x.toFixed(1)} ${end.y.toFixed(1)}`;
}

const ZONES: { from: number; to: number; color: string; name: string }[] = [
  { from: -3, to: THRESHOLDS.crisisEnter, color: 'var(--call-sell)', name: 'Stressed' },
  { from: THRESHOLDS.crisisEnter, to: THRESHOLDS.tightEnter, color: 'var(--call-caution)', name: 'Cautious' },
  { from: THRESHOLDS.tightEnter, to: THRESHOLDS.riskOnEnter, color: '#9a9aa8', name: 'Mixed' },
  { from: THRESHOLDS.riskOnEnter, to: 3, color: 'var(--call-buy)', name: 'Supportive' },
];

export function RegimeGauge({
  composite,
  previous,
  liquidity,
}: {
  composite: number | null;
  previous: number | null;
  liquidity: number | null;
}) {
  const score = composite ?? 0;
  const needle = composite == null ? null : polar(score, 96);
  const hub = polar(0, 0);
  const buy = polar(THRESHOLDS.riskOnEnter, 118);
  const ghost = previous == null ? null : polar(previous, 118);
  const label = composite == null
    ? 'No market score'
    : `Market score ${signed(score)}. Buys need +${THRESHOLDS.riskOnEnter.toFixed(2)}.`;
  return (
    <div>
      <svg viewBox="0 0 320 168" className="mx-auto w-full max-w-md" role="img" aria-label={label}>
        {ZONES.map((zone) => (
          <path key={zone.name} d={arc(zone.from, zone.to, 108)} fill="none" stroke={zone.color} strokeWidth="16" strokeLinecap="butt" />
        ))}
        <path d={arc(-3, 3, 108)} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
        {ghost ? <circle cx={ghost.x} cy={ghost.y} r="4" fill="none" stroke="var(--text-2)" strokeWidth="1.5" /> : null}
        <circle cx={buy.x} cy={buy.y} r="4" fill="var(--call-buy)" />
        {needle ? (
          <line x1={hub.x} y1={150} x2={needle.x} y2={needle.y} stroke="var(--text-1)" strokeWidth="3" strokeLinecap="round" />
        ) : null}
        <circle cx={160} cy={150} r="5" fill="var(--text-1)" />
      </svg>
      <p className="text-center font-mono text-4xl font-bold tabular-nums text-[var(--text-1)]">
        {composite == null ? '—' : signed(score)}
      </p>
      <p className="text-center text-xs text-[var(--text-3)]">{`buys at +${THRESHOLDS.riskOnEnter.toFixed(2)}`}</p>
      <ul className="mt-1 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-[var(--text-3)]">
        {ZONES.map((zone) => (
          <li key={zone.name} className="inline-flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ background: zone.color }} />
            {zone.name}
          </li>
        ))}
        {previous != null ? <li>Ring is last week</li> : null}
      </ul>
      <p className="mt-3 text-center text-sm text-[var(--text-2)]">
        {liquidity == null
          ? 'Money in the system is missing, so its distance to +0.10 is not shown.'
          : `Money in the system ${signed(liquidity)}. Buys need +${THRESHOLDS.riskOnLiquidityMin.toFixed(2)} or more.`}
      </p>
    </div>
  );
}
