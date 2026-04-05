import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

// GET /api/inspiracion/templates
// Public — no auth required. Returns active templates filtered by sector, format, style, tag.
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sector = searchParams.get('sector');
    const format = searchParams.get('format');
    const style  = searchParams.get('style');
    const tag    = searchParams.get('tag');

    const db: DB = createAdminClient();

    let query = db
      .from('inspiration_templates')
      .select('*')
      .eq('is_active', true);

    if (sector) query = query.contains('sectors', [sector]);
    if (format) query = query.eq('format', format);
    if (style)  query = query.contains('styles', [style]);
    if (tag)    query = query.contains('tags', [tag]);

    query = query.order('times_used', { ascending: false });

    const { data: templates, error } = await query;
    if (error) throw error;

    return NextResponse.json({ templates: templates ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
