# Where does DeFi yield actually come from? (If you can't name who's paying you, you are)

A leaderboard says a pool pays **18% APY**. Your savings account pays 2.8%. The gap is so large that the first question most people ask is "is it a scam?" — which is the wrong question. The right one is simpler and almost nobody asks it: **who is paying me, and why?**

Every yield on earth — TradFi or DeFi — is someone else's cost. A bank pays you 2.8% because it lends your deposit to a borrower at 7% and keeps the spread. There is always a payer. In DeFi the payer is just less hidden, if you know where to look. There are only three of them. Once you can name which one is funding your APY, you can tell durable yield from a countdown timer.

## Source 1 — A borrower is paying interest

This is lending: Aave, Fluid, Morpho, Kamino. You deposit USDC, someone borrows it and pays interest, and that interest — minus a protocol cut (the [reserve factor](https://passiveblocks.io/learn/reserve-factor)) — is your yield.

You can name the payer: it's the borrower. You can check the payer's appetite, too — that's the [utilisation rate](https://passiveblocks.io/learn/utilisation-rate) (how much of the pool is actually borrowed) and the [kink model](https://passiveblocks.io/learn/kink-interest-models) (how fast the rate rises as the pool empties). This is the most boring and the most honest source of yield, because it's backed by a real obligation: someone owes the pool money and is paying to keep it.

**Rule of thumb:** if the lending rate is 5% and stable, a real borrower is paying for it. That's a number you can trust.

## Source 2 — A trader is paying fees

This is liquidity provision: Uniswap V3, Aerodrome, Orca. You supply two assets to a pool, traders swap against it, and they pay a fee on every swap. Those fees are your yield.

The payer here is the trader, and the yield scales with *volume* — a pool that turns over its entire value in fees every few days is paying you real money, not emissions. The catch is that being the market-maker exposes you to [impermanent loss](https://passiveblocks.io/learn/impermanent-loss): if the two assets move apart in price, the pool rebalances against you. On a stablecoin pair that risk is small; on a volatile pair it can quietly outrun the fees.

**Rule of thumb:** if the fee yield comes from genuine swap volume, you can name the payer. If you can't find the volume, the "fees" are probably the third source wearing a disguise.

## Source 3 — A token printer is paying you (this is the dangerous one)

This is emissions. The protocol prints its own reward token and hands it to you to attract deposits. The APY is real *today* — but no borrower and no trader is funding it. **You are being paid in freshly minted supply, and someone has to sell it.**

That's why emissions yields decay. The headline rate is front-loaded and the token price drifts down as recipients dump it — a [40% APY that's really a three-week number](https://passiveblocks.io/learn/annualised-apy-trap). Emissions aren't automatically a scam; early protocols use them to bootstrap real usage. But if emissions are the *only* source, the yield is a countdown, not an income. The moment you can't name a borrower or a trader paying you, the payer is you — in the form of a token quietly losing value in your wallet, or unpriced risk you haven't noticed yet.

## The one-line filter

Before you deposit anything, ask: **who is paying me — a borrower, a trader, or a printer?**

| Source | Payer | Durable? |
|---|---|---|
| Lending | Borrower (interest) | Yes — backed by a real obligation |
| LP fees | Trader (swap fees) | Yes — if real volume exists |
| Emissions | Token printer (new supply) | No — a countdown, not an income |

If you can name a borrower or a trader, the yield has a real source. If the only answer is "the protocol's token," you've found the payer — and it's you.

## How the bot treats it

PassiveBlocks scores every pool on source first, rate second. A 5% rate backed by a borrower outranks an 18% rate backed only by emissions, every time — because one is income and the other is a position you have to exit before the music stops. That's why the bot's book sits in plain single-asset lending: it's the source we can name and check on any given day.

## Keep your keys where the yield lands

Once you're earning from a real source, the only job left is not losing the principal to a compromised signing key. Keep the key that approves transactions on a device that never touches the internet — a hardware wallet does exactly that. → **[Get a Trezor here](https://affiliate.trezor.io/publisher/#!/offer/133)** *(affiliate — we earn a commission if you sign up, at no cost to you)*

---

## Name the payer, then size the position

Yield isn't magic and it isn't free — it's a transfer from a borrower, a trader, or a printer to you. The first two are income. The third is a timer. PassiveBlocks tells you which is which, every week, and only flags the pools worth your gas:

→ **[Subscribe to PassiveBlocks](https://passiveblocks.io)**

Pairs with [the four numbers that explain any DeFi yield](https://passiveblocks.io/learn/four-numbers-defi-yield) and [why a 40% APY can be a 3-week number](https://passiveblocks.io/learn/annualised-apy-trap).

**Earn more — PassiveBlocks**

*Last updated: 2026-06-23*
