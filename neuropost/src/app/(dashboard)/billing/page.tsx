import { isPaymentsEnabled } from '@/lib/stripe/config';
import BillingClient from './_components/BillingClient';

export const metadata = {
  title: 'Plan y facturación · NeuroPost',
};

export default function BillingPage() {
  const paymentsEnabled = isPaymentsEnabled();
  return <BillingClient paymentsEnabled={paymentsEnabled} />;
}
