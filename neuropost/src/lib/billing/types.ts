import type { SubscriptionPlan } from '@/types';

export type SubscriptionStatus = 'active' | 'trialing' | 'canceled' | 'past_due' | 'none';

export type CurrentSubscription = {
  planId: SubscriptionPlan;
  planLabel: string;
  priceMonthly: number;
  status: SubscriptionStatus;
  currentPeriodEnd: number | null;
  trialEnd: number | null;
  cancelAtPeriodEnd: boolean;
  startedAt: string | null;
  discount: {
    code: string | null;
    percentOff: number | null;
    amountOff: number | null;
  } | null;
};

export type UsageData = {
  aiPostsUsed: number;
  aiPostsLimit: number;
  businessesConnected: number;
  businessesLimit: number;
  socialNetworksConnected: number;
  socialNetworksLimit: number | null;
};

export type PaymentMethodData = {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  holderName: string | null;
};

export type BillingInvoice = {
  id: string;
  number: string | null;
  amount: number;
  currency: string;
  status: string;
  date: number;
  pdfUrl: string | null;
};

export type BrandBilling = {
  id: string;
  plan: SubscriptionPlan;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan_started_at: string | null;
  trial_ends_at: string | null;
  plan_cancels_at: string | null;
  purchased_extra_accounts: number;
  subscribed_platforms: string[];
};
