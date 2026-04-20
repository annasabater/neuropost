import { NextRequest, NextResponse } from 'next/server';
import { requireServerUser, createServerClient } from '@/lib/supabase';

// GET /api/posts/:id/assets — list all generated versions for a post
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireServerUser();

    const supabase = await createServerClient();
    const { data: brand } = await supabase.from('brands').select('id').eq('user_id', user.id).single();
    if (!brand) return NextResponse.json({ error: 'No brand' }, { status: 404 });

    // Verify post belongs to brand
    const { data: post } = await supabase.from('posts').select('id').eq('id', id).eq('brand_id', brand.id).single();
    if (!post) return NextResponse.json({ assets: [] });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: assets, error } = await (supabase as any)
      .from('generated_assets')
      .select('*')
      .eq('post_id', id)
      .order('version', { ascending: false });

    // Some environments may not have generated_assets migrated yet.
    if (error?.code === '42P01') return NextResponse.json({ assets: [] });
    if (error) return NextResponse.json({ assets: [] });
    return NextResponse.json({ assets: assets ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ assets: [] });
  }
}

// POST /api/posts/:id/assets — create a new generated asset version
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireServerUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = await createServerClient();
  const { data: brand } = await supabase.from('brands').select('id').eq('user_id', user.id).single();
  if (!brand) return NextResponse.json({ error: 'No brand' }, { status: 404 });

  const { data: post } = await supabase.from('posts').select('id, brand_id').eq('id', id).eq('brand_id', brand.id).single();
  if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });

  const body = await req.json();
  const { asset_url, asset_type, storage_path, prompt, inspiration_id, model, parameters, quality_score, ai_analysis } = body;

  if (!asset_url) return NextResponse.json({ error: 'asset_url required' }, { status: 400 });

  // Get next version number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: latest } = await (supabase as any)
    .from('generated_assets')
    .select('version')
    .eq('post_id', id)
    .order('version', { ascending: false })
    .limit(1);

  const nextVersion = (latest?.[0]?.version ?? 0) + 1;

  // Mark all previous versions as not current
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from('generated_assets')
    .update({ is_current: false })
    .eq('post_id', id);

  // Insert new asset
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: asset, error } = await (supabase as any)
    .from('generated_assets')
    .insert({
      brand_id: brand.id,
      post_id: id,
      version: nextVersion,
      asset_url,
      asset_type: asset_type ?? 'image',
      storage_path: storage_path ?? null,
      prompt: prompt ?? null,
      inspiration_id: inspiration_id ?? null,
      model: model ?? null,
      parameters: parameters ?? {},
      quality_score: quality_score ?? null,
      ai_analysis: ai_analysis ?? null,
      status: 'generated',
      is_current: true,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Update post image_url to latest asset
  await supabase.from('posts').update({ image_url: asset_url }).eq('id', id);

  return NextResponse.json({ asset }, { status: 201 });
}

// PATCH /api/posts/:id/assets — approve/reject/switch current version
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireServerUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = await createServerClient();
  const { data: brand } = await supabase.from('brands').select('id').eq('user_id', user.id).single();
  if (!brand) return NextResponse.json({ error: 'No brand' }, { status: 404 });

  const body = await req.json();
  const { asset_id, action, rejection_reason } = body;

  if (!asset_id || !action) return NextResponse.json({ error: 'asset_id and action required' }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  if (action === 'approve') {
    // Approve this version and set as current
    await sb.from('generated_assets').update({ is_current: false }).eq('post_id', id);
    const { data: asset, error } = await sb
      .from('generated_assets')
      .update({ status: 'approved', is_current: true, approved_at: new Date().toISOString(), approved_by: user.id })
      .eq('id', asset_id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Update post image to approved version
    await supabase.from('posts').update({ image_url: asset.asset_url }).eq('id', id);
    return NextResponse.json({ asset });
  }

  if (action === 'reject') {
    const { data: asset, error } = await sb
      .from('generated_assets')
      .update({ status: 'rejected', is_current: false, rejection_reason: rejection_reason ?? null })
      .eq('id', asset_id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ asset });
  }

  if (action === 'set_current') {
    // Switch which version is shown
    await sb.from('generated_assets').update({ is_current: false }).eq('post_id', id);
    const { data: asset, error } = await sb
      .from('generated_assets')
      .update({ is_current: true })
      .eq('id', asset_id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await supabase.from('posts').update({ image_url: asset.asset_url }).eq('id', id);
    return NextResponse.json({ asset });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
