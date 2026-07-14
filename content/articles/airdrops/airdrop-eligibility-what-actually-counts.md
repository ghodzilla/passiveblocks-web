---
title: "Airdrop Eligibility: What Protocols Actually Look For"
pillar: "airdrops"
excerpt: "Eligibility isn't random. Protocols use consistent signals to distinguish genuine early users from farm wallets. Understanding those signals is the difference between qualifying and getting excluded."
date: "2026-07-14"
readTime: "7 min"
sources:
  - label: "Uniswap — UNI governance token announcement (Sep 2020)"
    url: "https://uniswap.org/blog/uni"
  - label: "Arbitrum — ARB airdrop criteria and announcement (Mar 2023)"
    url: "https://docs.arbitrum.foundation/airdrop-eligibility-distribution"
  - label: "Optimism — OP token distribution overview"
    url: "https://community.optimism.io/docs/governance/allocations/"
---

## Why eligibility isn't just "did you use it"

Every major airdrop in recent years has disappointed some users who expected to qualify and didn't. The reasons are usually the same: the distribution formula was more selective than it appeared, or the user's behaviour triggered sybil detection and they were excluded.

Understanding what protocols actually measure helps you focus effort on activities that count — and avoid the patterns that get wallets removed from distribution lists.

---

## What the major historical airdrops actually rewarded

### Uniswap (UNI) — September 2020

Uniswap's 2020 airdrop is the most studied because it was the first major retroactive distribution. Every wallet that had any interaction with Uniswap — swaps, liquidity provision, even failed transactions — before the September 2020 snapshot received 400 UNI tokens.

The eligibility criteria were binary: any interaction before the snapshot date, and you qualified. That simplicity was by design — Uniswap wanted to reward the widest possible user base.

The lesson that everyone drew: even minimal genuine interaction counted. The only hard gate was the snapshot date — wallets that used Uniswap before September 2020 qualified regardless of which other protocols they used. Wallets that hadn't interacted before the snapshot received nothing, regardless of subsequent activity.

### Arbitrum (ARB) — March 2023

Arbitrum's distribution was more sophisticated. Eligibility was tiered based on a points system covering:

- Transaction count (with diminishing returns — doing 100 transactions worth more than 10, but not 10x more)
- Time period covered by transactions (wallets active over multiple months scored higher than those crammed into one week)
- Dollar value of transactions
- Number of distinct smart contracts interacted with
- Provision of liquidity

The scoring produced tiers with different allocation sizes. Wallets with diverse, sustained activity over months received significantly more than wallets with high transaction counts but compressed timing.

Sybil detection removed wallets that appeared to be part of coordinated farms — clusters funding from the same source, wallets with identical transaction patterns, wallets with no activity other than the minimum needed to qualify.

### Optimism (OP) — 2022, multiple rounds

Optimism used a cross-category approach for its initial distribution: active governance participants, Gitcoin donors, early users of specific protocols built on Optimism, and users bridging early. Each category had a separate allocation.

The multicategory approach rewarded breadth of engagement — people who governed, donated, built, and used — not just the people with the highest transaction volume.

---

## The signals that actually determine tier placement

Drawing from the patterns across these and other distributions:

**Transaction count and diversity:** Raw transaction count matters, but diminishing returns kick in early. Protocols care more about whether you used different features (swap, provide liquidity, borrow, vote) than whether you repeated the same action many times.

**Time span:** Consistent activity over months signals genuine interest. A burst of activity in the week before a snapshot often triggers flags. Most scoring algorithms apply a recency and duration weighting.

**Liquidity provision:** Providing liquidity consistently scores higher than just swapping, because it represents more committed capital and deeper ecosystem participation.

**Governance participation:** For protocols with governance (voting on proposals, even simple ones), participation almost always boosts eligibility. It's the clearest signal of a genuine stakeholder, not a farmer.

**Transaction value:** Higher value transactions suggest real users. Dust amounts and micro-transactions raise flags.

**Wallet age:** Older wallets with varied history across DeFi look more like real users. Freshly created wallets that only interact with the targeted protocol look like farms.

---

## What gets you excluded: sybil detection in practice

Protocols now routinely run clustering analysis on the wallet graph before finalising distributions. Common patterns that trigger exclusion:

**Funding from the same source:** Multiple wallets all receiving ETH from the same address (often a centralised exchange withdrawal) within a short time frame. This is the most common farm signature.

**Identical transaction sequences:** Wallets that run the same operations in the same order with the same timing. Scripted farms leave this pattern clearly visible in on-chain data.

**Dust amounts used consistently:** Wallets that provide $0.01 in liquidity, swap $5, and do nothing else. Minimum-viable-interaction at scale is visible.

**Absence of gas-cost sensitivity:** Real users sometimes pay slightly more or less gas depending on network conditions. Scripted wallets often pay identical gas because the script doesn't vary.

**Temporal clustering:** If 500 wallets all do their first transaction within the same 30-minute window, that cluster will receive scrutiny.

---

## What "organic" usage looks like

The activities that make a wallet look like a genuine user rather than a farm:
- Varied amounts (not templated to the cent)
- Activity spread over weeks and months, not just one period
- Mix of protocol features used (not just the cheapest action)
- Some gas cost sensitivity (using slow speeds when not urgent)
- Interaction with multiple protocols on the same chain (real users do more than one thing on a chain)

This isn't a formula to game eligibility — it's a description of what genuine DeFi participation looks like. The protocols are trying to identify and reward the second group, not the first.

---

## The realistic expectation

Most of the large airdrops from well-known protocols have already happened. The remaining opportunity sits with protocols that are growing in TVL, haven't yet launched tokens, and have points programs or active communities.

Quality over quantity: interacting genuinely with 5 promising protocols over 6 months will almost always produce better outcomes than briefly touching 50 protocols in a single weekend.

---

*This is educational content, not financial advice. Tax treatment of airdrops varies by jurisdiction — consult a qualified professional.*
