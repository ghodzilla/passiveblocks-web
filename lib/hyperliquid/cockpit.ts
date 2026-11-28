import type { DeskSnapshot } from '@/lib/hyperliquid/types';

/** A heartbeat younger than this is online. */
export const ONLINE_MS = 5 * 60 * 1000;
/** A heartbeat younger than this, but not online, is stale. Older is offline. */
export const STALE_MS = 15 * 60 * 1000;

export type EngineState = 'online' | 'stale' | 'offline';
export type HealthState = 'HEALTHY' | 'DEGRADED' | 'DOWN';
export type DecisionIcon = 'clock' | 'up' | 'warn' | 'check';

const STAGE1 = ['BTC', 'ETH', 'SOL'] as const;

const NAMES: Record<(typeof STAGE1)[number], string> = {
  BTC: 'Bitcoin',
  ETH: 'Ethereum',
  SOL: 'Solana',
};

const STRATEGY_SHORT: Record<string, string> = {
  tsmom_4h: 'Trend confirmed',
  utc_range_break: 'Range break',
  trend_donchian_1h: 'Channel break',
  meanrev_15m: 'Mean reversion',
  funding_fade_1h: 'Funding fade',
  btc_hold_1x: 'Baseline hold',
  random_entry: 'Random baseline',
};

const STRATEGY_HINT: Record<string, string> = {
  tsmom_4h: 'Trend following on the 4-hour chart.',
  utc_range_break: 'Break of the overnight range.',
  trend_donchian_1h: 'Break of a price channel.',
  meanrev_15m: 'A fade back toward the recent average.',
  funding_fade_1h: 'A fade of an extreme funding rate.',
  btc_hold_1x: 'A baseline that just holds bitcoin. It is not taken.',
  random_entry: 'A baseline that enters at random. It is not taken.',
};

const REASON_SHORT: Record<string, string> = {
  bad_book: 'Spread too wide',
  max_positions: 'Three trades already open',
  verify_expired: 'Check expired',
  baseline: 'Baseline only',
  cluster_risk: 'Risk cap reached',
  non_positive_edge: 'Edge not positive',
  session: 'Outside the session',
  stale: 'Data too old',
};

const REASON_HINT: Record<string, string> = {
  bad_book: 'The book was too wide or too thin.',
  max_positions: 'Three paper trades were already open.',
  verify_expired: 'More proof was required and the window ran out.',
  baseline: 'A baseline is kept for comparison and is not taken.',
  cluster_risk: 'That group of markets was already at its risk cap.',
  non_positive_edge: 'The planned edge was not positive.',
  session: 'The market was outside its trading session.',
  stale: 'The market data was too old to use.',
};

export type CockpitView = {
  engine: { state: EngineState; label: string; updated: string; clock: string };
  pnl: { pct: number; text: string; up: boolean; hint: string };
  meters: { key: string; label: string; value: string; cap: string; ratio: number; hint: string }[];
  markets: {
    symbol: (typeof STAGE1)[number];
    name: string;
    price: string | null;
    change: string | null;
    spark: number[];
    status: string;
    hint: string;
  }[];
  decisions: { icon: DecisionIcon; text: string; hint: string }[];
  health: { key: 'feed' | 'database' | 'alerts'; label: string; state: HealthState; hint: string }[];
};

export function formatPnlPct(fraction: number): { text: string; up: boolean } {
  const up = Number.isFinite(fraction) && fraction >= 0;
  const body = (Math.abs(Number.isFinite(fraction) ? fraction : 0) * 100).toFixed(1);
  return { text: `${up ? '+' : '−'}${body}%`, up };
}

