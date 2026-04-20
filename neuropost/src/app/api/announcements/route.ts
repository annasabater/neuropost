import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';

export async function GET() {
  try {
    const db = createAdminClient();

    const { data, error } = await db
      .from('announcements')
      .select('*')
      .eq('is_published', true)
      .order('published_at', { ascending: false })
      .limit(10);

    if (error) throw error;

    return NextResponse.json({ announcements: data ?? [] });
  } catch (err) {
    console.error('[GET /api/announcements]', err);
    return NextResponse.json({ error: 'Error fetching announcements' }, { status: 500 });
  }
}
