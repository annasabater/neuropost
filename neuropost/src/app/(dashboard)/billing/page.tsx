import { isPaymentsEnabled } from '@/lib/stripe/config';
import { getServerBrand } from '@/lib/supabase';
import { PLAN_META } from '@/types';
import type { BrandBilling } from '@/lib/billing/types';
import BillingClient from './_components/BillingClient';

export const metadata = {
  title: 'Plan y facturación · NeuroPost',
};

export default async function BillingPage() {
  const paymentsEnabled = isPaymentsEnabled();
  const brand = await getServerBrand() as BrandBilling | null;

  const planId = brand?.plan ?? 'starter';
  const meta = PLAN_META[planId];

  return (
    <BillingClient
      paymentsEnabled={paymentsEnabled}
      brand={brand ? {
        id: brand.id,
        plan: planId,
        planLabel: meta?.label ?? planId,
        priceMonthly: meta?.price ?? 0,
        stripeCustomerId: brand.stripe_customer_id,
        stripeSubscriptionId: brand.stripe_subscription_id,
        planStartedAt: brand.plan_started_at,
        subscribedPlatforms: brand.subscribed_platforms ?? [],
      } : null}
    />
  );
}
