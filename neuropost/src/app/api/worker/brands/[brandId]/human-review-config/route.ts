import { NextResponse }                               from 'next/server';
import { createAdminClient }                          from '@/lib/supabase';
import { requireWorkerForBrand, workerErrorResponse } from '@/lib/worker';
import type { HumanReviewConfig }                     from '@/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

const ALLOWED_KEYS = ['messages', 'images', 'videos'] as const;

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ brandId: string }> },
) {
  try {
    const { brandId } = await params;
    await requireWorkerForBrand(brandId);

    const body = await req.json() as Partial<HumanReviewConfig>;

    const patch: Partial<HumanReviewConfig> = {};
    for (const key of ALLOWED_KEYS) {
      if (typeof body[key] === 'boolean') patch[key] = body[key];
    }
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'Empty or invalid body' }, { status: 400 });
    }

    const db = createAdminClient() as DB;

    const { data: brand, error: readErr } = await db
      .from('brands')
      .select('human_review_config')
      .eq('id', brandId)
      .single();
    if (readErr || !brand) {
      return NextResponse.json({ error: 'Brand not found' }, { status: 404 });
    }

    const current = (brand.human_review_config ?? {}) as Partial<HumanReviewConfig>;
    const merged: HumanReviewConfig = {
      messages: current.messages ?? true,
      images:   current.images   ?? true,
      videos:   current.videos   ?? true,
      requests: current.requests ?? true,
      ...patch,
    };

    const { error: updateErr } = await db
      .from('brands')
      .update({ human_review_config: merged })
      .eq('id', brandId);
    if (updateErr) throw updateErr;

    return NextResponse.json({ human_review_config: merged });
  } catch (err) {
    const { error, status } = workerErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}
