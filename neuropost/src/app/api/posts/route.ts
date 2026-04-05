import { NextResponse } from 'next/server';
import { requireServerUser, createServerClient } from '@/lib/supabase';
import { checkPostLimit } from '@/lib/plan-limits';
import { requirePermission } from '@/lib/rbac';
import type { Post, Brand } from '@/types';
import { PLAN_LIMITS } from '@/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export async function GET(request: Request) {
  try {
    const user     = await requireServerUser();
    const supabase = await createServerClient() as DB;
    const { searchParams } = new URL(request.url);
    const limit  = Number(searchParams.get('limit') ?? 20);
    const status = searchParams.get('status');

    const { data: brand } = await supabase.from('brands').select('id').eq('user_id', user.id).single();
    if (!brand) return NextResponse.json({ posts: [] });

    let query = supabase
      .from('posts')
      .select('*')
      .eq('brand_id', brand.id)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ posts: (data as Post[]) ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user     = await requireServerUser();
    const body     = await request.json() as Record<string, unknown>;
    const supabase = await createServerClient() as DB;

    const { data: brandRow } = await supabase.from('brands').select('*').eq('user_id', user.id).single();
    if (!brandRow) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });
    const brand = brandRow as Brand;

    const permErr = await requirePermission(user.id, brand.id, 'create_post');
    if (permErr) return permErr;

    // Enforce plan limits
    const limit = await checkPostLimit(brand.id);
    if (!limit.allowed) {
      return NextResponse.json({ error: limit.reason, upgradeUrl: limit.upgradeUrl }, { status: 403 });
    }

    // Whitelist allowed fields — block privileged ones
    const {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      brand_id: _brand_id,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      approved_by: _approved_by,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      ig_post_id: _ig_post_id,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      fb_post_id: _fb_post_id,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      published_at: _published_at,
      ...allowedFields
    } = body;

    // ── Auto-publish mode: override status based on brand's publish_mode ─────
    const planLimits = PLAN_LIMITS[brand.plan];
    const canAutoPublish = planLimits.autoPublish && brand.publish_mode === 'auto';
    const effectiveStatus = canAutoPublish ? 'approved' : (allowedFields.status ?? 'pending');

    const { data, error } = await supabase
      .from('posts')
      .insert({ ...allowedFields, brand_id: brand.id, created_by: user.id, status: effectiveStatus })
      .select()
      .single();
    if (error) throw error;

    const insertedPost = data as Post;

    // Auto-publish: call shared publisher directly (avoids HTTP auth issues)
    if (canAutoPublish && insertedPost.image_url) {
      try {
        const { publishPostById } = await import('@/lib/publishPost');
        await publishPostById(insertedPost.id, user.id);
      } catch { /* non-blocking — post is already approved in DB */ }
    }

    // Notification
    if (canAutoPublish) {
      await supabase.from('notifications').insert({
        brand_id: brand.id,
        type:     'published',
        message:  'Post creado y publicado automáticamente.',
        read:     false,
        metadata: { postId: insertedPost.id },
      });
    } else if (insertedPost.status === 'pending') {
      await supabase.from('notifications').insert({
        brand_id: brand.id,
        type:     'approval_needed',
        message:  'Un nuevo post requiere tu aprobación.',
        read:     false,
        metadata: { postId: insertedPost.id },
      });
    }

    return NextResponse.json({ post: insertedPost }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
