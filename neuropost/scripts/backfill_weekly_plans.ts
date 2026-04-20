// =============================================================================
// NeuroPost — Backfill weekly_plans + content_ideas from historical strategy outputs
//
// Usage:
//   npx tsx scripts/backfill_weekly_plans.ts                 # all brands, interactive confirm
//   npx tsx scripts/backfill_weekly_plans.ts --dry-run       # simulate, no DB writes
//   npx tsx scripts/backfill_weekly_plans.ts --brand-id <uuid>
//   npx tsx scripts/backfill_weekly_plans.ts --dry-run --brand-id <uuid>
//
// What it does:
//   For each brand (or the specified one), finds the last 4 agent_outputs with
//   kind='strategy', reconstructs weekly_plans (status='completed') and
//   content_ideas (status='produced' if post matched, 'auto_skipped' otherwise).
//   Idempotent: skips a week if a weekly_plan already exists for brand+week_start.
//
// What it does NOT touch:
//   posts, proposals, agent_outputs, pipelines, handlers
// =============================================================================

/* eslint-disable no-console */

import { readFileSync, existsSync } from 'node:fs';
import { resolve }                  from 'node:path';
import * as readline                from 'node:readline';
import { parseIdeasFromStrategyPayload, isPlanWeekPayload } from '../src/lib/planning/parse-ideas';
import type { ParsedIdea }          from '../src/lib/planning/parse-ideas';

// ─── Load .env.local (mirrors existing scripts) ──────────────────────────────

