# When NOT to Rebalance — The 3% Buffer Rule

*URL: passiveblocks.io/learn/when-not-to-rebalance*
*Last updated: 2026-05-18*

---

Every DeFi newsletter tells you to chase the higher yield. Most weeks, the right call is to do nothing.

This article is the rule the PassiveBlocks bot lives by: when a rebalance is worth executing, and — more often — when sitting still is the better trade.

---

## The headline rule

**Don't rebalance unless the expected gain clears gas plus a 3% buffer.**

That's it. Everything else is implementation detail.

The reason is arithmetic, not opinion. Every rebalance has three costs that compound:

1. **Gas to exit** the current position.
2. **Gas to enter** the new position.
3. **Slippage and tax friction** on each swap inside the move.

On a small position, those costs eat the gain before you've held the new pool for a single day. The 3% buffer is the margin of safety that says: even if the new APY drifts down a percentage point in the first week (it usually does), and even if I'm slightly wrong about the gas estimate, I'm still ahead.

---

## A worked example on $1,000

Say you're sitting in Fluid USDC at **4.6%** and a new pool advertises **7.0%** on the same asset.

The headline gap looks like a 2.4 percentage point uplift — $24/year on $1,000. Attractive.

Now stack the real costs:

| Cost | Amount |
|------|--------|
| Exit Fluid (gas) | ~$2 |
| Bridge / swap (if cross-chain) | ~$3 |
| Enter new pool (gas) | ~$3 |
| Slippage (0.1%) | ~$1 |
| **Total round-trip cost** | **~$9** |

A $9 cost on a $24/year uplift is a **4.6-month payback**. If the new pool's APY drops by 1.5 percentage points within the first six weeks (extremely common for new pools — see the next section), you never recover the cost.

The 3% buffer rule turns this into a one-line decision: 7.0% − 4.6% = 2.4 percentage points = 2.4% absolute APY gain. **2.4% does not clear the 3% buffer. Hold.**

The bot didn't think about it. It looked at the number and stayed put. That single rule is worth more than most "yield optimisation" engines.

---

## Why new-pool APYs decay

A pool advertising 7%+ on stablecoin lending today is almost certainly in one of three states:

1. **Emissions-heavy.** The protocol is paying you in its own token to attract TVL. Emissions schedules taper. Within 4–8 weeks the headline number halves.
2. **Low utilisation about to be filled.** A new pool with 30% utilisation looks great on paper, but as borrowers fill the pool, the lender share of the borrow rate kicks in, and the APY normalises down.
3. **Low TVL about to be diluted.** A $2M pool at 7% becomes a $20M pool at 4.5% within weeks if it stays on yield-aggregator dashboards.

In all three cases, the saver who jumped in chasing the headline ate the gas cost and now holds a position with the same APY they had before — minus the round-trip fees.

The 3% buffer prices this in. You don't need to predict which decay path the new pool will take. You just refuse to move unless the gap is wide enough to survive any of them.

---

## When the 3% buffer doesn't apply

There are three situations where you should rebalance even if the gap is smaller:

**1. The protocol you're in is breaking.** TVL dropping >20% in 24 hours. A peg event. A team announcement. None of these care about gas costs — you exit and ask questions later.

**2. The position is going out of range.** For concentrated liquidity LPs (Uniswap V3, Orca, Aerodrome Slipstream), an out-of-range position earns zero fees. Rebalancing back into range pays for itself within days if the pair has real volume.

**3. Tax harvesting at year-end.** If you're sitting on losses, realising them to offset gains can be worth more than the yield gap. This is jurisdiction-specific — Australian readers, see [DeFi tax in Australia](/learn/defi-tax-australia).

Everything else: hold.

---

## The capital-size adjustment

The 3% buffer is calibrated for retail-size capital ($1K–$50K). Two adjustments scale it:

- **Sub-$1,000 portfolios:** widen the buffer to **5%**. Gas costs are a higher percentage of small positions; you need more headroom.
- **$100K+ portfolios:** narrow the buffer to **1.5%**. Gas becomes negligible relative to the position, so smaller gaps clear the threshold.

The principle doesn't change. The number does.

---

## The PassiveBlocks bot, by the numbers

The bot we run for this newsletter has executed its rebalance-check loop every three hours since launch. Recent cycles:

- **Checks run:** ~56 per week.
- **Rebalances executed:** 0 in the last seven weeks.
- **Total gas spent this period:** $0.

Every cycle, the bot compares the current portfolio against the top alternatives across Fluid, Aave, Kamino, Aerodrome, Orca. Every cycle, the gap fails to clear the 3% buffer. So nothing happens.

That's not the bot being lazy. That's the bot being right.

The opportunity cost of *not* chasing emissions yields, the saved gas, and the avoided tax events compound silently. A year of "doing nothing" with this rule has historically beaten a year of active rebalancing on portfolios under $50K.

---

## The takeaway

If you remember one rule from this article: **the gap has to be wider than 3 percentage points and you have to clear gas, or you don't move.** Not 3% relative. Three percentage points absolute on the APY.

Most weeks, that rule will tell you to sit still. That is the rule working — not failing.

---

For weekly yield picks, the bot's diary, and the protocols we'd actually deposit into, subscribe to the PassiveBlocks newsletter. Free. No spam. Unsubscribe anytime.

*Earn more — PassiveBlocks*
