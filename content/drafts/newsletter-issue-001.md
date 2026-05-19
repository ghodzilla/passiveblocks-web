# PassiveBlocks — Issue #1
**Date:** 2026-05-13
**Status:** Final draft

---

## Subject Line Options

1. DeFi is paying 5.2% on USDC right now. Here's where (and where not to bother).
2. We deployed $869 of real capital so you don't have to guess.
3. Your idle stablecoins are losing ~2% per year to inflation. Here's the math.

## Preview Text

Live yields, bot positions, and one thing worth your time this week. No filler.

---

## Body

---

### What I'm watching this week

On Tuesday, Fluid's USDC lending market on Arbitrum ticked up to 4.7% APY — briefly crossing 10 basis points above where it has been sitting for most of the past month. It dropped back to 4.6% by Wednesday. That's not a big move. But it's worth noting because it came in the same week Aave v3 on Arbitrum compressed from 4.1% to 3.8%.

The gap between Fluid and Aave — which was 40 basis points a month ago — is now closer to 80 basis points on Arbitrum. On a $50,000 position, that's $400 per year in extra yield for doing exactly the same thing: depositing USDC, no leverage, no IL, withdraw whenever you want.

Meanwhile, on Solana, Orca's SOL/USDC concentrated liquidity pool is sitting at 8–12% APY depending on your range. That number is real swap fee revenue — SOL/USDC volume has been elevated since the March retail run. It is not emission farming dressed up as yield.

The through-line this week: the easy, low-effort stablecoin yield is quietly better than it was 60 days ago. Most people with $5K–$50K in idle USDC have no idea.

---

### Top Yield Picks

*Current as of 2026-05-13. Rates are variable — check before you deposit.*

**1. Fluid — USDC Lending on Arbitrum**
**APY: ~4.6% | Risk: Low | Chain: Arbitrum**

Single-asset USDC deposit. No impermanent loss. Withdraw anytime. Fluid has been consistently outpacing Aave by 40–80 basis points on Arbitrum for the past six weeks. The protocol is audited and has $800M+ TVL. This is where our bot keeps most of its capital right now.

If you want one place to start, this is it. ([Open Fluid on Arbitrum →](https://fluid.instadapp.io) — affiliate link)

**2. Fluid — USDC Lending on Base**
**APY: ~5.2% | Risk: Low | Chain: Base**

Same protocol, different chain. Base tends to carry a slightly higher rate because it has lower TVL depth than Arbitrum. The trade-off: bridging to Base costs ~$0.50 and takes 5 minutes. If you're already on Base, this is the strongest no-fuss rate available right now.

([Open Fluid on Base →](https://fluid.instadapp.io) — affiliate link)

**3. Orca — SOL/USDC Concentrated Liquidity**
**APY: 8–12% (range-dependent) | Risk: Medium | Chain: Solana**

Orca is the cleanest concentrated liquidity DEX on Solana. SOL/USDC is a high-volume pair — fees are real, not subsidised by emissions. Gas on Solana is near-zero, which means you can actively manage your range without eating your returns. The catch: this is an LP position, not lending. SOL price moves will affect your position value. This is not a first-DeFi-move, but it is a legitimate yield source for anyone already comfortable holding SOL.

Requires a Phantom or Backpack wallet. ([Open Orca →](https://www.orca.so) — affiliate link)

*Not in the top 3 this week: Aave v3 on Arbitrum (~3.8–4.2%) is the benchmark — battle-tested, $20B+ TVL — but Fluid has the better rate right now. Kamino on Solana (~6–8% USDC) is worth monitoring; we'll cover it in a future issue.*

---

### Bot Diary — What the bot did this week

**Positions:** ~$869 deployed across two Fluid lending markets.
**Earnings this week:** ~$0.77 (at current APY run rate).
**Rebalances:** Zero.

The bot runs a rebalance check every three hours. This week, both positions stayed within the tolerance bands — no protocol met the threshold for a switch (the rule is: 5%+ APY improvement after gas, and a 24-hour cooldown). Fluid Arbitrum held at 4.63%. Fluid Base held at 5.19%. No action required.

This is what most weeks look like. DeFi yield does not require constant intervention — it rewards patience and monitoring more than trading. The bot's job right now is to hold steady, capture the rate, and flag anomalies. It flagged nothing unusual this week.

One thing it did catch: a brief TVL fluctuation on Fluid Base on Monday morning. TVL dipped 8% in two hours before recovering. The bot's exit threshold is 20% in 24 hours — so no action was triggered. But it logged the event. We watch for these because a sharp TVL drop is often the first signal of a problem before it becomes public news.

Next week the bot will evaluate whether the Fluid Base / Arbitrum spread has moved enough to consolidate into one chain.

---

### How to think about IL (impermanent loss)

Impermanent loss is the most misunderstood concept in DeFi. Here's the plain version.

When you provide liquidity to an AMM (automated market maker), you deposit two assets in a ratio — say, $500 USDC and $500 worth of ETH. The pool uses a formula to price swaps. As ETH's market price changes, the pool rebalances your holdings automatically to maintain the ratio.

The problem: by the time you withdraw, you hold a different mix of ETH and USDC than you put in — and that mix is worth less than if you had just held both assets in your wallet.

**Concrete example:** You deposit $500 USDC + $500 ETH when ETH = $2,000. ETH doubles to $4,000. You withdraw — but instead of holding $500 USDC + $1,000 ETH ($1,500 total), the pool gives you roughly $707 USDC + 0.177 ETH ($707 + $707 = $1,414 total). That's $86 less than holding. That $86 is impermanent loss.

The word "impermanent" means: if ETH returns to $2,000, the loss disappears. In practice, most LPs don't wait — they exit when prices have moved, locking in the loss.

Three ways to minimise IL:

1. **Use correlated pairs** — stablecoin/stablecoin LP (e.g. USDC/USDT) has near-zero IL because both assets track $1. CBBTC/WBTC similarly.
2. **Earn fees that outpace the loss** — a high-volume pool can generate enough fee revenue to cover IL. This requires real fee income, not just emissions.
3. **Use lending instead** — single-asset lending (Fluid, Aave) has zero IL by design. You deposit one asset, you get back that asset plus interest.

If you're new to DeFi, start with lending. Graduate to LP once you understand what you're trading off.

---

### One tool worth your time

If you're moving beyond $5,000 in DeFi, a hardware wallet stops being optional. A compromised browser extension can drain a hot wallet in seconds — it has happened to people who knew what they were doing. A hardware wallet stores your private keys offline. The browser exploit cannot touch them.

The Ledger Nano X supports every chain covered in this newsletter — Base, Arbitrum, Ethereum, Solana. It costs around $150.

*Disclosure: The link below is an affiliate link. If you buy through it, we earn a small commission at no cost to you. We use a Ledger ourselves.*

[Get the Ledger Nano X →](https://www.ledger.com) *(affiliate)*

---

Thanks for reading Issue #1. Forward this to one person who has idle stablecoins sitting in Coinbase earning 2.8%. That's the whole growth plan.

*Earn more — PassiveBlocks*

---
*Unsubscribe anytime. No dark patterns here.*
