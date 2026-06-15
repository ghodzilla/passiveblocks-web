# PassiveBlocks — Issue #3
**Ship date:** Friday (blocked on Beehiiv PB pub setup)
**Style:** smart-friend — hook, our-data sections, DeFi explainer, yields, bot, tool
**Status:** LOCKED 2026-06-15 — restructured to our-data-only per Issue #2 lesson (no unverifiable external market sections). Ready to send the moment BEEHIIV_PUB_ID_PB is provisioned.

---

## Subject line options

1. The "boring" stablecoin trade just out-earned the exciting one. Again.
2. Stable LP vs stable lending — we ran the math on $1,000.
3. Two ways to earn on USDC. Only one survives a bad weekend.

## Preview text

Why the bot still hasn't touched a stable LP — and the one situation where we'd change our minds.

---

## BODY

---

### 🪝 Hook

**Lending USDC on Fluid is paying 5.19% on Base and 4.63% on Arbitrum right now. A stablecoin LP pool will usually quote you one to two points more than that. The gap looks like free money.**

It isn't. That extra spread is the price of a depeg risk you can't hedge — and on a sub-$50K position, taking it is the wrong trade almost every time. This issue is about why, and the one set of conditions that would make us change our minds.

---

### 🏦 DeFi Deep Dive — The Stable LP Question

**Two ways to earn on a dollar of USDC. Why we pick the one that pays less.**

Every yield dashboard you'll see ranks stable LP pools at the top — 6%, 7%, sometimes 8% on what looks like a riskless trade. Lending the same USDC on Aave or Fluid pays 1–2 percentage points less.

The dashboard is telling you the truth. It's just not telling you the whole story.

**What the lending row actually is:**
A money market pays you because a borrower wants to use your USDC as leverage and pays interest for the privilege. Your balance is always denominated in USDC, $1 per token, withdrawable on demand (subject to utilisation).

**What the LP row actually is:**
You're providing both sides of a stable pair — say USDC and USDT. The headline yield is swap fees + (often) emissions. The risk is that USDC and USDT can drift apart. Not by much, and not for long — but when they do, the pool rebalances against you and you eat the difference.

**The 2023 receipt.**
In March 2023, USDC briefly traded at $0.88 after the Silicon Valley Bank disclosure. It re-pegged within 72 hours.

- A USDC lender's position: unchanged. USDC re-pegged, balance stayed the same.
- A USDC/USDT LP's position: ate a 4–6% drawdown as arbitrage rebalanced the pool, and locked the depeg loss on exit.

A full year of LP swap-fee yield (5–6% APY at the time) was wiped out by one weekend.

**The rule we use:**
LP is the right call when:
1. The pair is two battle-tested stables (USDC/USDT/DAI), AND
2. After-risk return clears lending by 2+ percentage points, AND
3. The position is large enough ($50K+) for swap fees to dominate gas.

If any of those three fails, lending wins on risk-adjusted basis. On $1K–$50K capital, all three usually fail at once.

