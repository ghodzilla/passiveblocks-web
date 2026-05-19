export interface LearnArticle {
  slug: string;
  category: string;
  tag: string;
  title: string;
  excerpt: string;
  date: string;
  readTime: string;
  content: string;
  publishedAt?: string;
  updatedAt?: string;
}

export interface LearnCategory {
  id: string;
  label: string;
  description: string;
  icon: string;
}

export const LEARN_CATEGORIES: LearnCategory[] = [
  {
    id: "defi-basics",
    label: "DeFi Basics",
    description: "How yield works, key concepts explained plainly",
    icon: "🏦",
  },
  {
    id: "staking",
    label: "Staking",
    description: "ETH, SOL, and liquid staking protocols compared",
    icon: "🔒",
  },
  {
    id: "protocols",
    label: "Protocols",
    description: "Deep dives on Aave, Fluid, Orca, Aerodrome, Kamino",
    icon: "⚙️",
  },
  {
    id: "wallets",
    label: "Wallets & Security",
    description: "How to hold and protect your DeFi assets",
    icon: "🔐",
  },
  {
    id: "yield-strategies",
    label: "Yield Strategies",
    description: "Build and manage a DeFi yield portfolio",
    icon: "📈",
  },
  {
    id: "tax",
    label: "Tax & Compliance",
    description: "AU-focused tax guidance on DeFi income and CGT",
    icon: "📋",
  },
];

