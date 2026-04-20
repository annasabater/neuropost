// =============================================================================
// NEUROPOST — Register the Telegram webhook against production
// Usage: npx tsx scripts/setup-telegram-webhook.ts
//
// Reads .env.local from the neuropost/ directory (no dotenv dep needed).
// =============================================================================

/* eslint-disable no-console */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// ─── Load .env.local manually (no dotenv dependency) ────────────────────────

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
    // Strip matching surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

async function main() {
  loadEnvLocal();

  const token  = process.env.TELEGRAM_BOT_TOKEN;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!token)  throw new Error('TELEGRAM_BOT_TOKEN is not set');
  if (!secret) throw new Error('TELEGRAM_WEBHOOK_SECRET is not set');
  if (!appUrl) throw new Error('NEXT_PUBLIC_APP_URL is not set');

  const webhookUrl = `${appUrl.replace(/\/$/, '')}/api/telegram/webhook`;
  console.log(`→ Registering Telegram webhook: ${webhookUrl}`);

  const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url:             webhookUrl,
      secret_token:    secret,
      allowed_updates: ['message'],
      drop_pending_updates: true,
    }),
  });

  const body = await res.json();
  console.log(JSON.stringify(body, null, 2));
  if (!res.ok || !body.ok) process.exit(1);

  const info = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
  console.log('\ngetWebhookInfo:');
  console.log(JSON.stringify(await info.json(), null, 2));
}

main().catch(err => {
  console.error('Setup failed:', err);
  process.exit(1);
});
