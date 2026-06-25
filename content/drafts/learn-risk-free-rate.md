# The risk-free rate is the floor every DeFi yield has to clear

A 4-week US Treasury bill pays roughly 5% right now. No smart contract. No depeg. No oracle to manipulate, no bridge to exploit, no governance vote that can switch it off. The US government has never missed a payment on a T-bill, which is why finance calls that rate "risk-free" — it's the return you can get for taking essentially no risk at all.

So here's the question almost nobody asks before clicking into a yield pool: **what is this pool paying me *above* the risk-free rate, and is that spread enough to cover everything that can go wrong?**

That spread is the whole game. Master it and most yield leaderboards stop looking exciting and start looking like what they are — a menu of risks with prices attached.

## The spread is your entire paycheck for taking risk

If a stablecoin lending pool pays 6% and the risk-free rate is 5%, you are being paid **1%** to take on smart-contract risk, depeg risk, oracle risk, and the chance the rate drops the day after you deposit. That 1% — not the 6% — is your actual compensation for leaving the safety of a T-bill.

Frame it that way and the maths gets uncomfortable fast:

- A **6%** pool over a **5%** floor = a **1pp** spread. One depeg, one exploit, one bad week and you've handed back years of that edge.
- A **9%** pool = a **4pp** spread. Now we're talking — but only if the risk is genuinely small.
- A **40%** pool = a **35pp** spread. Nothing pays you 35% over the risk-free rate for safe behaviour. That number is telling you the risk is enormous, the yield is [emissions that will decay](https://passiveblocks.io/learn/annualised-apy-trap), or both.

The rate isn't the reward. The rate *minus the floor* is the reward. Everything below the floor is just the price of money that you could have earned in your sleep.

## Why this reframes the whole leaderboard

Most yield content treats the APY column as a high-score table — bigger is better. The risk-free rate flips it into a risk gauge. The higher a pool sits above ~5%, the louder it's telling you how much risk you're being paid to absorb.

This is also why the gap *moves*. When the Fed cuts and T-bills drop to 3%, a 6% DeFi pool suddenly has a 3pp spread instead of 1pp — the same pool just got more attractive without changing anything. When the risk-free rate climbs to 5%+, a lot of "decent" DeFi yield quietly stops being worth the risk, because you can get most of it from a government bond. **DeFi yield is always priced relative to the floor, even when nobody says so out loud.**

## A worked example

Say you've got $10,000 in USDC.

- **T-bill (~5%):** ~$500/year, zero protocol risk, fully liquid at maturity.
- **Blue-chip stablecoin lending (~5.2%):** ~$520/year. Spread over the floor: ~$20. You're taking real smart-contract and depeg risk for an extra twenty bucks — *unless* you can't easily access T-bills (many people outside the US can't), in which case on-chain lending is your practical floor and the comparison shifts.
- **Some 18% farm:** ~$1,800/year on paper. Spread over the floor: ~$1,300. That's a lot — but a 13pp spread is the market screaming that the emissions will decay, the token you're paid in can fall, or the contract is young and unproven. Price the risk before you price the upside.

The point isn't that DeFi loses this comparison — for plenty of people, self-custodied stablecoin yield *is* the sensible floor, and the access argument matters. The point is that you should *make the comparison at all*, every time, before the APY number does your thinking for you.

## The one-line filter

Before you chase any rate, ask: **what is this paying me above the risk-free rate, and is that spread big enough to cover what can go wrong?**

If the spread is tiny, the convenience or the risk had better be tiny too. If the spread is huge, assume the risk is huge until you can prove otherwise — and most of the time you can't.

## How the bot treats it

PassiveBlocks prices the risk-free rate first and treats every DeFi yield as a spread on top of it. A pool paying a few points over the floor in a battle-tested protocol clears the bar; a pool paying 30pp over the floor sets off every alarm we have, because no honest source of yield pays that much for safe behaviour. It's the same instinct behind the bot's [boring 0-rebalance discipline](https://passiveblocks.io/learn/when-not-to-rebalance) — a steady real rate you keep beats a headline rate that's really just compensation for risk you didn't understand. Score the floor, then the spread, then the rate.

## Protect the principal that earns the spread

Earning a sensible spread over the risk-free rate only matters if you keep the principal. The fastest way to lose all of it isn't a depeg — it's a signing key sitting on an internet-connected laptop that gets phished. Keep the key that approves your transactions on a device that never touches the web. → **[Get a Ledger here](https://shop.ledger.com/?r=a6255ec0ba49&tracker=pb_learn_risk_free_rate)** *(affiliate — we earn a commission if you sign up, at no cost to you)*

---

## Price the floor before you chase the rate

The risk-free rate is the most boring number in finance and the most useful one in DeFi. It turns a leaderboard of tempting APYs into a list of risks with prices attached. PassiveBlocks checks the spread before it checks the headline — and tells you which pools clear the bar each week:

→ **[Subscribe to PassiveBlocks](https://passiveblocks.io)**

Pairs with [where DeFi yield actually comes from](https://passiveblocks.io/learn/source-of-yield) and [the four numbers that explain any DeFi yield](https://passiveblocks.io/learn/four-numbers-defi-yield).

**Earn more — PassiveBlocks**

*Last updated: 2026-06-26*