function loadEnvLocal() {
  const envPath = resolve(process.cwd(), '.env.local');
  if (!existsSync(envPath)) return;
  const raw = readFileSync(envPath, 'utf-8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val   = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

// ─── CLI helpers ─────────────────────────────────────────────────────────────

function confirm(question: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(res => {
    rl.question(question, answer => {
      rl.close();
      res(answer.trim().toLowerCase() === 'yes');
    });
  });
}

// ─── Domain helpers ──────────────────────────────────────────────────────────

/** Returns the ISO date string (YYYY-MM-DD) of the Monday of the given date's week. */
function toWeekStart(isoDate: string): string {
  const d = new Date(isoDate);
  const day = d.getUTCDay(); // 0=Sun
  const daysBack = day === 0 ? 6 : day - 1;
  d.setUTCDate(d.getUTCDate() - daysBack);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().split('T')[0];
}

interface BrandRow { id: string; name: string }
interface OutputRow { id: string; brand_id: string; kind: string; payload: Record<string, unknown>; created_at: string }
interface PostRow   { id: string; brand_id: string; format: string; created_at: string }

/** Finds a post within ±30 min of the output timestamp with matching format. */
function findMatchingPost(posts: PostRow[], outputCreatedAt: string, format: string): PostRow | undefined {
  const target  = new Date(outputCreatedAt).getTime();
  const windowMs = 30 * 60 * 1000;
  return posts.find(p =>
    Math.abs(new Date(p.created_at).getTime() - target) <= windowMs &&
    (!format || p.format === format)
  );
}

// ─── Per-brand processing ─────────────────────────────────────────────────────

interface Stats { plans: number; ideas: number; linked: number; autoSkipped: number; errors: number }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processBrand(db: any, brand: BrandRow, dryRun: boolean, totals: Stats): Promise<void> {
  console.log(`\n── ${brand.name} (${brand.id})`);

  // Fetch recent strategy outputs — fetch 12 to have room after filtering taxonomy outputs
  const { data: rawOutputs, error: outErr } = await db
    .from('agent_outputs')
    .select('id, brand_id, kind, payload, created_at')
    .eq('brand_id', brand.id)
    .eq('kind', 'strategy')
    .order('created_at', { ascending: false })
    .limit(12);

  if (outErr) throw outErr;

  const allOutputs: OutputRow[] = rawOutputs ?? [];
  const validOutputs = allOutputs.filter(o => isPlanWeekPayload(o.payload));
  const skippedCount = allOutputs.length - validOutputs.length;

  if (allOutputs.length === 0) {
    console.log('   No strategy outputs — skipped');
    return;
  }
  console.log(`   Found ${allOutputs.length} strategy outputs, ${validOutputs.length} valid (with ideas), ${skippedCount} skipped (taxonomy or empty)`);
  if (validOutputs.length === 0) return;

  // Defensive deduplication: per week_start keep the most recent valid output
  // (validOutputs is already ordered DESC by created_at)
  const byWeek = new Map<string, OutputRow>();
  for (const o of validOutputs) {
    const ws = toWeekStart(o.created_at);
    if (!byWeek.has(ws)) {
      byWeek.set(ws, o);
    } else {
      console.log(`   [WARN]  Two valid plan-week outputs for week_start=${ws} — keeping most recent (${byWeek.get(ws)!.id}), discarding ${o.id}`);
    }
  }
  // Take up to 4 most recent unique weeks
  const outputs = [...byWeek.values()].slice(0, 4);

  // All posts for this brand (for match window)
  const { data: posts, error: postsErr } = await db
    .from('posts')
    .select('id, brand_id, format, created_at')
    .eq('brand_id', brand.id);
  if (postsErr) throw postsErr;
  const brandPosts: PostRow[] = posts ?? [];

  let plansCreated = 0, plansSkipped = 0, ideasCreated = 0, ideasLinked = 0, ideasAutoSkipped = 0;

  for (const output of outputs) {
    const weekStart = toWeekStart(output.created_at);

    // Idempotency check
    const { data: existing } = await db
      .from('weekly_plans')
      .select('id')
      .eq('brand_id', brand.id)
      .eq('week_start', weekStart)
      .maybeSingle();

    if (existing) {
      console.log(`   [SKIP]  week_start=${weekStart} — already exists (id=${existing.id})`);
      plansSkipped++;
      continue;
    }

    const ideas: ParsedIdea[] = parseIdeasFromStrategyPayload(output.payload);

    if (dryRun) {
      console.log(`   [DRY]   week_start=${weekStart} — would create 1 plan + ${ideas.length} ideas`);
      for (const idea of ideas) {
        const match = findMatchingPost(brandPosts, output.created_at, idea.format);
        match ? ideasLinked++ : ideasAutoSkipped++;
      }
      plansCreated++;
      ideasCreated += ideas.length;
      continue;
    }

    // Insert weekly_plan
    const { data: plan, error: planErr } = await db
      .from('weekly_plans')
      .insert({
        brand_id:        brand.id,
        parent_job_id:   null,
        week_start:      weekStart,
        status:          'completed',
        auto_approved:   true,
        auto_approved_at: output.created_at,
        claimed_by:      null,
        claimed_at:      null,
      })
      .select('id')
      .single();

    if (planErr) throw planErr;
    plansCreated++;
    console.log(`   [OK]    week_start=${weekStart} plan=${plan.id} · ${ideas.length} ideas`);

    // Insert content_ideas
    for (const idea of ideas) {
      const matched = findMatchingPost(brandPosts, output.created_at, idea.format);
      const status  = matched ? 'produced' : 'auto_skipped';

      const { error: ideaErr } = await db
        .from('content_ideas')
        .insert({
          week_id:              plan.id,
          brand_id:             brand.id,
          agent_output_id:      output.id,
          position:             idea.position,
          format:               idea.format,
          angle:                idea.angle,
          hook:                 idea.hook,
          copy_draft:           idea.copy_draft,
          hashtags:             idea.hashtags,
          suggested_asset_url:  idea.suggested_asset_url,
          suggested_asset_id:   idea.suggested_asset_id,
          category_id:          idea.category_id,
          status,
          post_id:              matched ? matched.id : null,
        });

      if (ideaErr) {
        console.error(`     [ERROR] idea[${idea.position}]:`, ideaErr.message);
      } else {
        ideasCreated++;
        matched ? ideasLinked++ : ideasAutoSkipped++;
      }
    }
  }

  console.log(`   Plans : ${plansCreated} created, ${plansSkipped} already existed`);
  console.log(`   Ideas : ${ideasCreated} created — ${ideasLinked} linked to post, ${ideasAutoSkipped} auto_skipped`);

  totals.plans      += plansCreated;
  totals.ideas      += ideasCreated;
  totals.linked     += ideasLinked;
  totals.autoSkipped += ideasAutoSkipped;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  loadEnvLocal();

  const args          = process.argv.slice(2);
  const dryRun        = args.includes('--dry-run');
  const brandIdIdx    = args.indexOf('--brand-id');
  const targetBrandId = brandIdIdx !== -1 ? args[brandIdIdx + 1] : null;

  console.log('\n══════════════════════════════════════════════');
  console.log(' NeuroPost — Weekly Plans Backfill');
  console.log('══════════════════════════════════════════════');
  if (dryRun)        console.log(' Mode      : DRY-RUN (no writes)');
  if (targetBrandId) console.log(` Target    : brand ${targetBrandId}`);
  console.log('');

  const { createAdminClient } = await import('../src/lib/supabase');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createAdminClient() as any;

  let query = db.from('brands').select('id, name');
  if (targetBrandId) query = query.eq('id', targetBrandId);
  const { data: brands, error: brandsErr } = await query;
  if (brandsErr) throw brandsErr;

  if (!brands?.length) { console.log('No brands found.'); return; }
  console.log(`Found ${brands.length} brand(s).`);

  if (!dryRun && !targetBrandId) {
    const ok = await confirm(
      `\n⚠  This will write to the database for ALL ${brands.length} brands.\nType "yes" to continue: `
    );
    if (!ok) { console.log('Aborted.'); return; }
  }

  const totals: Stats = { plans: 0, ideas: 0, linked: 0, autoSkipped: 0, errors: 0 };
  let processed = 0;

  for (const brand of brands as BrandRow[]) {
    try {
      await processBrand(db, brand, dryRun, totals);
      processed++;
    } catch (err) {
      console.error(`\n[ERROR] Brand "${brand.name}" (${brand.id}):`, (err as Error).message);
      totals.errors++;
    }
  }

  console.log('\n══════════════════════════════════════════════');
  console.log(' SUMMARY');
  console.log('══════════════════════════════════════════════');
  console.log(` Brands processed      : ${processed}`);
  console.log(` Weekly plans created  : ${totals.plans}`);
  console.log(` Content ideas created : ${totals.ideas}`);
  console.log(`   → linked to post    : ${totals.linked}`);
  console.log(`   → auto_skipped      : ${totals.autoSkipped}`);
  console.log(` Errors                : ${totals.errors}`);
  if (dryRun) console.log('\n[DRY-RUN] No changes written to the database.');
}

main().catch(err => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
