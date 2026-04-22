// npx tsx scripts/test-regenerate-idea.ts <content_idea_id> [comment]
//
// End-to-end smoke test for strategy:regenerate_idea.
//
// Steps:
//   1. Load the target idea (must exist)
//   2. Flip its status to 'regenerating' (mimics the PATCH client endpoint)
//   3. INSERT a strategy:regenerate_idea job on agent_jobs
//   4. Poll the job until done/error (max 90s)
//   5. Verify:
//        - original idea: status='replaced_by_variation'
//        - new idea exists with original_idea_id = target
//        - new idea status='pending', regeneration_reason=<comment>
//        - worker_notifications row with matching metadata if the
//          effective human_review_config routed to worker_review

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env');
  process.exit(1);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = createClient(SUPABASE_URL, SERVICE_ROLE) as any;

const ideaId  = process.argv[2];
const comment = process.argv[3] ?? 'versión más corta y menos motivacional';

if (!ideaId) {
  console.error('Usage: npx tsx scripts/test-regenerate-idea.ts <content_idea_id> [comment]');
  process.exit(1);
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main(): Promise<void> {
  console.log(`\n── target: content_idea ${ideaId}`);
  console.log(`── comment: "${comment}"\n`);

  // 1. Load original
  const { data: original, error: loadErr } = await db
    .from('content_ideas')
    .select('id, status, brand_id, week_id, angle, format, content_kind')
    .eq('id', ideaId)
    .single();

  if (loadErr || !original) {
    console.error('✗ Original idea not found:', loadErr?.message);
    process.exit(1);
  }
  console.log(`✓ Loaded original: status=${original.status}, brand=${original.brand_id}`);

  // 2. Flip to 'regenerating'
  const { error: flipErr } = await db
    .from('content_ideas')
    .update({ status: 'regenerating' })
    .eq('id', ideaId);
  if (flipErr) {
    console.error('✗ Could not flip status:', flipErr.message);
    process.exit(1);
  }
  console.log('✓ Flipped status to regenerating');

  // 3. Enqueue the job
  const { data: job, error: jobErr } = await db
    .from('agent_jobs')
    .insert({
      brand_id:     original.brand_id,
      agent_type:   'strategy',
      action:       'regenerate_idea',
      status:       'pending',
      priority:     60,
      requested_by: 'test',
      input: {
        original_idea_id: ideaId,
        week_id:          original.week_id,
        comment,
      },
    })
    .select('id')
    .single();

  if (jobErr || !job) {
    console.error('✗ Could not enqueue job:', jobErr?.message);
    process.exit(1);
  }
  console.log(`✓ Enqueued job ${job.id}`);

  // 4. Poll
  const start = Date.now();
  let last = '';
  while (Date.now() - start < 90_000) {
    const { data: cur } = await db
      .from('agent_jobs')
      .select('status, error_message')
      .eq('id', job.id)
      .single();
    if (cur && cur.status !== last) {
      console.log(`   job.status → ${cur.status}${cur.error_message ? ` (${cur.error_message})` : ''}`);
      last = cur.status;
    }
    if (cur && (cur.status === 'done' || cur.status === 'error')) break;
    await sleep(2_000);
  }

  if (last !== 'done') {
    console.error(`\n✗ Job did not complete successfully (last status: ${last})`);
    process.exit(1);
  }

  // 5. Verify
  const { data: oldNow } = await db
    .from('content_ideas')
    .select('status')
    .eq('id', ideaId)
    .single();
  const oldOk = oldNow?.status === 'replaced_by_variation';
  console.log(`${oldOk ? '✓' : '✗'} Original now status=${oldNow?.status} (expected replaced_by_variation)`);

  const { data: newIdeas } = await db
    .from('content_ideas')
    .select('id, status, regeneration_reason, angle')
    .eq('original_idea_id', ideaId);
  const newRow = (newIdeas ?? [])[0];
  const newOk = newIdeas?.length === 1 && newRow?.status === 'pending' && newRow?.regeneration_reason === comment;
  console.log(`${newOk ? '✓' : '✗'} New idea count=${newIdeas?.length ?? 0} (expected 1), status=${newRow?.status}, reason="${newRow?.regeneration_reason}"`);
  if (newRow) console.log(`   new angle: "${newRow.angle}"`);

  const { data: notifs } = await db
    .from('worker_notifications')
    .select('type, message, metadata')
    .eq('brand_id', original.brand_id)
    .order('created_at', { ascending: false })
    .limit(5);
  const notif = (notifs ?? []).find((n: { metadata?: Record<string, unknown> }) =>
    (n.metadata as Record<string, unknown> | undefined)?.original_idea_id === ideaId,
  );
  console.log(`${notif ? '✓' : '—'} worker_notification: ${notif ? notif.type : 'none (client_review route, no notification expected)'}`);
  if (notif) {
    const rr = (notif.metadata as Record<string, unknown>).routing_reason;
    console.log(`   routing_reason:`, rr);
  }

  const allOk = oldOk && newOk;
  console.log(`\n${allOk ? '✓ PASS' : '✗ FAIL'}`);
  process.exit(allOk ? 0 : 1);
}

void main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
