// Validate required environment variables at startup.
// Import this file once in layout.tsx (server component) so it runs on cold start.

const REQUIRED: Record<string, string> = {
  NEXT_PUBLIC_SUPABASE_URL:      'Supabase project URL',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'Supabase anon key',
  SUPABASE_SERVICE_ROLE_KEY:     'Supabase service role key (server-only)',
  STRIPE_SECRET_KEY:             'Stripe secret key',
  STRIPE_WEBHOOK_SECRET:         'Stripe webhook signing secret',
  STRIPE_PRICE_STARTER:          'Stripe price ID for Starter plan',
  STRIPE_PRICE_PRO:              'Stripe price ID for Pro plan',
  STRIPE_PRICE_TOTAL:            'Stripe price ID for Total plan',
  STRIPE_PRICE_AGENCY:           'Stripe price ID for Agency plan',
  ANTHROPIC_API_KEY:             'Anthropic API key for AI agents',
  META_APP_ID:                   'Meta App ID for Instagram/Facebook OAuth',
  META_APP_SECRET:               'Meta App Secret',
  NEXT_PUBLIC_APP_URL:           'Public app URL (e.g. https://neuropost.app)',
};

export function validateEnv() {
  // Skip during Next.js static build phase and tests
  if (process.env.NODE_ENV === 'test') return;
  if (process.env.NEXT_PHASE === 'phase-production-build') return;

  const missing: string[] = [];
  for (const [key, label] of Object.entries(REQUIRED)) {
    const val = process.env[key];
    if (!val || val.includes('XXXXXXXX') || val.startsWith('sk-ant-api03-XXXX') || val.startsWith('price_XXXX')) {
      missing.push(`  • ${key} — ${label}`);
    }
  }

  if (missing.length > 0) {
    // In production throw; in development just warn so local setup is easy
    const msg = `[NeuroPost] Missing or placeholder environment variables:\n${missing.join('\n')}`;
    if (process.env.NODE_ENV === 'production') {
      throw new Error(msg);
    } else {
      console.warn(msg);
    }
  }
}
