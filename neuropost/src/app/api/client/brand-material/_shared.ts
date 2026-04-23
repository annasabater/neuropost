// Sprint 12: helpers compartidos por POST /brand-material y PATCH /brand-material/[id].
// Dispatcher en cascada (v1/v2) + sync valid_until ↔ active_to + validación
// de campos transversales (priority/platforms/tags/active_from/active_to).

import { z } from 'zod';
import { NextResponse } from 'next/server';
import { CONTENT_SCHEMAS } from '@/types';
import type { BrandMaterialCategory } from '@/types';

// ────────────────────────────────────────────────────────────────────────────
// Schemas auxiliares para campos transversales
// ────────────────────────────────────────────────────────────────────────────

export const PlatformsSchema = z.array(
  z.enum(['instagram', 'facebook', 'linkedin', 'tiktok', 'x']),
);

export const PrioritySchema = z.number().int().min(0).max(10);
export const TagsSchema     = z.array(z.string().min(1)).max(50);
export const IsoOrNull      = z.string().datetime().nullable();

// ────────────────────────────────────────────────────────────────────────────
// Dispatcher en cascada de content (v1 o v2)
// ────────────────────────────────────────────────────────────────────────────

export type ContentParseResult =
  | { ok: true;  content: Record<string, unknown>; version: 'v1' | 'v2' }
  | { ok: false; issues: z.ZodIssue[] };

/**
 * Intenta la versión declarada primero; si falla, intenta la otra.
 * Los `issues` devueltos en caso de fallo son los de la versión declarada
 * (más útiles para el cliente que los de la versión que nunca quiso enviar).
 */
export function parseContent(
  category: BrandMaterialCategory,
  content: unknown,
): ContentParseResult {
  const declaredVersion: 'v1' | 'v2' =
    (content as { schema_version?: unknown })?.schema_version === 2 ? 'v2' : 'v1';
  const otherVersion: 'v1' | 'v2' = declaredVersion === 'v2' ? 'v1' : 'v2';

  const schemas = CONTENT_SCHEMAS[category];
  const primary = schemas[declaredVersion].safeParse(content);
  if (primary.success) {
    return { ok: true, content: primary.data as Record<string, unknown>, version: declaredVersion };
  }

  const secondary = schemas[otherVersion].safeParse(content);
  if (secondary.success) {
    return { ok: true, content: secondary.data as Record<string, unknown>, version: otherVersion };
  }

  return { ok: false, issues: primary.error.issues };
}

// ────────────────────────────────────────────────────────────────────────────
// Sincronización valid_until ↔ active_to
// ────────────────────────────────────────────────────────────────────────────

export interface SyncInput {
  valid_until?: string | null;
  active_to?:   string | null;
}

export interface SyncResult {
  valid_until?: string | null;   // undefined = no tocar
  active_to?:   string | null;
  conflict: {
    sent_valid_until: string | null;
    sent_active_to:   string | null;
  } | null;
}

/**
 * Reglas (en orden de precedencia):
 *   - ambos ausentes → no tocar.
 *   - solo active_to → valid_until = active_to.
 *   - solo valid_until → active_to = valid_until.
 *   - ambos iguales → passthrough sin warning.
 *   - ambos distintos → active_to gana, valid_until se sobrescribe.
 */
export function syncDateColumns(body: SyncInput): SyncResult {
  const hasValid  = 'valid_until' in body;
  const hasActive = 'active_to'   in body;

  if (!hasValid && !hasActive) {
    return { conflict: null };
  }

  if (hasActive && !hasValid) {
    return { valid_until: body.active_to ?? null, active_to: body.active_to ?? null, conflict: null };
  }

  if (hasValid && !hasActive) {
    return { valid_until: body.valid_until ?? null, active_to: body.valid_until ?? null, conflict: null };
  }

  // Ambos presentes
  const vu = body.valid_until ?? null;
  const at = body.active_to   ?? null;

  if (vu === at) {
    return { valid_until: vu, active_to: at, conflict: null };
  }

  return {
    valid_until: at,
    active_to:   at,
    conflict: { sent_valid_until: vu, sent_active_to: at },
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Validación de campos transversales (priority/platforms/tags/active_from).
// Compartida por POST y PATCH.
// ────────────────────────────────────────────────────────────────────────────

interface TransversalOk {
  ok: true;
  active_from?: string | null;
  priority?:    number;
  platforms?:   string[];
  tags?:        string[];
}
interface TransversalFail {
  ok: false;
  response: NextResponse;
}

export type TransversalResult = TransversalOk | TransversalFail;

export function validateTransversalFields(
  body: Record<string, unknown>,
): TransversalResult {
  const out: TransversalOk = { ok: true };

  if ('priority' in body) {
    const p = PrioritySchema.safeParse(body.priority);
    if (!p.success) {
      return { ok: false, response: NextResponse.json(
        { error: 'invalid_priority', issues: p.error.issues }, { status: 422 },
      ) };
    }
    out.priority = p.data;
  }

  if ('platforms' in body) {
    const p = PlatformsSchema.safeParse(body.platforms);
    if (!p.success) {
      return { ok: false, response: NextResponse.json(
        { error: 'invalid_platforms', issues: p.error.issues }, { status: 422 },
      ) };
    }
    out.platforms = p.data;
  }

  if ('tags' in body) {
    const p = TagsSchema.safeParse(body.tags);
    if (!p.success) {
      return { ok: false, response: NextResponse.json(
        { error: 'invalid_tags', issues: p.error.issues }, { status: 422 },
      ) };
    }
    out.tags = p.data;
  }

  if ('active_from' in body) {
    const v = body.active_from;
    if (v !== null && typeof v !== 'string') {
      return { ok: false, response: NextResponse.json(
        { error: 'invalid_active_from' }, { status: 422 },
      ) };
    }
    if (typeof v === 'string') {
      const parsed = Date.parse(v);
      if (Number.isNaN(parsed)) {
        return { ok: false, response: NextResponse.json(
          { error: 'invalid_active_from' }, { status: 422 },
        ) };
      }
    }
    out.active_from = v;
  }

  return out;
}
