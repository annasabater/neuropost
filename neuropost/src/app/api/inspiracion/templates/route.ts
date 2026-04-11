import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

/**
 * Returns a deterministic, always-resolvable thumbnail URL for a template
 * that doesn't have one stored. We use Picsum (lorem-picsum.io) seeded by the
 * template id so the same template always renders the same picture, and the
 * URL never 404s. Aspect ratio depends on the format (square for image,
 * portrait for reel/video, square for carousel).
 */
function fallbackThumb(id: string, format?: string | null): string {
  const w = format === 'reel' || format === 'video' ? 540 : 600;
  const h = format === 'reel' || format === 'video' ? 960 : 600;
  // Picsum seeded URLs are stable and never 404.
  return `https://picsum.photos/seed/${encodeURIComponent(id)}/${w}/${h}`;
}

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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const enriched = (templates ?? []).map((t: any) => ({
      ...t,
      thumbnail_url: t.thumbnail_url ?? fallbackThumb(t.id, t.format),
    }));

    return NextResponse.json({ templates: enriched });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
