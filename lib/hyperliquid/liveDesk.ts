import type { DeskSnapshot } from '@/lib/hyperliquid/types';
import { openRegimeSql, storeProblem, type RegimeSql } from '@/lib/regime/db';

const START = 1000;

export type LiveRows = {
  equityCount: number;
  latestEquity: number;
  latestEquityAt: string | null;
  equityCurve: { t: string | null; equity: number }[];
  heartbeatAt: string | null;
  version: string;
  network: string;
  bookAge: number | null;
  halt: boolean;
  drain: boolean;
  pause: boolean;
  windowDay: number;
  strategies: DeskSnapshot['strategies'];
  eligible: string[];
  signals: DeskSnapshot['signals'];
  positions: DeskSnapshot['positions'];
  plans: DeskSnapshot['plans'];
  events: DeskSnapshot['events'];
  gatedMean: number | null;
  ungatedMean: number | null;
  staleBlocks: number;
  signalEscapes: number;
  falseCloses: number;
  routing: number | null;
  gateMix: Record<string, number>;
  closeMix: Record<string, number>;
  drawdown: number;
  grossLeverage: number;
  clusterRisk: Record<string, number>;
  totalRisk: number;
  dailyPnl: number;
};

const EMPTY: LiveRows = {
  equityCount: 0,
  latestEquity: START,
  latestEquityAt: null,
  equityCurve: [],
  heartbeatAt: null,
  version: '0.1.0',
  network: 'sim-mainnet-data',
  bookAge: null,
  halt: false,
  drain: false,
  pause: false,
  windowDay: 0,
  strategies: [],
  eligible: [],
  signals: [],
  positions: [],
  plans: [],
  events: [],
  gatedMean: null,
  ungatedMean: null,
  staleBlocks: 0,
  signalEscapes: 0,
  falseCloses: 0,
  routing: null,
  gateMix: {},
  closeMix: {},
  drawdown: 0,
  grossLeverage: 0,
  clusterRisk: {},
  totalRisk: 0,
  dailyPnl: 0,
};

export function deskFromParts(rows: Partial<LiveRows> & { equityCount: number }): DeskSnapshot | null {
  if (!rows.equityCount) return null;
  const data = { ...EMPTY, ...rows };
  const pnl = data.latestEquity - START;
  const pct = pnl / START;
  const shown = `${data.strategies.length} strategies shadow`;
  return {
    headline: `Day ${data.windowDay} of 28 · SIMULATION · NOT VALIDATED · ${shown} · shadow P&L ${signedPct(pct)}`,
    source: 'Live paper on public mainnet data. No orders were sent.',
    feed: 'live',
    as_of: data.latestEquityAt,
    as_of_sydney: sydney(data.latestEquityAt),
    notices: ['SIMULATION. NOT VALIDATED. These rows are paper fills. No order has been sent.'],
    status: {
      mode: 'SIMULATION',
      validated: false,
      version: data.version,
      network: data.network,
      heartbeat_at: data.heartbeatAt,
      book_age_s: data.bookAge,
      fresh: data.bookAge != null && data.bookAge <= 5,
      halt: data.halt,
      drain: data.drain,
      pause_new_entries: data.pause,
      window_day: data.windowDay,
      window_days: 28,
    },
    pnl: {
      start_usdc: START,
      shadow_equity_usdc: data.latestEquity,
      shadow_pnl_usdc: pnl,
      shadow_pnl_pct: pct,
      gated_mean_r: data.gatedMean,
      ungated_mean_r: data.ungatedMean,
      note: 'Paper equity from the public book. Not a broker balance.',
    },
    autonomy: {
      exercised: 1,
      cap: 3,
      name: 'Prepare',
      promotion: 'manual confirm flag only',
    },
    health: {
      routing_accuracy: data.routing ?? 1,
      signal_escapes: data.signalEscapes,
      false_closes: data.falseCloses,
      unnecessary_interruptions: 0,
      stale_blocks: data.staleBlocks,
      gate_mix: data.gateMix,
      close_mix: data.closeMix,
      drawdown: data.drawdown,
      equity_usdc: data.latestEquity,
      open_risk: {
        positions: data.positions.filter((row) => row.counts_toward_limits).length,
        gross_leverage: data.grossLeverage,
        cluster_risk: data.clusterRisk,
        total_risk: data.totalRisk,
        daily_pnl_pct: data.dailyPnl,
      },
      limits: {
        max_leverage: 2,
        daily_loss_stop: 0.02,
        drawdown_kill: 0.1,
        max_positions: 3,
        cluster_risk_cap: 0.015,
        total_risk_cap: 0.02,
      },
    },
    equity_curve: data.equityCurve.length ? data.equityCurve : [{ t: data.latestEquityAt, equity: data.latestEquity }],
    baseline_curve: [
      { t: data.equityCurve[0]?.t ?? data.latestEquityAt, equity: START },
      { t: data.latestEquityAt, equity: START },
    ],
    strategies: data.strategies,
    whitelist: {
      eligible: data.eligible,
      stocks_and_commodities: {
        eligible_note: 'The daily filter records stock and commodity names. This paper loop still trades only BTC, ETH and SOL.',
        stocks: 'New stock entries follow the US session calendar.',
        commodities: 'Gold, silver and oil follow the futures clock.',
        earnings: 'Single-stock names stay flat into earnings.',
        oil_roll: 'Oil is flat across the roll window.',
        macro: 'A full exchange calendar is not in this build.',
      },
    },
    positions: data.positions,
    signals: data.signals,
    skip_pnl: [],
    plans: data.plans,
    events: data.events,
    scorecard: {
      verdict: 'NOT VALIDATED',
      plain: 'Live paper is plumbing. It is not evidence of an edge.',
      items: [
        { name: 'Orders', pass: true, detail: 'No order path is in this build.' },
        { name: 'Keys', pass: true, detail: 'No key is read.' },
        { name: 'Validated', pass: false, detail: 'NOT VALIDATED.' },
      ],
    },
  };
}

