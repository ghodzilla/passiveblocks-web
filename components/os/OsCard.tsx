import Link from 'next/link';

interface OsCardProps {
  href: string;
  label: string;
  title: string;
  description: string;
  status?: string;
}

export function OsCard({ href, label, title, description, status }: OsCardProps) {
  return (
    <Link
      href={href}
      className="group block rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
          {label}
        </p>
        {status ? (
          <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
            {status}
          </span>
        ) : null}
      </div>
      <h3 className="text-base font-bold text-foreground group-hover:text-[var(--accent-soft)] transition-colors">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{description}</p>
    </Link>
  );
}
