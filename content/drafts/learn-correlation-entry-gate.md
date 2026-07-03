# Correlation is an entry gate, not a footnote — the number that decides if an LP is a fee-earner or a bet

You put two "stable" tokens into a liquidity pool. Same dollar, right? USDC and USDT, both pegged to $1, both boring. You're there to earn swap fees, not to take a view.

Then one of them slips. Not to zero — just to 97 cents for a week. Nothing dramatic on the chart. But the pool quietly rebalanced you *out of the one holding its dollar and into the one that isn't*, and when you go to withdraw you're holding more of the loser than you put in. You didn't choose a directional trade. The pool chose one for you, the moment the two halves stopped tracking.

That slip has a number. It's called correlation, and it's the single most important thing to check **before** you enter a two-sided pool — not something to monitor after you're in.

## Why an LP pair is a bet on correlation

An automated market maker doesn't know or care that both your tokens are "supposed" to be worth a dollar. It only enforces a math relationship between the two balances. When the market price of the two assets moves apart, arbitrageurs trade against your pool until it's rebalanced — and rebalancing always means the pool sells you more of whatever's falling.

As long as the two assets move together — high correlation — that rebalancing is tiny and the fees you earn swamp it. The moment they *stop* moving together, the rebalancing becomes the dominant force. That divergence loss has a name you already know: it's [impermanent loss](https://passiveblocks.io/learn/impermanent-loss). A correlation breakdown **is** impermanent loss. They're the same event described two ways — one is the cause, one is the receipt.

So "is this a safe stable LP?" is really one question: **how tightly do these two assets actually track, and what happens to my position if they stop?**

## The gate is a threshold, and it's different per pair type

Correlation runs from 1.00 (lockstep) down to 0 (unrelated). The useful move is to set a hard entry threshold per pair *type* and refuse to enter below it:

- **Stablecoin pairs** (USDC/USDT) → require **≥ 0.995**. Two things claiming to be a dollar should track almost perfectly. If they don't, one of them is telling you something.
- **Liquid-staking pairs** (an LST vs its base asset — think staked-ETH vs ETH) → require **≥ 0.98**. They're linked by a redemption mechanism, but the redemption isn't instant, so they wobble.
- **BTC variants** (one wrapped/bridged BTC vs another) → require **≥ 0.97**. Same underlying, different custodians and bridges — usually tight, occasionally not.

These aren't magic constants; they're the point where the expected fee income stops covering the expected divergence loss for that class of pair. Below the line, you're being paid to hold a directional trade you didn't ask for.

## A worked example

You've got **$10,000** split evenly into a stable-stable pool. Two scenarios, same starting position, same fees.

| | Pair A — tracks tight | Pair B — one leg slips |
|---|---|---|
| Correlation over the period | 0.999 | 0.97 |
| What the pool does | barely rebalances | sells you into the weak leg |
| Impermanent loss | ~0% | ~1–2% of position = **$100–$200** |
| A year of fees at, say, 6% | +$600 | +$600 |
| Net | +$600, clean | +$400 to +$500 — *if the slip is temporary* |

And that last "if" is the trap. Impermanent loss only stays impermanent if the pair re-converges. If the weak leg keeps drifting — the way [a depegging stablecoin](https://passiveblocks.io/learn/stablecoin-collateral-types) does — the loss locks in the day you exit, and no amount of fee income catches up. The 6% was never the risk. The correlation was.

## The one-line filter

Before you enter any two-sided pool, ask:

**Do these two assets actually track — and what's my threshold to walk?**

- **Both assets move in lockstep, above your threshold for the pair type** → you're a genuine fee-earner. The pool's rebalancing is noise.
- **They've drifted below the threshold, or you can't tell** → you're taking a directional bet dressed as a yield position. Either single-side it (lend one asset instead) or stay out.

A fast proxy: pull up a price chart of the two assets *against each other*, not against the dollar. A flat line means they track. Any visible slope is the exact divergence the pool will make you eat.

## How the bot treats it

PassiveBlocks treats correlation as an **entry gate**, not an alert. A pair has to clear its threshold — 0.995 for stables, 0.98 for LST pairs, 0.97 for BTC variants — *before* the pool is even eligible, and a stable pair gets exited outright if its peg wanders more than 0.5% from a dollar. It's the same discipline as [checking who can exit before you check the rate](https://passiveblocks.io/learn/utilisation-rate): the yield is the reward, but correlation decides whether the two halves of your position are still on the same side. When a pair falls below its line, the pool stops being a fee machine and starts being a slow-motion swap into the weaker asset. The gate is there so that swap never happens on our capital. It's one of [the numbers that decide whether a yield is real](https://passiveblocks.io/learn/four-numbers-defi-yield) — the rate is the last thing to check, not the first.

## A note on self-custody

Entering and exiting LP positions means a rotating set of approvals across pool contracts, routers, and gauges — the exact surface attackers phish. The one risk you can delete outright is your signing key. Keep it on a device that never touches the internet, and a bad approval on some pool still can't move your funds. → **[Get a Ledger here](https://shop.ledger.com/?r=a6255ec0ba49&tracker=pb_learn_correlation_entry_gate)** *(affiliate — we earn a commission if you sign up, at no cost to you)*

---

## Check the correlation before the rate

A two-sided pool pays you in swap fees and charges you in divergence. Correlation is the number that tells you which one wins. PassiveBlocks gates every pair on it — and only flags positions where the two halves still track. Free, weekly:

→ **[Subscribe to PassiveBlocks](https://passiveblocks.io)**

**Earn more — PassiveBlocks**

*Last updated: 2026-07-04*
