# Mercenary liquidity — why a "deep" pool can be empty when you need to leave

A pool shows **$50M TVL** and a **20% APY**. The depth makes you feel safe — that much money can't all be wrong, and surely you can get your $20K back out of a fifty-million-dollar pool. So you deposit.

Now ask the question almost nobody asks: *why is that money there?* If the answer is "because the protocol is paying 20% in its own token," then the money isn't invested — it's renting. And renters leave the day the rent drops.

That's **mercenary liquidity**: capital that showed up for an incentive, has zero loyalty to the protocol, and is one better offer away from gone. The TVL is real today and a mirage tomorrow. The danger isn't that the rate falls — it's that the depth you were relying on to *exit* evaporates at exactly the moment everyone tries to leave at once.

## Emissions are a customer-acquisition budget

When a protocol prints its own token and hands it to depositors, that's not yield in any honest sense — it's marketing spend. (If that framing is new, read [where DeFi yield actually comes from](https://passiveblocks.io/learn/source-of-yield) first.) The protocol is buying TVL the way a startup buys users: pay people to show up, post a big headline number, hope some of them stay once the discount ends.

They don't stay. Mercenary capital is loyal to the rate, not the logo. The exact same wallets rotate from farm to farm chasing whichever token is printing hardest this week. So the "$50M of liquidity" is really $50M of capital sitting with one finger on the exit, watching for the next 25% pool to appear.

> Deep TVL built on emissions isn't depth. It's a crowd standing in a doorway, all facing the exit.

## The exit problem

Here's why this is worse than a rate that simply mean-reverts. When [yield mean-reverts](https://passiveblocks.io/learn/yield-mean-reversion), more capital arrives and your rate quietly drops — annoying, not dangerous. Mercenary liquidity fails in the other direction, and it fails *fast*.

The day emissions get cut — a governance vote, a budget running dry, a better farm opening elsewhere — the rented capital doesn't trickle out. It stampedes. And in an LP or a lending market, everyone heading for the door at once does two things at the same time:

1. **The rate collapses** (the incentive that held it up is gone).
2. **The exit gets expensive or jams** — LP withdrawals cross thinning liquidity at brutal slippage; lending markets spike to ~100% utilisation and grey out the withdraw button until a borrower repays. (That second mechanic is the [utilisation](https://passiveblocks.io/learn/utilisation-rate) trap.)

The depth you trusted was made of the same people now trying to leave. It was never there for *you* — it was there for the rate, and you don't get to keep it once the rate is gone.

## A worked example

Two USDC pools, both showing **$50M TVL**:

| | Pool A (organic) | Pool B (mercenary) |
|---|---|---|
| Headline APY | 5.2% | 20% |
| Where the yield comes from | Borrower interest | 4% borrower interest **+ 16% token emissions** |
| Why the money is there | Earning real income | Farming the token |
| TVL the day emissions are cut | ~$50M (unchanged) | ~$8M (and falling) |
| Your $20K exit | Fills instantly | Crosses a draining pool at slippage, or queues |

Same $50M on the screen. One is a foundation; the other is a tent that folds the moment the wind changes. The 16% you were "earning" in Pool B was the protocol paying you to provide exit liquidity for the next person — right up until you needed to be the one exiting.

## The one-line filter

Before you trust a pool's depth, separate the two questions the leaderboard collapses into one:

**Is this liquidity here for the income, or for the incentive?**

- **Yield is mostly real (interest, fees) and the rate is unremarkable** → the capital is invested. The depth is durable. You can lean on it to exit.
- **Yield is mostly the protocol's own token and the headline is eye-watering** → the capital is renting. The depth is conditional. Price your exit for the day the rent stops, not for today's screenshot.

A fast proxy: on a yield aggregator, look at the split between base APY and reward APY. If most of the number is reward tokens, most of the TVL is mercenary — and most of the depth is borrowed.

## How the bot treats it

PassiveBlocks scores the *source* of a pool's TVL, not just its size. A high APY built on emissions gets marked down to roughly what it would pay on organic income alone, because that's the rate — and the depth — that survives once the incentive ends. A "$50M, 20%" emissions pool and a "$50M, 5%" interest pool are not the same risk, even though a leaderboard sorts them as if size were size.

It's one more reason the bot has sat at 0 rebalances for weeks. Most of the deepest-looking, highest-paying pools that scrolled past were renting their TVL — and a pool you can't reliably *exit* at size is one you should never have *entered* at size. A boring, organically-funded 5% you can always leave beats a 20% whose depth disappears the same week its yield does.

## A note on self-custody

Chasing emissions means hopping between fresh farms — new contracts, new approvals, new signatures, week after week. That churn is exactly the surface attackers fish in. The one exposure you can delete outright is your signing key: keep it on a device that never touches the internet, and a bad approval on some short-lived farm still can't drain you. → **[Get a Ledger here](https://shop.ledger.com/?r=a6255ec0ba49&tracker=pb_learn_mercenary_liquidity)** *(affiliate — we earn a commission if you sign up, at no cost to you)*

---

## Don't rent depth you'll need to own on the way out

TVL is only as real as the reason it's there. PassiveBlocks scores pools on the durability of their liquidity — and only flags the ones we'd actually be able to exit at size. Free, weekly:

→ **[Subscribe to PassiveBlocks](https://passiveblocks.io)**

**Earn more — PassiveBlocks**

*Last updated: 2026-06-30*