export async function loadLiveDesk(sql?: RegimeSql | null): Promise<DeskSnapshot | null> {
  const db = sql === undefined ? await openRegimeSql() : sql;
  if (!db) return null;
  try {
    const counts = await db.query<{ n: number | string }>('SELECT COUNT(*)::int AS n FROM hl.hl_equity');
    const equityCount = num(counts[0]?.n);
    if (!equityCount) return null;
    return deskFromParts(await readRows(db, equityCount));
  } catch (error) {
    console.error(JSON.stringify({ event: 'hl_desk', problem: storeProblem(error) }));
    return null;
  }
}

async function readRows(db: RegimeSql, equityCount: number): Promise<LiveRows> {
  const latest = await db.query<{ shadow_equity: unknown; ts: unknown }>(
    'SELECT shadow_equity, ts FROM hl.hl_equity ORDER BY id DESC LIMIT 1',
  );
  const curve = await db.query<{ shadow_equity: unknown; ts: unknown }>(
    'SELECT shadow_equity, ts FROM hl.hl_equity ORDER BY id DESC LIMIT 300',
  );
  const beat = await db.query<{ version: string; network: string; ts: unknown; ws_ages: unknown }>(
    'SELECT version, network, ts, ws_ages FROM hl.hl_heartbeat ORDER BY id DESC LIMIT 1',
  );
  const control = await db.query<{ halt: boolean; drain: boolean; pause_new_entries: boolean }>(
    'SELECT halt, drain, pause_new_entries FROM hl.hl_control WHERE id = 1',
  );
  const strategies = await db.query<{
    name: string;
    asset_class: string;
    status: string;
    weight: unknown;
    n: unknown;
    mean_r: unknown;
  }>(
    `SELECT st.name, st.asset_class, st.status, st.weight,
            COUNT(sh.id)::int AS n, AVG(sh.realised_r) AS mean_r
     FROM hl.hl_strategy st
     LEFT JOIN hl.hl_signal sig ON sig.strategy_id = st.id
     LEFT JOIN hl.hl_shadow_trade sh ON sh.signal_id = sig.id AND sh.book = 'gated'
     GROUP BY st.id, st.name, st.asset_class, st.status, st.weight
     ORDER BY st.name`,
  );
  const markets = await db.query<{ market: string }>(
    `SELECT market FROM hl.hl_market
     WHERE eligible AND as_of = (SELECT MAX(as_of) FROM hl.hl_market)
     ORDER BY market LIMIT 24`,
  );
  const signals = await db.query<{
    strategy: string;
    market: string;
    side: string;
    decision: string;
    skip_reason: string | null;
    verdict: string | null;
    probability: unknown;
    ts: unknown;
  }>(
    `SELECT st.name AS strategy, sig.market, sig.side, sig.decision, sig.skip_reason,
            g.verdict, g.probability, sig.ts
     FROM hl.hl_signal sig
     JOIN hl.hl_strategy st ON st.id = sig.strategy_id
     LEFT JOIN hl.hl_gate_decision g ON g.signal_id = sig.id
     ORDER BY sig.id DESC LIMIT 30`,
  );
  const positions = await db.query<{
    strategy: string;
    market: string;
    side: string;
    book: string;
    entry_px: unknown;
    stop_px: unknown;
    target_px: unknown;
    size: unknown;
    funding: unknown;
  }>(
    `SELECT st.name AS strategy, sig.market, sig.side, sh.book, sh.entry_px,
            sig.stop_px, sig.target_px, pl.size, sh.funding
     FROM hl.hl_shadow_trade sh
     JOIN hl.hl_signal sig ON sig.id = sh.signal_id
     JOIN hl.hl_strategy st ON st.id = sig.strategy_id
     LEFT JOIN hl.hl_trade_plan pl ON pl.signal_id = sig.id
     WHERE sh.exit_px IS NULL
     ORDER BY sh.id DESC LIMIT 20`,
  );
  const plans = await db.query<{
    id: unknown;
    strategy: string;
    market: string;
    side: string;
    entry_px: unknown;
    stop_px: unknown;
    target_px: unknown;
    verdict: string | null;
    outcome: string | null;
  }>(
    `SELECT pl.id, st.name AS strategy, pl.market, pl.side, pl.entry_px, pl.stop_px,
            pl.target_px, g.verdict, c.outcome
     FROM hl.hl_trade_plan pl
     JOIN hl.hl_signal sig ON sig.id = pl.signal_id
     JOIN hl.hl_strategy st ON st.id = sig.strategy_id
     LEFT JOIN hl.hl_gate_decision g ON g.id = pl.gate_decision_id
     LEFT JOIN hl.hl_close_event c ON c.plan_id = pl.id
     ORDER BY pl.id DESC LIMIT 20`,
  );
  const events = await db.query<{ kind: string; ts: unknown; severity: string; detail: string }>(
    'SELECT kind, ts, severity, detail FROM hl.hl_risk_event ORDER BY id DESC LIMIT 20',
  );
  const means = await db.query<{ book: string; mean_r: unknown }>(
    `SELECT book, AVG(realised_r) AS mean_r FROM hl.hl_shadow_trade
     WHERE realised_r IS NOT NULL GROUP BY book`,
  );
  const health = await db.query<{
    signal_escapes: unknown;
    false_closes: unknown;
    routing_accuracy: unknown;
  }>(
    `SELECT signal_escapes, false_closes, routing_accuracy
     FROM hl.hl_desk_health ORDER BY id DESC LIMIT 1`,
  );
  const stale = await db.query<{ n: unknown }>(
    "SELECT COUNT(*)::int AS n FROM hl.hl_risk_event WHERE kind = 'stale_data'",
  );
  const gates = await db.query<{ verdict: string; n: unknown }>(
    'SELECT verdict, COUNT(*)::int AS n FROM hl.hl_gate_decision GROUP BY verdict',
  );
  const closes = await db.query<{ outcome: string; n: unknown }>(
    'SELECT outcome, COUNT(*)::int AS n FROM hl.hl_close_event GROUP BY outcome',
  );
  const peak = await db.query<{ peak: unknown }>('SELECT MAX(shadow_equity) AS peak FROM hl.hl_equity');
  const equity = num(latest[0]?.shadow_equity, START);
  const high = num(peak[0]?.peak, equity);
  const mappedPositions = positions.map((row) => position(row));
  const risk = openRisk(mappedPositions, equity);
  return {
    ...EMPTY,
    equityCount,
    latestEquity: equity,
    latestEquityAt: stamp(latest[0]?.ts),
    equityCurve: curve
      .map((row) => ({ t: stamp(row.ts), equity: num(row.shadow_equity) }))
      .reverse(),
    heartbeatAt: stamp(beat[0]?.ts),
    version: beat[0]?.version || EMPTY.version,
    network: beat[0]?.network || EMPTY.network,
    bookAge: bookAge(beat[0]?.ws_ages),
    halt: Boolean(control[0]?.halt),
    drain: Boolean(control[0]?.drain),
    pause: Boolean(control[0]?.pause_new_entries),
    strategies: strategies.map((row) => ({
      name: row.name,
      asset_class: row.asset_class,
      status: row.status,
      weight: num(row.weight),
      n: num(row.n),
      mean_r: num(row.mean_r),
      shrunk_edge: 0,
      lcb: 0,
      calibration_slope: null,
      win_rate: null,
      pnl_usdc: 0,
    })),
    eligible: markets.map((row) => row.market),
    signals: signals.map((row) => ({
      strategy: row.strategy,
      market: row.market,
      side: row.side,
      decision: row.decision,
      skip_reason: row.skip_reason,
      verdict: row.verdict,
      confidence: row.probability == null ? null : num(row.probability),
      at: stamp(row.ts),
    })),
    positions: mappedPositions,
    plans: plans.map((row) => ({
      id: num(row.id),
      strategy: row.strategy,
      market: row.market,
      side: row.side,
      entry: num(row.entry_px),
      stop: num(row.stop_px),
      target: num(row.target_px),
      verdict: row.verdict,
      outcome: row.outcome,
      gaps: [],
      legs: [],
    })),
    events: events.map((row) => ({
      kind: row.kind,
      at: stamp(row.ts),
      severity: row.severity,
      text: row.detail,
    })),
    gatedMean: meanOf(means, 'gated'),
    ungatedMean: meanOf(means, 'ungated'),
    staleBlocks: num(stale[0]?.n),
    signalEscapes: num(health[0]?.signal_escapes),
    falseCloses: num(health[0]?.false_closes),
    routing: health[0]?.routing_accuracy == null ? null : num(health[0]?.routing_accuracy),
    gateMix: Object.fromEntries(gates.map((row) => [row.verdict, num(row.n)])),
    closeMix: Object.fromEntries(closes.map((row) => [row.outcome, num(row.n)])),
    drawdown: high > 0 ? Math.max(0, (high - equity) / high) : 0,
    grossLeverage: risk.gross,
    clusterRisk: risk.clusters,
    totalRisk: risk.total,
    dailyPnl: 0,
  };
}

