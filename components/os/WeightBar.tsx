export function WeightBar({ pct, max = 12 }: { pct: number; max?: number }) {
  const width = Math.max(0, Math.min(100, (pct / max) * 100));
  return (
    <div className="flex min-w-[8rem] items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
        <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${width}%` }} />
      </div>
      <span className="w-12 text-right font-mono text-xs font-bold tabular-nums text-foreground">
        {pct.toFixed(1)}%
      </span>
    </div>
  );
}
