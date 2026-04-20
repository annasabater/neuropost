import { NextResponse } from 'next/server';
import { createAdminClient, createServerClient } from '@/lib/supabase';

export async function GET() {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await (supabase as any).auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const db = createAdminClient();

    // Check if user is in portal_workers
    const { data: portalWorker, error } = await db
      .from('portal_workers')
      .select(`
        id,
        user_id,
        role,
        is_active,
        profiles (
          full_name
        )
      `)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (error || !portalWorker) {
      return NextResponse.json({ error: 'Not a portal worker' }, { status: 403 });
    }

    return NextResponse.json({
      worker: {
        workerId: portalWorker.id,
        userId: portalWorker.user_id,
        role: portalWorker.role,
        name: portalWorker.profiles?.full_name || 'Worker',
      },
    });
  } catch (err) {
    console.error('GET /api/worker/check:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
