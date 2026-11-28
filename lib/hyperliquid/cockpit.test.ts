import assert from 'node:assert/strict';
import test from 'node:test';
import { cockpitView, decisionLines, engineChip, formatPnlPct, healthStrip, marketStatus, trialDay } from './cockpit';
import snapshot from './replaySnapshot.json';
import type { DeskSnapshot } from './types';

const recorded = snapshot as DeskSnapshot;

function desk(patch: Partial<DeskSnapshot> = {}): DeskSnapshot {
  return {
    ...recorded,
    ...patch,
    status: { ...recorded.status, ...patch.status },
    pnl: { ...recorded.pnl, ...patch.pnl },
    health: { ...recorded.health, ...patch.health },
    signals: patch.signals ?? [],
    positions: patch.positions ?? [],
    plans: patch.plans ?? [],
    events: patch.events ?? [],
    equity_curve: patch.equity_curve ?? recorded.equity_curve,
  };
}

test('paper P&L percent uses the stored equity change', () => {
  assert.deepEqual(formatPnlPct(0.004), { text: '+0.4%', up: true });
  assert.deepEqual(formatPnlPct(-0.017588), { text: '−1.8%', up: false });
  assert.equal(formatPnlPct(recorded.pnl.shadow_pnl_pct).text, '−1.8%');
});

test('engine chip follows heartbeat age', () => {
  const now = new Date('2026-11-28T11:06:00Z');
  assert.equal(engineChip('2026-11-28T11:02:00Z', now).state, 'online');
  assert.equal(engineChip('2026-11-28T11:02:00Z', now).label, 'ENGINE ONLINE');
  assert.equal(engineChip('2026-11-28T11:02:00Z', now).updated, 'updated 4 min ago');
  assert.equal(engineChip('2026-11-28T10:56:00Z', now).state, 'stale');
  assert.equal(engineChip('2026-11-28T10:56:00Z', now).label, 'ENGINE STALE');
  assert.equal(engineChip('2026-11-28T10:40:00Z', now).state, 'offline');
  assert.equal(engineChip(null, now).state, 'offline');
  assert.match(engineChip('2026-11-28T08:28:44Z', now).clock, /AEDT$/);
});

test('trial day counts from the first equity row', () => {
  assert.equal(trialDay(recorded), 4);
  const empty = desk({ equity_curve: [], as_of: null, status: { ...recorded.status, window_day: 0, heartbeat_at: null } });
  assert.equal(trialDay(empty), 0);
});

test('market status words come from the open trade or the latest skip', () => {
  const open = desk({
    positions: [{ ...recorded.positions[0], market: 'ETH', side: 'long', counts_toward_limits: true }],
  });
  assert.equal(marketStatus(open, 'ETH').status, 'In trade · Long');
  const skipped = desk({
    signals: [{
      strategy: 'tsmom_4h',
      market: 'BTC',
      side: 'short',
      decision: 'skip',
      skip_reason: 'bad_book',
      verdict: 'reject',
      confidence: 0.5,
      at: '2026-11-28T08:00:00Z',
    }],
  });
  assert.equal(marketStatus(skipped, 'BTC').status, 'Skipped');
  assert.match(marketStatus(skipped, 'BTC').hint, /too wide or too thin/);
  assert.equal(marketStatus(desk(), 'SOL').status, 'Waiting');
});

