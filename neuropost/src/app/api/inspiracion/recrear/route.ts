import { NextResponse } from 'next/server';
import { requireServerUser, createAdminClient } from '@/lib/supabase';
import { startReplicatePrediction } from '@/lib/replicate';
import { queueJob } from '@/lib/agents/queue';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

// GET /api/inspiracion/recrear
// Returns all recreation requests for the user's brand, with reference info.
export async function GET() {
  try {
    const user = await requireServerUser();
    const db: DB = createAdminClient();

    const { data: brand } = await db
      .from('brands')
      .select('id')
      .eq('user_id', user.id)
      .single();
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    const { data: recreations, error } = await db
      .from('recreation_requests')
      .select('*, inspiration_references(title, thumbnail_url, source_url)')
      .eq('brand_id', brand.id)
      .order('created_at', { ascending: false });
    if (error) throw error;

    return NextResponse.json({ recreations: recreations ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/inspiracion/recrear
// Creates a recreation request, starts async Replicate image generation (status: preparacion).
export async function POST(request: Request) {
  try {
    const user = await requireServerUser();
    const db: DB = createAdminClient();

    const body = await request.json() as {
      reference_id:    string;
      client_notes?:   string | null;
      style_to_adapt?: string[];
      media_urls?:     string[];
    };

    if (!body.reference_id?.trim()) {
      return NextResponse.json({ error: 'reference_id is required' }, { status: 400 });
    }

    const { data: brand } = await db
      .from('brands')
      .select('id, name')
      .eq('user_id', user.id)
      .single();
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    // Persist client-provided media URLs inside client_notes (no DB migration).
    const mediaUrls = Array.isArray(body.media_urls) ? body.media_urls.filter(Boolean) : [];
    const baseNotes = body.client_notes?.trim() ?? '';
    const composedNotes = mediaUrls.length > 0
      ? `${baseNotes}${baseNotes ? '\n\n' : ''}[FOTOS_REFERENCIA]\n${mediaUrls.join('\n')}`
      : (baseNotes || null);

    // Fetch reference details — including pre-generated recreation_prompt from InspirationAgent
    const { data: reference } = await db
      .from('inspiration_references')
      .select('title, notes, style_tags, format, source_url, thumbnail_url, recreation_prompt')
      .eq('id', body.reference_id.trim())
      .single();

    // Insert recreation request with initial status 'preparacion'
    const { data: recreation, error } = await db
      .from('recreation_requests')
      .insert({
        brand_id:       brand.id,
        reference_id:   body.reference_id.trim(),
        client_notes:   composedNotes,
        style_to_adapt: body.style_to_adapt ?? null,
        status:         'preparacion',
      })
      .select()
      .single();
    if (error) throw error;

    // Use pre-analyzed recreation_prompt from InspirationAgent when available.
    // It's richer (includes composition, lighting, color palette, mood, key elements)
    // than the basic prompt built from tags. Fall back to building from scratch.
    let replicatePrompt: string;
    if ((reference as { recreation_prompt?: string } | null)?.recreation_prompt) {
      const base = (reference as { recreation_prompt: string }).recreation_prompt;
      const styles = body.style_to_adapt ?? [];
      const extra = [
        styles.length > 0 ? `Style adaptations: ${styles.join(', ')}` : '',
        baseNotes ? `Additional notes: ${baseNotes}` : '',
      ].filter(Boolean).join('. ');
      replicatePrompt = extra ? `${base}. ${extra}` : base;
    } else {
      // Fallback: build from reference metadata
      const styles = body.style_to_adapt ?? [];
      const styleInfo = styles.length > 0 ? `, style: ${styles.join(', ')}` : '';
      const notesInfo = baseNotes ? `, additional notes: ${baseNotes}` : '';
      const refTitle = reference?.title ? `Recreate content inspired by "${reference.title}"` : 'Recreate social media content';
      const refNotes = (reference as { notes?: string } | null)?.notes ? `, reference context: ${(reference as { notes: string }).notes}` : '';
      const refFormat = (reference as { format?: string } | null)?.format ? `, format: ${(reference as { format: string }).format}` : '';
      const refTags = (reference as { style_tags?: string[] } | null)?.style_tags?.length
        ? `, visual style: ${(reference as { style_tags: string[] }).style_tags.join(', ')}` : '';
      replicatePrompt = `${refTitle}${refNotes}${refFormat}${refTags}${styleInfo}${notesInfo}. High quality, Instagram-ready, professional photography or graphic design, vibrant colors, clean composition.`;
    }

    // Start async Replicate prediction
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL
      ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    const webhookUrl = `${baseUrl}/api/webhooks/replicate?secret=${process.env.REPLICATE_WEBHOOK_SECRET ?? ''}`;

    // Use reference thumbnail as img2img source if available
    const referenceImageUrl = reference?.thumbnail_url ?? undefined;

    startReplicatePrediction({
      prompt: replicatePrompt,
      imageUrl: referenceImageUrl,
      webhookUrl,
    }).then(async (prediction) => {
      // Save prediction ID so webhook can find this recreation
      await db
        .from('recreation_requests')
        .update({
          replicate_prediction_id: prediction.id,
          replicate_status: prediction.status,
        })
        .eq('id', recreation.id);
    }).catch((err: unknown) => {
      console.error(`[recrear] Replicate prediction failed for recreation ${recreation.id}:`, err);
      // Revert status to pending so client can retry
      db.from('recreation_requests')
        .update({ status: 'pending', replicate_status: 'failed' })
        .eq('id', recreation.id)
        .then(() => null);
    });

    // Queue ideas agent to generate context/suggestions for the worker (fire-and-forget)
    queueJob({
      brand_id:     brand.id,
      agent_type:   'content',
      action:       'generate_ideas',
      input: {
        source:          'recreation_request',
        recreation_id:   recreation.id,
        reference_id:    body.reference_id.trim(),
        client_notes:    baseNotes,
        style_to_adapt:  body.style_to_adapt ?? [],
        title:           reference?.title ?? 'Recreación de referencia',
        description:     baseNotes,
        type:            'custom',
        count:           3,
      },
      priority:     70,
      requested_by: 'client',
    }).catch(() => null);

    // Notify workers (best-effort)
    try {
      await db.from('notifications').insert({
        brand_id: brand.id,
        type:     'recreation_request',
        message:  `${brand.name} quiere recrear un estilo de contenido${mediaUrls.length > 0 ? ` (${mediaUrls.length} foto${mediaUrls.length > 1 ? 's' : ''} adjunta${mediaUrls.length > 1 ? 's' : ''})` : ''}`,
        read:     false,
        metadata: { recreation_id: recreation.id, reference_id: body.reference_id, media_urls: mediaUrls },
      });
    } catch (notifErr) {
      console.warn('[POST /api/inspiracion/recrear] notifications insert failed', notifErr);
    }

    return NextResponse.json({ recreation }, { status: 201 });
  } catch (err: unknown) {
    const isPostgrest = err && typeof err === 'object' && 'code' in err;
    if (isPostgrest) {
      const e = err as { message?: string; details?: string; hint?: string; code?: string };
      console.error('[POST /api/inspiracion/recrear] PostgREST', e);
      return NextResponse.json({ error: e.message, details: e.details, hint: e.hint, code: e.code }, { status: 500 });
    }
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    console.error('[POST /api/inspiracion/recrear]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
