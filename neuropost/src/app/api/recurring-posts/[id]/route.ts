// =============================================================================
// GET/PATCH/DELETE /api/recurring-posts/[id]
// =============================================================================

import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-utils';
import { requireServerUser, createAdminClient } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireServerUser();
    const db = createAdminClient() as DB;
    const { id } = await params;

    const { data: brand } = await db.from('brands').select('id').eq('user_id', user.id).single();
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    const { data, error } = await db
      .from('recurring_posts')
      .select('*')
      .eq('id', id)
      .eq('brand_id', brand.id)
      .single();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({ recurring_post: data });
  } catch (err) {
    return apiError(err, 'GET /api/recurring-posts/[id]');
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireServerUser();
    const db = createAdminClient() as DB;
    const { id } = await params;
    const body = await request.json();

    const { data: brand } = await db.from('brands').select('id').eq('user_id', user.id).single();
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    // Whitelist allowed fields
    const allowed: Record<string, unknown> = {};
    const fields = [
      'title', 'caption_template', 'hashtags', 'category_key', 'format',
      'image_prompt', 'fixed_image_url', 'frequency', 'day_of_week',
      'day_of_month', 'preferred_hour', 'active', 'auto_publish',
      'generate_image', 'generate_caption',
    ];
    for (const f of fields) {
      if (f in body) allowed[f] = body[f];
    }
    allowed.updated_at = new Date().toISOString();

    const { data, error } = await db
      .from('recurring_posts')
      .update(allowed)
      .eq('id', id)
      .eq('brand_id', brand.id)
      .select()
      .single();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({ recurring_post: data });
  } catch (err) {
    return apiError(err, 'PATCH /api/recurring-posts/[id]');
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireServerUser();
    const db = createAdminClient() as DB;
    const { id } = await params;

    const { data: brand } = await db.from('brands').select('id').eq('user_id', user.id).single();
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    const { error } = await db
      .from('recurring_posts')
      .delete()
      .eq('id', id)
      .eq('brand_id', brand.id);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err, 'DELETE /api/recurring-posts/[id]');
  }
}
