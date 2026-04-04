import { NextResponse } from 'next/server';
import { requireSuperAdmin, adminErrorResponse } from '@/lib/admin';
import { createAdminClient } from '@/lib/supabase';
import { Resend } from 'resend';

export async function POST(request: Request) {
  try {
    const user = await requireSuperAdmin();
    const db   = createAdminClient();
    const { threadId, text, subject } =
      await request.json() as { threadId: string; text: string; subject?: string };

    if (!threadId || !text?.trim()) {
      return NextResponse.json({ error: 'threadId and text are required' }, { status: 400 });
    }

    const { data: original } = await db
      .from('messages')
      .select('*')
      .or(`thread_id.eq.${threadId},id.eq.${threadId}`)
      .eq('platform', 'email')
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (!original) return NextResponse.json({ error: 'Thread not found' }, { status: 404 });

    const recipientEmail = original.sender_id; // stored as email address
    if (!recipientEmail || !recipientEmail.includes('@')) {
      return NextResponse.json({ error: 'No recipient email found' }, { status: 422 });
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const replySubject = subject ?? `Re: ${original.content?.substring(0, 60) ?? 'Tu mensaje'}`;

    await resend.emails.send({
      from:    'NeuroPost <hola@neuropost.app>',
      to:      recipientEmail,
      subject: replySubject,
      html:    `<p>${text.trim().replace(/\n/g, '<br/>')}</p><p style="color:#999;font-size:12px">NeuroPost — gestión de redes sociales con IA</p>`,
    });

    const now = new Date().toISOString();

    await db.from('messages').insert({
      platform:        'email',
      thread_id:       original.thread_id ?? original.id,
      sender_username: 'neuropost_team',
      sender_id:       'hola@neuropost.app',
      content:         text.trim(),
      our_reply:       text.trim(),
      status:          'replied',
      prospect_id:     original.prospect_id,
      created_at:      now,
      replied_at:      now,
    });

    await db.from('messages')
      .update({ status: 'replied', replied_at: now })
      .or(`thread_id.eq.${threadId},id.eq.${threadId}`)
      .neq('status', 'replied');

    if (original.prospect_id) {
      await db.from('prospect_interactions').insert({
        prospect_id: original.prospect_id,
        type:        'email_sent',
        content:     text.trim(),
        metadata:    { thread_id: threadId, sent_by: user.id },
      });

      await db.from('prospects').update({
        last_activity: now,
        updated_at:    now,
      }).eq('id', original.prospect_id);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const { error, status } = adminErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}
