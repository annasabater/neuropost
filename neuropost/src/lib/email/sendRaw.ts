// =============================================================================
// NEUROPOST — Low-level senders exposed for callers that already resolved
// the subject + body themselves (typically cron jobs that aggregate data
// across many rows and render a single email).
//
// Prefer the high-level helpers in src/lib/email.ts whenever possible.
// =============================================================================

import { Resend } from 'resend';
import { buildEmailFooter, getPreferencesUrl } from './unsubscribe';
import type { EmailType } from './preferences';

let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error('RESEND_API_KEY is not set');
    _resend = new Resend(key);
  }
  return _resend;
}

const FROM = () => process.env.RESEND_FROM_EMAIL ?? 'noreply@neuropost.app';
const APP  = () => process.env.NEXT_PUBLIC_APP_URL ?? 'https://neuropost.app';

const BASE = `font-family:'Inter',Arial,sans-serif;background:#fdf8f3;color:#1a1a1a;margin:0;padding:0;`;
const CARD = `max-width:560px;margin:40px auto;background:#ffffff;border-radius:16px;padding:40px;box-shadow:0 4px 24px rgba(0,0,0,0.08);`;
const LOGO = `font-size:24px;font-weight:800;color:#ff6b35;text-decoration:none;letter-spacing:-0.5px;`;
const MUTED = `font-size:13px;color:#888;margin-top:32px;border-top:1px solid #eee;padding-top:16px;`;

/**
 * Send a pre-rendered body with the gated layout (unsubscribe footer
 * included). Caller is responsible for subject + body + language.
 * Does NOT check preferences — gate yourself with canSendEmail().
 * Does NOT call markEmailSent — call it yourself on success.
 */
export async function sendGatedRaw(params: {
  brandId: string;
  type:    EmailType;
  to:      string;
  subject: string;
  body:    string;
}): Promise<void> {
  const unsub = await buildEmailFooter(params.brandId, params.type);
  const html = `<!DOCTYPE html><html><body style="${BASE}">
    <div style="${CARD}">
      <a href="${APP()}" style="${LOGO}">NeuroPost</a>
      ${params.body}
      <p style="${MUTED}">© ${new Date().getFullYear()} NeuroPost · <a href="${getPreferencesUrl()}" style="color:#888">Gestionar notificaciones</a></p>
      ${unsub}
    </div>
  </body></html>`;

  await getResend().emails.send({ from: FROM(), to: params.to, subject: params.subject, html });
}