export function engineChip(heartbeatAt: string | null | undefined, now: Date): CockpitView['engine'] {
  const clock = sydneyClock(heartbeatAt ? new Date(heartbeatAt) : now);
  if (!heartbeatAt) {
    return { state: 'offline', label: 'ENGINE OFFLINE', updated: 'updated —', clock };
  }
  const at = new Date(heartbeatAt).getTime();
  if (!Number.isFinite(at)) {
    return { state: 'offline', label: 'ENGINE OFFLINE', updated: 'updated —', clock: sydneyClock(now) };
  }
  const age = Math.max(0, now.getTime() - at);
  const state: EngineState = age < ONLINE_MS ? 'online' : age < STALE_MS ? 'stale' : 'offline';
  const label = state === 'online' ? 'ENGINE ONLINE' : state === 'stale' ? 'ENGINE STALE' : 'ENGINE OFFLINE';
  const min = Math.round(age / 60_000);
  return { state, label, updated: `updated ${min} min ago`, clock };
}

export function sydneyClock(when: Date): string {
  const parts = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Sydney',
    hour: 'numeric',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZoneName: 'short',
  }).formatToParts(when);
  const hour = parts.find((part) => part.type === 'hour')?.value ?? '';
  const minute = parts.find((part) => part.type === 'minute')?.value ?? '';
  const zone = parts.find((part) => part.type === 'timeZoneName')?.value ?? '';
  const name = zone === 'GMT+11' ? 'AEDT' : zone === 'GMT+10' ? 'AEST' : zone || 'AEDT';
  return `${hour}:${minute.padStart(2, '0')} ${name}`;
}

export function trialDay(desk: DeskSnapshot): number {
  const first = desk.equity_curve.find((point) => point.t)?.t;
  const end = desk.as_of || desk.status.heartbeat_at;
  if (!first || !end) return desk.status.window_day > 0 ? desk.status.window_day : 0;
  const startMs = Date.parse(first);
  const endMs = Date.parse(end);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return 0;
  return Math.max(1, Math.floor((endMs - startMs) / 86_400_000) + 1);
}

function trimNum(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return String(Math.round(value * 100) / 100);
}

function pct1(fraction: number): string {
  if (!Number.isFinite(fraction)) return '0.0%';
  return `${(Math.round(fraction * 1000) / 10).toFixed(1)}%`;
}

function ratio(value: number, cap: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(cap) || cap <= 0) return 0;
  return Math.max(0, Math.min(1, value / cap));
}

export function meters(desk: DeskSnapshot): CockpitView['meters'] {
  const risk = desk.health.open_risk;
  const limits = desk.health.limits;
  const day = trialDay(desk);
  const days = limits && desk.status.window_days > 0 ? desk.status.window_days : 28;
  return [
    {
      key: 'leverage',
      label: 'LEVERAGE',
      value: `${trimNum(risk.gross_leverage)}x`,
      cap: `${trimNum(limits.max_leverage)}x`,
      ratio: ratio(risk.gross_leverage, limits.max_leverage),
      hint: 'Gross paper leverage against the 2× cap. No order is sent.',
    },
    {
      key: 'trades',
      label: 'OPEN TRADES',
      value: String(risk.positions),
      cap: String(limits.max_positions),
      ratio: ratio(risk.positions, limits.max_positions),
      hint: 'Taken paper trades against the three-trade cap.',
    },
    {
      key: 'risk',
      label: 'RISK USED',
      value: pct1(risk.total_risk),
      cap: pct1(limits.total_risk_cap),
      ratio: ratio(risk.total_risk, limits.total_risk_cap),
      hint: 'Open risk as a share of paper equity, against the 2% cap.',
    },
    {
      key: 'day',
      label: 'TRIAL DAY',
      value: String(day),
      cap: String(days),
      ratio: ratio(day, days),
      hint: 'Days since the first paper equity row, of a 28-day trial.',
    },
  ];
}

