# "Audited" is a date stamp, not a seatbelt — how to actually read a DeFi audit

A protocol's landing page says **"Audited by [big name]."** You read that as *safe*. It isn't what the word means. An audit is a photo of the code on one specific day, taken by people who were paid to look for a fixed number of hours. It tells you what a reviewer didn't find in that window. It says nothing about the code that shipped afterward, the price feed the protocol trusts, or the bridge it talks to.

Some of the largest DeFi losses of 2022–23 hit *audited* protocols. The audits weren't fraud. They just covered less than the depositors assumed. Here's how to read one like an operator instead of a logo-spotter.

## What an audit actually is

An audit is a time-boxed manual review of a specific commit. A firm reads the contracts, runs tools, files issues, the team fixes some of them, and the firm publishes a report. That's the whole transaction.

Three things follow from that definition, and all three are where depositors get hurt:

- It's **scoped.** The report covers named contracts at a named commit hash. Anything outside that scope — a new module, a governance contract, an upgrade shipped next month — was never looked at.
- It's **dated.** It describes the code on the day of review. Protocols upgrade. The version holding your money may be three deploys past the one that was audited.
- It's **bounded by effort.** Auditors get a fixed budget of hours. A two-week review of a complex protocol is a sampling exercise, not a proof of safety.

> An audit reduces the odds of a *known class* of bug in *reviewed* code on *one day*. It is a real signal. It is not a guarantee, and treating it as one is how people size positions wrong.

## The four things an audit usually doesn't cover

**1. The oracle.** Most lending and LP protocols trust an external price feed to decide what your collateral is worth and when to liquidate. A clean audit of the protocol's own code says nothing about whether that feed can be manipulated. A surprising share of "hacks" are really oracle manipulations — the contract did exactly what it was told, using a price that was briefly a lie.

**2. The bridge.** If a protocol holds assets that arrived over a bridge, your risk includes that bridge's code — which the protocol's audit didn't touch. Bridges have been the single largest category of DeFi loss by dollar value. The yield is on chain A; the failure can come from the rail that brought the money there.

**3. Everything shipped after the audit.** The report is pinned to a commit. Governance can deploy new code, change parameters, or swap out a module the next day. Unless the protocol re-audits every change (few do), the badge on the homepage may describe a version you're no longer using.

**4. Economic and governance design.** Auditors check whether the code does what it claims. They rarely rule on whether the *design* is sound — whether emissions are sustainable, whether one whale can swing a vote, whether the reward token has to keep its price for the yield to be real. That's not a code bug. It's a business-model risk, and it's invisible to a code review.

## A 60-second read of any audit badge

Before the badge changes how you size a position, run these four checks:

| Check | Good sign | Walk-away sign |
|---|---|---|
| **Who & how recent?** | Named firm, report within ~12 months | No report linked, or it's years old |
| **Does the date match the deploy?** | Audited commit ≈ live version | Audited an old version; lots of code shipped since |
| **What's the oracle?** | Battle-tested feed (e.g. Chainlink), TWAP'd | Single-source / spot price / unnamed |
| **Bridged assets?** | Native or canonical only | Long-tail bridge in the path |

If you can't answer those in a minute from the docs, that *is* the answer: size it like an unaudited protocol, because for your purposes it's closer to one.

## How the bot treats it

PassiveBlocks doesn't score "audited / not audited" as a checkbox. An audit is a floor, not a feature — table stakes to even be considered. The position-sizing comes from the things the audit *doesn't* cover: how the oracle is sourced, whether bridged assets are in the path, how long the live code has run unchanged, and how many independent ways the position can fail. That's why the bot's whitelist is short and boring — Aave, Fluid, Aerodrome, Orca, Kamino, Uniswap V3 — protocols whose live code has survived real money and real time, not just a two-week review.

## A note on self-custody

Every protocol you touch is one more contract you grant an approval to — and an audit doesn't protect you from a *drained approval* if your signing key is compromised. The fix is the same regardless of how clean any report is: keep the key that signs transactions on a device that never touches the internet. A hardware wallet does exactly that. → **[Get a Ledger here](https://shop.ledger.com/?r=a6255ec0ba49)** *(affiliate — we earn a commission if you sign up, at no cost to you)*

---

## Read the badge as a floor, not a finish line

An audit narrows the odds on one class of risk. The oracle, the bridge, the upgrade shipped last week, and the token economics are still yours to check. PassiveBlocks scores pools on what survives those checks — and only flags the ones worth your gas. Free, weekly:

→ **[Subscribe to PassiveBlocks](https://passiveblocks.io)**

Pairs with [the four numbers that explain any DeFi yield](https://passiveblocks.io/learn/four-numbers-defi-yield) and [when not to rebalance](https://passiveblocks.io/learn/when-not-to-rebalance).

**Earn more — PassiveBlocks**

*Last updated: 2026-06-22*
