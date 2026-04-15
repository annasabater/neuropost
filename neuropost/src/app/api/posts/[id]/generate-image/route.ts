// =============================================================================
// POST /api/posts/[id]/generate-image
// Worker triggers Replicate image generation for a pending post.
// Prompt = Brand Kit + optional inspiration reference + client description.
// =============================================================================

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { startReplicatePrediction } from '@/lib/replicate';
import { requireWorker } from '@/lib/worker';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireWorker();
    const { id: postId } = await params;
    const db = createAdminClient() as DB;

    // ── 1. Load post ─────────────────────────────────────────────────────────
    const { data: post, error: postErr } = await db
      .from('posts')
      .select('*')
      .eq('id', postId)
      .single();
    if (postErr || !post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });

    // ── 2. Load brand kit ─────────────────────────────────────────────────────
    const { data: brand } = await db
      .from('brands')
      .select('name, sector, tone, visual_style, brand_voice_doc, slogans')
      .eq('id', post.brand_id)
      .single();

    // ── 3. Optional inspiration reference ────────────────────────────────────
    let inspirationPrompt = '';
    const body = await request.json().catch(() => ({})) as { inspiration_id?: string };
    if (body.inspiration_id) {
      const { data: ref } = await db
        .from('inspiration_references')
        .select('title, notes, style_tags, format')
        .eq('id', body.inspiration_id)
        .single();
      if (ref) {
        inspirationPrompt = `Inspired by: "${ref.title}"`;
        if (ref.notes)        inspirationPrompt += `, ${ref.notes}`;
        if (ref.style_tags?.length) inspirationPrompt += `, style: ${ref.style_tags.join(', ')}`;
        if (ref.format)       inspirationPrompt += `, format: ${ref.format}`;
      }
    }

    // ── 4. Build prompt ───────────────────────────────────────────────────────
    const brandContext = brand
      ? `Business: ${brand.name}, sector: ${brand.sector}, visual style: ${brand.visual_style}, tone: ${brand.tone}.`
      : '';

    // ai_explanation stores client description (set at post creation)
    const clientDesc = post.ai_explanation
      ? String(post.ai_explanation).replace(/^{.*?}$/, '').trim()
      : '';
    // Try to parse JSON ai_explanation (self-service mode stores it as JSON)
    let parsedDesc = clientDesc;
    try {
      const parsed = JSON.parse(post.ai_explanation ?? '{}') as Record<string, string>;
      if (parsed.client_notes) parsedDesc = parsed.client_notes;
      else if (parsed.caption) parsedDesc = parsed.caption;
    } catch { /* plain string, use as-is */ }

    const parts = [
      brandContext,
      inspirationPrompt,
      parsedDesc,
      'High quality, Instagram-ready, professional photography or graphic design, vibrant colors, clean composition.',
    ].filter(Boolean);

    const prompt = parts.join(' ');

    // ── 5. Fire Replicate prediction ──────────────────────────────────────────
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL
      ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    const webhookUrl = `${baseUrl}/api/webhooks/replicate?secret=${process.env.REPLICATE_WEBHOOK_SECRET ?? ''}&target=post&post_id=${postId}`;

    // Mark post as processing
    await db.from('posts').update({ status: 'pending', ai_explanation: post.ai_explanation }).eq('id', postId);

    const prediction = await startReplicatePrediction({
      prompt,
      imageUrl: post.image_url ?? undefined,
      webhookUrl,
    });

    // Save prediction ID on the post for tracking
    await db.from('posts').update({
      status: 'pending',
      ai_explanation: JSON.stringify({
        ...((() => { try { return JSON.parse(post.ai_explanation ?? '{}'); } catch { return { original: post.ai_explanation }; } })()),
        replicate_prediction_id: prediction.id,
        replicate_status: prediction.status,
      }),
    }).eq('id', postId);

    return NextResponse.json({ ok: true, prediction_id: prediction.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    console.error('[generate-image]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
