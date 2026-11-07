import { createHmac, timingSafeEqual } from 'node:crypto';
import { STALE_AFTER_DAYS } from './constants';
import { timingSafeEqualStr } from '@/lib/private-access';
import { ageInDays } from './stats';
import { melbourneDate } from './time';

/** Daily Vercel cron in vercel.json. Times are UTC. */
export const REFRESH_UTC_HOUR = 13;
export const REFRESH_UTC_MINUTE = 15;
export const REFRESH_GRACE_MINUTES = 20;
export const ATTEMPT_COOKIE = 'pb_regime_refresh_attempt';

export const MANDATORY_SOURCE_IDS = ['WALCL', 'WTREGEN', 'RRPONTSYD', 'DGS2', 'DFEDTARU', 'DFF', 'BAMLH0A0HYM2'] as const;

const STALE_LIMIT: Record<string, number> = {
  WALCL: STALE_AFTER_DAYS.weekly,
  WTREGEN: STALE_AFTER_DAYS.weekly,
  RRPONTSYD: STALE_AFTER_DAYS.daily,
  DGS2: STALE_AFTER_DAYS.daily,
  DFEDTARU: STALE_AFTER_DAYS.daily,
  DFF: STALE_AFTER_DAYS.daily,
  BAMLH0A0HYM2: STALE_AFTER_DAYS.daily,
};

export type FetchOutcome = 'success' | 'partial' | 'failure';
export type RefreshOutcome = FetchOutcome | 'persistence_failure';

export interface ProviderSource {
  id: string;
  label: string;
  mandatory: boolean;
  observationDate: string | null;
  fetchedAt: string;
  error: string | null;
}

export interface RefreshHealth {
  outcome: RefreshOutcome;
  fetchOutcome: FetchOutcome;
  /** This attempt's health record was written to durable storage. */
  persisted: boolean;
  /** This attempt replaced the saved market snapshot. */
  snapshotSaved: boolean;
  durable: boolean;
  attemptedAt: string;
  lastFullySuccessfulFetchAt: string | null;
  lastPersistedAt: string | null;
  storage: 'vercel-blob' | 'unavailable';
  sources: ProviderSource[];
  note: string;
}

export function providerSource(input: {
  id: string;
  label: string;
  mandatory: boolean;
  observationDate: string | null;
  fetchedAt: string;
  error: string | null;
}): ProviderSource {
  const missing = !input.observationDate;
  return {
    id: input.id,
    label: input.label,
    mandatory: input.mandatory,
    observationDate: input.observationDate,
    fetchedAt: input.fetchedAt,
    error: input.error ?? (missing ? `${input.id} returned no observations` : null),
  };
}

export function classifyFetch(sources: ProviderSource[]): FetchOutcome {
  const mandatory = sources.filter((source) => source.mandatory);
  if (mandatory.length === 0 || mandatory.some((source) => source.error || !source.observationDate)) return 'failure';
  if (sources.some((source) => source.error || !source.observationDate)) return 'partial';
  return 'success';
}

/** Latest 13:15 UTC slot that is already past the grace window. */
export function lastScheduledRefresh(now: Date, graceMinutes = REFRESH_GRACE_MINUTES): string {
  const due = new Date(now.getTime() - graceMinutes * 60 * 1000);
  const slot = new Date(Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate(), REFRESH_UTC_HOUR, REFRESH_UTC_MINUTE, 0, 0));
  if (slot.getTime() > due.getTime()) slot.setUTCDate(slot.getUTCDate() - 1);
  return slot.toISOString();
}

export function refreshOverdue(lastAttemptedAt: string | null, now: Date): boolean {
  if (!lastAttemptedAt || !Number.isFinite(Date.parse(lastAttemptedAt))) return true;
  return Date.parse(lastAttemptedAt) < Date.parse(lastScheduledRefresh(now));
}

export function staleMandatorySource(sources: ProviderSource[], today: string): ProviderSource | null {
  for (const source of sources) {
    if (!source.mandatory) continue;
    const limit = STALE_LIMIT[source.id];
    if (limit == null) continue;
    if (!source.observationDate) return source;
    const age = ageInDays(source.observationDate, today);
    if (!Number.isFinite(age) || age > limit) return source;
  }
  return null;
}

