import { NextResponse } from 'next/server';
import { requireServerUser, createServerClient } from '@/lib/supabase';
import { requirePermission } from '@/lib/rbac';
import type { TeamRole } from '@/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export async function GET() {
  try {
    const user     = await requireServerUser();
    const supabase = await createServerClient() as DB;

    const { data: brand } = await supabase
      .from('brands').select('id').eq('user_id', user.id).single();

    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    const { data: members } = await supabase
      .from('team_members')
      .select('*')
      .eq('brand_id', brand.id)
      .order('created_at', { ascending: false });

    return NextResponse.json({ members: members ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user     = await requireServerUser();
    const { email, role } = await request.json() as { email: string; role: TeamRole };
    const supabase = await createServerClient() as DB;

    if (!email || !role) return NextResponse.json({ error: 'email y role son requeridos' }, { status: 400 });

    const { data: brand } = await supabase
      .from('brands').select('id,name,plan').eq('user_id', user.id).single();

    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    const permErr = await requirePermission(user.id, brand.id, 'manage_team');
    if (permErr) return permErr;

    // Check plan allows team members (pro+)
    if (brand.plan === 'starter') {
      return NextResponse.json(
        { error: 'El plan Starter no incluye gestión de equipo. Actualiza a Pro.' },
        { status: 403 },
      );
    }

    // Generate secure invite token
    const inviteToken = crypto.randomUUID();
    const appUrl      = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

    const { data: member, error: insertErr } = await supabase
      .from('team_members')
      .insert({
        brand_id:      brand.id,
        invited_email: email,
        role,
        status:        'pending',
        invite_token:  inviteToken,
      })
      .select()
      .single();

    if (insertErr) throw insertErr;

    // Get inviter's name
    const { data: profile } = await supabase
      .from('profiles').select('full_name').eq('id', user.id).single();

    const inviterName = profile?.full_name ?? 'Un miembro del equipo';
    const inviteUrl   = `${appUrl}/accept-invite?token=${inviteToken}`;

    // Send invite email
    try {
      const { sendTeamInviteEmail } = await import('@/lib/email');
      await sendTeamInviteEmail(email, inviterName, brand.name, role, inviteUrl);
    } catch { /* non-blocking */ }

    return NextResponse.json({ member });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user     = await requireServerUser();
    const { memberId } = await request.json() as { memberId: string };
    const supabase = await createServerClient() as DB;

    const { data: brand } = await supabase
      .from('brands').select('id').eq('user_id', user.id).single();

    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    await supabase
      .from('team_members')
      .delete()
      .eq('id', memberId)
      .eq('brand_id', brand.id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
