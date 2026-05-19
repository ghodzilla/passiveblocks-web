# How to bridge from a CEX to Base — the step-by-step that actually works in 2026

You've decided to move some USDC into a DeFi lending pool on Base for the rate gap. Maybe Fluid at 5.2% versus your exchange paying 2.8%. The yield math is obvious. The bridging part is where everyone gets stuck.

This guide walks the exact path from a centralised exchange (Coinbase, Binance, Kraken) to a wallet on Base — the cheapest, most boring route. No third-party bridges. No "swap-and-hope." 15 minutes start to finish.

## Why Base, and why directly from the exchange

Base is Coinbase's Ethereum Layer 2. Lower fees than Ethereum mainnet (cents instead of dollars), faster confirmations, and — crucially — Coinbase lets you withdraw USDC and ETH **directly to Base for zero fee**. That's the trick most guides miss. You don't need a bridge protocol. The exchange is the bridge.

If you're starting from Binance or Kraken, the path is one extra step (withdraw to Ethereum or Arbitrum, then bridge to Base) — covered at the end.

## What you need before you start

- A self-custody wallet that supports Base. **[Rabby](https://rabby.io)** is the cleanest choice in 2026 — browser extension, no fees, shows you exactly what you're signing.
- A Coinbase / Binance / Kraken account with USDC in it.
- 15 minutes.
- A hardware wallet if your position will exceed $5K. **[Ledger Nano X](https://shop.ledger.com/?r=a6255ec0ba49&tracker=pb_learn_bridge)** *(affiliate link — we earn a commission, costs you nothing)*. Below $5K, a hot wallet is fine.

## Step 1 — Set up your Base wallet (5 minutes)

1. Install Rabby from rabby.io. Ignore every "alternative" site — there are scam clones.
2. Create a new wallet. Write down the 12-word seed phrase on paper. Not a screenshot. Not iCloud notes. Paper.
3. Open Rabby. Click the network dropdown (top of the wallet). Select **Base** from the list. If you don't see it, click "Add Network" and Rabby will pull it from chainlist.org automatically.
4. Copy your wallet address. It starts with `0x`. This is the address you'll send USDC to.

## Step 2 — Send a $1 test transaction (the rule that's saved more money than any other)

Never send your full position on the first transaction. Ever.

1. Go to Coinbase. Click **Send & Receive → Send**.
2. Pick USDC.
3. Amount: **$1.00**.
4. Network: select **Base**. (This is the magic step — if you pick "Ethereum" instead, you'll pay $5-15 in gas. Pick Base.)
5. Address: paste your Rabby address.
6. Confirm.

Within 30 seconds, $1 USDC should land in Rabby on Base. If it doesn't, you have the wrong address or the wrong network. Sort that out before you send the real amount.

## Step 3 — Send the rest

Same flow as Step 2. Same network (Base). Same address. Whatever amount you want to deploy.

Coinbase charges zero withdrawal fee on USDC to Base. Binance charges around $0.50. Kraken charges $1. Cheap.

## Step 4 — Get a tiny amount of ETH for gas

DeFi protocols on Base need ETH to pay for transactions. Not USDC — ETH. Around 0.001 ETH (~$2-3) is plenty for a year of typical use.

Same flow: Coinbase → Send → ETH → Network: Base → 0.001 ETH → your Rabby address.

This is the step everyone forgets. You'll go to deposit into a lending pool, and the transaction will fail because you have $5,000 USDC and zero ETH for gas. Send the ETH first.

## Step 5 — Deposit into a yield protocol

You're now on Base with USDC and a small ETH buffer. From here, the world is open:

- **[Fluid](https://fluid.instadapp.io)** — single-asset USDC lending, currently around 5% (always check the live rate)
- **[Aave](https://app.aave.com)** — same idea, slightly lower rate, deeper liquidity
- **[Aerodrome](https://aerodrome.finance)** — LP positions if you understand impermanent loss

Connect Rabby. Approve USDC (one-time transaction, costs ~$0.05 in gas on Base). Deposit. Done.

## If you're starting from Binance or Kraken

These exchanges don't support direct withdrawal to Base. Two paths:

**Option A — Withdraw to Ethereum, then bridge.** Expensive. ETH mainnet gas can be $10-30. Avoid for amounts under $1,000.

**Option B — Withdraw to Arbitrum, then bridge to Base.** Both Binance and Kraken support USDC withdrawals to Arbitrum cheaply. From Arbitrum, use the official **[Across Bridge](https://app.across.to)** to move USDC to Base. Total cost: under $1. Total time: 5 minutes.

If you're going to be in DeFi often, open a Coinbase account just for the free Base withdrawals. It pays for itself the first time you move money.

## The mistakes to avoid

1. **Sending USDC over Ethereum to a Base address.** Funds aren't lost — they're stuck on Ethereum until you bridge them yourself. Annoying and expensive. Pick Base when withdrawing.
2. **Forgetting ETH for gas.** Send $2-3 of ETH alongside your USDC. You'll thank yourself.
3. **Skipping the $1 test.** A $1 test costs nothing and confirms the entire pipeline works before you commit real capital.
4. **Using random "bridge" sites.** Stick to Across, official protocol bridges, or the exchange itself. Phishing bridges have drained millions.

## The bottom line

Moving from a CEX to a DeFi yield pool on Base takes 15 minutes and the difference is real money — every $10,000 sitting on Coinbase USDC instead of Fluid is roughly $220 a year of yield you're walking away from.

Do the test transaction. Send the ETH. Then send the rest.

---

**Want this kind of breakdown every Friday?** Subscribe to PassiveBlocks — one email a week, the best stablecoin yields, the risks worth knowing, and the bot doing it in real time. No moon emojis.

*— PassiveBlocks*
