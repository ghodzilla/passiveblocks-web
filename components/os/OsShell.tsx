import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';

const NAV = [
  { href: '/os', label: 'Home', exact: true },
  { href: '/os/conviction', label: 'Conviction' },
  { href: '/os/book', label: 'Book' },
  { href: '/os/risk', label: 'Risk' },
  { href: '/os/signal', label: 'Signal' },
  { href: '/os/sources', label: 'Sources' },
] as const;

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

interface OsShellProps {
  pathname: string;
  children: ReactNode;
  title: string;
  subtitle?: string;
}

export function OsShell({ pathname, children, title, subtitle }: OsShellProps) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-[var(--border)] px-4 sm:px-6">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link href="/os">
                <Image
                  src="/passiveblocks_logo_cropped.png"
                  alt="PassiveBlocks"
                  width={148}
                  height={34}
                  className="h-8 w-auto"
                  priority
                />
              </Link>
              <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">
                Private OS
              </span>
            </div>
            <Link
              href="/"
              className="text-xs text-[var(--muted)] transition-colors hover:text-foreground"
            >
              Public site
            </Link>
          </div>
          <nav className="flex gap-1 overflow-x-auto pb-1">
            {NAV.map((item) => {
              const active = isActive(pathname, item.href, 'exact' in item ? item.exact : false);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`whitespace-nowrap rounded-[var(--radius-sm)] px-3 py-1.5 text-sm font-medium transition-colors ${
                    active
                      ? 'bg-[var(--accent-muted)] text-[var(--accent-soft)]'
                      : 'text-[var(--muted)] hover:bg-[var(--surface)] hover:text-foreground'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <div className="mb-8">
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
          {subtitle ? (
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
              {subtitle}
            </p>
          ) : null}
        </div>
        {children}
      </main>
    </div>
  );
}
