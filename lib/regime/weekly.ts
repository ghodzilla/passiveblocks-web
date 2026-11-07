import type { IdeasReport } from './ideas';
import {
  changeAllowed,
  dipBandReturns,
  foldMetric,
  metricsByFold,
  momentumReturns,
  reviewParameter,
  stopSystemReturns,
  type WeekChange,
} from './improve';
import type { Journal } from './journal';
import { getRegimeDesk } from './load';
import { writeJournal } from './state';
import type { Bar } from './signals';

function closes(bars: Bar[]): number[] {
  return bars.map((bar) => bar.close).filter((close) => close > 0);
}

function alignedReturns(left: Bar[], right: Bar[]): number[] {
  const rightClose = new Map<string, number>();
  for (const bar of right) rightClose.set(bar.date, bar.close);
  const out: number[] = [];
  for (let i = 1; i < left.length; i++) {
    const prevDate = left[i - 1].date;
    const date = left[i].date;
    const prevOther = rightClose.get(prevDate);
    const other = rightClose.get(date);
    if (prevOther == null || other == null || !(left[i - 1].close > 0) || !(left[i].close > 0) || !(prevOther > 0)) continue;
    const spy = left[i].close / left[i - 1].close - 1;
    const bond = other / prevOther - 1;
    out.push(0.6 * spy + 0.4 * bond);
  }
  return out;
}

function retirements(ideas: IdeasReport, nowIso: string, log: WeekChange[]): WeekChange[] {
  const month = nowIso.slice(0, 7);
  const out: WeekChange[] = [];
  for (const signal of ideas.signalHealth) {
    if (signal.status !== 'retired') continue;
    const ruleId = `signal:${signal.id}`;
    if (log.some((entry) => entry.ruleId === ruleId && entry.at.slice(0, 7) === month)) continue;
    out.push({
      at: nowIso,
      ruleId,
      action: 'retired',
      detail: `${signal.label} is retired for this week (information coefficient ${signal.ic?.toFixed(2) ?? '—'}, hit rate ${signal.hitRate == null ? '—' : `${Math.round(signal.hitRate * 100)}%`}).`,
    });
  }
  return out;
}

