# One APY, three contracts — composability risk in DeFi

You find an auto-compounding vault paying 11% on USDC. The pitch is perfect: deposit once, it harvests rewards, swaps them, and re-deposits for you. Set and forget. The dashboard shows one number, one button, one balance.

What it doesn't show is that your USDC is moving through three different protocols to earn that 11%. It gets lent on a money market, the receipt token gets deposited into a second protocol, and a third contract handles the harvest-and-restake loop. One APY on the screen. Three independent smart contracts holding your money in sequence.

This is composability risk, and it's the one that hides inside the products that market themselves as the easiest. "Money legos" is the industry's favourite phrase. The thing nobody says out loud is that every lego you stack is another way to lose the whole tower.

## Risk doesn't add — it multiplies

The reason DeFi can build a one-click 11% vault is that protocols snap together. The output token of one becomes the input of the next. That's genuinely powerful. It's also why a single number on a dashboard can sit on top of a chain of dependencies you never see.

Here's the part that matters: when your capital passes through three contracts, you are exposed to **all three** at once. Not the safest one. Not the average. All of them, simultaneously, for as long as you're in the position.

If each protocol in the stack has a 99% chance of being fine over your holding period, the stack as a whole is 0.99 × 0.99 × 0.99 ≈ **97%**. You've roughly tripled your odds of a bad outcome to earn a few extra points of yield. And that's the optimistic version, because it assumes the failures are independent — often they're not. A bug in the base lending protocol cascades up through every vault built on top of it, all at once.

A single audited lending position has one contract to trust. A stacked vault has three, plus the contract that does the stacking. You added 4 percentage points of APY and three failure modes.

## The number you see hides the structure you bought

The dashboard's job is to make the product feel simple. One balance, one rate, one button. That simplicity is exactly what obscures the risk. You can't price what you can't see.

A few things the single APY quietly folds away:

- **How many protocols your money actually touches.** "Auto-compounder" and "yield aggregator" and "vault" almost always mean *routed through other protocols*. The yield is real; it's just being earned somewhere other than where you clicked.
- **Whether the underlying source is durable.** A lot of these vaults are compounding *emissions*, not interest. The 11% is partly a token being printed somewhere two layers down — and [if you can't name who's paying you](https://passiveblocks.io/learn/source-of-yield), you are.
- **Whether the wrapper itself has been audited as hard as the protocols underneath.** The base lending market might be battle-tested. The shiny new aggregator that wraps it usually isn't — and it's the one holding the keys to move your money between layers.

## A worked comparison

Two ways to earn yield on $10,000 of USDC:

- **Position A** — lend it directly on one established money market at 5.2%. One contract. One thing to trust. You get $520 a year and exactly one smart-contract exposure.
- **Position B** — deposit into an 11% auto-compounding vault that routes through a lending protocol, a reward market, and a compounding layer. You get ~$1,100 a year and three smart-contract exposures stacked on top of each other.

Position B pays $580 more. The question composability forces you to ask isn't "is $580 nice?" — it's "is $580 a year enough to be paid for tripling the number of contracts that can take the whole $10,000 to zero?" Sometimes, with battle-tested layers and a real yield source, the answer is yes. Often the extra yield is emissions that will decay anyway, and you took triple the risk to rent a number that wasn't going to last. The point is to *make the trade consciously*, not to let a one-button dashboard make it for you.

## The one-line filter

Before you deposit into anything that compounds or aggregates for you, ask: **how many protocols does my money touch to earn this number?**

If the answer is "one," you have a single thing to understand and watch. If the answer is "I'm not sure" — that uncertainty *is* the risk. A yield you can't decompose is a yield you can't price. Open the vault's docs, trace where the capital actually goes, and count the contracts. Then decide whether the extra points are worth the extra legos.

## How the bot treats it

PassiveBlocks prefers the bottom of the stack, not the top. It would rather lend USDC directly on one battle-tested protocol at a boring rate than route the same dollars through a three-protocol aggregator for a higher one — because [a simpler structure eliminates a failure mode rather than just reducing it](https://passiveblocks.io/learn/defi-audit-guide). Every additional protocol in the path is another audit to trust, another upgrade key to worry about, another oracle and another bridge that can fail independently. The bot's whitelist is short and flat on purpose: it scores attack surface as a cost, and a stacked vault is mostly extra surface for marginal yield. The durable few points you keep beat the headline points sitting on three contracts you can't watch.

## Keep the keys off the stack

Composability multiplies your contract exposure. The one exposure you can remove entirely is your signing key — keep it on a device that never touches the internet, and a compromise anywhere in the stack still can't move your funds without the hardware in your hand. → **[Get a Ledger here](https://shop.ledger.com/?r=a6255ec0ba49&tracker=pb_learn_composability_risk)** *(affiliate — we earn a commission if you sign up, at no cost to you)*

---

## Count the contracts before you chase the rate

The easiest products in DeFi are often the most layered ones, and the single APY is designed to hide exactly that. PassiveBlocks traces where the yield actually comes from and how many protocols it passes through — then favours the boring, flat positions that are easier to watch and harder to lose. We publish what clears the bar each week:

→ **[Subscribe to PassiveBlocks](https://passiveblocks.io)**

Pairs with [where DeFi yield actually comes from](https://passiveblocks.io/learn/source-of-yield) and [the four numbers that explain any DeFi yield](https://passiveblocks.io/learn/four-numbers-defi-yield).

**Earn more — PassiveBlocks**

*Last updated: 2026-06-28*
