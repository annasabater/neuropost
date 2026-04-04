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

export function getPriceId(plan: SubscriptionPlan): string {
  const map: Record<SubscriptionPlan, string> = {
    starter: process.env.STRIPE_PRICE_STARTER ?? '',
    pro:     process.env.STRIPE_PRICE_PRO     ?? '',
    total:   process.env.STRIPE_PRICE_TOTAL   ?? '',
    agency:  process.env.STRIPE_PRICE_AGENCY  ?? '',
  };
  const priceId = map[plan];
  if (!priceId) throw new Error(`No Stripe price ID configured for plan: ${plan}`);
  return priceId;
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
