export interface Article {
  slug: string;
  tag: string;
  title: string;
  excerpt: string;
  date: string;
  readTime: string;
  content: string;
}

export const ARTICLES: Article[] = [
  {
    slug: "fluid-protocol-defi-lending",
    tag: "Yield Analysis",
    title: "Fluid Protocol: The Quiet Monster Eating DeFi Lending",
    excerpt:
      "Fluid's unified liquidity layer is capturing market share from Aave and Compound at a pace most analysts haven't noticed yet. Here's the mechanics and the yield opportunity.",
    date: "2026-05-07",
    readTime: "6 min",
    content: `
## The Setup Nobody's Talking About

If you've been watching on-chain lending TVL over the last six months, you've noticed something quiet happening. Aave is still the leader by raw TVL. But Fluid — formerly known as Instadapp's liquidity layer — has been taking share in a way that's not showing up in the headline numbers yet.

The reason? Fluid solves a capital efficiency problem that Aave hasn't cracked: **unified liquidity across all asset pairs**.

## How Traditional Lending Works (And Why It's Inefficient)

In Aave's model, liquidity is siloed. USDC deposited into the USDC pool can only be borrowed against USDC. ETH deposited goes into the ETH pool. When utilisation on one pool is high, rates spike — but surplus capital sitting in adjacent pools can't flow in automatically.

This creates a persistent spread between what lenders earn and what borrowers pay, which is essentially dead weight the protocol can't eliminate.

## Fluid's Unified Liquidity Layer

Fluid's architecture pools all assets into a single liquidity layer. When a borrower needs USDC, the protocol draws from wherever capital is sitting — regardless of whether the depositor specified USDC or ETH. Collateral and debt positions are separated from the underlying liquidity source.

The result: higher utilisation across all assets simultaneously, which translates to higher lender APY for the same amount of depositor risk.

**Current rates as of May 2026:**
- Fluid Base USDC: 5.19% APY
- Fluid Arbitrum USDC: 4.63% APY
- Aave Base USDC: 3.8% APY
- Aave Arbitrum USDC: 3.4% APY

The gap is 1.2–1.3 percentage points — consistent, not a one-day spike.

## The Risk Profile

Fluid is not Aave. Aave has been battle-tested across multiple market cycles since 2020. Fluid's unified liquidity model is newer and carries smart contract risk that's harder to price.

Key things to watch:
- **Oracle risk**: Fluid's cross-asset liquidation system relies heavily on oracle accuracy. A price feed failure during high volatility could cause cascading liquidations.
- **Governance concentration**: Token distribution is still relatively concentrated.
- **TVL trajectory**: $2.1B TVL on Arbitrum is meaningful but not Aave-scale. A large withdrawal event could spike utilisation or rates unpredictably.

## The Opportunity

For stablecoin yield allocators comfortable with a newer protocol's smart contract risk, Fluid is generating 1.2–1.3% more APY than Aave on comparable assets. On a $50K position, that's $600–650 in additional annual yield.

The question isn't whether Fluid is better — it's whether that extra yield compensates for the additional protocol risk. For most capital allocators who are already comfortable with DeFi lending (i.e., already using Aave), the answer is probably yes, at 20–30% of total lending allocation.

---

*This is analysis, not financial advice. Always do your own research before deploying capital into any DeFi protocol.*
    `,
  },
  {
    slug: "aerodrome-vs-uniswap-v3-swap-fees",
    tag: "Protocol Deep Dive",
    title: "Aerodrome vs Uniswap V3: Where the Real Swap Fees Live",
    excerpt:
      "Same token pairs, radically different fee distribution. On Base, the delta between platforms on WETH/USDC is 38 APY points. We break down why — and when each wins.",
    date: "2026-04-30",
    readTime: "8 min",
    content: `
## The Surface-Level Story

Aerodrome and Uniswap V3 are both concentrated liquidity AMMs. They both support WETH/USDC. They both collect swap fees. So why is Aerodrome showing 85–128% APY on WETH/USDC while Uniswap V3 Arbitrum is showing 40–50%?

The answer is: gauge emissions, voting incentives, and a fundamentally different flywheel.

## Uniswap V3: Pure Swap Fee Economics

Uniswap V3 pays LPs 100% of swap fees collected within their price range. That's it. No token emissions, no protocol-level yield boosting. The APY you see is a direct function of:

1. Volume through the pool
2. How tight your liquidity is concentrated around the current price
3. How much capital you're competing against

On high-volume pairs like WETH/USDC on Arbitrum, a well-managed V3 position can generate 40–60% APY from swap fees alone. This is real, sustainable yield backed by economic activity.

The downside: you need active management. If the price moves outside your range, you earn nothing and accumulate impermanent loss.

## Aerodrome: The Velodrome Fork on Base

Aerodrome is a fork of Velodrome (itself a Solidly-derivative), adapted for Base. The mechanism is meaningfully different from Uniswap:

- Swap fees go to **veAERO voters**, not LPs directly
- LPs earn **AERO token emissions** from gauge votes
- The higher the bribe on a gauge, the more votes it attracts, the more AERO emissions flow to that pool's LPs

This creates a three-party system: LPs, veAERO voters, and protocols wanting deep liquidity. Protocols bid (in bribes) to attract voters, voters direct emissions, LPs get emissions.

**The current WETH/USDC Aerodrome gauge on Base is generating 59–128% APY.** Most of that is AERO emissions, not swap fees.

## When Each Wins

**Use Uniswap V3 when:**
- You want yield backed by real economic activity (swap fees)
- You're comfortable actively managing your range
- You're on Arbitrum (higher activity than Base for certain pairs)
- Token price risk on AERO concerns you

**Use Aerodrome when:**
- The pair you want has a strong, well-incentivised gauge
- You're comfortable holding AERO as part of your return
- You're on Base (Aerodrome dominates Base DEX volume)
- The current bribe cycle is supporting high emissions on your target pair

## The Hidden Risk on Aerodrome

AERO emissions are the yield. If AERO's token price drops 50%, your APY effectively halves. This is not theoretical — Velodrome's VELO token dropped 70% in the 2022 bear market, wiping out LP returns even as the underlying position held value.

For stablecoin-seeking investors, the safest Aerodrome play is USDC/cbBTC or similar pairs where correlated assets reduce IL, AND you're prepared to either hold AERO or auto-sell through a yield management tool.

---

*This is analysis, not financial advice.*
    `,
  },
  {
    slug: "stablecoin-lending-risk-hierarchy-2026",
    tag: "Risk Framework",
    title: "Stablecoin Lending in 2026: The Risk Hierarchy You Need",
    excerpt:
      "Not all 5% APY is equal. Between custodial risk, smart contract risk, oracle manipulation, and peg deviation, the spread between the safest and riskiest USDC yield is wider than most people think.",
    date: "2026-04-21",
    readTime: "7 min",
    content: `
## The Problem With Chasing APY

Open any DeFi dashboard in 2026 and you'll find dozens of opportunities showing 4–8% APY on stablecoins. USDC here, USDT there, DAI somewhere else. Rates roughly similar. Risk... assumed to be the same.

It's not.

The spread between the safest and riskiest stablecoin yield positions isn't 0.5% — it's the difference between money you're confident you'll get back and money that could vanish in a protocol exploit or peg break.

## The Risk Hierarchy (Lowest to Highest)

### Tier 1: Custodial Stablecoin Lending on Top-3 Protocols

**What it is:** USDC deposited into Aave v3, Compound v3, or Spark on Ethereum mainnet.

**Why it's safest:**
- Smart contracts audited 10+ times, running since 2019–2020
- Underlying USDC is held in regulated custody (Circle)
- Oracle diversity (Chainlink + redundant feeds)
- Circuit breakers and supply caps enforced at the protocol level

**Typical APY:** 3.5–5.5%

**Residual risks:** Circle counterparty risk (USDC issuer), Chainlink oracle risk, governance attack vector.

### Tier 2: Battle-Tested Protocols on L2s

**What it is:** USDC on Aave v3 Arbitrum/Base, or Fluid on Arbitrum/Base.

**Additional risk vs Tier 1:**
- Bridge smart contract risk (funds must cross the bridge to get to L2)
- Slightly less liquidity than mainnet — larger positions may face slippage on exit
- L2 sequencer risk (minimal, but non-zero)

**Typical APY:** 4–7%

### Tier 3: Newer Protocols with <$500M TVL

**What it is:** Morpho Blue, Euler v2, newer lending forks with 6–12 months of live operation.

**Additional risk:**
- Less battle-tested code — fewer exploit cycles survived
- Smaller insurance pools / governance treasuries to absorb losses
- Oracle configuration may be less conservative

**Typical APY:** 5–10%

### Tier 4: Algo-Backed or Exotic Stablecoins

**What it is:** Lending into pools using FRAX, crvUSD, GHO, or protocol-native stablecoins as collateral.

**Additional risk:**
- Peg stability depends on protocol mechanisms, not direct fiat backing
- If the underlying stablecoin depegs, the pool collapses
- UST/LUNA was Tier 4 (offering 20% on Anchor). We know how that ended.

**Typical APY:** 6–20%+

## How to Think About Allocation

A simple framework:

- 60% in Tier 1 (your base, sleep-at-night yield)
- 30% in Tier 2 (meaningful APY uplift, manageable risk)
- 10% in Tier 3 (higher yield, size-limited for risk management)
- 0% in Tier 4 unless you deeply understand the stability mechanism and are prepared to exit instantly

At 5% average APY on a $100K stablecoin position, this framework generates $5,000/year with the vast majority of capital in genuinely low-risk positions.

---

*This is analysis, not financial advice.*
    `,
  },
];

export function getArticle(slug: string): Article | undefined {
  return ARTICLES.find((a) => a.slug === slug);
}
