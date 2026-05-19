# PassiveBlocks — Issue #3
**Ship date:** Friday 2026-05-30
**Style:** Lark Davis — hook, news, DeFi section, yields, bot, tool
**Status:** Scaffold — Hook + Risk Corner cross-link in place; populate live data Thursday 2026-05-29

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

**A USDC/USDT LP on Aerodrome is paying ~6.5% this week. Lending the same USDC on Fluid is paying ~4.6%. The 1.9-percentage-point gap looks like free money.**

It isn't. The gap is the price of taking a depeg risk you can't hedge — and on a sub-$50K position, it's the wrong trade almost every time.

*[Thursday 2026-05-29: replace second line of hook with the live spread between best stable LP and best stable lending pool from DeFiLlama. Keep the framing.]*

---

### 📰 This Week in Crypto

*[Populate Thursday — same template as Issue #2]*

**1. [Top market headline of the week]**

**2. [DeFi TVL movement — DeFiLlama 7-day delta]**

**3. [Stablecoin supply / Aave / Fluid / Kamino notable event]**

**4. [Notable new protocol launch — DeFiLlama new protocols]**

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

### 💰 Top Yield Picks This Week

*[Populate Thursday 2026-05-29 with live rates]*

| Protocol | Asset | Chain | APY | Type |
|----------|-------|-------|-----|------|
| Fluid | USDC | Arbitrum | X.XX% | Single-asset lending |
| Fluid | USDC | Base | X.XX% | Single-asset lending |
| Kamino | USDC | Solana | X.XX% | Single-asset lending |

**Why these three:**
- All single-asset (no IL risk, no depeg risk)
- All established protocols (Fluid: $XB TVL, Kamino: $XM TVL)
- Rates held for 5+ weeks at this stage — not spike yields

---

### 🤖 Bot Diary

*[Populate Thursday with the actual rebalance log for the week]*

- Trades placed this week: 0
- Positions held: 3
- Gas spent: $0
- Weeks of consecutive non-rebalances: [N]

**Why this issue's Bot Diary matters:**
The bot held lending positions through the week even with a 1.9pp gap to stable LPs on the table. That isn't a missed opportunity — that's the rule above doing its job. On the bot's current capital size, the LP uplift after depeg-risk premium does not clear lending. The bot rebalances *into* LPs only when math says it should, not when the leaderboard says it should.

---

### ⚠️ Risk Corner — One thing we're NOT chasing this week

*[Pick one new pool from DeFiLlama Thursday — preferably a new stable LP with emissions-heavy APY 8%+, TVL under $10M. Apply the same 3-question filter as Issue #2: emissions vs fees, exit risk, pair fragility.]*

**Template logic to fill in:**
- Name the pool, the APY, the TVL.
- Walk the reader through the three failure modes.
- Cross-link to [Stable LP vs Lending](/learn/stable-lp-vs-lending) for the framework.

---

### 📡 Intelligence Signals

*[Populate Thursday from Arkham / Artemis / DeFiLlama — same 4-signal structure as Issue #2]*

1. Whale accumulation
2. Protocol inflow alert
3. Upcoming catalyst
4. Stablecoin supply movement

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

*— PassiveBlocks*

---

## Production notes (internal)

- **Thursday 2026-05-29 checklist:**
  - Pull live Fluid Arbitrum + Base APYs from on-chain or DeFiLlama
  - Pull Kamino USDC Solana APY
  - Pull best stable LP APY from DeFiLlama for the hook spread
  - Pick this issue's Risk Corner pool (DeFiLlama new pools page, filter stable LP TVL < $10M, APY > 8%)
  - Pull Intelligence Signals data (Arkham/Artemis/DeFiLlama)
  - Update Bot Diary with actual position state + weeks-of-zero-rebalances count
- **Cross-link:** /learn/stable-lp-vs-lending (companion article, written 2026-05-19)
- **Affiliate alternation:** Trezor this issue, Ledger Issue #4 — track response rate per tracker
- **Image plan:**
  - Lending vs LP value comparison card (dark bg, two-column)
  - 3-card yield picks grid (same as Issue #2)
  - Bot diary stats card
  - Trezor Safe 5 product photo
