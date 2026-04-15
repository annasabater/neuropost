import { NextResponse } from 'next/server';
import { requireServerUser, createServerClient, createAdminClient } from '@/lib/supabase';
import type { ContentCategory } from '@/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

/** GET — return content_categories for the authenticated user's brand */
export async function GET() {
  try {
    const user     = await requireServerUser();
    const supabase = await createServerClient() as DB;

    const { data: brand } = await supabase
      .from('brands').select('id').eq('user_id', user.id).single();
    if (!brand) return NextResponse.json({ categories: [] });

    const { data, error } = await supabase
      .from('content_categories')
      .select('*')
      .eq('brand_id', brand.id)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return NextResponse.json({ categories: (data ?? []) as ContentCategory[] });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** PUT — replace all content_categories for the user's brand */
export async function PUT(request: Request) {
  try {
    const user = await requireServerUser();
    const body = await request.json() as { categories: Omit<ContentCategory, 'id' | 'brand_id' | 'created_at'>[] };

    if (!Array.isArray(body.categories)) {
      return NextResponse.json({ error: 'categories must be an array' }, { status: 400 });
    }

    // Use admin client so we can bypass RLS for the upsert
    const supabase = createAdminClient() as DB;

    const { data: brand } = await supabase
      .from('brands').select('id').eq('user_id', user.id).single();
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    const rows = body.categories.map((c) => ({
      brand_id:     brand.id,
      category_key: c.category_key,
      name:         c.name,
      source:       c.source ?? 'user',
      active:       c.active ?? true,
    }));

    // Delete existing and re-insert — simpler than per-row upsert
    await supabase.from('content_categories').delete().eq('brand_id', brand.id);

    if (rows.length > 0) {
      const { error } = await supabase.from('content_categories').insert(rows);
      if (error) throw error;
    }

    const { data } = await supabase
      .from('content_categories')
      .select('*')
      .eq('brand_id', brand.id)
      .order('created_at', { ascending: true });

    return NextResponse.json({ categories: (data ?? []) as ContentCategory[] });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
