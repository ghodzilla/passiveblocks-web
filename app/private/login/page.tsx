import Image from 'next/image';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { clientIp, isIpAllowed } from '@/lib/private-access';
import { hasRegimeSession } from '@/lib/regime/guard';
import { regimeLoginConfigured, safeRegimeNext } from '@/lib/regime/session';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Owner sign-in',
  robots: { index: false, follow: false },
};

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function RegimeLoginPage({
  searchParams,
}: {
  searchParams: { next?: string | string[]; error?: string | string[] };
}) {
  const ipAllowed = isIpAllowed(
    clientIp(headers().get('x-forwarded-for'), headers().get('x-real-ip')),
    process.env.REGIME_ALLOWED_IPS,
  );
  if (!regimeLoginConfigured() && !ipAllowed) notFound();

  const next = safeRegimeNext(one(searchParams.next));
  if (ipAllowed || (await hasRegimeSession())) redirect(next);

  const error = one(searchParams.error);
  const message = error === 'locked'
    ? 'Too many attempts. Try again in 15 minutes.'
    : error === 'rejected'
      ? 'That password was not accepted.'
      : null;

  return (
    <div style={{ minHeight: '100vh', background: '#08080f', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Image
        src="/passiveblocks_logo_cropped.png"
        alt="PassiveBlocks"
        width={160}
        height={38}
        style={{ height: 38, width: 'auto', marginBottom: 40 }}
        priority
      />
      <div style={{ background: '#111214', border: '1px solid #2a2b30', borderRadius: 16, padding: '40px 32px', width: '100%', maxWidth: 420 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#edeef0', marginBottom: 8 }}>Owner sign-in</h1>
        <p style={{ fontSize: 14, color: '#6b6c72', marginBottom: 28 }}>
          Password for the regime dashboard. This is not the public magic-link login.
        </p>
        {message && (
          <div style={{ background: '#dc262622', border: '1px solid #dc262644', borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: 13, color: '#f87171' }}>
            {message}
          </div>
        )}
        <form method="POST" action="/api/regime/login">
          <input type="hidden" name="next" value={next} />
          <label htmlFor="password" style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#a1a1aa', marginBottom: 8 }}>
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            style={{ width: '100%', boxSizing: 'border-box', background: '#08080f', border: '1px solid #2a2b30', borderRadius: 10, padding: '12px 14px', color: '#edeef0', fontSize: 14, marginBottom: 16 }}
          />
          <button
            type="submit"
            style={{ width: '100%', background: '#edeef0', color: '#08080f', border: 0, borderRadius: 10, padding: '12px 14px', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}
          >
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
