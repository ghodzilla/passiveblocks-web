import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { DRUCK_ADD_GAIN, DRUCK_STOP_COST, DRUCK_STOP_MA, DRUCK_THEME_MAX, DRUCK_TRIM_MA } from './druck.config';
import { sampleStep, type DruckSnapshot } from './druck';
import { toDruckPanel } from './druckPresent';
import {
  COMPARISON_EMPTY,
  formatSydney,
  nextDruckRun,
  placeByLabel,
  toControlRoom,
  type ControlRoomModel,
} from './controlRoom';

const NOW = new Date('2026-11-21T21:00:00.000Z');

function redRoom(patch?: (snapshot: DruckSnapshot) => void, outcome: 'saved' | 'feed_failed' = 'saved'): ControlRoomModel {
  const step = sampleStep();
  const snapshot = structuredClone(step.snapshot);
  assert.ok(snapshot);
  patch?.(snapshot);
  const panel = toDruckPanel({
    status: 'ok',
    snapshot,
    banner: outcome === 'feed_failed' ? 'A price did not arrive. No new buys.' : null,
    outcome,
    weeks: [snapshot],
  });
  return toControlRoom({
    status: 'ok',
    snapshot,
    banner: panel.banner,
    outcome,
    weeks: [snapshot],
    now: NOW,
    liquidityAsOf: '2026-11-20',
    spreadAsOf: '2026-11-20',
    attemptedAt: snapshot.fetchedAt,
    paperRule: panel.paperRule,
    record: panel.record,
  });
}

