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

These sentences were frozen in this folder before the download in `results.json`. They are not an externally timestamped pre-registration, and the 2021–2026 price paths were already examined. An untested hypothesis is not an out-of-sample result.

H1. Following the unchanged production rule with point-in-time inputs has a higher time-weighted net AUD return per unit of peak-to-trough drawdown than a static AUD buy-and-hold and a same-date monthly investment in a stated benchmark, over a sample that contains more than one regime label.

H2. Turning the macro gate off, while keeping the price checks, changes time in market. This is an ablation, not a new production rule. It is reported only if H1’s inputs exist.

Benchmark, if a replay is possible: 60% SPY and 40% cash, translated to AUD with the AUDUSD rate that was tradable on the execution session. Cash yield 0. One-way cost 10 bps on buys and sells. Taxes excluded. Lump-sum funding is reported separately and is not the skill comparison.

A result can be **supported** only if the point-in-time replay exists, the metric above favours the production rule on both the earlier and later half, and the later half was not used to choose the thresholds. It is **unsupported** only if that same replay shows the rule failing the metric. If the replay cannot be built, both hypotheses are **not tested**. That is inconclusive, not a failure of the rule and not evidence for it.

## Inputs a full replay must have

Each input has to be the vintage that was public at the decision instant, not the latest reprint.

- Liquidity: WALCL, WTREGEN, RRPONTSYD, with the H.4.1 Thursday release lag, the next-morning Daily Treasury Statement, and the NY Fed RRP publication time
- Policy: DFEDTARU or DFF, and DGS2
- Credit: BAMLH0A0HYM2. The production window is 756 daily observations, minimum 252. The z-score is null before that minimum. Liquidity and positioning are the 156-week windows. Credit is fail-closed: the composite is withheld until liquidity, policy, and credit each have a z-score. Dropping credit and renormalising is not the production rule.
- Growth and AI: optional in the live rule. A missing leg is labelled and left out of the composite. That is the live behaviour, and it is not a full-credit replay.
- Positioning: optional when the feed is missing. A file from the CFTC yearly history is not a vintage. The report is generally published Friday at 3:30 p.m. Eastern from the preceding Tuesday, and holidays can delay it. This study does not claim those files contain revisions.
- Prices: split- and dividend-adjusted where the provider actually adjusted them, plus AUDUSD for US and crypto names
- A fixed-current-universe hypothetical can use today’s list and today’s theme file. It must say that the list is a survivor set and that any 2021–2026 path is pre-exposed. Missing membership history is not, by itself, a reason that hypothetical cannot be run.

A daily ALFRED vintage has no clock time. The conservative cutoff is the previous calendar day’s vintage, not an exact release timestamp. The observations API can request many `vintage_dates` in one call. That call needs an API key, which this run did not have.

Missing-data policy in a replay is the live one: a missing mandatory leg blocks new risk. It is not filled with today’s value.

## What this folder is allowed to conclude

If any required vintage is unavailable, `results.json` says `fullStrategy: "not_validated"` and leaves portfolio metrics null. Restricted notes may describe a downloaded file. They are not the strategy result. Synthetic series are not written here.
