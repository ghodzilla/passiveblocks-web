# Utilisation Rate — The Number That Decides Whether the APY Is Real

*URL: passiveblocks.io/learn/utilisation-rate*
*Last updated: 2026-05-20*

---

Every lending dashboard shows two big numbers: **supply APY** and **borrow APY**. Most readers look at supply APY, pick the highest, and deposit. That decision is wrong about half the time, and the reason is one extra number that the same page already shows you: **utilisation rate**.

This article explains what utilisation actually means, the four bands you need to recognise on sight, and the worked example we use inside the PassiveBlocks bot to decide whether a quoted APY is durable or a mirage.

---

## What utilisation actually is

A lending pool is a stack of capital that someone else borrows. **Utilisation = borrowed ÷ deposited.**

- $100M deposited, $80M borrowed → 80% utilisation.
- $100M deposited, $30M borrowed → 30% utilisation.

You only earn yield on the borrowed portion. The unborrowed portion sits idle. That single fact is why two pools, on the same protocol, with the same borrower interest rate, can pay lenders wildly different APYs.

---

## The worked example

Pool A and Pool B are both on Fluid. Both quote a borrower rate of 8%. They're the same protocol, same chain, same asset.

| | Deposited | Borrowed | Utilisation | Borrower rate | Lender APY (≈ borrow × util × (1 − reserve)) |
|---|-----------|----------|-------------|---------------|----------------------------------------------|
| Pool A | $100M | $80M | 80% | 8% | ~6.4% |
| Pool B | $100M | $30M | 30% | 8% | ~2.4% |

The protocol takes a small reserve cut; the rest flows to lenders. Pool A pays 2.7x more than Pool B for the same risk and the same protocol, purely because more of the pool is working.

If you sorted by supply APY and didn't look at utilisation, you'd pick Pool A. Correct answer — but for the wrong reason. The right framing is: *Pool A is paying more because it's already 80% full; Pool B is fragile because one large deposit halves the rate.*

---

## The four bands

Once you know the number, the read-off is fast.

**1. Under 40% — the rate is fragile.**
The APY is real today, but it crashes the moment new capital arrives. Don't deposit large size; you'll personally compress your own rate by pushing utilisation lower.

**2. 60–80% — the sweet spot.**
Healthy borrow demand, plenty of liquidity buffer to exit on, rates resist new-deposit compression. This is where the PassiveBlocks bot prefers to sit.

**3. 80–95% — high yield, slower exit.**
Rates are excellent. But withdrawals get queued because borrowers haven't repaid. On most days you can still exit instantly; on the day you actually need to, you might wait hours. Acceptable for capital you don't need immediately.

**4. Above 95% — the trap.**
Headline APY is enormous and the exit door is closed. If a single whale tries to withdraw, the protocol freezes new withdrawals until borrowers repay. On chains with kink interest models, the borrow rate also spikes — which spikes the supply APY — which baits more deposits — which means your "high yield" pool is actively recruiting the next round of lenders to come supply liquidity for *your* exit. Avoid.

---

## Why this number kills most "alpha" pools

The newsletter dashboards that promise 15–25% APY on stablecoin lending are almost always quoting numbers from pools in band 4 — sub-$10M TVL, 98%+ utilisation, borrow rate spiked by the kink. Three things tend to be true at once:

1. The APY is mathematically real for the current second.
2. You cannot exit at that APY because borrowers haven't repaid.
3. The pool has been live for under 60 days, so the borrow demand has no track record.

The pool isn't lying. The dashboard isn't lying. The implicit promise — *"you can earn this rate"* — is what's wrong. You can earn it as long as you're prepared to be the last one out.

---

## Where to check utilisation

Every major lending UI shows it on the pool detail page:

- **Aave** — "Utilisation rate" under the supply/borrow card on each market.
- **Fluid** — top-right of the asset detail page on fluid.instadapp.io.
- **Morpho** — "Utilisation" column on the markets table.
- **Kamino** — supply/borrow ratio on the obligation overview.
- **DeFiLlama Yields** — the "Util" column (sort by it, filter to lending pools, scan in seconds).

If a pool's UI doesn't surface utilisation, treat that as a flag. You're being shown the headline rate without the input that determines whether it survives.

---

## The PassiveBlocks bot's rule

The bot uses two utilisation gates before depositing:

1. **Current utilisation must be 60–85%.** Below 60% means the rate is fragile to fresh deposits; above 85% means exit liquidity is questionable.
2. **Utilisation must have held that band for at least 4 weeks.** A pool that hit 80% utilisation last Tuesday because of one whale isn't yet a stable rate — it's a snapshot.

Both gates must pass. Either one failing routes capital somewhere else, even when the headline APY is higher.

That's why the bot's allocation looks "boring" most weeks: the screener throws out the 12% APY pools because they fail gate 2, and concentrates on 4–5% pools that have held the band for months.

---

## The takeaway

Supply APY is a *headline*. Utilisation rate is what tells you whether the headline survives contact with reality.

Two pools at "the same rate" can be two completely different trades. Two clicks deeper on the same dashboard tells you which one is real.

Before you deposit, check utilisation. If it's under 40% or over 95%, the APY is either fragile or trapped. The boring 60–80% pools are where actual yield lives.

---

## Related reading

- [Stable LP vs Stable Lending](/learn/stable-lp-vs-lending) — when to pick lending over LP at all
- [When NOT to Rebalance](/learn/when-not-to-rebalance) — the 3% buffer rule for chasing better rates
- [Best USDC Yield Strategies 2026](/learn/usdc-yield-strategies) — the 5-tier risk ladder

---

If you'd rather skip the dashboards and have a bot do this check every 3 hours across Fluid, Aave, Morpho, and Kamino — subscribe to the PassiveBlocks newsletter. Free, weekly, no spam. We publish the bot's actual positions and utilisation gates every Friday.

*Earn more — PassiveBlocks*
