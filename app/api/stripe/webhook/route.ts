import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createServiceClient } from '@/lib/supabase-server';
import Stripe from 'stripe';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const body = await request.text();
  const sig = request.headers.get('stripe-signature');

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const service = createServiceClient();

  async function upsertSubscription(subscription: Stripe.Subscription) {
    const customerId = typeof subscription.customer === 'string'
      ? subscription.customer
      : (subscription.customer as Stripe.Customer).id;

    const customer = await stripe.customers.retrieve(customerId) as Stripe.Customer;
    const userId = customer.metadata?.user_id;
    if (!userId) return;

    const isActive = ['active', 'trialing'].includes(subscription.status);

    await service.from('subscribers').upsert({
      user_id: userId,
      email: customer.email || '',
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      plan: isActive ? 'premium' : 'free',
      plan_expires_at: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
  }

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      await upsertSubscription(event.data.object as Stripe.Subscription);
      break;
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.subscription) {
        const subId = typeof session.subscription === 'string'
          ? session.subscription
          : (session.subscription as Stripe.Subscription).id;
        const sub = await stripe.subscriptions.retrieve(subId);
        await upsertSubscription(sub);
      }
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
