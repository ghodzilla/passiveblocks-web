# PassiveBlocks — Issue #4
**Ship date:** Friday (blocked on Beehiiv PB pub setup)
**Style:** smart-friend — hook, our-data sections, DeFi explainer, yields, bot, tool
**Status:** IN PROGRESS — started 2026-06-16. Our-data-only per Issue #2 lesson (no unverifiable external market sections). Opening + Top Picks drafted; Bot Diary / Educational / Tool scaffolded.

---

## Subject line options

1. Our bot made 0 trades last quarter. That was the highest-return decision it made.
2. The most profitable thing we did in 90 days: nothing.
3. What "doing nothing" actually earned — a 0-trade quarter, costed out.

## Preview text

We ran the numbers on a quarter of zero rebalances. Patience beat the leaderboard — and here's the dollar receipt.

---

## BODY

---

### 🪝 What I watched this week

**Our bot just crossed a quarter of being live. In that time it scanned for better yield every few hours — call it 700+ checks — and rebalanced exactly zero times. Zero gas spent. Zero positions moved.**

That sounds like a broken bot. It isn't. Every check, it compared what it holds — USDC lending at 5.19% on Base and 4.63% on Arbitrum — against the higher numbers flashing on every yield dashboard. And every check, once it adjusted those higher numbers for the things the leaderboard hides (utilisation, reserve factor, exit speed), the "better" pool failed to clear our buffer.

So it did nothing. And doing nothing kept 100% of a steady ~5% real return — no gas drag, no tax events, no depeg exposure. This issue is the dollar receipt on what patience actually earned, versus the version of us that chased.

---

### 💰 Top Yield Picks

*What the bot is actually holding right now. Real positions, real rates — not a leaderboard scrape.*

**1. Fluid — USDC lending (Base) — 5.19% APY**
Single-asset USDC lending. No impermanent loss, no pair to babysit, withdrawable on demand subject to utilisation. This is the workhorse: a dollar in is a dollar out, plus interest a borrower pays for leverage.
*(Fluid affiliate — we earn a commission if you sign up. We hold real capital here.)*

**2. Fluid — USDC lending (Arbitrum) — 4.63% APY**
Same mechanism, different chain. We split across two chains on purpose — never all-in on one. The rate is lower than Base today; not enough of a gap to justify moving (more on that in the Bot Diary).
*(Fluid affiliate — we earn a commission if you sign up.)*

**3. The benchmark to beat: Coinbase USDC — ~2.8%**
Not a pick — an anchor. If a centralised exchange pays you 2.8% on idle USDC, then every point above that on-chain is what you're being paid to learn self-custody. 5.19% vs 2.8% is roughly an extra $240/year on a $10,000 balance. That gap is the whole reason this newsletter exists.

*Risk note: rates float. Single-asset stablecoin lending on a battle-tested protocol is about as boring as DeFi yield gets — which is exactly why it's the base of our book.*

---

### 🤖 Bot Diary

*Aggregated. No wallet addresses, no position sizes, no live-trade timing.*

**The quarter in one line: 700+ checks, 0 rebalances, $0 in gas.**

[TODO 2026-06-17: tighten the "cost of chasing" comparison.]

The interesting part isn't that it held — it's *what it turned down*. Several times this quarter a pool quoted a rate two to four points above what we hold. Each time the bot ran the same screen: was the extra yield real (swap fees / borrower demand), or emissions and high utilisation that vanish the moment someone exits? Each time the honest answer was "not enough to clear the cost of moving."

Moving isn't free. A rebalance on a small position eats gas on both legs, and for anyone holding in Australia, every swap is a CGT event. Add it up and a 2-point "upgrade" on a four-figure position can take months to pay back its own friction. So the bot stayed put — and that decision compounded quietly at ~5% with zero leakage.

---

### 📚 The concept: opportunity cost cuts both ways

[TODO 2026-06-18: finalise worked example, ~200 words.]

Everyone frames missed yield as a loss — "you could've made 9% over there." Fewer people price the *cost of going to get it.*

Worked example, $10,000 for one year:
- **Stay:** 5.19% on Fluid Base = **$519**, zero gas, zero tax events.
- **Chase:** jump to a pool quoting 9%. But it adjusts to ~7% after reserve factor, and you make ~6 hops over the year chasing the next rate. Say $8 gas per hop ($48), plus you've now realised six taxable events. Best case you net ~$650 before tax admin; one bad emission collapse or a few days stuck in an exit queue and you're behind the boring 5.19%.

The lesson: a higher *quoted* APY is a gross number. Subtract friction, tax, and exit risk and the "boring" position often wins on what actually lands in your wallet. The four numbers that decide it → /learn/four-numbers-defi-yield.

---

### 🔐 Tool of the Week — Ledger Nano X

If you're holding more than ~$5K on-chain, the question stops being "which pool" and starts being "where do my keys live." A hardware wallet keeps your private keys offline — the single biggest reduction in tail risk available to a self-custody DeFi user, for a one-time ~$150.
*(Ledger affiliate — we earn a commission if you sign up. Tracker: pb_newsletter_issue4. Alternating from Trezor in Issue #3 to A/B response per tool.)*

---

### Sign-off

The bot's best move all quarter was the one it didn't make. Boring compounds.

**Earn more — PassiveBlocks**

---

## CMO NOTES
- Lead = "cost of doing nothing" — extends rule+receipt + boring-wins patterns to a full-quarter receipt. Fresh frame: prices the *cost of chasing*, not just the missed upside.
- Our-data-only: Fluid Base 5.19% / Arb 4.63% (execution-state), Coinbase 2.8% anchor (publicly verifiable), bot 700+ checks / 0 rebalances / $0 gas. No live external market scrape.
- Funnel cross-link: Educational → /learn/four-numbers-defi-yield (live, FINAL 2026-06-15). Verify link before send.
- Tool = Ledger (alternates from Issue #3 Trezor). Tracker pb_newsletter_issue4.
- TODOs for next runs: tighten Bot Diary chasing comparison (06-17); finalise Educational worked example numbers (06-18); Risk Corner optional add; verify Coinbase anchor still ~2.8% at send.
- Public rules respected: no wallet addresses, no live-trade timing, no Aerodrome loss reference.
