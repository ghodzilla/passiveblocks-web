interface EmptyStateProps {
  title: string;
  description: string;
  waitingOn?: string;
  skeleton?: 'signal' | 'sources';
}

function SignalSkeleton() {
  return (
    <div className="mt-8 space-y-3 text-left">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="flex items-start gap-3 rounded-[var(--radius-md)] border border-dashed border-[var(--border)] bg-black/20 px-4 py-3 opacity-70"
          style={{ opacity: 0.55 - i * 0.12 }}
        >
          <div className="mt-0.5 h-8 w-8 shrink-0 rounded-lg bg-white/[0.04]" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3 w-2/5 rounded bg-white/[0.06]" />
            <div className="h-2.5 w-4/5 rounded bg-white/[0.04]" />
            <div className="h-2.5 w-3/5 rounded bg-white/[0.03]" />
          </div>
          <div className="h-5 w-14 shrink-0 rounded-full border border-[var(--border)]" />
        </div>
      ))}
    </div>
  );
}

function SourcesSkeleton() {
  return (
    <div className="mt-8 overflow-hidden rounded-[var(--radius-md)] border border-dashed border-[var(--border)] text-left">
      <div className="grid grid-cols-[1fr_auto_auto] gap-3 border-b border-[var(--border)] bg-black/20 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
        <span>Source</span>
        <span>Type</span>
        <span>Status</span>
      </div>
      {['Transcript pack', 'Theme note', 'Monitor hit'].map((label, i) => (
        <div
          key={label}
          className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-[var(--border)] px-4 py-3 last:border-0"
          style={{ opacity: 0.5 - i * 0.1 }}
        >
          <div>
            <p className="text-sm text-[var(--muted)]">{label}</p>
            <div className="mt-1.5 h-2 w-40 rounded bg-white/[0.04]" />
          </div>
          <div className="h-5 w-16 rounded-full bg-white/[0.04]" />
          <div className="h-5 w-20 rounded-full border border-[var(--border)]" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ title, description, waitingOn, skeleton }: EmptyStateProps) {
  return (
    <div className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] px-6 py-10 sm:px-10">
      <div className="mx-auto max-w-xl text-center">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--border-strong)] bg-[var(--accent-muted)] shadow-[0_0_40px_rgba(59,130,246,0.15)]">
          <span className="text-lg font-black text-[var(--accent-soft)]">⌀</span>
        </div>
        <h2 className="text-xl font-bold tracking-tight text-foreground">{title}</h2>
        <p className="mx-auto mt-3 text-sm leading-relaxed text-[var(--muted)]">{description}</p>
        {waitingOn ? (
          <p className="mt-5 inline-flex rounded-full border border-[var(--border)] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
            Waiting on · {waitingOn}
          </p>
        ) : null}
      </div>
      {skeleton === 'signal' ? <SignalSkeleton /> : null}
      {skeleton === 'sources' ? <SourcesSkeleton /> : null}
    </div>
  );
}
