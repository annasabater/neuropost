// =============================================================================
// NEUROPOST — Email queue helpers
// Used by notify() + emitters to defer sending when the brand chose
// max_frequency = 'daily' | 'weekly'. Processed by the cron in
// /api/cron/email-queue-processor.
// =============================================================================

import { createAdminClient } from '@/lib/supabase';
import type { EmailType } from './preferences';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

const DEFAULT_TZ  = 'Europe/Madrid';
const DIGEST_HOUR = 20; // 20:00 local time

/** Read "HH:MM" in the target timezone for an instant. */
function localHourMinute(at: Date, tz: string): { h: number; m: number; weekday: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour:     '2-digit',
    minute:   '2-digit',
    weekday:  'short',
    hour12:   false,
  }).formatToParts(at);
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? '';
  const h = Number(get('hour'));
  const m = Number(get('minute'));
  // weekday shorts: Mon, Tue, Wed, Thu, Fri, Sat, Sun → 1..7
  const WEEKDAY = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'] as const;
  const weekday = Math.max(1, WEEKDAY.indexOf(get('weekday') as typeof WEEKDAY[number]) + 1);
  return { h, m, weekday };
}

/** Next 20:00 local in `tz` from now. Approximation: ignores DST mid-day jumps. */
export function nextDailyDigestSendAt(tz: string = DEFAULT_TZ): Date {
  const now = new Date();
  const { h, m } = localHourMinute(now, tz);
  const currentMinutes = h * 60 + m;
  const targetMinutes  = DIGEST_HOUR * 60;
  let diff = targetMinutes - currentMinutes;
  if (diff <= 0) diff += 24 * 60;
  return new Date(now.getTime() + diff * 60 * 1000);
}

/** Next Sunday 20:00 local in `tz`. */
export function nextWeeklyDigestSendAt(tz: string = DEFAULT_TZ): Date {
  const now = new Date();
  const { h, m, weekday } = localHourMinute(now, tz);
  const currentMinutes = h * 60 + m;
  const targetMinutes  = DIGEST_HOUR * 60;
  // weekday: 1=Mon..7=Sun. Next Sunday.
  let daysUntilSunday = (7 - weekday + 7) % 7; // Sun→0, Mon→6, ...
  if (daysUntilSunday === 0 && currentMinutes >= targetMinutes) daysUntilSunday = 7;
  const minutesUntil = daysUntilSunday * 24 * 60 + (targetMinutes - currentMinutes);
  return new Date(now.getTime() + minutesUntil * 60 * 1000);
}

/** Compute send_at given a brand frequency + optional explicit delay. */
export function computeSendAt(params: {
  frequency: 'immediate' | 'daily' | 'weekly';
  tz?:       string;
  /** Minimum delay from now (used e.g. by chat_message → +24h). */
  delayMs?:  number;
}): Date {
  const tz = params.tz || DEFAULT_TZ;
  const baseDelay = params.delayMs ? new Date(Date.now() + params.delayMs) : new Date();
  if (params.frequency === 'daily') {
    const dailyAt = nextDailyDigestSendAt(tz);
    return dailyAt.getTime() > baseDelay.getTime() ? dailyAt : baseDelay;
  }
  if (params.frequency === 'weekly') {
    const weeklyAt = nextWeeklyDigestSendAt(tz);
    return weeklyAt.getTime() > baseDelay.getTime() ? weeklyAt : baseDelay;
  }
  return baseDelay; // 'immediate' with an explicit delay (chat_message case)
}

// ─── Enqueue ────────────────────────────────────────────────────────────────

export interface EnqueueEmailParams {
  brandId:   string;
  emailType: EmailType;
  /** Payload used by the processor to render the final email. */
  payload:   Record<string, unknown>;
  /** Pre-computed send_at. If omitted, derived from frequency + tz. */
  sendAt?:   Date;
  /** Only used when sendAt is not provided. */
  frequency?: 'immediate' | 'daily' | 'weekly';
  tz?:       string;
  /** Additional delay above/below the computed time. */
  delayMs?:  number;
  subject?:  string;
  preview?:  string;
}

export async function enqueueEmail(params: EnqueueEmailParams): Promise<string | null> {
  const db = createAdminClient() as DB;
  const sendAt = params.sendAt ?? computeSendAt({
    frequency: params.frequency ?? 'immediate',
    tz:        params.tz,
    delayMs:   params.delayMs,
  });
  const { data, error } = await db.from('email_queue').insert({
    brand_id:   params.brandId,
    email_type: params.emailType,
    subject:    params.subject ?? '(queued)',
    preview:    params.preview ?? null,
    payload:    params.payload,
    send_at:    sendAt.toISOString(),
    status:     'pending',
  }).select('id').single();
  if (error) {
    console.error('[enqueueEmail] insert failed:', error);
    return null;
  }
  return (data?.id as string) ?? null;
}
