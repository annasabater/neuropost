import Stripe from 'stripe';
import type { SubscriptionPlan } from '@/types';

// ─── Singleton client ─────────────────────────────────────────────────────────

let _stripe: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY is not set');
    _stripe = new Stripe(key, { apiVersion: '2026-03-25.dahlia' });
  }
  return _stripe;
}

// ─── Plan → Stripe price mapping ──────────────────────────────────────────────

export function getPriceId(plan: SubscriptionPlan, interval: 'monthly' | 'annual' = 'monthly'): string {
  const monthly: Record<SubscriptionPlan, string> = {
    starter: process.env.STRIPE_PRICE_STARTER ?? '',
    pro:     process.env.STRIPE_PRICE_PRO     ?? '',
    total:   process.env.STRIPE_PRICE_TOTAL   ?? '',
  };
  const annual: Record<SubscriptionPlan, string> = {
    starter: process.env.STRIPE_PRICE_STARTER_ANNUAL ?? '',
    pro:     process.env.STRIPE_PRICE_PRO_ANNUAL     ?? '',
    total:   process.env.STRIPE_PRICE_TOTAL_ANNUAL   ?? '',
  };
  const priceId = interval === 'annual' ? annual[plan] : monthly[plan];
  if (!priceId) throw new Error(`No Stripe price ID configured for plan: ${plan} (${interval})`);
  return priceId;
}

/**
 * Price ID for the +1 social-account add-on (€15/month recurring). Create
 * this in Stripe Dashboard as a Product "Extra social account" with a
 * recurring monthly price of €15, then set STRIPE_PRICE_EXTRA_SOCIAL.
 *
 *   stripe products create --name="Extra social account"
 *   stripe prices  create --product=prod_X --currency=eur --unit-amount=1500 \
 *                         --recurring[interval]=month
 */
export function getExtraSocialPriceId(): string {
  const id = process.env.STRIPE_PRICE_EXTRA_SOCIAL;
  if (!id) throw new Error(
    'STRIPE_PRICE_EXTRA_SOCIAL is not set — create the €15/mo add-on product in Stripe and add the env var.',
  );
  return id;
}

// ─── Social-account add-on helpers ────────────────────────────────────────────

/**
 * Increments (or creates) the "extra social account" line item on the
 * given subscription, so the user pays +€15/mo per extra account. Stripe
 * handles proration for the current period automatically.
 *
 * Returns the updated subscription so the caller can verify the new
 * quantity + read the current_period_end for UI messaging.
 */
export async function addExtraSocialAccount(subscriptionId: string): Promise<Stripe.Subscription> {
  const stripe   = getStripeClient();
  const priceId  = getExtraSocialPriceId();
  const sub      = await stripe.subscriptions.retrieve(subscriptionId);
  const existing = sub.items.data.find(i => i.price.id === priceId);

  if (existing) {
    // Already has the add-on line → bump quantity by 1.
    const newQty = (existing.quantity ?? 1) + 1;
    await stripe.subscriptionItems.update(existing.id, { quantity: newQty, proration_behavior: 'create_prorations' });
  } else {
    // First add-on — create the line item.
    await stripe.subscriptionItems.create({
      subscription:       subscriptionId,
      price:              priceId,
      quantity:           1,
      proration_behavior: 'create_prorations',
    });
  }

  return stripe.subscriptions.retrieve(subscriptionId);
}

/** Reduces the add-on quantity by 1 (or removes the item if it hits 0). */
export async function removeExtraSocialAccount(subscriptionId: string): Promise<Stripe.Subscription> {
  const stripe  = getStripeClient();
  const priceId = getExtraSocialPriceId();
  const sub     = await stripe.subscriptions.retrieve(subscriptionId);
  const item    = sub.items.data.find(i => i.price.id === priceId);

  if (!item) return sub; // Nothing to remove.

  const nextQty = Math.max(0, (item.quantity ?? 1) - 1);
  if (nextQty === 0) {
    await stripe.subscriptionItems.del(item.id, { proration_behavior: 'create_prorations' });
  } else {
    await stripe.subscriptionItems.update(item.id, { quantity: nextQty, proration_behavior: 'create_prorations' });
  }

  return stripe.subscriptions.retrieve(subscriptionId);
}

/**
 * Inspects a subscription and returns how many extra social-account slots
 * are currently paid for. Used by the webhook to sync
 * brands.purchased_extra_accounts.
 */
export function countSocialAccountAddons(sub: Stripe.Subscription): number {
  const priceId = process.env.STRIPE_PRICE_EXTRA_SOCIAL;
  if (!priceId) return 0;
  const item = sub.items.data.find(i => i.price.id === priceId);
  return item?.quantity ?? 0;
}

// ─── Checkout session ─────────────────────────────────────────────────────────

export async function createCheckoutSession({
  customerId,
  plan,
  successUrl,
  cancelUrl,
  clientReferenceId,
}: {
  customerId?:        string;
  plan:               SubscriptionPlan;
  successUrl:         string;
  cancelUrl:          string;
  clientReferenceId?: string;
}): Promise<Stripe.Checkout.Session> {
  const stripe = getStripeClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  return stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    client_reference_id: clientReferenceId,
    line_items: [{ price: getPriceId(plan), quantity: 1 }],
    success_url: successUrl || `${appUrl}/dashboard?upgrade=success`,
    cancel_url:  cancelUrl  || `${appUrl}/settings`,
    allow_promotion_codes: true,
    subscription_data: { trial_period_days: 14 },
  });
}

// ─── Customer portal ──────────────────────────────────────────────────────────

export async function createPortalSession(customerId: string): Promise<Stripe.BillingPortal.Session> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  return getStripeClient().billingPortal.sessions.create({
    customer:   customerId,
    return_url: `${appUrl}/settings`,
  });
}

// ─── Webhook verification ─────────────────────────────────────────────────────

export function constructWebhookEvent(payload: string | Buffer, sig: string): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET is not set');
  return getStripeClient().webhooks.constructEvent(payload, sig, secret);
}
