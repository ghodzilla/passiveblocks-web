import Link from 'next/link';

type OsStamp = 'show' | 'act' | 'sense';

interface OsCardProps {
  href: string;
  label: string;
  title: string;
  description: string;
  /** Phase 2: Show / Act / Sense stamp language (never invent ranks). */
  stamp: OsStamp;
  meta?: string;
}

const STAMP_LABEL: Record<OsStamp, string> = {
  show: 'Show',
  act: 'Act',
  sense: 'Sense',
};

export function OsCard({
  href,
  label,
  title,
  description,
  stamp,
  meta,
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
        <span className={`os-stamp os-stamp--${stamp}`}>{STAMP_LABEL[stamp]}</span>
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
