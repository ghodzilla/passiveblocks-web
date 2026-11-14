import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { asofPoints, asofPointsMany, asofSeries } from './alfredAsOf';
import { WINDOWS } from './constants';
import type { VintageReplay } from './vintageReplay';
import { loadAlfredSeries } from '../../research/regime-validation/alfredArchive';
import {
  assessDecision,
  creditMissingReason,
  creditShortReason,
  lookaheadViolations,
  noVintageReason,
  type VintageSource,
} from '../../research/regime-validation/pointInTime';

const ALFRED = 'research/regime-validation/alfred';

function source(vintageDates: string[], points: { date: string; value: number; realtimeStart: string }[]): VintageSource {
  return {
    vintageDates: [...vintageDates].sort(),
    asOf: (vintage) => points.filter((point) => point.date <= vintage && point.realtimeStart <= vintage),
  };
}

function published(): VintageSource {
  return source(['2010-01-04'], [{ date: '2010-01-04', value: 1, realtimeStart: '2010-01-04' }]);
}

describe('vintage selection', () => {
  it('drops a revision that was not published yet and keeps the revision that contains the vintage', () => {
    const rows = [
      { date: '2024-10-17', value: '1', rt_start: '2024-10-17', rt_end: '2024-10-20' },
      { date: '2024-10-17', value: '2', rt_start: '2024-10-21', rt_end: '9999-12-31' },
      { date: '2024-10-22', value: '9', rt_start: '2024-10-22', rt_end: '9999-12-31' },
    ];
    const early = asofPoints(rows, '2024-10-18');
    assert.deepEqual(early, [{ date: '2024-10-17', value: 1, realtimeStart: '2024-10-17' }]);
    assert.equal(asofSeries(rows, '2024-10-18')[0]?.value, 1);
    const later = asofPoints(rows, '2024-10-22');
    assert.equal(later.find((row) => row.date === '2024-10-17')?.value, 2);
    assert.equal(later.find((row) => row.date === '2024-10-17')?.realtimeStart, '2024-10-21');
    assert.equal(later.some((row) => row.date > '2024-10-22' || row.realtimeStart > '2024-10-22'), false);
    const many = asofPointsMany(rows, ['2024-10-18', '2024-10-22']);
    assert.deepEqual(many.get('2024-10-18'), early);
    assert.deepEqual(many.get('2024-10-22'), later);
  });

  it('does not use high-yield history before its first vintage, and the indexed lookup matches', () => {
    const hy = loadAlfredSeries(ALFRED, 'BAMLH0A0HYM2');
    assert.equal(hy.vintageDates[0], '2023-11-14');
    const before = asofPoints(hy.rows, '2023-11-13');
    assert.equal(before.length, 0);
    const first = asofPoints(hy.rows, '2023-11-14');
    assert.ok(first.length > 0);
    assert.equal(first.every((point) => point.realtimeStart <= '2023-11-14' && point.date <= '2023-11-14'), true);
    const many = asofPointsMany(hy.rows, ['2023-11-13', '2023-11-14', '2026-10-01']);
    for (const vintage of ['2023-11-13', '2023-11-14', '2026-10-01']) {
      assert.deepEqual(many.get(vintage), asofPoints(hy.rows, vintage));
    }
    const ready = many.get('2026-10-01') ?? [];
    assert.ok(ready.length >= 756);
    assert.equal(ready.every((point) => point.realtimeStart <= '2026-10-01' && point.date <= '2026-10-01'), true);
  });

  it('keeps Baa history inside the first vintage and hides it the day before', () => {
    const baa = loadAlfredSeries(ALFRED, 'BAA10Y');
    assert.equal(baa.vintageDates[0], '2014-01-27');
    assert.equal(asofPoints(baa.rows, '2014-01-26').length, 0);
    const first = asofPoints(baa.rows, '2014-01-27');
    assert.ok(first.length >= 756);
    assert.equal(first.some((point) => point.date < '2014-01-27'), true);
    assert.equal(first.every((point) => point.realtimeStart <= '2014-01-27' && point.date <= '2014-01-27'), true);
    assert.deepEqual(asofPointsMany(baa.rows, ['2014-01-26', '2014-01-27']).get('2014-01-27'), first);
  });
});

