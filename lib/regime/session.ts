import { timingSafeEqualStr } from '@/lib/private-access';

/** Owner session. 12 hours, absolute, embedded in the signed payload. */
export const SESSION_TTL_SECONDS = 60 * 60 * 12;
export const REGIME_COOKIE = 'pb_regime_session';
export const MIN_SESSION_SECRET_LENGTH = 32;

const HASH_RE = /^scrypt\$16384\$8\$1\$[A-Za-z0-9_-]{16,}\$[A-Za-z0-9_-]{16,}$/;

export function regimeLoginConfigured(
  hash: string | undefined = process.env.REGIME_PASSWORD_HASH,
  secret: string | undefined = process.env.REGIME_SESSION_SECRET,
): boolean {
  return Boolean(hash && HASH_RE.test(hash) && secret && secret.length >= MIN_SESSION_SECRET_LENGTH);
}

export function sessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: true,
    sameSite: 'strict' as const,
    path: '/',
    maxAge,
  };
}

/** Only same-origin regime pages. Rejects protocol-relative and traversal targets. */
export function safeRegimeNext(raw: string | null | undefined): string {
  if (!raw) return '/private/regime';
  let value = raw;
  try {
    value = decodeURIComponent(raw);
  } catch {
    return '/private/regime';
  }
  if (!value.startsWith('/private/')) return '/private/regime';
  if (value.startsWith('//') || value.includes('\\') || value.includes('://')) return '/private/regime';
  if (value.includes('..')) return '/private/regime';
  if (value.startsWith('/private/login') || value.startsWith('/private/logout')) return '/private/regime';
  return value;
}

function bytesToB64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function b64UrlToBytes(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((value.length + 3) % 4);
  let bin: string;
  try {
    bin = atob(padded);
  } catch {
    return null;
  }
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return bytesToB64Url(new Uint8Array(sig));
}

export async function signSession(secret: string, expSec: number): Promise<string> {
  const body = bytesToB64Url(new TextEncoder().encode(JSON.stringify({ v: 1, exp: expSec })));
  const sig = await hmac(secret, body);
  return `${body}.${sig}`;
}

/**
 * True only when the HMAC matches the session secret and exp is still in the future.
 * A flipped character, a different secret, or a past exp all fail.
 */
export async function verifySession(
  token: string | undefined,
  secret: string | undefined,
  nowSec: number,
): Promise<boolean> {
  if (!token || !secret || secret.length < MIN_SESSION_SECRET_LENGTH) return false;
  const dot = token.indexOf('.');
  if (dot <= 0 || dot !== token.lastIndexOf('.')) return false;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = await hmac(secret, body);
  if (!timingSafeEqualStr(sig, expected)) return false;
  const raw = b64UrlToBytes(body);
  if (!raw) return false;
  let payload: { v?: unknown; exp?: unknown };
  try {
    payload = JSON.parse(new TextDecoder().decode(raw));
  } catch {
    return false;
  }
  if (payload.v !== 1 || typeof payload.exp !== 'number' || !Number.isFinite(payload.exp)) return false;
  return payload.exp > nowSec;
}
