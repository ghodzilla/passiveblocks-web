export function MetricTile({
  label,
  value,
  delta,
  meta,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  delta?: string;
  meta?: string;
  tone?: 'ok' | 'bad' | 'neutral';
}) {
  const deltaClass =
    tone === 'ok'
      ? 'text-[var(--status-ok)]'
      : tone === 'bad'
        ? 'text-[var(--status-bad)]'
        : 'text-[var(--muted)]';

  return (
    <article className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-black/25 px-4 py-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
        {label}
      </p>
      <p className="mt-2 font-mono text-2xl font-semibold tracking-tight text-foreground">{value}</p>
      {delta ? <p className={`mt-1 font-mono text-xs ${deltaClass}`}>{delta}</p> : null}
      {meta ? <p className="mt-2 text-[11px] text-[var(--muted)]">{meta}</p> : null}
    </article>
  );
}
