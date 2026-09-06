import Link from 'next/link';

interface OsCardProps {
  href: string;
  label: string;
  title: string;
  description: string;
  status?: string;
  meta?: string;
  accent?: 'ok' | 'warn' | 'accent' | 'neutral';
}

const statusTone = {
  ok: 'border-[var(--status-ok)]/30 text-[var(--status-ok)] bg-[var(--status-ok)]/10',
  warn: 'border-[var(--status-warn)]/30 text-[var(--status-warn)] bg-[var(--status-warn)]/10',
  accent: 'border-[var(--accent)]/30 text-[var(--accent-soft)] bg-[var(--accent-muted)]',
  neutral: 'border-[var(--border)] text-[var(--muted)] bg-transparent',
};

export function OsCard({
  href,
  label,
  title,
  description,
  status,
  meta,
  accent = 'neutral',
}: OsCardProps) {
  return (
    <Link
      href={href}
      className="group relative block overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] p-5 transition-all hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)] hover:shadow-[0_20px_50px_rgba(0,0,0,0.35)]"
    >
      <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[var(--accent)]/10 blur-2xl transition-opacity group-hover:opacity-100" />
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
          {label}
        </p>
        {status ? (
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${statusTone[accent]}`}
          >
            {status}
          </span>
        ) : null}
      </div>
      <h3 className="text-lg font-bold tracking-tight text-foreground transition-colors group-hover:text-[var(--accent-soft)]">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{description}</p>
      {meta ? (
        <p className="mt-4 font-mono text-xs text-[var(--accent-soft)]">{meta}</p>
      ) : null}
    </Link>
  );
}
