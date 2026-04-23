import { NextResponse }                          from 'next/server';
import { requireServerUser, createAdminClient }  from '@/lib/supabase';
import { apiError }                              from '@/lib/api-utils';
import { logBrandMaterialAudit }                 from '@/lib/audit';
import { detectSchemaVersion }                   from '@/types';
import type { BrandMaterialCategory }            from '@/types';
import { parseContent, syncDateColumns, validateTransversalFields } from './_shared';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

const ALLOWED_PLATFORMS = ['instagram', 'facebook', 'linkedin', 'tiktok', 'x'] as const;
type AllowedPlatform = typeof ALLOWED_PLATFORMS[number];

function isAllowedPlatform(p: string): p is AllowedPlatform {
  return (ALLOWED_PLATFORMS as readonly string[]).includes(p);
}

/** GET /api/client/brand-material?category=X&platform=Y&min_priority=N */
export async function GET(req: Request) {
  try {
    const user     = await requireServerUser();
    const db       = createAdminClient() as DB;
    const url      = new URL(req.url);
    const category = url.searchParams.get('category') as BrandMaterialCategory | null;
    const platform = url.searchParams.get('platform');
    const minPriorityRaw = url.searchParams.get('min_priority');

    if (platform !== null && !isAllowedPlatform(platform)) {
      return NextResponse.json(
        { error: 'invalid_platform', allowed: ALLOWED_PLATFORMS },
        { status: 400 },
      );
    }

    let minPriority: number | null = null;
    if (minPriorityRaw !== null) {
      const n = Number(minPriorityRaw);
      if (!Number.isInteger(n) || n < 0) {
        return NextResponse.json({ error: 'invalid_min_priority' }, { status: 400 });
      }
      minPriority = n;
    }

    const { data: brand } = await db
      .from('brands').select('id').eq('user_id', user.id).single();
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    let query = db
      .from('brand_material')
      .select('*')
      .eq('brand_id', brand.id)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (category)       query = query.eq('category', category);
    if (minPriority !== null) query = query.gte('priority', minPriority);
    if (platform) {
      // platforms = '{}' significa "todas"; si está listada, también pasa.
      query = query.or(`platforms.eq.{},platforms.cs.{${platform}}`);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ items: data ?? [] });
  } catch (err) {
    return apiError(err, 'GET /api/client/brand-material');
  }
}

/** POST /api/client/brand-material */
export async function POST(req: Request) {
  try {
    const user = await requireServerUser();
    const db   = createAdminClient() as DB;
    const body = await req.json() as Record<string, unknown>;

    const category = body.category as BrandMaterialCategory | undefined;
    const content  = body.content;
    if (!category || content === undefined || content === null) {
      return NextResponse.json({ error: 'category y content son obligatorios' }, { status: 400 });
    }

    // Dispatcher en cascada
    const parsed = parseContent(category, content);
    if (!parsed.ok) {
      return NextResponse.json(
        { error: 'invalid_content_shape', issues: parsed.issues },
        { status: 422 },
      );
    }

    // Validación de campos transversales (todos opcionales)
    const transversal = validateTransversalFields(body);
    if (!transversal.ok) return transversal.response;

    const { data: brand } = await db
      .from('brands').select('id').eq('user_id', user.id).single();
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    // Sincronización valid_until ↔ active_to
    const sync = syncDateColumns({
      valid_until: 'valid_until' in body ? (body.valid_until as string | null) : undefined,
      active_to:   'active_to'   in body ? (body.active_to   as string | null) : undefined,
    });

    const insertRow: Record<string, unknown> = {
      brand_id:      brand.id,
      category,
      content:       parsed.content,
      display_order: typeof body.display_order === 'number' ? body.display_order : 0,
    };
    if (sync.valid_until !== undefined) insertRow.valid_until = sync.valid_until;
    if (sync.active_to   !== undefined) insertRow.active_to   = sync.active_to;
    if (transversal.active_from !== undefined) insertRow.active_from = transversal.active_from;
    if (transversal.priority  !== undefined)   insertRow.priority  = transversal.priority;
    if (transversal.platforms !== undefined)   insertRow.platforms = transversal.platforms;
    if (transversal.tags      !== undefined)   insertRow.tags      = transversal.tags;

    const { data: created, error } = await db
      .from('brand_material')
      .insert(insertRow)
      .select()
      .single();

    if (error) throw error;

    // Audit: create (fire-and-forget, never throws)
    void logBrandMaterialAudit({
      actor_user_id:        user.id,
      brand_id:             brand.id,
      material_id:          created.id,
      category,
      action:               'create',
      schema_version_after: detectSchemaVersion(parsed.content),
    });

    const res = NextResponse.json({ item: created }, { status: 201 });
    if (sync.conflict) {
      console.warn('[brand-material] valid_until overridden by active_to', {
        material_id: created.id,
        ...sync.conflict,
      });
      void logBrandMaterialAudit({
        actor_user_id: user.id,
        brand_id:      brand.id,
        material_id:   created.id,
        category,
        action:        'conflict_resolved',
        metadata: {
          sent_valid_until: sync.conflict.sent_valid_until,
          sent_active_to:   sync.conflict.sent_active_to,
        },
      });
      res.headers.set('X-Neuropost-Warning', 'valid_until_overridden_by_active_to');
    }
    return res;
  } catch (err) {
    return apiError(err, 'POST /api/client/brand-material');
  }
}

