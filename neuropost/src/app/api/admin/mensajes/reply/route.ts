import { NextResponse } from 'next/server';
import { requireSuperAdmin, adminErrorResponse } from '@/lib/admin';
import { createAdminClient } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const user = await requireSuperAdmin();
    const db   = createAdminClient();
    const { threadId, text } = await request.json() as { threadId: string; text: string };

    if (!threadId || !text?.trim()) {
      return NextResponse.json({ error: 'threadId and text are required' }, { status: 400 });
    }

    // Fetch first message in thread to get IG context
    const { data: original } = await db
      .from('messages')
      .select('*')
      .or(`thread_id.eq.${threadId},id.eq.${threadId}`)
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (!original) return NextResponse.json({ error: 'Thread not found' }, { status: 404 });

    const { data: brand } = await db
      .from('brands')
      .select('ig_account_id, meta_access_token')
      .not('meta_access_token', 'is', null)
      .limit(1)
      .single();

    let igMessageId: string | null = null;

    // Send via Meta Graph API if IG DM
    if (original.platform === 'instagram' && brand?.ig_account_id && brand?.meta_access_token && original.sender_id) {
      try {
        const res = await fetch(
          `https://graph.facebook.com/v19.0/${brand.ig_account_id}/messages`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              recipient: { id: original.sender_id },
              message:   { text: text.trim() },
              access_token: brand.meta_access_token,
            }),
          },
        );
        const json = await res.json() as { message_id?: string };
        igMessageId = json.message_id ?? null;
      } catch {
        // Proceed with local save even if Meta API fails
      }
    }

    const now = new Date().toISOString();

    // Save our reply
    const { data: saved } = await db.from('messages').insert({
      platform:       original.platform,
      thread_id:      original.thread_id ?? original.id,
      external_id:    igMessageId,
      sender_username: 'neuropost_team',
      content:        text.trim(),
      our_reply:      text.trim(),
      status:         'replied',
      prospect_id:    original.prospect_id,
      created_at:     now,
      replied_at:     now,
    }).select().single();

    // Mark original as replied
    await db.from('messages')
      .update({ status: 'replied', replied_at: now })
      .or(`thread_id.eq.${threadId},id.eq.${threadId}`)
      .neq('status', 'replied');

    // Update prospect activity
    if (original.prospect_id) {
      await db.from('prospect_interactions').insert({
        prospect_id: original.prospect_id,
        type:        'dm_sent',
        content:     text.trim(),
        metadata:    { thread_id: threadId, sent_by: user.id },
      });

      await db.from('prospects').update({
        last_activity: now,
        updated_at:    now,
      }).eq('id', original.prospect_id);
    }

    return NextResponse.json({ ok: true, message: saved });
  } catch (err) {
    const { error, status } = adminErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}
