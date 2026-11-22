/**
 * Earnings check for one candidate. Yahoo Finance, no API key.
 * A missing field stays null. The page prints n/a. Nothing is estimated.
 */

export const EARNINGS_SOURCE = 'Yahoo Finance';
export const EARNINGS_FRESH_HOURS = 18;
const UA = 'passiveblocks-regime/1.0 (owner research dashboard)';

export interface EarningsCheck {
  symbol: string;
  fetchedAt: string | null;
  source: typeof EARNINGS_SOURCE;
  nextDate: string | null;
  lastReported: string | null;
  epsActual: number | null;
  epsEstimate: number | null;
  /** Already formatted, for example "-49%". Null when Yahoo did not send it. */
  epsSurprise: string | null;
  revenueActual: number | null;
  revenueEstimate: number | null;
  revenueSurprise: string | null;
  currency: 'USD' | 'AUD';
  revision: 'up' | 'down' | 'flat' | null;
  revisionFrom: number | null;
  revisionTo: number | null;
  revisionLabel: string | null;
  /** True when the source has no fundamentals for this ticker, as with most funds. */
  unavailable: boolean;
  error: string | null;
}

export interface EarningsCardCopy {
  next: string;
  flag: string | null;
  eps: string;
  revenue: string;
  revision: string;
}

export const EARNINGS_FLAG = 'Earnings within 7 days';

export function blankEarnings(symbol: string, error: string | null = null): EarningsCheck {
  return {
    symbol,
    fetchedAt: null,
    source: EARNINGS_SOURCE,
    nextDate: null,
    lastReported: null,
    epsActual: null,
    epsEstimate: null,
    epsSurprise: null,
    revenueActual: null,
    revenueEstimate: null,
    revenueSurprise: null,
    currency: symbol.endsWith('.AX') ? 'AUD' : 'USD',
    revision: null,
    revisionFrom: null,
    revisionTo: null,
    revisionLabel: null,
    unavailable: false,
    error,
  };
}

export function earningsFresh(fetchedAt: string, now: Date, hours = EARNINGS_FRESH_HOURS): boolean {
  const age = now.getTime() - Date.parse(fetchedAt);
  return Number.isFinite(age) && age >= 0 && age < hours * 3_600_000;
}

function num(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value && typeof value === 'object' && 'raw' in value) {
    const raw = (value as { raw?: unknown }).raw;
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  }
  return null;
}

function dayFmt(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const fmt = 'fmt' in value && typeof (value as { fmt?: unknown }).fmt === 'string' ? (value as { fmt: string }).fmt : '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(fmt)) return fmt;
  const raw = num(value);
  if (raw == null) return null;
  return new Date(raw * 1000).toISOString().slice(0, 10);
}

function surpriseText(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const fmt = 'fmt' in value && typeof (value as { fmt?: unknown }).fmt === 'string' ? (value as { fmt: string }).fmt : '';
  if (fmt.includes('%')) {
    const negative = fmt.trim().startsWith('-');
    const body = fmt.trim().replace(/^[+-]/, '');
    return negative ? `−${body}` : `+${body}`;
  }
  const raw = num(value);
  if (raw == null) return null;
  const pct = Math.abs(raw) <= 3 ? raw * 100 : raw;
  const body = `${Math.abs(pct).toFixed(0)}%`;
  return pct < 0 ? `−${body}` : body;
}

interface TrendRow {
  period?: string;
  epsTrend?: { current?: unknown; '90daysAgo'?: unknown };
}

function revisionOf(trends: TrendRow[]): Pick<EarningsCheck, 'revision' | 'revisionFrom' | 'revisionTo' | 'revisionLabel'> {
  const order: { period: string; label: string }[] = [
    { period: '0q', label: 'Next quarter EPS' },
    { period: '+1q', label: 'The quarter after next, EPS' },
    { period: '0y', label: 'This year\'s EPS' },
  ];
  for (const wanted of order) {
    const row = trends.find((item) => item.period === wanted.period);
    const current = num(row?.epsTrend?.current);
    const ago = num(row?.epsTrend?.['90daysAgo']);
    if (current == null || ago == null) continue;
    const gap = current - ago;
    const revision = gap > 0.01 ? 'up' : gap < -0.01 ? 'down' : 'flat';
    return { revision, revisionFrom: ago, revisionTo: current, revisionLabel: wanted.label };
  }
  return { revision: null, revisionFrom: null, revisionTo: null, revisionLabel: null };
}

