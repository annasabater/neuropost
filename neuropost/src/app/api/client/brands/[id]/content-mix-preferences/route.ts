import { NextResponse }                              from 'next/server';
import { requireServerUser, createAdminClient }     from '@/lib/supabase';
import { apiError }                                 from '@/lib/api-utils';
import { validateContentMix, type ContentMixPreferences } from '@/lib/content-mix-validator';
import type { SubscriptionPlan }                    from '@/types';
import type { PlanKey }                             from '@/lib/plan-limits';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user     = await requireServerUser();
    const { id }   = await params;
    const db       = createAdminClient() as DB;
    const body     = await req.json() as ContentMixPreferences;

    // Ownership check — brand must belong to this user
    const { data: brand } = await db
      .from('brands')
      .select('id, plan, user_id')
      .eq('id', id)
      .single();

    if (!brand)               return NextResponse.json({ error: 'Marca no encontrada' }, { status: 404 });
    if (brand.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' },      { status: 403 });

    const plan = (brand.plan ?? 'starter') as SubscriptionPlan;

    // Validate proposed mix against plan quotas
    const result = validateContentMix(plan as PlanKey, body);
    if (!result.valid) {
      return NextResponse.json({ error: 'Mix inválido', errors: result.errors }, { status: 400 });
    }

    // Persist — Sprint 7 pattern: .select().maybeSingle() + throw on 0 rows
    const { data: updated, error: updateErr } = await db
      .from('brands')
      .update({ content_mix_preferences: body })
      .eq('id', id)
      .select('id, content_mix_preferences')
      .maybeSingle();

    if (updateErr) throw updateErr;
    if (!updated) {
      console.error('[content-mix-preferences] UPDATE devolvió 0 filas — posible bloqueo RLS');
      throw new Error('No se pudieron guardar las preferencias');
    }

    return NextResponse.json({ ok: true, content_mix_preferences: updated.content_mix_preferences });
  } catch (err) {
    return apiError(err, 'POST /api/client/brands/[id]/content-mix-preferences');
  }
}
