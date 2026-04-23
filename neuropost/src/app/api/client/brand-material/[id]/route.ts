import { NextResponse }                         from 'next/server';
import { requireServerUser, createAdminClient } from '@/lib/supabase';
import { apiError }                             from '@/lib/api-utils';
import { logBrandMaterialAudit }                from '@/lib/audit';
import { detectSchemaVersion }                  from '@/types';
import type { BrandMaterialCategory }           from '@/types';
import {
  parseContent, syncDateColumns, validateTransversalFields,
} from '../_shared';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

const ALLOWED_PATCH_KEYS = [
  'content', 'valid_until', 'display_order', 'active',
  'priority', 'platforms', 'tags', 'active_from', 'active_to',
] as const;
type AllowedPatchKey = typeof ALLOWED_PATCH_KEYS[number];

function isAllowedKey(k: string): k is AllowedPatchKey {
  return (ALLOWED_PATCH_KEYS as readonly string[]).includes(k);
}

/** PATCH /api/client/brand-material/[id] */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const user   = await requireServerUser();
    const db     = createAdminClient() as DB;
    const body   = await req.json() as Record<string, unknown>;

    // Estricto: cualquier campo fuera de allowlist → 400.
    const unknownKeys = Object.keys(body).filter(k => !isAllowedKey(k));
    if (unknownKeys.length > 0) {
      return NextResponse.json(
        { error: 'unknown_fields', fields: unknownKeys },
        { status: 400 },
      );
    }

    const { data: brand } = await db
      .from('brands').select('id').eq('user_id', user.id).single();
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    // Lee fila anterior completa — necesaria para audit (categoría, versión,
    // diff_keys, toggle_active vs update). Coste: 1 SELECT extra.
    const { data: before } = await db
      .from('brand_material')
      .select('*')
      .eq('id', id)
      .eq('brand_id', brand.id)
      .maybeSingle();
    if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const category = before.category as BrandMaterialCategory;

    if ('content' in body) {
      const parsed = parseContent(category, body.content);
      if (!parsed.ok) {
        return NextResponse.json(
          { error: 'invalid_content_shape', issues: parsed.issues },
          { status: 422 },
        );
      }
      // persistimos el content tal como lo validó Zod (ya viene limpio porque
      // los v1 son .strict() y los v2 permisivos — preservan campos extra).
      body.content = parsed.content;
    }

    const transversal = validateTransversalFields(body);
    if (!transversal.ok) return transversal.response;

    const sync = syncDateColumns({
      valid_until: 'valid_until' in body ? (body.valid_until as string | null) : undefined,
      active_to:   'active_to'   in body ? (body.active_to   as string | null) : undefined,
    });

    // Construcción del patch final.
    const patch: Record<string, unknown> = {};
    if ('content'       in body) patch.content       = body.content;
    if ('display_order' in body) patch.display_order = body.display_order;
    if ('active'        in body) patch.active        = body.active;

    if (transversal.priority    !== undefined) patch.priority    = transversal.priority;
    if (transversal.platforms   !== undefined) patch.platforms   = transversal.platforms;
    if (transversal.tags        !== undefined) patch.tags        = transversal.tags;
    if (transversal.active_from !== undefined) patch.active_from = transversal.active_from;

    if (sync.valid_until !== undefined) patch.valid_until = sync.valid_until;
    if (sync.active_to   !== undefined) patch.active_to   = sync.active_to;

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'No updatable fields provided' }, { status: 400 });
    }

    const { data: updated, error } = await db
      .from('brand_material')
      .update(patch)
      .eq('id', id)
      .eq('brand_id', brand.id)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // ─── Audit (fire-and-forget) ─────────────────────────────────────────
    const bodyKeys = Object.keys(body);
    const isToggleOnly = bodyKeys.length === 1 && bodyKeys[0] === 'active';

    const versionBefore = detectSchemaVersion(before.content);
    const versionAfter  = 'content' in body ? detectSchemaVersion(body.content) : versionBefore;
    const isUpgrade = 'content' in body && versionBefore === 1 && versionAfter === 2;

    if (isToggleOnly) {
      void logBrandMaterialAudit({
        actor_user_id: user.id,
        brand_id:      brand.id,
        material_id:   id,
        category,
        action:        'toggle_active',
        metadata:      { new_active: Boolean(body.active) },
      });
    } else if (isUpgrade) {
      void logBrandMaterialAudit({
        actor_user_id:         user.id,
        brand_id:              brand.id,
        material_id:           id,
        category,
        action:                'upgrade_to_v2',
        schema_version_before: versionBefore,
        schema_version_after:  versionAfter,
        diff_keys:             Object.keys(patch),
      });
    } else {
      void logBrandMaterialAudit({
        actor_user_id:         user.id,
        brand_id:              brand.id,
        material_id:           id,
        category,
        action:                'update',
        schema_version_before: versionBefore,
        schema_version_after:  versionAfter,
        diff_keys:             Object.keys(patch),
      });
    }

    const res = NextResponse.json({ item: updated });
    if (sync.conflict) {
      console.warn('[brand-material] valid_until overridden by active_to', {
        material_id: id,
        ...sync.conflict,
      });
      void logBrandMaterialAudit({
        actor_user_id: user.id,
        brand_id:      brand.id,
        material_id:   id,
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
    return apiError(err, 'PATCH /api/client/brand-material/[id]');
  }
}

/** DELETE /api/client/brand-material/[id] */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const user   = await requireServerUser();
    const db     = createAdminClient() as DB;

    const { data: brand } = await db
      .from('brands').select('id').eq('user_id', user.id).single();
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    // Lee fila antes de borrar para poder loggear la categoría en el audit.
    const { data: before } = await db
      .from('brand_material')
      .select('id, category, content')
      .eq('id', id)
      .eq('brand_id', brand.id)
      .maybeSingle();

    const { error } = await db
      .from('brand_material')
      .delete()
      .eq('id', id)
      .eq('brand_id', brand.id);

    if (error) throw error;

    if (before) {
      void logBrandMaterialAudit({
        actor_user_id:         user.id,
        brand_id:              brand.id,
        material_id:           id,
        category:              before.category as BrandMaterialCategory,
        action:                'delete',
        schema_version_before: detectSchemaVersion(before.content),
      });
    }

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return apiError(err, 'DELETE /api/client/brand-material/[id]');
  }
}
