// =============================================================================
// NEUROPOST — Email service for React Email templates.
// Never throws — returns { ok, ... } so callers can decide what to do.
// =============================================================================

import { render }              from '@react-email/render';
import type { ReactElement }   from 'react';
import { resend, EMAIL_FROM, EMAIL_REPLY_TO } from './client';

export type SendEmailParams = {
  to:       string;
  subject:  string;
  template: ReactElement;
  metadata?: {
    brand_id?:            string;
    weekly_plan_id?:      string;
    notification_type?:   string;
  };
};

export type SendEmailResult =
  | { ok: true;  id: string }
  | { ok: false; error: string };

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  if (!resend) {
    return { ok: false, error: 'Resend no configurado (falta RESEND_API_KEY)' };
  }

  try {
    const html = await render(params.template);
    const text = await render(params.template, { plainText: true });

    const response = await resend.emails.send({
      from:     EMAIL_FROM,
      to:       params.to,
      replyTo:  EMAIL_REPLY_TO,
      subject:  params.subject,
      html,
      text,
      tags: params.metadata
        ? Object.entries(params.metadata)
            .filter(([, v]) => v != null)
            .map(([name, value]) => ({ name, value: String(value) }))
        : undefined,
    });

    if (response.error) {
      console.error('[email] Resend error:', response.error);
      return { ok: false, error: response.error.message };
    }

    return { ok: true, id: response.data!.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido';
    console.error('[email] Excepción al enviar:', message);
    return { ok: false, error: message };
  }
}
