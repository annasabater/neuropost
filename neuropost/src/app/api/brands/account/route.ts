import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-utils';
import { requireServerUser, createAdminClient, createServerClient } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

/**
 * DELETE /api/brands/account
 * Deletes the brand and permanently removes the user's auth account.
 * Uses the admin (service-role) client to bypass RLS for the auth deletion.
 */
export async function DELETE() {
  try {
    const user = await requireServerUser();

    // 1. Delete the brand row (cascade will handle related rows if configured)
    const supabase = await createServerClient() as DB;
    const { error: brandError } = await supabase
      .from('brands')
      .delete()
      .eq('user_id', user.id);

    if (brandError) throw brandError;

    // 2. Sign the user out of all sessions before deletion
    await supabase.auth.signOut();

    // 3. Delete the auth user via admin client (requires service role)
    const admin = createAdminClient();
    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) throw deleteError;

    return NextResponse.json({ success: true });
  } catch (err) {
    if (message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    return apiError(err, 'brands/account');
  }
}
