# What is DeFi Yield? A Plain-English Guide for Crypto Holders

*URL: passiveblocks.io/learn/what-is-defi-yield*
*Last updated: 2026-05-13*

---

If you have USDC sitting in a Coinbase account earning 2.8%, you are already doing yield. You're just doing it at the worst available rate.

DeFi — decentralised finance — is a set of financial services that run on blockchains instead of banks. No middlemen. No business hours. No account minimums beyond gas fees. The same lending, borrowing, and trading that banks have done for decades, minus the margin a bank keeps for itself.

The result: rates that are 2–4x what a traditional savings account pays, accessible to anyone with a crypto wallet and $100 to start.

Here is how it actually works.

---

## What "yield" means in DeFi

In traditional finance, yield is the return your money earns while it sits somewhere. A savings account earns yield. A bond earns yield. A rental property earns yield.

In DeFi, yield comes from the same underlying activities — lending and trading — but the flow of money is different. Smart contracts (self-executing code on a blockchain) handle the matching, the collateral, and the payouts automatically. There is no loan officer approving your deposit. The contract does it.

The yield is real because there is a real counterparty: a borrower paying interest, or a trader paying a swap fee. If you cannot identify who is paying the yield, treat it with suspicion.

---

## The three main ways to earn

### 1. Lending — the starting point for most people

You deposit a stablecoin (USDC, USDT) or a blue-chip asset (ETH, WBTC) into a lending protocol. Borrowers lock up overcollateralised positions and borrow from your pool. You earn a portion of the interest they pay.

**Real example:** $10,000 USDC deposited on Aave v3 on Arbitrum at 3.8–4.2% APY earns roughly $380–$420 per year. No lockup period. Withdraw whenever you want. The rate moves with demand — when borrowing activity goes up, your rate goes up.

Protocols worth knowing: **Aave** (the largest, live since 2020, billions in TVL) and **Fluid** (newer, cleaner UX, typically 40–80 basis points higher than Aave on USDC right now).

No impermanent loss. No active management required. This is the right first position.

### 2. Liquidity provision — earn trading fees

Every time someone swaps tokens on a decentralised exchange (DEX), they pay a fee — typically 0.01% to 1% of the trade. That fee goes to the people who supplied the liquidity to the pool.

**Real example:** $10,000 split between USDC and WETH in a concentrated range on Orca (Solana) during a high-volume week can generate 8–12% APY in fees. That is not a projection — it reflects real swap volume on a liquid pair.

The catch is **impermanent loss**: if the price ratio between your two assets changes significantly, you end up worse off than if you had just held. More on this below.

Protocols worth knowing: **Uniswap V3** (Arbitrum/Base), **Aerodrome** (Base), **Orca** (Solana).

### 3. Staking — earn for securing the network

If you hold ETH, you can stake it to help validate Ethereum transactions and earn protocol rewards. Current rate: roughly 3–4% APY. The return is denominated in ETH — you earn more ETH, not USDC.

**Real example:** $10,000 in ETH staked via Lido earns approximately $350/year in ETH terms. During a bull market when ETH appreciates, the dollar value of your return compounds. During a bear market, your ETH balance grows but the dollar value might fall.

Liquid staking (stETH, rETH) lets you receive a tradeable token representing your staked ETH — so you keep flexibility while still earning.

---

## What is the catch?

Honest answer: there are three real risks, and none of them are zero.

**Smart contract risk.** The code might have a bug. Even audited protocols have been exploited. The longer a protocol has run with real capital and no incident, the more confidence is warranted. Aave has been live since 2020 with billions at stake. That track record means something.

**Impermanent loss.** Specific to LP positions. If you provide $500 USDC + $500 ETH and ETH doubles, you withdraw less than if you had held. The fee income may or may not cover it depending on the pair and the volume. Stablecoin pairs (USDC/USDT) have near-zero IL. Volatile pairs (ETH/BTC) can have meaningful IL during large price moves.

**Gas fees.** Every on-chain transaction costs gas. On Ethereum mainnet, a single deposit can cost $10–$30. On Arbitrum or Base, the same transaction costs $0.10–$0.50. On Solana, it's effectively free. At $500 deployed capital, gas can eat a significant percentage of your first year's yield. The practical minimum to make it worth it: $1,000 on L2s, $5,000+ on mainnet.

---

## How to start with $500

This is the beginner-friendly path. No leverage. No LP. No Solana wallet required.

**Step 1 — Get USDC onto Arbitrum.**
Buy USDC on Coinbase (or any exchange that supports Arbitrum withdrawals). Withdraw directly to Arbitrum — skip the bridging step. Transfer takes 5–10 minutes.

**Step 2 — Get a wallet.**
Install MetaMask or Rabby wallet. Add the Arbitrum network. This is free and takes 5 minutes.

**Step 3 — Connect to Fluid or Aave.**
Go to [fluid.instadapp.io](https://fluid.instadapp.io) or [app.aave.com](https://app.aave.com). Connect your wallet. Deposit your USDC. Current rates: 4–5.2% APY on Fluid, 3.8–4.2% on Aave.

**Step 4 — Do nothing.**
Interest accrues every block. You do not need to claim it manually. Your balance grows automatically. Check it weekly if you like, but there is nothing to do.

**Realistic outcome:** $500 at 5% APY earns $25/year. Not life-changing, but it is real yield with no effort, and the skills you build here — wallet management, protocol navigation, on-chain mechanics — scale directly to a $50,000 position.

---

For weekly yield picks, bot diary updates, and protocol analysis, subscribe to the PassiveBlocks newsletter. Free. No spam. Unsubscribe anytime.

*Earn more — PassiveBlocks*
