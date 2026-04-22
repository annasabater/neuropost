import { NextResponse }                                           from 'next/server';
import { createAdminClient }                                      from '@/lib/supabase';
import { requireWorker, requireAdminOrSenior, workerErrorResponse } from '@/lib/worker';
import { getHumanReviewDefaults, HRC_KEY, HRC_UI_KEYS }            from '@/lib/human-review';
import type { HumanReviewDefaults }                               from '@/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export async function GET() {
  try {
    await requireWorker();
    const db = createAdminClient() as DB;
    const defaults = await getHumanReviewDefaults(db);
    return NextResponse.json({ human_review_defaults: defaults });
  } catch (err) {
    const { error, status } = workerErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}

export async function PATCH(req: Request) {
  try {
    const worker = await requireAdminOrSenior();

    const body = await req.json() as Partial<HumanReviewDefaults>;
    const patch: Partial<HumanReviewDefaults> = {};
    for (const k of HRC_UI_KEYS) {
      if (typeof body[k] === 'boolean') patch[k] = body[k];
    }
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'Empty or invalid body' }, { status: 400 });
    }

    const db = createAdminClient() as DB;
    const current = await getHumanReviewDefaults(db);
    const merged: HumanReviewDefaults = { ...current, ...patch };

    const { error } = await db
      .from('app_settings')
      .upsert({
        key:        HRC_KEY,
        value:      merged,
        updated_at: new Date().toISOString(),
        updated_by: worker.id,
      }, { onConflict: 'key' });
    if (error) throw error;

    return NextResponse.json({ human_review_defaults: merged });
  } catch (err) {
    const { error, status } = workerErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}
