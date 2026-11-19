export function EquitySpark({ marks, baseline }: { marks: { date: string; equity: number }[]; baseline: number }) {
  if (marks.length < 2) return null;
  const values = marks.map((mark) => mark.equity);
  const min = Math.min(baseline, ...values);
  const max = Math.max(baseline, ...values);
  const span = max - min || 1;
  const width = 240;
  const height = 48;
  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * (width - 8) + 4;
    const y = height - 8 - ((value - min) / span) * (height - 16);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const baseY = height - 8 - ((baseline - min) / span) * (height - 16);
  const last = values[values.length - 1];
  const change = ((last - baseline) / baseline) * 100;
  return (
    <div className="flex items-center gap-3">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-12 w-40" role="img" aria-label={`Paper book ${last.toFixed(0)} Australian dollars`}>
        <line x1="4" x2={width - 4} y1={baseY} y2={baseY} stroke="var(--text-3)" strokeDasharray="3 3" />
        <polyline fill="none" stroke="var(--call-hold)" strokeWidth="2" points={points} />
      </svg>
      <p className="font-mono text-sm tabular-nums text-[var(--text-1)]">
        A${Math.round(last).toLocaleString('en-AU')} ({change >= 0 ? '+' : ''}{change.toFixed(2)}%)
      </p>
    </div>
  );
}
