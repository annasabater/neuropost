import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requireWorker, workerErrorResponse } from '@/lib/worker';
import { createAdminClient } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

/**
 * GET /api/worker/audit?actor_type=&action=&resource_type=&severity=&brand_id=&q=&limit=50&offset=0
 * Paginated audit log with filters.
 */
export async function GET(req: NextRequest) {
  try {
    await requireWorker();
    const db: DB = createAdminClient();
    const p = req.nextUrl.searchParams;

    const limit      = Math.min(parseInt(p.get('limit') ?? '50', 10), 200);
    const offset     = parseInt(p.get('offset') ?? '0', 10);
    const actorType  = p.get('actor_type');
    const action     = p.get('action');
    const resType    = p.get('resource_type');
    const severity   = p.get('severity');
    const brandId    = p.get('brand_id');
    const q          = p.get('q')?.trim();
    const from       = p.get('from');
    const to         = p.get('to');

    let query = db.from('audit_logs').select('*', { count: 'exact' });

    if (actorType)  query = query.eq('actor_type', actorType);
    if (action)     query = query.eq('action', action);
    if (resType)    query = query.eq('resource_type', resType);
    if (severity)   query = query.eq('severity', severity);
    if (brandId)    query = query.eq('brand_id', brandId);
    if (from)       query = query.gte('created_at', from);
    if (to)         query = query.lte('created_at', to);
    if (q && q.length >= 2) {
      query = query.or(`description.ilike.%${q}%,resource_name.ilike.%${q}%,actor_name.ilike.%${q}%`);
    }

    query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) throw error;

    // Stats for header
    const now = new Date();
    const h24 = new Date(now.getTime() - 24 * 3600000).toISOString();
    const d7  = new Date(now.getTime() - 7 * 24 * 3600000).toISOString();

    const [stats24Res, stats7Res] = await Promise.all([
      db.from('audit_logs').select('severity', { count: 'exact', head: false }).gte('created_at', h24),
      db.from('audit_logs').select('severity', { count: 'exact', head: false }).gte('created_at', d7),
    ]);

    const count24 = (stats24Res.data ?? []).length;
    const warn24  = (stats24Res.data ?? []).filter((r: { severity: string }) => r.severity === 'warning').length;
    const crit24  = (stats24Res.data ?? []).filter((r: { severity: string }) => r.severity === 'critical').length;
    const count7  = (stats7Res.data ?? []).length;
    const warn7   = (stats7Res.data ?? []).filter((r: { severity: string }) => r.severity === 'warning').length;
    const crit7   = (stats7Res.data ?? []).filter((r: { severity: string }) => r.severity === 'critical').length;

    return NextResponse.json({
      logs:  data ?? [],
      total: count ?? 0,
      stats: { count24, warn24, crit24, count7, warn7, crit7 },
    });
  } catch (err) {
    const { error, status } = workerErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}
