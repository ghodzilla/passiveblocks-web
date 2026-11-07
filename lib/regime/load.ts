import { snapshotFromBundle } from './assemble';
import { actionFor, budgetsFor } from './classify';
import { FRED_SERIES } from './constants';
import { buildDesk, type Desk } from './desk';
import type { ConsistencyReport } from './consistency';
import { publishRegime } from './view';
import { buildIdeas, type IdeasReport } from './ideas';
import type { RegimeSql } from './db';
import type { Journal } from './journal';
import { melbourneDate } from './time';
import type { PriceBook } from './prices';
import { refreshBlockReason, unavailableStoreReason, type RefreshHealth } from './refreshHealth';
import { readJournal, readRefresh } from './state';
import type { SeriesPoint } from './series';
import { THEMES } from './themes.config';
import type { RegimeSnapshot } from './types';
import { resolveUniverse, type Instrument } from './universe';

/**
 * The owner page reads the Neon row written by the cron or by Refresh now.
 * The Next.js data cache is not a successful refresh, and a file in /tmp is
 * not durable on Vercel.
 */
export function priceUniverse(watchlist: string | undefined): Instrument[] {
  const base = resolveUniverse(watchlist);
  const have = new Set(base.map((item) => item.symbol));
  const extras: Instrument[] = [];
  for (const theme of THEMES) {
    for (const symbol of theme.symbols) {
      if (have.has(symbol.symbol)) continue;
      have.add(symbol.symbol);
      extras.push({
        symbol: symbol.symbol,
        name: symbol.name,
        venue: 'US',
        kind: symbol.kind === 'stock' ? 'stock' : 'etf',
        role: symbol.kind === 'stock' ? 'systematic' : 'tactical',
        defensive: false,
        assetClass: 'equities',
        yahoo: symbol.yahoo,
      });
    }
  }
  return base.concat(extras);
}

export function gateSnapshot(snapshot: RegimeSnapshot, reason: string | null): RegimeSnapshot {
  if (!reason) return snapshot;
  const decision = actionFor({ actionable: false, weak: snapshot.weak, regime: snapshot.regime });
  const budget = budgetsFor(snapshot.regime, decision.action);
  return {
    ...snapshot,
    actionable: false,
    action: decision.action,
    message: decision.message,
    modelBudget: budget.modelBudget,
    effectiveBudget: budget.effectiveBudget,
    budgetOverridden: budget.budgetOverridden,
    gaps: snapshot.gaps.includes(reason) ? snapshot.gaps : snapshot.gaps.concat(reason),
  };
}

function emptyBook(now: Date): PriceBook {
  return {
    fetchedAt: now.toISOString(),
    series: [],
    gaps: ['No durable price book is saved.'],
  };
}

export async function getRegimeDesk(now = new Date(), attempt: RefreshHealth | null = null, sql?: RegimeSql | null): Promise<{
  snapshot: RegimeSnapshot;
  ideas: IdeasReport;
  book: PriceBook;
  desk: Desk;
  journal: Journal;
  consistency: ConsistencyReport;
  health: RefreshHealth | null;
  blockReason: string | null;
}> {
  const [refreshRead, journal] = await Promise.all([readRefresh(sql), readJournal(sql)]);
  const stored = refreshRead.status === 'ok' ? refreshRead.value : null;
  const storedHealth = stored?.health ?? null;
  const health = attempt && (!storedHealth || Date.parse(attempt.attemptedAt) > Date.parse(storedHealth.attemptedAt))
    ? attempt
    : storedHealth;
  const blockReason = health
    ? refreshBlockReason(health, now)
    : unavailableStoreReason(refreshRead.status === 'ok' ? 'empty' : refreshRead.status);
  const baseSnapshot = stored?.snapshot ?? snapshotFromBundle({
    today: melbourneDate(now),
    generatedAt: now.toISOString(),
    walcl: [],
    tga: [],
    rrp: [],
    dgs2: [],
    policyRate: [],
    policyRateSeriesId: FRED_SERIES.policyUpper,
    hy: [],
    curve: [],
    usCli: [],
    auCli: [],
    positioning: [],
    gaps: ['No durable regime snapshot is saved. This page did not fetch a live feed in its place.'],
    reports: [],
  });
  const snapshot = gateSnapshot(baseSnapshot, blockReason);
  const book = stored?.book ?? emptyBook(now);
  const realYield: SeriesPoint[] = stored?.realYield ?? [];
  const dollar: SeriesPoint[] = stored?.dollar ?? [];
  const ideas = buildIdeas({ snapshot, book, watchlist: process.env.REGIME_WATCHLIST });
  const desk = buildDesk({
    snapshot,
    ideas,
    book,
    realYield,
    dollar,
    journal,
    envCapital: process.env.REGIME_CAPITAL,
    envTarget: process.env.REGIME_TARGET_CAGR,
  });
  const published = publishRegime({ snapshot, ideas, desk });
  return {
    snapshot,
    ideas: published.ideas,
    book,
    desk,
    journal,
    consistency: published.consistency,
    health,
    blockReason,
  };
}
