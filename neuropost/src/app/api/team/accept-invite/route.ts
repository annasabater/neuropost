import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-utils';
import { requireServerUser, createAdminClient } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const user  = await requireServerUser();
    const { token } = await request.json() as { token: string };

    if (!token) return NextResponse.json({ error: 'Token requerido' }, { status: 400 });

    const db = createAdminClient();

    // Find pending invite by token
    const { data: member, error } = await db
      .from('team_members')
      .select('id, brand_id, invited_email, role, status')
      .eq('invite_token', token)
      .eq('status', 'pending')
      .single();

    if (error || !member) {
      return NextResponse.json({ error: 'Invitación no válida o ya utilizada' }, { status: 404 });
    }

    // Accept invite: link user_id and set active
    await db
      .from('team_members')
      .update({ user_id: user.id, status: 'active', invite_token: null })
      .eq('id', member.id);

    return NextResponse.json({ ok: true, brandId: member.brand_id, role: member.role });
  } catch (err) {
    return apiError(err, 'team/accept-invite');
  }
}
