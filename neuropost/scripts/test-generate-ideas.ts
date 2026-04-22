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

import 'dotenv/config';
import { generateIdeasForBrand } from '../src/lib/agents/strategy/generate-ideas';

const brandId = process.argv[2];
const count   = Number(process.argv[3] ?? '3');

if (!brandId) {
  console.error('Usage: npx tsx scripts/test-generate-ideas.ts <brandId> [count]');
  process.exit(1);
}

async function main(): Promise<void> {
  console.log(`\n── brand: ${brandId}  count: ${count}\n`);
  const ideas = await generateIdeasForBrand(brandId, count);

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
