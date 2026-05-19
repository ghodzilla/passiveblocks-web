# Stable LP vs Stable Lending — Where to Park USDC in 2026

*URL: passiveblocks.io/learn/stable-lp-vs-lending*
*Last updated: 2026-05-19*

---

If you have stablecoins on-chain, you have two real choices for yield: **lend them to a money market** (Aave, Fluid, Kamino) or **provide liquidity to a stable pair** (Curve, Aerodrome, Orca).

Most newsletters tell you the LP option earns more. They're right on the headline rate. They're usually wrong on the after-risk return. This article is the decision tree the PassiveBlocks bot uses to pick between the two — with the numbers that matter.

---

## The honest comparison

Same amount of capital ($1,000 USDC), same time horizon (12 months), as at 2026-05-19:

| Option | Headline APY | After realistic friction | Worst-month risk |
|--------|--------------|---------------------------|-------------------|
| Fluid USDC lending (Arbitrum) | 4.63% | ~4.55% | Protocol exploit (low) |
| Aave USDC lending (Ethereum) | 3.80% | ~3.75% | Protocol exploit (low) |
| Curve USDC/USDT/DAI (stable LP) | 5.20% | ~4.80% | One stable depegs 1% = -0.5% NAV |
| Aerodrome USDC/USDT (stable LP) | 6.50% | ~5.40% | Emissions decay + depeg risk |
| Orca USDC/USDT whirlpool | 7.10% | ~5.20% | Concentrated range = active management |

The LP rows look higher. They are higher — until something moves.

---

## What you're actually being paid for

**Lending** pays you for taking *protocol risk and rate risk*. The borrower pays interest, the protocol takes a cut, you get the rest. Your USDC is always worth $1. You can withdraw whenever (subject to utilisation — see [our utilisation guide](/learn/utilisation-rate)).

**Stable LP** pays you for taking *peg risk and impermanent loss risk*. You're providing liquidity for two assets that *should* both be worth $1. As long as they trade at parity, you earn swap fees plus (often) protocol emissions. The moment one of the two stables drifts — even temporarily — the pool rebalances against you, and you've now bought the cheaper stable at the higher price.

Same dollar of yield. Different reasons it shows up. Different reasons it disappears.

---

## The 2023 USDC depeg, costed

In March 2023, USDC briefly traded at $0.88 after Silicon Valley Bank exposure was revealed. It re-pegged within 72 hours.

If you were lending USDC during that window:
- You held a deposit token that was always denominated 1:1 in USDC.
- You felt nothing in your position value. USDC re-pegged, your balance stayed identical.

If you were LP'ing USDC/USDT during that window:
- The pool rebalanced as arbitrageurs swapped out cheap USDT for cheap USDC.
- You exited the event holding **more USDC and less USDT** — but your *dollar* value was down ~4–6%, and you'd locked in the depeg loss.
- A full year of swap fees (5–6% APY) would have been wiped out by the single weekend.

This is not a hypothetical. It happened. It will happen again to a different stablecoin. The 12-month yield gap between lending and stable LP did not survive one bad weekend.

---

## When stable LP actually beats lending

LP is the right call in two specific situations:

**1. Battle-tested pairs with peg-defended stables.**
USDC/USDT on Curve or Aerodrome, both stables backed by named issuers (Circle, Tether), with multi-year depeg-recovery history. The LP earns 1–2 percentage points more than lending in normal markets. The depeg risk is real but bounded.

**2. Active concentrated liquidity, large capital.**
Orca and Aerodrome Slipstream let you concentrate liquidity inside a narrow band ($0.998–$1.002). On $50K+, the swap fees compound to genuine yield. On $1K, you're paying gas to rebalance the range more often than the fees pay.

For everyone else — sub-$50K, no time to manage ranges, no appetite for re-pricing a stable mid-week — **lending wins on a risk-adjusted basis.**

---

## The PassiveBlocks bot's actual allocation

For full transparency, here is how the bot is currently positioned (2026-05-19):

- **Stablecoin lending (Fluid, Arbitrum + Base):** ~99% of stablecoin capital.
- **Stable LPs:** 0%.
- **Volatile LPs (WBTC/WETH range):** small allocation, separate strategy slice.

The bot does not run stable LPs right now. Not because they can't earn — they can — but because at the current capital size the 0.5–1.5pp uplift over Fluid USDC doesn't clear the **depeg-risk premium** the bot prices in. At $50K+, that math changes. At $1K, it doesn't.

That's the rule + receipt: the rule is "LP only when the after-risk return clears lending by 2pp+." The receipt is the allocation above.

---

## The two-question decision tree

Before you put USDC into anything, answer two questions:

**1. Is the headline APY mostly fees or mostly emissions?**
- Mostly fees → it's earnable yield, sustainable.
- Mostly emissions → it's a marketing budget. Discount it 40–60%.

DeFiLlama shows the split for most pools. If you can't find it, assume emissions until proven otherwise.

**2. Does the position survive a 1% depeg of either stable for 48 hours?**
- Lending → yes, your balance is unchanged.
- Stable LP → no, you've eaten a 0.5–1% NAV hit on that side of the pair.

If you can't accept a stable-depeg drawdown, the only correct answer is lending.

---

## A note on hardware

If your stablecoin balance is over $5,000 — whether in lending or LP — the gating risk is no longer protocol yield. It's wallet hygiene. A single phishing signature wipes a year of careful yield work.

A hardware wallet (Ledger or Trezor) costs ~$120–$190 once and removes that entire category of loss. We covered the full guide in [Hardware wallet for DeFi](/learn/hardware-wallet-guide).

→ **[Get a Ledger Nano X](https://shop.ledger.com/?r=a6255ec0ba49&tracker=pb_learn_stable_lp_vs_lending)** *(affiliate link — we earn a commission if you sign up)*

---

## The takeaway

Lending earns slightly less and bores you to sleep. Stable LP earns slightly more and asks you to defend two pegs at once. On portfolios under $50K, the bored option wins on after-risk return almost every year.

The PassiveBlocks bot picks the boring option every cycle. That is the strategy, not a missing feature.

---

For weekly yield picks, the bot's full position diary, and protocol changes we'd actually care about, subscribe to the PassiveBlocks newsletter. Free. No spam. Unsubscribe anytime.

*Earn more — PassiveBlocks*
