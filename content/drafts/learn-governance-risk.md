# Your APY is a setting, not a contract — governance risk in DeFi

You deposit USDC into a lending pool quoting 7%. The contract is audited, the peg is solid, utilisation sits in a healthy band. Everything checks out. Then one Tuesday the rate is 4.5%, and you never got an email.

Nothing broke. No hack, no depeg, no exploit. A governance vote passed — maybe to raise the reserve factor, maybe to redirect emissions to a different pool, maybe to add a riskier collateral type to the same market your money sits in. The number you were earning wasn't a promise. It was a **parameter**, and someone with enough votes changed it.

This is governance risk, and it's the one most yield checklists skip — because it doesn't show up in the code, the audit, or the APY column. It shows up in who holds the votes.

## The rate was never yours to keep

Almost every number you read off a DeFi protocol is a configurable parameter, not a fixed term:

- **Reserve factor** — the protocol's cut of borrower interest. A DAO can lift it from 10% to 25% overnight, and [your effective lending rate drops](https://passiveblocks.io/learn/reserve-factor) without the headline borrow rate moving at all.
- **Emissions** — the bonus token rewards propping up a lot of "high APY" pools. A vote can switch them off, halve them, or move them to whichever pool the DAO wants to grow next. Your 12% becomes 4% the block the proposal executes.
- **Collateral onboarding** — a vote can add a new, thinner, more volatile asset as acceptable collateral in *your* market. You lent into a conservative pool; you wake up sharing risk with a token you'd never have touched.
- **Interest rate models** — the entire [kink curve](https://passiveblocks.io/learn/kink-interest-models) is a set of parameters a vote can re-shape.

None of this requires anyone to be malicious. Most governance changes are routine and reasonable. The point is that the terms you're earning under can be rewritten by people who aren't you — so "the rate" is really "the rate, until the next vote."

## Who can change the number?

That's the question governance risk reduces to. And the honest answer ranges from "a slow, well-distributed, time-locked process" to "three wallets and a multisig that can move tonight."

A few things to actually look at before you trust a rate to stick:

- **Is there a timelock?** Good protocols enforce a delay (often 24–72 hours) between a vote passing and the change taking effect. That window is your chance to exit if you don't like the change. No timelock means parameters can change in the same transaction that proposes them — you find out after.
- **How concentrated is voting power?** If a handful of wallets can pass anything unilaterally, "decentralised governance" is a label, not a protection. Token distribution tells you whether a vote is a community decision or a formality.
- **Is there an admin key or guardian?** Many protocols keep an emergency multisig that can pause or change things instantly, bypassing the normal vote. Sometimes that's a safety feature. It's also a single point of control — know it exists.
- **Where do proposals happen?** Active forums and visible on-chain proposals mean you can see changes coming. If governance is opaque, you're flying blind on parameters that decide your yield.

## A worked example

Two pools, both quoting **9%** on USDC. Same chain, same audit grade.

- **Pool A** is governed by a widely-held token with a 48-hour timelock on every parameter change, and an active forum where reserve-factor and emissions proposals get debated for a week before any vote. If the DAO decides to cut your rate, you'll see it coming and have two days to leave.
- **Pool B** has a governance token held 70% by the founding team and a multisig that can adjust the interest rate model with no delay. The 9% is real today. It's real exactly as long as the multisig wants it to be.

Same APY. Completely different products. Pool B isn't necessarily a scam — plenty of young protocols start centralised for good reasons — but you're being paid the *same* 9% to take meaningfully more risk that the number vanishes on someone else's schedule. If the spreads were equal, A wins every time.

## The one-line filter

Before you chase any rate, ask: **who can change this number, and how much warning would I get?**

If the answer is "a distributed token with a timelock and a public forum," the rate is about as durable as DeFi rates get. If the answer is "a multisig, instantly, no notice" — the APY is a setting on someone else's dashboard, and you're renting it at their pleasure. Price that in before you deposit.

## How the bot treats it

PassiveBlocks scores governance structure as a first-class risk, not a footnote. It favours protocols with distributed voting power, enforced timelocks, and visible proposal processes — because a rate you can see changing is a rate you can exit before it hurts. A pool with a marginally higher APY but a concentrated, no-timelock governance setup loses to a slightly lower rate you can actually count on. It's the same logic as the bot's [boring 0-rebalance discipline](https://passiveblocks.io/learn/when-not-to-rebalance): the durable number you keep beats the headline number that can be voted away while you sleep. Check who controls the parameter before you trust the parameter.

## Protect the keys behind every position

Governance can change your rate. It can't touch your principal — but a compromised signing key can take all of it in one transaction. The single highest-leverage safety move in DeFi is keeping the key that approves your deposits and withdrawals on a device that never touches the internet. → **[Get a Trezor here](https://trezor.io/?offer_id=133&aff_id=34581&tracker=pb_learn_governance_risk)** *(affiliate — we earn a commission if you sign up, at no cost to you)*

---

## Read the governance before you chase the rate

The APY is the easiest number to read and the easiest one to lose. A pool's governance tells you whether the rate is a term or a temporary setting — and PassiveBlocks checks who controls the parameters before it trusts any yield. We publish which pools clear the bar each week:

→ **[Subscribe to PassiveBlocks](https://passiveblocks.io)**

Pairs with [the reserve factor — the protocol's cut nobody quotes](https://passiveblocks.io/learn/reserve-factor) and [the four numbers that explain any DeFi yield](https://passiveblocks.io/learn/four-numbers-defi-yield).

**Earn more — PassiveBlocks**

*Last updated: 2026-06-27*
