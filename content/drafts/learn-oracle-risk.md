# How do DeFi hacks actually happen? Oracle risk, explained (nobody audits the number the contract trusts)

A protocol gets "hacked" for $30M. The headlines say *exploit*, *vulnerability*, *bug*. You picture a typo in the code, a back door, a missing check. Most of the time, that's not what happened. The code did exactly what it was written to do. It just believed a price that wasn't true for a few seconds — and a few seconds is all it takes.

This is **oracle risk**, and it's the single most common way money actually leaves DeFi. A flawless, audited, formally-verified contract can still hand an attacker your deposit, because the audit checks the *code* and nobody audits the *number the code trusts.*

## What an oracle is, in one sentence

A smart contract can't see the outside world. It doesn't know that ETH is $2,360 or that USDC is worth a dollar. Someone has to tell it. That "someone" is an **oracle** — a feed that pushes a price on-chain so the contract can do its job: decide how much you can borrow, when to liquidate you, how many tokens a swap should return.

Every lending market, every leverage product, every stablecoin needs one. And the contract treats the oracle's number as gospel. If the oracle says ETH is worth $5, the contract will let you borrow against ETH as if it were worth $5 — even if every exchange on earth says otherwise.

## How the attack works

Here's the whole playbook, and it almost never involves breaking the code:

1. The attacker finds a protocol that reads its price from a **single, thin source** — usually the spot price of an on-chain pool, rather than a robust feed.
2. They take a **flash loan** — millions of dollars, borrowed and repaid inside one transaction, no collateral needed.
3. They use that capital to **shove the pool's price** wildly off-market for a single block. Buy hard enough and the pool "thinks" the asset is worth triple.
4. The protocol's oracle reads that fake price. Now the contract believes the attacker's collateral is worth far more than it is.
5. The attacker borrows against the inflated number, drains the real assets, repays the flash loan, and walks. All in one transaction, often under 12 seconds.

No password was stolen. No bug was triggered. The contract followed its rules perfectly — it just trusted a number that an attacker rented for one block.

## Why the audit doesn't save you

An audit reviews the logic of the contract: does the math add up, are the access controls right, can a function be called out of order. (We covered what audits do and don't cover in [how to actually read a DeFi audit](https://passiveblocks.io/learn/defi-audit-guide).) What an audit almost never covers is the **quality of the price feed** the contract depends on. The code can be perfect and the oracle can still be a single low-liquidity pool that a flash loan can bend like a paperclip.

That's the gap. The audit certifies the engine. The oracle is the fuel gauge — and a perfect engine running on a lying gauge still drives off the cliff.

## The 4 questions that tell you if an oracle is solid

You don't need to read Solidity to screen for this. Before you trust a protocol with size, ask:

- **Where does the price come from?** A reputable, decentralised feed (Chainlink-style, aggregated across many venues) is hard to move. A single on-chain pool's spot price is cheap to manipulate. If the docs won't tell you, that's your answer.
- **Is it time-weighted?** A TWAP (time-weighted average price) averages the price over many blocks, so a one-block flash-loan spike barely registers. Instantaneous spot prices are the soft target.
- **How deep is the source?** Manipulating a $500M feed costs more than the attacker can profit. Manipulating a $2M pool costs lunch money. Thin liquidity is the prerequisite for the whole attack.
- **What happens if the feed goes stale or wrong?** Good protocols have circuit breakers — they pause if the price moves impossibly fast or the feed stops updating. No fallback means the contract will act on a garbage number without hesitating.

If you can't answer the first one, you've learned enough to walk.

## How the bot treats it

PassiveBlocks scores oracle dependency as a first-class risk, not a footnote. A pool offering a higher rate on a manipulable price feed loses to a boring lending market on a battle-tested oracle, every time — because the rate is the reward and the oracle is the thing that decides whether you keep your principal at all. The bot's whitelist is short on purpose: protocols whose price feeds are deep, aggregated, and time-weighted, where bending the number costs more than draining the pool would ever return. "Audited" is the floor. "What does it trust for its prices?" is the question that actually keeps the money.

## Keep the keys off the internet

Oracle risk is about the protocol's trust assumptions. The other half of staying safe is your own: the key that signs your transactions should live on a device that never touches the web, so a drained protocol is the worst case — not a drained wallet. → **[Get a Ledger here](https://shop.ledger.com/?r=a6255ec0ba49&tracker=pb_learn_oracle_risk)** *(affiliate — we earn a commission if you sign up, at no cost to you)*

---

## The number under the number

Every DeFi position rests on a price the contract didn't verify and you probably never checked. Most "hacks" are just that number being rented for one block. PassiveBlocks reads the oracle before it reads the rate — and only flags the pools where the number is as hard to move as the code is hard to break:

→ **[Subscribe to PassiveBlocks](https://passiveblocks.io)**

Pairs with [how to actually read a DeFi audit](https://passiveblocks.io/learn/defi-audit-guide) and [where DeFi yield actually comes from](https://passiveblocks.io/learn/source-of-yield).

**Earn more — PassiveBlocks**

*Last updated: 2026-06-24*
