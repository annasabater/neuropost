import { NextResponse } from 'next/server';
import { requireServerUser, createAdminClient } from '@/lib/supabase';

// Returns unique tag strings from the bank to power client-side fuzzy search.
// Cached aggressively — tags change rarely.
export async function GET() {
  try {
    await requireServerUser();
    const db = createAdminClient();

    const { data, error } = await db
      .from('inspiration_unified')
      .select('tags, category, mood')
      .eq('source', 'bank')
      .not('tags', 'is', null)
      .limit(500);

    if (error) throw error;

    const vocab = new Set<string>();
    for (const row of data ?? []) {
      for (const t of row.tags ?? []) if (t) vocab.add(String(t).toLowerCase());
      if (row.category) vocab.add(String(row.category).toLowerCase());
      if (row.mood)     vocab.add(String(row.mood).toLowerCase());
    }

    return NextResponse.json(
      { tags: Array.from(vocab).sort() },
      { headers: { 'Cache-Control': 'public, max-age=3600' } },
    );
  } catch {
    return NextResponse.json({ tags: [] });
  }
}
