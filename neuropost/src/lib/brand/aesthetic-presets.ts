// =============================================================================
// aesthetic-presets.ts — Phase 1 creative direction catalog
// =============================================================================
// 8 curated aesthetic presets used by the brand kit's "Estética" section.
// Fields are persisted on brands.aesthetic_preset; the generation pipeline
// will read from them in Fases 2-5.
// =============================================================================

export interface AestheticPreset {
  id:                        'moody' | 'creativo' | 'editorial' | 'natural' | 'minimalista' | 'clasico' | 'luxury' | 'vintage';
  name:                      string;
  tagline:                   string;
  cover_image:               string;
  mood_keywords:             string[];
  default_overlay_intensity: 'none' | 'subtle' | 'medium' | 'strong';
}

export const AESTHETIC_PRESETS: AestheticPreset[] = [
  {
    id:                        'moody',
    name:                      'MOODY',
    tagline:                   'Dramático · Intenso · Nocturno',
    cover_image:               'https://picsum.photos/seed/moody-preset/600/400',
    mood_keywords:             ['dramatic', 'dark', 'intense', 'shadows', 'cinematic', 'moody'],
    default_overlay_intensity: 'strong',
  },
  {
    id:                        'creativo',
    name:                      'CREATIVO',
    tagline:                   'Vibrante · Atrevido · Juguetón',
    cover_image:               'https://picsum.photos/seed/creativo-preset/600/400',
    mood_keywords:             ['vibrant', 'bold', 'playful', 'colorful', 'dynamic'],
    default_overlay_intensity: 'subtle',
  },
  {
    id:                        'editorial',
    name:                      'EDITORIAL',
    tagline:                   'Refinado · Narrativo · Tipográfico',
    cover_image:               'https://picsum.photos/seed/editorial-preset/600/400',
    mood_keywords:             ['editorial', 'refined', 'magazine-style', 'typographic', 'sophisticated'],
    default_overlay_intensity: 'medium',
  },
  {
    id:                        'natural',
    name:                      'NATURAL',
    tagline:                   'Cálido · Orgánico · Auténtico',
    cover_image:               'https://picsum.photos/seed/natural-preset/600/400',
    mood_keywords:             ['warm', 'organic', 'authentic', 'natural-light', 'earthy'],
    default_overlay_intensity: 'subtle',
  },
  {
    id:                        'minimalista',
    name:                      'MINIMALISTA',
    tagline:                   'Limpio · Espacioso · Esencial',
    cover_image:               'https://picsum.photos/seed/minimalista-preset/600/400',
    mood_keywords:             ['clean', 'minimal', 'spacious', 'white-space', 'essential'],
    default_overlay_intensity: 'none',
  },
  {
    id:                        'clasico',
    name:                      'CLÁSICO',
    tagline:                   'Atemporal · Equilibrado · Sobrio',
    cover_image:               'https://picsum.photos/seed/clasico-preset/600/400',
    mood_keywords:             ['timeless', 'classic', 'balanced', 'elegant', 'understated'],
    default_overlay_intensity: 'medium',
  },
  {
    id:                        'luxury',
    name:                      'LUXURY',
    tagline:                   'Premium · Elegante · Exclusivo',
    cover_image:               'https://picsum.photos/seed/luxury-preset/600/400',
    mood_keywords:             ['luxury', 'premium', 'elegant', 'gold-accents', 'high-end'],
    default_overlay_intensity: 'strong',
  },
  {
    id:                        'vintage',
    name:                      'VINTAGE',
    tagline:                   'Nostálgico · Retro · Texturizado',
    cover_image:               'https://picsum.photos/seed/vintage-preset/600/400',
    mood_keywords:             ['vintage', 'retro', 'nostalgic', 'film-grain', 'textured'],
    default_overlay_intensity: 'medium',
  },
];

export function getPresetById(id: string | null | undefined): AestheticPreset | null {
  if (!id) return null;
  return AESTHETIC_PRESETS.find(p => p.id === id) ?? null;
}
