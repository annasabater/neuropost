import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-utils';
import { requireServerUser, createAdminClient } from '@/lib/supabase';

export async function GET() {
  try {
    const user = await requireServerUser();
    const db = createAdminClient();

    const { data: brand } = await db.from('brands').select('id, name').eq('user_id', user.id).single();
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    const { data: posts } = await db
      .from('posts')
      .select('caption, hashtags, status, platform, format, published_at, created_at')
      .eq('brand_id', brand.id)
      .order('created_at', { ascending: false });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = (posts ?? []).map((p: any) => [
      p.created_at ? new Date(p.created_at).toLocaleDateString('es-ES') : '',
      p.status,
      Array.isArray(p.platform) ? p.platform.join('+') : (p.platform ?? ''),
      p.format ?? '',
      (p.caption ?? '').replace(/"/g, '""'),
      Array.isArray(p.hashtags) ? p.hashtags.join(' ') : '',
      p.published_at ? new Date(p.published_at).toLocaleDateString('es-ES') : '',
    ]);

    const header = ['Fecha creación', 'Estado', 'Plataforma', 'Formato', 'Caption', 'Hashtags', 'Fecha publicación'];
    const csv = [header, ...rows].map((r) => r.map((c: unknown) => `"${c}"`).join(',')).join('\n');

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="historial-${brand.name.replace(/\s/g, '-')}.csv"`,
      },
    });
  } catch (err) {
    return apiError(err, 'historial/export');
  }
}
