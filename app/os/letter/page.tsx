import {
  Fig01HeroParadox,
  Fig02Mechanism,
  Fig03CompareStrip,
  Fig04PulseTiles,
  Fig05RadarTimeline,
} from '@/components/os/letter';
import { OsShell } from '@/components/os/OsShell';

export const metadata = {
  title: 'Letter · Issue 2 · OS',
  robots: { index: false, follow: false },
};

const PRIMARY_SOURCES = [
  { label: 'Jordi Visser 2026-09-06', href: 'https://www.youtube.com/watch?v=er5mqvbDQU8' },
  { label: 'Jordi Visser 2026-08-23', href: 'https://www.youtube.com/watch?v=FoSLsvUKvws' },
  { label: 'Jordi Visser 2026-08-30', href: 'https://www.youtube.com/watch?v=2FND8g-De8Y' },
  { label: 'Michael Howell 2026-08-11', href: 'https://www.youtube.com/watch?v=FPB4Z1KhE3s' },
  { label: 'Luke Gromen 2026-08-28', href: 'https://www.youtube.com/watch?v=R1VLmuXYU3o' },
  { label: 'Arthur Hayes 2026-08-21', href: 'https://www.youtube.com/watch?v=0b_nJ53uiA0' },
  { label: 'Tom Lee 2026-09-02', href: 'https://www.youtube.com/watch?v=fOMlh1gq33g' },
  { label: 'Farside BTC', href: 'https://farside.co.uk/btc/' },
  { label: 'Farside ETH', href: 'https://farside.co.uk/eth/' },
  { label: 'SoSoValue BTC', href: 'https://sosovalue.com/assets/etf/us-btc-spot' },
  { label: 'SoSoValue ETH', href: 'https://sosovalue.com/assets/etf/us-eth-spot' },
  { label: 'DefiLlama stables', href: 'https://stablecoins.llama.fi/stablecoincharts/all' },
  { label: 'FRED ON RRP', href: 'https://fred.stlouisfed.org/series/RRPONTSYD' },
  { label: 'FRED HY OAS', href: 'https://fred.stlouisfed.org/series/BAMLH0A0HYM2' },
] as const;

const RADAR_ROWS = [
  {
    watch: '2026-09-21',
    why: 'Brief valid_until — Sense/Decide refresh required; this letter’s window closes with the brief.',
  },
  {
    watch: 'Howell falsifier #4',
    why: 'Live unrebutted. Watch for a GLI / accepted liquidity-momentum print — or a voice rebuttal. ETF/stables alone do not clear.',
  },
  {
    watch: 'Copper N',
    why: 'Stay do-not-add. Existing COPPER HOLD; no mandated trim without Vera. Company-pitch ≠ desk OW.',
  },
  {
    watch: 'Tom Lee 2026-09-01 PARTIAL',
    why: 'Still a gate condition (~19 lines). Does not open an equity OW.',
  },
  {
    watch: 'Liquidity card freshness',
    why: 'Last good tape is still the 2026-09-09 card(s). Any print after those as-ofs = INSUFFICIENT until a new fetch.',
  },
  {
    watch: 'Falsifiers #1–#3, #5',
    why: 'Still live on the brief (debasement break; Hormuz normalization — Zeihan thickens #2 context only; AI demand break; duration vindication).',
  },
] as const;

