# Reserve factor — the protocol fee column nobody quotes

You've checked the borrow rate. You've checked the utilisation rate. You've calculated what your lender APY should be. Then you deposit, and the actual yield comes in 10–20% below what your math said.

The number that ate the difference is **reserve factor**. It's the cut the protocol takes off the top of every interest payment before lenders see any of it. It's printed on every lending page if you scroll, and almost nobody quotes it when they share APYs.

This is the third of the three numbers that explain why your DeFi yield isn't what you think it is. (The first two: [utilisation rate](https://passiveblocks.io/learn/utilisation-rate) and [withdrawal speed](https://passiveblocks.io/learn/withdrawal-speed).)

## What it actually does

Reserve factor is a percentage — usually between 10% and 25% — that the protocol skims from every interest payment borrowers make. The money goes to the protocol's insurance reserve (in case of bad debt) and, on some protocols, to the protocol's treasury or DAO.

It's not a one-off fee. It's a permanent tax on every dollar of yield the pool generates, taken before any of it reaches lenders.

The naive lender APY calculation is:

> lender APY ≈ borrow APY × utilisation

The actual lender APY is:

> lender APY ≈ borrow APY × utilisation × (1 − reserve factor)

That last term is what trips people up. It looks like a small adjustment. It isn't.

## Worked example

Take a USDC pool with the following state:

- Borrow APY: **8.0%**
- Utilisation: **80%**
- Reserve factor: **15%**

The naive calculation:

> 8.0% × 0.80 = **6.4% lender APY**

The actual calculation:

> 8.0% × 0.80 × (1 − 0.15) = 6.4% × 0.85 = **5.44% lender APY**

Almost a full percentage point lower. On a $10,000 deposit, that's **$96/year that goes to the protocol, not you**. Over 5 years compounding, the gap is closer to $550.

It's not theft. The reserve fund is what stops the protocol from socialising losses if a borrower defaults. But it's a real number, and if you don't subtract it from your expected APY before you decide whether to deposit, you've already misjudged the trade.

## What's normal, what's a flag

Reserve factors vary by protocol and asset. Here's the rough map:

| Reserve factor | What it means | Examples |
|----------------|---------------|----------|
| **5–10%** | Conservative — mature, well-collateralised market | Aave V3 USDC mainnet, blue-chip stable markets |
| **10–20%** | Standard for most stablecoin markets | Most Fluid, Morpho, Aave V3 markets |
| **20–35%** | High — protocol is keeping more, often because the asset is volatile or the market is newer | New L2 markets, volatile-asset markets |
| **>35%** | Flag. Either the asset is high-risk (and the reserve needs to be fat to cover potential bad debt) or the protocol is extracting unusually hard from lenders | Newer chains, exotic collateral, isolated markets |

A reserve factor above 35% isn't automatically wrong — but it tells you the protocol is pricing in either real bad-debt risk or unusual extraction. Either way, your "8% APY" is probably closer to 4–5% by the time the cut comes off.

## Why protocols don't quote it on the lending page

They do, but it's behind a click. On Aave you'll find it in the "Pool details" expander. On Fluid it's in the vault parameters tab. On Morpho it's in each market's risk parameters. DeFiLlama's Yields table does *not* show it as a column — which is exactly why most published APY tables are off by 10–20%.

The reserve factor is also one of the few yield-relevant numbers that **doesn't change in real time**. Utilisation moves every minute. Reserve factor changes only by governance vote, usually a few times a year per market. That makes it easy to look up once and store with your other due-diligence notes per protocol.

## The 60-second pool-read checklist (now four numbers)

The compound check for "is this APY real" is now:

1. **Utilisation** — is the pool in the 70–80% sweet spot? Above 85% = exit risk. Below 60% = APY fragile.
2. **Kink point** — where does the borrow rate spike vertically? (Usually 80%.) If utilisation is already past it, the APY is non-durable.
3. **Withdrawal speed** — instant, soft delay, hard queue, or term-lock?
4. **Reserve factor** — is it 10–15% (standard) or 25%+ (taking a real bite)?

Run those four numbers on any pool before depositing. The math takes one minute. The four numbers together tell you whether the headline APY is a real yield or a leaderboard mirage.

## How the bot uses it

The bot's allocation logic subtracts the reserve factor from the expected APY *before* comparing pools. So when a new pool quotes "9.5%" but has a 25% reserve factor, the bot's internal number is **9.5% × (1 − 0.25) = 7.13%**. Compared against our current Fluid Base position at **5.19%**, the gap is only 1.94pp — below our 3pp rebalance buffer. The bot stays put.

This is the same discipline that has kept the bot at 0 trades for 7 weeks. Every "missed alpha" we see on Twitter is calculated against the wrong APY.

## Decision tree

When you're checking whether a pool's headline APY is real:

1. **Does the protocol publish its reserve factor anywhere on the lending page or docs?** If no — skip the pool. A protocol that hides this number is hiding the whole APY math.
2. **Is the reserve factor under 20%?** If yes — the published APY is roughly what you'll get. If no — subtract the reserve factor from the headline and ask the same questions you'd ask of any other yield at that lower number.

That's it. Two questions. Less than a minute. Lower failure rate than 90% of yield decisions get made with.

---

## Stack the four numbers, get a real yield

Utilisation, kink, withdrawal speed, reserve factor. Each one is a 30-second lookup. Run all four before depositing and you've done more risk-adjusted yield diligence than most people running 5x your capital.

**Want the bot to do this work for you?** PassiveBlocks runs all four checks on every pool, every three hours, on every chain we cover — and only flags the ones where the *real* APY (after reserve factor) clears our 3pp buffer over our current position. Free newsletter, weekly:

→ **[Subscribe to PassiveBlocks](https://passiveblocks.io)**

**Earn more — PassiveBlocks**

*Last updated: 2026-05-23*
