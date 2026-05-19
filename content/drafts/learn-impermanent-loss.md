# Impermanent Loss, Explained With a Real Number Example

*URL: passiveblocks.io/learn/impermanent-loss*
*Last updated: 2026-05-14*

---

Impermanent loss (IL) is the single most misunderstood concept in DeFi. The name doesn't help — "impermanent" sounds optional, like it might go away if you wait long enough. In practice, almost everyone who provides liquidity locks the loss in when they exit.

Here is what it actually is, with one worked example so the number is yours to keep.

---

## The one-sentence definition

When you supply two assets to a liquidity pool, you end up with a different mix of those assets than you put in. If the price ratio between them moved while you were in the pool, that new mix is worth less than if you had just held both assets in your wallet.

That gap is impermanent loss.

It exists because of how AMMs (automated market makers) price swaps — they rebalance your share of the pool every time someone trades against it, and they don't ask your permission.

---

## A worked example with $1,000

Suppose you provide liquidity to an ETH/USDC pool. You deposit:

- $500 USDC
- $500 worth of ETH (0.25 ETH at $2,000)

Total deposited: $1,000.

ETH then doubles to $4,000.

The pool's pricing formula automatically rebalances your share. By the time you check, you no longer hold 0.25 ETH and 500 USDC. You hold approximately:

- 0.177 ETH (worth $708)
- 707 USDC

Total now: **$1,414** (rounded).

But if you had just held the assets in your wallet, you would have:

- 0.25 ETH × $4,000 = $1,000
- 500 USDC = $500

Total held: **$1,500**.

The difference — **$86, or 5.7%** — is impermanent loss. The bigger the price move, the worse the gap gets.

| ETH price change | Impermanent loss |
|---|---|
| +25% | 0.6% |
| +50% | 2.0% |
| +100% (2x) | 5.7% |
| +300% (4x) | 20% |
| +500% (6x) | 25.5% |

The math is symmetrical — a 50% price drop produces the same 2.0% loss as a 50% rise.

---

## Why is it called "impermanent"?

Because if the price ratio returns to where you started, the loss disappears. If ETH falls back to $2,000 in our example, your position re-balances and you end up roughly back where you began — net of any fees earned during the round trip.

The catch: most LPs do not wait for that return. They exit when prices have moved, which crystallises the loss.

The honest framing: "impermanent" describes the math, not your behaviour. For practical purposes, treat IL as **real loss** when you exit.

---

## When fees offset IL — and when they don't

IL is only half the picture. The other half is the swap fees you earn while you are in the pool. The right question isn't "will I have IL?" — it's "do the fees exceed the IL?"

This depends on three things:

1. **The pair.** Stablecoin pairs (USDC/USDT) have near-zero IL because both assets track $1. Correlated pairs (CBBTC/WBTC, ETH/STETH) have minimal IL. Volatile pairs (ETH/USDC, SOL/USDC) can have meaningful IL during large moves.
2. **The volume.** A pair with $10M/day in swap volume generates real fee income. A pair with $50K/day doesn't, no matter how good its APY looks on a dashboard.
3. **Your range.** On concentrated liquidity AMMs (Uniswap V3, Orca, Aerodrome Slipstream), tight ranges earn more fees but require more rebalancing. Wide ranges earn less but are passive.

A good rule of thumb: if a pool's stated APY is mostly from token emissions rather than real swap fees, treat that APY with suspicion. Emissions can stop overnight. Volume-driven fees are sticky.

---

## Three ways to minimise IL

**1. Use correlated pairs.** USDC/USDT, USDC/DAI, CBBTC/WBTC — assets that move together produce almost no IL by definition. The yield is lower but the trade-off is honest.

**2. Use lending instead of LP.** Single-asset lending (Aave, Fluid, Kamino) has zero IL by design. You deposit one asset, you get back that asset plus interest. The rates are lower than active LP, but for most retail investors, the simplicity is worth more than the marginal yield.

**3. Pick high-volume pairs in liquid markets.** If you do want LP exposure, pick a pair where real trading volume — not emissions — is driving the APY. ETH/USDC on a top-3 DEX during a volatile week is a different beast than a long-tail token pair with low volume.

---

## The PassiveBlocks rule of thumb

For retail-sized portfolios ($1K to $100K), here is the order we recommend:

1. **Start with lending.** Fluid or Aave on USDC. Zero IL. 4–5% APY today. Learn the wallet flow with a position that cannot surprise you.
2. **Graduate to stable LP if you want more yield.** USDC/USDT or USDC/DAI on a high-volume DEX. ~6–8% APY, minimal IL.
3. **Add volatile LP only with eyes open.** ETH/USDC, SOL/USDC, WBTC/WETH can pay 20–60% APY in concentrated ranges, but you are taking real IL exposure. Track your performance against the simpler alternative of just holding the underlying. If you are not beating "hold," the IL is winning.

The bot we run for the newsletter holds the majority of its capital in single-asset Fluid lending for exactly this reason — when in doubt, take the yield that doesn't come with a hidden tax.

---

For weekly yield picks, bot diary updates, and protocol breakdowns, subscribe to the PassiveBlocks newsletter. Free. No spam. Unsubscribe anytime.

*Earn more — PassiveBlocks*
