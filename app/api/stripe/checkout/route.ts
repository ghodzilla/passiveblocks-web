import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase-server';
import { getStripe } from '@/lib/stripe';

export const runtime = 'nodejs';

export async function POST() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const service = createServiceClient();
  const { data: sub } = await service
    .from('subscribers')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .single();

  let customerId = sub?.stripe_customer_id;
  if (!customerId) {
    const customer = await getStripe().customers.create({ email: user.email, metadata: { user_id: user.id } });
    customerId = customer.id;
    await service.from('subscribers').upsert({
      user_id: user.id,
      email: user.email,
      stripe_customer_id: customerId,
      plan: 'free',
    }, { onConflict: 'user_id' });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://passiveblocks.io';

  const session = await getStripe().checkout.sessions.create({
    customer: customerId,
    payment_method_types: ['card'],
    line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
    mode: 'subscription',
    success_url: `${siteUrl}/account?success=1`,
    cancel_url: `${siteUrl}/pricing`,
    metadata: { user_id: user.id },
  });

  return NextResponse.json({ url: session.url });
}
