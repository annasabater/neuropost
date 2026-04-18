// =============================================================================
// NEUROPOST — Manually fire a reactivation email against a chosen brand
// Usage:
//   npx tsx scripts/test-reactivation-email.ts <brandId> [segment]
//   npx tsx scripts/test-reactivation-email.ts 123e...       # sends 7-day
//   npx tsx scripts/test-reactivation-email.ts 123e... 14    # sends 14-day
//   npx tsx scripts/test-reactivation-email.ts 123e... 30    # sends 30-day
//   npx tsx scripts/test-reactivation-email.ts 123e... all   # 7 + 14 + 30
//
// Bypasses anti-spam by temporarily clearing last_reactivation_email_at
// before each send and restoring the original value afterwards. Still
// respects the user's `reactivation_email` preference.
//
// Reads .env.local the same way scripts/setup-telegram-webhook.ts does.
// =============================================================================

/* eslint-disable no-console */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// ─── Load .env.local ────────────────────────────────────────────────────────

function loadEnvLocal() {
  const envPath = resolve(process.cwd(), '.env.local');
  if (!existsSync(envPath)) return;
  const raw = readFileSync(envPath, 'utf-8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val   = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

async function main() {
  loadEnvLocal();

  const [brandId, segArg] = process.argv.slice(2);
  if (!brandId) {
    console.error('Usage: npx tsx scripts/test-reactivation-email.ts <brandId> [7|14|30|all]');
    process.exit(1);
  }

  const segments: Array<7 | 14 | 30> =
      segArg === 'all' ? [7, 14, 30]
    : segArg === '14'  ? [14]
    : segArg === '30'  ? [30]
    : [7];

  // Dynamic imports so env vars are in place first
  const { createAdminClient } = await import('../src/lib/supabase');
  const { sendReactivationEmail } = await import('../src/lib/email');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any;

  // Fetch the brand once to report status + know the plan
  const { data: brand, error } = await db
    .from('brands')
    .select('id, name, plan, last_login_at, last_reactivation_email_at')
    .eq('id', brandId)
    .maybeSingle();

  if (error) throw error;
  if (!brand) {
    console.error(`Brand ${brandId} not found`);
    process.exit(1);
  }

  console.log(`\nBrand: ${brand.name ?? '(unnamed)'} · plan=${brand.plan} · last_login=${brand.last_login_at}`);

  for (const segment of segments) {
    // Temporarily clear the anti-spam timestamp so canSendEmail lets us through
    const snapshot = brand.last_reactivation_email_at;
    if (snapshot) {
      await db.from('brands')
        .update({ last_reactivation_email_at: null })
        .eq('id', brand.id);
    }

    const isPaid = !!brand.plan && brand.plan !== 'starter';
    const sent = await sendReactivationEmail({
      brandId:  brand.id,
      segment,
      isPaid,
    });
    console.log(`segment=${segment} isPaid=${isPaid} → sent=${sent}`);

    if (!sent && snapshot) {
      // Put the original timestamp back — we didn't actually send.
      await db.from('brands')
        .update({ last_reactivation_email_at: snapshot })
        .eq('id', brand.id);
    }
  }
}

main().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
