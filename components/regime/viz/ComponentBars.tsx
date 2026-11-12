export function ComponentBars({
  rows,
}: {
  rows: { title: string; z: number | null; weight: number }[];
}) {
  const live = rows
    .filter((row) => row.z != null && Number.isFinite(row.z))
    .slice()
    .sort((a, b) => Math.abs((b.z as number) * b.weight) - Math.abs((a.z as number) * a.weight));
  return (
    <div className="grid gap-3">
      {live.map((row) => {
        const z = row.z as number;
        const width = Math.min(50, (Math.abs(z) / 2.5) * 50);
        const negative = z < 0;
        return (
          <div key={row.title} className="grid grid-cols-[9rem_1fr_4rem] items-center gap-2 text-sm">
            <span className="text-[var(--text-2)]">{row.title}</span>
            <svg viewBox="0 0 100 12" className="w-full" role="img" aria-label={`${row.title} ${z.toFixed(2)}`}>
              <line x1="50" x2="50" y1="0" y2="12" stroke="var(--text-3)" strokeWidth="0.6" />
              <rect
                x={negative ? 50 - width : 50}
                y="2"
                width={width}
                height="8"
                rx="2"
                fill={negative ? (z <= -1.5 ? 'var(--call-sell)' : 'var(--call-caution)') : 'var(--call-buy)'}
              />
            </svg>
            <span className="font-mono text-xs tabular-nums text-[var(--text-1)]">{z > 0 ? '+' : ''}{z.toFixed(2)}</span>
          </div>
        );
      })}
      <p className="text-xs text-[var(--text-3)]">A single piece at −1.75 is not a crisis. Only the overall score counts.</p>
    </div>
  );
}
