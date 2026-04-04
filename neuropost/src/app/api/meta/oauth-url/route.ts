// Kept for backward compatibility — delegates to /api/meta/auth-url logic
import { NextResponse } from 'next/server';
import { requireServerUser } from '@/lib/supabase';
import { getOAuthUrl, signMetaState } from '@/lib/meta';

export async function GET() {
  try {
    const user  = await requireServerUser();
    const state = await signMetaState(user.id);
    const url   = getOAuthUrl(state);
    return NextResponse.json({ url });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
