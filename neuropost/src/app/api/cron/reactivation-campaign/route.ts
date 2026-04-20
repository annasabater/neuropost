// =============================================================================
// NEUROPOST — Cron: reactivation-campaign
// Daily scan of brands with no login for 7 / 14 / 30 days. Sends a
// localised reactivation email per segment. Anti-spam is handled by
// canSendEmail() against brands.last_reactivation_email_at (14-day window).
// =============================================================================

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { sendReactivationEmail } from '@/lib/email';

export const runtime     = 'nodejs';
export const maxDuration = 60;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

type Segment = 7 | 14 | 30;

interface BrandRow {
  id:                          string;
  plan:                        string | null;
  last_login_at:               string | null;
  last_reactivation_email_at:  string | null;
}

/** ISO timestamp N days ago. */
function daysAgo(n: number): string {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
}

async function selectSegment(db: DB, segment: Segment): Promise<BrandRow[]> {
  // Inactive for `segment` days but less than `segment + 1` so the email
  // doesn't re-fire every day after the threshold (canSendEmail also has
  // a 14-day anti-spam window as a safety net).
  const upper = daysAgo(segment);       // last_login_at < upper
  const lower = daysAgo(segment + 1);   // last_login_at >= lower
  const { data, error } = await db
    .from('brands')
    .select('id, plan, last_login_at, last_reactivation_email_at')
    .not('last_login_at', 'is', null)
    .lt('last_login_at', upper)
    .gte('last_login_at', lower)
    .limit(500);
  if (error) throw error;
  return (data ?? []) as BrandRow[];
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const got = request.headers.get('authorization');
  if (!cronSecret || got !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = createAdminClient() as DB;

  const summary: Record<string, { found: number; sent: number; skipped: number }> = {
    '7':  { found: 0, sent: 0, skipped: 0 },
    '14': { found: 0, sent: 0, skipped: 0 },
    '30': { found: 0, sent: 0, skipped: 0 },
  };

  for (const segment of [7, 14, 30] as Segment[]) {
    let rows: BrandRow[];
    try {
      rows = await selectSegment(db, segment);
    } catch (err) {
      console.error(`[reactivation] segment ${segment} query failed:`, err);
      continue;
    }
    summary[String(segment)].found = rows.length;

    for (const brand of rows) {
      try {
        const isPaid = !!brand.plan && brand.plan !== 'starter';
        const sent   = await sendReactivationEmail({
          brandId: brand.id,
          segment,
          isPaid,
        });
        if (sent) summary[String(segment)].sent += 1;
        else      summary[String(segment)].skipped += 1;
      } catch (err) {
        console.error(`[reactivation] send failed brand=${brand.id} segment=${segment}:`, err);
        summary[String(segment)].skipped += 1;
      }
    }
  }

  return NextResponse.json(summary);
}
