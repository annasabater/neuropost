import { NextResponse } from 'next/server';
import {
  exchangeCodeForToken,
  getLongLivedToken,
  getFacebookPages,
  getIGAccountFromPage,
  verifyMetaState,
} from '@/lib/meta';
import { createAdminClient } from '@/lib/supabase';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code  = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  if (error || !code || !state) {
    return NextResponse.redirect(new URL('/settings?meta_error=denied', origin));
  }

  let userId: string;
  try {
    userId = await verifyMetaState(state);
  } catch {
    return NextResponse.redirect(new URL('/settings?meta_error=invalid_state', origin));
  }

  try {
    // 1 — Exchange code → short-lived token
    const short = await exchangeCodeForToken(code);

    // 2 — Exchange short → long-lived user token (60 days)
    const long  = await getLongLivedToken(short.accessToken);
    const expiresAt = new Date(Date.now() + long.expiresIn * 1000).toISOString();

    // 3 — Discover Facebook pages the user manages
    const pages = await getFacebookPages(long.accessToken);
    if (pages.length === 0) {
      return NextResponse.redirect(new URL('/settings?meta_error=no_pages', origin));
    }

    // Use the first page (most users have one)
    const page = pages[0];

    // 4 — Discover the IG Business Account linked to that page
    const igAccount = await getIGAccountFromPage(page.id, page.access_token);

    // 5 — Save to brands (service role bypasses RLS)
    const supabase = createAdminClient();

    const update: Record<string, string | null> = {
      fb_page_id:            page.id,
      fb_page_name:          page.name,
      fb_access_token:       page.access_token,
      meta_token_expires_at: expiresAt,
    };

    if (igAccount) {
      update.ig_account_id  = igAccount.id;
      update.ig_username    = igAccount.username ?? null;
      update.ig_access_token = page.access_token; // page token works for IG Business
    }

    await supabase
      .from('brands')
      .update(update)
      .eq('user_id', userId);

    // 6 — Activity log
    await supabase.from('activity_log').insert({
      brand_id:    (await supabase.from('brands').select('id').eq('user_id', userId).single()).data?.id,
      user_id:     userId,
      action:      'meta_connected',
      entity_type: 'brand',
      details:     { fb_page_id: page.id, ig_account_id: igAccount?.id },
    });

    // 7 — Notification
    const { data: brand } = await supabase.from('brands').select('id').eq('user_id', userId).single();
    if (brand?.id) {
      await supabase.from('notifications').insert({
        brand_id: brand.id,
        type:     'meta_connected',
        message:  igAccount
          ? `Instagram @${igAccount.username ?? igAccount.id} conectado correctamente.`
          : `Facebook "${page.name}" conectado correctamente.`,
        read:     false,
      });
    }

    return NextResponse.redirect(new URL('/settings?meta_connected=1', origin));
  } catch (err) {
    console.error('Meta OAuth callback error:', err);
    return NextResponse.redirect(new URL('/settings?meta_error=1', origin));
  }
}
