import Link from 'next/link';
import { OsShell } from '@/components/os/OsShell';
import { MetricTile } from '@/components/os/MetricTile';
import card from '@/data/os/liquidity-card.json';

export const metadata = {
  title: 'Letter · OS',
  robots: { index: false, follow: false },
};

export default function LetterPage() {
  return (
    <OsShell
      pathname="/os/letter"
      eyebrow="Issue 0"
      title="Weekly letter"
      subtitle="9 Sep 2026, Melbourne. Research only. Not Act. 40% is a filter, not a path."
    >
      <article className="max-w-3xl space-y-8 text-sm leading-relaxed text-foreground">
        <section className="space-y-3">
          <p>
            The roster agrees on the metal. It does not agree why, and it does not agree on crypto.
            The useful split is still which clock wins. This week’s tape does not settle it.
          </p>
          <p>
            Hold what the paper book already holds. Do not add gold to force a return. Do not treat
            bitcoin as the same trade as gold. There is no path to 40% in this file.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
            1. Cross-transcript
          </h2>
          <p>
            The only dense agreement is gold the metal. Direction agrees. The reason does not. One
            clock is China and central-bank liquidity. The other is fiscal dominance. Same metal,
            different test. Crypto is not one bid: a reopen after a sale, a rails bid, a bear-year
            inside a bull call, and an equity-lead story are four positions. Copper the metal is
            cited. Copper juniors and equipment baskets are not that call.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
            2. Liquidity, three columns
          </h2>
          <p className="mb-3 text-xs text-[var(--muted)]">
            Pulled 9 Sep from the sources named. Not the July board. {card.absent}
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <MetricTile label="Stablecoins" value="$309.85bn" delta="+1.44bn 7d" meta="8 Sep · DefiLlama" tone="ok" />
            <MetricTile label="BTC ETFs" value="+$770m" delta="1–4 Sep" meta="4 Sep · Farside" tone="ok" />
            <MetricTile label="ETH ETFs" value="+$127.7m" delta="1–4 Sep" meta="4 Sep · Farside" tone="ok" />
          </div>
          <p className="mt-2 text-xs text-[var(--muted)]">
            Basis, gold flow, and a global-liquidity index are insufficient. Full card on{' '}
            <Link href="/os/liquidity" className="underline-offset-2 hover:underline">
              Liquidity
            </Link>
            .
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
            3. Correlation
          </h2>
          <p>{card.visible_note}</p>
          <p className="mt-3">
            Completed 1–4 Sep spot ETF sessions were inflows. Stablecoin supply rose over seven days
            to 8 Sep. That does not confirm a September crypto drain, and it does not test the
            global-liquidity clock. Official prints disagree with each other: the Treasury account
            fell into 4 Sep, while reserve balances on the 2 Sep weekly print were down. Neither
            print is a gold flow.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
            4. High conviction, and 40%
          </h2>
          <p>
            Research slate only. Already in the paper book, or already the falsifier row. Not a new
            weight. Not a modeled return.
          </p>
          <ul className="mt-3 space-y-2">
            <li>Gold. Hold the metal. The agree is the metal, not the story.</li>
            <li>Silver. Hold with gold. Not a fresh add.</li>
            <li>Copper. Hold the metal. Not the miners, not the equipment name.</li>
            <li>Bitcoin. Hold, with the liquidity clock still open. Not an add, and not gold.</li>
          </ul>
          <p className="mt-3">
            Left off on purpose: Solana, Caterpillar, Tesla, a second operator ticket, more
            semiconductors, oil on a headline. No fifth name is both multi-voice and high conviction
            this issue. 40% is the filter that rejected a made-up path. It is not a target the book
            is sized to.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
            5. What to sit with
          </h2>
          <p>
            The aha is not “buy more of the chorus.” You already own it. The unused edge is which
            clock wins, and this week’s flows do not pick. Paper stays hold.
          </p>
        </section>
      </article>
    </OsShell>
  );
}
