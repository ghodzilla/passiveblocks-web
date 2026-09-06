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
  eyebrow?: string;
}

export function OsShell({ pathname, children, title, subtitle, eyebrow }: OsShellProps) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] opacity-80"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 15% -10%, rgba(59,130,246,0.22), transparent 55%), radial-gradient(ellipse 60% 50% at 85% 0%, rgba(74,222,128,0.08), transparent 50%)',
        }}
      />
      <header className="relative border-b border-[var(--border)]/80 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link href="/os" className="shrink-0">
                <Image
                  src="/passiveblocks_logo_cropped.png"
                  alt="PassiveBlocks"
                  width={148}
                  height={34}
                  className="h-8 w-auto"
                  priority
                />
              </Link>
              <span className="rounded-full border border-[var(--accent)]/30 bg-[var(--accent-muted)] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-[var(--accent-soft)]">
                Private OS
              </span>
              <span className="hidden rounded-full border border-[var(--status-ok)]/25 bg-[var(--status-ok)]/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-[var(--status-ok)] sm:inline">
                Paper · Vera-signed
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
                  className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition-all ${
                    active
                      ? 'bg-[var(--accent)] text-white shadow-[0_0_24px_rgba(59,130,246,0.35)]'
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

      <main className="relative mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
        <div className="mb-8 sm:mb-10">
          {eyebrow ? (
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[var(--accent-soft)]">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h1>
          {subtitle ? (
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--muted)] sm:text-base">
              {subtitle}
            </p>
          ) : null}
        </div>
        {children}
      </main>
    </div>
  );
}