/** Read a Yahoo quoteSummary body. Unknown shapes become n/a, not guesses. */
export function parseEarningsPayload(symbol: string, body: unknown, fetchedAt: string): EarningsCheck {
  const check = blankEarnings(symbol);
  check.fetchedAt = fetchedAt;
  const summary = body && typeof body === 'object' && 'quoteSummary' in body
    ? (body as { quoteSummary?: { result?: unknown; error?: { code?: string } } }).quoteSummary
    : null;
  const errorCode = summary?.error?.code ?? '';
  if (errorCode === 'Not Found') {
    check.unavailable = true;
    return check;
  }
  const result = Array.isArray(summary?.result) ? summary?.result[0] : null;
  if (!result || typeof result !== 'object') {
    check.error = 'The earnings check did not arrive.';
    return check;
  }
  const row = result as {
    calendarEvents?: { earnings?: { earningsDate?: unknown[] } };
    earningsHistory?: { history?: unknown[] };
    earnings?: { financialsChart?: { quarterly?: unknown[] } };
    earningsTrend?: { trend?: TrendRow[] };
  };
  const dates = row.calendarEvents?.earnings?.earningsDate;
  if (Array.isArray(dates) && dates.length > 0) check.nextDate = dayFmt(dates[0]);
  const history = Array.isArray(row.earningsHistory?.history) ? row.earningsHistory?.history ?? [] : [];
  let last: { date: string; raw: Record<string, unknown> } | null = null;
  for (const item of history) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    const date = dayFmt(record.quarter) ?? dayFmt(record.period);
    if (!date) continue;
    if (!last || date > last.date) last = { date, raw: record };
  }
  if (last) {
    check.lastReported = last.date;
    check.epsActual = num(last.raw.epsActual);
    check.epsEstimate = num(last.raw.epsEstimate);
    check.epsSurprise = surpriseText(last.raw.surprisePercent);
  }
  const quarters = row.earnings?.financialsChart?.quarterly;
  if (Array.isArray(quarters) && quarters.length > 0) {
    const tail = quarters[quarters.length - 1];
    if (tail && typeof tail === 'object' && 'revenue' in tail) {
      check.revenueActual = num((tail as { revenue?: unknown }).revenue);
    }
  }
  // Yahoo's free modules used here do not include last quarter's revenue consensus.
  check.revenueEstimate = null;
  check.revenueSurprise = null;
  const revision = revisionOf(Array.isArray(row.earningsTrend?.trend) ? row.earningsTrend?.trend ?? [] : []);
  return { ...check, ...revision, error: null };
}

