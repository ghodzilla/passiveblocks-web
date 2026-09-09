import type { ReactNode } from 'react';

const HOWELL = {
  date: '2026-08-11',
  url: 'https://www.youtube.com/watch?v=FPB4Z1KhE3s',
  title: 'Liquidity Has Turned, Low Quality Returns Ahead for Stocks, and Real Driver of Gold',
} as const;

const GROMEN = {
  date: '2026-08-28',
  url: 'https://www.youtube.com/watch?v=R1VLmuXYU3o',
  title: 'Some quick thoughts on gold, BTC, and “my framework”',
} as const;

function CiteLink({ href, title, children }: { href: string; title: string; children: ReactNode }) {
  return (
    <a
      href={href}
      title={title}
      target="_blank"
      rel="noreferrer"
      className="font-medium text-[var(--accent-soft)] underline-offset-2 hover:underline"
    >
      {children}
    </a>
  );
}

function LeadProse({ compact = false }: { compact?: boolean }) {
  const body = compact
    ? 'space-y-2.5 text-xs leading-relaxed text-foreground'
    : 'max-w-3xl space-y-3 text-sm leading-relaxed text-foreground';

  return (
    <div className={body}>
      <p>
        The only thing the roster actually agrees on is gold the metal. They do not agree why, and they
        do not agree on crypto.
      </p>
      <p>
        <CiteLink href={HOWELL.url} title={`${HOWELL.title} (${HOWELL.date})`}>
          Michael Howell (11 Aug)
        </CiteLink>
        {' is bullish gold near term and still bearish bitcoin. His reason is not “debasement.” He says this rally is China and PBOC liquidity, and that Chinese buyers who cannot buy crypto are in the metal instead. His liquidity rate-of-change is falling. That call has not been updated.'}
      </p>
      <p>
        <CiteLink href={GROMEN.url} title={`${GROMEN.title} (${GROMEN.date})`}>
          Luke Gromen (28 Aug)
        </CiteLink>
        {' is the other pole. Fiscal dominance, “all roads lead to gold,” and he flipped bitcoin back to bullish after selling most of his from 120k to 96k. That is a reopen, not a high-conviction join of Visser’s rails bid. Hayes, on the same side of the tape, is bullish bitcoin and still calls 2026 a bear year with a retrace. Tom Lee is talking about equities leading. These are not one crypto bid.'}
      </p>
      <p>
        You already own the chorus: gold, silver, copper, bitcoin, ether. Adding more gold does not
        answer the open question. The question is whether Howell is early. This week’s flow card cannot
        settle it. Spot bitcoin ETFs took in about $770m over 1–4 Sep (Farside). Stablecoin supply rose
        about $1.4bn over seven days to 8 Sep. 8 Sep SoSoValue is a small outflow and Farside has not
        printed that day. There is no gold flow and no PBOC print on the card. So the tape does not
        confirm a September crypto drain, and it does not test Howell’s global-liquidity clock.
      </p>
      <p>
        What to sit with: hold the metal. Do not treat bitcoin as the same trade as gold until a flow
        print or a later Howell tape says the liquidity clock has turned. Copper the metal is cited;
        copper juniors and Caterpillar are not a three-desk agree. No path to 40% is in this file.
      </p>
    </div>
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
        <div className="mb-2 flex flex-wrap items-center justify-end gap-2">
          <span className={stampClass}>{stampLabel}</span>
        </div>
        <LeadProse compact />
      </section>
    );
  }

  return (
    <section className="mb-8 rounded-[var(--radius-xl)] border border-[var(--os-sense-border)] bg-[var(--surface)] p-5">
      <div className="mb-4 flex flex-wrap items-center justify-end gap-3">
        <span className={stampClass}>{stampLabel}</span>
      </div>
      <LeadProse />
    </section>
  );
}
