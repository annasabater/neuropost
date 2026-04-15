import { NextResponse } from 'next/server';
import { requireServerUser, createServerClient } from '@/lib/supabase';
import type { Brand } from '@/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export async function GET() {
  try {
    const user     = await requireServerUser();
    const supabase = await createServerClient() as DB;

    const { data: brand } = await supabase
      .from('brands')
      .select('ig_account_id,ig_username,meta_token_expires_at,token_refreshed_at,ig_access_token')
      .eq('user_id', user.id)
      .single();

    if (!brand) return NextResponse.json({ instagram: null });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const b = brand as Pick<Brand, 'ig_account_id' | 'ig_username' | 'meta_token_expires_at'> & { token_refreshed_at?: string | null };

    const tokenExpiresAt = b.meta_token_expires_at ? new Date(b.meta_token_expires_at) : null;
    const daysLeft       = tokenExpiresAt ? Math.floor((tokenExpiresAt.getTime() - Date.now()) / 86_400_000) : null;
    const tokenStatus    = daysLeft === null ? 'missing' : daysLeft <= 0 ? 'expired' : daysLeft <= 7 ? 'expiring_soon' : 'ok';
    const tokenRefreshedAt = b.token_refreshed_at ?? null;

    // TODO [FASE 2]: Facebook — add facebook: b.fb_page_id ? { ... } : null
    return NextResponse.json({
      instagram: b.ig_account_id
        ? {
            accountId:       b.ig_account_id,
            username:        b.ig_username ?? null,
            tokenStatus,
            daysLeft,
            expiresAt:       b.meta_token_expires_at,
            tokenRefreshedAt,
          }
        : null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const user     = await requireServerUser();
    const supabase = await createServerClient() as DB;

    await supabase
      .from('brands')
      .update({
        ig_account_id:         null,
        ig_username:           null,
        ig_access_token:       null,
        fb_page_id:            null,
        fb_page_name:          null,
        fb_access_token:       null,
        meta_token_expires_at: null,
      })
      .eq('user_id', user.id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
