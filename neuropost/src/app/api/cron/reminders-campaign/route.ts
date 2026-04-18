// =============================================================================
// NEUROPOST — Cron: reminders-campaign
// Daily 11:00 UTC scan for 4 reminder categories:
//   · onboarding_incomplete — missing sector/voice/colors after 3 days
//   · no_social_connected   — none of ig/fb/tt connected after 3 or 10 days
//   · no_content            — fewer than 5 library items after 7 days
//   · plan_unused           — paid plan with no published posts in 14 days
// Anti-spam is enforced by canSendEmail() windows (30 days for the first
// three, 30 days for plan_unused) and by each brand.last_{type}_email_at
// column written via markEmailSent().
// =============================================================================

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import {
  sendOnboardingIncompleteEmail,
  sendNoSocialConnectedEmail,
  sendNoContentEmail,
  sendPlanUnusedEmail,
} from '@/lib/email';

export const runtime     = 'nodejs';
export const maxDuration = 120;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

function daysAgoISO(n: number): string {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
}

// ─── Segment queries ────────────────────────────────────────────────────────

async function segmentOnboardingIncomplete(db: DB): Promise<Array<{ id: string; missing: ('sector' | 'voice' | 'colors' | 'logo')[] }>> {
  const { data, error } = await db
    .from('brands')
    .select('id, sector, brand_voice_doc, colors, logo_url, created_at, last_onboarding_email_at')
    .lt('created_at', daysAgoISO(3))
    .limit(500);
  if (error) throw error;

  return (data ?? [])
    .map((b: {
      id: string; sector: string | null; brand_voice_doc: string | null;
      colors: unknown; logo_url: string | null;
    }) => {
      const missing: Array<'sector' | 'voice' | 'colors' | 'logo'> = [];
      if (!b.sector)          missing.push('sector');
      if (!b.brand_voice_doc) missing.push('voice');
      if (!b.colors)          missing.push('colors');
      if (!b.logo_url)        missing.push('logo');
      return { id: b.id, missing };
    })
    .filter((b: { missing: unknown[] }) => b.missing.length > 0);
}

async function segmentNoSocialConnected(db: DB): Promise<Array<{ id: string; daysSinceSignup: number }>> {
  // 3-day bucket + 10-day bucket — any brand past 3 days without
  // connections gets scanned; anti-spam keeps it to once per 30 days.
  const { data, error } = await db
    .from('brands')
    .select('id, ig_account_id, fb_page_id, tt_open_id, created_at')
    .lt('created_at', daysAgoISO(3))
    .is('ig_account_id', null)
    .is('fb_page_id',    null)
    .is('tt_open_id',    null)
    .limit(500);
  if (error) throw error;

  return (data ?? []).map((b: { id: string; created_at: string }) => {
    const days = Math.floor((Date.now() - new Date(b.created_at).getTime()) / (24 * 60 * 60 * 1000));
    return { id: b.id, daysSinceSignup: days };
  });
}

async function segmentNoContent(db: DB): Promise<Array<{ id: string; libraryCount: number }>> {
  const { data: brands, error } = await db
    .from('brands')
    .select('id, created_at')
    .lt('created_at', daysAgoISO(7))
    .limit(500);
  if (error) throw error;

  const out: Array<{ id: string; libraryCount: number }> = [];
  for (const b of (brands ?? []) as { id: string }[]) {
    const { count } = await db
      .from('media_library')
      .select('id', { count: 'exact', head: true })
      .eq('brand_id', b.id);
    const n = count ?? 0;
    if (n < 5) out.push({ id: b.id, libraryCount: n });
  }
  return out;
}

async function segmentPlanUnused(db: DB): Promise<Array<{ id: string; plan: string; daysIdle: number }>> {
  // Paid plan + no posts in last 14 days
  const { data: brands, error } = await db
    .from('brands')
    .select('id, plan, last_post_published_at, created_at')
    .neq('plan', 'starter')
    .limit(500);
  if (error) throw error;

  const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
  const out: Array<{ id: string; plan: string; daysIdle: number }> = [];
  for (const b of (brands ?? []) as { id: string; plan: string; last_post_published_at: string | null; created_at: string }[]) {
    const lastPost = b.last_post_published_at ? new Date(b.last_post_published_at).getTime() : 0;
    const startedAt = new Date(b.created_at).getTime();
    // Need the plan to be at least 14 days old AND the last post (if any)
    // to be older than the cutoff.
    if (startedAt > cutoff) continue;
    if (lastPost && lastPost > cutoff) continue;
    const reference = lastPost || startedAt;
    const daysIdle = Math.floor((Date.now() - reference) / (24 * 60 * 60 * 1000));
    out.push({ id: b.id, plan: b.plan, daysIdle });
  }
  return out;
}

// ─── Handler ────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const got = request.headers.get('authorization');
  if (!cronSecret || got !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = createAdminClient() as DB;

  const summary: Record<string, { found: number; sent: number; skipped: number }> = {
    onboarding_incomplete: { found: 0, sent: 0, skipped: 0 },
    no_social_connected:   { found: 0, sent: 0, skipped: 0 },
    no_content:            { found: 0, sent: 0, skipped: 0 },
    plan_unused:           { found: 0, sent: 0, skipped: 0 },
  };

  // onboarding_incomplete
  try {
    const rows = await segmentOnboardingIncomplete(db);
    summary.onboarding_incomplete.found = rows.length;
    for (const r of rows) {
      const sent = await sendOnboardingIncompleteEmail({ brandId: r.id, missing: r.missing });
      if (sent) summary.onboarding_incomplete.sent += 1;
      else      summary.onboarding_incomplete.skipped += 1;
    }
  } catch (err) { console.error('[reminders] onboarding_incomplete failed:', err); }

  // no_social_connected
  try {
    const rows = await segmentNoSocialConnected(db);
    summary.no_social_connected.found = rows.length;
    for (const r of rows) {
      const sent = await sendNoSocialConnectedEmail({ brandId: r.id, daysSinceSignup: r.daysSinceSignup });
      if (sent) summary.no_social_connected.sent += 1;
      else      summary.no_social_connected.skipped += 1;
    }
  } catch (err) { console.error('[reminders] no_social_connected failed:', err); }

  // no_content
  try {
    const rows = await segmentNoContent(db);
    summary.no_content.found = rows.length;
    for (const r of rows) {
      const sent = await sendNoContentEmail({ brandId: r.id, libraryCount: r.libraryCount });
      if (sent) summary.no_content.sent += 1;
      else      summary.no_content.skipped += 1;
    }
  } catch (err) { console.error('[reminders] no_content failed:', err); }

  // plan_unused
  try {
    const rows = await segmentPlanUnused(db);
    summary.plan_unused.found = rows.length;
    for (const r of rows) {
      const sent = await sendPlanUnusedEmail({ brandId: r.id, plan: r.plan, daysIdle: r.daysIdle });
      if (sent) summary.plan_unused.sent += 1;
      else      summary.plan_unused.skipped += 1;
    }
  } catch (err) { console.error('[reminders] plan_unused failed:', err); }

  return NextResponse.json(summary);
}
