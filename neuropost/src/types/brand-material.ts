// Sprint 12: brand_material v2 — tipos + schemas Zod.
// Convive con el tipo legacy `BrandMaterial` y `BrandMaterialCategory`
// que siguen exportados desde `./index.ts` para compatibilidad con
// código v1 que ya los importa.

import { z } from 'zod';
import type { BrandMaterialCategory } from './index';

// Re-exportamos para que los callers puedan importar todo lo nuevo
// desde '@/types/brand-material' sin tener que mezclar imports.
export type { BrandMaterialCategory } from './index';
export type { BrandMaterial } from './index';

export type SchemaVersion = 1 | 2;

// ───────────────────────────────────────────────────────────────────────────
// v1 (legacy) — shape exactamente tal como hoy se guarda en BD.
// .strict(): si llega un objeto con campos extra (típicamente vestigios de
// v2 como `schema_version: 2`, `schedules`, `type`, etc.), el parse falla y
// el dispatcher en cascada intenta v2. Esto evita aceptar inputs híbridos.
// ───────────────────────────────────────────────────────────────────────────

const DayEnum = z.enum([
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
]);

export const ScheduleContentV1 = z.object({
  schema_version: z.literal(1).optional(),
  days: z.array(z.object({
    day:   DayEnum,
    hours: z.string(),
  })),
}).strict();

export const PromoContentV1 = z.object({
  schema_version: z.literal(1).optional(),
  title:       z.string(),
  description: z.string().optional(),
  url:         z.string().optional(),
}).strict();

export const DataContentV1 = z.object({
  schema_version: z.literal(1).optional(),
  label:       z.string(),
  description: z.string(),
}).strict();

export const QuoteContentV1 = z.object({
  schema_version: z.literal(1).optional(),
  text:   z.string(),
  author: z.string().optional(),
}).strict();

export const FreeContentV1 = z.object({
  schema_version: z.literal(1).optional(),
  text: z.string(),
}).strict();

// ───────────────────────────────────────────────────────────────────────────
// v2
// No usamos .strict() en v2 — permitimos extensiones futuras sin migración.
// Los datetimes se guardan como ISO strings (z.string().datetime()).
// ───────────────────────────────────────────────────────────────────────────

export const ScheduleContentV2 = z.object({
  schema_version: z.literal(2),
  schedules: z.array(z.object({
    label:       z.string().min(1),
    days: z.array(z.object({
      day:   DayEnum,
      hours: z.string(),
      note:  z.string().optional(),
    })),
    active_from: z.string().datetime().optional(),
    active_to:   z.string().datetime().optional(),
  })).min(1),
  exceptions: z.array(z.object({
    date:   z.string(),
    reason: z.string(),
    hours:  z.string().optional(),
  })).optional(),
});

export const PromoContentV2 = z.object({
  schema_version: z.literal(2),
  title:       z.string().min(1),
  description: z.string(),
  cta: z.object({
    label: z.string(),
    url:   z.string().url(),
  }).optional(),
  valid_from:      z.string().datetime().optional(),
  valid_to:        z.string().datetime().optional(),
  conditions:      z.string().optional(),
  target_audience: z.array(z.string()).optional(),
  discount: z.object({
    type:  z.enum(['percent', 'fixed', 'free']),
    value: z.string().optional(),
  }).optional(),
});

// Catálogo (id interno sigue siendo 'data')
export const DataContentV2 = z.object({
  schema_version: z.literal(2),
  type: z.enum([
    'servicio', 'tratamiento', 'carta', 'clase',
    'producto', 'experiencia', 'otro',
  ]),
  name:        z.string().min(1),
  description: z.string(),
  variants: z.array(z.object({
    label:       z.string().min(1),
    description: z.string().optional(),
    price:       z.string().optional(),
    valid_from:  z.string().datetime().optional(),
    valid_to:    z.string().datetime().optional(),
  })).optional(),
  price:           z.string().optional(),
  duration:        z.string().optional(),
  target_audience: z.array(z.string()).optional(),
  tags:            z.array(z.string()).optional(),
});

