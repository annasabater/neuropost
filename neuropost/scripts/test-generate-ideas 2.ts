// npx tsx scripts/test-generate-ideas.ts <brandId> [count]
//
// End-to-end smoke test for strategy:generate_ideas.
//
// Steps:
//   1. Invokes generateIdeasForBrand(brandId, count)
//   2. Verifies every idea has a non-null copy_draft in [60..600] chars
//   3. Verifies every idea has 3..10 hashtags, each a valid 2..30-char string
//   4. Prints a per-idea summary table
//
// Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY +
// ANTHROPIC_API_KEY in the environment (.env.local).

import { readFileSync, existsSync } from 'node:fs';
import { resolve }                  from 'node:path';

// ─── Load .env.local manually (mirrors other scripts in this folder) ─────────
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
loadEnvLocal();

const brandId = process.argv[2];
const count   = Number(process.argv[3] ?? '3');

if (!brandId) {
  console.error('Usage: npx tsx scripts/test-generate-ideas.ts <brandId> [count]');
  process.exit(1);
}

async function main(): Promise<void> {
  // Dynamic import so env vars (ANTHROPIC_API_KEY, SUPABASE_*) are loaded
  // before the module instantiates its top-level `new Anthropic()` client.
  const { generateIdeasForBrand } = await import('../src/lib/agents/strategy/generate-ideas');
  console.log(`\n── brand: ${brandId}  count: ${count}\n`);
  const { ideas, tokensIn, tokensOut } = await generateIdeasForBrand(brandId, count);
  console.log(`  tokens: ${tokensIn} in / ${tokensOut} out  cost: $${((tokensIn * 0.0000008) + (tokensOut * 0.000004)).toFixed(6)}\n`);

  let passed = 0, failed = 0;
  for (const [i, idea] of ideas.entries()) {
    const copy = (idea.copy_draft ?? '').trim();
    const tags = Array.isArray(idea.hashtags) ? idea.hashtags : [];

    const copyOk = copy.length >= 60 && copy.length <= 600;
    const tagsOk = tags.length >= 3 && tags.length <= 10
      && tags.every((t) => typeof t === 'string' && t.length >= 2 && t.length <= 30);

    const ok = copyOk && tagsOk;
    if (ok) passed++; else failed++;

    console.log(`Idea ${i + 1}: ${ok ? '\u2713' : '\u2717'}  "${idea.title}"`);
    console.log(`  format=${idea.format}  priority=${idea.priority}  category=${idea.category_key}`);
    console.log(`  copy_draft (${copy.length} chars): ${copy.slice(0, 120)}${copy.length > 120 ? '\u2026' : ''}`);
    console.log(`  hashtags (${tags.length}): ${tags.map((t) => '#' + t).join(' ')}`);
    if (!copyOk) console.error(`    \u2717 copy length ${copy.length} out of [60..600]`);
    if (!tagsOk) console.error(`    \u2717 hashtags invalid (${tags.length} items)`);
    console.log('');
  }

  console.log(`${passed}/${ideas.length} passed${failed ? `, ${failed} failed` : ''}`);
  process.exit(failed ? 1 : 0);
}

void main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
