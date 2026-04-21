import { NextResponse }                          from 'next/server';
import { requireServerUser, createAdminClient }  from '@/lib/supabase';
import { apiError }                              from '@/lib/api-utils';
import type { BrandMaterialCategory }            from '@/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

/** GET /api/client/brand-material?category=X */
export async function GET(req: Request) {
  try {
    const user     = await requireServerUser();
    const db       = createAdminClient() as DB;
    const url      = new URL(req.url);
    const category = url.searchParams.get('category') as BrandMaterialCategory | null;

    const { data: brand } = await db
      .from('brands').select('id').eq('user_id', user.id).single();
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    let query = db
      .from('brand_material')
      .select('*')
      .eq('brand_id', brand.id)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (category) query = query.eq('category', category);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ items: data ?? [] });
  } catch (err) {
    return apiError(err, 'GET /api/client/brand-material');
  }
}

/** POST /api/client/brand-material */
export async function POST(req: Request) {
  try {
    const user = await requireServerUser();
    const db   = createAdminClient() as DB;
    const body = await req.json() as {
      category:      BrandMaterialCategory;
      content:       Record<string, unknown>;
      valid_until?:  string | null;
      display_order?: number;
    };

    const { category, content, valid_until, display_order } = body;
    if (!category || !content) {
      return NextResponse.json({ error: 'category y content son obligatorios' }, { status: 400 });
    }

    const { data: brand } = await db
      .from('brands').select('id').eq('user_id', user.id).single();
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    const { data: created, error } = await db
      .from('brand_material')
      .insert({
        brand_id:      brand.id,
        category,
        content,
        valid_until:   valid_until ?? null,
        display_order: display_order ?? 0,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ item: created }, { status: 201 });
  } catch (err) {
    return apiError(err, 'POST /api/client/brand-material');
  }
}
