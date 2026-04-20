// =============================================================================
// NEUROPOST — Centralised Resend client for React Email-based service.
// sendRaw.ts keeps its own lazy singleton for the legacy template system.
// This client is used exclusively by src/lib/email/service.ts.
// =============================================================================

import { Resend } from 'resend';

if (!process.env.RESEND_API_KEY) {
  console.warn('[email] RESEND_API_KEY no definida. Los emails no se enviarán.');
}

export const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

export const EMAIL_FROM     = process.env.RESEND_FROM_EMAIL  ?? 'onboarding@resend.dev';
export const EMAIL_REPLY_TO = process.env.RESEND_REPLY_TO    ?? EMAIL_FROM;
