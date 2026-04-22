import { NextResponse }      from 'next/server';
import { requireServerUser } from '@/lib/supabase';
import { createAdminClient } from '@/lib/supabase';
import { apiError }          from '@/lib/api-utils';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

const ACTION_TO_STATUS: Record<string, string> = {
  approve:           'client_approved',
  edit:              'client_edited',
  request_variation: 'regenerating',
  reject:            'client_rejected',
};

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; ideaId: string }> },
) {
  try {
    const user = await requireServerUser();
    const { id, ideaId } = await params;
    const db = createAdminClient() as DB;

    // Verify plan belongs to this user
    const { data: plan } = await db
      .from('weekly_plans')
      .select('id, brand_id, client_first_action_at, brands!inner ( user_id )')
      .eq('id', id)
      .single();

    if (!plan) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (plan.brands?.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json() as {
      action:                 'approve' | 'edit' | 'request_variation' | 'reject';
      client_edited_copy?:    string;
      client_edited_hashtags?: string[];
      comment?:               string;
    };

    const newStatus = ACTION_TO_STATUS[body.action];
    if (!newStatus) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
    if (body.action === 'edit' && !body.client_edited_copy && !body.client_edited_hashtags?.length) {
      return NextResponse.json({ error: 'edit requiere client_edited_copy o client_edited_hashtags' }, { status: 400 });
    }

    // Snapshot previous state for audit
    const { data: prev } = await db
      .from('content_ideas')
      .select('status, copy_draft, hashtags, client_edited_copy, client_edited_hashtags')
      .eq('id', ideaId)
      .eq('week_id', id)
      .single();

    if (!prev) return NextResponse.json({ error: 'Idea not found' }, { status: 404 });

    // Guard: a double-click on "↺ Otra versión" before the agent finishes
    // would enqueue a second job and generate two variations. Block it
    // with 409 so the UI surfaces a clear "ya se está regenerando" message.
    if (body.action === 'request_variation' && prev.status === 'regenerating') {
      return NextResponse.json(
        { error: 'Ya se está regenerando una variación de esta idea' },
        { status: 409 },
      );
    }

    const ideaPatch: Record<string, unknown> = { status: newStatus };
    if (body.client_edited_copy    !== undefined) ideaPatch.client_edited_copy    = body.client_edited_copy;
    if (body.client_edited_hashtags !== undefined) ideaPatch.client_edited_hashtags = body.client_edited_hashtags;

    const { data: updated, error: updateErr } = await db
      .from('content_ideas')
      .update(ideaPatch)
      .eq('id', ideaId)
      .eq('week_id', id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    // Audit trail
    await db.from('client_feedback').insert({
      week_id:        id,
      idea_id:        ideaId,
      brand_id:       plan.brand_id,
      action:         body.action,
      comment:        body.comment ?? null,
      previous_value: { status: prev.status, copy_draft: prev.copy_draft, hashtags: prev.hashtags,
                        client_edited_copy: prev.client_edited_copy, client_edited_hashtags: prev.client_edited_hashtags },
      new_value:      { status: newStatus, client_edited_copy: body.client_edited_copy ?? null,
                        client_edited_hashtags: body.client_edited_hashtags ?? null },
    });

    // Record first client action on this plan
    if (!plan.client_first_action_at) {
      await db.from('weekly_plans').update({ client_first_action_at: new Date().toISOString() }).eq('id', id);
    }

    // For request_variation, enqueue the strategy:regenerate_idea agent job.
    // The idea is already in status='regenerating' after the UPDATE above.
    if (body.action === 'request_variation') {
      await db.from('agent_jobs').insert({
        brand_id:     plan.brand_id,
        agent_type:   'strategy',
        action:       'regenerate_idea',
        status:       'pending',
        priority:     60,
        requested_by: 'client',
        requester_id: user.id,
        input: {
          original_idea_id: ideaId,
          week_id:          id,
          comment:          body.comment ?? null,
        },
      });
    }

    return NextResponse.json({ idea: updated });
  } catch (err) {
    return apiError(err, 'PATCH /api/client/weekly-plans/[id]/ideas/[ideaId]');
  }
}
