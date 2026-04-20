import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-utils';
import { createAdminClient, createServerClient } from '@/lib/supabase';

// GET /api/worker/team — lista workers (activos + inactivos)
export async function GET() {
  try {
    const supabase = await createServerClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: { user } } = await (supabase as any).auth.getUser();
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const db = createAdminClient();

    // Solo un worker activo puede ver el equipo
    const { data: me } = await db
      .from('workers')
      .select('id, role, is_active')
      .eq('id', user.id)
      .eq('is_active', true)
      .single();

    if (!me) return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });

    const { data: rows } = await db
      .from('workers')
      .select('id, email, full_name, role, is_active, joined_at, added_by')
      .order('joined_at', { ascending: false });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const workers = (rows ?? []).map((w: any) => ({
      id: w.id,
      email: w.email,
      name: w.full_name ?? null,
      role: w.role,
      is_active: w.is_active,
      joined_at: w.joined_at,
      added_by: w.added_by,
      is_me: w.id === user.id,
    }));

    return NextResponse.json({ workers, currentWorkerId: user.id });
  } catch (err) {
    console.error('[GET /api/worker/team]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// POST /api/worker/team — añade un worker (por email) al equipo
export async function POST(request: Request) {
  try {
    const supabase = await createServerClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: { user } } = await (supabase as any).auth.getUser();
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const db = createAdminClient();

    // Solo admins activos pueden añadir
    const { data: me } = await db
      .from('workers')
      .select('role, is_active')
      .eq('id', user.id)
      .eq('is_active', true)
      .single();

    if (!me || me.role !== 'admin') {
      return NextResponse.json({ error: 'Solo un admin puede añadir trabajadores' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const email = (body.email as string | undefined)?.trim().toLowerCase();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Email no válido' }, { status: 400 });
    }

    // Busca en auth.users
    const { data: authList, error: authErr } = await db.auth.admin.listUsers();
    if (authErr) throw authErr;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const target = authList.users.find((u: any) => (u.email ?? '').toLowerCase() === email);

    if (!target) {
      return NextResponse.json(
        { error: 'Ese email no está registrado. Dile que se registre primero en /signup y vuelve a añadirlo.' },
        { status: 404 },
      );
    }

    // Si ya existe en workers, reactivamos
    const { data: existing } = await db
      .from('workers')
      .select('id, is_active')
      .eq('id', target.id)
      .maybeSingle();

    if (existing) {
      if (existing.is_active) {
        return NextResponse.json({ error: 'Ese trabajador ya está en el equipo' }, { status: 409 });
      }
      const { data: updated, error: updErr } = await db
        .from('workers')
        .update({ is_active: true, role: 'admin', added_by: user.id })
        .eq('id', target.id)
        .select()
        .single();
      if (updErr) throw updErr;
      return NextResponse.json({ worker: updated, reactivated: true }, { status: 200 });
    }

    const { data: inserted, error: insErr } = await db
      .from('workers')
      .insert({
        id: target.id,
        email: target.email ?? email,
        full_name: (target.user_metadata?.full_name as string | undefined) ?? null,
        role: 'admin',
        is_active: true,
        added_by: user.id,
      })
      .select()
      .single();

    if (insErr) throw insErr;

    return NextResponse.json({ worker: inserted }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/worker/team]', err);
    return apiError(err, 'worker/team');
  }
}
