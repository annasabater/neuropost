// =============================================================================
// Planning — trigger-client-email
// =============================================================================
// Sends the "weekly plan ready for review" email to the brand's owner and
// records the result in the notifications table.

import { sendEmail }              from '@/lib/email/service';
import { resolveBrandRecipient }  from '@/lib/email/resolve-recipient';
import WeeklyPlanReadyEmail       from '@/emails/WeeklyPlanReadyEmail';
import { createAdminClient }      from '@/lib/supabase';
import React                      from 'react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export async function enqueueClientReviewEmail(planId: string): Promise<void> {
  const db = createAdminClient() as DB;

  const { data: plan, error: planErr } = await db
    .from('weekly_plans')
    .select('id, brand_id, week_start')
    .eq('id', planId)
    .single();

  if (planErr || !plan) {
    console.error('[email/trigger] Plan no encontrado:', planId, planErr);
    return;
  }

  const recipient = await resolveBrandRecipient(plan.brand_id);
  if (!recipient) {
    console.error('[email/trigger] No se resolvió destinatario para brand:', plan.brand_id);
    return;
  }

  const { data: ideas } = await db
    .from('content_ideas')
    .select('angle, format')
    .eq('week_id', plan.id)
    .order('position', { ascending: true });

  const weekLabel     = formatWeekLabel(plan.week_start);
  const reviewUrl     = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://neuropost.app'}/planificacion/${plan.id}`;
  const pillarSummary = buildPillarSummary(ideas ?? []);
  const subject       = `Tu contenido de la semana del ${weekLabel} está listo para revisar`;

  const result = await sendEmail({
    to:      recipient.email,
    subject,
    template: React.createElement(WeeklyPlanReadyEmail, {
      brand_name:       recipient.brand_name,
      week_start_label: weekLabel,
      review_url:       reviewUrl,
      pillar_summary:   pillarSummary,
    }),
    metadata: {
      brand_id:          plan.brand_id,
      weekly_plan_id:    plan.id,
      notification_type: 'weekly_plan.ready_for_client_review',
    },
  });

  // Insert adaptado al schema real de notifications:
  //   columnas: id, brand_id, type, message (NOT NULL), read, metadata (jsonb),
  //             created_at, email_sent_at, email_resend_id, email_error
  const { error: notifErr } = await db.from('notifications').insert({
    brand_id: plan.brand_id,
    type:     'weekly_plan.ready_for_client_review',
    message:  subject,
    metadata: {
      weekly_plan_id: plan.id,
      week_start:     plan.week_start,
      user_id:        recipient.user_id,
      review_url:     reviewUrl,
    },
    email_sent_at:   result.ok ? new Date().toISOString() : null,
    email_resend_id: result.ok ? result.id : null,
    email_error:     result.ok ? null : result.error,
  });

  if (notifErr) {
    console.error('[email/trigger] Error insertando notification:', notifErr);
  }

  if (result.ok) {
    await db
      .from('weekly_plans')
      .update({ sent_to_client_at: new Date().toISOString() })
      .eq('id', plan.id);
    console.log('[email/trigger] Email enviado, plan:', planId, 'resend_id:', result.id);
  } else {
    console.error('[email/trigger] Error al enviar email:', result.error);
  }
}

function buildPillarSummary(ideas: { angle: string; format: string }[]): string {
  if (ideas.length === 0) return 'tu contenido de la semana';
  const formats = Array.from(new Set(ideas.map((i) => i.format)));
  return `${ideas.length} publicaciones mezclando ${formats.join(', ')}`;
}

function formatWeekLabel(weekStart: string): string {
  const d = new Date(weekStart + 'T00:00:00Z');
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', timeZone: 'UTC' });
}