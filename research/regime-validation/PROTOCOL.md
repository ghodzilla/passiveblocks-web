# Regime validation protocol

Frozen before any strategy return was calculated. Parameters are the production rules. They are not fit to the downloads in this folder.

## Identity

- Rules version: `regime-v2` (`lib/regime/constants.ts`)
- Checklist version: `2026-11-08.2` (`lib/regime/decision.ts`)
- Theme list: `lib/regime/themes.config.ts` as committed on this branch. There is no earlier published theme list to replay.
- Owner currency: AUD
- Decision clock: the live refresh is daily after 13:15 UTC. A historical replay would have to use only data released before that instant.
- This study does not change those rules, the caps, or the gates.

## What the live rule does

Positive composite means easier liquidity. Core readiness is liquidity, policy, and credit. `|composite| < 0.35` forces do nothing. New buys require `risk_budget_open`, which requires an actionable print, a non-weak composite, and Risk-On. `do_nothing` and `reduce_risk` are defensive-only. Preservation budget is 3% vol, 20% gross, 0 net. A missing or stale mandatory feed is not actionable and blocks new risk.

Names then pass theme, regime, 200-day trend, 12–1 momentum, stretch, and the drawdown halt. Size is volatility targeting inside the budget, then single-name, theme, and overlap caps. Signal-health retirement uses later 20-session returns, so a historical replay may use a retirement only after those 20 sessions have already happened. Forty windows is not a profitability test and is not a test of the 66% aspiration.

## Hypotheses

H1. Following the unchanged production rule with point-in-time inputs has a higher time-weighted net AUD return per unit of peak-to-trough drawdown than a static AUD buy-and-hold and a same-date monthly investment in a pre-declared benchmark, over a sample that contains more than one regime label.

H2. Turning the macro gate off, while keeping the price checks, changes time in market. This is an ablation, not a new production rule. It is reported only if H1’s inputs exist.

Pre-declared benchmark, if a replay is possible: 60% SPY and 40% cash, translated to AUD with the AUDUSD rate that was tradable on the execution session. Cash yield 0. One-way cost 10 bps on buys and sells. Taxes excluded. Lump-sum funding is reported separately and is not the skill comparison.

A result can be **supported** only if the point-in-time replay exists, the metric above favours the production rule on both the earlier and later half, and the later half was not used to choose the thresholds. It is **unsupported** only if that same replay shows the rule failing the metric. If the replay cannot be built, both hypotheses are **not tested**. That is inconclusive, not a failure of the rule and not evidence for it.

## Inputs a full replay must have

Each input has to be the vintage that was public at the decision instant, not the latest reprint.

- Liquidity: WALCL, WTREGEN, RRPONTSYD, with the H.4.1 Thursday release lag, the next-morning Daily Treasury Statement, and the NY Fed RRP publication time
- Policy: DFEDTARU or DFF, and DGS2
- Credit: BAMLH0A0HYM2
- Growth: US and Australia OECD CLI, including their monthly release and revision vintage
- AI capex: IPG3344S vintage, plus SMH and SPY prices
- Positioning: CFTC non-commercial net, dated by publication rather than the Tuesday “as of” date
- Prices: split- and dividend-adjusted where the provider actually adjusted them, plus AUDUSD for US and crypto names
- Universe: membership as of each date, not today’s survivors
- Theme switches and any weekly parameter edits: the version that was in force, not only today’s file

Missing-data policy in a replay is the live one: a missing mandatory leg blocks new risk. It is not filled with today’s value.

## What this folder is allowed to conclude

If any required vintage is unavailable, `results.json` says `fullStrategy: "not_validated"` and leaves portfolio metrics null. Restricted notes may describe a downloaded file. They are not the strategy result. Synthetic series are not written here.
