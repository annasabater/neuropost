// =============================================================================
// Planning — proposal-hooks
// =============================================================================
// Hook fired when a worker approves a proposal in /worker/validation.
// Marks the linked content_idea as 'produced', links the post_id, and when
// all producible ideas in the plan are done, transitions to 'calendar_ready'
// and emails the client.

import { createAdminClient }          from '@/lib/supabase';
import { transitionWeeklyPlanStatus } from '@/lib/planning/weekly-plan-service';
import { enqueueCalendarReadyEmail }  from '@/lib/planning/trigger-calendar-email';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export async function onProposalApproved(params: {
  proposal_id:     string;
  content_idea_id: string;
  post_id:         string;
}): Promise<void> {
  const db = createAdminClient() as DB;

  // 1. Mark idea as produced and link the post
  const { data: idea, error: ideaErr } = await db
    .from('content_ideas')
    .update({
      status:  'produced',
      post_id: params.post_id,
    })
    .eq('id', params.content_idea_id)
    .select('week_id, brand_id')
    .single();

  if (ideaErr || !idea) {
    console.error('[proposal-hook] Error actualizando idea:', params.content_idea_id, ideaErr);
    return;
  }

  console.log('[proposal-hook] Idea producida:', params.content_idea_id);

  // 2. Check if all producible ideas in the plan are done
  const { data: allIdeas, error: planIdeasErr } = await db
    .from('content_ideas')
    .select('id, status')
    .eq('week_id', idea.week_id);

  if (planIdeasErr || !allIdeas) {
    console.error('[proposal-hook] Error cargando ideas del plan:', idea.week_id, planIdeasErr);
    return;
  }

  const allDone = (allIdeas as { id: string; status: string }[]).every(
    (i) => i.status === 'produced' || i.status === 'client_rejected' || i.status === 'auto_skipped',
  );

  if (!allDone) {
    const remaining = (allIdeas as { id: string; status: string }[]).filter(
      (i) => i.status !== 'produced' && i.status !== 'client_rejected' && i.status !== 'auto_skipped',
    ).length;
    console.log(`[proposal-hook] Plan ${idea.week_id} incompleto — ${remaining} ideas pendientes`);
    return;
  }

  // 3. Transition plan to calendar_ready (only if currently in 'producing')
  const { data: plan } = await db
    .from('weekly_plans')
    .select('status')
    .eq('id', idea.week_id)
    .single();

  if ((plan as { status: string } | null)?.status !== 'producing') {
    console.log('[proposal-hook] Plan no está en producing, status actual:', (plan as { status: string } | null)?.status);
    return;
  }

  try {
    await transitionWeeklyPlanStatus({ plan_id: idea.week_id as string, to: 'calendar_ready' });
    console.log('[proposal-hook] Plan transitado a calendar_ready:', idea.week_id);
  } catch (err) {
    console.error('[proposal-hook] Error en transición:', err);
    return;
  }

  // 4. Email + in-app notification to client
  await enqueueCalendarReadyEmail(idea.week_id as string);
}
