export function ScoreBar({ score, max = 100 }: { score: number; max?: number }) {
  const pct = Math.max(0, Math.min(100, (score / max) * 100));
  const tone =
    pct >= 80 ? 'bg-[var(--status-ok)]' : pct >= 65 ? 'bg-[var(--accent-soft)]' : 'bg-[var(--status-warn)]';
  return (
    <div className="flex min-w-[7.5rem] items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-9 text-right font-mono text-xs font-bold tabular-nums text-foreground">
        {Number.isInteger(score) ? score : score.toFixed(1)}
      </span>
    </div>
  );
}
