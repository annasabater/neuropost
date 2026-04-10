import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createAdminClient, createServerClient } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getCurrentAdmin(): Promise<{ user: any; db: ReturnType<typeof createAdminClient> } | Response> {
  const supabase = await createServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: { user } } = await (supabase as any).auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const db = createAdminClient();
  const { data: me } = await db
    .from('workers')
    .select('id, role, is_active')
    .eq('id', user.id)
    .eq('is_active', true)
    .single();

  if (!me || me.role !== 'admin') {
    return NextResponse.json({ error: 'Solo un admin puede gestionar el equipo' }, { status: 403 });
  }

  return { user, db };
}

async function activeAdminCount(db: ReturnType<typeof createAdminClient>): Promise<number> {
  const { count } = await db
    .from('workers')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true)
    .eq('role', 'admin');
  return count ?? 0;
}

// PATCH /api/worker/team/[workerId] — toggle is_active o cambiar rol
export async function PATCH(
  _req: NextRequest,
  ctx: { params: Promise<{ workerId: string }> },
) {
  try {
    const auth = await getCurrentAdmin();
    if (auth instanceof Response) return auth;
    const { user, db } = auth;

    const { workerId } = await ctx.params;
    const body = await _req.json().catch(() => ({}));
    const update: Record<string, unknown> = {};

    if (typeof body.is_active === 'boolean') update.is_active = body.is_active;
    if (typeof body.role === 'string' && ['worker', 'senior', 'admin'].includes(body.role)) {
      update.role = body.role;
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 });
    }

    // No puedes modificarte a ti mismo (evita auto-desactivación / auto-degradación)
    if (workerId === user.id) {
      return NextResponse.json(
        { error: 'No puedes modificarte a ti mismo desde aquí' },
        { status: 400 },
      );
    }

    // Protección: último admin no se puede degradar ni desactivar
    const { data: target } = await db
      .from('workers')
      .select('id, role, is_active')
      .eq('id', workerId)
      .single();

    if (!target) return NextResponse.json({ error: 'Trabajador no encontrado' }, { status: 404 });

    const willRemoveAdmin =
      (target.is_active && target.role === 'admin') &&
      (update.is_active === false || (update.role && update.role !== 'admin'));

    if (willRemoveAdmin) {
      const admins = await activeAdminCount(db);
      if (admins <= 1) {
        return NextResponse.json(
          { error: 'No puedes quitar el último admin activo' },
          { status: 400 },
        );
      }
    }

    const { data: updated, error } = await db
      .from('workers')
      .update(update)
      .eq('id', workerId)
      .select('id, email, full_name, role, is_active, joined_at, added_by')
      .single();

    if (error) throw error;
    return NextResponse.json({ worker: updated });
  } catch (err) {
    console.error('[PATCH /api/worker/team/:id]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// DELETE /api/worker/team/[workerId] — soft delete (is_active=false)
export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ workerId: string }> },
) {
  try {
    const auth = await getCurrentAdmin();
    if (auth instanceof Response) return auth;
    const { user, db } = auth;

    const { workerId } = await ctx.params;

    if (workerId === user.id) {
      return NextResponse.json(
        { error: 'No puedes eliminarte a ti mismo del equipo' },
        { status: 400 },
      );
    }

    const { data: target } = await db
      .from('workers')
      .select('id, role, is_active')
      .eq('id', workerId)
      .single();

    if (!target) return NextResponse.json({ error: 'Trabajador no encontrado' }, { status: 404 });

    if (target.is_active && target.role === 'admin') {
      const admins = await activeAdminCount(db);
      if (admins <= 1) {
        return NextResponse.json(
          { error: 'No puedes eliminar el último admin activo' },
          { status: 400 },
        );
      }
    }

    const { error } = await db
      .from('workers')
      .update({ is_active: false })
      .eq('id', workerId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/worker/team/:id]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
