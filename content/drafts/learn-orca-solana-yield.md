# What is Orca? Solana's biggest yield venue, explained (and how to read its pools)

If you've looked at DeFi yield on Solana, you've looked at Orca. It's the largest liquidity venue on the chain — the place most stablecoin and blue-chip pairs actually trade — and it's one of the few protocols our bot will deposit real capital into. But "biggest" isn't the same as "safe," and Orca's design rewards people who understand one specific thing about how its pools work. Here's the whole picture in plain terms.

## What Orca actually is

Orca is a decentralised exchange. When someone swaps SOL for USDC on Solana, that trade often routes through an Orca pool, and the people who supplied the two tokens in that pool earn a cut of the swap fee. That fee stream is the yield. No borrower, no emissions required — just real trading volume paying real liquidity providers. (If you want the full taxonomy of where yield comes from, that's [the source-of-yield spine](https://passiveblocks.io/learn/source-of-yield): Orca pools are the "trader pays" kind.)

The thing that makes Orca different from a plain 50/50 pool is **Whirlpools** — its concentrated-liquidity design.

## Concentrated liquidity: the one concept that matters

In an old-style pool, your money is spread across every possible price, most of which never happens. In a Whirlpool, you choose a **price range**, and your liquidity only works inside it. The upside: inside your range you earn far more fees per dollar, because your capital isn't wasted on prices that never trade. The catch: **if the price leaves your range, you stop earning entirely** — and you're left holding 100% of whichever asset just moved against you.

That's the trade. A 20% Whirlpool APY isn't a savings rate; it's a rate you earn *while price sits where you bet it would.* Step outside the range and the yield is zero until you come back or re-range. It's the same mechanism as [impermanent loss](https://passiveblocks.io/learn/impermanent-loss), sharpened: a tight range earns more but breaks more easily.

## Which Orca pools are worth it

Not all high APYs on Orca are equal, and the split matters more than the headline number:

- **Stable and blue-chip pairs** (SOL/USDC, cbBTC/USDC, SOL/cbBTC) — the fee yield here is real swap volume, not a printed token. On these, a high rate usually means the pool is genuinely busy. These are the pools we'll actually consider.
- **Long-tail token pairs** with eye-watering APYs — almost always propped up by [emissions](https://passiveblocks.io/learn/yield-mean-reversion): a reward token the protocol prints to rent your liquidity. The rate evaporates when the budget does, and so does the depth you were counting on to exit.

The fast tell: on any pool page, look at whether the yield comes from **fees** or from a **reward token**. Fee-funded on a pair people actually trade is durable. Emission-funded on a pair nobody trades is a countdown.

## Why Solana changes the math

Here's the part most yield content misses. On Ethereum mainnet, a rebalance can cost $40 in gas — enough that [switching pools rarely pays for itself](https://passiveblocks.io/learn/break-even-horizon). On Solana, that same transaction costs a fraction of a cent. Low fees don't just make Solana cheaper; they change *which strategies are even viable.* Re-ranging a Whirlpool, harvesting fees, moving between pools — all the active management that's uneconomic on mainnet becomes practical here.

That cuts both ways. It's why Solana LPing can genuinely out-earn mainnet for an attentive provider — and why it punishes a set-and-forget deposit that drifts out of range and never gets re-ranged. Cheap transactions reward attention; they don't replace it.

## How the bot treats Orca

PassiveBlocks uses Orca, but only on a short whitelist of pairs where the yield is real swap fees — SOL/USDC, cbBTC/USDC, SOL/cbBTC — and it gates every pair on [correlation](https://passiveblocks.io/learn/correlation-entry-gate) before the pool is even eligible. It checks [how deep the pool is](https://passiveblocks.io/learn/slippage-tax) relative to position size, because a thin Whirlpool costs you on the way out. And it treats the range as a live position, not a deposit you forget. The rate is the last thing it looks at, not the first — the same [four-number screen](https://passiveblocks.io/learn/four-numbers-defi-yield) we run on every venue.

## A note on self-custody

Providing liquidity on Solana means signing a steady stream of approvals to pool and router programs — the exact surface attackers target. The one risk you can delete entirely is your signing key sitting on an internet-connected device. A hardware wallet keeps it offline, so a bad approval can't drain you. Trezor supports Solana natively. → **[Get a Trezor here](https://affiliate.trezor.io/publisher/#!/offer/133?tracker=pb_learn_orca_solana_yield)** *(affiliate — we earn a commission if you sign up, at no cost to you)*

---

## Read the pool before you chase the rate

Orca is a real yield venue with a real quirk: your money only earns inside the range you pick, and the best-looking APYs are often rented, not earned. PassiveBlocks screens Solana pools the same way it screens every chain — source of yield first, rate last. Free, weekly:

→ **[Subscribe to PassiveBlocks](https://passiveblocks.io)**

**Earn more — PassiveBlocks**

*Last updated: 2026-07-05*
