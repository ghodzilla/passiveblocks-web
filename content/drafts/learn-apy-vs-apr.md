# APY vs APR in DeFi — when the headline rate is a number you only get if you do the work

You deposit into a pool quoting "12% APY." A year later you check, and you've earned closer to 11.3% — or, if it was a reward-token pool you never touched, closer to 9%. The pool didn't lie. The difference between what was quoted and what you got is the difference between **APY and APR**, and on some positions you have to *do something* to close it.

This is the number behind the number. Most DeFi yield content quotes APY as if it's a law of physics. It isn't. It's a projection that assumes a specific behaviour — and on a large slice of pools, that behaviour is *yours*.

## The actual difference

**APR** (annual percentage rate) is the raw rate, no compounding. Earn 1% a month, simple, and your APR is 12%.

**APY** (annual percentage yield) is what you get *if every interest payment is reinvested* and itself starts earning. That same 1%/month, compounded monthly, is an APY of **12.68%**.

> APY = (1 + APR/n)^n − 1, where n = compounding periods per year.

The gap looks small at 12%. It isn't small at 40%: a 40% APR compounded daily is a **49.1% APY**. The higher the rate and the more frequent the compounding, the wider the two numbers drift apart — which is exactly the range where leaderboards quote the bigger one.

## Where the gap is automatic — and where it's your job

Here's the part nobody spells out. Whether you actually *get* the APY depends entirely on how the protocol pays you.

**Share-price lending (Aave, Fluid, Morpho).** Your deposit is a share that grows in value as interest accrues. There's no token to claim, nothing to restake — the compounding happens in the share price itself, every block. Here the quoted APY is honest: you get it by doing nothing. This is the good case.

**Reward-token pools (many LPs, gauge/emissions farms).** The yield is paid in a separate token — dumped into a claimable bucket that does *not* compound on its own. To turn that APR into the advertised APY you have to manually claim the rewards, swap them, and redeposit. Skip it, and you've earned the **APR**, not the APY. Do it weekly on a small position and the gas + swap fees can eat more than the compounding adds.

So the same "12%" means two different things:
- On Fluid lending: 12% is roughly what lands in your account.
- On a reward-token farm: 12% is the ceiling you hit *only if* you claim-and-restake on schedule, net of every gas cost to do so.

## Worked example — $10,000 for a year

| | Quoted | What you do | What you keep |
|---|---|---|---|
| **Fluid USDC lending** | 5.2% APY | Nothing — share price compounds | ~$520 |
| **Reward-token farm, never claimed** | 12% APY | Nothing | ~$1,135 as APR, *uncompounded* — but the unclaimed tokens also drift in price |
| **Reward-token farm, claimed weekly** | 12% APY | 52 claim+swap+restake cycles | ~$1,268 gross, minus ~52 × gas |

On a $10K bag on a cheap L2, 52 round-trips at even $1–2 of gas each is $50–100 — and every swap of a reward token to USDC is a realised event your tax software has to log. The "12%" was real. Capturing it was a part-time job with a tax tail.

## The one-line filter

Before you trust a quoted APY, ask one question: **does this number compound on its own, or do I have to make it compound?**

- If it's share-price lending → the APY is roughly what you'll keep.
- If it's a reward token → mentally mark it down to its APR, then subtract the gas and the realised tax events it'll cost you to chase the rest. Often the "higher" pool is the lower one after you do.

This is the same trap as [annualising a 3-week emissions rate](https://passiveblocks.io/learn/utilisation-rate): a headline number that assumes a perfect, frictionless world you don't live in. Pair this with the [four numbers that explain any DeFi yield](https://passiveblocks.io/learn/four-numbers-defi-yield) and you can read a leaderboard the way an operator does — by asking what the number costs to actually collect.

## How the bot treats it

PassiveBlocks scores every pool on its **kept** yield, not its quoted yield. Auto-compounding lending positions are taken at close to face value. Reward-token pools get marked down for the claim cadence and gas drag needed to realise the APY — which is one reason the bot has sat at 0 rebalances for weeks in single-asset lending while flashier farms scrolled past. The farm's APY was real. The APR was what most depositors actually took home.

## A note on self-custody

Every claim-and-restake cycle is another on-chain interaction signing against your wallet. The more a yield strategy makes you touch the chain, the more it matters where your keys live. If you're running reward-token positions actively, a hardware wallet keeps the signing keys off your laptop where the malware is. A [Ledger Nano](https://shop.ledger.com/?r=a6255ec0ba49) is the standard entry point *(affiliate — we earn a commission if you sign up, and we hold our own keys on one)*.

---

## Get the kept number, not the quoted one

APR vs APY is one more place the leaderboard flatters the rate. PassiveBlocks scores pools on what you actually keep after compounding behaviour, gas, and reserve factor — and only flags the ones that clear our buffer over what we already hold. Free, weekly:

→ **[Subscribe to PassiveBlocks](https://passiveblocks.io)**

**Earn more — PassiveBlocks**

*Last updated: 2026-06-20*
