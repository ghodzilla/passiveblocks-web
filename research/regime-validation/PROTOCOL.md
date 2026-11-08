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

## Whole-book limits, declared before the rerun

Policy version `book-limits-2026-11-07`. This is a change the owner approved after the add-and-hold ledger was shown to ignore the caps. It is not the historical production journal. Thresholds are the existing ones. Nothing here was chosen to improve a return.

The production suggestion caps that day’s new weights only. A hold prints weight 0 and is not a sell instruction. `applyPaperDay` then adds another tranche on every later day that is still `add`. The approved rule is different: the gross, net, name, theme, and overlap limits bind the carried book and any new tranche together.

Decisions use only prices known at the decision. US and crypto marks are the previous session. ASX marks may include the session that has already closed. Every sell, trim, and buy is filled on the next session after the decision, with AUDUSD as the last rate on or before that fill. A 10 bps one-way cost is charged on the traded AUD notional. Cash yield is 0. No borrowing.

Order on that fill:

1. A local price at or through the stop sells the whole name.
2. A stale mark (older than 7 days) or a missing mark is a required reduction. If the next session has no price or no FX, the name stays and the day is listed as pending. It is not marked as trimmed.
3. Caps are applied to the book marked at the decision, in this order. The tolerance is 0.0001 of equity, so a rounded weight is not called a breach. Anything larger is reported.
   - Name: 20% tactical or cash-role, 2% systematic. Sell the excess.
   - Overlap: 25% for the AI/megacap cluster and for any correlation group the desk already formed. Sell the largest member first. Equal weights use the symbol name A to Z.
   - Theme: 20%. Same priority.
   - Net: non-cash roles only, matching `scaleWeights`. Cash-role names (SHY, AAA.AX, BILL.AX) are outside the net. Sell non-defensive names first, largest first, then defensive non-cash names. Cash-role is not sold to meet the net cap.
   - Gross: all held names. Same priority, and cash-role is last.
4. A new name is bought only if it is not halted, was not sold on this decision, and fits in every remaining cap. A pyramid add is one tranche, the first day the name is `add` and it has not already taken that tranche. Later days that remain `add` do not buy again. A name sold on this decision is not bought again on this decision.
5. Buys are filled in desk order and only with cash already on hand after the sells. A buy that cash cannot cover is cut or skipped and listed. Weights are fractions of decision-time equity.

A hold whose weight is inside the caps is kept. Weight 0 on a hold is not a target of zero.

After the fill, prices will not match the decision marks. That gap is post-fill drift. It is counted separately from an order that breached a cap. The next decision’s pre-trade mark is the drift since the last fill. The policy does not claim the book stays inside the caps between sessions.

The live tracker keeps any earlier mixed-currency ledger and does not convert its cash or cost bases. A separate AUD book, `aud-paper-v1`, uses the same AUDUSD convention as this replay: the Yahoo close is USD per 1 AUD, and a USD price becomes AUD by dividing by the last rate on or before that price. A missing or stale rate blocks a new buy and leaves the book unvalued. The research replay is unchanged by that live book. CFTC stays omitted. The universe is the current survivor list. The window is the same 514 sessions, 2024-10-18 through 2026-11-05.

## What this folder is allowed to conclude

If any required vintage is unavailable, `results.json` says `fullStrategy: "not_validated"` and leaves portfolio metrics null. Restricted notes may describe a downloaded file. They are not the strategy result. Synthetic series are not written here.

The later file `replay-results.json` is the frozen-rule run on the archived prior-day intervals. It does not replace this protocol, and a completed run is not by itself evidence that the hypothesis holds.
