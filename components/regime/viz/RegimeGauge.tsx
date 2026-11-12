import { THRESHOLDS } from '@/lib/regime/constants';

function xOf(score: number): number {
  const clamped = Math.max(-3, Math.min(3, score));
  return 28 + ((clamped + 3) / 6) * 584;
}

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
  const pin = xOf(score);
  const ghost = previous == null ? null : xOf(previous);
  const liq = liquidity == null ? null : xOf(liquidity);
  const label = composite == null
    ? 'No score'
    : `Score ${score > 0 ? '+' : ''}${score.toFixed(2)}; buys need +${THRESHOLDS.riskOnEnter.toFixed(2)}`;
  const ticks: { value: number; anchor: 'start' | 'middle' | 'end'; dx: number }[] = [
    { value: -1.75, anchor: 'middle', dx: 0 },
    { value: -0.75, anchor: 'end', dx: -4 },
    { value: -0.35, anchor: 'end', dx: -6 },
    { value: 0.35, anchor: 'start', dx: 6 },
    { value: 0.65, anchor: 'start', dx: 8 },
  ];
  return (
    <svg viewBox="0 0 640 78" className="w-full" role="img" aria-label={label}>
      <rect x="28" y="28" width="584" height="10" rx="5" fill="#2a2c38" />
      <rect x={xOf(-3)} y="28" width={xOf(THRESHOLDS.crisisEnter) - xOf(-3)} height="10" fill="var(--call-sell)" opacity="0.85" />
      <rect x={xOf(THRESHOLDS.crisisEnter)} y="28" width={xOf(THRESHOLDS.tightEnter) - xOf(THRESHOLDS.crisisEnter)} height="10" fill="var(--call-caution)" opacity="0.9" />
      <rect x={xOf(-THRESHOLDS.weakAbsComposite)} y="26" width={xOf(THRESHOLDS.weakAbsComposite) - xOf(-THRESHOLDS.weakAbsComposite)} height="14" fill="url(#quiet)" />
      <rect x={xOf(THRESHOLDS.riskOnEnter)} y="28" width={xOf(3) - xOf(THRESHOLDS.riskOnEnter)} height="10" fill="var(--call-buy)" opacity="0.9" />
      {ticks.map((tick) => (
        <g key={tick.value}>
          <line x1={xOf(tick.value)} x2={xOf(tick.value)} y1="22" y2="42" stroke="var(--text-3)" strokeWidth="1" />
          <text x={xOf(tick.value) + tick.dx} y="16" textAnchor={tick.anchor} fill="var(--text-3)" fontSize="11" fontFamily="ui-monospace, monospace">
            {tick.value > 0 ? `+${tick.value}` : tick.value}
          </text>
        </g>
      ))}
      {ghost != null ? <circle cx={ghost} cy="33" r="4" fill="var(--text-3)" /> : null}
      <circle cx={pin} cy="33" r="6" fill="var(--text-1)" stroke="var(--surface-1)" strokeWidth="2" />
      <text x={pin} y="58" textAnchor="middle" fill="var(--text-1)" fontSize="12" fontFamily="ui-monospace, monospace">
        {composite == null ? '—' : `${score > 0 ? '+' : ''}${score.toFixed(2)}`}
      </text>
      {liq != null ? (
        <g>
          <line x1="28" x2="612" y1="68" stroke="#2a2c38" strokeWidth="3" />
          <circle cx={liq} cy="68" r="3.5" fill="var(--call-hold)" />
          <text x="36" y="62" fill="var(--text-3)" fontSize="11">Money</text>
        </g>
      ) : null}
      <defs>
        <pattern id="quiet" width="6" height="14" patternUnits="userSpaceOnUse">
          <rect width="6" height="14" fill="#3a3d4d" />
          <path d="M0 14 L6 0" stroke="var(--text-3)" strokeWidth="1" />
        </pattern>
      </defs>
    </svg>
  );
}
