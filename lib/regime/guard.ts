import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';
import {
  clientIp,
  decideAccess,
  isCronAuthorized,
  isEmailAllowed,
  isIpAllowed,
  parseList,
  supabaseConfigured,
} from '@/lib/private-access';

async function signedInEmail(): Promise<string | null> {
  if (!supabaseConfigured() || parseList(process.env.REGIME_OWNER_EMAILS).length === 0) return null;
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return user?.email ?? null;
  } catch {
    return null;
  }
}

function requestBits() {
  const h = headers();
  return {
    ipAllowed: isIpAllowed(
      clientIp(h.get('x-forwarded-for'), h.get('x-real-ip')),
      process.env.REGIME_ALLOWED_IPS,
    ),
    cron: isCronAuthorized(h.get('authorization')),
  };
}

export async function enforceRegimePage(): Promise<void> {
  const bits = requestBits();
  const email = bits.ipAllowed ? null : await signedInEmail();
  const decision = decideAccess({
    surface: 'regime-page',
    ipAllowed: bits.ipAllowed,
    cronAuthorized: false,
    email,
    emailAllowed: isEmailAllowed(email, process.env.REGIME_OWNER_EMAILS),
    emailsConfigured: parseList(process.env.REGIME_OWNER_EMAILS).length > 0,
    supabaseConfigured: supabaseConfigured(),
  });
  if (decision === 'login') redirect('/login?next=/private/regime');
  if (decision === 'deny') notFound();
}

export async function regimeApiAllowed(allowCron: boolean): Promise<boolean> {
  const bits = requestBits();
  if (allowCron && bits.cron) return true;
  if (bits.ipAllowed) return true;
  const email = await signedInEmail();
  return decideAccess({
    surface: 'regime-api',
    ipAllowed: false,
    cronAuthorized: false,
    email,
    emailAllowed: isEmailAllowed(email, process.env.REGIME_OWNER_EMAILS),
    emailsConfigured: parseList(process.env.REGIME_OWNER_EMAILS).length > 0,
    supabaseConfigured: supabaseConfigured(),
  }) === 'allow';
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
