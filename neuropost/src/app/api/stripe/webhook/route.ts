import { NextResponse } from 'next/server';
import { constructWebhookEvent } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase';
import type Stripe from 'stripe';

// IMPORTANT: Do NOT parse the body — Stripe needs the raw bytes to verify the signature
export async function POST(request: Request) {
  const payload   = await request.text();
  const signature = request.headers.get('stripe-signature') ?? '';

  let event: Stripe.Event;
  try {
    event = constructWebhookEvent(payload, signature);
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const supabase = createAdminClient();

  switch (event.type) {
    // ── New subscription started ──────────────────────────────────────────────
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId  = session.client_reference_id ?? '';

      // Determine plan from subscription
      let plan = 'starter';
      if (session.subscription) {
        const sub     = await import('@/lib/stripe').then(m => m.getStripeClient().subscriptions.retrieve(session.subscription as string));
        const priceId = sub.items.data[0]?.price.id ?? '';
        plan = priceId === process.env.STRIPE_PRICE_AGENCY ? 'agency'
             : priceId === process.env.STRIPE_PRICE_TOTAL  ? 'total'
             : priceId === process.env.STRIPE_PRICE_PRO    ? 'pro'
             : 'starter';
      }

      const { data: brand } = await supabase
        .from('brands')
        .update({
          stripe_customer_id:     session.customer as string,
          stripe_subscription_id: session.subscription as string,
          plan,
          plan_started_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .select('id')
        .single();

      if (brand?.id) {
        await supabase.from('notifications').insert({
          brand_id: brand.id,
          type:     'plan_activated',
          message:  `🎉 Plan ${plan} activado correctamente. ¡Bienvenido!`,
          read:     false,
        });

        // Send plan activation email
        try {
          const { sendPlanActivatedEmail } = await import('@/lib/email');
          const { data: authData } = await supabase.auth.admin.getUserById(userId);
          const email = authData?.user?.email;
          if (email) {
            const nextDate = new Date();
            nextDate.setMonth(nextDate.getMonth() + 1);
            await sendPlanActivatedEmail(email, plan, nextDate.toLocaleDateString('es-ES'));
          }
        } catch { /* email failure never blocks webhook response */ }
      }
      break;
    }

    // ── Subscription changed (upgrade/downgrade) ──────────────────────────────
    case 'customer.subscription.updated': {
      const sub     = event.data.object as Stripe.Subscription;
      const priceId = sub.items.data[0]?.price.id ?? '';
      const plan    = priceId === process.env.STRIPE_PRICE_AGENCY ? 'agency'
                    : priceId === process.env.STRIPE_PRICE_TOTAL  ? 'total'
                    : priceId === process.env.STRIPE_PRICE_PRO    ? 'pro'
                    : 'starter';

      const updates: Record<string, unknown> = {};
      if (sub.status === 'active' || sub.status === 'trialing') {
        updates.plan = plan;
      }
      if (sub.cancel_at_period_end && sub.cancel_at) {
        updates.plan_cancels_at = new Date(sub.cancel_at * 1000).toISOString();
      } else {
        updates.plan_cancels_at = null;
      }
      if (sub.trial_end) {
        updates.trial_ends_at = new Date(sub.trial_end * 1000).toISOString();
      }

      await supabase
        .from('brands')
        .update(updates)
        .eq('stripe_subscription_id', sub.id);
      break;
    }

    // ── Subscription cancelled ────────────────────────────────────────────────
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;

      const { data: brand } = await supabase
        .from('brands')
        .update({ plan: 'starter', stripe_subscription_id: null, plan_cancels_at: null })
        .eq('stripe_subscription_id', sub.id)
        .select('id,user_id')
        .single();

      if (brand?.id) {
        await supabase.from('notifications').insert({
          brand_id: brand.id,
          type:     'plan_activated',
          message:  'Tu suscripción ha finalizado. Tu cuenta está en el plan gratuito.',
          read:     false,
        });
      }

      // Send cancellation email
      try {
        const { sendSubscriptionCancelledEmail } = await import('@/lib/email');
        const { data: authData } = await supabase.auth.admin.getUserById(brand?.user_id ?? '');
        const email = authData?.user?.email;
        if (email) await sendSubscriptionCancelledEmail(email);
      } catch { /* non-blocking */ }
      break;
    }

    // ── Payment succeeded ─────────────────────────────────────────────────────
    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string;

      const { data: brand } = await supabase
        .from('brands')
        .select('id')
        .eq('stripe_customer_id', customerId)
        .single();

      if (brand?.id) {
        await supabase.from('activity_log').insert({
          brand_id:    brand.id,
          user_id:     brand.id, // placeholder — no direct user link here
          action:      'payment_succeeded',
          entity_type: 'invoice',
          details:     { invoice_id: invoice.id, amount: invoice.amount_paid },
        });
      }
      break;
    }

    // ── Payment failed ────────────────────────────────────────────────────────
    case 'invoice.payment_failed': {
      const invoice    = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string;

      const { data: brand } = await supabase
        .from('brands')
        .select('id,user_id')
        .eq('stripe_customer_id', customerId)
        .single();

      if (brand?.id) {
        await supabase.from('notifications').insert({
          brand_id: brand.id,
          type:     'payment_failed',
          message:  '⚠️ Pago fallido. Actualiza tu método de pago para no perder el acceso.',
          read:     false,
        });

        // Send payment failed email with billing portal link
        try {
          const [{ sendPaymentFailedEmail }, { createPortalSession }] = await Promise.all([
            import('@/lib/email'),
            import('@/lib/stripe'),
          ]);
          const { data: authData } = await supabase.auth.admin.getUserById(brand.user_id);
          const email = authData?.user?.email;
          if (email) {
            const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
            const portal = await createPortalSession(customerId);
            await sendPaymentFailedEmail(email, portal.url ?? `${appUrl}/settings/plan`);
          }
        } catch { /* non-blocking */ }
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
