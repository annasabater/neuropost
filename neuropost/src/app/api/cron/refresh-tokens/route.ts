import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { refreshTikTokToken } from '@/lib/tiktok';

// Refresh Meta + TikTok tokens before they expire.
// Schedule this via vercel.json cron (e.g. every 6h).
export async function GET(request: Request) {
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET ?? ''}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  // ── Meta ────────────────────────────────────────────────────────────────────
  const metaRes  = await fetch(`${appUrl}/api/meta/refresh`, {
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  const metaJson = await metaRes.json().catch(() => ({ error: 'meta_refresh_failed' }));

  // ── TikTok ──────────────────────────────────────────────────────────────────
  // Find all brands with a TikTok token that expires within the next 48 hours
  // and refresh them in-place. Sandbox tokens live ~24h so we err on the side
  // of refreshing often.
  const db = createAdminClient();
  const threshold = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  const { data: brands } = await db
    .from('brands')
    .select('id, tt_refresh_token, tt_token_expires_at')
    .not('tt_refresh_token', 'is', null)
    .lt('tt_token_expires_at', threshold);

  const tiktokResults: Array<{ brand_id: string; ok: boolean; error?: string }> = [];

  for (const b of (brands ?? []) as Array<{ id: string; tt_refresh_token: string | null }>) {
    if (!b.tt_refresh_token) continue;
    try {
      const refreshed = await refreshTikTokToken(b.tt_refresh_token);
      await db.from('brands').update({
        tt_access_token:     refreshed.accessToken,
        tt_refresh_token:    refreshed.refreshToken || b.tt_refresh_token,
        tt_token_expires_at: new Date(Date.now() + refreshed.expiresIn * 1000).toISOString(),
      }).eq('id', b.id);
      tiktokResults.push({ brand_id: b.id, ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      tiktokResults.push({ brand_id: b.id, ok: false, error: message });
      console.error(`[refresh-tokens] TikTok refresh failed for brand ${b.id}:`, message);

      // Refresh failed → the refresh_token is no longer valid (revoked by user,
      // expired past 365 days, or TikTok reset). Surface to the client so they
      // know to reconnect — otherwise publishing silently stops working.
      try {
        // Skip if we already warned them recently (last 24h) to avoid spam.
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: recent } = await db
          .from('notifications')
          .select('id')
          .eq('brand_id', b.id)
          .eq('type', 'tiktok_reconnect_required')
          .gt('created_at', since)
          .limit(1);

        if (!recent || recent.length === 0) {
          await db.from('notifications').insert({
            brand_id: b.id,
            type:     'tiktok_reconnect_required',
            message:  'Tu conexión con TikTok ha expirado. Ve a Ajustes → Conexiones y pulsa "Reconectar" para volver a publicar.',
            read:     false,
            metadata: { reason: message },
          });

          // Also clear the dead token so the UI correctly shows "not connected"
          // instead of an expired-looking state.
          await db.from('brands').update({
            tt_access_token:     null,
            tt_refresh_token:    null,
            tt_token_expires_at: null,
          }).eq('id', b.id);
        }
      } catch (notifyErr) {
        console.error(`[refresh-tokens] Could not notify brand ${b.id}:`, notifyErr);
      }
    }
  }

  return NextResponse.json({
    meta:   metaJson,
    tiktok: {
      checked:   (brands ?? []).length,
      succeeded: tiktokResults.filter(r => r.ok).length,
      failed:    tiktokResults.filter(r => !r.ok).length,
      details:   tiktokResults,
    },
  });
}
