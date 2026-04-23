// =============================================================================
// Sprint 5 — Reminder processing for weekly_plans in client_reviewing
// =============================================================================
// Called by GET /api/cron/plan-reminders (runs 12:00 + 20:00 UTC).
// Sends escalated reminders at day 2 / day 4 and auto-approves at day 6.

import { createAdminClient }       from '@/lib/supabase';
import { sendEmail }               from '@/lib/email/service';
import { resolveBrandRecipient }   from '@/lib/email/resolve-recipient';
import { queueJob }                from '@/lib/agents/queue';
import ReminderDay2Email           from '@/emails/ReminderDay2Email';
import ReminderDay4Email           from '@/emails/ReminderDay4Email';
import AutoApprovedEmail           from '@/emails/AutoApprovedEmail';
import React                       from 'react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export type ReminderType = 'day_2' | 'day_4' | 'day_6';

export interface ReminderResult {
  sent:         number;
  skipped:      number;
  autoApproved: number;
  errors:       number;
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function processReminders(): Promise<ReminderResult> {
  const db  = createAdminClient() as DB;
  const now = new Date();

  const { data: plans, error } = await db
    .from('weekly_plans')
    .select('*, brands ( auto_approve_after_days )')
    .eq('status', 'client_reviewing')
    .not('sent_to_client_at', 'is', null);

  if (error || !plans) {
    console.error('[reminders] Error cargando planes:', error);
    return { sent: 0, skipped: 0, autoApproved: 0, errors: 1 };
  }

  const result: ReminderResult = { sent: 0, skipped: 0, autoApproved: 0, errors: 0 };

  for (const plan of plans) {
    try {
      const sentAt      = new Date(plan.sent_to_client_at as string);
      const daysSince   = (now.getTime() - sentAt.getTime()) / (1000 * 60 * 60 * 24);
      const threshold   = (plan.brands?.auto_approve_after_days as number | null) ?? 6;

      // ── Day 6+ : auto-approve ──────────────────────────────────────────────
      if (daysSince >= threshold) {
        if (!plan.auto_approved) {
          const outcome = await autoApprovePlan(plan.id as string);
          if (outcome.ok) result.autoApproved++;
          else            result.errors++;
        } else {
          result.skipped++;
        }
        continue;
      }

      // ── Day 4 : ReminderDay4Email ──────────────────────────────────────────
      if (daysSince >= 4) {
        const daysLeft = Math.max(1, Math.ceil(threshold - daysSince));
        const sent = await sendReminderIfNotSent(
          plan,
          'reminder_4_sent_at',
          (recipient) => React.createElement(ReminderDay4Email, {
            brand_name: recipient.brand_name,
            review_url: buildReviewUrl(plan.id),
            days_left:  daysLeft,
          }),
          `Recordatorio: todavía puedes revisar tu plan — ${formatWeekLabel(plan.week_start as string)}`,
        );
        tally(result, sent);
        continue;
      }

      // ── Day 2 : ReminderDay2Email ──────────────────────────────────────────
      if (daysSince >= 2) {
        const sent = await sendReminderIfNotSent(
          plan,
          'reminder_2_sent_at',
          (recipient) => React.createElement(ReminderDay2Email, {
            brand_name: recipient.brand_name,
            review_url: buildReviewUrl(plan.id),
          }),
          `Tu propuesta de la ${formatWeekLabel(plan.week_start as string)} te espera`,
        );
        tally(result, sent);
        continue;
      }

      // Less than 2 days — nothing yet
      result.skipped++;
    } catch (err) {
      console.error('[reminders] Error procesando plan', plan.id, err);
      result.errors++;
    }
  }

  console.log('[reminders] Resultado:', result);
  return result;
}

// ─── Auto-approve ─────────────────────────────────────────────────────────────

export async function autoApprovePlan(weekId: string): Promise<{
  ok:                  boolean;
  ideas_auto_approved: number;
  ideas_preserved:     number;
  error?:              string;
}> {
  const db = createAdminClient() as DB;

  try {
    const { data: plan, error: planErr } = await db
      .from('weekly_plans')
      .select('*')
      .eq('id', weekId)
      .single();

    if (planErr || !plan) {
      return { ok: false, ideas_auto_approved: 0, ideas_preserved: 0, error: 'Plan no encontrado' };
    }

    if (plan.status !== 'client_reviewing') {
      return {
        ok:                  false,
        ideas_auto_approved: 0,
        ideas_preserved:     0,
        error:               `Estado inválido para auto-approve: ${plan.status as string}`,
      };
    }

    const { data: ideas } = await db
      .from('content_ideas')
      .select('*')
      .eq('week_id', weekId);

    if (!ideas || ideas.length === 0) {
      return { ok: false, ideas_auto_approved: 0, ideas_preserved: 0, error: 'Plan sin ideas' };
    }

    const pending   = ideas.filter((i: { status: string }) => i.status === 'pending');
    const preserved = ideas.length - pending.length;

    // Auto-aprobar las ideas todavía en pending
    if (pending.length > 0) {
      const { error: updateErr } = await db
        .from('content_ideas')
        .update({ status: 'auto_approved' })
        .in('id', pending.map((i: { id: string }) => i.id));

      if (updateErr) {
        return { ok: false, ideas_auto_approved: 0, ideas_preserved: preserved, error: updateErr.message };
      }
    }

    // Transicionar plan a producing (via direct UPDATE — bypasses status machine
    // because auto_approved is a legitimate exception to the normal flow)
    await db
      .from('weekly_plans')
      .update({
        status:             'producing',
        auto_approved:      true,
        auto_approved_at:   new Date().toISOString(),
        client_approved_at: new Date().toISOString(),
      })
      .eq('id', weekId);

    // Encolar producción para ideas aprobadas/editadas/auto-aprobadas
    const producibles = ideas.filter((i: { status: string }) =>
      i.status === 'client_approved' ||
      i.status === 'client_edited'   ||
      i.status === 'pending',           // these just got auto-approved
    );

    for (const idea of producibles) {
      await queueJob({
        brand_id:      plan.brand_id as string,
        agent_type:    'content',
        action:        'generate_caption',
        priority:      50,
        parent_job_id: (plan.parent_job_id as string | null) ?? undefined,
        input: {
          content_idea_id: idea.id,
          final_copy:      idea.final_copy ?? idea.client_edited_copy ?? idea.copy_draft,
        },
      });
      if (idea.format !== 'reel') {
        await queueJob({
          brand_id:      plan.brand_id as string,
          agent_type:    'content',
          action:        'generate_image',
          priority:      50,
          parent_job_id: (plan.parent_job_id as string | null) ?? undefined,
          input: {
            content_idea_id: idea.id,
            userPrompt:      idea.suggested_asset_url ?? idea.angle,
            format:          idea.format === 'story' ? 'story' : 'post',
            brandId:         plan.brand_id,
          },
        });
      }
      await db.from('content_ideas').update({ status: 'in_production' }).eq('id', idea.id);
    }

    // Email de auto-approve al cliente
    const recipient = await resolveBrandRecipient(plan.brand_id as string);
    if (recipient) {
      const weekLabel   = formatWeekLabel(plan.week_start as string);
      const calendarUrl = buildReviewUrl(plan.id);
      const subject     = `Hemos seguido adelante con tu plan de la ${weekLabel}`;

      const emailResult = await sendEmail({
        to:       recipient.email,
        subject,
        template: React.createElement(AutoApprovedEmail, {
          brand_name:       recipient.brand_name,
          week_start_label: weekLabel,
          calendar_url:     calendarUrl,
        }),
        metadata: {
          brand_id:          plan.brand_id as string,
          weekly_plan_id:    plan.id as string,
          notification_type: 'weekly_plan.auto_approved',
        },
      });

      await db.from('notifications').insert({
        brand_id:        plan.brand_id,
        type:            'weekly_plan.auto_approved',
        message:         subject,
        metadata: {
          weekly_plan_id: plan.id,
          week_start:     plan.week_start,
          user_id:        recipient.user_id,
          calendar_url:   calendarUrl,
        },
        email_sent_at:   emailResult.ok ? new Date().toISOString() : null,
        email_resend_id: emailResult.ok ? emailResult.id             : null,
        email_error:     emailResult.ok ? null                       : emailResult.error,
      });
    }

    console.log(`[auto-approve] Plan ${weekId}: ${pending.length} auto-aprobadas, ${preserved} preservadas`);
    return { ok: true, ideas_auto_approved: pending.length, ideas_preserved: preserved };
  } catch (err) {
    console.error('[auto-approve] Error:', err);
    return {
      ok:                  false,
      ideas_auto_approved: 0,
      ideas_preserved:     0,
      error:               err instanceof Error ? err.message : 'unknown',
    };
  }
}

// ─── Reminder helper ──────────────────────────────────────────────────────────

/**
 * Sends a reminder email using an atomic conditional UPDATE for idempotency.
 * Returns true = sent, false = already sent (skipped), null = error.
 */
async function sendReminderIfNotSent(
  plan:           Record<string, unknown>,
  reminderColumn: 'reminder_2_sent_at' | 'reminder_4_sent_at' | 'reminder_6_sent_at',
  buildElement:   (recipient: { brand_name: string; user_id: string; email: string }) => React.ReactElement,
  subject:        string,
): Promise<boolean | null> {
  const db = createAdminClient() as DB;

  // Atomic claim: only UPDATE if the column is still NULL
  const { data: claimed, error: claimErr } = await db
    .from('weekly_plans')
    .update({ [reminderColumn]: new Date().toISOString() })
    .eq('id', plan.id)
    .is(reminderColumn, null)
    .select('id')
    .maybeSingle();

  if (claimErr) { console.error('[reminders] Claim error:', claimErr); return null; }
  if (!claimed) return false;   // another worker already sent this reminder

  const recipient = await resolveBrandRecipient(plan.brand_id as string);
  if (!recipient) {
    console.error('[reminders] No recipient for brand:', plan.brand_id);
    return null;
  }

  const notifType = `weekly_plan.${reminderColumn.replace('_sent_at', '')}`;

  const result = await sendEmail({
    to:       recipient.email,
    subject,
    template: buildElement(recipient),
    metadata: {
      brand_id:          plan.brand_id as string,
      weekly_plan_id:    plan.id as string,
      notification_type: notifType,
    },
  });

  await db.from('notifications').insert({
    brand_id:        plan.brand_id,
    type:            notifType,
    message:         subject,
    metadata: {
      weekly_plan_id: plan.id,
      week_start:     plan.week_start,
      user_id:        recipient.user_id,
      review_url:     buildReviewUrl(plan.id as string),
    },
    email_sent_at:   result.ok ? new Date().toISOString() : null,
    email_resend_id: result.ok ? result.id                : null,
    email_error:     result.ok ? null                     : result.error,
  });

  console.log(`[reminders] ${reminderColumn} → plan ${plan.id as string}: email=${result.ok ? 'ok' : result.error}`);
  return result.ok;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function tally(result: ReminderResult, sent: boolean | null) {
  if      (sent === true)  result.sent++;
  else if (sent === false) result.skipped++;
  else                     result.errors++;
}

function buildReviewUrl(planId: unknown): string {
  return `${process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'https://neuropost.app'}/planificacion/${planId as string}`;
}

function formatWeekLabel(weekStart: string): string {
  const d = new Date(weekStart + 'T00:00:00Z');
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', timeZone: 'UTC' });
}
