import { NextResponse } from 'next/server';
import { requireServerUser, createAdminClient } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

// GET /api/inspiracion/referencias
// Returns all saved references for the user's brand, with their recreation_request if any.
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

    const { data: references, error: refError } = await db
      .from('inspiration_references')
      .select('*')
      .eq('brand_id', brand.id)
      .eq('is_saved', true)
      .order('created_at', { ascending: false });
    if (refError) throw refError;

    const { data: recreations } = await db
      .from('recreation_requests')
      .select('*')
      .eq('brand_id', brand.id);

    const recreationMap = new Map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (recreations ?? []).map((r: any) => [r.reference_id, r]),
    );

    const referencesWithRecreation = (references ?? []).map((ref: any) => ({
      ...ref,
      recreation: recreationMap.get(ref.id) ?? null,
    }));

    return NextResponse.json({ references: referencesWithRecreation });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/inspiracion/referencias
// Creates a new inspiration reference for the user's brand.
export async function POST(request: Request) {
  try {
    const user = await requireServerUser();
    const db: DB = createAdminClient();

    const body = await request.json() as {
      type:           string;
      source_url?:    string;
      thumbnail_url?: string;
      title:          string;
      notes?:         string;
      sector?:        string;
      style_tags?:    string[];
      format?:        string;
    };

    if (!body.type?.trim()) {
      return NextResponse.json({ error: 'type is required' }, { status: 400 });
    }

    const { data: brand } = await db
      .from('brands')
      .select('id')
      .eq('user_id', user.id)
      .single();
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    const { data: reference, error } = await db
      .from('inspiration_references')
      .insert({
        brand_id:      brand.id,
        type:          body.type.trim(),
        source_url:    body.source_url    ?? null,
        thumbnail_url: body.thumbnail_url ?? null,
        title:         body.title         ?? null,
        notes:         body.notes         ?? null,
        sector:        body.sector        ?? null,
        style_tags:    body.style_tags    ?? null,
        format:        body.format        ?? null,
        is_saved:      true,
      })
      .select()
      .single();
    if (error) throw error;

    return NextResponse.json({ reference }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
