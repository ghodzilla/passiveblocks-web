interface Stat {
  label: string;
  value: string;
  hint?: string;
}

export function StatStrip({ stats }: { stats: Stat[] }) {
  return (
    <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map((s) => (
        <div
          key={s.label}
          className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
        >
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
            {s.label}
          </p>
          <p className="mt-1 font-mono text-xl font-bold tracking-tight text-foreground">{s.value}</p>
          {s.hint ? <p className="mt-1 text-[11px] text-[var(--muted)]">{s.hint}</p> : null}
        </div>
      ))}
    </div>
  );
}
