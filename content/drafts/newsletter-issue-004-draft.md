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

The interesting part isn't that it held — it's *what it turned down*. The screen runs the same way every time a pool flashes a higher number:

1. **Is the extra yield real?** Swap fees and borrower demand are durable. Emissions and 95%+ utilisation are not — they evaporate the moment one big lender exits. Most "beat-our-rate" pools failed here first.
2. **Does the gap survive the haircut?** Knock the quoted rate down for reserve factor and the true lender APY is usually a point or more below the headline. A 9% pool quietly becomes ~7%.
3. **Does the *net* gap clear the cost of moving?** This is the one nobody runs.

Step 3 is where almost every "upgrade" died this quarter. Picture the closest call: a pool quoting ~3 points over what the bot holds. After the reserve-factor haircut the real edge was closer to 1.5 points. On a four-figure position that's roughly $15–$30 a year of extra yield — against gas on both legs *and*, for an Australian holder, a realised CGT event on every swap. Payback on the move: months. One emission cut or a multi-day exit queue mid-quarter and it never pays back at all.

So the bot did the unglamorous thing and stayed put. The headline number it skipped was always bigger. The number that actually lands in the wallet — after friction, after tax, after exit risk — was not. That's the whole job: not finding the highest rate, but finding the highest rate *you keep*.

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
- ⚠️ **SEND-BLOCKER (2026-06-17): present-tense "we hold real capital here" + Bot Diary "compounded at ~5%" claims must be re-verified before send.** execution-state.json flagged `_zeroSharesDetected` on BOTH Fluid positions (Base + Arbitrum) at 2026-06-16T17:00 — vaultShares "0", balanceUSD 0. Either the positions were withdrawn/moved, or this is a balance-reader bug (gas was 0 on Arbitrum, RPC may have failed). Until reconciled on-chain, do NOT ship the present-tense holding language. Bot Diary as written is framed historically (the quarter's behaviour) and is safe; the Top Picks "we hold real capital here" line is the exposed claim. Trust > cleverness — flagged to Pritesh in CMO Telegram 2026-06-17.