export default function LetterPage() {
  return (
    <OsShell
      pathname="/os/letter"
      eyebrow="Issue 2 · Show ≠ Act"
      title="Passive Blocks Weekly"
      subtitle="Passive Income × Growth · Week of September 15–21, 2026 · crypto split deep dive · paper HOLD"
    >
      <article className="mx-auto max-w-4xl space-y-12 text-sm leading-relaxed text-foreground">
        {/* Masthead */}
        <header className="space-y-3 border-b border-[var(--border)] pb-8">
          <div className="flex flex-wrap items-center gap-2">
            <span className="os-stamp os-stamp--show">Issue 2</span>
            <span className="os-stamp">Monday 2026-09-21 · Melbourne</span>
            <span className="os-stamp os-stamp--sense">GATE_OPEN · valid_until 21 Sep</span>
            <span className="os-stamp os-stamp--act">Paper · HOLD</span>
          </div>
          <p className="text-xs text-[var(--muted)]">
            Craft: Shaan Puri voice × Broadcom-PDF structure · Vera figure-clear 2026-09-16 · no new
            investable claim
          </p>
        </header>

        {/* Lede */}
        <section className="space-y-4">
          <h2 className="sr-only">Lede</h2>
          <p className="text-base leading-relaxed text-foreground sm:text-lg">
            The bull side of crypto got louder this cycle. Jordi Visser’s 6 Sep tape reiterates
            BTC/ETH/SOL and tokenization as bullish/high — a real thicken of the overweight case. The
            kill switch is still blank. Michael Howell’s near-term liquidity-kill falsifier (#4) has
            no rebuttal voice in the corpus, and the Sep 9 liquidity card still leaves the
            global-liquidity momentum cell{' '}
            <span className="font-semibold text-[var(--muted)]">INSUFFICIENT</span> (Hole. Not zero.).
            ETF week inflows and a stables 7d print do not adjudicate that cell. This issue exists to
            hold that paradox in one frame — not to average it away.
          </p>
        </section>

        {/* FIG-01 Hero */}
        <Fig01HeroParadox />

        {/* Deep dive 1 */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            The bull side got louder
          </h2>
          <p>
            Anyone who tells you “crypto OW is settled” is quoting the wrong half of the split.
          </p>
          <p>
            On 6 Sep, Jordi Visser reiterated BTC, ETH, SOL, and the crypto/tokenization theme as{' '}
            <span className="font-semibold">bullish/high</span>. That sits on top of the prior bull
            cluster already on the brief: Visser 23 Aug / 30 Aug, Gromen 28 Aug, Hayes 21 Aug, Tom Lee
            2 Sep. Decide kept Theme #4 as{' '}
            <span className="font-mono text-xs">OW · low_to_medium · split only</span> because the
            paper already holds BTC/ETH and the GATE default under Sense was OW-with-split — not
            because the desk suddenly agreed on one mechanism.
          </p>
          <p>
            What the new wave does <span className="font-semibold">not</span> do: clear the other
            side. Howell’s 11 Aug near-term crypto bear (falsifier #4 — falling-liquidity momentum
            dominates the debasement-crypto bid) remains unrebutted as a voice. No later Howell row
            lands in the freeze. Jordi 09-06 is a bull thicken. It is not a Howell rebuttal. It does
            not fill a GLI cell.
          </p>
          <p className="rounded-[var(--radius-md)] border border-[var(--border)] bg-black/20 px-4 py-3 text-[var(--muted)]">
            <span className="font-semibold text-foreground">The lazy take to kill:</span> “More bull
            cites = the OW is confirmed.” Wrong number. Cite count on one side of a split is not a
            falsifier test.
          </p>
        </section>

        {/* Deep dive 2 + FIG-02 / FIG-03 */}
        <section className="space-y-5">
          <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            ETF week is not the kill switch
          </h2>
          <p>
            Here is the mechanism people want to skip: tradfi→crypto bridge prints can look fine while
            the Howell test stays empty.
          </p>
          <Fig02Mechanism />
          <p>
            Read them straight. Four complete Farside sessions into early September are net{' '}
            <span className="font-semibold">inflows</span>, not a redemption wave. One post-holiday
            SoSoValue session (8 Sep) after those inflows is{' '}
            <span className="font-semibold">not</span> a cycle reverse. Stables 7d up is{' '}
            <span className="font-semibold">not</span> an on-chain dollar-stock contraction.
          </p>
          <p>
            None of that is Howell’s global-liquidity rate-of-change. The brief and Sense INPUT both
            say it out loud: these prints <span className="font-semibold">do not adjudicate</span>{' '}
            falsifier #4. The GLI / Howell falsifier cell on the card is{' '}
            <span className="font-semibold text-[var(--muted)]">INSUFFICIENT</span>. Hole. Not zero.
            Jordi 09-06 does not fill it either.
          </p>
          <Fig03CompareStrip />
          <p className="text-xs text-[var(--muted)]">
            The evening live card later filled Farside’s own 8 Sep session at BTC{' '}
            <span className="font-mono">−46.6 US$m</span> / ETH{' '}
            <span className="font-mono">−24.3 US$m</span> — same direction as SoSoValue, still not a
            GLI print. September named complete-session sums on that live card (BTC{' '}
            <span className="font-mono">723.4</span> / ETH <span className="font-mono">103.4</span>{' '}
            US$m through 8 Sep) still do not retire the falsifier.
          </p>
        </section>

        {/* Deep dive 3 */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            The kill switch is still blank
          </h2>
          <p>
            Falsifier #4, as locked on the 14 Sep brief:{' '}
            <span className="font-semibold">Liquidity kill for crypto</span> — Howell
            falling-liquidity momentum dominates the debasement-crypto bid. Status:{' '}
            <span className="font-semibold">Live — unrebutted voice; GLI cell INSUFFICIENT on card.</span>
          </p>
          <p>
            That is the paradox this letter is built for. Bull cluster thickened. Kill criteria
            unchanged. If you need a one-liner for the desk:{' '}
            <span className="font-semibold">
              crypto OW is a split you can hold, not a split you can celebrate.
            </span>
          </p>
          <p>
            Diego’s documented fork (brief): the stance would go <span className="font-mono">N</span>{' '}
            if the bar required an unrebutted-bear test with no GLI print. Under continuing GATE
            language, Decide retained <span className="font-semibold">split OW</span> with falsifier
            #4 live. Paper stays <span className="font-semibold">HOLD</span> on BTC/ETH either way —
            no average-down, no “Howell aged out,” no new Act without Vera book-sign +{' '}
            <span className="font-mono text-xs">theme_regime_brief_ref</span>.
          </p>
          <p>
            What would actually move the cell: a named global-liquidity momentum print (or an accepted
            proxy Decide adopts), or a later Howell-class voice that rebuts the near-term bear. ETF
            week and stables 7d are not that print. Guest tape is not that print. A single-seat SOL
            reiteration is not that print.
          </p>
        </section>

        {/* Continuity */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            What else stayed quiet
          </h2>
          <p className="text-[var(--muted)]">
            So the deep dive doesn’t pretend the book is only crypto.
          </p>
          <p>
            Fiscal-dominance / hard-asset hedge is still the regime frame.{' '}
            <span className="font-semibold">Gold</span> remains the only dense independent multi-seat
            OW (Gromen, Visser, Howell, Rule, Hayes). <span className="font-semibold">Silver</span> OW
            medium. <span className="font-semibold">Copper</span> stays{' '}
            <span className="font-mono text-xs">N (watch)</span> — company-pitch / scarcity tape, zero
            new independent desk OW this wave; existing COPPER paper line HOLD, do-not-add.{' '}
            <span className="font-semibold">AI/semis N</span> — Jordi 09-06 NVDA bullish/high + agentic
            thematic medium does <span className="font-semibold">not</span> upgrade N→OW.{' '}
            <span className="font-semibold">Long duration UW</span> — Jordi 09-06 duration neutral
            reiterated ≠ OW. Zeihan 8–9 Sep energy geography thickens falsifier #2 context only — not
            a sixth theme. Jordi S&P bearish→neutral is a <span className="font-semibold">call</span>,
            not a theme rewrite.
          </p>
          <p className="text-xs text-[var(--muted)]">
            Those are the continuity holes from Issue 1, closed where Decide closed them — not
            re-litigated as a second deep dive.
          </p>
        </section>

        {/* The posture */}
        <section className="space-y-4 rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
          <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            The posture
          </h2>
          <p className="text-base font-semibold text-foreground">Own the paradox, not the average.</p>
          <ul className="space-y-3 text-[var(--muted)]">
            <li>
              <span className="font-semibold text-foreground">Research posture:</span> crypto rails
              stay on the map as <span className="font-mono text-xs text-foreground">split OW</span>{' '}
              with falsifier #4 in the same sentence. Gold remains the denser hard-asset sleeve.
              Copper is watch/N, not a chase.
            </li>
            <li>
              <span className="font-semibold text-foreground">Paper book:</span>{' '}
              <span className="font-semibold text-foreground">HOLD</span> (STATUS / brief). No
              weights. No sizes. No Act from this letter.
            </li>
            <li>
              <span className="font-semibold text-foreground">Do not:</span> average Howell away
              because Farside week / stables 7d look fine; promote SOL or HOOD as Core from a single
              seat; restore copper discovery names to OW cluster; AI-chase adds; long-duration adds;
              invent a GLI number to “finish” the card.
            </li>
            <li>
              <span className="font-semibold text-foreground">Show ≠ Act.</span> Theme labels are
              stances, not ranks. Stretch ≥40%/year is a research filter only — never a promised path
              and never a reason to invent a flow.
            </li>
          </ul>
        </section>

        {/* On the Radar + FIG-05 */}
        <section className="space-y-5">
          <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            On the Radar
          </h2>
          <Fig05RadarTimeline />
          <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)]">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-black/20 text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
                  <th className="px-4 py-2.5">Date / watch</th>
                  <th className="px-4 py-2.5">Why it matters</th>
                </tr>
              </thead>
              <tbody>
                {RADAR_ROWS.map((row) => (
                  <tr key={row.watch} className="border-b border-[var(--border)] last:border-0">
                    <td className="whitespace-nowrap px-4 py-3 align-top font-mono text-xs font-semibold text-[var(--accent-soft)]">
                      {row.watch}
                    </td>
                    <td className="px-4 py-3 text-[var(--muted)]">{row.why}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Pulse */}
        <section className="space-y-5">
          <p className="text-xs text-[var(--muted)]">
            As-of stamps from <span className="font-mono">liquidity-card-2026-09-09.md</span> (+ live
            evening twin where noted) and theme-regime-2026-09-14 only. No invented later prints.
          </p>
          <Fig04PulseTiles />
          <div className="grid gap-2 rounded-[var(--radius-lg)] border border-[var(--border)] bg-black/20 px-4 py-3 text-xs text-[var(--muted)] sm:grid-cols-3">
            <p>
              <span className="font-semibold text-foreground">Crypto theme stance</span>
              <br />
              OW · split only · falsifier #4 live · 2026-09-14
            </p>
            <p>
              <span className="font-semibold text-foreground">Paper book</span>
              <br />
              HOLD · 2026-09-14 · STATUS.json
            </p>
            <p>
              <span className="font-semibold text-foreground">Gate</span>
              <br />
              GATE_OPEN · valid_until 2026-09-21
            </p>
          </div>
        </section>

        {/* Sources */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">Sources</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
                Internal (framing + facts)
              </p>
              <ul className="mt-3 space-y-1.5 font-mono text-[11px] text-[var(--muted)]">
                <li>decide/LETTER_CRAFT_SHAAN.md</li>
                <li>decide/WEEKLY_LETTER.md</li>
                <li>decide/briefs/STATUS.json</li>
                <li>decide/briefs/theme-regime-2026-09-14.md</li>
                <li>signal-db/liquidity-card-2026-09-09.md</li>
                <li>signal-db/liquidity-card-2026-09-09-live.md</li>
                <li>signal-db/theme-regime-refresh-input-2026-09-14.md</li>
                <li>letters/2026-09-14.md · continuity only</li>
                <li>risk/signs/…figures-clear.json · Vera</li>
              </ul>
            </div>
            <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
                Primary URLs (from those files only)
              </p>
              <ul className="mt-3 space-y-1.5 text-[11px]">
                {PRIMARY_SOURCES.map((s) => (
                  <li key={s.href}>
                    <a
                      href={s.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--accent-soft)] underline-offset-2 hover:underline"
                    >
                      {s.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Disclaimer */}
        <section className="rounded-[var(--radius-xl)] border border-dashed border-[var(--border-strong)] bg-black/20 px-5 py-5 sm:px-6">
          <h2 className="text-sm font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
            Disclaimer
          </h2>
          <p className="mt-3 text-xs leading-relaxed text-[var(--muted)]">
            Commentary for Passive Blocks research readers — <span className="font-semibold">not</span>{' '}
            investment advice, not a solicitation, not a portfolio instruction. Sense OW/N/UW are
            stances, not ranks. <span className="font-semibold text-foreground">Show ≠ Act.</span>{' '}
            Paper book remains <span className="font-semibold text-foreground">HOLD</span>; this letter
            does not size the book and does not authorize new Act lines. New Act still needs Vera
            book-sign + <span className="font-mono">theme_regime_brief_ref</span>. Stretch ≥40%/year
            is a research filter, not a promised return. Every figure above is cited from the files
            listed or marked <span className="font-semibold">INSUFFICIENT</span> / Hole. Not zero.
          </p>
          <p className="mt-4 text-[10px] text-[var(--muted-foreground)]">
            Issue 2 · Nora render · Vera figure-clear 2026-09-16 · hold for Diego merge · scores/Act
            untouched
          </p>
        </section>
      </article>
    </OsShell>
  );
}