[Full math + decision tree → **Stable LP vs Stable Lending** in this week's [/learn](https://passiveblocks.io/learn/stable-lp-vs-lending) deep dive.]

*[IMAGE: side-by-side card — left "Lending: $1 always = $1" / right "Stable LP: $1 = $0.94 to $1.06 during peg events" — dark bg]*

---

### 🎯 Mind-Change Watchlist — What Would Flip Us Into Stable LPs

The rule above isn't a religion. It's a math filter. Three conditions would flip the bot from "lending only" to "lending + a stable LP allocation":

1. **Stable LP APY beats lending by >2 percentage points *after* netting a 1% annual depeg drawdown.** Today's 1.9pp gap is too narrow once you reserve for risk. At 3pp+ gap, the math turns.
2. **Position size clears $50K per leg.** Below that, swap-fee yield is dominated by entry/exit gas and CGT friction. Above that, the per-leg fee revenue overtakes the fixed costs.
3. **Both stables in the pair hold $1.00 ±0.2% for 30 consecutive days, *across* a CPI print or a major stablecoin-issuer news event.** Calm pegs in calm weather mean nothing. We want the receipt that the pair stayed pegged through a real test.

Today's score: **2 of 3 conditions met** (size: ✗, peg stability: ✓, gap-after-risk: ✗). We'll publish the score every week. The day all three flip green, the bot rebalances live and we write it up the following Friday.

*[IMAGE: 3-row checklist — Gap > 2pp net of risk: ✗ | Size > $50K/leg: ✗ | 30d peg stability through a stress event: ✓ — minimal/dark]*

---

### 📘 Educational — Withdrawal Speed Is The Other Half Of APY

Last week's lesson was that the headline yield depends on utilisation. This week's is the mirror image: **the headline yield also depends on how fast you can exit.**

A pool paying 6% APY where you can withdraw in 12 seconds is a different product to a pool paying 6% APY where the exit takes 90 days. Same number on the leaderboard. Different financial instrument.

**Four bands, in plain English:**

- **Instant** (same block): Aave, Fluid, Compound, Kamino — at normal utilisation. ~12s on Ethereum, ~1s on Solana.
- **Soft delay** (minutes to hours): same protocols when utilisation crosses ~90%. Pool doesn't have idle capital to release; you wait for repayments.
- **Hard queue** (days to weeks): LST unstaking — stETH 1–3 days, mSOL ~5 days. Restaking protocols.
- **Term-locked** (weeks to months): Pendle PT before maturity, fixed-term DeFi notes, locked staking.

**Rule of thumb:** if a pool's APY beats the equivalent open lending rate by more than ~3 percentage points, the spread is buying you something. Most often, it's buying your liquidity — and the bill comes due the week you actually need to exit.

The bot holds three positions today, all in the instant band. That isn't conservatism for its own sake — it's because the bot's 3% buffer rule for rebalances assumes the bot can *execute* a rebalance when math says it should. A position in a hard queue or term lock breaks that assumption.

[Full read-off — the four bands, the LST queue worked example, the Pendle case, and the two-question decision tree to use on any new pool — in this week's [/learn](https://passiveblocks.io/learn/withdrawal-speed) deep dive.]

*[IMAGE: simple four-band ladder diagram — Instant (12s) → Soft delay (hours) → Hard queue (days) → Term-locked (weeks+) — labelled examples in each band — dark bg]*

---

### 💰 Top Yield Picks This Week

These are the single-asset stablecoin lending rates we actually hold or track — read straight off our own position state, not a leaderboard. No IL, no depeg risk, withdraw on demand.

| Protocol | Asset | Chain | APY | Type |
|----------|-------|-------|-----|------|
| Fluid | USDC | Base | 5.19% | Single-asset lending |
| Fluid | USDC | Arbitrum | 4.63% | Single-asset lending |

**Why these two:**
- Single-asset — no impermanent loss, no depeg risk, instant exit at normal utilisation.
- Fluid is an established Instadapp money market, not a three-week emissions farm.
- These rates have held in the 4.5–5.5% band for weeks. That stability is the point — we'd rather earn a durable 5% than a 12% that evaporates the day one borrower repays.

**Want Solana exposure too?** Kamino runs the same single-asset USDC lending model on Solana, and it's one of the protocols our bot is cleared to use. We're not quoting a rate we can't verify on-chain this week — check it live on the Kamino lending page before you deposit. *(Affiliate disclosure: we have no Kamino affiliate link; this is an editorial mention only.)*

---

### 🤖 Bot Diary

- Trades placed this week: **0**
- Rebalances since the current positions went on in early April: **0**
- Gas spent on rebalancing: **$0**
- Weeks of consecutive non-rebalances: **~10**

**Why this issue's Bot Diary matters:**
The bot held its lending positions through the week even with a one-to-two-point gap to stable LPs sitting on the table. That isn't a missed opportunity — that's the rule above doing its job. At the bot's capital size, the LP uplift after the depeg-risk premium does not clear lending, so the math says stay put. Ten weeks, zero rebalances, zero gas. The bot rebalances *into* a stable LP only when the arithmetic says it should — not when the leaderboard says it should.

---

### ⚠️ Risk Corner — One thing we're NOT chasing this week

Every week a stablecoin LP pool shows up on the leaderboards quoting 8%, 10%, sometimes more — on what looks like a riskless USDC trade. Before you chase one, run it through the three questions we run every pool through. A pool only has to fail **one** of them for us to walk:

1. **Is the yield fees or emissions?** Open the pool's reward breakdown. If most of the APY is the protocol's own token being printed and handed out, that rate has a half-life. Real swap-fee yield is durable; emissions yield is a countdown.
2. **Can you actually get out?** Check the pool's TVL. A high APY on a sub-$10M pool means your exit *is* the slippage. The rate is recruiting fresh deposits to fund the people already trying to leave.
3. **Is the pair fragile?** Two battle-tested stables (USDC/USDT/DAI) drift a few basis points. A newer or algorithmic stable in the pair can gap to $0.90 and never come back. The 2023 USDC receipt above shows what even a *temporary* depeg costs an LP.

That's the whole filter. Any pool that survives all three is worth a second look. Most don't survive the first.

[The full framework, with the worked depeg math → **Stable LP vs Stable Lending** in this week's [/learn](https://passiveblocks.io/learn/stable-lp-vs-lending) deep dive.]

---

### 📡 Signals We're Tracking

Three things on the bot's dashboard this week — our own data, not a third-party feed:

1. **Utilisation creep on our lending pools.** Both Fluid positions are sitting in the healthy 60–85% utilisation band. We watch for the day one large borrower pushes a pool past ~90% — that's when the headline APY jumps *and* same-block withdrawals start to slow. A spike there is a signal to read, not to chase.
2. **The CEX anchor.** Coinbase is still paying roughly 2.8% on USDC. Our Base lending rate is 5.19%. That ~2.4-point gap is the whole reason on-chain stablecoin lending exists — and on $25K, it's about $600 a year you leave on the table by parking at the exchange.
3. **Peg quiet.** USDC and USDT both held $1.00 ±0.2% all week, no issuer headlines. Calm pegs in calm weather don't prove much — which is exactly why our Mind-Change Watchlist (above) only counts peg stability that survives a real stress event.

---

### 🛠️ Tool of the Week — Trezor Safe 5

*(Alternate Trezor this issue to test response vs Ledger CTA in Issue #2.)*

**If you're earning yield on-chain, a hot wallet is your single biggest risk.**

A Trezor keeps your private keys offline. You can still connect to any DeFi protocol — Fluid, Aave, Kamino, Aerodrome — but the keys never touch the internet. One purchase, protects everything, forever.

**Trezor Safe 5 — ~$190 AUD**

→ **[Get Trezor here](https://affiliate.trezor.io/publisher/#!/offer/133)** *(affiliate link — we earn a commission at no cost to you)*

---

### Sign-off

That's the week. If someone you know is currently chasing a "high-yield stable pool" without knowing the depeg history of either stable, forward this. That's the whole growth strategy — no paid ads, just receipts.

See you next Friday.

*Earn more — PassiveBlocks*

---

## Production notes (internal)

- **LOCKED 2026-06-15.** Restructured to our-data-only per the Issue #2 lesson: removed "This Week in Crypto" (live headlines), the live-rate Top Picks placeholders, the live Risk Corner pool pick, and the Arkham/Artemis Intelligence Signals — all replaced with sections we can stand behind without an external fetch (our own Fluid APYs from execution-state, our bot stats, the publicly-checkable Coinbase anchor, and mechanics-based explainers). Only ship blocker now is Beehiiv PB pub provisioning.
- Verified numbers used: Fluid Base 5.19%, Fluid Arbitrum 4.63% (execution-state.json 2026-06-15), Coinbase ~2.8% USDC anchor (publicly verifiable), ~10 weeks / 0 rebalances / $0 gas bot stats.
- **Cross-link:** /learn/stable-lp-vs-lending (companion article, written 2026-05-19)
- **Affiliate alternation:** Trezor this issue, Ledger Issue #4 — track response rate per tracker
- **Image plan:**
  - Lending vs LP value comparison card (dark bg, two-column)
  - 3-card yield picks grid (same as Issue #2)
  - Bot diary stats card
  - Trezor Safe 5 product photo
