// Sprint 12: única frontera v1 → v2 para consumidores de brand_material.
// Nadie más debe hacer upgrade de `content` a mano. Si algún consumidor
// necesita algo que este módulo no da, se añade aquí.

import type { BrandMaterial, BrandMaterialCategory } from '@/types';
import type {
  AnyContentV2,
  BrandMaterialV2,
  ContentByCategory,
  ScheduleContentV2T,
} from '@/types/brand-material';
import { detectSchemaVersion } from '@/types/brand-material';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

// ────────────────────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────────────────────

/**
 * Frontera v1 → v2. Toma la fila tal cual viene de BD (`BrandMaterial` legacy,
 * que puede tener `content` en forma v1 o v2) y devuelve siempre v2.
 *
 * - No persiste nada: el upgrade es en memoria.
 * - Nunca lanza: si el content v1 está sucio, aplica defaults tolerantes.
 *   La validación estricta contra Zod es responsabilidad del caller.
 * - Si `raw.content.schema_version === 2`, asume v2 y pasa la fila tal cual.
 */
export function normalizeMaterial(raw: BrandMaterial): BrandMaterialV2 {
  const version = detectSchemaVersion(raw.content);

  const extra = raw as unknown as Partial<BrandMaterialV2>;
  const active_from = extra.active_from ?? null;
  const active_to   = extra.active_to   ?? raw.valid_until ?? null;
  const priority    = extra.priority    ?? 0;
  const platforms   = extra.platforms   ?? [];
  const tags        = extra.tags        ?? [];

  if (version === 2) {
    return {
      id:            raw.id,
      brand_id:      raw.brand_id,
      category:      raw.category,
      content:       raw.content as AnyContentV2,
      active:        raw.active,
      valid_until:   raw.valid_until,
      active_from,
      active_to,
      priority,
      platforms,
      tags,
      display_order: raw.display_order,
      created_at:    raw.created_at,
      updated_at:    raw.updated_at,
    };
  }

  const upgraded = upgradeContent(raw.category, raw.content as Any);

  return {
    id:            raw.id,
    brand_id:      raw.brand_id,
    category:      raw.category,
    content:       upgraded,
    active:        raw.active,
    valid_until:   raw.valid_until,
    active_from,
    active_to,
    priority,
    platforms,
    tags,
    display_order: raw.display_order,
    created_at:    raw.created_at,
    updated_at:    raw.updated_at,
  };
}

/**
 * Evalúa si un material está activo justo ahora.
 * `now` inyectable para tests (no depender del reloj real).
 */
export function isActiveNow(m: BrandMaterialV2, now: Date = new Date()): boolean {
  if (!m.active) return false;
  if (m.active_from && now < new Date(m.active_from)) return false;
  if (m.active_to   && now > new Date(m.active_to))   return false;
  return true;
}

export type MaterialStatus = 'active' | 'scheduled' | 'expired' | 'inactive';

/**
 * Estado discreto del material para UI (badges, filtros).
 *
 * Prioridad:
 *   1. `active === false` → 'inactive' (gana sobre ventanas futuras/pasadas).
 *   2. `active_from > now` → 'scheduled' (ventana aún no empezó).
 *   3. `active_to < now`   → 'expired'   (ventana ya pasó).
 *   4. Resto              → 'active'.
 */
export function getMaterialStatus(
  m: BrandMaterialV2,
  now: Date = new Date(),
): MaterialStatus {
  if (!m.active) return 'inactive';
  if (m.active_from && new Date(m.active_from) > now) return 'scheduled';
  if (m.active_to   && new Date(m.active_to)   < now) return 'expired';
  return 'active';
}

/**
 * Selector de schedule activo para el planificador de stories.
 *
 * Contrato (ambigüedad D resuelta en F3):
 *   1. Si ningún elemento tiene su ventana activa → devuelve el primero.
 *   2. Si uno solo está activo → devuelve ese.
 *   3. Si hay varios activos → gana el más específico (más campos de
 *      ventana definidos: active_from y/o active_to). Empate por índice.
 *
 * Esto permite que "Verano 2026" (con ventana explícita) desplace al
 * "Horario regular" (sin ventana) durante su ventana, sin que el cliente
 * tenga que desactivar nada manualmente.
 */
