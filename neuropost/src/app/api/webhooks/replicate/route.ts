// =============================================================================
// Webhook: Replicate async prediction results
// POST /api/webhooks/replicate?secret=REPLICATE_WEBHOOK_SECRET
//
// Replicate calls this endpoint when a prediction finishes.
// We find the recreation_request by prediction_id, save the generated images,
// and move the status to 'revisar' so the client can review them.
// =============================================================================

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

interface ReplicateWebhookBody {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  output?: string | string[] | null;
  error?: string | null;
}

export async function POST(request: Request) {
  // Validate webhook secret
  const url = new URL(request.url);
  const secret = url.searchParams.get('secret');
  if (!secret || secret !== process.env.REPLICATE_WEBHOOK_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }

  let body: ReplicateWebhookBody;
  try {
    body = await request.json() as ReplicateWebhookBody;
  } catch {
    return new Response('Bad request', { status: 400 });
  }

  const { id: predictionId, status, output, error } = body;

  if (!predictionId) {
    return new Response('Missing prediction id', { status: 400 });
  }

  // Only handle terminal states
  if (status !== 'succeeded' && status !== 'failed' && status !== 'canceled') {
    return NextResponse.json({ ok: true, message: 'Intermediate state, ignoring' });
  }

  const db: DB = createAdminClient();

  // ── Route to post handler if target=post ──────────────────────────────────
  const target = url.searchParams.get('target');
  const postId = url.searchParams.get('post_id');
  if (target === 'post' && postId) {
    return handlePostWebhook(db, postId, status, output, error);
  }

  // Find the recreation request for this prediction
  const { data: recreation, error: fetchError } = await db
    .from('recreation_requests')
    .select('id, brand_id, status')
    .eq('replicate_prediction_id', predictionId)
    .single();

  if (fetchError || !recreation) {
    console.warn(`[replicate-webhook] No recreation found for prediction ${predictionId}`);
    // Still return 200 so Replicate doesn't retry
    return NextResponse.json({ ok: true, message: 'Recreation not found' });
  }

  // Skip if already processed (idempotency)
  if (recreation.status === 'revisar' || recreation.status === 'completed') {
    return NextResponse.json({ ok: true, message: 'Already processed' });
  }

  if (status === 'succeeded' && output) {
    // Normalise output to array of image URLs
    const images: string[] = Array.isArray(output) ? output : [output];

    const { error: updateError } = await db
      .from('recreation_requests')
      .update({
        status: 'revisar',
        replicate_status: 'succeeded',
        generated_images: images,
      })
      .eq('id', recreation.id);

    if (updateError) {
      console.error(`[replicate-webhook] Failed to update recreation ${recreation.id}:`, updateError);
      return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });
    }

    console.log(`[replicate-webhook] ✅ Recreation ${recreation.id} → revisar (${images.length} images)`);

    // Notify the client
    await db.from('notifications').insert({
      brand_id: recreation.brand_id,
      type: 'recreation_ready',
      message: 'Tu recreación de contenido está lista para revisar 🎨',
      read: false,
      metadata: { recreation_id: recreation.id },
    }).then(() => null);

  } else {
    // Failed or canceled — revert to pending so the client can retry
    await db
      .from('recreation_requests')
      .update({
        status: 'pending',
        replicate_status: status,
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
    const generatedUrl = images[0];

    await db.from('posts').update({
      edited_image_url: generatedUrl,
      status: 'pending',
    }).eq('id', postId);

    // Notify client
    await db.from('notifications').insert({
      brand_id: post.brand_id,
      type: 'approval_needed',
      message: 'Tu imagen ya está lista. ¡Échale un vistazo! 🎨',
      read: false,
      metadata: { post_id: postId },
    }).then(() => null);

    console.log(`[replicate-webhook] ✅ Post ${postId} image generated → ${generatedUrl}`);
  } else {
    console.warn(`[replicate-webhook] Post ${postId} prediction ${status}: ${error ?? 'unknown'}`);
  }

  return NextResponse.json({ ok: true });
}
