// =============================================================================
// Planning — trigger-client-email
// =============================================================================
// Sends "weekly plan ready for review" / "plan rejected" emails to the brand
// owner and records the result in the notifications table.
//
// Both functions now return { ok, error? } so callers can:
//   - Know definitively whether the email was sent
//   - Persist the result in weekly_plans.client_email_status
//   - Let the reconcile-client-emails cron retry failures

import { sendEmail }              from '@/lib/email/service';
import { resolveBrandRecipient }  from '@/lib/email/resolve-recipient';
import WeeklyPlanReadyEmail       from '@/emails/WeeklyPlanReadyEmail';
import { createAdminClient }      from '@/lib/supabase';
import { log }                    from '@/lib/logger';
import React                      from 'react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export interface EmailResult {
  ok:     boolean;
  error?: string;
}

// ─── Review email (worker approved → client) ──────────────────────────────────

export async function enqueueClientReviewEmail(planId: string): Promise<EmailResult> {
  const db = createAdminClient() as DB;

  const { data: plan, error: planErr } = await db
    .from('weekly_plans')
    .select('id, brand_id, week_start')
    .eq('id', planId)
    .single();

  if (planErr || !plan) {
    const msg = planErr?.message ?? 'plan not found';
    log({ level: 'error', scope: 'trigger-client-email', event: 'plan_not_found',
          plan_id: planId, error: msg });
    await _markEmailFailed(db, planId, msg);
    return { ok: false, error: msg };
  }

  const recipient = await resolveBrandRecipient(plan.brand_id);
  if (!recipient) {
    const msg = 'recipient not resolved';
    log({ level: 'error', scope: 'trigger-client-email', event: 'recipient_not_found',
          plan_id: planId, brand_id: plan.brand_id });
    await _markEmailFailed(db, planId, msg);
    return { ok: false, error: msg };
  }

  const { data: ideas } = await db
    .from('content_ideas')
    .select('angle, format')
    .eq('week_id', plan.id)
    .order('position', { ascending: true });

  const weekLabel     = formatWeekLabel(plan.week_start);
  const reviewUrl     = `${process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'https://neuropost.app'}/planificacion/${plan.id}`;
  const pillarSummary = buildPillarSummary(ideas ?? []);
  const subject       = `Tu contenido de la semana del ${weekLabel} está listo para revisar`;

  // Increment attempt counter before sending (best-effort)
  await db.rpc('increment_client_email_attempts', { p_plan_id: planId }).catch(() => {
    // RPC not yet deployed — skip; reconcile cron will still have attempt count from retries
  });

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

  // Insert notification record (best-effort — don't fail the overall result)
  const { error: notifErr } = await db.from('notifications').insert({
    brand_id:        plan.brand_id,
    type:            'weekly_plan.ready_for_client_review',
    message:         subject,
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
    log({ level: 'warn', scope: 'trigger-client-email', event: 'notification_insert_failed',
          plan_id: planId, error: notifErr.message });
  }

  if (result.ok) {
    await db
      .from('weekly_plans')
      .update({ sent_to_client_at: new Date().toISOString(), client_email_status: 'sent' })
      .eq('id', planId);
    log({ level: 'info', scope: 'trigger-client-email', event: 'review_email_sent',
          plan_id: planId, resend_id: result.id });
    return { ok: true };
  } else {
    const msg = result.error ?? 'sendEmail failed';
    log({ level: 'error', scope: 'trigger-client-email', event: 'review_email_failed',
          plan_id: planId, error: msg });
    await _markEmailFailed(db, planId, msg);
    return { ok: false, error: msg };
  }
}

// ─── Rejection email (worker rejected → client) ──────────────────────────────

export async function enqueueClientPlanRejectedEmail(
  planId:     string,
  skipReason: string,
): Promise<EmailResult> {
  const db = createAdminClient() as DB;

  const { data: plan, error: planErr } = await db
    .from('weekly_plans')
    .select('id, brand_id, week_start')
    .eq('id', planId)
    .single();

  if (planErr || !plan) {
    const msg = planErr?.message ?? 'plan not found';
    log({ level: 'error', scope: 'trigger-client-email', event: 'plan_not_found_rejection',
          plan_id: planId, error: msg });
    return { ok: false, error: msg };
  }

  const recipient = await resolveBrandRecipient(plan.brand_id);
  if (!recipient) {
    log({ level: 'error', scope: 'trigger-client-email', event: 'recipient_not_found_rejection',
          plan_id: planId, brand_id: plan.brand_id });
    return { ok: false, error: 'recipient not resolved' };
  }

  const weekLabel = formatWeekLabel(plan.week_start);
  const subject   = `No se ha generado plan para la semana del ${weekLabel}`;

  // We reuse the generic sendEmail with a plain text body until a dedicated
  // template is created. The React template can be replaced later.
  const result = await sendEmail({
    to:      recipient.email,
    subject,
    template: React.createElement(WeeklyPlanReadyEmail, {
      brand_name:       recipient.brand_name,
      week_start_label: weekLabel,
      review_url:       `${process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'https://neuropost.app'}/planificacion`,
      pillar_summary:   `Esta semana el equipo no ha podido generar contenido. Motivo: ${skipReason}. Te avisaremos la próxima semana.`,
    }),
    metadata: {
      brand_id:          plan.brand_id,
      weekly_plan_id:    plan.id,
      notification_type: 'weekly_plan.rejected_by_worker',
    },
  });

  // Insert notification record
  await db.from('notifications').insert({
    brand_id: plan.brand_id,
    type:     'weekly_plan.rejected_by_worker',
    message:  subject,
    metadata: { weekly_plan_id: plan.id, week_start: plan.week_start, skip_reason: skipReason },
    email_sent_at:   result.ok ? new Date().toISOString() : null,
    email_resend_id: result.ok ? result.id : null,
    email_error:     result.ok ? null : result.error,
  }).then(({ error: e }: { error: unknown }) => {
    if (e) log({ level: 'warn', scope: 'trigger-client-email',
                 event: 'rejection_notification_insert_failed', plan_id: planId });
  });

  if (result.ok) {
    log({ level: 'info', scope: 'trigger-client-email', event: 'rejection_email_sent',
          plan_id: planId, resend_id: result.id });
    return { ok: true };
  } else {
    const msg = result.error ?? 'sendEmail failed';
    log({ level: 'error', scope: 'trigger-client-email', event: 'rejection_email_failed',
          plan_id: planId, error: msg });
    return { ok: false, error: msg };
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function _markEmailFailed(db: DB, planId: string, reason: string): Promise<void> {
  await db
    .from('weekly_plans')
    .update({ client_email_status: 'failed' })
    .eq('id', planId);
  log({ level: 'warn', scope: 'trigger-client-email', event: 'client_email_status_failed',
        plan_id: planId, reason });
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