// =============================================================================
// NEUROPOST — Post notification dispatcher
// =============================================================================
// Inserts a row into `notifications` (triggers Supabase Realtime → inbox toast)
// and sends a transactional email via Resend.
// Email failure is non-fatal — the in-app notification always lands.
//
// 4 types:
//   post.ready_for_review  — worker manually approved a revision
//   post.rejected          — worker rejected with a reason
//   post.ready_auto        — instant mode, auto-approved (no worker needed)
//   post.reanalysis_done   — brief re-analyzed by worker (team is refining)

import React                     from 'react';
import { createAdminClient }     from '@/lib/supabase';
import { sendEmail }             from '@/lib/email/service';
import { resolveBrandRecipient } from '@/lib/email/resolve-recipient';
import PostNotificationEmail     from '@/emails/PostNotificationEmail';
import type { PostNotificationEmailType } from '@/emails/PostNotificationEmail';

export type PostNotificationType = PostNotificationEmailType;

export type NotificationInput = {
  postId:   string;
  brandId:  string;
  format?:  string | null;
  reason?:  string;         // only for post.rejected
  imageUrl?: string | null;
};

type NotificationContent = {
  message:    string;
  emailSubject: string;
  emailBody:  string;
  ctaLabel:   string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Pure helper — fully unit-testable (no I/O)
// ─────────────────────────────────────────────────────────────────────────────
export function buildNotificationContent(
  type:   PostNotificationType,
  input:  Pick<NotificationInput, 'format' | 'reason'>,
): NotificationContent {
  const fmt = input.format ? ` (${input.format})` : '';

  switch (type) {
    case 'post.ready_for_review':
      return {
        message:      `Tu publicación${fmt} está lista para revisar`,
        emailSubject: `Tu publicación${fmt} está lista — revísala ahora`,
        emailBody:    'El equipo de NeuroPost ha revisado y aprobado tu publicación. Ya puedes verla y darle el visto bueno final.',
        ctaLabel:     'Ver publicación',
      };

    case 'post.rejected':
      return {
        message:      `Tu publicación${fmt} necesita ajustes`,
        emailSubject: `Tu publicación${fmt} requiere cambios`,
        emailBody:    'El equipo ha revisado tu publicación y tiene algunos comentarios para mejorarla.',
        ctaLabel:     'Ver detalles',
      };

    case 'post.ready_auto':
      return {
        message:      `Tu publicación${fmt} ha sido generada y está lista`,
        emailSubject: `Tu publicación${fmt} está lista`,
        emailBody:    'Tu publicación ha sido generada automáticamente y está esperando tu revisión final.',
        ctaLabel:     'Revisar publicación',
      };

    case 'post.reanalysis_done':
      return {
        message:      `El equipo ha refinado el brief de tu publicación${fmt}`,
        emailSubject: `Actualización en tu publicación${fmt}`,
        emailBody:    'El equipo ha revisado y actualizado el brief de tu publicación. Estamos trabajando en una nueva versión.',
        ctaLabel:     'Ver publicación',
      };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main dispatcher — insert notification + best-effort email
// ─────────────────────────────────────────────────────────────────────────────
export async function triggerPostNotification(
  type:  PostNotificationType,
  input: NotificationInput,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any;

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://neuropost.app';
  // TODO: update URL pattern when /posts/[id] client page exists
  const ctaUrl  = `${baseUrl}/dashboard`;

  const content = buildNotificationContent(type, input);

  // 1. Insert notification row (triggers Supabase Realtime → inbox toast)
  const { data: notif, error: notifErr } = await db
    .from('notifications')
    .insert({
      brand_id: input.brandId,
      type,
      message:  content.message,
      metadata: {
        post_id:   input.postId,
        format:    input.format   ?? null,
        reason:    input.reason   ?? null,
        image_url: input.imageUrl ?? null,
        cta_url:   ctaUrl,
      },
    })
    .select('id')
    .single();

  if (notifErr || !notif) {
    console.error('[triggerPostNotification] Failed to insert notification:', notifErr);
    return;
  }

  // 2. Send email — failure is non-fatal
  // TODO: gate via canSendEmail('approval_needed') once prefs column is confirmed
  try {
    const recipient = await resolveBrandRecipient(input.brandId);
    if (!recipient) return;

    const result = await sendEmail({
      to:      recipient.email,
      subject: content.emailSubject,
      template: React.createElement(PostNotificationEmail, {
        brand_name: recipient.brand_name,
        type,
        heading:    content.message,
        body:       content.emailBody,
        cta_url:    ctaUrl,
        cta_label:  content.ctaLabel,
        reason:     input.reason,
      }),
      metadata: {
        brand_id:          input.brandId,
        notification_type: type,
      },
    });

    await db
      .from('notifications')
      .update({
        email_sent_at:   result.ok ? new Date().toISOString() : null,
        email_resend_id: result.ok ? result.id                : null,
        email_error:     result.ok ? null                     : result.error,
      })
      .eq('id', notif.id);

  } catch (emailErr) {
    console.error('[triggerPostNotification] Email failed (non-fatal):', emailErr);
    // Notification row already inserted — in-app toast will still fire
  }
}
