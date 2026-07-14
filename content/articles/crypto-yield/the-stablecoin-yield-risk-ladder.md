---
title: "The Stablecoin Yield Risk Ladder"
pillar: "crypto-yield"
excerpt: "There are four distinct rungs to stablecoin yield — from centralised savings to DeFi LP positions. Each rung pays more because it asks you to accept a different, specific risk."
date: "2026-07-14"
readTime: "7 min"
sources:
  - label: "Aave V3 Documentation — How lending rates are calculated"
    url: "https://docs.aave.com/developers/getting-started/readme"
  - label: "DeFiLlama — Stablecoin yields by protocol"
    url: "https://defillama.com/yields?token=USDC"
  - label: "Circle — USDC reserves and transparency"
    url: "https://www.circle.com/en/transparency"
---

## The core idea

Not all stablecoin yield comes from the same source. That sounds obvious, but most guides treat "yield" as a single category. It isn't. The risk you accept to earn 4% is completely different from the risk you accept to earn 12%, even when both are denominated in USDC.

This guide walks through the four main rungs of the stablecoin yield ladder — from lowest risk at the bottom to highest at the top — and explains what you're actually being paid to absorb at each level.

## Rung 1 — Centralised savings and exchange yield (lowest risk)

**What it is:** Yield paid by a centralised exchange (Coinbase, Kraken) or a yield product (centralised lending platforms) on your USDC balance.

**How it works:** The platform pools user funds and deploys them into money markets, treasuries, or loans to institutions. You get a share of the return.

**Risk you're absorbing:** Counterparty risk — the platform's solvency. If the platform fails, your funds are at risk. History (Celsius, BlockFi, FTX) shows this risk is real. Regulatory risk also applies: these products can be restricted or shut down with little warning.

**Typical yield range:** 1–5%, depending on platform and current rates.

**Who it's for:** Users who want yield without a crypto wallet or DeFi interaction, and who trust the platform's balance sheet.

---

## Rung 2 — DeFi lending on established protocols (low to medium risk)

**What it is:** Depositing USDC into on-chain lending protocols — Aave, Morpho, Fluid, Compound — and earning interest from borrowers.

**How it works:** Borrowers deposit crypto as collateral and pay interest to borrow USDC. You receive a share of that interest. Rates are set by utilisation: when borrowing demand is high relative to supply, rates go up. When supply exceeds demand, rates fall.

**Risk you're absorbing:** Smart contract risk — a bug in the protocol code could result in loss of funds. Oracle risk — if the price feed used to calculate collateral values fails during a volatile market, the protocol could face bad debt. Protocol governance risk — changes to risk parameters could affect your position.

**Typical yield range:** 3–8% on major protocols in normal conditions. Rates can spike higher during volatile periods when borrowing demand surges.

**Who it's for:** DeFi users comfortable with self-custody and smart contract interaction, who've read the protocol's security history and audit reports.

The key difference from Rung 1: you hold your funds in your own wallet and interact with audited on-chain contracts. No platform CEO can freeze your withdrawal. The risk is code, not company.

---

## Rung 3 — Stable pair LP positions (medium risk)

**What it is:** Providing liquidity to a trading pool between two stablecoins — USDC/USDT or USDC/DAI — on a DEX like Uniswap V3, Aerodrome, Curve, or Orca.

**How it works:** Traders swap between the two stables and you earn a fraction of the fee on every trade. Because both assets should be worth $1, impermanent loss is theoretically near-zero.

**Risk you're absorbing:** Peg risk — if either stablecoin loses its $1 peg, even temporarily, the pool rebalances against you. During the 2023 USDC depeg event, users in USDC/USDT LP positions suffered 4–6% losses in a single weekend, wiping out months of fee income. Smart contract risk also applies. For concentrated positions, there's active management overhead.

**Typical yield range:** 4–10% in base fees. Emission rewards from protocol incentives can push headline APY higher, but those are not sustainable if the emission token loses value.

**Who it's for:** Yield-seekers comfortable managing a position, who understand that "stable pair" doesn't mean "zero risk."

---

## Rung 4 — Volatile pair LP positions (higher risk)

**What it is:** Providing liquidity to a pool between a volatile crypto asset and a stablecoin — ETH/USDC, SOL/USDC, WBTC/USDT — and earning swap fees from high-volume trading.

**How it works:** Same as Rung 3, except the two assets can diverge significantly in price. When they do, your position rebalances — you sell the appreciating asset and buy the depreciating one, effectively buying low and selling high against yourself.

**Risk you're absorbing:** Impermanent loss — a 2x price move on a volatile pair can produce 5–6% IL, which must be covered by fees before you break even. Smart contract risk. Price concentration risk on V3-style positions (your position goes inactive when the price moves outside your range). The volatility that produces fee income also produces the most IL.

**Typical yield range:** 10–60%+ annualised on high-volume pairs during active markets. This varies enormously. A pool that shows 50% APY this week may show 15% next week when volatility drops.

**Who it's for:** Active DeFi managers who understand IL mechanics, can monitor positions, and have a clear thesis on why fees will outpace IL over their holding period. See the PassiveBlocks IL guide for the worked-dollar calculations.

---

## How to use this ladder

The ladder isn't a ranking of "best" to "worst" — it's a map of trade-offs.

A sensible allocation for most retail investors:
- **60–70% in Rung 2** (DeFi lending) — the core. Predictable, liquid, non-custodial.
- **15–25% in Rung 3** (stable LP) — yield uplift with bounded peg risk.
- **10–15% in Rung 4** (volatile LP) — only if you'll actively manage the position.

Before moving up a rung, check: do you actually understand the new risk you're accepting? The answer to "should I move from Rung 2 to Rung 4?" is almost always "only after you've spent time in Rung 3 and understand what caused the IL on the position you ran there."

For live rates across Aave, Fluid, Morpho, and top LP pools, check the [yields page](/yields) — those are updated in real time, not approximations.

---

*This is educational content, not financial advice.*
