import { NextResponse }      from 'next/server';
import { requireWorker }     from '@/lib/worker';
import { createAdminClient } from '@/lib/supabase';
import { apiError }          from '@/lib/api-utils';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; ideaId: string }> },
) {
  try {
    await requireWorker();
    const { id, ideaId } = await params;
    const db = createAdminClient() as DB;

    const body = await req.json() as {
      copy_draft?:          string;
      hashtags?:            string[];
      angle?:               string;
      suggested_asset_url?: string;
    };

    const allowed = ['copy_draft', 'hashtags', 'angle', 'suggested_asset_url', 'awaiting_worker_review'] as const;
    const patch: Record<string, unknown> = {};
    for (const k of allowed) {
      if ((body as Record<string, unknown>)[k] !== undefined) {
        patch[k] = (body as Record<string, unknown>)[k];
      }
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    // Any worker action on this idea implicitly clears the worker-review
    // gate — the variation (if any) is now considered handled.
    patch.awaiting_worker_review = false;

    const { data, error } = await db
      .from('content_ideas')
      .update(patch)
      .eq('id', ideaId)
      .eq('week_id', id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({ idea: data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return apiError(err, 'PATCH /api/worker/weekly-plans/[id]/ideas/[ideaId]');
  }
}
