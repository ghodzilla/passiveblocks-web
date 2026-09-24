import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';

// GET /api/auth/callback?code=...&next=/tax
// Supabase magic-link exchange — swaps code for session, then redirects.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const rawNext = searchParams.get('next') ?? '/tax';
  // Only allow same-origin relative paths (blocks //evil.com and @evil.com redirects).
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') && !rawNext.includes('\\')
    ? rawNext
    : '/tax';

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed&next=${encodeURIComponent(next)}`);
}
