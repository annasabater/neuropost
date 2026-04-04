import { NextResponse } from 'next/server';
import { requireSuperAdmin, adminErrorResponse } from '@/lib/admin';
import { createAdminClient } from '@/lib/supabase';

export async function GET() {
  try {
    await requireSuperAdmin();
    const db = createAdminClient();

    const { data, error } = await db
      .from('brands')
      .select('id,name,sector,plan,churn_score,churn_risk,last_login_at,last_post_published_at,rejected_in_a_row')
      .order('churn_score', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ brands: data ?? [] });
  } catch (err) {
    const { error, status } = adminErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}
