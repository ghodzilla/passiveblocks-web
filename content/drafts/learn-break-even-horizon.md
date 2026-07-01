# Break-even horizon — the question that decides every rate switch

You're earning **5.2%** on your USDC. A pool three clicks away is quoting **11%**. Nearly double. The instinct is immediate: move.

Here's the question that instinct skips. Not *"is 11% bigger than 5.2%?"* — obviously it is. The real one is:

**Will I still be in that pool by the time the switch pays for itself?**

Because the cost of moving is paid once, today, in full. The extra yield arrives one day at a time. Whether the trade is worth it comes down to a race between those two — and on the pools that quote the loudest numbers, the yield usually loses.

## Costs are a wall. Yield is a trickle.

When you switch positions you pay three things, all up front:

- **Gas** — both legs, exit and entry. Call it ~$40.
- **Slippage** — the [spread you cross](https://passiveblocks.io/learn/slippage-tax) getting out of one pool and into another. On thin, high-APY pools this dwarfs the gas.
- **A realised tax event** — in Australia, [every swap is a CGT event](https://passiveblocks.io/learn/defi-tax-australia). Moving crystallises a gain or loss whether you wanted to or not.

You pay that whole stack the moment you move. The reward — the *gap* between the new rate and your old one — drips in daily. So the honest way to read a rate upgrade isn't the headline delta. It's a simple division:

**Break-even horizon = total switch cost ÷ extra yield per day.**

If the answer is longer than you'll actually hold the position, the move loses money no matter how big the new number looks.

## A worked example

You have **$10,000** at 5.2%. The new pool quotes 11%.

- Extra yield: (11% − 5.2%) = 5.8% a year on $10K = **$580/year**, or about **$1.59/day**.
- Switch cost: $40 gas + ~1% slippage round-trip on a mid-depth pool ($100) + a realised CGT event (say $60 of tax drag) = **~$200**.

Break-even horizon: $200 ÷ $1.59 = **126 days.** You need to sit in that pool for **four straight months** just to get back to zero — before you've earned a cent of actual extra profit.

Now the catch. That 11% is almost never a four-month number. High rates [mean-revert](https://passiveblocks.io/learn/yield-mean-reversion) as capital floods in, and emissions-driven rates [decay as they age](https://passiveblocks.io/learn/annualised-apy-trap). If the pool fades to 7% after six weeks — very normal — your extra yield shrinks mid-race, the break-even line pushes further out, and you exit long before you ever crossed it. You paid $200 to rent a number that was gone before it repaid you.

## Why this is different from "just use a buffer"

A fixed rule — *only move if the new rate beats the old by 3 percentage points* — is a good first filter, and it's [how the bot screens most switches](https://passiveblocks.io/learn/when-not-to-rebalance). But a percentage-point buffer answers *"is the gap big enough?"* It doesn't answer *"big enough for how long?"*

The break-even horizon adds the missing axis: **time.** A 6pp gap clears any buffer, but if the pool holds that gap for three weeks and your payback period is nine, the buffer said yes and the arithmetic said no. Buffer is the hurdle. Horizon is the clock. You need both.

## The one-line filter

Before you chase any higher rate:

**How many days must I stay for the extra yield to repay what the move costs — and will the rate still be there that long?**

- **Payback is short and the rate is durable** (a boring, established pool that's been steady for months) → the switch is real. Take it.
- **Payback is long, or the rate is a fresh spike** → you'll almost certainly leave before it pays off. The upgrade is a downgrade with extra steps.

Fast proxy: divide your switch cost by the daily dollar gain. If that number of days is longer than the pool's rate has *already existed*, walk.

## How the bot treats it

PassiveBlocks doesn't compare rates, it compares *net outcomes over a holding period*. Every candidate move gets its full switch cost — gas, slippage, and the realised tax event — divided against the daily yield gain, and the resulting payback horizon is checked against how durable the new rate actually looks. Most "better" pools never clear it. That's a big part of why the bot has rebalanced ~zero times across the quarter while quietly keeping ~100% of a steady real return: the highest rate it skipped almost always had a break-even horizon longer than the rate itself would survive.

## A note on self-custody

Chasing rate upgrades means a constant churn of new pools, new contracts, and fresh token approvals — the exact surface attackers fish in. The one risk you can delete outright is your signing key: keep it on a device that never touches the internet, and a bad approval on some short-lived farm still can't move your funds. → **[Get a Ledger here](https://shop.ledger.com/?r=a6255ec0ba49&tracker=pb_learn_break_even_horizon)** *(affiliate — we earn a commission if you sign up, at no cost to you)*

---

## Price the clock, not just the rate

A higher APY is only real if you're still holding it when it pays for the move. PassiveBlocks scores every rate against its break-even horizon — and only flags switches that actually clear it. Free, weekly:

→ **[Subscribe to PassiveBlocks](https://passiveblocks.io)**

**Earn more — PassiveBlocks**

*Last updated: 2026-07-02*
