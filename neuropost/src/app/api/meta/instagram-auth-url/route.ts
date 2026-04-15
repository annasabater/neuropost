import { NextResponse } from 'next/server';
import { requireServerUser } from '@/lib/supabase';
import { getInstagramLoginUrl, signMetaState } from '@/lib/meta';

/**
 * GET /api/meta/instagram-auth-url
 *
 * Returns the OAuth URL for Instagram Login (sin Facebook).
 * El usuario solo necesita cuenta Business o Creator en Instagram.
 */
export async function GET() {
  try {
    const user  = await requireServerUser();
    const state = await signMetaState(user.id, 'instagram');
    const url   = getInstagramLoginUrl(state);
    return NextResponse.json({ url });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message.startsWith('Missing '))  return NextResponse.json({ error: message },       { status: 503 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
