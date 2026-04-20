// test_sprint11.ts — Sprint 11: story plan handler tests
//
// Tests planStoriesHandler in isolation (no taxonomy dependency) by:
//   1. Setting a brand to plan='pro' + use_new_planning_flow=true
//   2. Verifying brand_material entries exist (creates them if missing)
//   3. Calling planStoriesHandler directly + inserting into a real weekly_plan
//   4. Three SQL verification queries
//   5. Test with no material (all AI quotes)
//   6. Test with limited templates (2-template round-robin)

import { readFileSync, existsSync } from 'node:fs';
import { resolve }                  from 'node:path';

// ── Env ───────────────────────────────────────────────────────────────────────

const envPath = resolve(process.cwd(), '.env.local');
if (existsSync(envPath)) {
  const raw = readFileSync(envPath, 'utf-8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val   = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (val && !(key in process.env)) process.env[key] = val;
  }
  console.log('[env] cargadas desde .env.local');
} else {
  console.warn('[env] .env.local NO encontrado en', envPath);
}

console.log('ENV check:');
console.log('  NEXT_PUBLIC_SUPABASE_URL  :', process.env.NEXT_PUBLIC_SUPABASE_URL  ? 'SET' : 'MISSING');
console.log('  SUPABASE_SERVICE_ROLE_KEY :', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'MISSING');
console.log('  ANTHROPIC_API_KEY         :', process.env.ANTHROPIC_API_KEY         ? 'SET' : 'MISSING');
console.log('');

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('ERROR: Faltan variables de entorno Supabase.');
  process.exit(1);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getDb(): Promise<any> {
  const { createAdminClient } = await import('../src/lib/supabase');
  return createAdminClient();
}

