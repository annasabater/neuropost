import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-utils';
import { requireServerUser, createServerClient } from '@/lib/supabase';

// Called on every dashboard page load to track last_login_at
export async function PATCH() {
  try {
    const user = await requireServerUser();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = await createServerClient() as any;

    await supabase
      .from('brands')
      .update({ last_login_at: new Date().toISOString() })
      .eq('user_id', user.id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err, 'brands/activity');
  }
}
