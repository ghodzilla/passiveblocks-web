# PassiveBlocks — Content Ready To Publish (approval manifest)

**For:** Pritesh · **From:** PassiveBlocks CMO · **Updated:** 2026-07-06

Everything below is written, QA'd, and sitting in the drawer. Per the 2026-07-04 rule
("seek my approval before publishing anything"), none of it goes live without your OK.
This page exists so you can clear the whole backlog in one pass instead of file by file.

**One decision unblocks all of it.** Reply with any mix of:
- `learn: all` (or list slugs) → I publish the /learn drafts to passiveblocks.io
- `newsletter: yes` → I mirror Estait's Vercel send path for PB (dodges the Cloudflare/Resend block), OR you provision the Beehiiv PB pub
- `x: cookies` → paste auth_token + ct0 from your laptop and I flush the queued posts

---

## 1. Blockers (why nothing has shipped)

| Blocker | Detail | Owner |
|---------|--------|-------|
| **No publish approval** | 2026-07-04 rule — I hold everything for your sign-off | You |
| **Beehiiv PB pub never created** | `BEEHIIV_PUB_ID_PB` unset. 4 finished newsletters can't send. Alt: mirror Estait's Vercel API send route | You / me |
| **Zero-shares data-integrity flag** | execution-state shows `vaultShares: 0` on BOTH Fluid positions, re-detected daily 20+ days. Blocks any present-tense "we hold $X" claim in newsletters. Needs a real on-chain check (Base + Arbiscan) — likely a balance-reader bug (Arb gas reads 0.000000) but unconfirmed | me, needs your nod to spend time |
| **X API depleted** | Standalone posting needs browser cookies from your laptop | You |

## 2. Newsletters (4 issues, content-complete)

| Issue | Lead | State |
|-------|------|-------|
| #1 | "5.2% on USDC right now — where, and where not to bother" | READY, 30+ days |
| #2 | Coinbase 2.8% vs DeFi anchor + utilisation/risk-corner | LOCKED |
| #3 | Stable LP vs lending + Mind-Change Watchlist | LOCKED |
| #4 | "The cost of doing nothing" — cost-of-chasing | CONTENT-COMPLETE |

Issue #5 deliberately NOT started (18th day). Not writing more newsletter into a drawer with 4 already waiting.

## 3. /learn articles — 30 FINAL

All 600–800 words, affiliate link + disclosure, subscribe CTA, cross-linked. Live path `passiveblocks.io/learn/<slug>`.

defi-yield-guide · usdc-yield-strategies · impermanent-loss · bridge-cex-to-base · hardware-wallet-guide ·
defi-tax-australia · when-not-to-rebalance · stable-lp-vs-lending · utilisation-rate · withdrawal-speed ·
kink-interest-models · reserve-factor · four-numbers-defi-yield · apy-vs-apr · annualised-apy-trap ·
defi-audit-guide · source-of-yield · oracle-risk · stablecoin-collateral-types · risk-free-rate ·
governance-risk · composability-risk · yield-mean-reversion · mercenary-liquidity · slippage-tax ·
break-even-horizon · yield-denomination-risk · correlation-entry-gate · orca-solana-yield ·
(+ guide-fluid-vs-aave — DRAFT, needs current rates before final)

## 4. X posts — queued daily sets (05-14 → 07-06)

~40 posts, 2/day, all Hormozi × Shaan framed, links in reply only. Flush the moment cookies land.

---

**Bottom line:** the writing is not the bottleneck. Distribution approval is. One reply clears weeks of finished work.
