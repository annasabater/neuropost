// =============================================================================
// fonts-catalog.ts — curated font catalog for story rendering
// =============================================================================
// All fonts here are served by Google Fonts and have a TTF accessible via the
// Android User-Agent trick used by fetchBunnyFont in render.tsx (satori needs
// real TTF, not WOFF2).
//
// See docs/phase0-fonts.md for how to add a new font.
// =============================================================================

export interface FontDefinition {
  id:            string;
  google_family: string;
  weight:        number;
  role:          'display' | 'body';
  description:   string;
}

export const FONT_CATALOG: FontDefinition[] = [
  // ── Display ────────────────────────────────────────────────────────────────
  {
    id:            'barlow_condensed',
    google_family: 'Barlow Condensed',
    weight:        900,
    role:          'display',
    description:   'Deportivo, condensado, industrial',
  },
  {
    id:            'archivo_black',
    google_family: 'Archivo Black',
    weight:        400,
    role:          'display',
    description:   'Bold, impactante, urbano',
  },
  {
    id:            'bebas_neue',
    google_family: 'Bebas Neue',
    weight:        400,
    role:          'display',
    description:   'Condensado clásico, cartelera',
  },
  {
    id:            'playfair_display',
    google_family: 'Playfair Display',
    weight:        900,
    role:          'display',
    description:   'Editorial serif, sofisticado',
  },
  {
    id:            'dm_serif_display',
    google_family: 'DM Serif Display',
    weight:        400,
    role:          'display',
    description:   'Serif elegante, luxury',
  },
  {
    id:            'syne',
    google_family: 'Syne',
    weight:        800,
    role:          'display',
    description:   'Moderno, geométrico',
  },

  // ── Body ───────────────────────────────────────────────────────────────────
  {
    id:            'barlow',
    google_family: 'Barlow',
    weight:        700,
    role:          'body',
    description:   'Versátil, neutro',
  },
  {
    id:            'inter',
    google_family: 'Inter',
    weight:        600,
    role:          'body',
    description:   'Tech, limpio, UI-friendly',
  },
  {
    id:            'lato',
    google_family: 'Lato',
    weight:        700,
    role:          'body',
    description:   'Humanista, cálido',
  },
  {
    id:            'dm_sans',
    google_family: 'DM Sans',
    weight:        500,
    role:          'body',
    description:   'Minimalista moderno',
  },
  {
    id:            'source_sans_3',
    google_family: 'Source Sans 3',
    weight:        600,
    role:          'body',
    description:   'Editorial neutral',
  },
];

export const DEFAULT_DISPLAY_ID = 'barlow_condensed';
export const DEFAULT_BODY_ID    = 'barlow';

export function resolveFont(
  id: string | null | undefined,
  role: 'display' | 'body',
): FontDefinition {
  if (id) {
    const found = FONT_CATALOG.find(f => f.id === id && f.role === role);
    if (found) return found;
  }
  const defaultId = role === 'display' ? DEFAULT_DISPLAY_ID : DEFAULT_BODY_ID;
  const fallback  = FONT_CATALOG.find(f => f.id === defaultId);
  if (!fallback) {
    throw new Error(`fonts-catalog: default ${role} font '${defaultId}' missing from FONT_CATALOG`);
  }
  return fallback;
}
