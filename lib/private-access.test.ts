import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import {
  decideAccess,
  isCronAuthorized,
  isEmailAllowed,
  isIpAllowed,
  timingSafeEqualStr,
} from './private-access';

function src(rel: string): string {
  return readFileSync(path.join(process.cwd(), rel), 'utf8');
}

describe('owner allowlists', () => {
  it('matches emails case-insensitively and rejects blanks', () => {
    assert.equal(isEmailAllowed('Owner@Example.com', 'owner@example.com, other@example.com'), true);
    assert.equal(isEmailAllowed('nope@example.com', 'owner@example.com'), false);
    assert.equal(isEmailAllowed(null, 'owner@example.com'), false);
    assert.equal(isEmailAllowed('owner@example.com', ''), false);
    assert.equal(isEmailAllowed('owner@example.com', undefined), false);
  });

  it('matches IPs exactly and rejects an empty client IP', () => {
    assert.equal(isIpAllowed('203.0.113.8', '203.0.113.8, 198.51.100.2'), true);
    assert.equal(isIpAllowed('203.0.113.9', '203.0.113.8'), false);
    assert.equal(isIpAllowed('', '203.0.113.8'), false);
  });

  it('accepts only an exact bearer cron secret', () => {
    assert.equal(isCronAuthorized('Bearer hunt-the-quiet', 'hunt-the-quiet'), true);
    assert.equal(isCronAuthorized('Bearer hunt-the-quiet', 'other'), false);
    assert.equal(isCronAuthorized('Bearer ', 'hunt-the-quiet'), false);
    assert.equal(isCronAuthorized('hunt-the-quiet', 'hunt-the-quiet'), false);
    assert.equal(isCronAuthorized('Bearer hunt-the-quiet', ''), false);
    assert.equal(isCronAuthorized('Bearer hunt-the-quiet', undefined), false);
    assert.equal(timingSafeEqualStr('abc', 'abcd'), false);
  });
});

describe('decideAccess', () => {
  const closed = {
    ipAllowed: false,
    cronAuthorized: false,
    email: null,
    emailAllowed: false,
    emailsConfigured: false,
    supabaseConfigured: false,
  };

  it('fails closed when nothing is configured', () => {
    assert.equal(decideAccess({ ...closed, surface: 'os' }), 'deny');
  });

  it('lets an allowlisted IP through and does not let the cron secret open a page', () => {
    assert.equal(decideAccess({ ...closed, surface: 'os', ipAllowed: true }), 'allow');
    assert.equal(decideAccess({ ...closed, surface: 'os', cronAuthorized: true }), 'deny');
  });

  it('sends anonymous page viewers to login when Supabase and the email list are set', () => {
    const ready = { ...closed, emailsConfigured: true, supabaseConfigured: true };
    assert.equal(decideAccess({ ...ready, surface: 'os' }), 'login');
  });

  it('allows only the owner email and denies everyone else who is signed in', () => {
    const ready = { ...closed, emailsConfigured: true, supabaseConfigured: true };
    assert.equal(decideAccess({
      ...ready,
      surface: 'os',
      email: 'owner@example.com',
      emailAllowed: true,
    }), 'allow');
    assert.equal(decideAccess({
      ...ready,
      surface: 'os',
      email: 'guest@example.com',
      emailAllowed: false,
    }), 'deny');
  });
});

describe('regime stays out of public surfaces', () => {
  it('is disallowed by robots and absent from the sitemap, home page, and OS nav', () => {
    const robots = src('app/robots.ts');
    const sitemap = src('app/sitemap.ts');
    const home = src('app/page.tsx');
    const osNav = src('components/os/OsShell.tsx');
    assert.match(robots, /\/private\//);
    assert.equal(sitemap.includes('/private'), false);
    assert.equal(home.includes('/private/regime'), false);
    assert.equal(home.includes('/private/login'), false);
    assert.equal(osNav.includes('/private/regime'), false);
    assert.equal(osNav.includes('/private/login'), false);
  });

  it('protects the page and the API in middleware without Supabase for regime', () => {
    const middleware = src('middleware.ts');
    const guard = src('lib/regime/guard.ts');
    assert.match(middleware, /\/private\/:path\*/);
    assert.match(middleware, /\/api\/regime\/:path\*/);
    assert.match(middleware, /REGIME_PASSWORD_HASH/);
    assert.match(middleware, /REGIME_SESSION_SECRET/);
    assert.match(middleware, /REGIME_ALLOWED_IPS/);
    assert.equal(middleware.includes('REGIME_OWNER_EMAILS'), false);
    assert.equal((middleware.match(/getUser\(/g) ?? []).length, 2);
    assert.equal(guard.includes('supabase'), false);
    assert.equal(src('lib/regime/load.ts').includes('supabase'), false);
  });
});
