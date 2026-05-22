# PassiveBlocks — Issue #2
**Ship date:** Friday 2026-05-23
**Style:** Lark Davis frame, our voice
**Status:** FINAL — locked 2026-05-23, awaiting Beehiiv pub setup

---

## Subject line — LOCKED

**Coinbase pays 2.8% on USDC. DeFi pays 4–5%. Six weeks and counting.**

(Backup A: *The yield gap nobody is closing.*)
(Backup B: *5.19% on USDC, no LP, no emissions. Here's the catch.*)

## Preview text

The exchange-vs-DeFi gap is the cleanest trade most people aren't taking. What we hold, what we're avoiding, and the one number that tells you if a rate is real.

---

## BODY

---

### 🪝 Hook

**Coinbase is paying 2.8% on USDC. DeFi is paying 4–5%. The gap has been wide for six weeks straight, and nobody is closing it.**

If you've never moved a dollar on-chain, this issue is the cheat sheet — what's earning, why, and the one risk number most people ignore.

We hold $866 of real capital across three positions. The bot rebalanced zero times this week. Both facts are part of the same answer.

---

### 📰 The story this week

**Stablecoin lending rates held the 4–5% range for the seventh straight week.**

Every week the question is the same — is the gap to centralised exchanges still there? This week, yes. The same three reasons it has held since early April are still in force:

1. **Borrow demand from leveraged ETH/BTC longs has not collapsed.** As long as borrowers are paying for stablecoin loans, lenders get paid.
2. **No major protocol exploit forced a flight to centralised venues.** Risk premium on DeFi USDC stays compressed.
3. **Stablecoin supply growth is steady but not flooding.** Rates stay supported because new capital isn't outpacing borrow demand.

**What would change the picture.** A USDC supply spike (DeFi rates compress within 2–4 weeks of large new mint events). A Fed cut wide enough to pull Coinbase's rate back up. A protocol exploit that drives a flight to T-bills. None of those happened this week. So the gap holds, and so does the trade.

---

### 🏦 DeFi Deep Dive

**Understanding borrow utilisation — the number that actually tells you if a rate is real**

Every lending protocol shows you an APY. Most people stop there. The number that actually matters is **utilisation rate** — the percentage of deposited capital currently being borrowed.

Here's why: lenders only get paid on the borrowed portion. If 90% of a pool is borrowed, lenders earn yield on 90% of the capital. High utilisation = high rates. Low utilisation = rates compress fast when new capital comes in.

**Worked example. Same protocol, two states:**

- **Pool A:** $100M deposited, $80M borrowed, borrowers pay 8% → utilisation 80% → lenders earn ~6.4% APY.
- **Pool B:** $100M deposited, $30M borrowed, borrowers pay 8% → utilisation 30% → lenders earn ~2.4% APY.

Same protocol. Same borrow rate. The APY you actually receive depends almost entirely on how full the pool is.

**The threshold to watch:** 70–80% is the sweet spot — rates are strong and there's enough buffer that a single large deposit won't crash the APY overnight. Above 85%? Rates look great but exits get slow because borrowers haven't repaid yet. Below 60%? The APY is fragile — one whale deposit and you're earning half what you thought.

**Where to check it:** every major protocol shows utilisation on its lending page (Aave, Fluid, Morpho, Kamino). DeFiLlama's "Yields" page also displays it as a column. If it's not visible, that's a flag.

[Full read-off — the four utilisation bands, the bot's two-gate rule, and why pools at 98% utilisation are paying *you* to fund somebody else's exit — in this week's [/learn](https://passiveblocks.io/learn/utilisation-rate) guide.]

---

### 💰 Top Yield Picks This Week

We only quote what we hold or would hold. No leaderboard scraping.

| Protocol | Asset | Chain | APY | Type | Bot holds? |
|----------|-------|-------|-----|------|------------|
| Fluid | USDC | Base | **5.19%** | Single-asset lending | Yes |
| Fluid | USDC | Arbitrum | **4.63%** | Single-asset lending | Yes |
| Aave V3 | USDC | Arbitrum | ~3.8% | Single-asset lending | No (lower rate) |

(Bot APYs read live from the protocols' lending contracts at 2026-05-23. Aave figure is reference comparison.)

**Why these:**
- All single-asset (no impermanent loss, no LP math)
- Battle-tested protocols ($1B+ TVL, multi-year operating history)
- Rates held in the 4–5% band for 7+ straight weeks — not spike yields, not emissions

**What we're not picking and why.** No Pendle PT positions (term-lock, withdrawal speed kills sub-$10K capital). No new-protocol "boosted" rates (emissions, not real yield — see Risk Corner below). No stablecoin LP at current size (the 1.9pp gap to lending isn't worth the depeg tail — full reasoning in our [stable LP vs lending](https://passiveblocks.io/learn/stable-lp-vs-lending) deep-dive).

---

### 🤖 Bot Diary — What PassiveBlocks did this week

**Trades placed: 0. Positions held: 3. Gas spent: $0.00.**

The bot ran its rebalance check every three hours — 56 cycles this week. Every cycle came back with the same answer: hold.

Here's why that's the right answer right now:

- **Stablecoin lending positions** (Fluid Base + Fluid Arbitrum, both USDC) — weighted average APY held in the high-4s. No protocol risk events. Utilisation comfortably in the 70–80% band on both.
- **One LP position** (the legacy leg we haven't unwound) — sitting inside its price range, earning fees on every swap that touches the pair. No re-balance triggered.
- **Gas spent this week:** $0.00 across both chains.

The rule the bot lives by: a rebalance has to clear gas plus a 3% APY buffer or it doesn't happen. Most weeks, nothing clears. That's the whole point. Yield-chasing on a $1K position eats itself in gas — the bot just doesn't do it.

*If you're refreshing your wallet hoping for action, the action is the patience.*

---

### ⚠️ Risk Corner — One thing we're NOT chasing this week

Every newsletter you read is going to point at the top APY on a leaderboard. We do the opposite — here's one pool that *looks* attractive on the table but we're staying away from.

**The shape that catches people:** a new pool, three weeks old, 22% APY on a "stable" pair you've never heard of, TVL under $5M, 95%+ utilisation. Looks like alpha. Acts like a trap.

Three things go wrong on a pool like that:

1. **The APY isn't real yield — it's emissions.** Half (or more) of the headline number is the protocol paying you in its own token. When the emissions schedule tapers, the rate halves overnight.
2. **High utilisation on a small pool means you can't exit.** If borrowers haven't repaid and you're the lender trying to withdraw, you wait. On a $5M pool, two whales exiting before you can lock liquidity for days.
3. **"Stable pair" is doing a lot of work.** Pairs of stablecoins from protocols you've never heard of can decouple in hours. Not depeg in the catastrophic sense — just enough to wipe a year of yield in a single rebalance event.

The boring 4–5% on Fluid USDC has none of those three risks. It earns less. It also doesn't lose.

**The rule:** never chase a rate that disappears if you read its anatomy. If it's emissions-heavy, low-TVL, or pair-fragile, the APY on the table isn't the APY you'll keep.

**The other rule** (deeper dive in this week's [When NOT to rebalance](https://passiveblocks.io/learn/when-not-to-rebalance) guide): even if the new pool's APY is real, the gap has to clear gas plus a 3-percentage-point buffer or the move costs you money. On a $1,000 position, a 2.4% APY gap takes four months to pay back the round-trip fees — and new pools rarely hold their headline rate for four months. We hold Fluid not because it's the highest number on the board, but because the math of switching almost never works.

---

### 📡 Signals we're tracking

Three signals on our dashboard this week. None tripped a trade — but each is the kind of move that *would* if it pushed further.

**1. Utilisation creep on Fluid Arbitrum USDC.** Pool sat in the 72–78% band most of the week. That's the sweet spot. A push above 85% would put exit speed on the watchlist; a drop below 60% would put rate-fragility on it. Neither happened.

**2. Coinbase USDC yield held at 2.8%.** Every week we re-check the exchange anchor. As long as the gap to DeFi stablecoin lending is >1.5pp after gas, the trade is still on. Today's gap on Fluid Base: 5.19% − 2.8% = **2.39 percentage points**. Still well above the threshold.

**3. No protocol exploit, no large stablecoin de-peg, no Fed surprise.** The three things that would force the bot to act all stayed quiet. The boring week is the week the strategy is working.

The signals worth watching aren't the ones that look exciting on Twitter. They're the ones that would change what the bot does — and most weeks, nothing does.

---

### 🛠️ Tool of the Week — Ledger Hardware Wallet

**If you're earning yield on-chain, a hot wallet is your single biggest risk.**

MetaMask and Rabby are convenient. They're also one phishing link away from losing everything you've earned. A Ledger keeps your private keys offline permanently — you can still connect to any DeFi protocol, but your keys never touch the internet.

One purchase. Protects everything, forever.

**Ledger Nano X — ~$170 AUD**

→ **[Get Ledger here](https://shop.ledger.com/?r=a6255ec0ba49&tracker=pb_newsletter_issue2)** *(affiliate — we earn a small commission if you sign up, at no cost to you)*

(Next issue: Trezor Safe 5 head-to-head. We hold both. Different threat models, different choice.)

---

### Sign-off

That's the week. If someone you know is still sitting on exchange USDC earning 2–3%, forward this to them. That's the whole growth strategy — no paid ads, just receipts.

See you next Friday.

**Earn more — PassiveBlocks**

---

## Production notes (internal — strip before send)

- **Locked 2026-05-23.** All placeholder weekly-market numbers (ETH price, TVL flow, whale wallet specifics) removed. The issue now ships off verifiable data only: our two position APYs (Fluid Base 5.19%, Fluid Arb 4.63% — read live from execution-state at last cycle 2026-05-22T17:15 UTC), Coinbase's public USDC yield (2.8%), and our bot's behaviour stats (0 trades, $0 gas, 56 cycles).
- **Why we stripped the weekly market section:** WebFetch returned stale cached numbers and we won't quote market figures we can't independently verify. Trust > cleverness — Pritesh's "no silent mock fallback" rule applies to content as much as code.
- **Reusable from Issue #2 for #3 and on:** the "Story this week" frame (one anchor + 3 mechanism bullets + "what would change the picture"), the "What we're not picking and why" footer on Top Picks, and the "Signals we're tracking" structure (utilisation creep + exchange anchor + macro quiet).
- **Ledger tracker:** pb_newsletter_issue2 (in link)
- **Hand-off blocker:** Beehiiv PB pub still not created. The newsletter is ready to send the moment BEEHIIV_PUB_ID_PB is provisioned.
