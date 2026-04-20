// POST /api/inspiracion/contribuir
// Accepts a URL or a file upload, runs vision analysis synchronously,
// inserts into inspiration_bank, and auto-saves to the brand's "Mis subidas" collection.

import { NextResponse }                       from 'next/server';
import { requireServerUser, createAdminClient } from '@/lib/supabase';
import { analyzeImage, analyzeVideo }           from '@/lib/inspiration/vision';
import { uploadToInspirationBucket }            from '@/lib/inspiration/storage';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export const maxDuration = 120;

function uuidSlug() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}
function today() {
  return new Date().toISOString().slice(0, 10);
}

async function getOrCreateMisSubidasCollection(db: DB, brandId: string): Promise<string> {
  const { data: existing } = await db
    .from('inspiration_collections')
    .select('id')
    .eq('brand_id', brandId)
    .eq('name', 'Mis subidas')
    .maybeSingle();
  if (existing?.id) return existing.id;

  const { data: created } = await db
    .from('inspiration_collections')
    .insert({ brand_id: brandId, name: 'Mis subidas' })
    .select('id')
    .single();
  return created?.id ?? null;
}

export async function POST(request: Request) {
  try {
    const user = await requireServerUser();
    const db: DB = createAdminClient();

    const { data: brand } = await db
      .from('brands')
      .select('id')
      .eq('user_id', user.id)
      .single();
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    const contentType = request.headers.get('content-type') ?? '';
    let buffer: Buffer;
    let mimeType: string;
    let isVideo = false;
    let sourceUrl: string | null = null;

    if (contentType.includes('multipart/form-data')) {
      // ── File upload ──────────────────────────────────────────────────────
      const form = await request.formData();
      const file = form.get('file') as File | null;
      if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
      mimeType = file.type || 'image/jpeg';
      isVideo  = mimeType.startsWith('video/');
      buffer   = Buffer.from(await file.arrayBuffer());
    } else {
      // ── URL ──────────────────────────────────────────────────────────────
      const body = await request.json() as { url?: string };
      if (!body.url?.trim()) return NextResponse.json({ error: 'No URL provided' }, { status: 400 });
      sourceUrl = body.url.trim();
      const res = await fetch(sourceUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!res.ok) return NextResponse.json({ error: `Could not fetch URL (${res.status})` }, { status: 400 });
      mimeType = res.headers.get('content-type')?.split(';')[0] ?? 'image/jpeg';
      isVideo  = mimeType.startsWith('video/');
      buffer   = Buffer.from(await res.arrayBuffer());
    }

    // ── Upload to storage ────────────────────────────────────────────────
    const ext         = mimeType.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg';
    const storagePath = `web/${brand.id}/${today()}/${uuidSlug()}.${ext}`;
    const publicUrl   = await uploadToInspirationBucket(buffer, storagePath, mimeType);

    // ── Vision analysis ──────────────────────────────────────────────────
    let analysis: Awaited<ReturnType<typeof analyzeImage>>;
    if (isVideo) {
      // For video we only have one buffer — treat it as a single frame image for now
      analysis = await analyzeImage(buffer, 'image/jpeg');
    } else {
      analysis = await analyzeImage(buffer, mimeType);
    }

    // ── Insert into inspiration_bank ──────────────────────────────────────
    const { data: item, error: insertError } = await db
      .from('inspiration_bank')
      .insert({
        media_type:      isVideo ? 'video' : 'image',
        media_urls:      [publicUrl],
        thumbnail_url:   publicUrl,
        hidden_prompt:   analysis.hidden_prompt,
        category:        analysis.category,
        tags:            analysis.tags,
        dominant_colors: analysis.dominant_colors,
        mood:            analysis.mood,
        source_platform: 'web_upload',
        source_url:      sourceUrl,
      })
      .select('id')
      .single();

    if (insertError || !item) {
      throw new Error(insertError?.message ?? 'Insert failed');
    }

    // ── Auto-save to "Mis subidas" collection ─────────────────────────────
    const collectionId = await getOrCreateMisSubidasCollection(db, brand.id);
    await db.from('inspiration_saved').insert({
      brand_id:      brand.id,
      source:        'bank',
      item_id:       item.id,
      collection_id: collectionId ?? null,
    });

    return NextResponse.json({
      success:  true,
      item_id:  item.id,
      category: analysis.category,
      tags:     analysis.tags,
      mood:     analysis.mood,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[inspiracion/contribuir]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
