import { NextResponse } from 'next/server';
import { requireSuperAdmin, adminErrorResponse } from '@/lib/admin';
import { createAdminClient } from '@/lib/supabase';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user   = await requireSuperAdmin();
    const { id } = await params;
    const db     = createAdminClient();

    const now = new Date().toISOString();

    await db.from('prospects').update({
      status:        'converted',
      last_activity: now,
      updated_at:    now,
    }).eq('id', id);

    await db.from('prospect_interactions').insert({
      prospect_id: id,
      type:        'status_changed',
      content:     '✅ Convertido en cliente',
      metadata:    { changed_by: user.id },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const { error, status } = adminErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}
