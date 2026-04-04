import { NextResponse } from 'next/server';
import { requireSuperAdmin, adminErrorResponse } from '@/lib/admin';
import { createAdminClient } from '@/lib/supabase';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireSuperAdmin();
    const { id } = await params;
    const db     = createAdminClient();

    const { data, error } = await db
      .from('churn_actions')
      .select('*')
      .eq('brand_id', id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;

    return NextResponse.json({ actions: data ?? [] });
  } catch (err) {
    const { error, status } = adminErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireSuperAdmin();
    const { id }     = await params;
    const { actionId, result } = await request.json() as { actionId: string; result: string };
    const db = createAdminClient();

    await db.from('churn_actions').update({
      result,
      resolved_at: new Date().toISOString(),
    }).eq('id', actionId).eq('brand_id', id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    const { error, status } = adminErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}
