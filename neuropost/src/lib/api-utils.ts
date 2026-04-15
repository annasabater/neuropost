// =============================================================================
// API response utilities — safe error handling + pagination helpers
// =============================================================================
// Every API route should use these instead of raw error handling.

import { NextResponse } from 'next/server';

// ─── Error sanitization ──────────────────────────────────────────────────────
// Internal errors (Supabase, Anthropic, Stripe) must never leak to the client.
// Log the full error server-side, return a generic message to the client.

const SAFE_ERRORS: Record<string, { message: string; status: number }> = {
  UNAUTHENTICATED:     { message: 'No autorizado', status: 401 },
  PGRST116:            { message: 'Recurso no encontrado', status: 404 },   // PostgREST single row not found
  '23505':             { message: 'Este recurso ya existe', status: 409 },   // unique_violation
  '23503':             { message: 'Referencia no válida', status: 400 },     // foreign_key_violation
  '42501':             { message: 'Sin permisos para esta acción', status: 403 }, // insufficient_privilege
};

/**
 * Convert any caught error into a safe NextResponse.
 * Logs the full error server-side, returns a sanitized message to the client.
 *
 * Usage:
 *   catch (err) { return apiError(err, 'POST /api/chat'); }
 */
export function apiError(err: unknown, context?: string): NextResponse {
  // 1. Check if it's a known safe error
  const errMsg = err instanceof Error ? err.message : String(err);

  // Auth errors
  if (errMsg === 'UNAUTHENTICATED') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  // PostgREST errors (from Supabase)
  if (err && typeof err === 'object' && 'code' in err) {
    const pgErr = err as { code?: string; message?: string };
    const safe = SAFE_ERRORS[pgErr.code ?? ''];
    if (safe) {
      console.error(`[${context ?? 'API'}] PostgREST ${pgErr.code}:`, pgErr.message);
      return NextResponse.json({ error: safe.message }, { status: safe.status });
    }
  }

  // 2. Log the FULL error server-side (for debugging)
  console.error(`[${context ?? 'API'}]`, err);

  // 3. Check for transient errors → 503
  if (/timeout|rate.?limit|overloaded|503|504|ECONN/i.test(errMsg)) {
    return NextResponse.json(
      { error: 'Servicio temporalmente no disponible. Inténtalo de nuevo.' },
      { status: 503 },
    );
  }

  // 4. Default: generic 500 — NEVER expose the real error message
  return NextResponse.json(
    { error: 'Error interno del servidor' },
    { status: 500 },
  );
}

// ─── Pagination helpers ──────────────────────────────────────────────────────

export interface PaginationParams {
  limit:  number;
  offset: number;
}

/**
 * Extract pagination params from a request URL.
 * Defaults: limit=50 (capped at maxLimit), offset=0
 */
export function parsePagination(
  request: Request,
  maxLimit = 100,
  defaultLimit = 50,
): PaginationParams {
  const url = new URL(request.url);
  const limit  = Math.min(
    Math.max(Number(url.searchParams.get('limit') ?? defaultLimit), 1),
    maxLimit,
  );
  const offset = Math.max(Number(url.searchParams.get('offset') ?? 0), 0);
  return { limit, offset };
}
