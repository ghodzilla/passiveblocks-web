# Why a 40% APY can be a 3-week number — the annualisation trap

You open a yield leaderboard and a pool is flashing **40% APY**. It's been live for 19 days. Here's what that number actually means: take whatever the pool paid over its short life, assume it keeps paying at exactly that pace for 365 days, and project it out. The "40%" isn't a year of returns. It's a few weeks of returns wearing a yearly costume.

This is the annualisation trap, and it's the single most common way a yield number lies without anyone technically lying. The rate is real. The *duration* it's quoted over is the part nobody puts on the leaderboard.

## What "APY" silently assumes

APY is a projection, not a measurement. It takes a rate observed over some window and scales it to a full year. That's fine when the window is long and the rate is durable — a Fluid or Aave lending rate has been grinding along for months, so annualising it tells you something close to the truth.

It's misleading when the window is tiny. A brand-new emissions farm that paid out heavily for three weeks gets the same treatment: three weeks of unusually generous token rewards, multiplied up as if they'll run all year. They almost never do.

> The math isn't wrong. The assumption underneath it — "this rate persists for 365 days" — is the thing doing all the lying.

## Why the new-pool number is almost always inflated

Two forces make a young pool's headline rate the high-water mark, not the average:

**1. Emissions front-load.** New pools bootstrap liquidity by dumping a fixed budget of reward tokens early. Day 5 might pay 40%. Day 90, with the same budget spread across 10× more deposits, pays 6%. The APY you saw was the launch promotion, annualised.

**2. The reward token's price falls.** That 40% is denominated in a token whose price is usually highest at launch and drifts down as farmers claim and sell. The dollar value of the yield decays even if the token-denominated APY holds.

Put together: the longer a pool runs, the more its real rate regresses toward something boring. The 40% wasn't a forecast. It was a snapshot of the most generous moment, stretched across a calendar.

## A worked example

Say a pool launches and pays **0.77% over its first 7 days** in reward tokens. Annualise that — 0.77% × 52 weeks — and you get a headline of **~40% APY**. Screenshot-ready.

Now watch what happens as it matures:

| Pool age | Real weekly rate | Annualised "APY" shown |
|---|---|---|
| Week 1 | 0.77% | ~40% |
| Week 4 | 0.30% | ~16% |
| Week 12 | 0.12% | ~6% |
| Week 26 | 0.09% | ~4.7% |

Nobody changed the math. The pool just aged into its real number — and a depositor who chased the week-1 headline, paid gas to enter, and triggered a taxable swap to get there, did all of that to capture a rate that was already evaporating by the time the transaction confirmed.

## The one-line filter

Before you trust any eye-watering APY, ask one question: **how old is this number?**

- **Pool age in months, rate stable** → the annualisation is honest. Treat the number as real.
- **Pool age in days or weeks, rate way above the lending baseline** → mentally divide it down hard. You're looking at a launch promotion projected across a year that hasn't happened.

A durable 5% beats a decaying 40% the moment you account for how long each one actually lasts. This is the same lesson as [utilisation rate](https://passiveblocks.io/learn/utilisation-rate) and [APY vs APR](https://passiveblocks.io/learn/apy-vs-apr): the headline assumes a frictionless, unchanging world you don't live in. Read it alongside [the four numbers that explain any DeFi yield](https://passiveblocks.io/learn/four-numbers-defi-yield) and a leaderboard stops being a ranking and starts being a list of claims to check.

## How the bot treats it

PassiveBlocks discounts the quoted APY of any pool young enough that its rate can't be trusted to persist. A three-week-old farm doesn't get scored on its annualised headline — it gets scored on what a mature version of it would realistically pay, which is usually a fraction. That's one reason the bot has sat at 0 rebalances for weeks: every "obvious upgrade" that scrolled past was a young number that hadn't met its real self yet.

## A note on self-custody

Chasing fresh farms means more new contracts, more approvals, more signatures from your wallet — exactly the surface attackers target. The more a strategy makes you interact with unproven pools, the more it matters that your signing keys live off your laptop. A hardware wallet keeps them on a device the malware can't reach. → **[Get a Trezor here](https://affiliate.trezor.io/publisher/#!/offer/133)** *(affiliate — we earn a commission if you sign up, at no cost to you)*

---

## Read the rate's real age, not its costume

Annualisation is one more place the leaderboard flatters a number. PassiveBlocks scores pools on durable, kept yield — and only flags the ones that clear our buffer over what we already hold. Free, weekly:

→ **[Subscribe to PassiveBlocks](https://passiveblocks.io)**

**Earn more — PassiveBlocks**

*Last updated: 2026-06-21*