test('decision lines use plain words and do not invent a dollar result', () => {
  const view = decisionLines(desk({
    as_of: '2026-11-28T08:28:44Z',
    signals: [
      {
        strategy: 'tsmom_4h',
        market: 'ETH',
        side: 'long',
        decision: 'trade',
        skip_reason: null,
        verdict: 'accept',
        confidence: 0.9,
        at: '2026-11-28T08:00:00Z',
      },
      {
        strategy: 'tsmom_4h',
        market: 'BTC',
        side: 'short',
        decision: 'skip',
        skip_reason: 'bad_book',
        verdict: 'reject',
        confidence: 0.4,
        at: '2026-11-28T07:00:00Z',
      },
    ],
    plans: [{
      id: 1,
      strategy: 'tsmom_4h',
      market: 'BTC',
      side: 'short',
      entry: 1,
      stop: 1,
      target: 1,
      verdict: 'accept',
      outcome: 'closed_as_planned',
      gaps: [],
      legs: [],
    }],
  }));
  assert.equal(view[0].text, 'Closed as planned · BTC');
  assert.equal(view.find((row) => row.text.includes('ETH'))?.text, 'Trend confirmed · ETH · Long');
  assert.equal(view.find((row) => row.text.includes('Spread'))?.text, 'Spread too wide · BTC');
  assert.equal(view.some((row) => row.text.includes('$')), false);
});

test('health strip maps feed, database, and alerts', () => {
  const now = new Date('2026-11-28T11:06:00Z');
  const live = healthStrip(desk({
    feed: 'live',
    banner: undefined,
    status: { ...recorded.status, heartbeat_at: '2026-11-28T11:04:00Z', fresh: true },
    health: { ...recorded.health, stale_blocks: 0, false_closes: 0, signal_escapes: 0 },
  }), now);
  assert.deepEqual(live.map((row) => row.state), ['HEALTHY', 'HEALTHY', 'HEALTHY']);

  const stale = healthStrip(desk({
    feed: 'live',
    status: { ...recorded.status, heartbeat_at: '2026-11-28T10:56:00Z', fresh: true },
  }), now);
  assert.equal(stale[0].state, 'DEGRADED');

  const offline = healthStrip(desk({
    feed: 'live',
    status: { ...recorded.status, heartbeat_at: '2026-11-28T10:40:00Z', fresh: false },
  }), now);
  assert.equal(offline[0].state, 'DOWN');

  const blocked = healthStrip(desk({
    feed: 'live',
    status: { ...recorded.status, heartbeat_at: '2026-11-28T11:05:00Z', fresh: true },
    health: { ...recorded.health, stale_blocks: 2 },
  }), now);
  assert.equal(blocked[0].state, 'DEGRADED');
  assert.match(blocked[0].hint, /stale/);

  const replay = healthStrip(desk({ feed: 'replay', banner: 'no live data yet' }), now);
  assert.equal(replay[1].state, 'DEGRADED');
  assert.match(replay[1].hint, /recorded replay/);

  const critical = healthStrip(desk({
    feed: 'live',
    events: [{ kind: 'risk', at: '2026-11-28T11:00:00Z', severity: 'CRITICAL', text: 'Disk full' }],
    status: { ...recorded.status, heartbeat_at: '2026-11-28T11:05:00Z', fresh: true },
  }), now);
  assert.equal(critical[2].state, 'DOWN');
  assert.match(critical[2].hint, /Nothing is sent/);
});

test('the recorded book does not reuse the mockup placeholders', () => {
  const view = cockpitView(recorded, new Date('2026-11-28T11:06:00Z'));
  const text = JSON.stringify(view);
  assert.equal(view.pnl.text, '−1.8%');
  assert.equal(view.pnl.up, false);
  assert.equal(view.engine.state, 'offline');
  assert.equal(view.markets.find((row) => row.symbol === 'BTC')?.status, 'In trade · Short');
  assert.equal(view.markets.find((row) => row.symbol === 'ETH')?.status, 'In trade · Short');
  assert.equal(view.markets.find((row) => row.symbol === 'SOL')?.status, 'Skipped');
  assert.equal(view.meters[0].value, '0.22x');
  assert.equal(view.meters[1].value, '2');
  assert.equal(view.meters[3].value, '4');
  assert.equal(text.includes('68,247'), false);
  assert.equal(text.includes('+0.4%'), false);
  assert.equal(text.includes('0.3x'), false);
  assert.equal(view.decisions.length <= 7, true);
  assert.equal(view.decisions.some((row) => row.text.includes('_')), false);
});
