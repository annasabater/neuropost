import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';

export async function GET(request: Request) {
  try {
    const db = createAdminClient();
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') ?? '1');
    const limit = 10;
    const offset = (page - 1) * limit;

    const { data: entries, count } = await db
      .from('changelog_entries')
      .select('*', { count: 'exact' })
      .eq('is_published', true)
      .order('published_at', { ascending: false })
      .range(offset, offset + limit - 1);

    return NextResponse.json({ entries: entries ?? [], total: count ?? 0, page, limit });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
