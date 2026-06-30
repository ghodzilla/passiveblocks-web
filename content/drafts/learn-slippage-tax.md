# Slippage — the invisible tax the leaderboard never quotes

You find a pool paying **9% APY**. Gas to get in is about **$40**. On your $20K that's 0.2% — annoying, survivable. So you deposit.

A month later you go to leave, and your $20K comes back as **$19,200**. Nothing was hacked. The rate didn't crash. You just paid a tax nobody put on the screen: **slippage** — the price you move against yourself every time you push size through a pool that isn't deep enough to absorb it. You paid it on the way in, and you paid it again on the way out.

Gas is the cost everyone talks about because it's the one they can see. Slippage is the bigger one hiding behind it.

## Gas is flat. Slippage scales.

This is the whole point, and it's the part that trips people up:

- **Gas is a fixed cost.** A swap or a deposit costs roughly the same $20–$40 whether you're moving $1,000 or $1,000,000. It's a flat fee for blockspace.
- **Slippage is a percentage cost that scales with your size relative to the pool.** Push $1K through a deep pool and you'll barely register it. Push $50K through a thin one and you eat 1–3% on entry *and* the same again on exit.

So the two costs pull in opposite directions, and which one hurts depends entirely on your position size versus the pool's depth. Gas punishes the small account. Slippage punishes anyone who's big relative to the pool they picked — which, on a high-APY pool, is usually a *thin* pool.

## Why high APY and high slippage travel together

The pools quoting the loudest numbers are almost always the shallow ones. (That's not a coincidence — it's [mean reversion](https://passiveblocks.io/learn/yield-mean-reversion): a small pool with real income shows a big rate until capital floods in and dilutes it.) Small pool, big rate, and you arrive wanting to deposit real size. That's the exact setup where slippage bites hardest.

And it bites at the worst possible moment. The day you want out of a thin pool is often the day everyone else does too — emissions cut, rate dropping, [mercenary liquidity](https://passiveblocks.io/learn/mercenary-liquidity) stampeding. The pool is draining *while* you're trying to cross it, so the slippage you modelled on a calm day is the optimistic number.

## A worked example

You've got **$50K** to deploy. Two USDC pools, both quoting a tempting rate.

| | Deep pool ($200M TVL) | Thin pool ($4M TVL) |
|---|---|---|
| Headline APY | 6% | 14% |
| Gas in + out | ~$80 | ~$80 |
| Slippage in | ~0.05% ($25) | ~2% ($1,000) |
| Slippage out | ~0.05% ($25) | ~2% ($1,000) |
| **Total round-trip cost** | **~$130** | **~$2,080** |
| First-year yield (gross) | $3,000 | $7,000 |
| **Net after costs** | **~$2,870** | **~$4,920** |

The thin pool still wins here *if* the 14% holds for a full year — but it almost never does (that's the whole [annualisation](https://passiveblocks.io/learn/annualised-apy-trap) trap). Hold that 14% for two months instead of twelve and your gross drops to ~$1,170, while the $2,080 in slippage doesn't move. Now the "better" pool has paid you **negative**. You rented a rate for a month and paid $2,080 in spread to do it.

The leaderboard showed you 14% vs 6%. It never showed you the $2,000 spread you'd cross to collect it.

## The one-line filter

Before you size into any pool, ask:

**How big is my deposit compared to the pool — and what does it cost me to cross the spread twice?**

- **Your position is a rounding error against the pool's depth** → slippage is negligible; gas is your main cost, so the rule is *don't over-trade* a small position.
- **Your position is a meaningful slice of the pool** → you are the one moving the price. Model slippage *both ways*, on a bad day, and subtract it from the headline before you compare anything.

A fast proxy: try a test swap of your full size on the DEX aggregator and read the quoted price impact. If it's more than a fraction of a percent, the pool is too thin for your size — the rate is real but you can't collect it at scale.

## How the bot treats it

PassiveBlocks sizes positions against pool depth, not just against the APY. A rate it can only capture by becoming 5% of a pool's liquidity gets discounted by the round-trip spread it would cross to enter and exit — because that spread is a real, paid cost, not a hypothetical. It's the same logic behind [why the bot mostly doesn't rebalance](https://passiveblocks.io/learn/when-not-to-rebalance): every move pays gas *and* slippage *and* a tax event, so the gain has to clear all three before it's worth doing. Most "better rates" don't, once you price the spread you'd have to cross to reach them.

## A note on self-custody

Hunting thin, high-APY pools means a constant churn of new contracts and fresh token approvals — the exact surface attackers fish in. The one risk you can delete outright is your signing key: keep it on a device that never touches the internet, and a bad approval on some short-lived farm still can't move your funds. → **[Get a Trezor here](https://affiliate.trezor.io/publisher/#!/offer/133?tracker=pb_learn_slippage_tax)** *(affiliate — we earn a commission if you sign up, at no cost to you)*

---

## Price the spread, not just the rate

The APY is the number on the billboard. Slippage is the toll you pay to get on and off the road. PassiveBlocks scores both — and only flags pools you can actually enter and exit at size. Free, weekly:

→ **[Subscribe to PassiveBlocks](https://passiveblocks.io)**

**Earn more — PassiveBlocks**

*Last updated: 2026-07-01*
