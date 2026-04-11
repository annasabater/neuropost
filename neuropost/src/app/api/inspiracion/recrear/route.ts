import { NextResponse } from 'next/server';
import { requireServerUser, createAdminClient } from '@/lib/supabase';

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
      .select('*, inspiration_references(title, thumbnail_url)')
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
// Creates a recreation request for a reference, notifies workers.
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
    // We embed a structured marker the worker UI can parse.
    const mediaUrls = Array.isArray(body.media_urls) ? body.media_urls.filter(Boolean) : [];
    const baseNotes = body.client_notes?.trim() ?? '';
    const composedNotes = mediaUrls.length > 0
      ? `${baseNotes}${baseNotes ? '\n\n' : ''}[FOTOS_REFERENCIA]\n${mediaUrls.join('\n')}`
      : (baseNotes || null);

    const { data: recreation, error } = await db
      .from('recreation_requests')
      .insert({
        brand_id:       brand.id,
        reference_id:   body.reference_id.trim(),
        client_notes:   composedNotes,
        style_to_adapt: body.style_to_adapt ?? null,
        status:         'pending',
      })
      .select()
      .single();
    if (error) throw error;

    // Notify workers (best-effort — Supabase query builders are thenable but
    // not real Promises, so wrap in try/catch instead of .catch()).
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

    // Optionally increment times_used on linked template if reference type = 'template'
    const { data: reference } = await db
      .from('inspiration_references')
      .select('type, source_url')
      .eq('id', body.reference_id)
      .single();

    if (reference?.type === 'template' && reference?.source_url) {
      try {
        await db.rpc('increment_template_usage', { template_id: reference.source_url });
      } catch (rpcErr) {
        console.warn('[POST /api/inspiracion/recrear] increment_template_usage rpc failed', rpcErr);
      }
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
