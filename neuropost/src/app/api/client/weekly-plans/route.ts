import { NextResponse }      from 'next/server';
import { requireServerUser } from '@/lib/supabase';
import { createAdminClient } from '@/lib/supabase';
import { apiError }          from '@/lib/api-utils';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export async function GET() {
  try {
    const user = await requireServerUser();
    const db = createAdminClient() as DB;

    // Resolve the user's brand
    const { data: brand } = await db
      .from('brands')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!brand) return NextResponse.json({ plans: [] });

    const { data: plans, error } = await db
      .from('weekly_plans')
      .select('id, week_start, status, created_at, client_approved_at, sent_to_client_at')
      .eq('brand_id', brand.id)
      .order('week_start', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ plans: plans ?? [] });
  } catch (err) {
    return apiError(err, 'GET /api/client/weekly-plans');
  }
}
