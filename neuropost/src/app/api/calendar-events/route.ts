import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-utils';
import { requireServerUser, createServerClient } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

/**
 * GET /api/calendar-events?year=2026&month=4
 * Returns calendar events for the current brand, optionally filtered by year/month.
 */
export async function GET(request: Request) {
  try {
    const user     = await requireServerUser();
    const supabase = await createServerClient() as DB;

    const url   = new URL(request.url);
    const year  = url.searchParams.get('year')  ? Number(url.searchParams.get('year'))  : null;
    const month = url.searchParams.get('month') ? Number(url.searchParams.get('month')) : null;

    const { data: brand } = await supabase
      .from('brands')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!brand) return NextResponse.json({ events: [] });

    let query = supabase
      .from('calendar_events')
      .select('id, title, date, type, relevance, description, suggested_content_idea')
      .eq('brand_id', brand.id)
      .order('date', { ascending: true });

    if (year) {
      query = query.eq('year', year);
    }
    if (year && month) {
      const from = `${year}-${String(month).padStart(2, '0')}-01`;
      const to   = `${year}-${String(month).padStart(2, '0')}-31`;
      query = query.gte('date', from).lte('date', to);
    }

    const { data: events, error } = await query;
    if (error) throw error;

    return NextResponse.json({ events: events ?? [] });
  } catch (err) {
    return apiError(err, 'calendar-events');
  }
}
