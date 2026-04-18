// POST /api/inspiracion/recrear/[id]/regenerate
// Client triggers a new Replicate prediction for an existing recreation request.
// Resets status to 'preparacion' and kicks off a new generation.

import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-utils';
import { requireServerUser, createAdminClient } from '@/lib/supabase';
import { startReplicatePrediction } from '@/lib/replicate';
import { checkRegenerationLimit, incrementRegenerationCount } from '@/lib/plan-limits';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireServerUser();
    const { id } = await params;
    const db: DB = createAdminClient();

    // Verify ownership via brand
    const { data: brand } = await db
      .from('brands')
      .select('id')
      .eq('user_id', user.id)
      .single();
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    const { data: recreation, error: fetchError } = await db
      .from('recreation_requests')
      .select('*, inspiration_references(title, notes, style_tags, format, thumbnail_url)')
      .eq('id', id)
      .eq('brand_id', brand.id)
      .single();

    if (fetchError || !recreation) {
      return NextResponse.json({ error: 'Recreation not found' }, { status: 404 });
    }

    // Enforce per-plan regeneration quota (check only — do NOT increment yet)
    const quota = await checkRegenerationLimit(brand.id, id);
    if (!quota.allowed) {
      return NextResponse.json(
        { error: quota.reason, used: quota.used, limit: quota.limit, upgradeUrl: quota.upgradeUrl },
        { status: 429 },
      );
    }

    // Reset to preparacion before calling Replicate. If Replicate rejects we
    // roll back to 'pending' below — the row is in a safe transient state.
    await db
      .from('recreation_requests')
      .update({
        status: 'preparacion',
        generated_images: [],
        replicate_prediction_id: null,
        replicate_status: null,
      })
      .eq('id', id);

    // Rebuild prompt
    const ref = recreation.inspiration_references;
    const styles = recreation.style_to_adapt ?? [];
    const styleInfo = styles.length > 0 ? `, style: ${styles.join(', ')}` : '';
    const baseNotes = (recreation.client_notes ?? '').replace(/\[FOTOS_REFERENCIA\][\s\S]*/g, '').trim();
    const notesInfo = baseNotes ? `, additional notes: ${baseNotes}` : '';
    const refTitle = ref?.title ? `Recreate content inspired by "${ref.title}"` : 'Recreate social media content';
    const refNotes = ref?.notes ? `, reference context: ${ref.notes}` : '';
    const refFormat = ref?.format ? `, format: ${ref.format}` : '';
    const refTags = ref?.style_tags?.length ? `, visual style: ${ref.style_tags.join(', ')}` : '';

    const replicatePrompt = `${refTitle}${refNotes}${refFormat}${refTags}${styleInfo}${notesInfo}. High quality, Instagram-ready, professional photography or graphic design, vibrant colors, clean composition.`;

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000');
    const webhookUrl = `${baseUrl}/api/webhooks/replicate`;

    // Await Replicate's initial POST (not the full generation — that completes
    // via webhook). This typically resolves in <2s. Only if Replicate accepts
    // do we consume a regeneration slot.
    let prediction;
    try {
      prediction = await startReplicatePrediction({
        prompt:   replicatePrompt,
        imageUrl: ref?.thumbnail_url ?? undefined,
        webhookUrl,
      });
    } catch (err) {
      console.error(`[regenerate] Replicate prediction failed for recreation ${id}:`, err);
      await db
        .from('recreation_requests')
        .update({ status: 'pending', replicate_status: 'failed' })
        .eq('id', id);
      return NextResponse.json(
        { error: 'No se pudo iniciar la generación. Inténtalo de nuevo en unos segundos.' },
        { status: 502 },
      );
    }

    // Replicate accepted the prediction → consume the slot and persist its id.
    await incrementRegenerationCount(id);
    await db
      .from('recreation_requests')
      .update({
        replicate_prediction_id: prediction.id,
        replicate_status:        prediction.status,
      })
      .eq('id', id);

    return NextResponse.json({ ok: true, status: 'preparacion' });
  } catch (err) {
    console.error('[POST /api/inspiracion/recrear/[id]/regenerate]', err);
    return apiError(err, 'inspiracion/recrear/[id]/regenerate');
  }
}
