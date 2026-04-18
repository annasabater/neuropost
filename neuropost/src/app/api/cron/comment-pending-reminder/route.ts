// =============================================================================
// NEUROPOST — Cron: comment-pending-reminder
// Scans public.comments for rows that have been sitting with status='pending'
// for more than 24h AND haven't already triggered a reminder email. Sends one
// summary email per brand (one email, N comments aggregated).
// Dedupe: activity_log entry with action='email_sent_comment_pending' and
// entity_id = <comment.id>.
// =============================================================================

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { canSendEmail, markEmailSent } from '@/lib/email/preferences';
import { getTemplate } from '@/lib/email/templates';

export const runtime     = 'nodejs';
export const maxDuration = 120;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

const DELAY_HOURS  = 24;
const BATCH_LIMIT  = 500;  // cap scan per tick

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const got = request.headers.get('authorization');
  if (!cronSecret || got !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = createAdminClient() as DB;
  const cutoff = new Date(Date.now() - DELAY_HOURS * 60 * 60 * 1000).toISOString();

  // 1. Pull pending comments older than 24h
  const { data: pending, error } = await db
    .from('comments')
    .select('id, brand_id, platform, author, content, created_at')
    .eq('status', 'pending')
    .lt('created_at', cutoff)
    .order('created_at', { ascending: true })
    .limit(BATCH_LIMIT);

  if (error) {
    console.error('[comment-pending-reminder] query failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!pending || pending.length === 0) {
    return NextResponse.json({ scanned: 0, emailsSent: 0 });
  }

  // 2. Dedupe — remove any comment we already emailed about
  const ids = (pending as { id: string }[]).map(c => c.id);
  const { data: alreadySent } = await db
    .from('activity_log')
    .select('entity_id')
    .eq('action', 'email_sent_comment_pending')
    .in('entity_id', ids);

  const sentSet = new Set<string>((alreadySent ?? []).map((r: { entity_id: string }) => r.entity_id));
  const fresh = (pending as { id: string; brand_id: string; platform: string; author: string; content: string; created_at: string }[])
    .filter(c => !sentSet.has(c.id));

  if (fresh.length === 0) {
    return NextResponse.json({ scanned: pending.length, emailsSent: 0 });
  }

  // 3. Group by brand
  const byBrand = new Map<string, typeof fresh>();
  for (const c of fresh) {
    const arr = byBrand.get(c.brand_id) ?? [];
    arr.push(c);
    byBrand.set(c.brand_id, arr);
  }

  let emailsSent = 0;
  const results: Array<{ brandId: string; sent: boolean; reason?: string; count: number }> = [];

  for (const [brandId, group] of byBrand) {
    const gate = await canSendEmail(brandId, 'comment_pending');
    if (!gate.allowed) {
      results.push({ brandId, sent: false, reason: gate.reason, count: group.length });
      continue;
    }
    if (!gate.email) {
      results.push({ brandId, sent: false, reason: 'no_recipient', count: group.length });
      continue;
    }

    // Build a single summary message
    const count = group.length;
    const lines = group.slice(0, 5).map(c => {
      const snippet = (c.content ?? '').replace(/\s+/g, ' ').slice(0, 120);
      return `<li><strong>${escapeHtml(c.author)}</strong> (${escapeHtml(c.platform)}): “${escapeHtml(snippet)}”</li>`;
    }).join('');
    const more = count > 5 ? `<p style="color:#888;font-size:13px">Y ${count - 5} más…</p>` : '';
    const message =
      `Tienes ${count} comentario${count === 1 ? '' : 's'} sin responder desde hace más de 24h.` +
      `<ul style="color:#555;line-height:1.8;padding-left:20px;margin:16px 0">${lines}</ul>${more}`;

    try {
      // We render through genericNotification so the language + CTA come from
      // the template pack. The CTA for 'comment' already points to /comments.
      const factory = getTemplate('genericNotification', gate.language);
      const { subject, html: body } = factory({
        brandName: gate.brandName ?? 'Tu negocio',
        type:      'comment',
        message,
      });

      // Wrap with the footer (we need the gated layout for unsubscribe link).
      const { sendGatedRaw } = await import('@/lib/email/sendRaw');
      await sendGatedRaw({ brandId, type: 'comment_pending', to: gate.email, subject, body });
      await markEmailSent(brandId, 'comment_pending', { count, comment_ids: group.map(c => c.id) });

      // 4. Dedupe log — one row per comment so we don't re-email
      await db.from('activity_log').insert(
        group.map(c => ({
          brand_id:    brandId,
          action:      'email_sent_comment_pending',
          entity_type: 'comment',
          entity_id:   c.id,
          details:     { platform: c.platform },
        })),
      );

      emailsSent += 1;
      results.push({ brandId, sent: true, count });
    } catch (err) {
      console.error(`[comment-pending-reminder] send failed for brand ${brandId}:`, err);
      results.push({ brandId, sent: false, reason: err instanceof Error ? err.message : String(err), count });
    }
  }

  return NextResponse.json({
    scanned:    pending.length,
    freshComments: fresh.length,
    brands:     byBrand.size,
    emailsSent,
    results,
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
