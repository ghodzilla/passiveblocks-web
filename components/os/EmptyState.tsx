interface EmptyStateProps {
  title: string;
  description: string;
  waitingOn?: string;
}

export function EmptyState({ title, description, waitingOn }: EmptyStateProps) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] px-6 py-12 text-center sm:px-10">
      <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border-strong)] bg-[var(--accent-muted)]">
        <span className="text-sm font-bold text-[var(--accent-soft)]">·</span>
      </div>
      <h2 className="text-lg font-bold text-foreground">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[var(--muted)]">
        {description}
      </p>
      {waitingOn ? (
        <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
          Waiting on · {waitingOn}
        </p>
      ) : null}
    </div>
  );
}
