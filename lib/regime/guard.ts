import { cookies, headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { clientIp, isCronAuthorized, isIpAllowed } from '@/lib/private-access';
import { decideRegimeAccess } from './access';
import { REGIME_COOKIE, regimeLoginConfigured, verifySession } from './session';

function requestIpAllowed(): boolean {
  const h = headers();
  return isIpAllowed(
    clientIp(h.get('x-forwarded-for'), h.get('x-real-ip')),
    process.env.REGIME_ALLOWED_IPS,
  );
}

export async function hasRegimeSession(): Promise<boolean> {
  const token = cookies().get(REGIME_COOKIE)?.value;
  return verifySession(
    token,
    process.env.REGIME_SESSION_SECRET,
    Math.floor(Date.now() / 1000),
  );
}

export async function enforceRegimePage(): Promise<void> {
  const ipAllowed = requestIpAllowed();
  const sessionValid = ipAllowed ? false : await hasRegimeSession();
  const decision = decideRegimeAccess({
    surface: 'regime-page',
    ipAllowed,
    cronAuthorized: false,
    sessionValid,
    loginConfigured: regimeLoginConfigured(),
  });
  if (decision === 'login') redirect('/private/login?next=/private/regime');
  if (decision === 'deny') notFound();
}

export async function regimeApiAllowed(allowCron: boolean): Promise<boolean> {
  const h = headers();
  if (allowCron && isCronAuthorized(h.get('authorization'))) return true;
  if (requestIpAllowed()) return true;
  return hasRegimeSession();
}

export function regimeDenied(): Response {
  return new Response('Not Found', {
    status: 404,
    headers: {
      'content-type': 'text/plain',
      'x-robots-tag': 'noindex, nofollow',
      'cache-control': 'private, no-store',
    },
  });
}
