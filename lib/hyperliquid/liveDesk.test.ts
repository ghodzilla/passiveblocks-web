import assert from 'node:assert/strict';
import test from 'node:test';
import { deskFromParts } from './liveDesk';

test('no equity rows means there is no live desk', () => {
  assert.equal(deskFromParts({ equityCount: 0 }), null);
});

test('a live row stays labelled simulation and not validated', () => {
  const desk = deskFromParts({
    equityCount: 4,
    latestEquity: 1000,
    strategies: [
      {
        name: 'tsmom_4h',
        asset_class: 'crypto',
        status: 'shadow',
        weight: 1,
        n: 0,
        mean_r: 0,
        shrunk_edge: 0,
        lcb: 0,
        calibration_slope: null,
        win_rate: null,
        pnl_usdc: 0,
      },
    ],
  });
  assert.ok(desk);
  assert.equal(desk.feed, 'live');
  assert.match(desk.headline, /SIMULATION/);
  assert.match(desk.headline, /NOT VALIDATED/);
  assert.equal(desk.status.validated, false);
  assert.equal(desk.status.mode, 'SIMULATION');
  assert.equal(desk.banner, undefined);
});
