// =============================================================================
// NEUROPOST — Register the Telegram webhook against production
// Usage: npx tsx scripts/setup-telegram-webhook.ts
//
// Requires these env vars (in .env.local or the shell):
//   TELEGRAM_BOT_TOKEN
//   TELEGRAM_WEBHOOK_SECRET
//   NEXT_PUBLIC_APP_URL   (e.g. https://neuropost-one.vercel.app)
// =============================================================================

/* eslint-disable no-console */

import { config } from 'dotenv';
import { resolve } from 'node:path';

// Load .env.local from the project root relative to this script
config({ path: resolve(process.cwd(), '.env.local') });

async function main() {
  const token      = process.env.TELEGRAM_BOT_TOKEN;
  const secret     = process.env.TELEGRAM_WEBHOOK_SECRET;
  const appUrl     = process.env.NEXT_PUBLIC_APP_URL;

  if (!token)  throw new Error('TELEGRAM_BOT_TOKEN is not set');
  if (!secret) throw new Error('TELEGRAM_WEBHOOK_SECRET is not set');
  if (!appUrl) throw new Error('NEXT_PUBLIC_APP_URL is not set');

  const webhookUrl = `${appUrl.replace(/\/$/, '')}/api/telegram/webhook`;

  console.log(`→ Registering Telegram webhook: ${webhookUrl}`);

  const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url:            webhookUrl,
      secret_token:   secret,
      allowed_updates: ['message'],
      drop_pending_updates: true,
    }),
  });

  const body = await res.json();
  console.log(JSON.stringify(body, null, 2));

  if (!res.ok || !body.ok) {
    process.exit(1);
  }

  // Verify
  const info = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
  const infoJson = await info.json();
  console.log('\ngetWebhookInfo:');
  console.log(JSON.stringify(infoJson, null, 2));
}

main().catch(err => {
  console.error('Setup failed:', err);
  process.exit(1);
});
