function Bar({
  label,
  used,
  cap,
  usual,
}: {
  label: string;
  used: number;
  cap: number;
  usual: number | null;
}) {
  const usedPct = Math.max(0, Math.min(100, used * 100));
  const capPct = Math.max(0, Math.min(100, cap * 100));
  const usualPct = usual == null ? null : Math.max(0, Math.min(100, usual * 100));
  const full = cap > 0 && used >= cap * 0.95;
  const fill = full ? 'var(--call-watch)' : 'var(--call-hold)';
  const tighter = usual != null && cap < usual - 1e-9;
  return (
    <div className="grid gap-1">
      <div className="flex items-baseline justify-between gap-3 text-[15px] text-[var(--text-2)]">
        <span>{label}</span>
        <span className="font-mono text-xs tabular-nums text-[var(--text-1)]">
          {usedPct.toFixed(1)}% of {capPct.toFixed(0)}%{full ? ' · full' : ''}
          {tighter && usualPct != null ? ` · normally ${usualPct.toFixed(0)}%` : ''}
        </span>
      </div>
      <svg viewBox="0 0 320 16" className="w-full" role="img" aria-label={`${label} ${usedPct.toFixed(1)} percent of ${capPct.toFixed(0)} percent`}>
        <rect x="0" y="4" width="320" height="8" rx="4" fill="#2a2c38" />
        <rect x="0" y="4" width={(usedPct / 100) * 320} height="8" rx="4" fill={fill} />
        <line x1={(capPct / 100) * 320} x2={(capPct / 100) * 320} y1="1" y2="15" stroke="var(--text-1)" strokeWidth="1.5" />
        {usualPct != null ? <line x1={(usualPct / 100) * 320} x2={(usualPct / 100) * 320} y1="2" y2="14" stroke="var(--text-3)" strokeWidth="1" strokeDasharray="2 2" /> : null}
      </svg>
    </div>
  );
}

export function CapBars({
  invested,
  investedCap,
  investedUsual,
  nonCash,
  nonCashCap,
  nonCashUsual,
}: {
  invested: number;
  investedCap: number;
  investedUsual: number | null;
  nonCash: number;
  nonCashCap: number;
  nonCashUsual: number | null;
}) {
  return (
    <div className="grid gap-4">
      <Bar label="Invested" used={invested} cap={investedCap} usual={investedUsual} />
      <Bar label="Non-cash" used={nonCash} cap={nonCashCap} usual={nonCashUsual} />
    </div>
  );
}
