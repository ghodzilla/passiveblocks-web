# Withdrawal Speed — The Yield-Quality Number Nobody Quotes

**Two pools pay the same 6% APY. One lets you exit in 12 seconds. The other locks your capital for 90 days. Both call it "yield." Only one is.**

If you're comparing two on-chain earning vehicles by APY alone, you're missing the most expensive variable. Yield without liquidity is a term deposit dressed up as a money market — and you don't get the bank rate to compensate. This is the number nobody puts on the leaderboard. Here's why it matters, and how to read it before you deposit.

## What "withdrawal speed" actually measures

When you click "withdraw" on a yield position, three things have to happen for you to hold your capital again:

1. The protocol has to **release** your share.
2. There has to be **liquidity** on the other side (somebody to take the position you're leaving).
3. The chain has to **settle** the transfer.

In a healthy lending pool — Aave on Ethereum, Fluid on Arbitrum, Kamino on Solana — all three happen inside a single block. You click withdraw at the start of one block, you hold the asset at the end of the same block. 12 seconds on Ethereum. ~1 second on Solana.

In an unhealthy or structurally illiquid position, any one of those three can stall. Sometimes by hours. Sometimes by months.

## The withdrawal-speed bands

Roughly, on-chain earning vehicles fall into four bands:

| Band | Time to exit | Examples |
|------|--------------|----------|
| **Instant** | Same block (~12s ETH / ~1s SOL) | Aave, Fluid, Compound, Kamino lending — when utilisation is below ~90% |
| **Soft delay** | Minutes to hours | Same protocols at high utilisation (>95%); some LP positions with thin pool depth |
| **Hard queue** | Days to weeks | LST unstaking (stETH 1–3 days, mSOL ~5 days), some restaking protocols, locked vault tranches |
| **Term-locked** | Weeks to months | Pendle PT/YT before maturity, fixed-term DeFi notes, locked staking |

The headline APY tells you what you might earn. The band tells you what it actually costs to be wrong.

## Why utilisation is the early-warning signal

Lending pools shift band the moment utilisation crosses ~90%. Below that, exits are instant. Above it, the pool doesn't have idle capital to give back — you wait for a borrower to repay or for new deposits to land.

We covered this in detail in our [utilisation rate deep dive](https://passiveblocks.io/learn/utilisation-rate). The short version: a pool at 98% utilisation is paying you a great rate because there's almost no idle capital left to lend. That same lack of idle capital is what slows your exit when you click withdraw.

You can't have both. High utilisation = high rates + slow exits. Low utilisation = lower rates + instant exits. The newsletter front pages quote the first half. The exit speed is the silent half.

## The Pendle case — when "yield" is a term deposit

Pendle is a brilliant protocol. It's also the clearest example of why APY without liquidity context misleads.

When you buy a Pendle PT (Principal Token) for a 30-day pool, you're buying the right to redeem a fixed amount at maturity. The "yield" you see — sometimes 12%, sometimes 18% — is real. But you cannot withdraw before maturity at face value. You can sell the PT on Pendle's AMM, but the price moves with rates and time-to-maturity, and you take a haircut.

For an investor who knows the term and is comfortable locking, this is correct behaviour. For somebody who clicked "highest APY" on a yield leaderboard expecting Aave-style liquidity, it's a surprise that costs.

**Rule of thumb:** if the headline APY is more than ~3 percentage points above the equivalent open lending rate, the yield is buying you something — and the most common thing it's buying is your liquidity.

## The LST queue — when "stake" is a withdrawal queue

Liquid staking tokens (stETH, rETH, mSOL, jitoSOL) earn the underlying staking yield while staying liquid on secondary markets. That secondary liquidity is doing the heavy lifting — at any moment, you exit by selling, not by unstaking.

But the *unstake* path is queued. Ethereum's unstaking queue has run between 0 days (quiet weeks) and 11 days (post-Merge, post-Cancun spikes). Solana's is shorter — typically 2–5 days for full unstake.

If you're holding stETH as collateral on a lending protocol and the price discount widens (which happens during withdrawal-queue stress), you've got two exits and both are bad: sell stETH at a discount, or unstake and wait. The fact that the headline APY was 3.5% the whole time is irrelevant when the exit is the variable.

## How to read this on any new pool, in 30 seconds

Before you deposit:

1. **Lending pool?** Check utilisation. Under 85% = instant. 85–95% = soft delay. Above 95% = expect a wait.
2. **LP position?** Check pool TVL vs your position size. If you're more than ~1% of the pool, your exit will move the price against you.
3. **Anything else (Pendle, LST, restaking)?** Read the redemption mechanism explicitly. If the word "queue," "maturity," "epoch," or "lock" appears, treat the position as term-locked and price it accordingly.
4. **Across all of them**, ask: how much extra APY am I getting vs the equivalent open lending rate? If the gap is small, you're being paid fairly. If the gap is large, the spread is the price of locked or queued exits.

## The bot's rule

PassiveBlocks holds three positions today, all in the **instant** band. Two are Fluid lending positions (utilisation under 85% on both as of this week). One is an in-range LP. None have a queue, none have a maturity, none have an unstaking lock.

That isn't an accident. The 3% buffer rule we use for rebalances assumes the bot can actually execute the rebalance when math says it should. A position in a hard queue or a maturity lock breaks that assumption — the bot can't react to a rate change or a depeg if the exit takes a week.

**The rule:** if a position cannot be exited in the same block, the APY has to clear lending by enough to pay for the locked period — and the period itself has to fit inside the bot's planning horizon. On sub-$10K capital, that almost never holds.

## When you *should* take a slower-exit position

There is a right answer here, and it isn't "always instant." Term-locked yield is the correct call when:

- You have a clear time horizon for the capital that exceeds the lock (you know you won't need this money for 90 days).
- The yield premium clears the equivalent open lending rate by at least 2 percentage points.
- The position size is large enough that the locked-period downside is small relative to your overall portfolio.

For an investor with $250K who wants to lock $30K for three months at 14% via Pendle, the math works. For somebody with $5K total clicking the top of a leaderboard, it doesn't.

## The two-question decision tree

Before any deposit, ask:

1. **If I clicked withdraw right now, would I hold the asset in the same block?** If yes → instant band, treat as Aave-equivalent. If no → continue.
2. **What's the maximum delay, and does my time horizon for this capital exceed it by 2x or more?** If yes → fine, treat the lock as the price of the yield premium. If no → walk away.

That's the whole framework. Withdrawal speed isn't a separate axis from APY — it's the same axis, viewed from the other side.

## Want to skip the homework?

We do this read on every pool the bot considers, weekly. We publish the three picks that survive — single-asset, instant exit, established protocol, real (not emissions-paid) yield.

→ **[Subscribe to the PassiveBlocks newsletter](https://passiveblocks.io)** — weekly yield picks, one risk corner, one tool. No leaderboard chasing.

→ **[Hold significant DeFi capital? Get a Ledger.](https://shop.ledger.com/?r=a6255ec0ba49&tracker=pb_learn_withdrawal_speed)** *(affiliate link — we earn a small commission at no cost to you.)* A hardware wallet is the single biggest risk reduction on any DeFi position — withdrawal-speed advantages mean nothing if your keys are compromised.

*Earn more — PassiveBlocks*
