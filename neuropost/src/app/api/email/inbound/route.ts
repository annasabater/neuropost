import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';

// Resend inbound email webhook
// Configure in Resend dashboard: POST https://yourapp.com/api/email/inbound
export async function POST(request: Request) {
  try {
    const payload = await request.json() as {
      from?:    string;
      subject?: string;
      text?:    string;
      html?:    string;
      messageId?: string;
      inReplyTo?: string;
    };

    const db = createAdminClient();

    const senderEmail = payload.from ?? '';
    const content     = payload.text ?? payload.html ?? '';
    const messageId   = payload.messageId ?? null;
    const inReplyTo   = payload.inReplyTo ?? null;

    // Extract username from sender (best-effort)
    const senderUsername = senderEmail.split('@')[0] ?? senderEmail;

    // Find existing prospect by email
    const { data: prospect } = await db
      .from('prospects')
      .select('id')
      .eq('email', senderEmail)
      .single();

    // Derive thread ID from inReplyTo or create new
    const threadId = inReplyTo
      ? (await db.from('messages').select('thread_id,id').eq('external_id', inReplyTo).single()).data?.thread_id ?? inReplyTo
      : messageId ?? crypto.randomUUID();

    const now = new Date().toISOString();

    const { data: saved } = await db.from('messages').insert({
      platform:        'email',
      external_id:     messageId,
      thread_id:       threadId,
      sender_username: senderUsername,
      sender_id:       senderEmail,
      content:         content.substring(0, 4000),
      status:          'unread',
      prospect_id:     prospect?.id ?? null,
      created_at:      now,
    }).select().single();

    // Update prospect last_activity if linked
    if (prospect?.id) {
      await db.from('prospect_interactions').insert({
        prospect_id: prospect.id,
        type:        'email_replied',
        content:     content.substring(0, 500),
        metadata:    { message_id: saved?.id, subject: payload.subject },
      });

      await db.from('prospects').update({
        last_activity: now,
        updated_at:    now,
      }).eq('id', prospect.id);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