export const LEARN_ARTICLES: LearnArticle[] = [
  // ── DeFi Basics ──────────────────────────────────────────────────────────────
  {
    slug: "what-is-defi-yield",
    category: "defi-basics",
    tag: "DeFi Basics",
    title: "What Is DeFi Yield? A Plain-English Guide",
    excerpt:
      "Interest, swap fees, token emissions — there are three distinct ways to earn yield in DeFi, and they carry completely different risk profiles. Here's how to tell them apart.",
    date: "2026-05-10",
    readTime: "5 min",
    content: `
## The Short Version

DeFi yield is money your crypto earns while it sits in a protocol. Think of it like interest on a savings account — except instead of a bank deciding the rate, the rate is set by supply, demand, and sometimes token incentives.

The critical thing most beginners miss: **not all DeFi yield comes from the same source**, and that matters enormously for how safe it is.

## Three Types of DeFi Yield

### 1. Lending Interest

You deposit USDC into a lending protocol (Aave, Fluid, Compound). Borrowers pay to borrow it. You receive a share of that interest.

This is the closest thing DeFi has to a savings account. The rate is set by utilisation — when lots of people want to borrow and few want to lend, rates go up.

**Current examples:**
- Fluid Arbitrum USDC: ~4.6% APY
- Fluid Base USDC: ~5.2% APY
- Aave Base USDC: ~3.8–4.2% APY

This yield is real: backed by borrowers paying actual interest.

### 2. Swap Fees (Liquidity Provider Yield)

DEXes like Uniswap, Orca, and Aerodrome need liquidity to execute trades. You provide a pair of tokens (e.g. ETH + USDC), and every time someone swaps between them, you earn a fraction of the fee.

On a high-volume pair like ETH/USDC on Uniswap V3 Arbitrum, well-managed positions have generated 40–60% APY purely from swap fees.

The catch: **impermanent loss**. If prices move sharply, your position can lose value relative to just holding both tokens. More on that in the next guide.

### 3. Token Emissions

Protocols sometimes print their own governance token and hand it to depositors as an incentive to attract liquidity. This is called "emissions" or "gauge rewards."

It's the least sustainable yield source. If the token price drops, your APY disappears even if your underlying position is fine. This is how 300% APY farms become -20% in a month.

---

## How to Read an APY Figure

When you see a yield number on DeFi Llama or a protocol dashboard, check what's making it up:

- **APY base** = swap fees or lending interest (real, sustainable)
- **APY reward** = token emissions (depends on token price)
- **APY total** = the sum they lead with

If the total APY is 40% but the base is 2%, you're mostly betting on a token keeping its price. That's not yield — that's speculation.

## A Simple Starting Framework

If you're new to DeFi and want yield without complexity:

1. Start with stablecoin lending on Aave or Fluid — see [Aave vs Fluid compared](/learn/aave-vs-fluid-2026)
2. Accept the lower APY (4–6%) in exchange for simplicity and lower risk
3. Only move into LP positions once you understand impermanent loss — read [how impermanent loss works](/learn/how-impermanent-loss-works)
4. Never put more than 10% of your position into emission-heavy pools

The goal is to earn more than a savings account without taking on risks you don't understand yet.

[Open Fluid →](https://fluid.instadapp.io) *(affiliate — we earn a commission at no cost to you)*

---

*This is educational content, not financial advice.*
    `,
  },
  {
    slug: "how-impermanent-loss-works",
    category: "defi-basics",
    tag: "DeFi Basics",
    title: "How Impermanent Loss Works (With a $1,000 Example)",
    excerpt:
      "Impermanent loss is the hidden cost of being a liquidity provider. Walk through a real $1,000 ETH/USDC example and see exactly how much you lose — and when fees make it worth it anyway.",
    date: "2026-05-03",
    readTime: "6 min",
    content: `
## What Impermanent Loss Actually Is

Impermanent loss (IL) is the difference between what you'd have if you held your tokens versus what you actually have after providing liquidity. It's "impermanent" because it reverses if the price returns to your entry level. In practice, it often becomes permanent.

You don't lose money in the traditional sense — you just make less than you would have by doing nothing. On volatile pairs in a rising market, that difference can be significant.

## The $1,000 Example

You deposit $1,000 into an ETH/USDC pool on Orca. At entry, ETH is $2,000.

- You provide: 0.25 ETH + $500 USDC
- Total value: $1,000 ✓

Now ETH doubles to $4,000. You decide to withdraw.

**If you had just held:** 0.25 ETH is now $1,000 + $500 USDC = **$1,500**

**What you actually have in the pool:** The AMM rebalances your position automatically as the price moves. At $4,000 ETH, your position is worth approximately **$1,414** — not $1,500.

**Impermanent loss: ~$86 (5.7%)**

The math behind this: AMMs use the formula x × y = k. As ETH rises, the pool sells your ETH and buys USDC to maintain balance. You end up holding less of the asset that went up.

## When Fees Make It Worth It

IL by itself doesn't tell you whether providing liquidity is profitable. You also earned swap fees during that period.

If the pool generates 50% APY in swap fees and you held for a month, you earned roughly 4.2% in fees ($42 on a $1,000 position). Against 5.7% IL, you're net -1.5%.

If the pool generates 80% APY and you held for the same month, fees are ~6.7%. Against 5.7% IL, you're net +1% — profitable even after IL.

**IL becomes irrelevant when:**
- The token pair is highly correlated (e.g. USDC/USDT, ETH/stETH)
- The fee tier is high and volume is consistent
- The price moves sideways over your holding period

## How to Reduce IL Risk

### Use Correlated Pairs
Stablecoin pairs (USDC/USDT) have near-zero IL because prices don't diverge. LST pairs (ETH/stETH) have very low IL because stETH tracks ETH closely.

### Tighten Your Range (Advanced)
On Uniswap V3 or Orca, you provide liquidity within a price range. Tighter ranges earn more fees but face more frequent IL when the price moves outside.

### Understand What You Own
Track your position on DeFiLlama or Debank. Know your entry price and current IL before you exit.

[Trade on Orca →](https://www.orca.so) *(affiliate — we earn a commission at no cost to you)*

## The Honest Summary

IL is a real cost. On volatile pairs, it frequently wipes out swap fee income. On correlated pairs and high-volume pools, fees more than compensate.

The pairs most exposed to IL are exactly the ones with the highest advertised APY — because protocols need to offer high emissions to attract LPs who would otherwise walk away from the risk.

Before entering any LP position, ask: if this token moves 2x up or down, what does my IL look like? Then ask: do fees cover it?

If you want yield without IL exposure, [stablecoin lending on Aave or Fluid](/learn/best-usdc-yield-strategies-2026) is the right starting point.

---

*This is educational content, not financial advice.*
    `,
  },

  {
    slug: "impermanent-loss-explained",
    category: "defi-basics",
    tag: "DeFi Basics",
    title: "Impermanent Loss, Explained With a Real Number Example",
    excerpt:
      "Impermanent loss is the most misunderstood concept in DeFi. Walk through a $1,000 ETH/USDC example, see the exact percentage cost at each price move, and learn the three ways to minimise it.",
    date: "2026-05-14",
    readTime: "6 min",
    publishedAt: "2026-05-14",
    updatedAt: "2026-05-14",
    content: `
## The one-sentence definition

When you supply two assets to a liquidity pool, you end up with a different mix of those assets than you put in. If the price ratio between them moved while you were in the pool, that new mix is worth less than if you had just held both assets in your wallet.

That gap is impermanent loss.

It exists because of how AMMs (automated market makers) price swaps — they rebalance your share of the pool every time someone trades against it, and they don't ask your permission.

## A worked example with $1,000

Suppose you provide liquidity to an ETH/USDC pool. You deposit:

- $500 USDC
- $500 worth of ETH (0.25 ETH at $2,000)

Total deposited: $1,000.

ETH then doubles to $4,000.

The pool's pricing formula automatically rebalances your share. By the time you check, you no longer hold 0.25 ETH and 500 USDC. You hold approximately:

- 0.177 ETH (worth $708)
- 707 USDC

Total now: **$1,414** (rounded).

But if you had just held the assets in your wallet, you would have:

- 0.25 ETH × $4,000 = $1,000
- 500 USDC = $500

Total held: **$1,500**.

The difference — **$86, or 5.7%** — is impermanent loss. The bigger the price move, the worse the gap gets.

| ETH price change | Impermanent loss |
|---|---|
| +25% | 0.6% |
| +50% | 2.0% |
| +100% (2x) | 5.7% |
| +300% (4x) | 20% |
| +500% (6x) | 25.5% |

The math is symmetrical — a 50% price drop produces the same 2.0% loss as a 50% rise.

## Why is it called "impermanent"?

Because if the price ratio returns to where you started, the loss disappears. If ETH falls back to $2,000 in our example, your position re-balances and you end up roughly back where you began — net of any fees earned during the round trip.

The catch: most LPs do not wait for that return. They exit when prices have moved, which crystallises the loss.

The honest framing: "impermanent" describes the math, not your behaviour. For practical purposes, treat IL as **real loss** when you exit.

## When fees offset IL — and when they don't

IL is only half the picture. The other half is the swap fees you earn while you are in the pool. The right question isn't "will I have IL?" — it's "do the fees exceed the IL?"

This depends on three things:

1. **The pair.** Stablecoin pairs (USDC/USDT) have near-zero IL because both assets track $1. Correlated pairs (CBBTC/WBTC, ETH/STETH) have minimal IL. Volatile pairs (ETH/USDC, SOL/USDC) can have meaningful IL during large moves.
2. **The volume.** A pair with $10M/day in swap volume generates real fee income. A pair with $50K/day doesn't, no matter how good its APY looks on a dashboard.
3. **Your range.** On concentrated liquidity AMMs (Uniswap V3, Orca, Aerodrome Slipstream), tight ranges earn more fees but require more rebalancing. Wide ranges earn less but are passive.

A good rule of thumb: if a pool's stated APY is mostly from token emissions rather than real swap fees, treat that APY with suspicion. Emissions can stop overnight. Volume-driven fees are sticky.

## Three ways to minimise IL

**1. Use correlated pairs.** USDC/USDT, USDC/DAI, CBBTC/WBTC — assets that move together produce almost no IL by definition. The yield is lower but the trade-off is honest. We compare the lending alternative in [Stable LP vs Stable Lending](/learn/yield-strategies/stable-lp-vs-lending).

**2. Use lending instead of LP.** Single-asset lending (Aave, Fluid, Kamino) has zero IL by design. You deposit one asset, you get back that asset plus interest. The rates are lower than active LP, but for most retail investors, the simplicity is worth more than the marginal yield. See [What Is DeFi Yield](/learn/defi-basics/what-is-defi-yield) for the lending vs LP breakdown.

**3. Pick high-volume pairs in liquid markets.** If you do want LP exposure, pick a pair where real trading volume — not emissions — is driving the APY. ETH/USDC on a top-3 DEX during a volatile week is a different beast than a long-tail token pair with low volume. The [Best USDC Yield Strategies 2026](/learn/yield-strategies/best-usdc-yield-strategies-2026) guide ranks the current options by risk.

## The PassiveBlocks rule of thumb

For retail-sized portfolios ($1K to $100K), here is the order we recommend:

1. **Start with lending.** Fluid or Aave on USDC. Zero IL. 4–5% APY today. Learn the wallet flow with a position that cannot surprise you.
2. **Graduate to stable LP if you want more yield.** USDC/USDT or USDC/DAI on a high-volume DEX. ~6–8% APY, minimal IL.
3. **Add volatile LP only with eyes open.** ETH/USDC, SOL/USDC, WBTC/WETH can pay 20–60% APY in concentrated ranges, but you are taking real IL exposure. Track your performance against the simpler alternative of just holding the underlying. If you are not beating "hold," the IL is winning.

The bot we run for the newsletter holds the majority of its capital in single-asset Fluid lending for exactly this reason — when in doubt, take the yield that doesn't come with a hidden tax.

---

*This is educational content, not financial advice.*
    `,
  },

  // ── Staking ──────────────────────────────────────────────────────────────────
  {
    slug: "eth-liquid-staking-lido-vs-rocketpool",
    category: "staking",
    tag: "Staking",
    title: "ETH Liquid Staking in 2026: Lido vs Rocket Pool vs EigenLayer",
    excerpt:
      "Lido pays 3.5%, Rocket Pool runs closer to 4%, and EigenLayer restaking adds complexity for an extra 2–5%. Here's which option fits which investor.",
    date: "2026-05-08",
    readTime: "7 min",
    content: `
## What Liquid Staking Is

When you stake ETH natively, it gets locked in the Ethereum beacon chain. You can't use it, trade it, or lend it. Liquid staking protocols solve this by giving you a receipt token (stETH, rETH) that earns staking rewards automatically and can be used in DeFi simultaneously.

For most ETH holders, liquid staking is a better deal than native staking — same underlying yield, plus you keep optionality.

## Lido: The Market Leader

Lido dominates ETH liquid staking with over 30% of all staked ETH. You deposit ETH, receive stETH, and the token rebase daily to reflect accrued rewards.

**Current yield: ~3.5% APY**

Lido takes a 10% protocol fee from staking rewards. The remainder goes to stETH holders.

**Why people use Lido:**
- Maximum liquidity — stETH is accepted on Aave, Curve, and dozens of other protocols
- Battle-tested since 2020
- Transparent on-chain rebasing

**The risk:** Lido's market dominance is itself a systemic risk for Ethereum. If Lido controls >33% of staked ETH, it could theoretically threaten Ethereum's finality. This has prompted calls to diversify — and it's a real concern, not just competitor FUD.

## Rocket Pool: Decentralised Alternative

Rocket Pool uses a network of mini-pools — individual node operators who each put up 8 ETH of their own alongside depositor ETH. This creates a much more decentralised validator set.

**Current yield: ~3.8–4.0% APY (as rETH)**

The higher yield comes from node operator fees flowing partly to rETH holders. The protocol is smaller, which also means it hasn't hit the same market dominance concerns as Lido.

**Why people use Rocket Pool:**
- More decentralised
- Slightly higher yield
- rETH is non-rebasing (the token price increases rather than your balance)

**The risk:** Smaller TVL means slightly less liquidity for rETH. If you hold a large position and need to exit quickly, slippage may be higher than stETH.

## EigenLayer: Restaking for Extra Yield

EigenLayer lets you deposit stETH (or native staked ETH) and "restake" it — securing additional protocols beyond Ethereum in exchange for extra rewards.

**Current restaking yield: 2–5% additional APY on top of base staking**

This is early and the risk profile is meaningfully different. You're now exposed to slashing conditions on multiple systems simultaneously. If a protocol you're securing has a bug or governance attack, your restaked ETH can be slashed even if Ethereum itself is working perfectly.

**Only consider EigenLayer if:**
- You understand slashing mechanics
- You're comfortable with smart contract risk across multiple protocols
- You're not relying on this capital for short-term liquidity

## Which One to Choose

| | Lido | Rocket Pool | EigenLayer |
|---|---|---|---|
| APY | 3.5% | 3.8–4.0% | 5.5–8.5% combined |
| Liquidity | Excellent | Good | Depends on LST used |
| Decentralisation | Low | High | Varies |
| Risk level | Low | Low | Medium-High |

For most investors: **Rocket Pool for decentralisation + slightly better yield, Lido if you need maximum liquidity for DeFi strategies**. EigenLayer only after you've read the slashing conditions carefully.

To put staked ETH to work in a broader yield portfolio, see [how to build a $10K DeFi yield portfolio](/learn/build-10k-defi-yield-portfolio).

---

*This is educational content, not financial advice.*
    `,
  },
  {
    slug: "solana-staking-marinade-jito",
    category: "staking",
    tag: "Staking",
    title: "Solana Staking: Native vs Marinade vs Jito Compared",
    excerpt:
      "Native SOL staking pays around 7%, Marinade adds MEV boosts to hit 7.5%, and Jito captures validator tips on top. Here's the trade-off for each approach.",
    date: "2026-05-01",
    readTime: "6 min",
    content: `
## Solana Staking in 2026

Solana staking is simpler than Ethereum in one important way: there's no withdrawal delay drama. You can unstake and receive your SOL within one epoch (roughly 2–3 days). This makes it much more practical for active yield managers.

The base staking yield on Solana is determined by inflation schedule and network participation. As more SOL gets staked, the yield per validator decreases. Current network yield sits around 7% annualised.

## Native Staking: The Baseline

You can stake SOL directly through wallets like Phantom or Solflare by delegating to a validator. No intermediary, no liquid receipt token — your SOL is delegated and earns rewards each epoch.

**Current yield: ~6.8–7.2% APY**

The yield varies slightly depending on which validator you choose. Validators take a commission (typically 5–10%), and higher-performing validators may generate slightly more rewards.

**Best for:** Long-term holders who don't need liquidity and want the simplest possible setup with no smart contract risk.

## Marinade: Liquid Staking with MEV

Marinade is Solana's leading liquid staking protocol. You deposit SOL and receive mSOL, a token that appreciates in price as staking rewards accrue (similar to Rocket Pool's rETH on Ethereum).

**Current yield: ~7.5% APY**

The extra yield vs native staking comes from Marinade's delegation strategy. The protocol algorithmically distributes stakes across a large validator set, optimises for performance, and captures some MEV (maximal extractable value) that flows back to mSOL holders.

mSOL is widely accepted in Solana DeFi — Orca, Kamino, Raydium — so you can stack yield on top of your staking base.

[Track with Koinly →](https://koinly.io) *(affiliate — we earn a commission at no cost to you)*

## Jito: MEV-First Staking

Jito is built specifically around MEV capture. The Jito validator client bundles transactions to extract tips from arbitrageurs and searchers, and a share of those tips flows to JitoSOL holders.

**Current yield: ~7.8–8.5% APY**

The higher yield is real — Jito has been consistently outperforming standard liquid staking through MEV capture. The risk: MEV yield is variable. In low-activity periods, the MEV component shrinks. In high-activity periods (launches, volatile markets), it spikes.

**JitoSOL is also widely accepted in Solana DeFi**, making it a strong choice for active yield strategies.

## Native Staking vs Marinade vs Jito

| | Native | Marinade (mSOL) | Jito (jitoSOL) |
|---|---|---|---|
| APY | ~7.0% | ~7.5% | ~7.8–8.5% |
| Liquidity | None (2-3 day unstake) | Instant (DEX) | Instant (DEX) |
| Smart contract risk | None | Low | Low |
| DeFi composability | No | Yes | Yes |

## The Practical Recommendation

If you're staking SOL and not using it for DeFi: native staking is fine. No smart contract risk, competitive yield.

If you want to stack yield on top of staking (e.g. provide mSOL/USDC liquidity on Orca while earning staking rewards underneath): Marinade or Jito — Jito for maximum base yield, Marinade for slightly more battle-tested protocol.

Never unstake native SOL to use Marinade or Jito unless the yield difference covers at least 3x your transaction costs. On $10K positions, the ~0.5–1% difference is worth the switch. On $1K positions, be more careful about gas optimisation.

To combine SOL staking with LP yield on Solana, see [how Orca works](/learn/what-is-orca-solana-dex).

---

*This is educational content, not financial advice.*
    `,
  },

  // ── Protocols ────────────────────────────────────────────────────────────────
  {
    slug: "aave-vs-fluid-2026",
    category: "protocols",
    tag: "Protocols",
    title: "Aave vs Fluid: Which Stablecoin Protocol Wins in 2026?",
    excerpt:
      "Aave has the track record. Fluid has the yield advantage — consistently 1.2–1.5% higher APY on USDC. Here's what the difference is, and when each wins.",
    date: "2026-05-06",
    readTime: "7 min",
    content: `
## The Yield Gap

If you deposit USDC into Aave v3 on Base today, you'll earn around 3.8–4.2% APY. If you deposit the same USDC into Fluid on Base, you'll earn around 5.19% APY.

That gap — roughly 1–1.4 percentage points — has been consistent for months. On a $50,000 stablecoin position, the difference is $500–700 per year. That's real money.

The question is whether the extra yield is worth the extra risk of using a newer protocol.

## How Aave Works

Aave v3 pools assets by type. USDC lenders supply into the USDC pool. Borrowers borrow from that pool. Utilisation (borrowed/supplied) determines the interest rate — higher utilisation means higher rates for both sides.

Aave's strength is what it doesn't do: it doesn't over-engineer. The protocol has survived multiple market cycles since 2020, including the Terra collapse, the FTX blowup, and multiple exploit attempts on forked protocols. Its conservative approach to collateral ratios and oracle diversity has meant zero major exploits on the core contracts.

**Current rates:**
- Aave Base USDC: 3.8–4.2% APY
- Aave Arbitrum USDC: 3.4–3.8% APY

## How Fluid Works

Fluid's architecture separates liquidity from positions. All deposited capital goes into a single unified pool, and borrowing positions are created against that unified pool — regardless of what asset the borrower is using as collateral.

This means capital is deployed more efficiently. In Aave, if the USDC pool is at 60% utilisation and the ETH pool is at 40%, there's idle capital the protocol can't move. In Fluid, all capital is effectively shared, pushing average utilisation — and therefore lender yield — higher.

**Current rates:**
- Fluid Base USDC: ~5.19% APY
- Fluid Arbitrum USDC: ~4.63% APY

[Open Fluid →](https://fluid.instadapp.io) *(affiliate — we earn a commission at no cost to you)*

## The Risk Difference

Fluid has a shorter track record. It launched in its current form in 2024. It hasn't been stress-tested through a major market collapse the way Aave has.

Key risk considerations:

**Oracle dependency:** Fluid's unified liquidation system relies on accurate pricing across multiple assets simultaneously. A price feed failure during a high-volatility event could trigger cascading liquidations.

**TVL concentration:** Fluid's TVL is meaningful ($2B+ on Arbitrum) but not Aave-scale. Large withdrawal events could spike utilisation unpredictably.

**Governance concentration:** Token distribution is newer and less distributed than Aave's.

## The Practical Framework

For capital allocators already comfortable with DeFi lending:

- **Use Aave** for the majority of your stablecoin allocation (60–70%) — this is your conservative base
- **Use Fluid** for 20–30% — the extra yield is meaningful, the risk is manageable at that position size
- **Don't put everything into Fluid** simply because the APY is higher

For new DeFi users who've never used a lending protocol: start with Aave. Get comfortable with the mechanics before moving to newer protocols.

For a comparison of how these fit into a complete yield strategy, see [best USDC yield strategies 2026](/learn/best-usdc-yield-strategies-2026).

---

*This is educational content, not financial advice.*
    `,
  },
  {
    slug: "what-is-orca-solana-dex",
    category: "protocols",
    tag: "Protocols",
    title: "What Is Orca? Solana's Cleanest Yield DEX Explained",
    excerpt:
      "Orca is the most user-friendly concentrated liquidity DEX on Solana. SOL/USDC pools have generated 8–12% APY in real swap fees. Here's how it works and when to use it.",
    date: "2026-04-29",
    readTime: "6 min",
    content: `
## Why Orca Stands Out

Most DEXes on Solana are designed for traders. Orca is designed for liquidity providers — the interface shows you exactly what you need to know: fee tier, price range, current APY, and your IL exposure.

It runs on Solana's Whirlpools, a concentrated liquidity model similar to Uniswap V3 but with Solana's transaction costs (fractions of a cent versus dollars on Ethereum L2s).

## How Orca Generates Yield

You provide two tokens in a price range. When trades happen within your range, you earn a fraction of the fee. The four fee tiers are 0.01%, 0.05%, 0.30%, and 1.00%.

For stable pairs (USDC/USDT), you'd use the 0.01% tier — tight range, low fees, very low IL.
For volatile pairs (SOL/USDC), the 0.30% or 1.00% tier makes sense — wider fees compensate for IL risk.

**Current SOL/USDC APY (real swap fees):** 8–12%

This is genuine swap fee yield, not emissions. Solana processes millions of swaps daily, and SOL/USDC is one of the highest-volume pairs on the network.

[Trade on Orca →](https://www.orca.so) *(affiliate — we earn a commission at no cost to you)*

## Setting Up a Position

1. Connect your wallet (Phantom, Backpack, or Solflare)
2. Go to the Whirlpools section
3. Select your pair (start with SOL/USDC if you're learning)
4. Choose your fee tier and price range
5. Deposit equal value of both tokens

The interface shows you: current price, your range, estimated APY, and what happens to your position if price moves up or down. Spend time on this screen — understand what a 20% SOL move does to your IL before committing capital.

## The IL Reality on SOL/USDC

SOL is volatile. A 30% price move in either direction is normal. On a tightly concentrated position, this can wipe out weeks of fee income.

The mitigation: set your range wider than feels comfortable. A narrower range earns more fees per dollar but goes out of range faster. A position outside range earns zero fees and just accumulates IL.

**Practical starting point:** Set a range approximately 2x wider than the current price move you'd expect in a week. If SOL is at $150, consider a range from $100–$225 — wide enough to stay in range through normal volatility.

## When Orca Makes Sense vs Alternatives

Use Orca for SOL/USDC if:
- You want real swap fee yield (not emissions)
- You're comfortable managing a Solana position
- You have at least $500 to deploy (below this, fee income gets swamped by the cost of range management)

Use Fluid or Aave instead if:
- You want simpler set-and-forget yield
- You don't want IL exposure
- You're uncomfortable with the complexity of range management

Orca is the better yield option on SOL — but only if you're paying attention. A neglected out-of-range position earns nothing while accumulating IL.

For the full picture on how Orca fits into a stablecoin and staking portfolio, see [best USDC yield strategies](/learn/best-usdc-yield-strategies-2026) and [Solana staking compared](/learn/solana-staking-marinade-jito).

---

*This is educational content, not financial advice.*
    `,
  },

  // ── Wallets ───────────────────────────────────────────────────────────────────
  {
    slug: "hot-vs-cold-wallet-defi",
    category: "wallets",
    tag: "Wallets & Security",
    title: "Hot vs Cold Wallet: When You Actually Need a Hardware Wallet",
    excerpt:
      "A hardware wallet is not mandatory for every DeFi user. Here's the honest threshold — the amount where a Ledger stops being paranoia and starts being essential.",
    date: "2026-05-05",
    readTime: "5 min",
    content: `
## The Actual Question

Most DeFi security content tells you to buy a hardware wallet immediately. That advice is rarely wrong — but it's not calibrated. The real question is: at what amount does a hardware wallet become non-optional?

Here's the honest framework.

## Hot Wallets: What the Risk Actually Is

A hot wallet (Phantom, MetaMask, Rabby) holds your private key on a device connected to the internet. The risk is:

1. **Malicious approvals:** You sign a transaction that drains your wallet
2. **Malware:** Keyloggers or browser extensions that extract your seed phrase
3. **Phishing:** You visit a fake site and sign a transaction you didn't intend to

Most hot wallet losses come from #1 and #3 — user error, not protocol exploits. Hardware wallets don't protect against approvals you sign yourself, but they do make it dramatically harder for malware to steal your seed phrase.

## Cold Wallets: What They Actually Do

A hardware wallet (Ledger, Trezor) stores your private key on a physically isolated chip. Signing a transaction requires physical button confirmation on the device. Even if your computer is compromised, the attacker can't move your funds without physical access to the device.

**What they protect against:** Malware, seed phrase extraction, remote attacks.

**What they don't protect against:** Signing malicious transactions yourself (because you still have to press the button).

[Get Ledger Nano X →](https://www.ledger.com) *(affiliate — we earn a commission at no cost to you)*

## The Threshold

This is a practical judgement call, but here's a reasonable framework:

- **Under $1,000:** Hot wallet is acceptable. The risk of seed phrase theft is real but small relative to the cost and friction of a hardware wallet. Use a dedicated browser profile for DeFi and revoke approvals regularly.
- **$1,000–$10,000:** Hardware wallet is strongly recommended. The $80 Ledger Nano S+ is a small cost relative to the position size.
- **Over $10,000:** Hardware wallet is non-negotiable. At this amount, losing your funds to malware is a significant financial event. The friction cost of hardware confirmation is irrelevant.

## Practical Setup for DeFi with a Hardware Wallet

1. Buy directly from Ledger or Trezor official stores — never second-hand
2. Set up a new seed phrase, store it on paper in two separate physical locations (not digitally, ever)
3. Use Ledger with Rabby Wallet for the best DeFi UX (Rabby shows transaction simulations before you sign)
4. Move your main DeFi funds to the hardware wallet address
5. Keep a small hot wallet for gas and small transactions

## One More Thing

No security setup protects against signing a bad transaction. Always:
- Verify the contract address before signing
- Use Rabby's transaction simulation
- Check that the protocol URL is correct
- Never sign transactions from links in Discord or Telegram

The hardware wallet is the last line of defence against your keys being stolen. You are the first line of defence against signing something you shouldn't.

Once you have a wallet set up, read [how to configure Rabby Wallet](/learn/how-to-set-up-rabby-wallet) — it adds transaction simulation on top of your hardware wallet for maximum protection.

---

*This is educational content, not financial advice.*
    `,
  },
  {
    slug: "how-to-set-up-rabby-wallet",
    category: "wallets",
    tag: "Wallets & Security",
    title: "How to Set Up Rabby Wallet for DeFi (2026 Guide)",
    excerpt:
      "Rabby Wallet has a feature MetaMask doesn't: it simulates every transaction before you sign it, showing you exactly what will leave your wallet. Here's how to set it up.",
    date: "2026-04-27",
    readTime: "5 min",
    content: `
## Why Rabby Instead of MetaMask

MetaMask is the default. Rabby is the upgrade. The main reason: **pre-sign transaction simulation**.

Before you confirm any transaction, Rabby shows you exactly what will change in your wallet — tokens leaving, tokens arriving, approvals granted. This single feature has prevented more wallet drains than any other security tool. You can see when a phishing site is trying to drain your USDC before you press confirm.

Other Rabby advantages:
- Multi-chain address display without manually switching networks
- Approval manager (see and revoke all active token approvals)
- ENS + address book support
- Works with Ledger, Trezor, and WalletConnect

## Step-by-Step Setup

**Step 1: Install the extension**

Go to rabby.io and click Download. Available for Chrome, Brave, and other Chromium browsers. Do not install from the Chrome Web Store unless the link comes from rabby.io directly — verify the publisher.

**Step 2: Create a new wallet or import existing**

If you're new to DeFi: create a new wallet. Write down the 12-word seed phrase on paper. Do not store it digitally, screenshot it, or email it to yourself.

If you already have MetaMask: you can import your existing seed phrase. This gives Rabby access to the same addresses.

**Step 3: Connect a hardware wallet (recommended)**

Go to Settings > Add a Hardware Wallet. Connect your Ledger or Trezor and follow the prompts. Your hardware wallet addresses will appear in Rabby and require device confirmation for every transaction.

[Get Ledger Nano X →](https://www.ledger.com) *(affiliate — we earn a commission at no cost to you)*

**Step 4: Set up your approval management**

Go to the Approvals tab. You'll see every token approval you've ever granted to DeFi protocols. Any approval you no longer use is a potential attack surface — revoke it.

Make it a habit: after finishing a DeFi session, open Approvals and revoke anything you don't need permanently.

## Using Rabby Day to Day

When you interact with a DeFi protocol:

1. Click "Sign" or "Confirm" on the site
2. Rabby opens with a transaction preview
3. Read the "What will change" section before clicking anything
4. If you see unexpected tokens leaving your wallet, reject the transaction
5. If everything looks right, confirm

The simulation isn't perfect — highly complex transactions may show partial information — but it catches the overwhelming majority of phishing and malicious approval attacks.

## Switching Between Addresses

One of Rabby's most useful features: you can maintain multiple addresses (hardware wallet, hot wallet, test wallet) and switch between them instantly without changing network settings. For DeFi users who operate across chains, this alone saves significant friction.

For guidance on what to do once your wallet is set up, see [how to build a $10K DeFi yield portfolio](/learn/build-10k-defi-yield-portfolio).

---

*This is educational content, not financial advice.*
    `,
  },

  // ── Yield Strategies ─────────────────────────────────────────────────────────
  {
    slug: "best-usdc-yield-strategies-2026",
    category: "yield-strategies",
    tag: "Yield Strategies",
    title: "Best USDC Yield Strategies in 2026, Ranked by Risk",
    excerpt:
      "Four ways to earn yield on USDC in 2026, from 3.8% at near-zero risk to 15%+ if you're comfortable with LP mechanics. Here's the honest comparison.",
    date: "2026-05-09",
    readTime: "7 min",
    content: `
## The USDC Yield Landscape in 2026

USDC is the stablecoin of choice for yield-focused DeFi investors. It's regulated, backed 1:1 by US dollars, and accepted everywhere. The question isn't whether to hold USDC — it's where.

Here are the main strategies, ordered from lowest to highest risk.

## Strategy 1: Aave Lending (Lowest Risk)

**APY: 3.8–4.2%**

Deposit USDC into Aave v3 on Base or Arbitrum. Earn interest from borrowers. Withdraw any time.

This is the DeFi equivalent of a high-yield savings account. The risk is protocol-level (smart contract exploit) and stablecoin-level (Circle counterparty risk). Both are low but non-zero.

**Who it's for:** Anyone who wants yield without complexity. If you're not sure what you're doing in DeFi, start here.

## Strategy 2: Fluid Lending (Low-Medium Risk)

**APY: 4.6–5.2%**

Same concept as Aave, newer protocol with a more capital-efficient architecture. The extra 1–1.5% comes from higher utilisation across the unified liquidity pool.

Fluid has been running since 2024 without major incident. It's past early-protocol risk but doesn't have Aave's six-year track record.

[Open Fluid →](https://fluid.instadapp.io) *(affiliate — we earn a commission at no cost to you)*

**Who it's for:** DeFi users already comfortable with lending protocols who want to optimise APY.

## Strategy 3: USDC/USDT LP on Uniswap V3 or Orca (Medium Risk)

**APY: 4–8% (base tier), up to 15% during high-volume periods**

Provide liquidity for the USDC/USDT pair. Because both tokens track $1.00, impermanent loss is near-zero. Your yield comes almost entirely from swap fees.

The risk isn't IL — it's the smart contract complexity of a concentrated liquidity position, and the operational risk of your range going stale. If USDT temporarily depegs (it has before, briefly), your position shifts.

**Who it's for:** Yield-focused users comfortable with position management, who understand stablecoin peg risk.

## Strategy 4: USDC in Gauge-Incentivised LP Pools (Higher Risk)

**APY: 10–30%+ (mostly emissions)**

Protocols like Aerodrome offer high APY on USDC pairs by adding token emissions on top of swap fees. The headline number looks great — the sustainable portion is much lower.

If AERO (or whichever emission token) drops 50%, your effective APY halves. These positions need active monitoring and a plan to either auto-sell emissions or hold with conviction.

**Who it's for:** Active DeFi users who understand emissions mechanics, monitor positions regularly, and have an exit plan for the emission token.

## The Allocation That Makes Sense

For a $20,000 USDC position seeking yield:

- $12,000 in Aave (60%) — base, sleep-at-night
- $6,000 in Fluid (30%) — yield optimisation
- $2,000 in USDC/USDT LP on Orca or Uniswap (10%) — fee capture, minimal IL

Blended APY: approximately 4.5–5.2% — comfortably better than CeFi options, with manageable risk across three independent systems.

For a full deployment walkthrough including hardware wallet setup, see [how to build a $10K DeFi yield portfolio](/learn/build-10k-defi-yield-portfolio). For the Aave vs Fluid comparison in detail, read [Aave vs Fluid 2026](/learn/aave-vs-fluid-2026).

---

*This is educational content, not financial advice.*
    `,
  },
  {
    slug: "build-10k-defi-yield-portfolio",
    category: "yield-strategies",
    tag: "Yield Strategies",
    title: "How to Build a $10K DeFi Yield Portfolio From Scratch",
    excerpt:
      "A step-by-step playbook for deploying $10K across staking, lending, and LP positions. Includes specific protocols, expected APY, and the order of operations.",
    date: "2026-05-02",
    readTime: "8 min",
    content: `
## Before You Deploy Anything

Three prerequisites before touching any of the strategies below:

1. **Hardware wallet** — At $10K, you need one. Full stop.
2. **Transaction tracking** — Set up Koinly from day one, not after you've made 50 transactions you can't remember.
3. **Gas reserve** — Keep $20–30 in native gas tokens (ETH on Arbitrum/Base, SOL on Solana) that you never touch for yield.

[Track with Koinly →](https://koinly.io) *(affiliate — we earn a commission at no cost to you)*
[Get Ledger Nano X →](https://www.ledger.com) *(affiliate — we earn a commission at no cost to you)*

## The Portfolio Split

**$5,000 — Stablecoin Lending (50%)**

This is your base. Stable, predictable, liquid.

- $3,000 → Fluid Base USDC (~5.2% APY)
- $2,000 → Aave Arbitrum USDC (~3.8% APY)

Two different protocols, two different chains. If one protocol has an issue, you still have the other. Expected annual yield: ~$210

**$3,000 — ETH/SOL Liquid Staking (30%)**

Assets you're holding anyway, now earning passively.

- $1,500 → stETH via Lido (keep in wallet or deposit into Aave as collateral)
- $1,500 → jitoSOL via Jito (~8% APY on Solana)

Expected annual yield on this tranche: ~$165

**$2,000 — LP Positions (20%)**

Higher effort, higher yield. Start conservative.

- $1,000 → SOL/USDC on Orca (8–12% APY swap fees)
- $1,000 → USDC/USDT on Uniswap V3 Arbitrum (4–8% APY, near-zero IL)

Expected annual yield on this tranche: $100–200

## Total Expected Return

Blended: approximately $475–575/year on $10,000 — 4.75–5.75% APY.

That's not life-changing, but it's materially better than CeFi options, it's non-custodial, and it compounds automatically on the lending side.

## The Order of Operations

Do this in sequence, not all at once:

1. Set up Ledger + Rabby — 30 minutes
2. Set up Koinly and connect your wallet — 15 minutes
3. Bridge USDC to Base (via Across or the official Base bridge) — deploy into Fluid
4. Bridge USDC to Arbitrum — deploy into Aave
5. Buy ETH, stake via Lido, receive stETH
6. Buy SOL, stake via Jito, receive jitoSOL
7. After 1 month of stability, set up the Orca SOL/USDC position
8. After another month, set up the Uniswap USDC/USDT position

The staged approach lets you get comfortable with each protocol before adding complexity.

## Rebalancing Rules

Check your portfolio monthly, not daily. Obsessive monitoring leads to panic decisions.

Rebalance only when:
- APY on a lending position drops more than 2% from entry (worth switching)
- LP position goes out of range and stays out for 3+ days
- A protocol has a security incident or governance red flag

Don't rebalance for small APY movements. Transaction costs and IL from moving positions frequently will destroy the gains.

## What Success Looks Like at 12 Months

Assuming no major market disruption: $10,000 becomes approximately $10,475–$10,575 in yield, plus or minus price appreciation on ETH/SOL components. The yield is real. The price of ETH and SOL may go up or down — that's a separate bet you're making by holding them.

The goal of this portfolio is: **earn a premium over CeFi without taking protocol risk you don't understand**.

Once you're earning yield, read [DeFi tax in Australia](/learn/defi-tax-australia-ato) — know what you'll owe before end of financial year, not after.

---

*This is educational content, not financial advice.*
    `,
  },

  {
    slug: "stable-lp-vs-lending",
    category: "yield-strategies",
    tag: "Yield Strategies",
    title: "Stable LP vs Stable Lending — Where to Park USDC in 2026",
    excerpt:
      "Stable LP pools advertise higher APY than lending — but one bad weekend can wipe out a year of swap fees. Here's the decision tree the PassiveBlocks bot uses, with the 2023 USDC depeg costed in dollars.",
    date: "2026-05-19",
    readTime: "7 min",
    publishedAt: "2026-05-19",
    updatedAt: "2026-05-19",
    content: `
If you have stablecoins on-chain, you have two real choices for yield: **lend them to a money market** (Aave, Fluid, Kamino) or **provide liquidity to a stable pair** (Curve, Aerodrome, Orca).

Most newsletters tell you the LP option earns more. They're right on the headline rate. They're usually wrong on the after-risk return. This article is the decision tree the PassiveBlocks bot uses to pick between the two — with the numbers that matter.

## The honest comparison

Same amount of capital ($1,000 USDC), same time horizon (12 months), as at 2026-05-19:

| Option | Headline APY | After realistic friction | Worst-month risk |
|--------|--------------|---------------------------|-------------------|
| Fluid USDC lending (Arbitrum) | 4.63% | ~4.55% | Protocol exploit (low) |
| Aave USDC lending (Ethereum) | 3.80% | ~3.75% | Protocol exploit (low) |
| Curve USDC/USDT/DAI (stable LP) | 5.20% | ~4.80% | One stable depegs 1% = -0.5% NAV |
| Aerodrome USDC/USDT (stable LP) | 6.50% | ~5.40% | Emissions decay + depeg risk |
| Orca USDC/USDT whirlpool | 7.10% | ~5.20% | Concentrated range = active management |

The LP rows look higher. They are higher — until something moves.

## What you're actually being paid for

**Lending** pays you for taking *protocol risk and rate risk*. The borrower pays interest, the protocol takes a cut, you get the rest. Your USDC is always worth $1. You can withdraw whenever (subject to utilisation).

**Stable LP** pays you for taking *peg risk and impermanent loss risk*. You're providing liquidity for two assets that *should* both be worth $1. As long as they trade at parity, you earn swap fees plus (often) protocol emissions. The moment one of the two stables drifts — even temporarily — the pool rebalances against you, and you've now bought the cheaper stable at the higher price.

Same dollar of yield. Different reasons it shows up. Different reasons it disappears.

## The 2023 USDC depeg, costed

In March 2023, USDC briefly traded at $0.88 after Silicon Valley Bank exposure was revealed. It re-pegged within 72 hours.

If you were lending USDC during that window:
- You held a deposit token that was always denominated 1:1 in USDC.
- You felt nothing in your position value. USDC re-pegged, your balance stayed identical.

If you were LP'ing USDC/USDT during that window:
- The pool rebalanced as arbitrageurs swapped out cheap USDT for cheap USDC.
- You exited the event holding **more USDC and less USDT** — but your *dollar* value was down ~4–6%, and you'd locked in the depeg loss.
- A full year of swap fees (5–6% APY) would have been wiped out by the single weekend.

This is not a hypothetical. It happened. It will happen again to a different stablecoin. The 12-month yield gap between lending and stable LP did not survive one bad weekend.

## When stable LP actually beats lending

LP is the right call in two specific situations:

**1. Battle-tested pairs with peg-defended stables.**
USDC/USDT on Curve or Aerodrome, both stables backed by named issuers (Circle, Tether), with multi-year depeg-recovery history. The LP earns 1–2 percentage points more than lending in normal markets. The depeg risk is real but bounded.

**2. Active concentrated liquidity, large capital.**
Orca and Aerodrome Slipstream let you concentrate liquidity inside a narrow band ($0.998–$1.002). On $50K+, the swap fees compound to genuine yield. On $1K, you're paying gas to rebalance the range more often than the fees pay.

For everyone else — sub-$50K, no time to manage ranges, no appetite for re-pricing a stable mid-week — **lending wins on a risk-adjusted basis.**

## The PassiveBlocks bot's actual allocation

For full transparency, here is how the bot is currently positioned (2026-05-19):

- **Stablecoin lending (Fluid, Arbitrum + Base):** ~99% of stablecoin capital.
- **Stable LPs:** 0%.
- **Volatile LPs (WBTC/WETH range):** small allocation, separate strategy slice.

The bot does not run stable LPs right now. Not because they can't earn — they can — but because at the current capital size the 0.5–1.5pp uplift over Fluid USDC doesn't clear the **depeg-risk premium** the bot prices in. At $50K+, that math changes. At $1K, it doesn't.

That's the rule + receipt: the rule is "LP only when the after-risk return clears lending by 2pp+." The receipt is the allocation above.

## The two-question decision tree

Before you put USDC into anything, answer two questions:

**1. Is the headline APY mostly fees or mostly emissions?**
- Mostly fees → it's earnable yield, sustainable.
- Mostly emissions → it's a marketing budget. Discount it 40–60%.

DeFiLlama shows the split for most pools. If you can't find it, assume emissions until proven otherwise.

**2. Does the position survive a 1% depeg of either stable for 48 hours?**
- Lending → yes, your balance is unchanged.
- Stable LP → no, you've eaten a 0.5–1% NAV hit on that side of the pair.

If you can't accept a stable-depeg drawdown, the only correct answer is lending.

## A note on hardware

If your stablecoin balance is over $5,000 — whether in lending or LP — the gating risk is no longer protocol yield. It's wallet hygiene. A single phishing signature wipes a year of careful yield work.

A hardware wallet (Ledger or Trezor) costs ~$120–$190 once and removes that entire category of loss.

[Get a Ledger Nano X →](https://shop.ledger.com/?r=a6255ec0ba49&tracker=pb_learn_stable_lp_vs_lending) *(affiliate — we earn a commission at no cost to you)*

## The takeaway

Lending earns slightly less and bores you to sleep. Stable LP earns slightly more and asks you to defend two pegs at once. On portfolios under $50K, the bored option wins on after-risk return almost every year.

The PassiveBlocks bot picks the boring option every cycle. That is the strategy, not a missing feature.

---

*This is educational content, not financial advice.*
    `,
  },
  {
    slug: "when-not-to-rebalance",
    category: "yield-strategies",
    tag: "Yield Strategies",
    title: "When NOT to Rebalance — The 3% Buffer Rule",
    excerpt:
      "Every DeFi newsletter tells you to chase the higher yield. Most weeks, the right call is to do nothing. Here's the 3% buffer rule the PassiveBlocks bot lives by — and the math that proves chasing kills yield on small portfolios.",
    date: "2026-05-18",
    readTime: "6 min",
    publishedAt: "2026-05-18",
    updatedAt: "2026-05-18",
    content: `
Every DeFi newsletter tells you to chase the higher yield. Most weeks, the right call is to do nothing.

This article is the rule the PassiveBlocks bot lives by: when a rebalance is worth executing, and — more often — when sitting still is the better trade.

## The headline rule

**Don't rebalance unless the expected gain clears gas plus a 3% buffer.**

That's it. Everything else is implementation detail.

The reason is arithmetic, not opinion. Every rebalance has three costs that compound:

1. **Gas to exit** the current position.
2. **Gas to enter** the new position.
3. **Slippage and tax friction** on each swap inside the move.

On a small position, those costs eat the gain before you've held the new pool for a single day. The 3% buffer is the margin of safety that says: even if the new APY drifts down a percentage point in the first week (it usually does), and even if I'm slightly wrong about the gas estimate, I'm still ahead.

## A worked example on $1,000

Say you're sitting in Fluid USDC at **4.6%** and a new pool advertises **7.0%** on the same asset.

The headline gap looks like a 2.4 percentage point uplift — $24/year on $1,000. Attractive.

Now stack the real costs:

| Cost | Amount |
|------|--------|
| Exit Fluid (gas) | ~$2 |
| Bridge / swap (if cross-chain) | ~$3 |
| Enter new pool (gas) | ~$3 |
| Slippage (0.1%) | ~$1 |
| **Total round-trip cost** | **~$9** |

A $9 cost on a $24/year uplift is a **4.6-month payback**. If the new pool's APY drops by 1.5 percentage points within the first six weeks (extremely common for new pools — see the next section), you never recover the cost.

The 3% buffer rule turns this into a one-line decision: 7.0% − 4.6% = 2.4 percentage points = 2.4% absolute APY gain. **2.4% does not clear the 3% buffer. Hold.**

The bot didn't think about it. It looked at the number and stayed put. That single rule is worth more than most "yield optimisation" engines.

## Why new-pool APYs decay

A pool advertising 7%+ on stablecoin lending today is almost certainly in one of three states:

1. **Emissions-heavy.** The protocol is paying you in its own token to attract TVL. Emissions schedules taper. Within 4–8 weeks the headline number halves.
2. **Low utilisation about to be filled.** A new pool with 30% utilisation looks great on paper, but as borrowers fill the pool, the lender share of the borrow rate kicks in, and the APY normalises down.
3. **Low TVL about to be diluted.** A $2M pool at 7% becomes a $20M pool at 4.5% within weeks if it stays on yield-aggregator dashboards.

In all three cases, the saver who jumped in chasing the headline ate the gas cost and now holds a position with the same APY they had before — minus the round-trip fees.

The 3% buffer prices this in. You don't need to predict which decay path the new pool will take. You just refuse to move unless the gap is wide enough to survive any of them.

## When the 3% buffer doesn't apply

There are three situations where you should rebalance even if the gap is smaller:

**1. The protocol you're in is breaking.** TVL dropping >20% in 24 hours. A peg event. A team announcement. None of these care about gas costs — you exit and ask questions later.

**2. The position is going out of range.** For concentrated liquidity LPs (Uniswap V3, Orca, Aerodrome Slipstream), an out-of-range position earns zero fees. Rebalancing back into range pays for itself within days if the pair has real volume.

**3. Tax harvesting at year-end.** If you're sitting on losses, realising them to offset gains can be worth more than the yield gap. This is jurisdiction-specific — Australian readers, see [DeFi tax in Australia](/learn/tax/defi-tax-australia-ato).

Everything else: hold.

## The capital-size adjustment

The 3% buffer is calibrated for retail-size capital ($1K–$50K). Two adjustments scale it:

- **Sub-$1,000 portfolios:** widen the buffer to **5%**. Gas costs are a higher percentage of small positions; you need more headroom.
- **$100K+ portfolios:** narrow the buffer to **1.5%**. Gas becomes negligible relative to the position, so smaller gaps clear the threshold.

The principle doesn't change. The number does.

## The PassiveBlocks bot, by the numbers

The bot we run for this newsletter has executed its rebalance-check loop every three hours since launch. Recent cycles:

- **Checks run:** ~56 per week.
- **Rebalances executed:** 0 in the last seven weeks.
- **Total gas spent this period:** $0.

Every cycle, the bot compares the current portfolio against the top alternatives across Fluid, Aave, Kamino, Aerodrome, Orca. Every cycle, the gap fails to clear the 3% buffer. So nothing happens.

That's not the bot being lazy. That's the bot being right.

The opportunity cost of *not* chasing emissions yields, the saved gas, and the avoided tax events compound silently. A year of "doing nothing" with this rule has historically beaten a year of active rebalancing on portfolios under $50K.

## The takeaway

If you remember one rule from this article: **the gap has to be wider than 3 percentage points and you have to clear gas, or you don't move.** Not 3% relative. Three percentage points absolute on the APY.

Most weeks, that rule will tell you to sit still. That is the rule working — not failing.

---

*This is educational content, not financial advice.*
    `,
  },

  // ── Tax ──────────────────────────────────────────────────────────────────────
  {
    slug: "defi-tax-australia-ato",
    category: "tax",
    tag: "Tax & Compliance",
    title: "DeFi Tax in Australia: What the ATO Wants to Know",
    excerpt:
      "The ATO treats DeFi yield as ordinary income, LP positions as CGT events, and has data-matching programs running across Australian exchanges. Here's what you need to declare.",
    date: "2026-05-07",
    readTime: "7 min",
    content: `
## The ATO's Position on DeFi

The Australian Taxation Office has issued guidance on crypto since 2014, and updated its position on DeFi specifically. The core principle: **if you receive something of value, it's a taxable event.**

This applies to staking rewards, lending interest, LP fees, and airdrops. It doesn't matter that it's on a blockchain — the ATO sees it as income.

## What Gets Taxed and How

### Staking and Lending Yield

When you receive staking rewards (stETH rebase, jitoSOL appreciation, Aave interest accrual) or lending interest, these are treated as **ordinary income** at the time you receive them.

The taxable amount is the AUD value of the tokens at the moment you receive them.

If you later sell those tokens for more than their income inclusion price, the gain is a **capital gain**. If you hold for 12+ months, the 50% CGT discount applies to the capital gain portion.

**Example:**
- You receive 0.01 ETH as lending interest when ETH = $5,000 AUD. Income: $50.
- Six months later you sell that 0.01 ETH for $75. Capital gain: $25 (discount not applicable — held under 12 months).
- Total tax: assessed on $50 income + $25 capital gain.

### LP Positions

This is where it gets complex. The ATO's position is that:

1. **Entering an LP position** = a disposal of both tokens (CGT event)
2. **Swap fees received** = ordinary income
3. **Exiting the LP position** = a disposal of the tokens you receive back

In practice, this means every time you enter and exit an LP, you're crystallising capital gains or losses on both assets.

[Track with Koinly →](https://koinly.io) *(affiliate — we earn a commission at no cost to you)*

### The 12-Month CGT Discount

If you hold an asset for more than 12 months before disposal, you only pay CGT on 50% of the gain. This is one of the most valuable tax strategies for DeFi investors:

- Hold ETH/SOL/BTC for 12+ months before selling
- Use lending yield (stETH, etc.) rather than active trading to generate income
- Consider tax lot timing when deciding which positions to unwind

## The Data-Matching Problem

The ATO runs data-matching programs with Australian exchanges (CoinSpot, Independent Reserve, Coinbase AU, etc.). If you've used an Australian exchange and received more than $10,000 in crypto, the ATO likely has your records.

On-chain DeFi transactions are harder for them to track, but not impossible. Blockchain analytics firms sell services to tax authorities globally. Assume your on-chain activity is not private.

## What You Need to Track

For every financial year:
- All crypto received (staking, lending, airdrops) — date, AUD value
- All disposals (sales, LP entries/exits, token swaps) — date, AUD value in, AUD value out
- Opening and closing portfolio value in AUD

The simplest way to do this: connect all your wallets to Koinly from the start and let it classify transactions automatically. Review and correct its classifications — it gets most things right but sometimes misclassifies DeFi interactions.

## The Honest Summary

DeFi yield is taxable in Australia. The ATO is not lenient on crypto. The best strategy is meticulous record-keeping from the start and a tax accountant familiar with crypto for complex situations.

The 12-month CGT discount is real and worth planning around. Ordinary income from yield cannot be avoided — it's taxed when earned.

For the mechanics of tracking this: [how to use Koinly for DeFi transactions](/learn/track-defi-transactions-koinly). For the yield strategies that generate this income: [best USDC yield strategies 2026](/learn/best-usdc-yield-strategies-2026).

---

*This is educational content, not tax advice. Consult a registered tax agent for your specific situation.*
    `,
  },
  {
    slug: "track-defi-transactions-koinly",
    category: "tax",
    tag: "Tax & Compliance",
    title: "How to Track DeFi Transactions with Koinly",
    excerpt:
      "Koinly connects directly to your wallet addresses and classifies DeFi transactions automatically. Here's how to set it up properly so your tax report is accurate.",
    date: "2026-04-25",
    readTime: "5 min",
    content: `
## Why Transaction Tracking Matters

DeFi generates a lot of taxable events. Every time you receive staking rewards, every time you enter or exit an LP, every token swap — these are all potentially taxable. If you wait until July to figure it out from memory, you'll miss things, get values wrong, and file inaccurately.

The solution is a crypto tax tool that pulls directly from the blockchain. Koinly is the best option for Australian DeFi users — it supports AUD tax year (July–June), has good ATO-compatible report formats, and handles DeFi transactions reasonably well.

[Track with Koinly →](https://koinly.io) *(affiliate — we earn a commission at no cost to you)*

## Step-by-Step Setup

**Step 1: Create a Koinly account**

Go to koinly.io, create an account. Select Australia as your country and AUD as your currency. Set your tax year to July–June (Australian financial year).

**Step 2: Add your wallet addresses**

Go to Wallets > Add Wallet. Search for each chain you use:
- Ethereum / Arbitrum / Base — paste your 0x address
- Solana — paste your wallet address

Koinly will import your full transaction history from each chain automatically. This can take 5–15 minutes for wallets with long histories.

**Step 3: Review auto-classifications**

Koinly automatically tries to classify each transaction: buy, sell, staking reward, LP in/out, swap, etc. Review the transactions it flagged as "needs review" — these are usually complex DeFi interactions it couldn't classify confidently.

Common ones to fix:
- LP entries/exits — make sure both legs are captured
- Airdrop classifications
- Reward claims vs principal withdrawals

**Step 4: Set cost basis method**

Go to Settings > Tax Settings. Select your cost basis method. For most Australian investors: First In First Out (FIFO) is the standard, but Optimised (Koinly's method) is worth considering as it can reduce your CGT liability by matching disposals against higher-cost lots. Discuss with your accountant which method to use before generating reports.

**Step 5: Generate your tax report**

Go to Reports > Australian Tax Report. This generates the schedules you need:
- Capital gains summary
- Income summary (staking, yield, airdrops)
- CGT worksheet for your accountant

## What Koinly Gets Right and Wrong

**Gets right:**
- Basic wallet imports and price lookups
- Simple swaps and CEX transactions
- Staking reward classification on major protocols

**Gets wrong (check manually):**
- Complex multi-step DeFi transactions (it sometimes splits these incorrectly)
- New protocols it hasn't seen before
- LP positions with impermanent loss calculations (it sometimes misses the IL component)

Budget 2–3 hours to review and correct classifications before you run your final report. Do this before 30 June, not after.

## The One Thing That Saves The Most Time

Add your wallet addresses to Koinly the same week you start using DeFi — not after a year of transactions. Importing a clean history is trivial. Reconstructing a year of DeFi activity from memory is painful.

For a full overview of what the ATO expects from DeFi investors, read [DeFi tax in Australia](/learn/defi-tax-australia-ato).

---

*This is educational content, not tax advice. Consult a registered tax agent for your specific situation.*
    `,
  },
];

export function getLearnArticle(slug: string): LearnArticle | undefined {
  return LEARN_ARTICLES.find((a) => a.slug === slug);
}

export function getLearnCategory(id: string): LearnCategory | undefined {
  return LEARN_CATEGORIES.find((c) => c.id === id);
}

export function getArticlesByCategory(categoryId: string): LearnArticle[] {
  return LEARN_ARTICLES.filter((a) => a.category === categoryId);
}