function uniqueWeekStart(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay() + 1 + offsetDays); // next Monday + offset
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().split('T')[0];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function createMinimalWeeklyPlan(db: any, brandId: string, weekStart: string): Promise<string> {
  const { data: plan, error } = await db
    .from('weekly_plans')
    .insert({
      brand_id:    brandId,
      week_start:  weekStart,
      status:      'ideas_ready',
      auto_approved: false,
    })
    .select('id')
    .single();
  if (error || !plan) throw new Error(`weekly_plan insert failed: ${error?.message}`);
  return plan.id as string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function deletePlan(db: any, planId: string) {
  await db.from('weekly_plans').delete().eq('id', planId);
}

// ── Main ──────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

async function main() {
  const db = await getDb();

  // ── 0. Find a brand with use_new_planning_flow=true ─────────────────────────
  const { data: brands } = await db
    .from('brands')
    .select('id, name, plan, use_new_planning_flow')
    .eq('use_new_planning_flow', true)
    .limit(1);

  const brandRow = brands?.[0];
  if (!brandRow) {
    console.error('ERROR: No brands with use_new_planning_flow=true found. Enable it for at least one brand.');
    process.exit(1);
  }

  const BRAND_ID = brandRow.id as string;
  console.log(`\nUsing brand: ${brandRow.name} (${BRAND_ID}), plan=${brandRow.plan}`);

  // ── 1. Ensure brand is on 'pro' plan ────────────────────────────────────────
  await db.from('brands').update({ plan: 'pro' }).eq('id', BRAND_ID);
  console.log('[1] Brand set to plan=pro (posts_per_week=4, stories_per_week=5)');

  // Load full brand row
  const { data: brand } = await db.from('brands').select('*').eq('id', BRAND_ID).single();

  // ── 2. Ensure brand_material has entries ────────────────────────────────────
  const { data: existingMaterial } = await db
    .from('brand_material')
    .select('id, category, content, active')
    .eq('brand_id', BRAND_ID)
    .eq('active', true);

  const existing = (existingMaterial ?? []) as Row[];
  console.log(`[2] brand_material activo: ${existing.length} entradas`);

  // Create minimal entries if brand has none
  let createdMaterialIds: string[] = [];
  if (existing.length === 0) {
    console.log('   → Sin material, creando 5 entradas de prueba...');
    const seeds = [
      { brand_id: BRAND_ID, category: 'schedule', content: { days: [{ day: 'monday', hours: '9:00-20:00' }, { day: 'friday', hours: '9:00-22:00' }] }, active: true },
      { brand_id: BRAND_ID, category: 'promo',    content: { title: 'Oferta de prueba', description: '20% en todos los servicios este mes', url: '' }, active: true },
      { brand_id: BRAND_ID, category: 'data',     content: { label: '10 años', description: 'de experiencia en el sector' }, active: true },
      { brand_id: BRAND_ID, category: 'quote',    content: { text: 'La calidad nunca se improvisa.', author: '' }, active: true },
      { brand_id: BRAND_ID, category: 'free',     content: { text: 'Somos un negocio local comprometido con nuestros clientes.' }, active: true },
    ];
    const { data: created } = await db.from('brand_material').insert(seeds).select('id');
    createdMaterialIds = (created ?? []).map((r: Row) => r.id as string);
    console.log(`   → ${createdMaterialIds.length} entradas creadas`);
  } else {
    const counts: Record<string, number> = {};
    for (const m of existing) counts[m.category as string] = (counts[m.category as string] ?? 0) + 1;
    console.log('   Categorías:', JSON.stringify(counts));
  }

  // Load system templates
  const { data: sysTpls } = await db
    .from('story_templates')
    .select('id, name')
    .eq('kind', 'system')
    .limit(10);
  const allTemplateIds = (sysTpls ?? []).map((t: Row) => t.id as string);
  console.log(`   Story templates disponibles: ${allTemplateIds.length}`);

  // ── Import handler ──────────────────────────────────────────────────────────
  const { planStoriesHandler } = await import('../src/lib/agents/stories/plan-stories');

  // Load material
  const { data: material } = await db
    .from('brand_material')
    .select('*')
    .eq('brand_id', BRAND_ID)
    .eq('active', true);

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 1: Normal — with material, all 10 system templates
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n══════════════════════════════════════════');
  console.log('TEST 1: 5 historias con material + 10 templates');
  console.log('══════════════════════════════════════════');

  const week1 = uniqueWeekStart(7);        // +7 days to avoid collision
  const planId1 = await createMinimalWeeklyPlan(db, BRAND_ID, week1);
  console.log(`plan_id: ${planId1}  week_start: ${week1}`);

  const rows1 = await planStoriesHandler({
    brand_id:                  BRAND_ID,
    week_id:                   planId1,
    brand,
    brand_material:            material ?? [],
    stories_per_week:          5,
    stories_templates_enabled: allTemplateIds,
  });

  console.log(`planStoriesHandler generó ${rows1.length} filas`);

  if (rows1.length > 0) {
    const { error: insErr } = await db.from('content_ideas').insert(rows1);
    if (insErr) throw new Error(`Insert stories failed: ${insErr.message}`);
  }

  // SQL verification 1
  const { data: v1 } = await db
    .from('content_ideas')
    .select('content_kind, story_type')
    .eq('week_id', planId1);

  const v1Rows = (v1 ?? []) as Row[];
  console.log('\n[SQL-1] content_kind + story_type por plan:');
  const grouped1: Record<string, number> = {};
  for (const r of v1Rows) {
    const key = `${r.content_kind}/${r.story_type ?? 'null'}`;
    grouped1[key] = (grouped1[key] ?? 0) + 1;
  }
  for (const [k, c] of Object.entries(grouped1)) console.log(`  ${k}: ${c}`);

  console.log('\n[COPY_DRAFT examples por tipo]:');
  const byType: Record<string, string[]> = {};
  for (const r of v1Rows) {
    const t = r.story_type as string ?? 'null';
    if (!byType[t]) byType[t] = [];
    if (rows1[v1Rows.indexOf(r)]?.copy_draft) {
      byType[t].push(rows1[v1Rows.indexOf(r)].copy_draft ?? '');
    }
  }
  for (const [type, copies] of Object.entries(byType)) {
    const sample = copies[0]?.slice(0, 80).replace(/\n/g, ' | ') ?? '(vacío)';
    console.log(`  [${type}] "${sample}"`);
  }

  // Verify template rotation
  const templateSet = new Set(rows1.map(r => r.template_id).filter(Boolean));
  console.log(`\n  Templates usados: ${templateSet.size} distintos`);

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 2: Sin material — todas IA-generated quotes
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n══════════════════════════════════════════');
  console.log('TEST 2: 5 historias SIN material (todo AI quotes)');
  console.log('══════════════════════════════════════════');

  const week2 = uniqueWeekStart(14);        // +14 days
  const planId2 = await createMinimalWeeklyPlan(db, BRAND_ID, week2);
  console.log(`plan_id: ${planId2}  week_start: ${week2}`);

  const rows2 = await planStoriesHandler({
    brand_id:                  BRAND_ID,
    week_id:                   planId2,
    brand,
    brand_material:            [],           // empty — forces all AI quotes
    stories_per_week:          5,
    stories_templates_enabled: allTemplateIds,
  });

  console.log(`planStoriesHandler generó ${rows2.length} filas`);

  if (rows2.length > 0) {
    const { error: insErr2 } = await db.from('content_ideas').insert(rows2);
    if (insErr2) throw new Error(`Insert stories (test2) failed: ${insErr2.message}`);
  }

  const { data: v2 } = await db
    .from('content_ideas')
    .select('content_kind, story_type, copy_draft')
    .eq('week_id', planId2);

  const v2Rows = (v2 ?? []) as Row[];
  const allQuotes  = v2Rows.every(r => r.story_type === 'quote');
  const allHaveCopy = v2Rows.every(r => r.copy_draft && (r.copy_draft as string).length > 0);

  console.log(`\n[SQL-2] story_type=quote: ${v2Rows.filter(r => r.story_type === 'quote').length}/${v2Rows.length}`);
  console.log(`  Todas son quote: ${allQuotes ? 'SÍ ✓' : 'NO ✗'}`);
  console.log(`  Todas tienen copy_draft: ${allHaveCopy ? 'SÍ ✓' : 'NO ✗'}`);
  console.log('\n[COPY_DRAFT examples (AI-generated):');
  for (const r of v2Rows.slice(0, 3)) {
    console.log(`  "${(r.copy_draft as string)?.slice(0, 80)}"`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 3: Templates limitados — solo 2, round-robin
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n══════════════════════════════════════════');
  console.log('TEST 3: 5 historias, solo 2 templates enabled');
  console.log('══════════════════════════════════════════');

  const limited2 = allTemplateIds.slice(0, 2);
  console.log(`Templates enabled: [${limited2.join(', ')}]`);

  const week3 = uniqueWeekStart(21);        // +21 days
  const planId3 = await createMinimalWeeklyPlan(db, BRAND_ID, week3);

  const rows3 = await planStoriesHandler({
    brand_id:                  BRAND_ID,
    week_id:                   planId3,
    brand,
    brand_material:            material ?? [],
    stories_per_week:          5,
    stories_templates_enabled: limited2,
  });

  if (rows3.length > 0) {
    const { error: insErr3 } = await db.from('content_ideas').insert(rows3);
    if (insErr3) throw new Error(`Insert stories (test3) failed: ${insErr3.message}`);
  }

  const { data: v3 } = await db
    .from('content_ideas')
    .select('template_id, position')
    .eq('week_id', planId3)
    .order('position');

  const v3Rows = (v3 ?? []) as Row[];
  console.log('\n[SQL-3] template_id por position:');
  for (const r of v3Rows) {
    const tplIdx = limited2.indexOf(r.template_id as string);
    console.log(`  pos ${r.position}: template[${tplIdx}] (${r.template_id})`);
  }

  const usedTemplates = new Set(v3Rows.map(r => r.template_id));
  const onlyExpected  = [...usedTemplates].every(id => limited2.includes(id as string));
  console.log(`\n  Solo usa los 2 templates esperados: ${onlyExpected ? 'SÍ ✓' : 'NO ✗'}`);
  const expectedPattern = rows3.map((_, i) => limited2[i % 2]).join(', ');
  const actualPattern   = v3Rows.map(r => r.template_id).join(', ');
  console.log(`  Patrón esperado: ${expectedPattern}`);
  console.log(`  Patrón real    : ${actualPattern}`);
  console.log(`  Round-robin correcto: ${expectedPattern === actualPattern ? 'SÍ ✓' : 'NO ✗'}`);

  // ── Cleanup ─────────────────────────────────────────────────────────────────
  await deletePlan(db, planId1);
  await deletePlan(db, planId2);
  await deletePlan(db, planId3);
  if (createdMaterialIds.length > 0) {
    await db.from('brand_material').delete().in('id', createdMaterialIds);
  }
  console.log('\n[cleanup] planes y material de prueba eliminados');

  // ── Summary ──────────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════');
  console.log('RESUMEN Sprint 11');
  console.log('══════════════════════════════════════════');
  console.log(`TEST 1 (material + templates): ${rows1.length} historias  — ${Object.entries(grouped1).map(([k,c])=>`${k}:${c}`).join(' ')}`);
  console.log(`TEST 2 (sin material, AI):     ${rows2.length} historias  — todas quote, copy_draft presente: ${allHaveCopy}`);
  console.log(`TEST 3 (2 templates):          ${rows3.length} historias  — round-robin correcto: ${expectedPattern === actualPattern}`);
}

main().catch(err => {
  console.error('\n[FATAL]', err);
  process.exit(1);
});
