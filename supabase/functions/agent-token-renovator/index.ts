import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import { logAgent, timer } from '../_shared/logger.ts';
import { handleCors, json } from '../_shared/cors.ts';

// Token Renovator — no LLM, pure Meta API logic
// Refreshes Meta access tokens before they expire (60-day lifecycle)

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const sb = getServiceClient();
  const elapsed = timer();

  try {
    // Tokens expiring in < 14 days
    const now = new Date();
    const fourteenDays = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();

    const { data: brands } = await sb
      .from('brands')
      .select('id, name, meta_access_token, meta_token_expires_at')
      .not('meta_access_token', 'is', null)
      .lt('meta_token_expires_at', fourteenDays);

    if (!brands?.length) return json({ message: 'No tokens to refresh', refreshed: 0 });

    let refreshed = 0;
    let errors = 0;

    for (const brand of brands) {
      try {
        // Exchange for long-lived token
        const appId = Deno.env.get('META_APP_ID')!;
        const appSecret = Deno.env.get('META_APP_SECRET')!;

        const res = await fetch(
          `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${brand.meta_access_token}`,
        );

        if (!res.ok) {
          const err = await res.text();
          throw new Error(`Meta token refresh failed: ${err}`);
        }

        const data = await res.json();
        const newToken = data.access_token;
        const expiresIn = data.expires_in ?? 5184000; // default 60 days

        const newExpiry = new Date(now.getTime() + expiresIn * 1000).toISOString();

        await sb.from('brands').update({
          meta_access_token: newToken,
          meta_token_expires_at: newExpiry,
        }).eq('id', brand.id);

        await logAgent(sb, 'token-renovator', brand.id, 'success', {
          old_expiry: brand.meta_token_expires_at,
          new_expiry: newExpiry,
        });
        refreshed++;
      } catch (err) {
        errors++;
        await logAgent(sb, 'token-renovator', brand.id, 'error', { error: String(err) });

        // Notify brand owner that token refresh failed
        const { data: brandData } = await sb.from('brands').select('user_id').eq('id', brand.id).single();
        if (brandData?.user_id) {
          await sb.from('notifications').insert({
            user_id: brandData.user_id,
            type: 'token_expired',
            title: 'Error al renovar conexión con Instagram',
            body: 'Reconecta tu cuenta manualmente desde Ajustes > Conexiones',
            data: { brand_id: brand.id },
          });
        }
      }
    }

    return json({ refreshed, errors });
  } catch (err) {
    await logAgent(sb, 'token-renovator', null, 'error', { error: String(err) }, elapsed());
    return json({ error: String(err) }, 500);
  }
});
