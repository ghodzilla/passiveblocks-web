/**
 * Deny-by-default access policy for /os and /drafts.
 * The regime dashboard does not use this. See lib/regime/access.ts.
 * Edge-safe: middleware imports this file. No Node-only APIs.
 */

export type AccessSurface = 'os';
export type AccessDecision = 'allow' | 'deny' | 'login';

export function parseList(raw: string | undefined): string[] {
  return (raw || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

export function supabaseConfigured(
  url: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL,
  anon: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
): boolean {
  return Boolean(url && anon);
}

export function clientIp(xff: string | null, realIp: string | null): string {
  if (xff) return xff.split(',')[0]?.trim() || '';
  return (realIp || '').trim();
}

export function isIpAllowed(ip: string, raw: string | undefined): boolean {
  if (!ip) return false;
  return parseList(raw).includes(ip);
}

export function isEmailAllowed(email: string | null | undefined, raw: string | undefined): boolean {
  if (!email) return false;
  const list = parseList(raw).map((entry) => entry.toLowerCase());
  return list.includes(email.trim().toLowerCase());
}

/** Constant-time string compare that does not throw on length mismatch. */
export function timingSafeEqualStr(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const left = enc.encode(a);
  const right = enc.encode(b);
  const len = Math.max(left.length, right.length);
  let diff = left.length ^ right.length;
  for (let i = 0; i < len; i++) {
    diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  }
  return diff === 0;
}

export function isCronAuthorized(
  header: string | null,
  secret: string | undefined = process.env.CRON_SECRET,
): boolean {
  if (!secret || !header) return false;
  const match = /^Bearer\s+(\S+)\s*$/.exec(header);
  if (!match) return false;
  return timingSafeEqualStr(match[1], secret);
}

/**
 * Fail closed for /os and /drafts.
 * - ALLOWED_IPS short-circuits without a Supabase session.
 * - Signed-out browsers are sent to the magic-link login only when Supabase
 *   and OS_ALLOWED_EMAILS are both configured. Otherwise 404.
 * - A signed-in email that is not on the list is denied.
 * - cronAuthorized is ignored. CRON_SECRET cannot open these pages.
 */
export function decideAccess(input: {
  surface: AccessSurface;
  ipAllowed: boolean;
  cronAuthorized: boolean;
  email: string | null;
  emailAllowed: boolean;
  emailsConfigured: boolean;
  supabaseConfigured: boolean;
}): AccessDecision {
  void input.surface;
  void input.cronAuthorized;
  if (input.ipAllowed) return 'allow';

  const canUseEmail = input.supabaseConfigured && input.emailsConfigured;
  if (!canUseEmail) return 'deny';
  if (input.email && input.emailAllowed) return 'allow';
  if (input.email) return 'deny';
  return 'login';
}
