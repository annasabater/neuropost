// =============================================================================
// Planning — trigger-calendar-email
// =============================================================================
// Sends the "calendar ready" email to the brand owner and records the result
// in the notifications table. Fired when a weekly_plan transitions to
// 'calendar_ready'.

import { sendEmail }             from '@/lib/email/service';
import { resolveBrandRecipient } from '@/lib/email/resolve-recipient';
import FinalCalendarReadyEmail   from '@/emails/FinalCalendarReadyEmail';
import { createAdminClient }     from '@/lib/supabase';
import React                     from 'react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export async function enqueueCalendarReadyEmail(planId: string): Promise<void> {
  const db = createAdminClient() as DB;

  const { data: plan, error: planErr } = await db
    .from('weekly_plans')
    .select('id, brand_id, week_start')
    .eq('id', planId)
    .single();

  if (planErr || !plan) {
    console.error('[calendar-email] Plan no encontrado:', planId, planErr);
    return;
  }

  const recipient = await resolveBrandRecipient(plan.brand_id as string);
  if (!recipient) {
    console.error('[calendar-email] No se resolvió destinatario:', plan.brand_id);
    return;
  }

  const weekLabel   = formatWeekLabel(plan.week_start as string);
  const calendarUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'https://neuropost.app'}/planificacion/${plan.id as string}`;
  const subject     = `Tu calendario de publicación de la semana del ${weekLabel} está listo`;

  const result = await sendEmail({
    to:      recipient.email,
    subject,
    template: React.createElement(FinalCalendarReadyEmail, {
      brand_name:       recipient.brand_name,
      week_start_label: weekLabel,
      calendar_url:     calendarUrl,
    }),
    metadata: {
      brand_id:          plan.brand_id as string,
      weekly_plan_id:    plan.id as string,
      notification_type: 'weekly_plan.final_calendar_ready',
    },
  });

  const { error: notifErr } = await db.from('notifications').insert({
    brand_id:        plan.brand_id,
    type:            'weekly_plan.final_calendar_ready',
    message:         subject,
    metadata: {
      weekly_plan_id: plan.id,
      week_start:     plan.week_start,
      user_id:        recipient.user_id,
      calendar_url:   calendarUrl,
    },
    email_sent_at:   result.ok ? new Date().toISOString() : null,
    email_resend_id: result.ok ? result.id               : null,
    email_error:     result.ok ? null                    : result.error,
  });

  if (notifErr) {
    console.error('[calendar-email] Error insertando notification:', notifErr);
  }

  if (result.ok) {
    console.log('[calendar-email] Email enviado, plan:', planId);
  } else {
    console.error('[calendar-email] Error enviando email:', result.error);
  }
}

function formatWeekLabel(weekStart: string): string {
  const d = new Date(weekStart + 'T00:00:00Z');
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', timeZone: 'UTC' });
}
