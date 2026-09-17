export function MetricTile({
  label,
  value,
  delta,
  meta,
  tone = 'neutral',
  variant = 'default',
}: {
  label: string;
  value: string;
  delta?: string;
  meta?: string;
  tone?: 'ok' | 'bad' | 'neutral';
  /** Elevated white card for number-first Home KPI row on the dark OS shell. */
  variant?: 'default' | 'elevated';
}) {
  const elevated = variant === 'elevated';

  const valueToneClass =
    tone === 'ok'
      ? elevated
        ? 'text-emerald-600'
        : 'text-[var(--status-ok)]'
      : tone === 'bad'
        ? elevated
          ? 'text-rose-600'
          : 'text-[var(--status-danger)]'
        : elevated
          ? 'text-zinc-900'
          : 'text-foreground';

  const deltaClass =
    tone === 'ok'
      ? elevated
        ? 'text-emerald-600'
        : 'text-[var(--status-ok)]'
      : tone === 'bad'
        ? elevated
          ? 'text-rose-600'
          : 'text-[var(--status-danger)]'
        : elevated
          ? 'text-zinc-500'
          : 'text-[var(--muted)]';

  return (
    <article
      className={
        elevated
          ? 'rounded-[var(--radius-lg)] border border-zinc-200/90 bg-white px-4 py-4 shadow-[0_1px_0_rgba(15,23,42,0.04)]'
          : 'rounded-[var(--radius-lg)] border border-[var(--border)] bg-black/25 px-4 py-4'
      }
    >
      <p
        className={
          elevated
            ? 'text-[10px] font-bold uppercase tracking-widest text-zinc-500'
            : 'text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]'
        }
      >
        {label}
      </p>
      <p
        className={`mt-2 font-mono text-2xl font-bold tracking-tight os-tabular ${valueToneClass}`}
      >
        {value}
      </p>
      {delta ? <p className={`mt-1 font-mono text-xs os-tabular ${deltaClass}`}>{delta}</p> : null}
      {meta ? (
        <p className={elevated ? 'mt-2 text-[11px] text-zinc-500' : 'mt-2 text-[11px] text-[var(--muted)]'}>
          {meta}
        </p>
      ) : null}
    </article>
  );
}
