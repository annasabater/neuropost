import type { SubscriptionPlan } from '@/types';

export interface BillingSubscription {
  plan: SubscriptionPlan;
  planLabel: string;
  priceMonthly: number;
  currency: string;
  status: 'active' | 'trialing' | 'paused' | 'canceled';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  nextPaymentDate: string;
  startedAt: string;
}

export interface BillingPaymentMethod {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  holderName: string;
}

export interface BillingInvoice {
  id: string;
  date: string;
  amount: number;
  currency: string;
  status: 'paid' | 'open' | 'void';
  pdfUrl: string | null;
}

export interface BillingUsage {
  aiPosts: { used: number; limit: number };
  businesses: { used: number; limit: number };
  socialNetworks: { used: number; limit: string | number };
}

export const MOCK_SUBSCRIPTION: BillingSubscription = {
  plan: 'pro',
  planLabel: 'Crecimiento',
  priceMonthly: 76,
  currency: 'EUR',
  status: 'active',
  currentPeriodStart: '2026-04-15',
  currentPeriodEnd: '2026-05-15',
  nextPaymentDate: '15 de mayo, 2026',
  startedAt: '15 de enero, 2026',
};

export const MOCK_PAYMENT_METHOD: BillingPaymentMethod = {
  brand: 'Visa',
  last4: '4242',
  expMonth: 9,
  expYear: 2028,
  holderName: 'Samuel Cano',
};

export const MOCK_INVOICES: BillingInvoice[] = [
  { id: 'NP-2026-04', date: '15 abr 2026', amount: 76,  currency: 'EUR', status: 'paid', pdfUrl: null },
  { id: 'NP-2026-03', date: '15 mar 2026', amount: 76,  currency: 'EUR', status: 'paid', pdfUrl: null },
  { id: 'NP-2026-02', date: '15 feb 2026', amount: 76,  currency: 'EUR', status: 'paid', pdfUrl: null },
  { id: 'NP-2026-01', date: '15 ene 2026', amount: 25,  currency: 'EUR', status: 'paid', pdfUrl: null },
];

export const MOCK_USAGE: BillingUsage = {
  aiPosts: { used: 64, limit: 100 },
  businesses: { used: 1, limit: 1 },
  socialNetworks: { used: 2, limit: '∞' },
};
