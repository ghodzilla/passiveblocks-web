import { THRESHOLDS } from '@/lib/regime/constants';

function xOf(score: number): number {
  const clamped = Math.max(-3, Math.min(3, score));
  return 16 + ((clamped + 3) / 6) * 608;
}

function signed(value: number): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}`;
}

const ZONES: { name: string; color: string; note: string }[] = [
  { name: 'Stressed', color: 'var(--call-sell)', note: `≤ ${THRESHOLDS.crisisEnter.toFixed(2)}` },
  { name: 'Cautious', color: 'var(--call-caution)', note: `≤ ${THRESHOLDS.tightEnter.toFixed(2)}` },
  { name: 'Quiet', color: 'var(--text-3)', note: `±${THRESHOLDS.weakAbsComposite.toFixed(2)}` },
  { name: 'Supportive', color: 'var(--call-buy)', note: `≥ +${THRESHOLDS.riskOnEnter.toFixed(2)}` },
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
  const pin = xOf(score);
  const labelX = Math.max(28, Math.min(612, pin));
  const ghost = previous == null ? null : xOf(previous);
  const liq = liquidity == null ? null : xOf(liquidity);
  const moneyNeed = xOf(THRESHOLDS.riskOnLiquidityMin);
  const label = composite == null
    ? 'No score'
    : `Score ${signed(score)}; buys need +${THRESHOLDS.riskOnEnter.toFixed(2)}`;
  const ticks = [
    THRESHOLDS.crisisEnter,
    THRESHOLDS.tightEnter,
    -THRESHOLDS.weakAbsComposite,
    THRESHOLDS.weakAbsComposite,
    THRESHOLDS.riskOnEnter,
  ];
  return (
    <div>
      <svg viewBox="0 0 640 52" className="w-full" role="img" aria-label={label}>
        <rect x="16" y="14" width="608" height="12" rx="6" fill="#2a2c38" />
        <rect x={xOf(-3)} y="14" width={xOf(THRESHOLDS.crisisEnter) - xOf(-3)} height="12" fill="var(--call-sell)" opacity="0.9" />
        <rect x={xOf(THRESHOLDS.crisisEnter)} y="14" width={xOf(THRESHOLDS.tightEnter) - xOf(THRESHOLDS.crisisEnter)} height="12" fill="var(--call-caution)" opacity="0.9" />
        <rect x={xOf(-THRESHOLDS.weakAbsComposite)} y="14" width={xOf(THRESHOLDS.weakAbsComposite) - xOf(-THRESHOLDS.weakAbsComposite)} height="12" fill="#4a4d5c" />
        <rect x={xOf(THRESHOLDS.riskOnEnter)} y="14" width={xOf(3) - xOf(THRESHOLDS.riskOnEnter)} height="12" fill="var(--call-buy)" opacity="0.9" />
        {ticks.map((tick) => (
          <line key={tick} x1={xOf(tick)} x2={xOf(tick)} y1="12" y2="28" stroke="var(--text-3)" strokeWidth="1" />
        ))}
        {ghost != null ? <circle cx={ghost} cy="20" r="4" fill="none" stroke="var(--text-2)" strokeWidth="1.5" /> : null}
        <circle cx={pin} cy="20" r="6" fill="var(--text-1)" stroke="var(--surface-1)" strokeWidth="2" />
        <text x={labelX} y="46" textAnchor="middle" fill="var(--text-1)" fontSize="13" fontFamily="ui-monospace, monospace">
          {composite == null ? '—' : signed(score)}
        </text>
      </svg>
      <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--text-3)]">
        {ZONES.map((zone) => (
          <li key={zone.name} className="inline-flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ background: zone.color }} />
            <span>{zone.name} {zone.note}</span>
          </li>
        ))}
        {previous != null ? <li>Ring is last week</li> : null}
      </ul>
      {liq != null && liquidity != null ? (
        <div className="mt-4">
          <p className="flex items-baseline justify-between gap-3 text-xs text-[var(--text-3)]">
            <span>Money in the system</span>
            <span className="font-mono text-sm text-[var(--text-2)]">{signed(liquidity)}</span>
          </p>
          <svg viewBox="0 0 640 18" className="mt-1 w-full" role="img" aria-label={`Money in the system ${signed(liquidity)}. Buys need +${THRESHOLDS.riskOnLiquidityMin.toFixed(2)} or more.`}>
            <rect x="16" y="6" width="608" height="6" rx="3" fill="#2a2c38" />
            <line x1={moneyNeed} x2={moneyNeed} y1="3" y2="15" stroke="var(--text-3)" strokeWidth="1" />
            <circle cx={liq} cy="9" r="4.5" fill="var(--call-hold)" />
          </svg>
          <p className="mt-1 text-xs text-[var(--text-3)]">Buys need +{THRESHOLDS.riskOnLiquidityMin.toFixed(2)} or more. The tick marks that level.</p>
        </div>
      ) : null}
    </div>
  );
}
