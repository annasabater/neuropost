// =============================================================================
// POST /api/agent-jobs/:id/feedback  — F6
// =============================================================================
// Client records a verdict (approved / rejected / edited) on an agent job's
// output. We:
//   1. Validate ownership
//   2. Insert into agent_feedback
//   3. Immediately bump/dampen the related content_categories.weight so the
//      next strategy:generate_ideas call feels the signal without waiting
//      for the weekly recompute.
//
// The weight nudge is small (±5% of current) so a single feedback row
// never dominates the analytics loop. Multiple feedback rows compound over
// time, which is exactly the aggregation we want.

import { NextResponse } from 'next/server';
import { requireServerUser, createAdminClient } from '@/lib/supabase';
import { getJobWithOutputs } from '@/lib/agents/queue';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

type Verdict = 'approved' | 'rejected' | 'edited';
const VERDICTS: ReadonlySet<Verdict> = new Set(['approved', 'rejected', 'edited']);

interface FeedbackBody {
  verdict:   Verdict;
  comment?:  string;
  edit_diff?: Record<string, unknown>;
}

// Small direct nudge so the effect is visible before the weekly cron.
const VERDICT_NUDGE: Record<Verdict, number> = {
  approved: +0.05,
  rejected: -0.05,
  edited:    0,     // edited is neutral — we learn from the diff, not the verdict
};

/**
 * Walks the job + its outputs to find a category_key. Strategy jobs put it
 * in the output payload (as part of each idea) or in the job input itself
 * (for content:* sub-jobs emitted by plan_week).
 */
function extractCategoryKey(
  job: { input: Record<string, unknown> },
  outputs: Array<{ payload: Record<string, unknown> }>,
): string | null {
  const fromInput = job.input.category_key;
  if (typeof fromInput === 'string') return fromInput;

  for (const o of outputs) {
    if (typeof o.payload.category_key === 'string') return o.payload.category_key;
    // Strategy payloads may have an `ideas` array — use the first one as a
    // rough attribution. Better than losing the signal entirely.
    const ideas = o.payload.ideas;
    if (Array.isArray(ideas) && ideas.length > 0) {
      const first = ideas[0] as { category_key?: unknown };
      if (typeof first.category_key === 'string') return first.category_key;
    }
  }
  return null;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const user = await requireServerUser();
    const body = await request.json() as FeedbackBody;

    if (!body.verdict || !VERDICTS.has(body.verdict)) {
      return NextResponse.json(
        { error: 'verdict must be one of: approved, rejected, edited' },
        { status: 400 },
      );
    }

    // 1. Fetch the job + outputs and verify ownership.
    const bundle = await getJobWithOutputs(id);
    if (!bundle) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const db = createAdminClient() as DB;
    const { data: brand } = await db
      .from('brands')
      .select('id')
      .eq('id', bundle.job.brand_id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (!brand) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const category_key = extractCategoryKey(bundle.job, bundle.outputs);

    // 2. Insert the feedback row.
    const { data: feedback, error: fbErr } = await db
      .from('agent_feedback')
      .insert({
        job_id:       id,
        brand_id:     bundle.job.brand_id,
        verdict:      body.verdict,
        comment:      body.comment ?? null,
        edit_diff:    body.edit_diff ?? null,
        category_key,
      })
      .select()
      .single();
    if (fbErr) throw new Error(`insert feedback: ${fbErr.message}`);

    // 3. Direct nudge on the category weight.
    if (category_key && body.verdict !== 'edited') {
      const nudge = VERDICT_NUDGE[body.verdict];
      const { data: cat } = await db
        .from('content_categories')
        .select('id, weight')
        .eq('brand_id', bundle.job.brand_id)
        .eq('category_key', category_key)
        .maybeSingle();
      if (cat) {
        const current = Number(cat.weight ?? 0);
        // Proportional nudge: 5% of current weight, clamped.
        const delta = nudge * Math.max(current, 0.1);
        const next  = Math.min(Math.max(current + delta, 0.01), 1.0);
        await db
          .from('content_categories')
          .update({ weight: next })
          .eq('id', cat.id);
      }
    }

    return NextResponse.json({ feedback }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[POST /api/agent-jobs/:id/feedback]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