function priceText(value: number): string {
  if (value >= 1000) return `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  if (value >= 100) return `$${value.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function latestPrice(desk: DeskSnapshot, market: string): number | null {
  const rows = desk.positions.filter((row) => row.market === market && Number.isFinite(row.entry));
  const row = rows.length ? rows[rows.length - 1] : null;
  return row ? row.entry : null;
}

function sideWord(side: string): string {
  return side.toLowerCase() === 'long' ? 'Long' : side.toLowerCase() === 'short' ? 'Short' : side;
}

export function marketStatus(desk: DeskSnapshot, market: string): { status: string; hint: string } {
  const open = [...desk.positions].reverse().find((row) => row.market === market && row.counts_toward_limits);
  if (open) {
    const side = sideWord(open.side);
    return {
      status: `In trade · ${side}`,
      hint: `A paper ${side.toLowerCase()} is open. It is not an order on an exchange.`,
    };
  }
  const signal = [...desk.signals]
    .filter((row) => row.market === market)
    .sort((a, b) => Date.parse(b.at ?? '') - Date.parse(a.at ?? ''))[0];
  if (signal && (signal.decision === 'skip' || signal.verdict === 'reject' || signal.skip_reason)) {
    const reason = signal.skip_reason || signal.verdict || 'skip';
    return {
      status: 'Skipped',
      hint: REASON_HINT[reason] ?? 'The latest check did not take a paper trade.',
    };
  }
  return { status: 'Waiting', hint: 'No paper trade is open, and nothing was skipped on the latest check.' };
}

export function marketTiles(desk: DeskSnapshot): CockpitView['markets'] {
  return STAGE1.map((symbol) => {
    const price = latestPrice(desk, symbol);
    const { status, hint } = marketStatus(desk, symbol);
    return {
      symbol,
      name: NAMES[symbol],
      price: price == null ? null : priceText(price),
      change: null,
      spark: [],
      status,
      hint: price == null
        ? `${hint} No price tape is stored.`
        : `${hint} ${priceText(price)} is the last recorded paper price, not a live quote. A 24 hour change is not stored.`,
    };
  });
}

function humanize(code: string): string {
  const cleaned = code.replaceAll('_', ' ').trim();
  if (!cleaned) return 'Noted';
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function signalDecision(row: DeskSnapshot['signals'][number]): { icon: DecisionIcon; text: string; hint: string } {
  const market = row.market;
  const side = sideWord(row.side);
  if (row.decision === 'trade' || (row.verdict === 'accept' && !row.skip_reason)) {
    const phrase = STRATEGY_SHORT[row.strategy] ?? 'Taken';
    return {
      icon: 'up',
      text: `${phrase} · ${market} · ${side}`,
      hint: STRATEGY_HINT[row.strategy] ?? 'A paper trade was taken. No order was sent.',
    };
  }
  if (row.verdict === 'verify_more' && !row.skip_reason) {
    return {
      icon: 'clock',
      text: `Needs another look · ${market}`,
      hint: 'More proof was required before a paper trade.',
    };
  }
  const reason = row.skip_reason || row.verdict || row.decision;
  return {
    icon: reason === 'verify_expired' || reason === 'session' ? 'clock' : 'warn',
    text: `${REASON_SHORT[reason] ?? humanize(reason)} · ${market}`,
    hint: REASON_HINT[reason] ?? 'The check did not take a paper trade.',
  };
}

function planDecision(row: DeskSnapshot['plans'][number]): { icon: DecisionIcon; text: string; hint: string } | null {
  if (row.outcome === 'closed_as_planned') {
    return {
      icon: 'check',
      text: `Closed as planned · ${row.market}`,
      hint: 'The paper close matched the plan. A dollar result is shown only when one is stored.',
    };
  }
  if (row.outcome === 'mismatch') {
    return {
      icon: 'warn',
      text: `Close did not match · ${row.market}`,
      hint: 'The paper close did not match the plan.',
    };
  }
  if (row.outcome === 'verify_more') {
    return {
      icon: 'clock',
      text: `Close still open · ${row.market}`,
      hint: 'The paper trade is still open, so the close has not been judged.',
    };
  }
  return null;
}

export function decisionLines(desk: DeskSnapshot): CockpitView['decisions'] {
  const rows: { at: number; index: number; icon: DecisionIcon; text: string; hint: string }[] = [];
  const push = (at: number, line: { icon: DecisionIcon; text: string; hint: string }) => {
    rows.push({ at, index: rows.length, ...line });
  };
  for (const signal of desk.signals) {
    push(Date.parse(signal.at ?? '') || 0, signalDecision(signal));
  }
  for (const plan of desk.plans) {
    const line = planDecision(plan);
    if (line) push(Date.parse(desk.as_of ?? '') || 0, line);
  }
  for (const event of desk.events) {
    push(Date.parse(event.at ?? '') || 0, {
      icon: event.severity === 'CRITICAL' || event.severity === 'WARN' ? 'warn' : 'clock',
      text: event.text,
      hint: 'A local notice. Nothing is sent from this page.',
    });
  }
  return rows
    .sort((a, b) => b.at - a.at || b.index - a.index)
    .slice(0, 7)
    .map(({ icon, text, hint }) => ({ icon, text, hint }));
}

export function healthStrip(desk: DeskSnapshot, now: Date): CockpitView['health'] {
  const age = desk.status.heartbeat_at ? Math.max(0, now.getTime() - Date.parse(desk.status.heartbeat_at)) : Number.POSITIVE_INFINITY;
  let feed: HealthState = 'HEALTHY';
  let feedHint = 'The last book was fresh.';
  if (!desk.status.heartbeat_at || !Number.isFinite(age) || age >= STALE_MS) {
    feed = 'DOWN';
    feedHint = !desk.status.heartbeat_at || !Number.isFinite(age)
      ? 'No heartbeat has been stored.'
      : 'The last book is older than 15 minutes.';
  } else if (age >= ONLINE_MS || desk.health.stale_blocks > 0) {
    feed = 'DEGRADED';
    feedHint = desk.health.stale_blocks > 0
      ? 'The book was stale when the engine last looked.'
      : 'The last book is more than 5 minutes old.';
  }

  const replay = desk.feed !== 'live' || (desk.banner ?? '').toLowerCase().includes('no live data');
  const database: HealthState = replay ? 'DEGRADED' : 'HEALTHY';
  const databaseHint = replay
    ? 'Showing the recorded replay. The live tables were empty or unread.'
    : 'A paper equity row was read.';

  let alerts: HealthState = 'HEALTHY';
  let alertsHint = 'Alerts are queued locally. Nothing is sent.';
  if (desk.events.some((event) => event.severity === 'CRITICAL')) {
    alerts = 'DOWN';
    alertsHint = 'A critical notice is in the local queue. Nothing is sent.';
  } else if (
    desk.events.some((event) => event.severity === 'WARN')
    || desk.health.false_closes > 0
    || desk.health.signal_escapes > 0
  ) {
    alerts = 'DEGRADED';
    alertsHint = 'A warning is in the local queue. Nothing is sent.';
  }

  return [
    { key: 'feed', label: 'DATA FEED', state: feed, hint: feedHint },
    { key: 'database', label: 'DATABASE', state: database, hint: databaseHint },
    { key: 'alerts', label: 'ALERTS', state: alerts, hint: alertsHint },
  ];
}

export function cockpitView(desk: DeskSnapshot, now: Date): CockpitView {
  const pnl = formatPnlPct(desk.pnl.shadow_pnl_pct);
  return {
    engine: engineChip(desk.status.heartbeat_at, now),
    pnl: {
      pct: desk.pnl.shadow_pnl_pct,
      ...pnl,
      hint: 'Percent change in stored paper equity from the starting balance. Open trades are not marked, so a separate unrealized figure is not added.',
    },
    meters: meters(desk),
    markets: marketTiles(desk),
    decisions: decisionLines(desk),
    health: healthStrip(desk, now),
  };
}
