// GET /api/tiktok/callback
// Handles TikTok OAuth callback — exchanges code for tokens and saves to brand.

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { verifyTikTokState, exchangeTikTokCode, getTikTokUserInfo } from '@/lib/tiktok';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const { searchParams, origin } = url;
  const code  = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  if (error || !code || !state) {
    return NextResponse.redirect(new URL('/settings/connections?tiktok_error=denied', origin));
  }

  let userId: string;
  try {
    const verified = await verifyTikTokState(state);
    userId = verified.userId;
  } catch {
    return NextResponse.redirect(new URL('/settings/connections?tiktok_error=invalid_state', origin));
  }

  try {
    // 1 — Exchange code for tokens
    const tokens = await exchangeTikTokCode(code);
    const expiresAt = new Date(Date.now() + tokens.expiresIn * 1000).toISOString();

    // 2 — Fetch user info (username)
    const userInfo = await getTikTokUserInfo(tokens.accessToken, tokens.openId);

    // 3 — Save to brand
    const supabase = createAdminClient();
    await supabase
      .from('brands')
      .update({
        tt_access_token:    tokens.accessToken,
        tt_refresh_token:   tokens.refreshToken,
        tt_open_id:         tokens.openId,
        tt_username:        userInfo.username,
        tt_token_expires_at: expiresAt,
      })
      .eq('user_id', userId);

    const { data: brand } = await supabase
      .from('brands')
      .select('id')
      .eq('user_id', userId)
      .single();

    // 4 — Activity log + notification
    if (brand?.id) {
      await supabase.from('activity_log').insert({
        brand_id:    brand.id,
        user_id:     userId,
        action:      'tiktok_connected',
        entity_type: 'brand',
        details:     { tt_open_id: tokens.openId, tt_username: userInfo.username },
      });

      await supabase.from('notifications').insert({
        brand_id: brand.id,
        type:     'meta_connected',
        message:  `TikTok @${userInfo.username} conectado correctamente.`,
        read:     false,
      });
    }

    return NextResponse.redirect(new URL('/settings/connections?tiktok_connected=1', origin));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[TikTok callback] FAILED:', message, err);
    // Surface the error reason so we can see it without SSHing into logs.
    const redirectUrl = new URL('/settings/connections', origin);
    redirectUrl.searchParams.set('tiktok_error', '1');
    redirectUrl.searchParams.set('tiktok_error_reason', message.slice(0, 200));
    return NextResponse.redirect(redirectUrl);
  }
}
