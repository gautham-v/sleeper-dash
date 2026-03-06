import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');

  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Webhook signature verification failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== 'subscription' || !session.subscription) break;

        const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
        const item = subscription.items.data[0];
        const priceId = item?.price.id ?? null;
        const periodEnd = item?.current_period_end ?? null;
        const userId = session.metadata?.userId ?? null;

        console.log('[stripe webhook] checkout.session.completed', {
          subscriptionId: subscription.id,
          userId,
          cancel_at_period_end: subscription.cancel_at_period_end,
          cancel_at: subscription.cancel_at,
          status: subscription.status,
        });

        const { error } = await supabase.from('subscriptions').upsert({
          id: subscription.id,
          user_id: userId,
          stripe_customer_id: subscription.customer as string,
          status: subscription.status,
          price_id: priceId,
          current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
          cancel_at_period_end: subscription.cancel_at_period_end,
          cancel_at: subscription.cancel_at ? new Date(subscription.cancel_at * 1000).toISOString() : null,
        });
        if (error) throw new Error(`DB upsert failed: ${error.message}`);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const item = subscription.items.data[0];
        const priceId = item?.price.id ?? null;
        const periodEnd = item?.current_period_end ?? null;

        // Log all cancellation-related fields so we can debug which mechanism Stripe uses
        console.log('[stripe webhook] customer.subscription.updated', {
          event_id: event.id,
          subscriptionId: subscription.id,
          status: subscription.status,
          cancel_at_period_end: subscription.cancel_at_period_end,
          cancel_at: subscription.cancel_at,
          current_period_end: periodEnd,
        });

        const updateData = {
          status: subscription.status,
          price_id: priceId,
          current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
          cancel_at_period_end: subscription.cancel_at_period_end,
          cancel_at: subscription.cancel_at ? new Date(subscription.cancel_at * 1000).toISOString() : null,
          updated_at: new Date().toISOString(),
        };

        const { data: updated, error } = await supabase
          .from('subscriptions')
          .update(updateData)
          .eq('id', subscription.id)
          .select('id');

        if (error) throw new Error(`DB update failed: ${error.message}`);

        if (!updated || updated.length === 0) {
          // Row not found by subscription ID — log clearly so we can diagnose
          console.error('[stripe webhook] No row found for subscription.id', subscription.id, '— check if the subscription was created before this webhook was set up');
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;

        console.log('[stripe webhook] customer.subscription.deleted', {
          subscriptionId: subscription.id,
        });

        const { error } = await supabase
          .from('subscriptions')
          .update({
            status: 'canceled',
            cancel_at_period_end: false,
            cancel_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', subscription.id);
        if (error) throw new Error(`DB update failed: ${error.message}`);
        break;
      }

      default:
        // Unhandled event type — ignore
        break;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Webhook handler error';
    console.error('[stripe webhook]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
