import { NextResponse } from 'next/server';
import {
  exchangeInstagramCode,
  getInstagramLongLivedToken,
  getInstagramProfile,
  verifyMetaState,
} from '@/lib/meta';
import { createAdminClient } from '@/lib/supabase';
import { upsertConnection } from '@/lib/platforms';
import { canConnectPlatform, overQuotaRedirect } from '@/lib/social-quota';

/**
 * GET /api/meta/instagram-callback
 *
 * Callback de Instagram Login (flujo sin Facebook).
 * Meta redirige aquí después de que el usuario autoriza la app.
 *
 * Flow:
 *   1. Verificar state (HMAC-SHA256, caducidad 30 min)
 *   2. Intercambiar code → token corto
 *   3. Intercambiar token corto → token largo (60 días)
 *   4. Obtener perfil de Instagram (id, username)
 *   5. Guardar en brands (ig_access_token, ig_account_id, ig_username)
 *   6. Redirigir a /settings/connections?meta_connected=1
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code  = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  if (error || !code || !state) {
    console.warn('[instagram-callback] denied or missing params', { error, hasCode: !!code });
    return NextResponse.redirect(new URL('/settings/connections?meta_error=denied', origin));
  }

  let userId: string;
  try {
    const verified = await verifyMetaState(state);
    userId = verified.userId;
  } catch (err) {
    console.warn('[instagram-callback] invalid state', err);
    return NextResponse.redirect(new URL('/settings/connections?meta_error=invalid_state', origin));
  }

  try {
    // 1 — code → short-lived token
    const { accessToken: shortToken } = await exchangeInstagramCode(code);

    // 2 — short-lived → long-lived (60 días)
    const { accessToken: longToken, expiresIn } = await getInstagramLongLivedToken(shortToken);
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    // 3 — Perfil de Instagram
    const profile = await getInstagramProfile(longToken);

    // 4 — Resolve brand + enforce social-account quota
    const supabase = createAdminClient();
    const { data: brandRow } = await supabase
      .from('brands')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (!brandRow?.id) {
      return NextResponse.redirect(new URL('/settings/connections?meta_error=no_brand', origin));
    }

    const decision = await canConnectPlatform(brandRow.id, 'instagram');
    if (!decision.allowed) {
      console.warn('[instagram-callback] quota blocked', { userId, reason: decision.reason });
      return NextResponse.redirect(
        overQuotaRedirect(origin, 'instagram', decision.quota).toString(),
      );
    }

    // 5 — Persist token on legacy brand columns + canonical platform_connections
    await supabase
      .from('brands')
      .update({
        ig_account_id:         profile.id,
        ig_username:           profile.username ?? null,
        ig_access_token:       longToken,
        meta_token_expires_at: expiresAt,
      })
      .eq('user_id', userId);

    await upsertConnection({
      brandId:          brandRow.id,
      platform:         'instagram',
      platformUserId:   profile.id,
      platformUsername: profile.username ?? null,
      accessToken:      longToken,
      refreshToken:     null,
      expiresAt:        new Date(expiresAt),
      refreshExpiresAt: null,
      status:           'active',
      metadata:         { source: 'instagram-callback', flow: 'instagram_login' },
    });

    // 5 — Activity log
    if (brandRow?.id) {
      await supabase.from('activity_log').insert({
        brand_id:    brandRow.id,
        user_id:     userId,
        action:      'meta_connected',
        entity_type: 'brand',
        details:     { ig_account_id: profile.id, method: 'instagram_login' },
      });

      await supabase.from('notifications').insert({
        brand_id: brandRow.id,
        type:     'meta_connected',
        message:  profile.username
          ? `Instagram @${profile.username} conectado correctamente.`
          : `Cuenta de Instagram conectada correctamente.`,
        read: false,
      });
    }

    console.info('[instagram-callback] connected', { userId, igId: profile.id, username: profile.username });
    return NextResponse.redirect(new URL('/settings/connections?meta_connected=1', origin));
  } catch (err) {
    console.error('[instagram-callback] error', err);
    return NextResponse.redirect(new URL('/settings/connections?meta_error=1', origin));
  }
}
