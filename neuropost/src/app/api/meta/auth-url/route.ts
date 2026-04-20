import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-utils';
import { requireServerUser } from '@/lib/supabase';
import { getOAuthUrl, signMetaState } from '@/lib/meta';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const source = searchParams.get('source') === 'facebook' ? 'facebook' : 'instagram';
    const user  = await requireServerUser();
    const state = await signMetaState(user.id, source);
    const url   = getOAuthUrl(state);
    return NextResponse.json({ url });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.startsWith('Missing ')) return NextResponse.json({ error: message }, { status: 503 });
    return apiError(err, 'meta/auth-url');
  }
}
