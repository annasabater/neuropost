import { NextResponse } from 'next/server';
import { requireServerUser, createAdminClient } from '@/lib/supabase';

// GET /api/comments — returns all comments for the user's brand
export async function GET() {
  try {
    const user = await requireServerUser();
    const db = createAdminClient();

    const { data: brand } = await db
      .from('brands')
      .select('id')
      .eq('user_id', user.id)
      .single();
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    const { data: comments, error } = await db
      .from('comments')
      .select('*')
      .eq('brand_id', brand.id)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    return NextResponse.json({ comments: comments ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
