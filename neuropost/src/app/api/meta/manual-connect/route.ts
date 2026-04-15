import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-utils';
import { requireServerUser, createServerClient } from '@/lib/supabase';
import { getFacebookPages, getIGAccountFromPage } from '@/lib/meta';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

/**
 * Manual connection: user provides a long-lived access token from
 * https://developers.facebook.com/tools/explorer/
 *
 * We use it to discover their FB pages and IG business accounts,
 * then store everything in the brands table — same as the OAuth flow.
 */
export async function POST(request: Request) {
  try {
    const user     = await requireServerUser();
    const supabase = await createServerClient() as DB;
    const { accessToken } = await request.json();

    if (!accessToken?.trim()) {
      return NextResponse.json({ error: 'Introduce un access token válido' }, { status: 400 });
    }

    const token = accessToken.trim();

    // Get user's brand
    const { data: brand } = await supabase
      .from('brands')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!brand) {
      return NextResponse.json({ error: 'Brand no encontrada' }, { status: 404 });
    }

    // Discover Facebook Pages using the token
    let pages;
    try {
      pages = await getFacebookPages(token);
    } catch {
      return NextResponse.json({
        error: 'Token inválido o sin permisos. Asegúrate de tener los permisos: pages_show_list, instagram_basic, instagram_content_publish',
      }, { status: 400 });
    }

    if (!pages || pages.length === 0) {
      return NextResponse.json({
        error: 'No se encontraron páginas de Facebook. Necesitas una página vinculada a tu cuenta de Instagram Business.',
      }, { status: 400 });
    }

    // Take first page and discover IG account
    const page = pages[0];
    let igAccount = null;
    try {
      igAccount = await getIGAccountFromPage(page.id, page.access_token);
    } catch {
      // IG account might not exist, that's ok
    }

    // Calculate expiry (long-lived tokens last ~60 days)
    const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();

    // Save to brand
    const updateData: Record<string, unknown> = {
      fb_page_id:            page.id,
      fb_page_name:          page.name,
      fb_access_token:       page.access_token,
      meta_token_expires_at: expiresAt,
      token_refreshed_at:    new Date().toISOString(),
    };

    if (igAccount) {
      updateData.ig_account_id   = igAccount.id;
      updateData.ig_username     = igAccount.username ?? null;
      updateData.ig_access_token = page.access_token;
    }

    await supabase
      .from('brands')
      .update(updateData)
      .eq('id', brand.id);

    return NextResponse.json({
      ok: true,
      facebook: { pageId: page.id, pageName: page.name },
      instagram: igAccount ? { accountId: igAccount.id, username: igAccount.username } : null,
    });
  } catch (err) {
    return apiError(err, 'meta/manual-connect');
  }
}
