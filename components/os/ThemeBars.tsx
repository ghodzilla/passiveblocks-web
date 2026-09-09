import { formatPct, formatThemeLabel } from '@/lib/os-data';

export function ThemeBars({
  exposure,
  capPct,
  labels,
}: {
  exposure: Record<string, number>;
  capPct: number;
  labels?: Record<string, string>;
}) {
  const entries = Object.entries(exposure).sort((a, b) => b[1] - a[1]);
  return (
    <div className="space-y-3">
      {entries.map(([theme, pct]) => {
        const width = Math.min(100, (pct / capPct) * 100);
        const nearCap = pct / capPct >= 0.85;
        const key = theme.trim().toLowerCase();
        const name = labels?.[theme] ?? labels?.[key] ?? formatThemeLabel(theme);
        return (
          <div key={theme || name}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-[2.5rem] shrink-0 font-medium text-foreground">{name}</span>
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
