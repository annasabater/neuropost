// =============================================================================
// Webhook: Replicate async prediction results
// POST /api/webhooks/replicate
//
// Auth: HMAC-SHA256 signature (Standard Webhooks / Svix) via headers
//   webhook-id, webhook-timestamp, webhook-signature
// Secret: REPLICATE_WEBHOOK_SECRET (generate from Replicate dashboard).
//
// Flow: validate → parse → verify prediction_id still matches → update row.
// =============================================================================

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import {
  verifyReplicateWebhook,
  isAllowedReplicateImageUrl,
} from '@/lib/replicate-webhook-verify';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

interface ReplicateWebhookBody {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  output?: string | string[] | null;
  error?: string | null;
}

export async function POST(request: Request) {
  // Raw body is required for HMAC — don't use request.json() before verify
  const rawBody = await request.text();

  const verdict = verifyReplicateWebhook(
    rawBody,
    {
      id:        request.headers.get('webhook-id'),
      timestamp: request.headers.get('webhook-timestamp'),
      signature: request.headers.get('webhook-signature'),
    },
    process.env.REPLICATE_WEBHOOK_SECRET,
  );
  if (!verdict.ok) {
    console.warn(`[replicate-webhook] rejected: ${verdict.reason}`);
    return new Response('Unauthorized', { status: verdict.status });
  }

  let body: ReplicateWebhookBody;
  try {
    body = JSON.parse(rawBody) as ReplicateWebhookBody;
  } catch {
    return new Response('Bad request', { status: 400 });
  }

  const { id: predictionId, status, output, error } = body;
  if (!predictionId) return new Response('Missing prediction id', { status: 400 });

  if (status !== 'succeeded' && status !== 'failed' && status !== 'canceled') {
    return NextResponse.json({ ok: true, message: 'Intermediate state, ignoring' });
  }

  const db: DB = createAdminClient();

  const url = new URL(request.url);
  const target = url.searchParams.get('target');
  const postId = url.searchParams.get('post_id');
  if (target === 'post' && postId) {
    return handlePostWebhook(db, postId, status, output, error);
  }

  // ── Idempotency guard: prediction_id must still match current row ───────────
  const { data: recreation, error: fetchError } = await db
    .from('recreation_requests')
    .select('id, brand_id, status, replicate_prediction_id, generation_history')
    .eq('replicate_prediction_id', predictionId)
    .single();

  if (fetchError || !recreation) {
    console.warn(`[replicate-webhook] No recreation found for prediction ${predictionId}`);
    return NextResponse.json({ ok: true, message: 'Recreation not found' });
  }

  // Stale webhook — client already regenerated; newer prediction owns this row
  if (recreation.replicate_prediction_id !== predictionId) {
    console.log(`[replicate-webhook] stale webhook for ${predictionId}, ignoring`);
    return NextResponse.json({ ok: true, message: 'Stale prediction, ignoring' });
  }

  if (recreation.status === 'revisar' || recreation.status === 'completed') {
    return NextResponse.json({ ok: true, message: 'Already processed' });
  }

  if (status === 'succeeded' && output) {
    const images: string[] = Array.isArray(output) ? output : [output];

    // URL allowlist — only accept Replicate delivery domains
    const rejected = images.filter(u => !isAllowedReplicateImageUrl(u));
    if (rejected.length > 0) {
      console.warn(`[replicate-webhook] rejected ${rejected.length} untrusted URLs`, rejected);
      return new Response('Untrusted image URL', { status: 400 });
    }

    // TODO(moderation): run images through NSFW moderation API before marking
    // 'revisar'. For now we trust Replicate's output + prompt-side guardrails.

    const history = Array.isArray(recreation.generation_history) ? recreation.generation_history : [];
    const nextVersion = history.length + 1;
    const newEntry = {
      prediction_id: predictionId,
      images,
      generated_at: new Date().toISOString(),
      version:      nextVersion,
    };

    // CAS update — only succeeds if status is still 'preparacion'. Prevents
    // a race with /api/cron/reconcile-predictions (which may have already
    // moved the row to 'revisar' after querying Replicate directly). The
    // loser of the race gets affected=0 and we skip the notification.
    const { data: affected, error: updateError } = await db
      .from('recreation_requests')
      .update({
        status:             'revisar',
        replicate_status:   'succeeded',
        generated_images:   images,
        generation_history: [...history, newEntry],
      })
      .eq('id', recreation.id)
      .eq('status', 'preparacion')
      .select('id');

    if (updateError) {
      console.error(`[replicate-webhook] Failed to update recreation ${recreation.id}:`, updateError);
      return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });
    }

    if (!affected || affected.length === 0) {
      console.log(`[replicate-webhook] race lost for ${recreation.id} — already moved off preparacion`);
      return NextResponse.json({ ok: true, message: 'Already processed by reconcile' });
    }

    console.log(`[replicate-webhook] ✅ Recreation ${recreation.id} → revisar (v${nextVersion}, ${images.length} images)`);

    await db.from('notifications').insert({
      brand_id: recreation.brand_id,
      type:     'recreation_ready',
      message:  'Tu recreación de contenido está lista para revisar',
      read:     false,
      metadata: { recreation_id: recreation.id, version: nextVersion },
    }).then(() => null);

  } else {
    await db
      .from('recreation_requests')
      .update({
        status:                  'pending',
        replicate_status:        status,
        replicate_prediction_id: null,
      })
      .eq('id', recreation.id);

    console.warn(`[replicate-webhook] Prediction ${predictionId} ${status}: ${error ?? 'unknown'}`);
  }

  return NextResponse.json({ ok: true });
}

// ─── Post image handler ────────────────────────────────────────────────────────

async function handlePostWebhook(
  db: DB,
  postId: string,
  status: string,
  output: string | string[] | null | undefined,
  error: string | null | undefined,
): Promise<Response> {
  const { data: post } = await db.from('posts').select('id, brand_id, ai_explanation').eq('id', postId).single();
  if (!post) return NextResponse.json({ ok: true, message: 'Post not found' });

  if (status === 'succeeded' && output) {
    const images: string[] = Array.isArray(output) ? output : [output];
    const rejected = images.filter(u => !isAllowedReplicateImageUrl(u));
    if (rejected.length > 0) {
      console.warn(`[replicate-webhook/post] rejected untrusted URLs`, rejected);
      return new Response('Untrusted image URL', { status: 400 });
    }
    const generatedUrl = images[0];

    await db.from('posts').update({
      edited_image_url: generatedUrl,
      status:           'pending',
    }).eq('id', postId);

    await db.from('notifications').insert({
      brand_id: post.brand_id,
      type:     'approval_needed',
      message:  'Tu imagen ya está lista. ¡Échale un vistazo!',
      read:     false,
      metadata: { post_id: postId },
    }).then(() => null);

    console.log(`[replicate-webhook] ✅ Post ${postId} image generated → ${generatedUrl}`);
  } else {
    console.warn(`[replicate-webhook] Post ${postId} prediction ${status}: ${error ?? 'unknown'}`);
  }

  return NextResponse.json({ ok: true });
}
