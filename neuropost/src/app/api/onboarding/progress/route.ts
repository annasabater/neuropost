import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-utils';
import { requireServerUser, createAdminClient } from '@/lib/supabase';

export async function GET() {
  try {
    const user = await requireServerUser();
    const db = createAdminClient();

    const { data: brand } = await db.from('brands').select('id').eq('user_id', user.id).single();
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    let { data: progress } = await db
      .from('onboarding_progress')
      .select('*')
      .eq('brand_id', brand.id)
      .single();

    if (!progress) {
      const { data: created } = await db.from('onboarding_progress').insert({ brand_id: brand.id }).select().single();
      progress = created;
    }

    return NextResponse.json({ progress });
  } catch (err) {
    return apiError(err, 'onboarding/progress');
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireServerUser();
    const db = createAdminClient();
    const { step, completed: markCompleted } = await request.json();

    const { data: brand } = await db.from('brands').select('id').eq('user_id', user.id).single();
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    let { data: progress } = await db
      .from('onboarding_progress')
      .select('*')
      .eq('brand_id', brand.id)
      .single();

    if (!progress) {
      const { data: created } = await db.from('onboarding_progress').insert({ brand_id: brand.id }).select().single();
      progress = created;
    }

    const steps = progress?.steps_completed ?? [];
    if (step && !steps.includes(step)) steps.push(step);

    const updates: Record<string, unknown> = { steps_completed: steps };
    if (markCompleted) {
      updates.completed = true;
      updates.completed_at = new Date().toISOString();
    }

    const { data: updated, error } = await db
      .from('onboarding_progress')
      .update(updates)
      .eq('brand_id', brand.id)
      .select()
      .single();
    if (error) throw error;

    return NextResponse.json({ progress: updated });
  } catch (err) {
    return apiError(err, 'onboarding/progress');
  }
}
