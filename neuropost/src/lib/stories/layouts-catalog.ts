// =============================================================================
// Phase 2 — Story layouts catalog (client-safe metadata)
// =============================================================================
// Pure metadata for the layout catalog: no imports from render.tsx, no JSX, no
// next/og. Safe to bundle in client components (e.g. LayoutsGallery).
//
// The server-side render dispatch lives in ./layouts-render-registry.ts, which
// pairs each id with its LayoutXxx component. Consumers that need to execute a
// render (API routes, workers) import from the registry, not from here.
//
// The creative director (Phase 3) reads this catalog to pick layouts based on
// story_type, aesthetic_preset, image availability and pool source — it never
// needs the render function.

export type StoryType            = 'schedule' | 'promo' | 'quote' | 'data' | 'custom';
export type AestheticPreset      = 'moody' | 'creativo' | 'editorial' | 'natural' | 'minimalista' | 'clasico' | 'luxury' | 'vintage';
export type Tonality             = 'text_heavy' | 'photo_heavy' | 'balanced';
export type TextMode             = 'required' | 'optional' | 'none';
export type PreferredImageSource = 'media_library' | 'inspiration_references' | 'any' | 'none';

export interface LayoutDefinition {
  id:                     string;
  name:                   string;
  description:            string;
  supportsImage:          boolean;
  requiresImage:          boolean;
  supportsSchedule:       boolean;
  best_for:               StoryType[];
  aesthetic_affinity:     AestheticPreset[];
  tonality:               Tonality;
  text_mode:              TextMode;
  preferred_image_source: PreferredImageSource;
}

const ALL_AESTHETICS: AestheticPreset[] = [
  'moody', 'creativo', 'editorial', 'natural',
  'minimalista', 'clasico', 'luxury', 'vintage',
];

