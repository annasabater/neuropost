import { NextResponse }                                     from 'next/server';
import { createAdminClient }                                from '@/lib/supabase';
import { requireWorkerForBrand, workerErrorResponse }       from '@/lib/worker';
import {
  getHumanReviewDefaults,
  resolveHumanReviewConfig,
  computeDiffOverride,
  HRC_UI_KEYS,
}                                                           from '@/lib/human-review';
import type { HumanReviewConfig }                           from '@/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ brandId: string }> },
) {
  try {
    const { brandId } = await params;
    await requireWorkerForBrand(brandId);

    const body = await req.json() as Partial<HumanReviewConfig>;
    const patch: Partial<HumanReviewConfig> = {};
    for (const key of HRC_UI_KEYS) {
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

    const defaults         = await getHumanReviewDefaults(db);
    const currentOverride  = (brand.human_review_config ?? null) as Partial<HumanReviewConfig> | null;
    const currentEffective = resolveHumanReviewConfig(currentOverride, defaults);
    const desired          = { ...currentEffective, ...patch } as HumanReviewConfig;
    const override         = computeDiffOverride(desired, defaults);

    const { error: updateErr } = await db
      .from('brands')
      .update({ human_review_config: override })
      .eq('id', brandId);
    if (updateErr) throw updateErr;

    return NextResponse.json({
      human_review_config: override,
      effective:           desired,
      defaults,
    });
  } catch (err) {
    const { error, status } = workerErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ brandId: string }> },
) {
  try {
    const { brandId } = await params;
    await requireWorkerForBrand(brandId);

    const db = createAdminClient() as DB;
    const { error } = await db
      .from('brands')
      .update({ human_review_config: null })
      .eq('id', brandId);
    if (error) throw error;

    const defaults = await getHumanReviewDefaults(db);
    return NextResponse.json({
      human_review_config: null,
      effective:           defaults,
      defaults,
    });
  } catch (err) {
    const { error, status } = workerErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}
