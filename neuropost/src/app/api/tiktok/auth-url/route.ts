// GET /api/tiktok/auth-url
// Returns the TikTok OAuth authorization URL for the current user.

import { NextResponse } from 'next/server';
import { requireServerUser } from '@/lib/supabase';
import { signTikTokState, getTikTokAuthUrl } from '@/lib/tiktok';

export async function GET() {
  try {
    const user  = await requireServerUser();
    const state = await signTikTokState(user.id);
    const url   = getTikTokAuthUrl(state);
    return NextResponse.json({ url });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