describe('control room presentation', () => {
  it('formats the Sydney deadlines and the next Saturday-morning run', () => {
    assert.equal(placeByLabel('2026-11-23', 'AUD'), 'Mon 23 Nov, 4:10 PM AEDT');
    assert.equal(placeByLabel('2026-11-23', 'USD'), 'Tue 24 Nov, 8:00 AM AEDT');
    assert.equal(formatSydney(nextDruckRun(NOW)), 'Tue 24 Nov, 9:45 AM AEDT');
  });

  it('shows the red 25% book with whole-share orders and no broker send', () => {
    const room = redRoom();
    assert.equal(room.colour, 'red');
    assert.equal(room.investedLabel, '25%');
    assert.equal(room.sharesLabel, 'A$25,000 in shares');
    assert.equal(room.cash?.weightLabel, '75%');
    assert.equal(room.cash?.amountLabel, 'A$75,000');
    assert.match(room.cash?.untilFill ?? '', /A\$100,000/);
    assert.deepEqual(room.cards.map((card) => card.symbol), ['NTRA', 'HACK.AX', 'AMZN', 'INSM']);
    assert.deepEqual(room.cards.map((card) => card.weightLabel), ['7%', '8%', '5%', '5%']);
    assert.equal(room.freshWord, 'Data fresh');
    assert.equal(room.nextRun, 'Tue 24 Nov, 9:45 AM AEDT');
    assert.equal(room.checks.find((check) => check.id === 'liquidity')?.pass, false);
    assert.match(room.checks.find((check) => check.id === 'liquidity')?.label ?? '', /Liquidity \+0\.04/);
    assert.equal(room.checks.find((check) => check.id === 'credit')?.pass, false);
    assert.match(room.checks.find((check) => check.id === 'credit')?.label ?? '', /4\.20% vs 3\.40%/);
    assert.equal(room.checks.find((check) => check.id === 'trend')?.pass, false);
    assert.match(room.checks.find((check) => check.id === 'trend')?.label ?? '', /below its 200-day/);
    assert.match(room.paperRule, /12 months/);
    assert.match(room.paperRule, /60\/40/);
    assert.match(room.about.join(' '), /no shorts/i);
    assert.match(room.about.join(' '), /No leverage/);
    const healthcare = room.cards.find((card) => card.symbol === 'NTRA');
    assert.match(healthcare?.themeText ?? '', /Healthcare 12% of the 40% theme cap/);
    assert.ok((healthcare?.themeText.includes(String(Math.round(DRUCK_THEME_MAX * 100)))));
    const names = sampleStep().snapshot?.names ?? [];
    for (const order of room.orders) {
      const heldName = names.find((item) => item.symbol === order.symbol);
      if (!heldName) throw new Error(`missing ${order.symbol}`);
      assert.equal(Number.isInteger(order.qty), true);
      assert.equal(order.qty, Math.floor(heldName.targetAud / heldName.priceAud + 1e-9));
      assert.ok(order.qty * heldName.priceAud <= heldName.targetAud + 0.02);
      assert.equal(order.side, 'BUY');
      assert.equal(order.type, 'LMT');
      assert.equal(order.status, 'Not sent');
      assert.equal(order.currency, heldName.currency);
      assert.equal(order.limit, Math.round(heldName.priceLocal * 100) / 100);
      assert.match(room.cards.find((card) => card.symbol === order.symbol)?.action ?? '', new RegExp(`Buy A\\$.* · ${order.qty} shares`));
    }
    assert.equal(room.orders.find((order) => order.symbol === 'NTRA')?.currency, 'USD');
    assert.equal(room.orders.find((order) => order.symbol === 'HACK.AX')?.currency, 'AUD');
    assert.equal(room.orders.find((order) => order.symbol === 'NTRA')?.placeBy, 'Tue 24 Nov, 8:00 AM AEDT');
    assert.equal(room.orders.find((order) => order.symbol === 'HACK.AX')?.placeBy, 'Mon 23 Nov, 4:10 PM AEDT');
    assert.match(room.orderText, /Not sent/);
    assert.match(room.orderText, /USD/);
    assert.match(room.orderText, /AUD/);
    assert.doesNotMatch(room.orderText, /Submitted/);
    assert.equal(room.chart.empty, COMPARISON_EMPTY);
    assert.equal(room.chart.points.length, 0);
    const watching = room.watch.find((chip) => chip.symbol === 'STX');
    assert.ok(watching);
    assert.equal(watching.below, true);
    assert.match(watching.text, /below its 200-day/);
    assert.equal(room.cards.some((card) => card.symbol === 'STX'), false);
    const ntra = room.cards.find((card) => card.symbol === 'NTRA');
    assert.equal(ntra?.levels.find((level) => level.key === 'cost')?.text, '—');
    assert.equal(ntra?.levels.find((level) => level.key === 'add')?.text, '—');
    assert.match(ntra?.levelsNote ?? '', /after the first buy/);
    assert.equal(room.freshness.find((line) => line.label === 'Prices')?.value, '20 Nov 2026');
    assert.equal(room.freshness.find((line) => line.label === 'Liquidity score')?.value, '20 Nov 2026');
    assert.match(room.freshness.find((line) => line.label === 'Last run')?.value ?? '', /^succeeded/);
  });

  it('uses the higher stop, and hides the add while price is under the 200-day', () => {
    const room = redRoom((snapshot) => {
      const name = snapshot.names.find((item) => item.symbol === 'NTRA');
      assert.ok(name);
      name.priceLocal = 200;
      name.priceAud = 200 / 0.65;
      name.ma200 = 180;
      name.above200 = true;
      name.premium = 200 / 180 - 1;
      name.vsCost = 0.2;
      name.heldAud = 7000;
      name.heldWeight = 0.07;
      name.targetAud = 7000;
      name.targetWeight = 0.07;
      name.call = 'Hold';
      const costAud = name.priceAud / (1 + name.vsCost);
      snapshot.positions = [{ id: name.id, symbol: name.symbol, qty: 16.8, avgCostAud: costAud }];
    });
    const card = room.cards.find((item) => item.symbol === 'NTRA');
    assert.ok(card);
    const cost = 200 / 1.2;
    const stopMa = 180 * (1 - DRUCK_STOP_MA);
    const stopCost = cost * (1 - DRUCK_STOP_COST);
    const add = cost * (1 + DRUCK_ADD_GAIN);
    const trim = 180 * (1 + DRUCK_TRIM_MA);
    assert.ok(stopMa > stopCost);
    assert.equal(card.levels.find((level) => level.key === 'stop')?.text, stopMa.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    assert.match(card.levels.find((level) => level.key === 'stop')?.caption ?? '', /200-day/);
    assert.match(card.levels.find((level) => level.key === 'stop')?.caption ?? '', /133\.33/);
    assert.equal(card.levels.find((level) => level.key === 'add')?.text, add.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    assert.equal(card.levels.find((level) => level.key === 'trim')?.text, trim.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    assert.equal(card.action, 'Hold');
    assert.equal(room.orders.some((order) => order.symbol === 'NTRA'), false);

    const under = redRoom((snapshot) => {
      const name = snapshot.names.find((item) => item.symbol === 'NTRA');
      assert.ok(name);
      name.priceLocal = 150;
      name.priceAud = 150 / 0.65;
      name.ma200 = 180;
      name.above200 = false;
      name.premium = 150 / 180 - 1;
      name.vsCost = 150 / 0.65 / (200 / 0.65) - 1;
      name.call = 'Hold';
      name.heldAud = 5000;
      name.heldWeight = 0.05;
      name.targetAud = 5000;
      name.targetWeight = 0.05;
      snapshot.positions = [{ id: name.id, symbol: name.symbol, qty: 10, avgCostAud: (200 / 0.65) }];
    });
    const held = under.cards.find((item) => item.symbol === 'NTRA');
    assert.equal(held?.levels.find((level) => level.key === 'add')?.text, '—');
    assert.match(held?.levels.find((level) => level.key === 'add')?.caption ?? '', /200-day/);
    const shownStop = Number((held?.levels.find((level) => level.key === 'stop')?.text ?? '').replace(/,/g, ''));
    const costStop = (200 * (1 - DRUCK_STOP_COST));
    const maStop = 180 * (1 - DRUCK_STOP_MA);
    assert.equal(shownStop, Math.max(costStop, maStop));
  });

  it('does not list orders when a feed is down, and sells only shares already held', () => {
    const paused = redRoom(undefined, 'feed_failed');
    assert.equal(paused.orders.length, 0);
    assert.equal(paused.freshTone, 'down');
    assert.match(paused.ordersEmpty, /nothing is sent/);
    assert.match(paused.cards.find((card) => card.symbol === 'NTRA')?.action ?? '', /not sent/);

    const selling = redRoom((snapshot) => {
      const name = snapshot.names.find((item) => item.symbol === 'NTRA');
      assert.ok(name);
      name.call = 'Sell';
      name.targetWeight = 0;
      name.targetAud = 0;
      name.heldAud = 7000;
      name.heldWeight = 0.07;
      snapshot.positions = [{ id: name.id, symbol: name.symbol, qty: 16.8, avgCostAud: name.priceAud }];
    });
    const order = selling.orders.find((item) => item.symbol === 'NTRA');
    assert.ok(order);
    assert.equal(order.side, 'SELL');
    assert.equal(order.qty, 16);
    assert.ok(order.qty > 0);
    assert.match(selling.cards.find((card) => card.symbol === 'NTRA')?.action ?? '', /Sell · 16 shares/);
  });

  it('draws the comparison only after two filled weeks', () => {
    const step = sampleStep();
    const first = structuredClone(step.snapshot);
    const second = structuredClone(step.snapshot);
    assert.ok(first && second);
    first.phase = 'filled';
    first.filledOn = '2026-10-30';
    first.decisionDate = '2026-10-30';
    first.nav = 1;
    second.phase = 'filled';
    second.filledOn = '2026-11-20';
    second.decisionDate = '2026-11-20';
    second.nav = 1.05;
    const room = toControlRoom({
      status: 'ok',
      snapshot: second,
      banner: null,
      outcome: 'filled',
      weeks: [second, first],
      now: NOW,
      qqq: [{ date: '2026-10-30', close: 100 }, { date: '2026-11-20', close: 110 }],
      spy: [{ date: '2026-10-30', close: 500 }, { date: '2026-11-20', close: 510 }],
      bonds: [{ date: '2026-10-30', close: 95 }, { date: '2026-11-20', close: 96 }],
    });
    assert.equal(room.chart.empty, null);
    assert.equal(room.chart.points.length, 2);
    assert.equal(room.chart.points[0].date, '2026-10-30');
    assert.ok(Math.abs((room.chart.points[1].book ?? 0) - 0.05) < 1e-9);
    assert.match(room.chart.legend?.book ?? '', /Book \+5\.00%/);
    assert.match(room.chart.legend?.qqq ?? '', /QQQ/);
    assert.match(room.chart.legend?.mix ?? '', /60\/40/);
    assert.equal(room.chart.points[0].book, 0);
  });

  it('keeps the page off the retired regime view and loads benchmarks directly', () => {
    const page = readFileSync('app/private/regime/page.tsx', 'utf8');
    const benchmarks = readFileSync('lib/regime/benchmarks.ts', 'utf8');
    assert.match(page, /toDruckPanel/);
    assert.match(page, /loadBenchmarkCloses/);
    assert.equal(page.includes('getRegimeDesk'), false);
    assert.equal(page.includes('buildDesk'), false);
    assert.equal(page.includes('evaluateBook'), false);
    assert.match(benchmarks, /fetchYahooBars/);
    assert.match(benchmarks, /QQQ/);
    assert.match(benchmarks, /SPY/);
    assert.match(benchmarks, /IEF/);
    assert.equal(benchmarks.includes('book.series'), false);
    assert.equal(readFileSync('components/regime/RegimeDashboard.tsx', 'utf8').includes('VisserPanel'), false);
    assert.equal(readFileSync('components/regime/RegimeDashboard.tsx', 'utf8').includes('PathToBuyPanel'), false);
    assert.equal(readFileSync('components/regime/DruckPanel.tsx', 'utf8').includes('Update basket'), false);
  });
});
