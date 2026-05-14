import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ loggedIn: false, plan: 'free' });

  const service = createServiceClient();
  const { data: sub } = await service
    .from('subscribers')
    .select('plan, plan_expires_at')
    .eq('user_id', user.id)
    .single();

  const plan = sub?.plan === 'premium' && (
    !sub.plan_expires_at || new Date(sub.plan_expires_at) > new Date()
  ) ? 'premium' : 'free';

  return NextResponse.json({ loggedIn: true, plan, email: user.email });
}