function daysUntil(today: string, next: string): number | null {
  const start = Date.parse(`${today}T00:00:00Z`);
  const end = Date.parse(`${next}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.round((end - start) / 86_400_000);
}

function plainDay(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  if (!year || !month || !day) return iso;
  return `${day} ${months[month - 1]} ${year}`;
}

function epsNum(value: number): string {
  return value.toFixed(2);
}

function revenueText(value: number, currency: 'USD' | 'AUD'): string {
  const unit = currency === 'AUD' ? 'A$' : 'US$';
  const abs = Math.abs(value);
  const sign = value < 0 ? '−' : '';
  if (abs >= 1e9) return `${sign}${unit}${(abs / 1e9).toFixed(2)}bn`;
  if (abs >= 1e6) return `${sign}${unit}${Math.round(abs / 1e6)}m`;
  return `${sign}${unit}${abs.toFixed(0)}`;
}

export function earningsCopy(check: EarningsCheck | null, today: string): EarningsCardCopy {
  if (!check) {
    return {
      next: 'Next earnings: n/a.',
      flag: null,
      eps: 'Last quarter EPS: n/a.',
      revenue: 'Revenue surprise: n/a.',
      revision: 'Analyst estimates over about 90 days: n/a.',
    };
  }
  const until = check.nextDate ? daysUntil(today, check.nextDate) : null;
  const nextIsAhead = until != null && until >= 0;
  const reportedOn = !nextIsAhead && check.nextDate ? check.nextDate : check.lastReported;
  const next = nextIsAhead && check.nextDate
    ? `Next earnings: ${plainDay(check.nextDate)}.`
    : reportedOn
      ? `Next earnings: n/a. Last report was ${plainDay(reportedOn)}.`
      : 'Next earnings: n/a.';
  const flag = until != null && until >= 0 && until <= 7 ? EARNINGS_FLAG : null;
  let eps = 'Last quarter EPS: n/a.';
  if (check.epsActual != null && check.epsEstimate != null) {
    const surprise = check.epsSurprise ? ` (${check.epsSurprise})` : '';
    eps = `Last quarter EPS: ${epsNum(check.epsActual)} against a consensus of ${epsNum(check.epsEstimate)}${surprise}.`;
  } else if (check.epsActual != null) {
    eps = `Last quarter EPS: ${epsNum(check.epsActual)}. Consensus: n/a.`;
  }
  let revenue = 'Revenue surprise: n/a.';
  if (check.revenueActual != null && check.revenueSurprise) {
    revenue = `Revenue surprise: ${check.revenueSurprise}.`;
  } else if (check.revenueActual != null) {
    revenue = `Revenue surprise: n/a. Last quarter revenue was ${revenueText(check.revenueActual, check.currency)}.`;
  }
  let revision = 'Analyst estimates over about 90 days: n/a.';
  if (check.revision && check.revisionFrom != null && check.revisionTo != null && check.revisionLabel) {
    const word = check.revision === 'up' ? 'revised up' : check.revision === 'down' ? 'revised down' : 'little changed';
    revision = `Analyst estimates over about 90 days: ${word}. ${check.revisionLabel} moved from ${epsNum(check.revisionFrom)} to ${epsNum(check.revisionTo)}.`;
  }
  return { next, flag, eps, revenue, revision };
}

interface YahooSession {
  cookie: string;
  crumb: string;
}

async function yahooSession(fetchImpl: typeof fetch): Promise<YahooSession | null> {
  let gate: Response;
  try {
    gate = await fetchImpl('https://fc.yahoo.com', {
      redirect: 'manual',
      signal: AbortSignal.timeout(8_000),
      headers: { 'user-agent': UA },
    });
  } catch {
    return null;
  }
  const jar = typeof gate.headers.getSetCookie === 'function'
    ? gate.headers.getSetCookie()
    : [gate.headers.get('set-cookie') ?? ''];
  const cookie = jar.map((item) => item.split(';')[0]?.trim()).filter((item) => item && item.includes('=')).join('; ');
  if (!cookie) return null;
  let crumbRes: Response;
  try {
    crumbRes = await fetchImpl('https://query1.finance.yahoo.com/v1/test/getcrumb', {
      signal: AbortSignal.timeout(8_000),
      headers: { 'user-agent': UA, cookie },
    });
  } catch {
    return null;
  }
  const crumb = (await crumbRes.text()).trim();
  if (!crumb || crumb.startsWith('{') || crumb.length > 64) return null;
  return { cookie, crumb };
}

/** One ticker. A thrown network error becomes an error check, not a throw. */
export async function fetchEarningsCheck(symbol: string, now: Date, fetchImpl: typeof fetch = fetch, session?: YahooSession | null): Promise<EarningsCheck> {
  const auth = session === undefined ? await yahooSession(fetchImpl) : session;
  if (!auth) return { ...blankEarnings(symbol, 'The earnings check did not arrive.'), fetchedAt: now.toISOString() };
  const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=calendarEvents,earningsHistory,earnings,earningsTrend&crumb=${encodeURIComponent(auth.crumb)}`;
  try {
    const response = await fetchImpl(url, {
      signal: AbortSignal.timeout(8_000),
      headers: { 'user-agent': UA, cookie: auth.cookie },
    });
    if (!response.ok && response.status !== 404) {
      return { ...blankEarnings(symbol, 'The earnings check did not arrive.'), fetchedAt: now.toISOString() };
    }
    const body: unknown = await response.json();
    return parseEarningsPayload(symbol, body, now.toISOString());
  } catch {
    return { ...blankEarnings(symbol, 'The earnings check did not arrive.'), fetchedAt: now.toISOString() };
  }
}

export async function fetchEarningsMany(symbols: readonly string[], now: Date, fetchImpl: typeof fetch = fetch): Promise<EarningsCheck[]> {
  const session = await yahooSession(fetchImpl);
  const out: EarningsCheck[] = [];
  let next = 0;
  async function worker() {
    while (next < symbols.length) {
      const index = next;
      next += 1;
      out[index] = await fetchEarningsCheck(symbols[index], now, fetchImpl, session);
    }
  }
  const workers: Promise<void>[] = [];
  const count = Math.min(4, symbols.length);
  for (let i = 0; i < count; i++) workers.push(worker());
  await Promise.all(workers);
  return out;
}

/** Fixture checks for the preview page. Dates are fixed so the 7-day flag stays put. */
export function sampleEarningsChecks(): EarningsCheck[] {
  const at = '2026-11-21T21:00:00.000Z';
  const fund = (symbol: string): EarningsCheck => ({ ...blankEarnings(symbol), fetchedAt: at, unavailable: true });
  const ntra: EarningsCheck = {
    ...blankEarnings('NTRA'),
    fetchedAt: at,
    nextDate: '2026-11-26',
    lastReported: '2026-11-05',
    epsActual: -0.42,
    epsEstimate: -0.28,
    epsSurprise: '−49%',
    revenueActual: 793_981_000,
    revision: 'down',
    revisionFrom: -0.07,
    revisionTo: -0.15,
    revisionLabel: 'Next quarter EPS',
  };
  const amzn: EarningsCheck = {
    ...blankEarnings('AMZN'),
    fetchedAt: at,
    nextDate: '2027-02-05',
    lastReported: '2026-10-30',
    epsActual: 1.95,
    epsEstimate: 1.57,
    epsSurprise: '+24%',
    revenueActual: 158_000_000_000,
    revision: 'up',
    revisionFrom: 1.7,
    revisionTo: 1.86,
    revisionLabel: 'Next quarter EPS',
  };
  const stx: EarningsCheck = {
    ...blankEarnings('STX'),
    fetchedAt: at,
    nextDate: '2026-11-24',
    lastReported: '2026-10-28',
    epsActual: 2.1,
    epsEstimate: 2.4,
    epsSurprise: '−13%',
    revision: 'down',
    revisionFrom: 2.5,
    revisionTo: 2.2,
    revisionLabel: 'Next quarter EPS',
  };
  return [
    ntra,
    fund('HACK.AX'),
    amzn,
    { ...blankEarnings('INSM'), fetchedAt: at },
    stx,
    fund('GDX.AX'),
    fund('SEMI.AX'),
  ];
}
