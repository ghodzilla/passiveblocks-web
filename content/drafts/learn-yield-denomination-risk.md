# What is your yield paid in? — the denomination bet nobody prices

A pool quotes **20% APY**. You deposit USDC. A year later you check your wallet and you're *down*.

Nothing was hacked. The pool paid exactly what it promised — 20%. The catch was in three words nobody read: *paid in $CAKE* (or $SUSHI, or whatever the protocol's own token is called). You earned 20% of a token that fell 40% while you held it. The yield was real. The currency it arrived in was not stable.

This is denomination risk, and it's a separate question from [where the yield comes from](https://passiveblocks.io/learn/source-of-yield). That article asks *who's paying you* — a borrower, a trader, or a token printer. This one asks the next question: **what are they paying you IN?**

## A rate is only a rate if you know its currency

"20% APY" is an incomplete sentence. 20% *of what*, denominated in *what*?

- **Stable-denominated yield** — you're paid in USDC/USDT/DAI. A 6% rate means you end the year with 6% more dollars. One bet: does the protocol survive and keep paying.
- **Token-denominated yield** — you're paid in the protocol's own governance/reward token. A 20% rate means you end the year with 20% more *of that token* — and the token has its own price, which moves independently of your deposit.

When the yield is paid in a volatile token, you're not making one bet. You're making two, stacked: *the yield shows up* **and** *the token holds its value long enough for you to sell it.* You signed up for an interest rate and got handed a long position on someone's altcoin.

## Two bets, one number

Here's why the stacking matters. Split a token-denominated return into its parts:

**Your real return = the yield rate  +/−  what the reward token does.**

A 20% yield paid in a token that drops 40% isn't "20% minus a bit." It's a **real loss** — the token half swamped the yield half. And the two are usually *correlated the wrong way*: the pools paying the loudest token-denominated rates are the ones emitting the most of their own token, which is exactly the sell pressure that pushes the token down. The reward you're paid in is being diluted by the same emissions that generate your reward. You're often being paid more units of a thing that's falling *because* they're paying you in it.

## A worked example

You've got **$10,000**. Two USDC pools.

| | Pool A — stable-paid | Pool B — token-paid |
|---|---|---|
| Headline APY | 6% | 20% |
| Paid in | USDC | $REWARD (the protocol's token) |
| Yield after 1 year | +$600 | +$2,000 *(in token, at today's price)* |
| If the token is flat | **+$600** | **+$2,000** |
| If the token drops 30% | +$600 | +$2,000 → worth ~$1,400, but your *principal exposure* to the token via unsold rewards also bleeds |
| If the token drops 60% | +$600 | rewards worth ~$800 — you underperformed the "boring" pool while taking far more risk |

The honest version: to actually *keep* Pool B's 20%, you have to claim and sell the reward token continuously, all year, before it can drift down. That's manual work, a gas cost every claim, and a [realised taxable event](https://passiveblocks.io/learn/defi-tax-australia) every sale. Skip it and you're just long the token. Do it and friction eats the edge. Either way, the "20%" on the billboard was gross, denominated in something you had to race to convert.

## The one-line filter

Before you chase any rate, ask:

**What is this yield paid IN — and would I hold that asset on its own?**

- **Paid in the asset you deposited** (USDC in, USDC out) → one bet, and the rate on the leaderboard is close to honest.
- **Paid in a separate, volatile token** → two bets. Discount the headline rate by what you think the token does over your holding period, and only stay if you'd *choose* to hold that token anyway. If you wouldn't buy the token outright, you shouldn't accept it as a wage.

A fast proxy on any yield aggregator: look for the **base APY vs reward APY** split. The base portion is usually paid in the deposited asset (real, stable-denominated). The reward portion is usually paid in the protocol's token (a currency bet wearing a yield label). The bigger the reward slice, the more of your "rate" is actually a long position you didn't ask for.

## How the bot treats it

PassiveBlocks scores yield by what it's denominated in. Stable-denominated lending income — where the interest arrives in the same USDC you deposited — is treated as the real number. Token-denominated emissions get marked down to what survives after the token's likely drift, because a rate you have to sell out of before it decays isn't the rate you were quoted. It's the same discipline behind [why a high APY is often an invitation, not a rate](https://passiveblocks.io/learn/yield-mean-reversion): the loudest numbers tend to be paid in the softest currency.

## A note on self-custody

Collecting token-denominated rewards means a constant cycle of claim → approve → swap → sell, across a rotating set of contracts — the exact churn of approvals attackers fish in. The one risk you can delete outright is your signing key. Keep it on a device that never touches the internet, and a bad approval on some emissions farm still can't move your funds. → **[Get a Trezor here](https://affiliate.trezor.io/publisher/#!/offer/133?tracker=pb_learn_yield_denomination)** *(affiliate — we earn a commission if you sign up, at no cost to you)*

---

## Read the currency, not just the rate

The APY is the number on the billboard. The currency it's paid in decides whether that number is money or a bet. PassiveBlocks scores both — and only flags yield you'd actually keep. Free, weekly:

→ **[Subscribe to PassiveBlocks](https://passiveblocks.io)**

**Earn more — PassiveBlocks**

*Last updated: 2026-07-03*
