import type { ReactNode } from 'react';

export const SPLIT_COPY = {
  kicker: 'Open question',
  line: 'Gold agrees on direction; mechanism and crypto do not.',
  doNotAverage: 'Do not average them.',
  stanceLaw: 'Sense OW/N/UW stay stances, never ranks.',
  howell: {
    figure: 'Howell',
    date: '2026-08-11',
    url: 'https://www.youtube.com/watch?v=FPB4Z1KhE3s',
    title: 'Liquidity Has Turned, Low Quality Returns Ahead for Stocks, and Real Driver of Gold',
    points: [
      'Gold near-term also bullish, but he rejects “great debasement” as the driver (China / PBOC liquidity; Chinese bid to gold not crypto).',
      'Bitcoin / crypto (near-term) bearish, reiterated.',
      'Global liquidity rate-of-change inflecting lower (his framework, not a dated index we publish).',
    ],
  },
  gromen: {
    figure: 'Gromen',
    date: '2026-08-28',
    url: 'https://www.youtube.com/watch?v=R1VLmuXYU3o',
    title: 'Some quick thoughts on gold, BTC, and “my framework”',
    points: [
      'Gold “all roads lead to gold” under fiscal dominance.',
      'BTC flip bullish, debt-debasement trade “back on” after selling most 120k→96k.',
    ],
  },
} as const;

function CiteLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="font-medium text-[var(--accent-soft)] underline-offset-2 hover:underline"
    >
      {children}
    </a>
  );
}

function Pole({
  figure,
  date,
  url,
  title,
  points,
}: {
  figure: string;
  date: string;
  url: string;
  title: string;
  points: readonly string[];
}) {
  return (
    <article className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-black/20 p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
        Cite
      </p>
      <h3 className="mt-1 text-sm font-semibold tracking-tight text-foreground">
        <CiteLink href={url}>
          {figure} {date}
        </CiteLink>
      </h3>
      <p className="mt-1 text-[11px] leading-relaxed text-[var(--muted)]">{title}</p>
      <ul className="mt-3 space-y-2">
        {points.map((point) => (
          <li key={point} className="flex gap-2 text-xs leading-relaxed text-[var(--muted)]">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[var(--muted-foreground)]" />
            <span>{point}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

export function RosterSplit({
  stamp = 'sense',
  variant = 'lead',
}: {
  stamp?: 'sense' | 'show';
  variant?: 'lead' | 'banner';
}) {
  const stampClass = stamp === 'show' ? 'os-stamp os-stamp--show' : 'os-stamp os-stamp--sense';
  const stampLabel = stamp === 'show' ? 'Show · not Act' : 'Sense · not Act';

  if (variant === 'banner') {
    return (
      <section className="mb-4 rounded-[var(--radius-lg)] border border-[var(--os-show-border)] bg-[var(--os-show-bg)] px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
            {SPLIT_COPY.kicker} · Howell vs debasement
          </p>
          <span className={stampClass}>{stampLabel}</span>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-foreground">
          {SPLIT_COPY.line} {SPLIT_COPY.doNotAverage}
        </p>
        <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">
          <CiteLink href={SPLIT_COPY.howell.url}>Howell {SPLIT_COPY.howell.date}</CiteLink>
          {' — gold near-term also bullish; rejects “great debasement” (China / PBOC liquidity; Chinese bid to gold not crypto). '}
          <span className="text-foreground">Bitcoin / crypto (near-term)</span>
          {' bearish, reiterated. Global liquidity rate-of-change inflecting lower (his framework, not a dated index we publish). '}
          <CiteLink href={SPLIT_COPY.gromen.url}>Gromen {SPLIT_COPY.gromen.date}</CiteLink>
          {' — gold “all roads lead to gold” under fiscal dominance; BTC flip bullish, debt-debasement trade “back on” after selling most 120k→96k.'}
        </p>
        <p className="mt-2 text-[11px] text-[var(--muted)]">
          {SPLIT_COPY.stanceLaw} Does not reorder Show scores or Act weights.
        </p>
      </section>
    );
  }

  return (
    <section className="mb-8 rounded-[var(--radius-xl)] border border-[var(--os-sense-border)] bg-[var(--surface)] p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
            {SPLIT_COPY.kicker}
          </p>
          <h2 className="mt-1 text-lg font-bold tracking-tight text-foreground">
            Howell vs debasement
          </h2>
        </div>
        <span className={stampClass}>{stampLabel}</span>
      </div>
      <p className="max-w-3xl text-sm leading-relaxed text-foreground">
        {SPLIT_COPY.line} {SPLIT_COPY.doNotAverage}
      </p>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <Pole {...SPLIT_COPY.howell} />
        <Pole {...SPLIT_COPY.gromen} />
      </div>
      <p className="mt-4 text-[11px] leading-relaxed text-[var(--muted)]">
        {SPLIT_COPY.stanceLaw} Two poles, not a chorus and not a rank.
      </p>
    </section>
  );
}
