// GET  /api/tiktok/status   — returns TikTok connection status for current user's brand
// DELETE /api/tiktok/status — disconnects TikTok

import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-utils';
import { requireServerUser, createAdminClient } from '@/lib/supabase';

export async function GET() {
  try {
    const user    = await requireServerUser();
    const db      = createAdminClient();
    const { data: brand } = await db
      .from('brands')
      .select('tt_open_id, tt_username, tt_token_expires_at')
      .eq('user_id', user.id)
      .single();

    if (!brand?.tt_open_id) {
      return NextResponse.json({ connected: false });
    }

    const expiresAt   = brand.tt_token_expires_at ? new Date(brand.tt_token_expires_at) : null;
    const now         = new Date();
    const daysLeft    = expiresAt ? Math.ceil((expiresAt.getTime() - now.getTime()) / 86400000) : null;
    const tokenStatus = daysLeft === null ? 'unknown' : daysLeft > 7 ? 'valid' : daysLeft > 0 ? 'expiring_soon' : 'expired';

    return NextResponse.json({
      connected: true,
      username:  brand.tt_username,
      openId:    brand.tt_open_id,
      daysLeft,
      tokenStatus,
    });
  } catch (err) {
    return apiError(err, 'tiktok/status');
  }
}

export async function DELETE() {
  try {
    const user = await requireServerUser();
    const db   = createAdminClient();
    await db
      .from('brands')
      .update({
        tt_access_token:     null,
        tt_refresh_token:    null,
        tt_open_id:          null,
        tt_username:         null,
        tt_token_expires_at: null,
      })
      .eq('user_id', user.id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err, 'tiktok/status');
  }
}
