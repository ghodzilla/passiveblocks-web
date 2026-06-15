# The Four Numbers That Explain Any DeFi Yield

A leaderboard hands you one number: the APY. It's the least useful number on the page.

A 12% pool and a 5% pool can be the same risk, or worlds apart — and the headline rate won't tell you which. Four other numbers will. Once you know where to find them, you can screen any USDC lending pool in about 60 seconds and know whether the yield is real, durable, and exitable — or a countdown dressed up as a return.

This is the screen our bot runs on every pool before it deposits a dollar. Here are the four numbers, in the order we read them.

## 1. Utilisation — is the APY real, or borrowed from the exit?

Utilisation is the share of a lending pool that's currently borrowed. It's the single biggest driver of the rate you're quoted, because lender APY = borrow rate × utilisation × (1 − reserve factor).

The sweet spot is roughly **60–85%**. Below that, the pool is underused and the rate is thin. Above ~90%, the rate looks great — but there's no idle capital left, which means your same-block withdrawal quietly turns into a wait for borrowers to repay. A pool at 98% utilisation isn't paying you a premium for nothing. It's paying you to keep funding everyone else's exit.

**Where to check:** the protocol's own pool page (Aave, Fluid, Morpho, Kamino all show it), or the utilisation column on DeFiLlama Yields.

→ Full breakdown: [Utilisation rate — the number that decides whether APY is real](https://passiveblocks.io/learn/utilisation-rate)

## 2. The kink — how violently does the rate move?

Borrow rates aren't a smooth curve. Every money market has a **kink**: a utilisation threshold (usually around 80–90%) above which the borrow rate stops climbing gently and goes near-vertical. Below the kink, an extra borrower nudges the rate. Above it, one borrower can quadruple it in minutes — and collapse it just as fast when they repay.

This matters because a 25% APY sitting above the kink isn't a 25% yield. It's a 25% yield *until one borrower closes a position*. The kink point is also a design signal: a protocol that sets its kink at 92% is tuned for capital efficiency over exit safety. Read the kink before you trust the rate.

→ Full breakdown: [Kink interest models — why borrow rates spike vertically](https://passiveblocks.io/learn/kink-interest-models)

## 3. Withdrawal speed — how fast can you actually leave?

A pool paying 6% where you exit in 12 seconds is a different financial product to a pool paying 6% where the exit takes 90 days. Same number on the leaderboard. Wildly different instrument.

Four bands cover almost everything:

- **Instant** (same block) — Aave, Fluid, Kamino at normal utilisation.
- **Soft delay** (hours) — the same pools once utilisation crosses the kink.
- **Hard queue** (days) — LST unstaking, e.g. stETH 1–3 days.
- **Term-locked** (weeks+) — Pendle PTs before maturity, fixed-term notes.

Rule of thumb: **if a pool beats open lending by more than ~3 points, the spread is usually buying your liquidity.** Price that lock against the week you'll actually need the money.

→ Full breakdown: [Withdrawal speed — the yield-quality number nobody quotes](https://passiveblocks.io/learn/withdrawal-speed)

## 4. Reserve factor — how much of the yield never reaches you?

The reserve factor is the cut the protocol skims off borrower interest before it's split among lenders. It's rarely on the leaderboard, and it's why your realised APY is always a little under the naive "borrow × utilisation" math.

A worked example on $10K: a pool with an 8% borrow rate at 80% utilisation looks like it pays lenders 6.4%. Apply a 15% reserve factor and the real figure is **5.44%** — about $96 a year, on $10K, going to the protocol treasury instead of you. Most pools sit in the 5–20% band; anything above ~35% is taking a serious slice. It doesn't make a pool bad. It just means you compare pools on the *reserve-adjusted* rate, not the headline.

→ Full breakdown: [Reserve factor — the protocol fee column nobody quotes](https://passiveblocks.io/learn/reserve-factor)

## Putting it together — the 60-second screen

Run any pool through the four in order:

| Number | Good sign | Walk-away sign |
|--------|-----------|----------------|
| Utilisation | 60–85% | >90% (slow exit) or <40% (thin rate) |
| Kink | rate sits well below the kink | rate only exists above the kink |
| Withdrawal speed | instant band | hard queue or term lock you didn't price |
| Reserve factor | 5–20%, rate compared *after* the cut | 35%+, or you only saw the headline |

If a pool clears all four, the yield is probably real and durable. If it fails even one, you now know exactly what the extra APY is charging you for — depeg risk, exit risk, a protocol cut, or a printed token with a half-life.

That's the whole job. The APY tells you what a pool *says*. These four numbers tell you what it *is*.

It's also why our bot has held the same boring lending positions for ten weeks with zero rebalances. Every "missed alpha" rate we've skipped failed at least one of these four. Boring, when you've actually checked the numbers, is a strategy.

---

**Want the four-number screen run on live pools every week?** That's the whole point of the PassiveBlocks newsletter — real rates, the four numbers behind them, and the one pool we're *not* touching and why. [Subscribe here](https://passiveblocks.io) — free, weekly, no moon emojis.

*Earn more — PassiveBlocks*
