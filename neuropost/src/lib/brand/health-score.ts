// =============================================================================
// Brand kit — health score calculator
// =============================================================================

import type { Brand } from '@/types';

export interface BrandHealthResult {
  score: number;
  missingItems: string[];
}

/**
 * Calculates how "complete" a brand configuration is (0–100).
 * `materialCount` and `contentRulesCount` must be fetched separately and passed in.
 */
export function calculateBrandHealth(
  brand: Brand,
  materialCount: number,
  contentRulesCount: number,
): BrandHealthResult {
  const missing: string[] = [];
  let score = 0;

  // Datos básicos (15 pts)
  const hasBasics = !!brand.name && !!brand.sector && !!brand.location;
  if (hasBasics) {
    score += 15;
  } else {
    missing.push('datos básicos del negocio');
  }

  // Logo + paleta completa (15 pts)
  const hasLogo   = !!brand.logo_url;
  const hasColors = !!(brand.colors?.primary && brand.colors?.secondary);
  if (hasLogo && hasColors) {
    score += 15;
  } else if (hasLogo || hasColors) {
    score += 7;
  } else {
    missing.push('logo y paleta de colores');
  }

  // Estética (10 pts)
  if (brand.visual_style) {
    score += 10;
  } else {
    missing.push('estilo visual');
  }

  // Tono (10 pts)
  if (brand.tone) {
    score += 10;
  } else {
    missing.push('tono de comunicación');
  }

  // Keywords (10 pts)
  if ((brand.hashtags?.length ?? 0) >= 3) {
    score += 10;
  } else {
    missing.push('palabras clave (mínimo 3)');
  }

  // Palabras a evitar (10 pts)
  if ((brand.rules?.forbiddenWords?.length ?? 0) >= 1) {
    score += 10;
  } else {
    missing.push('palabras a evitar');
  }

  // Idioma (5 pts)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((brand.rules as any)?.language) {
    score += 5;
  } else {
    missing.push('idioma');
  }

  // Emojis (5 pts)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((brand.rules as any)?.emojiUse) {
    score += 5;
  } else {
    missing.push('preferencia de emojis');
  }

  // Reglas de contenido (10 pts)
  if (contentRulesCount >= 1) {
    score += 10;
  } else {
    missing.push('reglas de contenido');
  }

  // Material de marca (10 pts)
  if (materialCount >= 5) {
    score += 10;
  } else {
    missing.push('material de marca (mínimo 5 items)');
  }

  return { score: Math.min(score, 100), missingItems: missing };
}
