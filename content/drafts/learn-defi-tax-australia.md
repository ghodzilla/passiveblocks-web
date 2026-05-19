# DeFi Tax in Australia: What You Actually Need to Know

*Last updated: 2026-05-17 — General information, not tax advice. Talk to a registered tax agent for your specific situation.*

If you're earning DeFi yield from Australia, the ATO already knows. Every CEX with an AUSTRAC license reports your withdrawals. Every on-ramp logs your wallet. The question isn't whether you'll pay tax — it's whether you'll pay the right amount, on time, with records that survive an audit.

Here's the version that actually matters for someone running yield positions on Aave, Fluid, Orca, or Kamino.

## The two tax events you can't avoid

In Australia, the ATO treats crypto as a CGT asset (capital gains tax) **and** treats yield as ordinary income. Every move you make falls into one or the other.

**Event 1 — Capital Gains Tax (CGT).** Triggered when you dispose of a crypto asset. Disposal includes selling for AUD, swapping one token for another, paying in crypto, or **moving across chains via a bridge that swaps tokens**.

**Event 2 — Ordinary income.** Triggered when you receive yield, rewards, airdrops, or fees. Valued in AUD at the moment you received it.

The trap most DeFi users fall into: they think only the final AUD withdrawal is taxable. The ATO doesn't see it that way. Every swap, every rebalance, every claim is its own event.

## How yield is taxed (and what counts as "yield")

If you deposit USDC into Fluid and earn 4.6% APY, every interest payment is **ordinary income** at the AUD value when received. Same for:

- Lending interest (Aave, Fluid, Morpho, Kamino)
- LP fees claimed (Uniswap V3, Orca, Aerodrome)
- Staking rewards
- Gauge / boost rewards (AERO, ORCA, KMNO emissions)
- Airdrops, if received in connection with activity

**The number you record:** AUD value at the moment of receipt, even if you didn't sell. If you claim $50 worth of fees on a Tuesday at 11am, that's $50 of income on that date — regardless of what the price does after.

## How rebalances trigger CGT

This is the one that catches everyone. Every time the bot — or you — moves capital between assets, the ATO treats it as a disposal of the old asset and acquisition of a new one.

**Example:** You hold $1,000 of USDC on Fluid Arbitrum, earning 4.6%. You bridge to Solana and swap into Kamino USDC because rates are better.

That's *technically* not a CGT event if both legs are USDC and the bridge doesn't swap underlying assets. But if any leg involves a swap — for example, your bridge converts USDC → USDC.e → USDC, or you swap into a different stablecoin like USDS — each swap is a disposal.

**Worked numbers:**
- Bought 1 ETH at $3,000 AUD → cost base $3,000
- Six months later, swapped 1 ETH for $4,200 AUD of USDC
- Capital gain: $1,200, held under 12 months → taxed at full marginal rate
- If held over 12 months: 50% CGT discount applies → only $600 taxable

This is why the bot's 24h cooldown + 5% improvement threshold isn't just about gas. It's also about not stacking taxable events on a portfolio that doesn't need them.

## The records you have to keep

The ATO expects records for **every disposal and every income event**, kept for **5 years** from the date you lodge the return that includes it.

For each event, you need:

- Date and time (UTC is fine)
- Wallet addresses involved (yours, and the counterparty contract)
- AUD value at the time
- Transaction hash
- Type of event (income, swap, bridge, etc.)
- Cost base for CGT items (what you paid in AUD originally)

Spreadsheet works. But once you're past 50 transactions a year — which is one rebalance every two weeks — you'll spend more time tracking than earning. That's what crypto tax software exists for.

## Self-custody is not a tax dodge — but it is an audit defence

A hardware wallet doesn't change the tax you owe. It does change how easy it is to prove what you did.

The ATO's biggest audit weapon is the data they get from exchanges — KYC + every withdrawal. What they *don't* see clearly is what happened after the asset left the exchange. If you can produce a clean record of your on-chain activity (tx hashes, dates, AUD values), an audit is a paperwork exercise. If you can't, the ATO assumes the worst.

Two practical moves:

1. **Move long-term holdings off the exchange** to a hardware wallet you control. Reduces the surface area for exchange-side liquidations and proves you're holding (not trading).
2. **Keep your DeFi activity wallet separate from your long-term hold wallet.** Easier to reconcile income vs holding at year-end.

The wallet itself isn't the point — the *separation* is. One wallet for capital you're earning yield on, one wallet for capital you're holding for 12+ months to qualify for the CGT discount.

A Trezor Safe 3 or Safe 5 is the cheapest version of this. ~$120–$220 AUD, one-time, supports the chains DeFi runs on.

→ **[Get a Trezor here](https://affiliate.trezor.io/publisher/#!/offer/133)** *(affiliate link — we earn a small commission at no cost to you)*

## What changed for 2026–27

The ATO didn't change its crypto stance materially this year, but the brackets did. From 2026-07-01:

- 0% up to $18,200
- 15% from $18,201 to $135,000
- 30% from $135,001 to $190,000
- 37% from $190,001 to $250,000
- 45% above $250,000

If your DeFi income pushes you into a higher bracket, that incremental yield is taxed at the new bracket — not your average rate. Worth modelling if you're close to a threshold.

The 12-month CGT discount (50%) is unchanged.

## The five things to do this week

1. **Export your transaction history** from every CEX and every wallet you used in 2025–26.
2. **Tag your wallets** — yield/active vs hold — and stop mixing them.
3. **Pick crypto tax software** *or* commit to a clean spreadsheet. Don't half-do both.
4. **Move long-term holdings off the exchange** to a hardware wallet. Separate the active from the held.
5. **Talk to a tax agent** if your DeFi activity crosses $10K in income or you have positions you've held over 12 months. The 50% CGT discount alone usually pays for the appointment.

---

## Subscribe to PassiveBlocks

We track DeFi yields, protocol risk, and the boring numbers that actually matter — every Friday.

→ **[Subscribe to The PassiveBlocks Newsletter](https://passiveblocks.io)** *(free)*

*Earn more — PassiveBlocks*
