# Not all stablecoins are stable — the three ways a $1 token can wake up at 90c

Every stablecoin makes the same promise: one token, one dollar, forever. They print the same number on the tin. But "stablecoin" is a *goal*, not a *guarantee* — and three completely different machines sit behind that goal. Each one breaks in a different way. If you're parking USDC to earn 5% lending yield, the thing actually holding your principal at $1 isn't the ticker — it's the collateral model underneath it. Here's how to read it in 60 seconds.

## Model 1 — Fiat-backed (USDC, USDT)

The simplest machine. For every token in circulation, the issuer claims to hold a real dollar — or a short-dated US Treasury bill — in a bank account. You redeem a token, they hand you a dollar from reserves. The peg holds because there's something boring and liquid backing each unit.

**How it breaks:** counterparty risk. The dollars are off-chain, in banks you can't see. In March 2023, USDC briefly fell to ~88c over a single weekend — not because the code failed, but because $3.3B of its reserves were stuck in the collapsing Silicon Valley Bank. It repegged once the deposits were confirmed safe, but anyone who panic-sold at 88c realised a real loss. The lesson: fiat-backed means you're trusting a bank and an issuer, not just a smart contract.

**What to check:** are the reserves in cash and T-bills (good), or in riskier commercial paper (worse)? Is there a recent attestation? USDC publishes monthly reserve reports; that transparency is why the bot prefers it.

## Model 2 — Over-collateralised crypto (DAI)

No bank. Instead you lock up *more* crypto than the stablecoin you mint — deposit $150 of ETH, borrow $100 of DAI. The extra $50 is the buffer that absorbs price swings in the collateral. If ETH falls, the position gets liquidated before the backing drops below $1.

**How it breaks:** the collateral crashes faster than liquidations can clear, or the collateral is itself another stablecoin that depegs (DAI has leaned heavily on USDC at times — so it inherits USDC's bank risk through the back door). It's more transparent than fiat-backed — you can verify the collateral on-chain — but it's only as safe as the assets locked up and the [oracle](https://passiveblocks.io/learn/oracle-risk) feeding it prices.

**What to check:** what's the collateral, and how much over-collateralisation is there? Crypto-backed by blue-chip assets at 150%+ is robust. Crypto-backed largely by *other* stablecoins is a chain of promises.

## Model 3 — Algorithmic (the graveyard)

No bank, no locked collateral. The peg is held by code and incentives — a second "balancer" token you can always swap for $1 of the stablecoin, arbitrage closing the gap. On paper it's elegant. In practice it's a confidence trick that works right up until it doesn't.

**How it breaks:** a bank run. In May 2022, UST (Terra) lost its peg and its balancer token, LUNA, went from $80 to fractions of a cent in days, vaporising ~$40B. The mechanism that was supposed to defend the peg printed the balancer token into oblivion trying to. There was nothing underneath. **An algorithmic stablecoin yield isn't yield — it's [emissions](https://passiveblocks.io/learn/source-of-yield) wearing a peg, and you are funding it.**

**What to check:** is there real, redeemable collateral, or just a second token and a prayer? If the answer is "the protocol's own token holds the peg," walk.

## The one-line filter

Before you trust any $1 token with your principal, ask: **what holds this peg — a bank, locked crypto, or a promise?**

| Model | Backing | How it breaks | Example |
|---|---|---|---|
| Fiat-backed | Dollars / T-bills in a bank | Bank or issuer fails | USDC (~88c, Mar 2023) |
| Over-collateralised | Excess crypto locked on-chain | Collateral crashes / inherited depeg | DAI |
| Algorithmic | A second token + arbitrage | Bank run, no floor | UST (→ ~0, May 2022) |

Same $1 label. Three completely different ways to wake up at 90c — or zero.

## How the bot treats it

PassiveBlocks only lends in fiat-backed stablecoins with transparent, T-bill-heavy reserves, and treats a depeg below $0.995 as an automatic exit signal. A 9% yield on an algorithmic stablecoin and a 5% yield on USDC are not the same trade with different numbers — they're a bet on a token's survival versus a loan backed by Treasuries. We score the peg model first, the rate second. Boring is the point: the safest yield is the one where you can name what's holding the dollar.

## Keep the keys off the internet

Picking a sound stablecoin protects you from a depeg. It does nothing if the key that approves your transactions is sitting on a laptop that gets phished. Keep the signing key on a device that never connects — that's the entire job of a hardware wallet. → **[Get a Trezor here](https://affiliate.trezor.io/publisher/#!/offer/133)** *(affiliate — we earn a commission if you sign up, at no cost to you)*

---

## Read the peg before you chase the rate

A stablecoin is a goal, not a guarantee. The yield on top of it is only as safe as the dollar underneath it. PassiveBlocks checks the collateral model before it checks the APY — and tells you which pools are worth your gas every week:

→ **[Subscribe to PassiveBlocks](https://passiveblocks.io)**

Pairs with [where DeFi yield actually comes from](https://passiveblocks.io/learn/source-of-yield) and [how DeFi hacks actually happen](https://passiveblocks.io/learn/oracle-risk).

**Earn more — PassiveBlocks**

*Last updated: 2026-06-25*
