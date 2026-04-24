// =============================================================================
// PATCH /api/brand/aesthetic — Phase 1 creative direction fields
// =============================================================================
// Validates and persists the 6 creative direction fields on the user's brand.
// Auth via requireServerUser + scoped to brand owned by the user.
// =============================================================================

import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-utils';
import { requireServerUser, createServerClient } from '@/lib/supabase';
import { FONT_CATALOG } from '@/lib/stories/fonts-catalog';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

const PRESET_IDS = ['moody','creativo','editorial','natural','minimalista','clasico','luxury','vintage'] as const;
const OVERLAY_VALUES = ['none','subtle','medium','strong'] as const;

function isDisplayFont(id: string): boolean {
  return FONT_CATALOG.some(f => f.id === id && f.role === 'display');
}
function isBodyFont(id: string): boolean {
  return FONT_CATALOG.some(f => f.id === id && f.role === 'body');
}

export async function PATCH(request: Request) {
  try {
    const user     = await requireServerUser();
    const body     = await request.json() as Record<string, unknown>;
    const supabase = await createServerClient() as DB;

    const patch: Record<string, unknown> = {};

    if ('aesthetic_preset' in body) {
      const v = body.aesthetic_preset;
      if (v !== null && !(typeof v === 'string' && (PRESET_IDS as readonly string[]).includes(v))) {
        return apiError(400, 'invalid aesthetic_preset');
      }
      patch.aesthetic_preset = v;
    }

    if ('realism_level' in body) {
      const v = body.realism_level;
      if (v !== null && !(typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100)) {
        return apiError(400, 'invalid realism_level (expected 0-100)');
      }
      patch.realism_level = v === null ? null : Math.round(v as number);
    }

    if ('typography_display' in body) {
      const v = body.typography_display;
      if (v !== null && !(typeof v === 'string' && isDisplayFont(v))) {
        return apiError(400, 'invalid typography_display (unknown display font id)');
      }
      patch.typography_display = v;
    }

    if ('typography_body' in body) {
      const v = body.typography_body;
      if (v !== null && !(typeof v === 'string' && isBodyFont(v))) {
        return apiError(400, 'invalid typography_body (unknown body font id)');
      }
      patch.typography_body = v;
    }

    if ('allow_graphic_elements' in body) {
      const v = body.allow_graphic_elements;
      if (typeof v !== 'boolean') {
        return apiError(400, 'invalid allow_graphic_elements (expected boolean)');
      }
      patch.allow_graphic_elements = v;
    }

    if ('overlay_intensity' in body) {
      const v = body.overlay_intensity;
      if (v !== null && !(typeof v === 'string' && (OVERLAY_VALUES as readonly string[]).includes(v))) {
        return apiError(400, 'invalid overlay_intensity');
      }
      patch.overlay_intensity = v;
    }

    if (Object.keys(patch).length === 0) {
      return apiError(400, 'no valid aesthetic fields in request body');
    }

    const { data, error } = await supabase
      .from('brands')
      .update(patch)
      .eq('user_id', user.id)
      .select()
      .single();
    if (error) throw error;

    return NextResponse.json({ brand: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return apiError(500, message);
  }
}
