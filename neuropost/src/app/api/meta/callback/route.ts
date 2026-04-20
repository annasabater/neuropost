import { NextResponse } from 'next/server';
import {
  exchangeCodeForToken,
  getLongLivedToken,
  getFacebookPages,
  getIGAccountFromPage,
  verifyMetaState,
} from '@/lib/meta';
import { createAdminClient } from '@/lib/supabase';
import { syncBrandPostsIntoFeedQueue, syncInstagramPublishedSnapshot } from '@/lib/feedQueue';
import { upsertConnection, type Platform } from '@/lib/platforms';
import { getSocialQuota, overQuotaRedirect } from '@/lib/social-quota';

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
    const verified = await verifyMetaState(state);
    userId = verified.userId;
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

    // 5 — Resolve brand + enforce social-account quota
    const supabase = createAdminClient();
    const { data: brandRow } = await supabase.from('brands').select('id').eq('user_id', userId).single();
    if (!brandRow?.id) {
      return NextResponse.redirect(new URL('/settings?meta_error=no_brand', origin));
    }

    // Quota: every plan includes 1 connected social platform, extras are paid.
    // Connecting a platform the brand already has wired doesn't consume a slot
    // (that's a re-auth). If this OAuth would *add* more platforms than the
    // remaining quota allows, bounce to /settings/plan with an upsell banner.
    const quota = await getSocialQuota(brandRow.id);
    const attempted: Platform[] = [];
    if (igAccount && !quota.connected.includes('instagram')) attempted.push('instagram');
    if (!quota.connected.includes('facebook'))               attempted.push('facebook');

    if (attempted.length > quota.remaining) {
      return NextResponse.redirect(
        overQuotaRedirect(origin, attempted[0]!, quota).toString(),
      );
    }

    // 6 — Persist tokens on the legacy brand columns (backward compat until
    //     phase 1b drops them) AND on the canonical platform_connections
    //     rows so the quota counter stays accurate going forward.
    const update: Record<string, string | null> = {
      meta_token_expires_at: expiresAt,
    };

    if (igAccount) {
      update.ig_account_id   = igAccount.id;
      update.ig_username     = igAccount.username ?? null;
      update.ig_access_token = page.access_token; // page token works for IG Business
    }

    // Facebook Page — always save page token so user can publish to FB too
    update.fb_page_id     = page.id;
    update.fb_page_name   = page.name;
    update.fb_access_token = page.access_token;

    await supabase
      .from('brands')
      .update(update)
      .eq('user_id', userId);

    const expiresAtDate = new Date(expiresAt);

    // Upsert platform_connections so future quota checks see the new rows.
    if (igAccount) {
      await upsertConnection({
        brandId:          brandRow.id,
        platform:         'instagram',
        platformUserId:   igAccount.id,
        platformUsername: igAccount.username ?? null,
        accessToken:      page.access_token,
        refreshToken:     null,
        expiresAt:        expiresAtDate,
        refreshExpiresAt: null,
        status:           'active',
        metadata:         { source: 'meta/callback', fb_page_id: page.id },
      });
    }
    await upsertConnection({
      brandId:          brandRow.id,
      platform:         'facebook',
      platformUserId:   page.id,
      platformUsername: page.name,
      accessToken:      page.access_token,
      refreshToken:     null,
      expiresAt:        expiresAtDate,
      refreshExpiresAt: null,
      status:           'active',
      metadata:         { source: 'meta/callback' },
    });
    if (brandRow?.id) {
      await syncBrandPostsIntoFeedQueue(supabase, brandRow.id);
      if (igAccount) {
        await syncInstagramPublishedSnapshot(supabase, brandRow.id, igAccount.id, page.access_token);
      }
    }

    // 6 — Activity log
    await supabase.from('activity_log').insert({
      brand_id:    brandRow?.id,
      user_id:     userId,
      action:      'meta_connected',
      entity_type: 'brand',
      details:     { ig_account_id: igAccount?.id },
    });

    // 7 — Notification
    if (brandRow?.id) {
      await supabase.from('notifications').insert({
        brand_id: brandRow.id,
        type:     'meta_connected',
        message:  igAccount
          ? `Instagram @${igAccount.username ?? igAccount.id} conectado correctamente.`
          : `Cuenta de Instagram conectada correctamente.`,
        read:     false,
      });

      // 8 — Trigger first-content generation (onboarding auto-content)
      import('@/lib/onboarding-content')
        .then(({ triggerOnboardingContent }) => triggerOnboardingContent(brandRow.id, 'instagram_connect'))
        .catch((e) => console.error('[meta/callback] onboarding content trigger failed:', e));
    }

    return NextResponse.redirect(new URL('/settings?meta_connected=1', origin));
  } catch (err) {
    console.error('Meta OAuth callback error:', err);
    return NextResponse.redirect(new URL('/settings?meta_error=1', origin));
  }
}
