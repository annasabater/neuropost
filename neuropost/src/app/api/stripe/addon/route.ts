// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/stripe/addon
//    body: { action: 'add' | 'remove' }
//    → { ok: true, purchased_extra_accounts: number }
//
//  Adds or removes one +€15/mo social-account add-on from the current
//  user's Stripe subscription. The actual brands.purchased_extra_accounts
//  column is synced from the Stripe webhook (customer.subscription.updated)
//  so we don't trust the client's optimistic value.
//
//  Auth: brand owner (resolved by user_id).
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-utils';
import { rateLimitWrite } from '@/lib/ratelimit';
import { requireServerUser, createAdminClient } from '@/lib/supabase';
import {
  addExtraSocialAccount,
  removeExtraSocialAccount,
  countSocialAccountAddons,
} from '@/lib/stripe';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export async function POST(request: Request) {
  try {
    const rl = await rateLimitWrite(request);
    if (rl) return rl;

    const user = await requireServerUser();
    const db   = createAdminClient() as DB;

    const body = await request.json().catch(() => null) as { action?: string } | null;
    const action = body?.action;
    if (action !== 'add' && action !== 'remove') {
      return NextResponse.json(
        { error: 'Body must be { action: "add" | "remove" }' },
        { status: 400 },
      );
    }

    // Resolve brand + stripe subscription. The brands table tracks
    // stripe_customer_id + stripe_subscription_id from the checkout webhook.
    const { data: brand } = await db
      .from('brands')
      .select('id, stripe_subscription_id, purchased_extra_accounts')
      .eq('user_id', user.id)
      .single();
    if (!brand) {
      return NextResponse.json({ error: 'Brand not found' }, { status: 404 });
    }
    if (!brand.stripe_subscription_id) {
      return NextResponse.json(
        { error: 'No active Stripe subscription. Suscríbete a un plan primero desde /settings/plan.' },
        { status: 400 },
      );
    }

    // Don't let the user pull the add-on below zero via the UI.
    if (action === 'remove' && (brand.purchased_extra_accounts ?? 0) <= 0) {
      return NextResponse.json(
        { error: 'No tienes cuentas extra para eliminar.' },
        { status: 400 },
      );
    }

    // Stripe call — proration + invoice on the next period.
    const updatedSub = action === 'add'
      ? await addExtraSocialAccount(brand.stripe_subscription_id)
      : await removeExtraSocialAccount(brand.stripe_subscription_id);

    const newCount = countSocialAccountAddons(updatedSub);

    // Optimistic update — the webhook will confirm on its next
    // customer.subscription.updated event. Doing it here too keeps the UI
    // responsive without waiting for the webhook round-trip.
    await db
      .from('brands')
      .update({ purchased_extra_accounts: newCount })
      .eq('id', brand.id);

    return NextResponse.json({
      ok: true,
      purchased_extra_accounts: newCount,
      action,
    });
  } catch (err) {
    return apiError(err, 'POST /api/stripe/addon');
  }
}
