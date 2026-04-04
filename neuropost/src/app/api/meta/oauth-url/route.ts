// Kept for backward compatibility — delegates to /api/meta/auth-url logic
import { NextResponse } from 'next/server';
import { requireServerUser, createServerClient } from '@/lib/supabase';
import { getOAuthUrl, signMetaState } from '@/lib/meta';
import { requirePermission } from '@/lib/rbac';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export async function GET() {
  try {
    const user     = await requireServerUser();
    const supabase = await createServerClient() as DB;

    // Need to get brand first to check permission
    const { data: brand } = await supabase.from('brands').select('id').eq('user_id', user.id).single();
    if (brand) {
      const permErr = await requirePermission(user.id, brand.id, 'connect_social');
      if (permErr) return permErr;
    }

    const state = await signMetaState(user.id);
    const url   = getOAuthUrl(state);
    return NextResponse.json({ url });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
