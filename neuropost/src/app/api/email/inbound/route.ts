import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-utils';
import { createAdminClient } from '@/lib/supabase';
import { createHmac, timingSafeEqual } from 'crypto';

type InboundPayload = {
  from?:       string;
  subject?:    string;
  text?:       string;
  html?:       string;
  messageId?:  string;
  inReplyTo?:  string;
};

async function handleInbound(payload: InboundPayload): Promise<NextResponse> {
  const db = createAdminClient();

  const senderEmail    = payload.from ?? '';
  const content        = payload.text ?? payload.html ?? '';
  const messageId      = payload.messageId ?? null;
  const inReplyTo      = payload.inReplyTo ?? null;
  const senderUsername = senderEmail.split('@')[0] ?? senderEmail;

  const { data: prospect } = await db
    .from('prospects')
    .select('id')
    .eq('email', senderEmail)
    .single();

  const threadId = inReplyTo
    ? (await db.from('messages').select('thread_id').eq('external_id', inReplyTo).single()).data?.thread_id ?? inReplyTo
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

  if (prospect?.id) {
    await db.from('prospect_interactions').insert({
      prospect_id: prospect.id,
      type:        'email_replied',
      content:     content.substring(0, 500),
      metadata:    { message_id: saved?.id, subject: payload.subject },
    });
    await db.from('prospects').update({ last_activity: now, updated_at: now }).eq('id', prospect.id);
  }

  return NextResponse.json({ ok: true });
}

// Resend inbound email webhook
// Configure in Resend dashboard: POST https://yourapp.com/api/email/inbound
export async function POST(request: Request) {
  try {
    const secret = process.env.RESEND_INBOUND_SECRET;

    if (secret) {
      const signature = request.headers.get('svix-signature') ?? request.headers.get('x-resend-signature') ?? '';
      const rawBody   = await request.text();
      const expected  = createHmac('sha256', secret).update(rawBody).digest('hex');
      const sigHex    = signature.replace(/^sha256=/, '');
      let valid = false;
      try {
        valid = timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(sigHex, 'hex'));
      } catch { valid = false; }
      if (!valid) return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      return handleInbound(JSON.parse(rawBody) as InboundPayload);
    }

    return handleInbound(await request.json() as InboundPayload);
  } catch (err) {
    return apiError(err, 'email/inbound');
  }
}
