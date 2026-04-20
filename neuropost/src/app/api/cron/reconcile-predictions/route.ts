// =============================================================================
// Cron: reconcile Replicate predictions stuck in 'preparacion'
// Scheduled every 10 min by vercel.json.
//
// For every recreation_request with status='preparacion' and created_at older
// than 30 min, ask Replicate for the real prediction state:
//   succeeded  → apply same update the webhook would have done
//   failed/cx  → mark row 'failed' + notify client
//   still running and >30 min since created_at → mark 'failed' (timeout)
//
// Manual invocation:
//   curl -H "Authorization: Bearer $CRON_SECRET" \
//        https://.../api/cron/reconcile-predictions
// =============================================================================

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { isAllowedReplicateImageUrl } from '@/lib/replicate-webhook-verify';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const STUCK_THRESHOLD_MS = 30 * 60 * 1000;

interface ReplicatePredictionStatus {
  id:     string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  output?: string | string[] | null;
  error?:  string | null;
}

async function fetchPrediction(predictionId: string): Promise<ReplicatePredictionStatus | null> {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) throw new Error('REPLICATE_API_TOKEN not configured');
  const res = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    console.warn(`[reconcile] Replicate GET ${predictionId} failed: ${res.status}`);
    return null;
  }
  return res.json() as Promise<ReplicatePredictionStatus>;
}

export async function GET(request: Request) {
  const auth     = request.headers.get('authorization');
  const isVercel = request.headers.get('x-vercel-cron') === '1';
  const secret   = process.env.CRON_SECRET ?? '';
  if (!isVercel && (!secret || auth !== `Bearer ${secret}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db: DB = createAdminClient();
  const cutoff = new Date(Date.now() - STUCK_THRESHOLD_MS).toISOString();

  const { data: stuck, error } = await db
    .from('recreation_requests')
    .select('id, brand_id, replicate_prediction_id, generation_history, created_at')
    .eq('status', 'preparacion')
    .lt('created_at', cutoff);

  if (error) {
    console.error('[reconcile] query failed', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const results = { checked: 0, succeeded: 0, failed: 0, skipped: 0 };

  for (const row of stuck ?? []) {
    results.checked += 1;
    const predictionId: string | null = row.replicate_prediction_id;

    // No prediction_id ever recorded → Replicate call never went through.
    if (!predictionId) {
      await markFailed(db, row.id, row.brand_id, 'No prediction recorded');
      results.failed += 1;
      continue;
    }

    const pred = await fetchPrediction(predictionId);
    if (!pred) {
      // Couldn't reach Replicate — don't change state, try again next run
      results.skipped += 1;
      continue;
    }

    if (pred.status === 'succeeded' && pred.output) {
      const images = Array.isArray(pred.output) ? pred.output : [pred.output];
      const valid  = images.filter(isAllowedReplicateImageUrl);
      if (valid.length === 0) {
        await markFailed(db, row.id, row.brand_id, 'Replicate returned untrusted URLs');
        results.failed += 1;
        continue;
      }

      const history = Array.isArray(row.generation_history) ? row.generation_history : [];
      const nextVersion = history.length + 1;
      // CAS update — same invariant as the webhook: only write if the row
      // is still 'preparacion'. Prevents a double-notification if the
      // webhook lands between our Replicate query and our UPDATE.
      const { data: affected } = await db.from('recreation_requests').update({
        status:             'revisar',
        replicate_status:   'succeeded',
        generated_images:   valid,
        generation_history: [
          ...history,
          { prediction_id: predictionId, images: valid, generated_at: new Date().toISOString(), version: nextVersion },
        ],
      })
        .eq('id', row.id)
        .eq('status', 'preparacion')
        .select('id');

      if (!affected || affected.length === 0) {
        results.skipped += 1;
        console.log(`[reconcile] race lost for ${row.id} — webhook already processed it`);
        continue;
      }

      await db.from('notifications').insert({
        brand_id: row.brand_id,
        type:     'recreation_ready',
        message:  'Tu recreación de contenido está lista para revisar',
        read:     false,
        metadata: { recreation_id: row.id, version: nextVersion, source: 'reconcile' },
      }).then(() => null);

      results.succeeded += 1;
      console.log(`[reconcile] ✅ recovered ${row.id} (v${nextVersion})`);
      continue;
    }

    if (pred.status === 'failed' || pred.status === 'canceled') {
      await markFailed(db, row.id, row.brand_id, `Replicate reported ${pred.status}: ${pred.error ?? ''}`);
      results.failed += 1;
      continue;
    }

    // Still running after 30 minutes — treat as timeout
    await markFailed(db, row.id, row.brand_id, 'Timeout waiting for Replicate');
    results.failed += 1;
  }

  return NextResponse.json({ ok: true, ...results });
}

async function markFailed(db: DB, recreationId: string, brandId: string, reason: string): Promise<void> {
  await db.from('recreation_requests').update({
    status:           'failed',
    replicate_status: 'failed',
  }).eq('id', recreationId);

  await db.from('notifications').insert({
    brand_id: brandId,
    type:     'recreation_failed',
    message:  'Tu recreación de contenido no se pudo completar. Inténtalo de nuevo o contacta con soporte.',
    read:     false,
    metadata: { recreation_id: recreationId, reason },
  }).then(() => null);

  console.warn(`[reconcile] ✗ failed ${recreationId}: ${reason}`);
}