export const LAYOUT_CATALOG: LayoutDefinition[] = [
  {
    id:                     'centered',
    name:                   'Quote Clásica',
    description:            'Fondo color de marca, cita grande centrada en blanco.',
    supportsImage:          false,
    requiresImage:          false,
    supportsSchedule:       false,
    best_for:               ['quote', 'custom'],
    aesthetic_affinity:     ['moody', 'luxury'],
    tonality:               'text_heavy',
    text_mode:              'required',
    preferred_image_source: 'none',
  },
  {
    id:                     'minimal',
    name:                   'Quote Minimal',
    description:            'Fondo blanco con franja lateral en color de marca y tipografía condensada.',
    supportsImage:          false,
    requiresImage:          false,
    supportsSchedule:       false,
    best_for:               ['quote', 'custom', 'data'],
    aesthetic_affinity:     ['minimalista', 'editorial'],
    tonality:               'text_heavy',
    text_mode:              'required',
    preferred_image_source: 'none',
  },
  {
    id:                     'table',
    name:                   'Horario Semanal',
    description:            'Tabla limpia de días y horas sobre fondo blanco.',
    supportsImage:          false,
    requiresImage:          false,
    supportsSchedule:       true,
    best_for:               ['schedule'],
    aesthetic_affinity:     ['minimalista', 'clasico'],
    tonality:               'text_heavy',
    text_mode:              'required',
    preferred_image_source: 'none',
  },
  {
    id:                     'hero',
    name:                   'Horario Destacado',
    description:            'Día principal en grande sobre color de marca, resto del horario compacto debajo.',
    supportsImage:          false,
    requiresImage:          false,
    supportsSchedule:       true,
    best_for:               ['schedule'],
    aesthetic_affinity:     ['creativo', 'editorial'],
    tonality:               'balanced',
    text_mode:              'required',
    preferred_image_source: 'none',
  },
  {
    id:                     'banner',
    name:                   'Promo Banner',
    description:            'Mitad superior blanca con título de promo, mitad inferior en color de marca con CTA.',
    supportsImage:          false,
    requiresImage:          false,
    supportsSchedule:       false,
    best_for:               ['promo'],
    aesthetic_affinity:     ['creativo', 'luxury'],
    tonality:               'text_heavy',
    text_mode:              'required',
    preferred_image_source: 'none',
  },
  {
    id:                     'urgent',
    name:                   'Promo Urgente',
    description:            'Fondo oscuro dramático con título en color de marca y franjas de acento.',
    supportsImage:          false,
    requiresImage:          false,
    supportsSchedule:       false,
    best_for:               ['promo'],
    aesthetic_affinity:     ['moody', 'creativo'],
    tonality:               'text_heavy',
    text_mode:              'required',
    preferred_image_source: 'none',
  },
  {
    id:                     'stat',
    name:                   'Dato Destacado',
    description:            'Número o estadística enorme en color de marca, contexto corto debajo.',
    supportsImage:          false,
    requiresImage:          false,
    supportsSchedule:       false,
    best_for:               ['data'],
    aesthetic_affinity:     ['minimalista', 'editorial', 'clasico'],
    tonality:               'text_heavy',
    text_mode:              'required',
    preferred_image_source: 'none',
  },
  {
    id:                     'tagline',
    name:                   'Lema de Marca',
    description:            'Fondo color de marca con lema grande centrado y divisor horizontal.',
    supportsImage:          false,
    requiresImage:          false,
    supportsSchedule:       false,
    best_for:               ['quote', 'custom'],
    aesthetic_affinity:     ['editorial', 'luxury', 'clasico'],
    tonality:               'text_heavy',
    text_mode:              'required',
    preferred_image_source: 'none',
  },
  {
    id:                     'overlay',
    name:                   'Foto con Overlay',
    description:            'Color de marca con gradiente oscuro inferior y texto anclado abajo.',
    supportsImage:          false,
    requiresImage:          false,
    supportsSchedule:       false,
    best_for:               ['quote', 'custom'],
    aesthetic_affinity:     ['moody', 'vintage'],
    tonality:               'text_heavy',
    text_mode:              'required',
    preferred_image_source: 'none',
  },
  {
    id:                     'flexible',
    name:                   'Contenido Libre',
    description:            'Fondo claro con borde lateral y contenido de texto flexible.',
    supportsImage:          false,
    requiresImage:          false,
    supportsSchedule:       false,
    best_for:               ['custom', 'quote', 'data'],
    aesthetic_affinity:     ALL_AESTHETICS,
    tonality:               'text_heavy',
    text_mode:              'required',
    preferred_image_source: 'none',
  },
  {
    id:                     'photo_overlay',
    name:                   'Foto Full-Bleed',
    description:            'Foto de fondo a sangre con overlay oscuro y texto blanco grande encima.',
    supportsImage:          true,
    requiresImage:          true,
    supportsSchedule:       false,
    best_for:               ['quote', 'promo', 'custom'],
    aesthetic_affinity:     ['moody', 'editorial', 'natural', 'vintage'],
    tonality:               'photo_heavy',
    text_mode:              'optional',
    preferred_image_source: 'media_library',
  },
  {
    id:                     'photo_schedule',
    name:                   'Horario sobre Foto',
    description:            'Foto de fondo con overlay oscuro y tabla de horarios blanca encima.',
    supportsImage:          true,
    requiresImage:          true,
    supportsSchedule:       true,
    best_for:               ['schedule'],
    aesthetic_affinity:     ['natural', 'editorial', 'minimalista'],
    tonality:               'photo_heavy',
    text_mode:              'required',
    preferred_image_source: 'media_library',
  },
  // ─── New in Phase 2.B ─────────────────────────────────────────────────────
  {
    id:                     'photo_fullbleed_clean',
    name:                   'Foto Limpia',
    description:            'Foto a sangre sin texto ni overlay. Logo pequeño en esquina si existe.',
    supportsImage:          true,
    requiresImage:          true,
    supportsSchedule:       false,
    best_for:               ['custom', 'promo'],
    aesthetic_affinity:     ['moody', 'natural', 'creativo', 'luxury'],
    tonality:               'photo_heavy',
    text_mode:              'none',
    preferred_image_source: 'media_library',
  },
  {
    id:                     'photo_fullbleed_with_prop',
    name:                   'Foto con Prop',
    description:            'Foto a sangre con espacio reservado para props visuales (Fase 3). Renderiza igual que photo_fullbleed_clean mientras ctx.prop no exista.',
    supportsImage:          true,
    requiresImage:          true,
    supportsSchedule:       false,
    best_for:               ['custom', 'promo'],
    aesthetic_affinity:     ['moody', 'natural', 'creativo', 'luxury'],
    tonality:               'photo_heavy',
    text_mode:              'none',
    preferred_image_source: 'media_library',
  },
  {
    id:                     'photo_split_top',
    name:                   'Foto Split (Top)',
    description:            'Foto 60% arriba, bloque color de marca 40% abajo con copy en Display.',
    supportsImage:          true,
    requiresImage:          true,
    supportsSchedule:       false,
    best_for:               ['quote', 'custom', 'promo'],
    aesthetic_affinity:     ['editorial', 'minimalista', 'natural'],
    tonality:               'balanced',
    text_mode:              'required',
    preferred_image_source: 'media_library',
  },
  {
    id:                     'photo_split_bottom',
    name:                   'Foto Split (Bottom)',
    description:            'Bloque color de marca 40% arriba, foto 60% abajo.',
    supportsImage:          true,
    requiresImage:          true,
    supportsSchedule:       false,
    best_for:               ['quote', 'custom', 'promo'],
    aesthetic_affinity:     ['editorial', 'minimalista', 'natural'],
    tonality:               'balanced',
    text_mode:              'required',
    preferred_image_source: 'media_library',
  },
  {
    id:                     'photo_corner_text',
    name:                   'Foto con Texto en Esquina',
    description:            'Foto a sangre con overlay según brand, copy grande en esquina inferior izquierda.',
    supportsImage:          true,
    requiresImage:          true,
    supportsSchedule:       false,
    best_for:               ['custom', 'promo', 'quote'],
    aesthetic_affinity:     ['moody', 'natural', 'editorial'],
    tonality:               'photo_heavy',
    text_mode:              'optional',
    preferred_image_source: 'media_library',
  },
  {
    id:                     'photo_grid_schedule',
    name:                   'Horario Grid sobre Foto',
    description:            'Foto con overlay fuerte y grid DL-DG con fondo blanco semitransparente encima.',
    supportsImage:          true,
    requiresImage:          true,
    supportsSchedule:       true,
    best_for:               ['schedule'],
    aesthetic_affinity:     ['natural', 'editorial', 'luxury'],
    tonality:               'photo_heavy',
    text_mode:              'required',
    preferred_image_source: 'media_library',
  },
  {
    id:                     'editorial_large_title',
    name:                   'Título Editorial',
    description:            'Foto con overlay sutil y título tipográfico gigante arriba, subtítulo pequeño debajo.',
    supportsImage:          true,
    requiresImage:          true,
    supportsSchedule:       false,
    best_for:               ['custom', 'promo', 'quote'],
    aesthetic_affinity:     ['editorial', 'luxury', 'clasico'],
    tonality:               'balanced',
    text_mode:              'optional',
    preferred_image_source: 'media_library',
  },
  {
    id:                     'minimal_color_block',
    name:                   'Bloque Color Minimal',
    description:            'Bloque liso en color de marca con tipografía condensada enorme centrada.',
    supportsImage:          false,
    requiresImage:          false,
    supportsSchedule:       false,
    best_for:               ['quote', 'custom', 'data'],
    aesthetic_affinity:     ['minimalista', 'creativo'],
    tonality:               'text_heavy',
    text_mode:              'required',
    preferred_image_source: 'none',
  },
  {
    id:                     'stat_highlight_clean',
    name:                   'Dato Limpio',
    description:            'Fondo blanco, número gigante en primary y contexto corto debajo.',
    supportsImage:          false,
    requiresImage:          false,
    supportsSchedule:       false,
    best_for:               ['data'],
    aesthetic_affinity:     ['minimalista', 'editorial'],
    tonality:               'text_heavy',
    text_mode:              'required',
    preferred_image_source: 'none',
  },
  {
    id:                     'quote_editorial_serif',
    name:                   'Cita Editorial',
    description:            'Cita grande centrada en Display serif sobre fondo crema, mucho aire.',
    supportsImage:          false,
    requiresImage:          false,
    supportsSchedule:       false,
    best_for:               ['quote', 'custom'],
    aesthetic_affinity:     ['editorial', 'luxury', 'clasico'],
    tonality:               'text_heavy',
    text_mode:              'required',
    preferred_image_source: 'none',
  },
  {
    id:                     'product_hero_cta',
    name:                   'Producto con CTA',
    description:            'Foto a sangre, título arriba en Display y CTA en banda inferior con color de marca.',
    supportsImage:          true,
    requiresImage:          true,
    supportsSchedule:       false,
    best_for:               ['promo'],
    aesthetic_affinity:     ['creativo', 'luxury', 'editorial'],
    tonality:               'photo_heavy',
    text_mode:              'optional',
    preferred_image_source: 'media_library',
  },
  {
    id:                     'story_numbered_series',
    name:                   'Serie Numerada',
    description:            'Número grande tipo FAQ 01/02/03, título en Display y body abajo. Imagen opcional.',
    supportsImage:          true,
    requiresImage:          false,
    supportsSchedule:       false,
    best_for:               ['custom', 'quote'],
    aesthetic_affinity:     ['editorial', 'minimalista', 'clasico'],
    tonality:               'balanced',
    text_mode:              'required',
    preferred_image_source: 'media_library',
  },
  {
    id:                     'compare_split',
    name:                   'Comparativa Split',
    description:            'División vertical 50/50 en primary/secondary para comparar dos opciones.',
    supportsImage:          false,
    requiresImage:          false,
    supportsSchedule:       false,
    best_for:               ['promo', 'data'],
    aesthetic_affinity:     ['minimalista', 'creativo', 'editorial'],
    tonality:               'balanced',
    text_mode:              'required',
    preferred_image_source: 'none',
  },
];

export function getLayoutById(id: string): LayoutDefinition | null {
  return LAYOUT_CATALOG.find(l => l.id === id) ?? null;
}

export function getLayoutsForStoryType(type: StoryType): LayoutDefinition[] {
  return LAYOUT_CATALOG.filter(l => l.best_for.includes(type));
}

export function getLayoutsForAesthetic(preset: AestheticPreset): LayoutDefinition[] {
  return LAYOUT_CATALOG.filter(l => l.aesthetic_affinity.includes(preset));
}