export function reviewBook(input: {
  journal: Journal;
  spyBars: Bar[];
  sixty: number[];
  ideas: IdeasReport;
  nowIso: string;
}): { journal: Journal; changes: WeekChange[] } {
  const journal: Journal = JSON.parse(JSON.stringify(input.journal)) as Journal;
  const changes: WeekChange[] = [];
  const spy = closes(input.spyBars);
  if (spy.length < 80) {
    journal.weeks = journal.weeks.concat([{
      at: input.nowIso,
      portfolio: { cagr: null, maxDrawdown: null, sharpe: null },
      spy: { cagr: null, maxDrawdown: null, sharpe: null },
      sixtyForty: { cagr: null, maxDrawdown: null, sharpe: null },
      note: 'Not enough SPY history to review parameters. Nothing was changed.',
    }]);
    return { journal, changes };
  }

  const specs: { ruleId: 'momentum-lookback' | 'atr-k' | 'risk-pct' | 'dip-low' | 'dip-high'; current: number; seriesFor: (value: number) => number[] }[] = [
    {
      ruleId: 'momentum-lookback',
      current: journal.params.momentumLookback,
      seriesFor: (value) => momentumReturns(spy, value),
    },
    {
      ruleId: 'atr-k',
      current: journal.params.atrK,
      seriesFor: (value) => stopSystemReturns(input.spyBars, value),
    },
    {
      // Scaling the same signal by risk percent leaves Sharpe unchanged and can
      // inflate Calmar through leverage. The job therefore compares the unscaled
      // path at every candidate, so it does not raise risk to chase the aspiration.
      ruleId: 'risk-pct',
      current: journal.params.riskPct,
      seriesFor: () => momentumReturns(spy, journal.params.momentumLookback),
    },
    {
      ruleId: 'dip-low',
      current: journal.params.dipLow,
      seriesFor: (value) => (value < journal.params.dipHigh ? dipBandReturns(spy, value, journal.params.dipHigh) : []),
    },
    {
      ruleId: 'dip-high',
      current: journal.params.dipHigh,
      seriesFor: (value) => (value > journal.params.dipLow ? dipBandReturns(spy, journal.params.dipLow, value) : []),
    },
  ];

  for (const spec of specs) {
    const change = reviewParameter({
      ruleId: spec.ruleId,
      current: spec.current,
      nowIso: input.nowIso,
      log: journal.changes.concat(changes),
      seriesFor: spec.seriesFor,
    });
    if (!change || change.to == null) {
      const folds = metricsByFold(spec.seriesFor(spec.current));
      const sharpes = (folds ?? []).map((fold) => fold.sharpe).filter((value): value is number => value != null);
      const average = sharpes.length ? sharpes.reduce((sum, value) => sum + value, 0) / sharpes.length : null;
      const month = input.nowIso.slice(0, 7);
      const already = journal.changes.concat(changes).some((entry) => entry.ruleId === spec.ruleId && entry.at.slice(0, 7) === month);
      if (average != null && average < 0 && !already && changeAllowed(journal.changes.concat(changes), spec.ruleId, input.nowIso)) {
        changes.push({
          at: input.nowIso,
          ruleId: spec.ruleId,
          action: 'demoted',
          detail: `${spec.ruleId} average out-of-sample Sharpe is ${average.toFixed(2)}. The parameter was left alone. Drawdown limits still win over the return target.`,
        });
      }
      continue;
    }
    changes.push(change);
    if (spec.ruleId === 'momentum-lookback') journal.params.momentumLookback = change.to;
    if (spec.ruleId === 'atr-k') journal.params.atrK = change.to;
    if (spec.ruleId === 'risk-pct') journal.params.riskPct = change.to;
    if (spec.ruleId === 'dip-low') journal.params.dipLow = change.to;
    if (spec.ruleId === 'dip-high') journal.params.dipHigh = change.to;
  }

  changes.push(...retirements(input.ideas, input.nowIso, journal.changes.concat(changes)));
  const portfolio = foldMetric(stopSystemReturns(input.spyBars, journal.params.atrK));
  const spyMetric = foldMetric(spy.length > 2
    ? spy.slice(1).map((close, index) => close / spy[index] - 1)
    : []);
  const sixty = foldMetric(input.sixty);
  journal.changes = journal.changes.concat(changes);
  journal.weeks = journal.weeks.concat([{
    at: input.nowIso,
    portfolio: { cagr: portfolio.cagr, maxDrawdown: portfolio.maxDrawdown, sharpe: portfolio.sharpe },
    spy: { cagr: spyMetric.cagr, maxDrawdown: spyMetric.maxDrawdown, sharpe: spyMetric.sharpe },
    sixtyForty: { cagr: sixty.cagr, maxDrawdown: sixty.maxDrawdown, sharpe: sixty.sharpe },
    note: changes.length
      ? `Reviewed ${changes.length} rule note${changes.length === 1 ? '' : 's'}. Acceptance used out-of-sample folds only.`
      : 'No parameter beat the current setting on at least 2 of 3 out-of-sample folds.',
  }]);
  return { journal, changes };
}

export async function runWeeklyReview(now = new Date()): Promise<{ ok: boolean; note: string; changes: WeekChange[] }> {
  const view = await getRegimeDesk();
  const spySeries = view.book.series.find((series) => series.symbol === 'SPY')?.bars ?? [];
  const iefSeries = view.book.series.find((series) => series.symbol === 'IEF')?.bars ?? [];
  const reviewed = reviewBook({
    journal: view.journal,
    spyBars: spySeries,
    sixty: alignedReturns(spySeries, iefSeries),
    ideas: view.ideas,
    nowIso: now.toISOString(),
  });
  await writeJournal(reviewed.journal);
  const week = reviewed.journal.weeks[reviewed.journal.weeks.length - 1];
  return { ok: true, note: week?.note ?? 'Review finished.', changes: reviewed.changes };
}