export function pickActiveSchedule(
  schedules: ScheduleContentV2T['schedules'],
  now: Date = new Date(),
): ScheduleContentV2T['schedules'][number] | null {
  if (!schedules || schedules.length === 0) return null;

  const active = schedules.filter(s => isScheduleEntryActive(s, now));
  if (active.length === 0) return schedules[0]!;
  if (active.length === 1) return active[0]!;

  return [...active].sort((a, b) => specificity(b) - specificity(a))[0]!;
}

// ────────────────────────────────────────────────────────────────────────────
// Internals
// ────────────────────────────────────────────────────────────────────────────

function isScheduleEntryActive(
  s: ScheduleContentV2T['schedules'][number],
  now: Date,
): boolean {
  if (s.active_from && now < new Date(s.active_from)) return false;
  if (s.active_to   && now > new Date(s.active_to))   return false;
  return true;
}

function specificity(s: ScheduleContentV2T['schedules'][number]): number {
  return (s.active_from ? 1 : 0) + (s.active_to ? 1 : 0);
}

/**
 * Variante pública de `upgradeContent` para callers que solo tienen el
 * `content` (sin el material entero) — típicamente UI durante un upgrade
 * manual en el drawer. Semánticamente idéntica a la interna.
 */
export function upgradeContentToV2(
  category: BrandMaterialCategory,
  content: unknown,
): AnyContentV2 {
  return upgradeContent(category, content as Any);
}

/**
 * Upgrade v1 → v2 del campo `content` según categoría.
 *
 * Defensivo por diseño: los materiales v1 en producción pueden tener
 * campos faltantes, strings vacíos o tipos raros. Aplicamos fallbacks
 * tolerantes y dejamos que el caller decida si quiere validar el output
 * contra `CONTENT_SCHEMAS[cat].v2` (normalmente sí).
 *
 * El `default: never` garantiza que si se añade una categoría nueva en el
 * futuro sin actualizar este switch, el compilador avisa.
 */
function upgradeContent(
  category: BrandMaterialCategory,
  content: Any,
): AnyContentV2 {
  const c = (content ?? {}) as Record<string, unknown>;

  switch (category) {
    case 'schedule': {
      const out: ContentByCategory['schedule'] = {
        schema_version: 2,
        schedules: [{
          label: 'Horario regular',
          days: Array.isArray(c.days)
            ? (c.days as ScheduleContentV2T['schedules'][number]['days'])
            : [],
        }],
      };
      return out;
    }
    case 'promo': {
      const url   = typeof c.url === 'string' ? c.url.trim() : '';
      const out: ContentByCategory['promo'] = {
        schema_version: 2,
        title:       typeof c.title === 'string' ? c.title : '',
        description: typeof c.description === 'string' ? c.description : '',
        ...(url ? { cta: { label: 'Ver más', url } } : {}),
      };
      return out;
    }
    case 'data': {
      const out: ContentByCategory['data'] = {
        schema_version: 2,
        type: 'otro',
        name: typeof c.label === 'string' && c.label.trim() ? c.label : 'Dato',
        description: typeof c.description === 'string' ? c.description : '',
      };
      return out;
    }
    case 'quote': {
      const out: ContentByCategory['quote'] = {
        schema_version: 2,
        text:   typeof c.text === 'string' ? c.text : '',
        author: typeof c.author === 'string' && c.author.trim() ? c.author : '—',
      };
      return out;
    }
    case 'free': {
      const out: ContentByCategory['free'] = {
        schema_version: 2,
        content: typeof c.text === 'string' ? c.text : '',
      };
      return out;
    }
    default: {
      const _exhaustive: never = category;
      throw new Error(`Unknown brand_material category: ${String(_exhaustive)}`);
    }
  }
}
