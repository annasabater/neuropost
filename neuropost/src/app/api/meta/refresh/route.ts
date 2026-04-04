import { NextResponse } from 'next/server';
import { refreshLongLivedToken } from '@/lib/meta';
import { createAdminClient } from '@/lib/supabase';

// Called by Vercel Cron: GET /api/meta/refresh
export async function GET(request: Request) {
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET ?? ''}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = createAdminClient();

  // Find brands whose token expires within 7 days
  const cutoff = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: brands } = await supabase
    .from('brands')
    .select('id,ig_access_token,fb_access_token,meta_token_expires_at')
    .lte('meta_token_expires_at', cutoff)
    .not('ig_access_token', 'is', null);

  if (!brands?.length) return NextResponse.json({ refreshed: 0 });

  let refreshed = 0;

  for (const brand of brands) {
    const token = brand.ig_access_token ?? brand.fb_access_token;
    if (!token) continue;

    try {
      const result    = await refreshLongLivedToken(token);
      const expiresAt = new Date(Date.now() + result.expiresIn * 1000).toISOString();

      await supabase
        .from('brands')
        .update({
          ig_access_token:       result.accessToken,
          fb_access_token:       result.accessToken,
          meta_token_expires_at: expiresAt,
        })
        .eq('id', brand.id);

      refreshed++;
    } catch (err) {
      console.error(`Token refresh failed for brand ${brand.id}:`, err);

      // Notify the brand owner
      await supabase.from('notifications').insert({
        brand_id: brand.id,
        type:     'token_expired',
        message:  'Tu conexión con Instagram/Facebook ha expirado. Reconecta tu cuenta en Ajustes.',
        read:     false,
      });
    }
  }

  return NextResponse.json({ refreshed });
}
