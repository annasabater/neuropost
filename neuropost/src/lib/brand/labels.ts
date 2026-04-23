// =============================================================================
// Brand kit — human-readable Spanish labels for internal enum values
// =============================================================================

export const VISUAL_STYLE_LABELS: Record<string, string> = {
  fresh:     'Natural',
  elegant:   'Minimalista',
  editorial: 'Editorial',
  warm:      'Clásico',
  creative:  'Creativo',
  dynamic:   'Moody',
  dark:      'Luxury',
  vintage:   'Vintage',
};

export const TONE_LABELS: Record<string, string> = {
  cercano:      'Cercano',
  profesional:  'Profesional',
  divertido:    'Divertido',
  premium:      'Premium',
};

export const PLAN_LABELS: Record<string, string> = {
  starter: 'Plan Starter',
  pro:     'Plan Pro',
  total:   'Plan Total',
};

export const PUBLISH_MODE_LABELS: Record<string, string> = {
  manual: 'Manual',
  semi:   'Supervisado',
  auto:   'Automático',
};

export const EMOJI_USE_LABELS: Record<string, string> = {
  none:     'Sin emojis',
  moderate: 'Emojis moderados',
  free:     'Emojis libres',
};

export const LANGUAGE_LABELS: Record<string, string> = {
  castellano: 'Castellano',
  catalan:    'Catalán',
  bilingual:  'Bilingüe',
};

export function labelVisualStyle(v?: string | null): string {
  return v ? (VISUAL_STYLE_LABELS[v] ?? v) : 'No configurado';
}

export function labelTone(v?: string | null): string {
  return v ? (TONE_LABELS[v] ?? v) : 'No configurado';
}

export function labelPlan(v?: string | null): string {
  return v ? (PLAN_LABELS[v] ?? v) : '—';
}

export function labelPublishMode(v?: string | null): string {
  return v ? (PUBLISH_MODE_LABELS[v] ?? v) : 'No configurado';
}

export function labelEmojiUse(v?: string | null): string {
  return v ? (EMOJI_USE_LABELS[v] ?? v) : '';
}

export function labelLanguage(v?: string | null): string {
  return v ? (LANGUAGE_LABELS[v] ?? v) : '';
}
