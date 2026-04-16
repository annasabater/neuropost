import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-utils';
import { requireServerUser, createServerClient } from '@/lib/supabase';
import type { Brand } from '@/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export async function GET(request: Request) {
  try {
    const user     = await requireServerUser();
    const { searchParams } = new URL(request.url);
    const postId   = searchParams.get('postId');
    const supabase = await createServerClient() as DB;

    const { data: brand } = await supabase
      .from('brands').select('*').eq('user_id', user.id).single();
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    const typedBrand = brand as Brand;

    // If no access token, return empty
    if (!typedBrand.ig_access_token && !typedBrand.fb_access_token) {
      return NextResponse.json({ comments: [] });
    }

    // In production: call Meta Graph API GET /{media-id}/comments
    // and GET /{page-id}/feed?fields=comments
    // For now return empty — real implementation requires Media IDs from published posts
    if (postId) {
      return NextResponse.json({ comments: [], postId });
    }

    return NextResponse.json({ comments: [] });
  } catch (err) {
    return apiError(err, 'meta/comments');
  }
}
