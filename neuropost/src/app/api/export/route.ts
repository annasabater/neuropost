import { NextResponse } from 'next/server';
import { requireServerUser, createServerClient } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

const CSV_HEADERS = ['id', 'caption', 'hashtags', 'platform', 'status', 'created_at', 'published_at', 'ig_post_id', 'fb_post_id'];

function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function postsToCSV(posts: Record<string, unknown>[]): string {
  const rows = [CSV_HEADERS.join(',')];
  for (const post of posts) {
    const row = CSV_HEADERS.map((h) => escapeCSV(post[h]));
    rows.push(row.join(','));
  }
  return rows.join('\n');
}

export async function GET(request: Request) {
  try {
    const user     = await requireServerUser();
    const supabase = await createServerClient() as DB;
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') === 'csv' ? 'csv' : 'json';

    const { data: brand } = await supabase
      .from('brands')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!brand) {
      if (format === 'csv') {
        return new Response(CSV_HEADERS.join(','), {
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': 'attachment; filename="posts.csv"',
          },
        });
      }
      return NextResponse.json({ posts: [], exportedAt: new Date().toISOString() });
    }

    const { data: posts, error } = await supabase
      .from('posts')
      .select('id, caption, hashtags, platform, status, created_at, published_at, ig_post_id, fb_post_id')
      .eq('brand_id', brand.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const rows = (posts ?? []) as Record<string, unknown>[];

    if (format === 'csv') {
      const csv = postsToCSV(rows);
      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="posts.csv"',
        },
      });
    }

    return new Response(JSON.stringify({ posts: rows, exportedAt: new Date().toISOString() }, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': 'attachment; filename="posts.json"',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
