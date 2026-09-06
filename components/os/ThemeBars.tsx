import { formatPct, formatThemeLabel } from '@/lib/os-data';

export function ThemeBars({
  exposure,
  capPct,
}: {
  exposure: Record<string, number>;
  capPct: number;
}) {
  const entries = Object.entries(exposure).sort((a, b) => b[1] - a[1]);
  return (
    <div className="space-y-3">
      {entries.map(([theme, pct]) => {
        const width = Math.min(100, (pct / capPct) * 100);
        const nearCap = pct / capPct >= 0.85;
        return (
          <div key={theme}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className="font-medium text-foreground">{formatThemeLabel(theme)}</span>
              <span className="font-mono text-xs text-[var(--muted)]">
                {formatPct(pct)} / {formatPct(capPct, 0)} cap
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/5">
              <div
                className={`h-full rounded-full transition-all ${
                  nearCap ? 'bg-[var(--status-warn)]' : 'bg-[var(--accent)]'
                }`}
                style={{ width: `${width}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
