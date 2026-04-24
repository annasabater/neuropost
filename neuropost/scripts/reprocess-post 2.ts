#!/usr/bin/env npx tsx
// =============================================================================
// reprocess-post.ts — manual re-queue for a stuck post
// =============================================================================
// Usage:
//   npx tsx scripts/reprocess-post.ts <postId>
//
// What it does:
//   1. Reads the post from Supabase (verifies it exists and is not published).
//   2. Looks for an existing agent_job for this post in pending/error state.
//   3. If found: resets it to 'pending' so the next cron tick picks it up.
//      If not found: creates a new generate_image job with the post's context.
//   4. Loads the handler registry and runs the job directly (no Redis needed).
//
// Prerequisites:
//   - .env.local with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
//   - (optional) ANTHROPIC_API_KEY / REPLICATE_API_TOKEN for live generation

import { readFileSync, existsSync } from 'node:fs';
import { resolve }                  from 'node:path';

// ── Load .env.local ───────────────────────────────────────────────────────────
const envPath = resolve(process.cwd(), '.env.local');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let   val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
      val = val.slice(1, -1);
    if (val && !(key in process.env)) process.env[key] = val;
  }
}

import { createClient } from '@supabase/supabase-js';

const postId = process.argv[2];
if (!postId) {
  console.error('Usage: npx tsx scripts/reprocess-post.ts <postId>');
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = createClient(supabaseUrl, serviceKey) as any;

async function main() {
  // ── 1. Load post ────────────────────────────────────────────────────────────
  const { data: post, error: postErr } = await db
    .from('posts')
    .select('id, brand_id, status, image_url, edited_image_url, caption, format, ai_explanation')
    .eq('id', postId)
    .single();

  if (postErr || !post) {
    console.error(`Post ${postId} not found:`, postErr?.message);
    process.exit(1);
  }

  if (post.status === 'published') {
    console.warn(`Post ${postId} is already published — nothing to reprocess.`);
    process.exit(0);
  }

  console.log(`Post ${postId} — status: ${post.status} | image_url: ${post.image_url ?? '(none)'} | edited_image_url: ${post.edited_image_url ?? '(none)'}`);

  // ── 2. Look for an existing job ─────────────────────────────────────────────
  const { data: existingJob } = await db
    .from('agent_jobs')
    .select('id, status, attempts, max_attempts, input')
    .contains('input', { _post_id: postId })
    .in('status', ['pending', 'error', 'running'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let jobId: string;

  if (existingJob) {
    console.log(`Found existing job ${existingJob.id} (status: ${existingJob.status}, attempts: ${existingJob.attempts}/${existingJob.max_attempts})`);
    // Reset to pending so it can be picked up again
    const { error: resetErr } = await db
      .from('agent_jobs')
      .update({ status: 'pending', error: null, started_at: null })
      .eq('id', existingJob.id);
    if (resetErr) { console.error('Failed to reset job:', resetErr.message); process.exit(1); }
    jobId = existingJob.id;
    console.log(`Reset job ${jobId} → pending`);
  } else {
    // ── 3. Create a new job ──────────────────────────────────────────────────
    console.log('No existing job found — creating new generate_image job...');

    // Load brand context
    const { data: brand } = await db
      .from('brands')
      .select('sector, visual_style, brand_voice_doc, name, tone, colors, rules')
      .eq('id', post.brand_id)
      .single();

    let basePrompt = post.caption ?? '';
    try {
      const meta = JSON.parse(post.ai_explanation ?? '{}');
      const perNote = meta.per_image?.[0]?.note?.trim();
      basePrompt = perNote || String(meta.global_description ?? meta.client_notes ?? basePrompt);
    } catch { /* use caption as fallback */ }

    const input = {
      userPrompt:     basePrompt || `Contenido para ${brand?.name ?? 'la marca'}, sector ${brand?.sector ?? 'otro'}`,
      sector:         brand?.sector       ?? 'otro',
      visualStyle:    brand?.visual_style ?? 'warm',
      brandContext:   brand?.brand_voice_doc
                        ?? `${brand?.name ?? 'marca'} — sector ${brand?.sector ?? 'otro'}, tono ${brand?.tone ?? 'cercano'}`,
      colors:         brand?.colors       ?? null,
      forbiddenWords: (brand?.rules as { forbiddenWords?: string[] } | null)?.forbiddenWords ?? [],
      format:         post.format === 'story' ? 'story' : post.format === 'reel' ? 'reel_cover' : 'post',
      brandId:        post.brand_id,
      ...(post.image_url ? { referenceImageUrl: post.image_url, editStrength: 0.65 } : {}),
      _post_id:         postId,
      _photo_index:     0,
      _original_prompt: basePrompt,
      _auto_pipeline:   true,
    };

    const { data: newJob, error: createErr } = await db
      .from('agent_jobs')
      .insert({
        brand_id:     post.brand_id,
        agent_type:   'content',
        action:       'generate_image',
        input,
        status:       'pending',
        priority:     80,
        requested_by: 'system',
        max_attempts: 3,
        attempts:     0,
      })
      .select('id')
      .single();

    if (createErr || !newJob) { console.error('Failed to create job:', createErr?.message); process.exit(1); }
    jobId = newJob.id;
    console.log(`Created new job ${jobId}`);
  }

  // ── 4. Process immediately via handler (no Redis needed) ────────────────────
  console.log('Running handler directly (bypassing Redis)...');

  // Dynamically import after env is loaded
  const { registerLocalAgentHandlers } = await import('../src/lib/agents/handlers/local.js');
  const { lookupHandler }              = await import('../src/lib/agents/registry.js');
  registerLocalAgentHandlers();

  const { data: jobRow } = await db.from('agent_jobs').select('*').eq('id', jobId).single();
  if (!jobRow) { console.error('Job row not found'); process.exit(1); }

  // Claim
  const { data: claimed } = await db
    .from('agent_jobs')
    .update({ status: 'running', started_at: new Date().toISOString(), attempts: (jobRow.attempts ?? 0) + 1 })
    .eq('id', jobId)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle();

  if (!claimed) { console.warn('Job already claimed by another runner — it will be processed on next tick.'); process.exit(0); }

  const handler = lookupHandler(jobRow.agent_type, jobRow.action);
  if (!handler) {
    console.error(`No handler registered for ${jobRow.agent_type}:${jobRow.action}`);
    await db.from('agent_jobs').update({ status: 'error', error: 'No handler (script)' }).eq('id', jobId);
    process.exit(1);
  }

  try {
    const result = await handler({ ...jobRow, status: 'running', attempts: (jobRow.attempts ?? 0) + 1 });

    if (result.type === 'ok') {
      if (result.outputs?.length) {
        await db.from('agent_outputs').insert(
          result.outputs.map((o) => ({
            job_id:      jobId,
            brand_id:    jobRow.brand_id,
            kind:        o.kind,
            payload:     o.payload,
            preview_url: o.preview_url ?? null,
            model:       o.model       ?? null,
          })),
        );
      }
      await db.from('agent_jobs').update({ status: 'done', completed_at: new Date().toISOString() }).eq('id', jobId);
      console.log(`✅  Job ${jobId} completed. edited_image_url should now be set on post ${postId}.`);

      // Show updated post
      const { data: updated } = await db.from('posts').select('status, image_url, edited_image_url').eq('id', postId).single();
      console.log('Updated post:', updated);
    } else {
      const errMsg = result.type === 'fail' ? result.error : (result.type === 'retry' ? `retry: ${result.error}` : 'unknown');
      await db.from('agent_jobs').update({ status: 'error', error: errMsg }).eq('id', jobId);
      console.error(`❌  Job failed: ${errMsg}`);
      process.exit(1);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db.from('agent_jobs').update({ status: 'error', error: msg }).eq('id', jobId);
    console.error(`❌  Handler threw:`, msg);
    process.exit(1);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