describe('fail-closed credit', () => {
  const base: Record<string, VintageSource> = {
    WALCL: published(),
    WTREGEN: published(),
    RRPONTSYD: published(),
    DGS2: published(),
    DFEDTARU: published(),
    DFF: published(),
  };

  it('skips the day when the high-yield vintage is missing and does not borrow Baa', () => {
    const sources = {
      ...base,
      BAMLH0A0HYM2: source(['2023-11-14'], [{ date: '2023-11-14', value: 4, realtimeStart: '2023-11-14' }]),
      BAA10Y: source(['2014-01-27'], [{ date: '2008-01-02', value: 3, realtimeStart: '2014-01-27' }]),
    };
    const skipped = assessDecision('2023-11-14', sources, { creditSeries: 'BAMLH0A0HYM2', creditWindow: 756 });
    assert.equal(skipped.status, 'skipped');
    assert.equal(skipped.panel, null);
    assert.equal(skipped.reasons.includes(creditMissingReason('BAMLH0A0HYM2')), true);
    assert.equal(JSON.stringify(skipped).includes('BAA10Y'), false);
  });

  it('skips a short high-yield window instead of scoring it as a 756-observation window', () => {
    const points = Array.from({ length: 10 }, (_, index) => ({
      date: `2024-01-${String(index + 2).padStart(2, '0')}`,
      value: 4,
      realtimeStart: '2024-01-02',
    }));
    const sources = {
      ...base,
      BAMLH0A0HYM2: source(['2024-01-02'], points),
    };
    const skipped = assessDecision('2024-06-03', sources, { creditSeries: 'BAMLH0A0HYM2', creditWindow: 756 });
    assert.equal(skipped.status, 'skipped');
    assert.equal(skipped.panel, null);
    assert.equal(skipped.reasons.includes(creditShortReason('BAMLH0A0HYM2', 756)), true);
  });

  it('builds a panel only from rows published on or before the previous day', () => {
    const hy = Array.from({ length: 756 }, (_, index) => {
      const ms = Date.parse('2020-01-01T00:00:00Z') + index * 86_400_000;
      const date = new Date(ms).toISOString().slice(0, 10);
      return { date, value: 3 + index / 1000, realtimeStart: '2020-01-01' };
    });
    const future = { date: '2024-01-02', value: 9, realtimeStart: '2024-06-04' };
    const sources = {
      ...base,
      BAMLH0A0HYM2: source(['2020-01-01', '2024-06-04'], [...hy, future]),
    };
    const ready = assessDecision('2024-06-03', sources, { creditSeries: 'BAMLH0A0HYM2', creditWindow: 756 });
    assert.equal(ready.status, 'ready');
    assert.equal(ready.vintageDate, '2024-06-02');
    const credit = ready.panel?.series.BAMLH0A0HYM2 ?? [];
    assert.equal(credit.length, 756);
    assert.equal(credit.some((point) => point.value === 9), false);
    assert.equal(lookaheadViolations(ready.used).length, 0);
    const tampered = ready.used.map((input, index) => (
      index === 0
        ? { ...input, points: [...input.points, { date: '2024-06-02', value: 1, realtimeStart: '2024-06-03' }] }
        : input
    ));
    const violations = lookaheadViolations(tampered);
    assert.equal(violations.length, 1);
    assert.equal(violations[0]?.realtimeStart, '2024-06-03');
  });

  it('skips a missing mandatory series even when credit is ready', () => {
    const hy = Array.from({ length: 756 }, (_, index) => ({
      date: `2020-01-${String((index % 28) + 1).padStart(2, '0')}`,
      value: 1,
      realtimeStart: '2020-01-01',
    }));
    const sources = {
      ...base,
      RRPONTSYD: source(['2016-03-28'], [{ date: '2016-03-28', value: 1, realtimeStart: '2016-03-28' }]),
      BAMLH0A0HYM2: source(['2020-01-01'], hy),
    };
    const skipped = assessDecision('2016-03-01', sources, { creditSeries: 'BAMLH0A0HYM2', creditWindow: 1 });
    assert.equal(skipped.status, 'skipped');
    assert.equal(skipped.reasons.includes(noVintageReason('RRPONTSYD')), true);
  });
});

describe('vintage replay artifact', () => {
  it('reports the lookahead audit and does not mark the strategy validated unless the pre-set test passed', () => {
    const report = JSON.parse(readFileSync('research/regime-validation/vintage-replay.json', 'utf8')) as VintageReplay;
    assert.equal(report.lookahead.passed, true);
    assert.equal(report.lookahead.violations, 0);
    assert.ok(report.lookahead.inputsChecked > 0);
    assert.equal(report.passCriteria.met, report.fullStrategy === 'criteria_met');
    if (!report.passCriteria.met) assert.equal(report.fullStrategy, 'not_validated');
    assert.match(report.headline, report.fullStrategy === 'criteria_met' ? /pre-set comparison was met/ : /not validated/);
    assert.match(report.advice, /not financial advice/);
    assert.match(report.advice, /not proof/);
    assert.equal(report.policy, 'book-limits-2026-11-07');
    assert.equal(report.costBps, 10);
    assert.equal(WINDOWS.credit.window, 756);
    assert.equal(WINDOWS.credit.min, 252);
    const primary = report.variants[0];
    assert.equal(primary?.role, 'primary');
    assert.equal(primary?.creditSeries, 'BAMLH0A0HYM2');
    assert.equal(primary?.creditWindow, 756);
    assert.equal(primary?.engineCreditWindow, 756);
    assert.equal(primary?.engineCreditMin, 252);
    assert.ok(report.variants.filter((variant) => variant.role === 'variant').length >= 3);
    assert.ok(report.variants.some((variant) => variant.creditSeries === 'BAA10Y' && variant.creditWindow === 756));
    assert.ok(report.variants.some((variant) => variant.creditSeries === 'BAMLH0A0HYM2' && variant.creditWindow === 252));
    assert.ok(report.variants.some((variant) => variant.creditSeries === 'BAA10Y' && variant.creditWindow === 252));
    for (const variant of report.variants) {
      if (variant.role === 'variant') assert.match(variant.label, /^Variant:/);
      assert.equal(variant.completed + variant.skipped, report.calendar.replayableSessions);
    }
    const page = readFileSync('app/private/regime/page.tsx', 'utf8');
    const config = readFileSync('next.config.mjs', 'utf8');
    assert.equal(page.includes('vintageReplay'), true);
    assert.equal(config.includes('vintage-replay.json'), true);
  });
});
