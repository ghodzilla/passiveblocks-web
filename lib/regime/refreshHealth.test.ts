import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { gateSnapshot, getRegimeDesk } from './load';
import {
  classifyFetch,
  openAttemptCookie,
  providerSource,
  refreshBlockReason,
  refreshCsrfMatches,
  refreshLogLine,
  refreshOverdue,
  settleRefresh,
  signAttemptCookie,
  signRefreshCsrf,
  type ProviderSource,
  type RefreshHealth,
} from './refreshHealth';
import type { RegimeSnapshot } from './types';

const NOW = new Date('2026-11-07T13:16:00.000Z');

function feed(id: string, mandatory: boolean, observationDate: string | null, error: string | null = null): ProviderSource {
  return providerSource({
    id,
    label: id,
    mandatory,
    observationDate,
    fetchedAt: NOW.toISOString(),
    error,
  });
}

function mandatoryFeeds(overrides: Partial<Record<string, ProviderSource>> = {}): ProviderSource[] {
  const rows = [
    feed('WALCL', true, '2026-11-04'),
    feed('WTREGEN', true, '2026-11-04'),
    feed('RRPONTSYD', true, '2026-11-06'),
    feed('DGS2', true, '2026-11-05'),
    feed('DFEDTARU', true, '2026-11-07'),
    feed('BAMLH0A0HYM2', true, '2026-11-05'),
    feed('USALOLITOAASTSAM', false, '2026-09-01'),
  ];
  return rows.map((row) => overrides[row.id] ?? row);
}

function saved(health: RefreshHealth): RefreshHealth {
  return health;
}

describe('refresh outcomes', () => {
  it('records a full save only when every feed arrives and the write succeeds', () => {
    const health = settleRefresh({
      now: NOW,
      previous: null,
      sources: mandatoryFeeds(),
      durable: true,
      writeOk: true,
    });
    assert.equal(health.outcome, 'success');
    assert.equal(health.fetchOutcome, 'success');
    assert.equal(health.persisted, true);
    assert.equal(health.snapshotSaved, true);
    assert.equal(health.lastFullySuccessfulFetchAt, NOW.toISOString());
    assert.equal(health.lastPersistedAt, NOW.toISOString());
    assert.equal(health.storage, 'neon');
    assert.equal(refreshBlockReason(health, NOW), null);
    assert.equal(classifyFetch([]), 'failure');
  });

  it('marks a partial refresh when an optional feed fails and still allows the mandatory set', () => {
    const health = settleRefresh({
      now: NOW,
      previous: null,
      sources: mandatoryFeeds({
        USALOLITOAASTSAM: feed('USALOLITOAASTSAM', false, null, 'USALOLITOAASTSAM request failed'),
      }),
      durable: true,
      writeOk: true,
    });
    assert.equal(health.outcome, 'partial');
    assert.equal(health.fetchOutcome, 'partial');
    assert.equal(health.snapshotSaved, true);
    assert.equal(health.lastFullySuccessfulFetchAt, null);
    assert.equal(refreshBlockReason(health, NOW), null);
  });

  it('blocks new risk when a mandatory feed fails', () => {
    const health = settleRefresh({
      now: NOW,
      previous: null,
      sources: mandatoryFeeds({
        WALCL: feed('WALCL', true, null, 'FRED WALCL HTTP 500'),
      }),
      durable: true,
      writeOk: true,
    });
    assert.equal(health.outcome, 'failure');
    assert.equal(health.snapshotSaved, false);
    assert.match(refreshBlockReason(health, NOW) ?? '', /mandatory feed/);
    const snapshot = gateSnapshot({
      actionable: true,
      weak: false,
      regime: 'risk_on',
      action: 'risk_budget_open',
      message: 'old',
      gaps: [],
      effectiveBudget: { volTarget: 0.12, maxGross: 1.5, maxNet: 1 },
    } as RegimeSnapshot, refreshBlockReason(health, NOW));
    assert.equal(snapshot.actionable, false);
    assert.equal(snapshot.action, 'reduce_risk');
    assert.equal(snapshot.effectiveBudget.maxNet, 0);
  });

  it('does not call an unsaved fetch a persisted snapshot', () => {
    const previous = settleRefresh({
      now: new Date('2026-11-06T13:16:00.000Z'),
      previous: null,
      sources: mandatoryFeeds(),
      durable: true,
      writeOk: true,
    });
    const health = settleRefresh({
      now: NOW,
      previous,
      sources: mandatoryFeeds(),
      durable: true,
      writeOk: false,
    });
    assert.equal(health.outcome, 'persistence_failure');
    assert.equal(health.fetchOutcome, 'success');
    assert.equal(health.persisted, false);
    assert.equal(health.snapshotSaved, false);
    assert.equal(health.lastFullySuccessfulFetchAt, NOW.toISOString());
    assert.equal(health.lastPersistedAt, previous.lastPersistedAt);
    assert.match(refreshBlockReason(health, NOW) ?? '', /not saved in Neon/);
    assert.match(health.note, /durable write failed/);
    const unavailable = settleRefresh({
      now: NOW,
      previous: null,
      sources: mandatoryFeeds(),
      durable: false,
      writeOk: false,
    });
    assert.equal(unavailable.storage, 'unavailable');
    assert.match(unavailable.note, /REGIME_DATABASE_URL/);
    assert.match(unavailable.note, /not durable/);
  });

  it('treats a missed 13:15 UTC slot as overdue', () => {
    const health = saved(settleRefresh({
      now: new Date('2026-11-06T13:16:00.000Z'),
      previous: null,
      sources: mandatoryFeeds(),
      durable: true,
      writeOk: true,
    }));
    const later = new Date('2026-11-07T14:00:00.000Z');
    assert.equal(refreshOverdue(health.attemptedAt, later), true);
    assert.match(refreshBlockReason(health, later) ?? '', /overdue/);
    assert.equal(refreshOverdue(null, later), true);
    assert.equal(refreshOverdue(health.attemptedAt, new Date('2026-11-07T13:20:00.000Z')), false);
  });

  it('does not invent a live desk when nothing durable is saved', async () => {
    const view = await getRegimeDesk(NOW, null, null);
    assert.equal(view.health, null);
    assert.match(view.blockReason ?? '', /REGIME_DATABASE_URL/);
    assert.equal(view.snapshot.actionable, false);
    assert.equal(view.snapshot.action, 'reduce_risk');
  });

  it('rejects a bad refresh token and keeps secrets out of the log line', () => {
    const secret = 'session-secret-session-secret-session-secret';
    const token = signRefreshCsrf(secret, 'cookie-value');
    assert.equal(refreshCsrfMatches(secret, 'cookie-value', token), true);
    assert.equal(refreshCsrfMatches(secret, 'cookie-value', `${token}x`), false);
    const line = refreshLogLine('end', { trigger: 'cron', outcome: 'failure', persisted: false });
    const parsed = JSON.parse(line) as { event: string; outcome: string };
    assert.equal(parsed.event, 'regime_refresh');
    assert.equal(parsed.outcome, 'failure');
    assert.equal(line.includes(secret), false);
    assert.equal(line.includes('CRON_SECRET'), false);
    const health = settleRefresh({
      now: NOW,
      previous: null,
      sources: mandatoryFeeds(),
      durable: false,
      writeOk: false,
    });
    const raw = signAttemptCookie(secret, health);
    assert.equal(openAttemptCookie(secret, raw)?.outcome, 'persistence_failure');
    assert.equal(openAttemptCookie(secret, `${raw}x`), null);
  });
});