export const QuoteContentV2 = z.object({
  schema_version: z.literal(2),
  text:   z.string().min(1),
  author: z.string().min(1),
  source: z.enum(['cliente', 'equipo', 'propietario', 'prensa']).optional(),
  date:   z.string().optional(),
  related_service: z.string().optional(),
});

export const FreeContentV2 = z.object({
  schema_version: z.literal(2),
  title:   z.string().optional(),
  content: z.string().min(1),
  intent:  z.enum(['historia', 'valores', 'tono_marca', 'aviso', 'otro']).optional(),
});

// ───────────────────────────────────────────────────────────────────────────
// Dispatcher (category, schema_version) -> schema Zod
// F4 lo usará en cascada: intenta la versión declarada primero; si falla,
// intenta la otra; si ambas fallan → 422.
// ───────────────────────────────────────────────────────────────────────────

export const CONTENT_SCHEMAS = {
  schedule: { v1: ScheduleContentV1, v2: ScheduleContentV2 },
  promo:    { v1: PromoContentV1,    v2: PromoContentV2    },
  data:     { v1: DataContentV1,     v2: DataContentV2     },
  quote:    { v1: QuoteContentV1,    v2: QuoteContentV2    },
  free:     { v1: FreeContentV1,     v2: FreeContentV2     },
} as const;

// ───────────────────────────────────────────────────────────────────────────
// ContentByCategory — mapping tipo → tipo (v2). Permite que lectores
// pidan `BrandMaterialV2<'data'>` y obtengan `DataContentV2` sin castear.
// ───────────────────────────────────────────────────────────────────────────

export type ContentByCategory = {
  schedule: z.infer<typeof ScheduleContentV2>;
  promo:    z.infer<typeof PromoContentV2>;
  data:     z.infer<typeof DataContentV2>;
  quote:    z.infer<typeof QuoteContentV2>;
  free:     z.infer<typeof FreeContentV2>;
};

// Union de todos los content v2 — útil cuando la categoría no es conocida en
// tiempo de compilación (ej. al iterar sobre una lista heterogénea).
export type AnyContentV2 = ContentByCategory[BrandMaterialCategory];

// ───────────────────────────────────────────────────────────────────────────
// BrandMaterialV2 — la row completa tras F1.
// Incluye las columnas nuevas (priority/platforms/tags/active_from/active_to)
// y mantiene valid_until como string | null para compatibilidad con lectores
// legacy. display_order se conserva también.
// ───────────────────────────────────────────────────────────────────────────

export interface BrandMaterialV2<
  C extends BrandMaterialCategory = BrandMaterialCategory,
> {
  id:            string;
  brand_id:      string;
  category:      C;
  content:       ContentByCategory[C];
  active:        boolean;
  valid_until:   string | null;
  active_from:   string | null;
  active_to:     string | null;
  priority:      number;
  platforms:     string[];
  tags:          string[];
  display_order: number;
  created_at:    string;
  updated_at:    string;
}

// Tipos derivados útiles (no dependen de z.infer directamente para que sean
// estables si Zod cambia).
export type ScheduleContentV2T = z.infer<typeof ScheduleContentV2>;
export type PromoContentV2T    = z.infer<typeof PromoContentV2>;
export type DataContentV2T     = z.infer<typeof DataContentV2>;
export type QuoteContentV2T    = z.infer<typeof QuoteContentV2>;
export type FreeContentV2T     = z.infer<typeof FreeContentV2>;

export type ScheduleContentV1T = z.infer<typeof ScheduleContentV1>;
export type PromoContentV1T    = z.infer<typeof PromoContentV1>;
export type DataContentV1T     = z.infer<typeof DataContentV1>;
export type QuoteContentV1T    = z.infer<typeof QuoteContentV1>;
export type FreeContentV1T     = z.infer<typeof FreeContentV1>;

// Guard de runtime: permite descubrir en qué versión está un content dado.
export function detectSchemaVersion(content: unknown): SchemaVersion {
  if (typeof content === 'object' && content !== null) {
    const sv = (content as { schema_version?: unknown }).schema_version;
    if (sv === 2) return 2;
  }
  return 1;
}

