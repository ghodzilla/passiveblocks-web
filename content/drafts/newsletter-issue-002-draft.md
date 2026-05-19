# PassiveBlocks — Issue #2
**Ship date:** Friday 2026-05-23
**Style:** Lark Davis — hook, news, DeFi section, yields, bot, tool
**Status:** Draft — populate yield/bot numbers Thursday 2026-05-22

---

## Subject line options

1. Ethereum just flipped a key level. Here's where the yield is going.
2. $2.1B flowed into DeFi this week. Here's who got it.
3. The stablecoin yield nobody's talking about just hit 6 weeks straight.

## Preview text

This week's biggest DeFi moves, the protocols attracting real capital, and where we're parking ours.

---

## BODY

---

### 🪝 Hook

**Coinbase is paying 2.8% on USDC. DeFi is paying 4–5%. The gap has been wide for six weeks straight, and nobody's closing it.**

If you've never moved a dollar on-chain, this issue is the cheat sheet — what's earning, why, and the one risk number most people ignore.

*[Thursday: replace second line of hook with the week's top headline once ETH/TVL number is pulled — keep the Coinbase 2.8% anchor either way.]*

---

### 📰 This Week in Crypto

*[IMAGE: collage of 3-4 protocol logos — Fluid, Arbitrum, Ethereum, Kamino — on dark background]*

**1. Ethereum hits $X,XXX — and DeFi is following**

ETH pushed through resistance this week and held. When ETH moves, DeFi TVL tends to follow — more collateral, more borrowing demand, higher lending rates. That's exactly what we're seeing on Fluid right now.

*[IMAGE: ETH price chart — 7-day from CoinGecko, screenshot]*

---

**2. $X.XB flowed into DeFi protocols this week**

According to DeFiLlama, total DeFi TVL moved from $X.XB to $X.XB over the past 7 days. The biggest gainers: Aave (Ethereum), Fluid (Arbitrum), Kamino (Solana). Stablecoin lending markets absorbed most of the inflow.

*[IMAGE: DeFiLlama TVL chart — 30-day, screenshot from defillama.com]*

---

**3. Kamino hits new TVL record on Solana**

Kamino's USDC market on Solana crossed $XXM TVL this week — a new all-time high. Borrow demand is up, which is pushing supply APY higher. We're watching this closely as a potential Top Pick addition next issue.

*[IMAGE: Kamino logo + Solana logo side by side]*

---

**4. New protocol alert: [PROTOCOL NAME] launches on Base**

*(Populate Thursday — check DeFiLlama "new protocols" + crypto Twitter for week's notable launch)*

*[IMAGE: new protocol logo]*

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

*[IMAGE: simple diagram — "Utilisation Rate" bar showing 78% filled vs 30% filled side by side, labeled APY 6.4% vs 2.4%]*

---

### 💰 Top Yield Picks This Week

*[Populate Thursday 2026-05-22 with live rates from Fluid, DeFiLlama, Kamino]*

| Protocol | Asset | Chain | APY | Type |
|----------|-------|-------|-----|------|
| Fluid | USDC | Arbitrum | X.XX% | Single-asset lending |
| Fluid | USDC | Base | X.XX% | Single-asset lending |
| Kamino | USDC | Solana | X.XX% | Single-asset lending |

**Why these three:**
- All single-asset (no IL risk)
- All established protocols (Fluid: $XB TVL, Kamino: $XM TVL)
- Rates held for 4+ weeks — not spike yields, not emissions

*[IMAGE: 3-card grid — each card shows protocol logo, chain logo, APY in large text on dark background — create as simple graphic]*

---

### 🤖 Bot Diary — What PassiveBlocks Did This Week

**Trades placed: 0. Positions held: 3. Hours of decisions made: zero.**

The bot ran its rebalance check every three hours — 56 cycles total. Every cycle came back with the same answer: hold.

Here's why that's the right answer right now:

- **Stablecoin lending positions** (single-asset, no IL) — weighted average APY held in the high-4s for the seventh straight week. No protocol risk events. No utilisation cliff.
- **One LP position** — sitting inside its price range. Earning fees on every swap that touches the pair. No re-balance needed until the price moves outside the band.
- **Gas spent this week:** $0.00.

The rule the bot lives by: a rebalance has to clear gas plus a 3% buffer or it doesn't happen. Most weeks, nothing clears. That's the whole point. Yield-chasing on a $1K position eats itself in gas — the bot just doesn't do it.

*If you're refreshing your wallet hoping for action, the action is the patience.*

*[IMAGE: simple dark-bg card showing "Week 7: 0 trades, 3 positions held, $0 gas spent" in large text]*

---

### ⚠️ Risk Corner — One thing we're NOT chasing this week

Every newsletter you'll read is going to point at the top APY on a leaderboard. We do the opposite — here's one pool that *looks* attractive on the table but we're staying away from.

**The shape that catches people:** a new pool, three weeks old, 22% APY on a "stable" pair you've never heard of, TVL under $5M, 95%+ utilisation. Looks like alpha. Acts like a trap.

Three things go wrong on a pool like that:

1. **The APY isn't real yield — it's emissions.** Half (or more) of the headline number is the protocol paying you in its own token. When the emissions schedule tapers, the rate halves overnight.
2. **High utilisation on a small pool means you can't exit.** If borrowers haven't repaid and you're the lender trying to withdraw, you wait. On a $5M pool, two whales exiting before you can lock liquidity for days.
3. **"Stable pair" is doing a lot of work.** Pairs of stablecoins from protocols you've never heard of can decouple in hours. Not depeg in the catastrophic sense — just enough to wipe a year of yield in a single rebalance event.

The boring 4–5% on Fluid USDC has none of those three risks. It earns less. It also doesn't lose.

**The rule:** never chase a rate that disappears if you read its anatomy. If it's emissions-heavy, low-TVL, or pair-fragile, the APY on the table isn't the APY you'll keep.

**The other rule** (deeper dive in this week's [When NOT to rebalance](https://passiveblocks.io/learn/when-not-to-rebalance) guide): even if the new pool's APY is real, the gap has to clear gas plus a 3-percentage-point buffer or the move costs you money. On a $1,000 position, a 2.4% APY gap takes four months to pay back the round-trip fees — and new pools rarely hold their headline rate for four months. We hold Fluid not because it's the highest number on the board, but because the math of switching almost never works.

---

### 📡 Intelligence Signals

*[Populate Thursday — pull from Artemis (protocol revenue/users), Arkham (whale wallets), DeFiLlama (TVL/inflows), on-chain data]*

**Signal 1 — Whale accumulation (Arkham)**
A wallet tagged "Smart Money" on Arkham moved $XM USDC into Fluid Arbitrum this week. When wallets like this add to a position, they're usually reacting to utilisation data before it moves. Worth watching.

*[IMAGE: Arkham wallet flow screenshot — anonymise address to first 6 + last 4 chars]*

---

**Signal 2 — Protocol inflow alert (Artemis)**
[PROTOCOL] saw $XM net inflow over 7 days — the largest single-week deposit since [DATE]. Artemis shows daily active users up XX% week-on-week. TVL chart is breaking out. If borrow demand follows, rates could move.

*[IMAGE: Artemis protocol dashboard screenshot — revenue or user chart]*

---

**Signal 3 — Upcoming catalyst**
[PROTOCOL] is scheduled to launch [feature/chain/upgrade] on [DATE]. Historically, new chain launches attract yield farmers early — rates spike as borrow demand catches up to deposits. One to watch before it goes live.

---

**Signal 4 — Stablecoin supply expanding**
USDC supply grew by $XB this week — the largest 7-day expansion in [X] months. More stablecoin supply in the market typically flows into DeFi lending pools within 2–4 weeks. Rates may compress slightly as new deposits arrive, but TVL growth is bullish for protocol health overall.

*[IMAGE: USDC supply chart — from CoinGlass or DeFiLlama stablecoins page]*

---

### 🛠️ Tool of the Week — Ledger Hardware Wallet

*[IMAGE: Ledger Nano X product photo on dark background]*

**If you're earning yield on-chain, a hot wallet is your single biggest risk.**

MetaMask and Rabby are convenient. They're also one phishing link away from losing everything you've earned. A Ledger keeps your private keys offline permanently — you can still connect to any DeFi protocol, but your keys never touch the internet.

One purchase. Protects everything, forever.

**Ledger Nano X — ~$170 AUD**

→ **[Get Ledger here](https://shop.ledger.com/?r=a6255ec0ba49&tracker=pb_newsletter_issue2)** *(affiliate link — we earn a small commission at no cost to you)*

---

### Sign-off

That's the week. If someone you know is still sitting on exchange USDC earning 2–3%, forward this to them. That's the whole growth strategy — no paid ads, just receipts.

See you next Friday.

*— PassiveBlocks*

---

## Production notes (internal)

- **Thursday checklist:**
  - Pull live APYs from Fluid + Kamino (DeFiLlama rates page)
  - Intelligence Signals: check Arkham for large USDC wallet moves into DeFi protocols; check Artemis for top protocol by revenue/user growth this week; check DeFiLlama stablecoins page for USDC supply change; find notable new protocol launch from crypto Twitter
  - Crypto news: check The Block + CoinDesk for week's top 4 stories; pull ETH price chart from CoinGecko; pull DeFiLlama TVL 30-day chart
  - Update hook with real ETH price + TVL numbers
- **Images to create/source:**
  - Protocol logo collage (dark bg) — use official logos from protocol sites
  - ETH 7-day price chart — screenshot from CoinGecko
  - DeFiLlama TVL 30-day chart — screenshot from defillama.com
  - Kamino logo + Solana logo — from official sites
  - Utilisation rate bar diagram — simple graphic (Canva or Figma)
  - 3-card yield picks grid — simple dark-bg graphic
  - Bot diary positions card — simple dark-bg graphic
  - Ledger Nano X product photo — from ledger.com press kit
- **Hook:** Update with real ETH price and real TVL number Thursday
- **Ledger tracker:** pb_newsletter_issue2 (already in link)
