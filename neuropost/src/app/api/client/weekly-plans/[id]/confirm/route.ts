import { NextResponse }              from 'next/server';
import { requireServerUser }         from '@/lib/supabase';
import { createAdminClient }         from '@/lib/supabase';
import { transitionWeeklyPlanStatus, ConcurrentPlanModificationError } from '@/lib/planning/weekly-plan-service';
import { queueJob }                  from '@/lib/agents/queue';
import { apiError }                  from '@/lib/api-utils';
import { log }                       from '@/lib/logger';
import { logAudit }                  from '@/lib/audit';
import type { ContentIdea }          from '@/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireServerUser();
    const { id } = await params;
    const db = createAdminClient() as DB;

    const { data: plan } = await db
      .from('weekly_plans')
      .select('id, brand_id, status, parent_job_id, brands!inner ( user_id )')
      .eq('id', id)
      .single();

    if (!plan) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (plan.brands?.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    if (plan.status !== 'client_reviewing') {
      return NextResponse.json({ error: `Plan no está en revisión del cliente (status=${plan.status})` }, { status: 409 });
    }

    const { data: ideas } = await db
      .from('content_ideas')
      .select('*')
      .eq('week_id', id)
      .order('position', { ascending: true });

    const allIdeas: ContentIdea[] = ideas ?? [];
    const pending = allIdeas.filter((i) => i.status === 'pending');
    if (pending.length > 0) {
      return NextResponse.json({
        error: 'Hay ideas sin revisar',
        pending_idea_ids: pending.map((i) => i.id),
      }, { status: 400 });
    }

    // Transition to client_approved first
    await transitionWeeklyPlanStatus({ plan_id: id, to: 'client_approved', reason: 'client confirmed' });
    await db.from('weekly_plans').update({ client_approved_at: new Date().toISOString() }).eq('id', id);

    // Fan-out production sub-jobs for approved/edited ideas
    const producibles = allIdeas.filter(
      (i) => i.status === 'client_approved' || i.status === 'client_edited',
    );

    for (const idea of producibles) {
      await queueJob({
        brand_id:      plan.brand_id,
        agent_type:    'content',
        action:        'generate_caption',
        priority:      60,
        parent_job_id: plan.parent_job_id ?? undefined,
        input: {
          content_idea_id: idea.id,
          final_copy:      idea.final_copy ?? idea.client_edited_copy ?? idea.copy_draft,
        },
      });
      if (idea.format !== 'reel') {
        await queueJob({
          brand_id:      plan.brand_id,
          agent_type:    'content',
          action:        'generate_image',
          priority:      60,
          parent_job_id: plan.parent_job_id ?? undefined,
          input: {
            content_idea_id: idea.id,
            userPrompt:      idea.suggested_asset_url ?? idea.angle,
            format:          idea.format === 'story' ? 'story' : 'post',
            brandId:         plan.brand_id,
          },
        });
      }
      await db.from('content_ideas').update({ status: 'in_production' }).eq('id', idea.id);
    }

    await transitionWeeklyPlanStatus({ plan_id: id, to: 'producing', reason: 'production queued' });
    void logAudit({ actor_type: 'user', actor_id: user.id, action: 'confirm', resource_type: 'weekly_plan',
      resource_id: id, brand_id: plan.brand_id,
      description: `Client confirmed weekly plan — ${producibles.length} ideas in production` });

    return NextResponse.json({
      ok: true,
      ideas_in_production: producibles.length,
      ideas_skipped:       allIdeas.length - producibles.length,
    });
  } catch (err) {
    if (err instanceof ConcurrentPlanModificationError) {
      log({ level: 'warn', scope: 'client/confirm', event: 'concurrent_modification',
            plan_id: err.planId, expected: err.expected, actual: err.actual });
      return NextResponse.json(
        { error: 'Este plan ya fue modificado por otro proceso. Recarga la página e inténtalo de nuevo.' },
        { status: 409 },
      );
    }
    return apiError(err, 'POST /api/client/weekly-plans/[id]/confirm');
  }
}
