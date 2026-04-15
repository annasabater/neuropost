import { NextResponse } from 'next/server';
import { verifyMetaWebhookSignature } from '@/lib/meta';
import { createAdminClient } from '@/lib/supabase';
import { queueJob } from '@/lib/agents/queue';

// ─── Webhook verification (GET) ────────────────────────────────────────────────

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode      = searchParams.get('hub.mode');
  const token     = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === (process.env.META_WEBHOOK_VERIFY_TOKEN ?? '')) {
    return new Response(challenge ?? '', { status: 200 });
  }

  return new Response('Forbidden', { status: 403 });
}

// ─── Webhook events (POST) ─────────────────────────────────────────────────────

interface MetaWebhookEntry {
  id:      string;
  changes: { field: string; value: Record<string, unknown> }[];
}

export async function POST(request: Request) {
  const payload   = await request.text();
  const signature = request.headers.get('x-hub-signature-256') ?? '';

  if (!verifyMetaWebhookSignature(payload, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let body: { object: string; entry: MetaWebhookEntry[] };
  try {
    body = JSON.parse(payload);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (body.object !== 'instagram' && body.object !== 'page') {
    return NextResponse.json({ received: true });
  }

  const supabase = createAdminClient();

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field === 'comments' || change.field === 'feed') {
        const val = change.value as {
          id?: string;
          text?: string;
          from?: { name?: string; id?: string };
          created_time?: number;
          media_id?: string;
          post_id?: string;
        };

        const externalId = val.id;
        if (!externalId) continue;

        // Check not already saved
        const { data: existing } = await supabase
          .from('comments')
          .select('id')
          .eq('external_id', externalId)
          .maybeSingle();

        if (existing) continue;

        // Find brand by ig_account_id (entry.id is the IG account)
        const { data: brand } = await supabase
          .from('brands')
          .select('id')
          .eq('ig_account_id', entry.id)
          .maybeSingle();

        if (!brand) continue;

        await supabase.from('comments').insert({
          brand_id:    brand.id,
          platform:    'instagram', // TODO [FASE 2]: Facebook — body.object === 'facebook'
          external_id: externalId,
          author:      val.from?.name ?? 'Unknown',
          content:     val.text ?? '',
          status:      'pending',
        });

        await supabase.from('notifications').insert({
          brand_id: brand.id,
          type:     'comment',
          message:  `Nuevo comentario de ${val.from?.name ?? 'alguien'}: "${(val.text ?? '').slice(0, 60)}..."`,
          read:     false,
          metadata: { external_id: externalId },
        });

        // Queue moderation agent for the new comment (fire-and-forget)
        queueJob({
          brand_id:     brand.id,
          agent_type:   'moderation',
          action:       'check_brand_safety',
          input:        {
            source:      'ig_webhook',
            external_id: externalId,
            author:      val.from?.name ?? 'Unknown',
            content:     val.text ?? '',
            platform:    'instagram',
          },
          priority:     60,
          requested_by: 'cron',
        }).catch(() => null);
      }
    }
  }

  return NextResponse.json({ received: true });
}
