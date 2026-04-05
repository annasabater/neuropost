import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';

export async function GET() {
  try {
    const db = createAdminClient();
    const { data: entry } = await db
      .from('changelog_entries')
      .select('id, version, title, summary, published_at')
      .eq('is_published', true)
      .order('published_at', { ascending: false })
      .limit(1)
      .single();
    return NextResponse.json({ entry: entry ?? null });
  } catch {
    return NextResponse.json({ entry: null });
  }
}
