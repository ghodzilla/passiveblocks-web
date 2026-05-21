# Kink Interest Models — Why DeFi Borrow Rates Spike Vertically Above 90%

*URL: passiveblocks.io/learn/kink-interest-models*
*Last updated: 2026-05-22*

---

You've watched a Fluid or Aave borrow rate sit at 5–8% for weeks, then jump to 40%+ in a single afternoon — without a single news event. The pool didn't change. The protocol didn't change. The only thing that changed was a number called **utilisation crossing a threshold called the kink**.

This article explains what a kink interest model is, why every serious DeFi lender uses one, and how to read the kink point of any pool before you deposit — because it tells you in advance how a single large borrow can wreck the rate you came for.

If you haven't read [utilisation rate](/learn/utilisation-rate) yet, start there. This is the sequel.

---

## What a kink rate model actually is

A kink interest model is a piecewise function that maps utilisation (borrowed ÷ deposited) to a borrow rate. It has two segments meeting at one point — the kink:

- **Below the kink** (e.g. 0% → 80% utilisation): borrow rate climbs gently from ~0% up to a base rate (say 5–8%).
- **At the kink** (e.g. 80% utilisation): the slope changes sharply.
- **Above the kink** (80% → 100% utilisation): borrow rate climbs vertically — from 8% to 100%+ over the last 20 percentage points of utilisation.

The kink point is set by the protocol. Aave's USDC market sits at 92%. Fluid's at ~85–90% depending on vault. Compound at 80%. Morpho follows the underlying market.

The mathematical purpose is to keep some pool capital withdrawable. Without a vertical zone above the kink, borrowers would happily push utilisation to 100% and lock every depositor in. With it, the second utilisation crosses the kink, the borrow rate jumps fast enough to either repel new borrowers or attract emergency repayments. Either way: the pool's liquidity gets defended automatically.

---

## The worked example

Imagine a $100M USDC market with the kink at 80% and these parameters:

| Utilisation | Borrow rate | Lender APY (≈ borrow × util × 0.85) |
|---|---|---|
| 30% | 2.4% | ~0.6% |
| 60% | 4.8% | ~2.4% |
| 80% (the kink) | 8.0% | ~5.4% |
| 90% | 35% | ~26.7% |
| 95% | 65% | ~52.5% |
| 99% | 95% | ~80% |

Read across the kink. From 80% to 90% utilisation, borrow rate quadruples (8% → 35%). Lender APY jumps from 5.4% to 26.7%. This is the same pool, same asset, same protocol. The only thing that changed is one large borrower opening a position that pushed util across the kink.

This is exactly the picture you see on DeFiLlama when a major fund opens a leveraged position into a stablecoin market. The rate doesn't drift; it steps.

---

## Why this matters for lenders

Three concrete consequences:

**1. APYs above the kink are not durable.** A pool quoting 25% lender APY almost always means utilisation is in the kink zone. That rate persists exactly as long as the borrower keeps the position open. The moment they repay, utilisation drops below the kink and your APY snaps back to single digits. You can't compound 25% for a year — you might compound it for three days.

**2. Withdrawal speed degrades the second you cross the kink.** Below the kink, there's idle capital and you can exit in one block. Above the kink, the pool is recruiting your withdrawal to fund someone else's exit. You queue. See [withdrawal speed](/learn/withdrawal-speed) for the four bands; the kink is what flips a pool from instant-band to soft-delay.

**3. The kink point itself is information.** A protocol with the kink at 95% is signalling that it wants very high capital efficiency and is willing to risk illiquidity. A protocol at 80% is signalling conservative liquidity defence at the cost of lower headline APY. Neither is wrong; they're different products.

---

## How to read any pool's kink in under 60 seconds

You don't need to read the contract. Three free sources tell you everything:

- **DeFiLlama Yields page**: hover any pool, look for the utilisation column. If utilisation is shown above 85%, assume you're at or past the kink for that protocol.
- **The protocol's own UI**: Aave, Fluid, Compound, Morpho all show current utilisation on every market page. They also publish the kink point in their docs.
- **The rate curve chart**: most lending dashboards show a small graph next to the rate. If the curve has a visible bend, the bend is the kink. If current utilisation is to the right of the bend, you're in the volatile zone.

A 30-second checklist before depositing into any lending pool:

1. What is the current utilisation?
2. What is the kink point?
3. How much room is there between them?

If utilisation is 60% and the kink is 80%, you have a 20-percentage-point buffer. Roughly $20M of new borrowing capacity on a $100M pool before the rate spikes. That's a *durable* APY.

If utilisation is 87% and the kink is 85%, you're already in the kink zone. The quoted APY is real — but it's only real until someone repays.

---

## How the PassiveBlocks bot uses this

The bot's two-gate rule for entering a lending position is utilisation between 60–85% with at least a 4-week stability window. The 85% upper bound is deliberate — it's just below the kink for most established protocols (Aave 92%, Fluid 85–90%, Compound 80%). Capping the entry at 85% ensures the bot is buying durable yield, not surfing a temporary spike.

The 4-week stability gate is the second half of the rule. A pool whose utilisation oscillates in and out of the kink zone is not a place to park capital. The bot wants pools where utilisation has held a band for at least a month — that's the difference between a pool earning real swap fees and a pool surfing emissions.

This is also why the bot has not chased the "high yield" leaderboard alerts that show up every week in DeFi Telegrams. Most of them are kink-zone spikes that will be gone by the time you bridge in.

---

## The two-question decision tree

Before depositing into any lending pool, answer these two questions in the order written:

**Q1: Where is current utilisation relative to the kink?**
- More than 5 percentage points below → continue to Q2.
- Within 5 points of, or above, the kink → skip this pool. The APY is not durable.

**Q2: How long has utilisation held this band?**
- 4+ weeks at a similar level → durable yield, deposit OK.
- Less than 4 weeks → either too new to read, or volatile. Either way, wait.

This is a one-screen filter. If a pool fails Q1, you don't need Q2. If a pool passes Q1 but fails Q2, you're not turning down yield — you're refusing to be the exit liquidity for the previous wave of depositors.

---

## The frame to keep

Utilisation tells you whether an APY is *real*. Kink tells you whether it's *durable*. Withdrawal speed tells you whether you can *exit at the price you came for*. Three numbers, all visible on the same page, none of them quoted on a leaderboard.

Most yield content stops at supply APY. The bot doesn't. Now you don't either.

---

## Subscribe

PassiveBlocks publishes a weekly newsletter on DeFi yield — what's earning, what to avoid, and what our bot is actually doing with real capital. No moon-emoji culture. Real numbers, weekly.

→ **[Subscribe to PassiveBlocks](https://passiveblocks.io)** — free.

---

*Editorial note: hardware wallet hygiene is the prerequisite for any of this advice to matter. A Trezor keeps your private keys offline while you connect to Aave, Fluid, Compound, or any other lending market. → [Get Trezor](https://affiliate.trezor.io/publisher/#!/offer/133) (affiliate — we earn a commission at no extra cost).*

*Tracker: pb_learn_kink_interest_models*
