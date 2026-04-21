import { NextResponse }                  from 'next/server';
import type { NextRequest }              from 'next/server';
import { requireWorker, workerErrorResponse } from '@/lib/worker';
import { createAdminClient }             from '@/lib/supabase';

// GET /api/worker/posts/[id]/revisions — ordered list for RevisionTimeline
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    await requireWorker();
    const { id } = await ctx.params;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createAdminClient() as any;

    const { data, error } = await db
      .from('post_revisions')
      .select('*')
      .eq('post_id', id)
      .order('revision_index', { ascending: true });

    if (error) throw error;
    return NextResponse.json({ revisions: data ?? [] });
  } catch (err) {
    const { error, status } = workerErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}