function position(row: {
  strategy: string;
  market: string;
  side: string;
  book: string;
  entry_px: unknown;
  stop_px: unknown;
  target_px: unknown;
  size: unknown;
  funding: unknown;
}): DeskSnapshot['positions'][number] {
  const entry = num(row.entry_px);
  const size = num(row.size);
  const notional = Math.abs(entry * size);
  return {
    strategy: row.strategy,
    market: row.market,
    side: row.side,
    book: row.book,
    entry,
    stop: num(row.stop_px),
    target: num(row.target_px),
    notional_usdc: notional,
    funding_usdc: num(row.funding),
    counts_toward_limits: row.book === 'gated',
    stop_in_plan: num(row.stop_px) > 0,
    stop_note: num(row.stop_px) > 0 ? 'Stop is on the plan.' : 'No stop on the plan.',
  };
}

function openRisk(rows: DeskSnapshot['positions'], equity: number) {
  const taken = rows.filter((row) => row.counts_toward_limits);
  const gross = equity > 0 ? taken.reduce((sum, row) => sum + row.notional_usdc, 0) / equity : 0;
  const clusters: Record<string, number> = {};
  let total = 0;
  for (const row of taken) {
    const distance = row.entry > 0 ? Math.abs(row.entry - row.stop) / row.entry : 0;
    const risk = equity > 0 ? (distance * row.notional_usdc) / equity : 0;
    const cluster = clusterOf(row.market);
    clusters[cluster] = (clusters[cluster] ?? 0) + risk;
    total += risk;
  }
  return { gross, clusters, total };
}

function clusterOf(market: string) {
  const root = market.split(':').pop() ?? market;
  if (root === 'BTC' || root === 'ETH' || root === 'SOL') return 'crypto';
  if (root === 'GOLD' || root === 'SILVER') return 'metals';
  if (root === 'CL' || root === 'BRENTOIL' || root === 'WTI') return 'energy';
  return 'us_equity';
}

function meanOf(rows: { book: string; mean_r: unknown }[], book: string) {
  const found = rows.find((row) => row.book === book);
  if (!found || found.mean_r == null) return null;
  return num(found.mean_r);
}

function bookAge(value: unknown): number | null {
  if (!value || typeof value !== 'object') return null;
  const raw = (value as { btc_book_s?: unknown }).btc_book_s;
  if (raw == null) return null;
  return num(raw);
}

function num(value: unknown, fallback = 0) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function stamp(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  const text = String(value);
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? text : date.toISOString();
}

function sydney(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return (
    new Intl.DateTimeFormat('en-AU', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'Australia/Sydney',
    }).format(date) + ' Sydney'
  );
}

function signedPct(value: number) {
  const shown = (value * 100).toFixed(1);
  return value > 0 ? `+${shown}%` : `${shown}%`;
}
