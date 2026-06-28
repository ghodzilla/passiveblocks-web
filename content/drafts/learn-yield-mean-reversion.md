# A high APY is an invitation, not a rate — how yield mean-reverts

A pool is showing **14% on USDC**. You read it as a rate — a thing you'll earn if you deposit. It isn't. It's an advertisement, and the people who see it before you are already responding to it.

Here's what happens next. Capital reads the same 14% you did. It floods in. The pool's actual earnings — the fees or interest it genuinely produces — don't grow just because more money arrived. So the same pot of real income gets split across a bigger pile of deposits, and the rate falls. By the time your bridge clears and your deposit confirms, the 14% that lured you in is on its way to 5%. You didn't buy a rate. You bought the top of a decay curve.

This is **mean-reversion**, and it's a different lie from the [annualisation trap](https://passiveblocks.io/learn/annualised-apy-trap). Annualisation inflates a number by stretching a few weeks of emissions across a year. Mean-reversion deflates a *real* number through competition — too much capital chasing the same income. A pool can be completely honest about its yield today and still hand you half of it tomorrow, because you and everyone else showing up is the reason it drops.

## Why the rate falls when capital arrives

Most real DeFi yield comes from a roughly fixed stream of income — borrower interest on a lending market, swap fees on a trading pool. (If you're fuzzy on where yield actually comes from, start with [source of yield](https://passiveblocks.io/learn/source-of-yield).) That income stream doesn't care how many people are sharing it.

So the rate is just: **income ÷ deposits.** Hold the income steady and pour in deposits, and the rate has to fall. It's arithmetic, not a rug.

> A high APY is a signal that the pool is *underpopulated relative to its income.* That's a temporary condition. Your deposit, and everyone else's, is what fixes it.

The deeper point: high yield is self-correcting. The market is efficient enough that an unusually good risk-adjusted rate attracts capital until it stops being unusually good. A 14% stable yield that *stays* 14% for months is telling you one of two things — either the income stream is genuinely growing in step with deposits (rare, and checkable), or the extra yield is paying for a risk the crowd can see and you can't.

## A worked example

A stablecoin pool genuinely earns **$385 a day** in real swap fees. Nothing fake — actual traders paying actual fees.

| Stage | TVL | Daily income | Implied APY |
|---|---|---|---|
| You spot it | $1.0M | $385 | ~14% |
| Capital responds | $2.0M | $385 | ~7% |
| Crowd fully arrives | $3.0M | $385 | ~4.7% |

The income column never moves. The pool didn't break, get exploited, or cut emissions. It just got crowded — and the rate you'll actually earn is the one in the bottom row, not the one in the screenshot that made you click.

Now stack the friction on top. To chase the 14% you paid entry gas, maybe a bridge, and — if you're in Australia — you triggered a [taxable CGT event](https://passiveblocks.io/learn/defi-tax-australia) on the swap to get in. You did all of that to capture a rate that was already reverting before your transaction confirmed.

## The one-line filter

Before you chase a rate that's well above the lending baseline, ask: **is this number high because the pool is good, or because it's empty?**

- **Rate has been stable for months at meaningful TVL** → the income is keeping pace with deposits. The yield is durable. Trust it.
- **Rate is spiking and TVL is small or just jumped** → you're early to a number the crowd is about to erase. The yield you'll *keep* is the post-crowd rate, not the headline.

The uncomfortable corollary: the best-looking rate on the leaderboard is structurally the *worst* time to enter, because the leaderboard is sorted by exactly the quantity that's about to revert. The rates worth holding are the boring ones that have already been discovered and have settled.

## How the bot treats it

PassiveBlocks doesn't score a pool on its instantaneous APY. It looks at whether the rate has held at size — a yield that's been stable for months at real TVL is a different object from one that spiked yesterday. A fresh spike gets discounted toward what the pool will realistically pay *after* the capital it's advertising for shows up. That's one more reason the bot has sat at 0 rebalances for weeks: most of the eye-catching rates that scrolled past were invitations to be someone's exit liquidity at a number that wouldn't survive the inflow.

A durable, already-discovered 5% beats a 14% that's reverting to 5% the moment you account for who else read it. Read this next to [the four numbers that explain any DeFi yield](https://passiveblocks.io/learn/four-numbers-defi-yield) and a leaderboard stops being a ranking of rewards and starts being a list of rates the market is in the middle of correcting.

## A note on self-custody

Chasing freshly-spiking pools means more new contracts, more approvals, more signatures from your wallet — the exact surface attackers target. The more a strategy makes you hop between unproven pools, the more it matters that your signing keys live off your laptop, on a device malware can't reach. → **[Get a Trezor here](https://affiliate.trezor.io/publisher/#!/offer/133?tracker=pb_learn_yield_mean_reversion)** *(affiliate — we earn a commission if you sign up, at no cost to you)*

---

## Don't buy the top of a decay curve

The leaderboard sorts by the number most likely to fall. PassiveBlocks scores pools on durable, kept yield — and only flags the ones that clear our buffer over what we already hold. Free, weekly:

→ **[Subscribe to PassiveBlocks](https://passiveblocks.io)**

**Earn more — PassiveBlocks**

*Last updated: 2026-06-29*
