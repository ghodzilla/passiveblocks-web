import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { decideRegimeAccess } from './access';
import { evaluateLogin } from './login';
import { createAttemptGuard } from './lockout';
import { hashPassword, verifyPassword } from './password';
import {
  regimeLoginConfigured,
  safeRegimeNext,
  sessionCookieOptions,
  signSession,
  verifySession,
} from './session';

const SECRET = 'regime-session-secret-must-be-32b';

function flipLast(value: string): string {
  const chars = value.split('');
  const i = chars.length - 1;
  chars[i] = chars[i] === 'a' ? 'b' : 'a';
  return chars.join('');
}

function tamperHash(encoded: string): string {
  const parts = encoded.split('$');
  const hash = parts[5];
  parts[5] = (hash[0] === 'A' ? 'B' : 'A') + hash.slice(1);
  return parts.join('$');
}

describe('password hash', () => {
  it('accepts the right password and rejects a wrong one', async () => {
    const encoded = hashPassword('correct-horse-battery');
    assert.equal(await verifyPassword('correct-horse-battery', encoded), true);
    assert.equal(await verifyPassword('wrong-horse-battery', encoded), false);
    assert.equal(await verifyPassword('', encoded), false);
  });

  it('rejects a tampered hash', async () => {
    const encoded = hashPassword('correct-horse-battery');
    assert.equal(regimeLoginConfigured(encoded, SECRET), true);
    assert.equal(await verifyPassword('correct-horse-battery', tamperHash(encoded)), false);
    assert.equal(regimeLoginConfigured('sha256$not-scrypt', SECRET), false);
    assert.equal(regimeLoginConfigured(encoded, 'short-secret'), false);
  });
});

describe('session cookie', () => {
  it('round-trips a signed cookie and rejects tampering, the wrong secret, and expiry', async () => {
    const now = 1_700_000_000;
    const token = await signSession(SECRET, now + 60);
    assert.equal(await verifySession(token, SECRET, now), true);

    const [body, sig] = token.split('.');
    assert.equal(await verifySession(`${body}.${flipLast(sig)}`, SECRET, now), false);
    assert.equal(await verifySession(`${flipLast(body)}.${sig}`, SECRET, now), false);
    assert.equal(await verifySession(`${token}.extra`, SECRET, now), false);
    assert.equal(await verifySession(token, `${SECRET}-other`, now), false);

    const expired = await signSession(SECRET, now);
    assert.equal(await verifySession(expired, SECRET, now), false);
    const stillValid = await signSession(SECRET, now + 1);
    assert.equal(await verifySession(stillValid, SECRET, now), true);
  });

  it('sets an httpOnly Secure SameSite=Strict cookie', () => {
    const options = sessionCookieOptions(60 * 60 * 12);
    assert.equal(options.httpOnly, true);
    assert.equal(options.secure, true);
    assert.equal(options.sameSite, 'strict');
    assert.equal(options.path, '/');
    assert.equal(options.maxAge, 60 * 60 * 12);
  });
});

describe('login lockout', () => {
  it('locks after five failures and still rejects the right password until the lock ends', async () => {
    const encoded = hashPassword('correct-horse-battery');
    const t = 1_000_000;
    const guard = createAttemptGuard({
      maxFailures: 5,
      windowMs: 15 * 60 * 1000,
      lockMs: 15 * 60 * 1000,
      now: () => t,
    });

    for (let i = 0; i < 4; i++) {
      const result = await evaluateLogin({
        password: 'nope',
        hash: encoded,
        secret: SECRET,
        ip: '203.0.113.8',
        nowSec: 1_700_000_000,
        guard,
      });
      assert.deepEqual(result, { ok: false, reason: 'rejected' });
    }

    const fifth = await evaluateLogin({
      password: 'nope',
      hash: encoded,
      secret: SECRET,
      ip: '203.0.113.8',
      nowSec: 1_700_000_000,
      guard,
    });
    assert.deepEqual(fifth, { ok: false, reason: 'locked' });

    const duringLock = await evaluateLogin({
      password: 'correct-horse-battery',
      hash: encoded,
      secret: SECRET,
      ip: '203.0.113.8',
      nowSec: 1_700_000_000,
      guard,
    });
    assert.deepEqual(duringLock, { ok: false, reason: 'locked' });

    const otherIp = await evaluateLogin({
      password: 'correct-horse-battery',
      hash: encoded,
      secret: SECRET,
      ip: '198.51.100.2',
      nowSec: 1_700_000_000,
      guard,
    });
    assert.equal(otherIp.ok, true);

    const unconfigured = await evaluateLogin({
      password: 'correct-horse-battery',
      hash: undefined,
      secret: SECRET,
      ip: '203.0.113.9',
      nowSec: 1_700_000_000,
      guard,
    });
    assert.deepEqual(unconfigured, { ok: false, reason: 'rejected' });
    assert.equal(guard.status('203.0.113.9').locked, false);
  });
});

describe('decideRegimeAccess', () => {
  const base = {
    ipAllowed: false,
    cronAuthorized: false,
    sessionValid: false,
    loginConfigured: false,
  };

  it('sends an anonymous page to login only when configured, and always hides the API', () => {
    assert.equal(decideRegimeAccess({ ...base, surface: 'regime-page', loginConfigured: true }), 'login');
    assert.equal(decideRegimeAccess({ ...base, surface: 'regime-page' }), 'deny');
    assert.equal(decideRegimeAccess({ ...base, surface: 'regime-api', loginConfigured: true }), 'deny');
  });

  it('lets cron open the API only, and lets a session or allowlisted IP open both', () => {
    assert.equal(decideRegimeAccess({ ...base, surface: 'regime-api', cronAuthorized: true }), 'allow');
    assert.equal(decideRegimeAccess({ ...base, surface: 'regime-page', cronAuthorized: true }), 'deny');
    assert.equal(decideRegimeAccess({ ...base, surface: 'regime-page', sessionValid: true }), 'allow');
    assert.equal(decideRegimeAccess({ ...base, surface: 'regime-api', sessionValid: true }), 'allow');
    assert.equal(decideRegimeAccess({ ...base, surface: 'regime-page', ipAllowed: true }), 'allow');
    assert.equal(decideRegimeAccess({ ...base, surface: 'regime-api', ipAllowed: true }), 'allow');
  });
});

describe('safeRegimeNext', () => {
  it('keeps regime paths and drops open redirects', () => {
    assert.equal(safeRegimeNext(null), '/private/regime');
    assert.equal(safeRegimeNext('/private/regime'), '/private/regime');
    assert.equal(safeRegimeNext('/private/regime?x=1'), '/private/regime?x=1');
    assert.equal(safeRegimeNext('//evil.example'), '/private/regime');
    assert.equal(safeRegimeNext('/os'), '/private/regime');
    assert.equal(safeRegimeNext('/private/login'), '/private/regime');
    assert.equal(safeRegimeNext('/private/regime/../os'), '/private/regime');
    assert.equal(safeRegimeNext('https://evil.example'), '/private/regime');
    assert.equal(safeRegimeNext('%2F%2Fevil.example'), '/private/regime');
  });
});