export function refreshBlockReason(health: RefreshHealth | null, now: Date): string | null {
  if (!health || !health.durable || !health.persisted) {
    return 'No durable refresh is saved. Serverless disk and memory are not a saved snapshot. New buys stay off until a refresh is stored in Vercel Blob.';
  }
  if (health.fetchOutcome === 'failure' || health.outcome === 'failure') {
    return 'The latest refresh did not receive every mandatory feed. New buys stay off.';
  }
  if (refreshOverdue(health.attemptedAt, now)) {
    return `The scheduled refresh is overdue. The last attempt was ${health.attemptedAt}. The slot is 13:15 UTC. New buys stay off until a new attempt is saved.`;
  }
  const stale = staleMandatorySource(health.sources, melbourneDate(now));
  if (stale) {
    return `${stale.label} is outside its freshness window (period ${stale.observationDate ?? 'missing'}). New buys stay off.`;
  }
  return null;
}

export function settleRefresh(input: {
  now: Date;
  previous: RefreshHealth | null;
  sources: ProviderSource[];
  durable: boolean;
  writeOk: boolean;
}): RefreshHealth {
  const attemptedAt = input.now.toISOString();
  const fetchOutcome = classifyFetch(input.sources);
  const snapshotSaved = input.durable && input.writeOk && fetchOutcome !== 'failure';
  const persisted = input.durable && input.writeOk;
  const outcome: RefreshOutcome = !persisted ? 'persistence_failure' : fetchOutcome;
  const lastFullySuccessfulFetchAt = fetchOutcome === 'success'
    ? attemptedAt
    : input.previous?.lastFullySuccessfulFetchAt ?? null;
  const lastPersistedAt = snapshotSaved ? attemptedAt : input.previous?.lastPersistedAt ?? null;
  const note = !input.durable
    ? 'Vercel Blob is not configured. This attempt was not saved. Serverless disk is not durable. Create a Blob store and set BLOB_READ_WRITE_TOKEN. This change does not create that store.'
    : !input.writeOk
      ? 'The refresh ran and the durable write failed. The previous saved snapshot, if there was one, was left in place.'
      : fetchOutcome === 'failure'
        ? 'Mandatory feeds failed. The previous saved snapshot was kept and new buys stay off.'
        : fetchOutcome === 'partial'
          ? 'Mandatory feeds arrived. At least one optional feed failed, so this is a partial refresh.'
          : 'Every requested feed arrived and the snapshot was saved.';
  return {
    outcome,
    fetchOutcome,
    persisted,
    snapshotSaved,
    durable: input.durable,
    attemptedAt,
    lastFullySuccessfulFetchAt,
    lastPersistedAt,
    storage: input.durable ? 'vercel-blob' : 'unavailable',
    sources: input.sources,
    note,
  };
}

export function refreshLogLine(phase: 'start' | 'end' | 'failure', fields: Record<string, string | number | boolean | null>): string {
  return JSON.stringify({ event: 'regime_refresh', phase, ...fields });
}

export function signRefreshCsrf(secret: string, sessionToken: string): string {
  return createHmac('sha256', secret).update(`regime-refresh:${sessionToken}`).digest('base64url');
}

export function refreshCsrfMatches(secret: string, sessionToken: string, provided: string): boolean {
  const expected = signRefreshCsrf(secret, sessionToken);
  return timingSafeEqualStr(expected, provided);
}

export function signAttemptCookie(secret: string, health: RefreshHealth): string {
  const body = Buffer.from(JSON.stringify(health), 'utf8').toString('base64url');
  const sig = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function openAttemptCookie(secret: string, raw: string | undefined): RefreshHealth | null {
  if (!raw) return null;
  const dot = raw.lastIndexOf('.');
  if (dot <= 0) return null;
  const body = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  const expected = createHmac('sha256', secret).update(body).digest('base64url');
  const left = Buffer.from(sig);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as RefreshHealth;
    if (!parsed || !Array.isArray(parsed.sources) || typeof parsed.attemptedAt !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}
