import type { Brand, StoryType } from '@/types';

export const FALLBACK_QUOTES = [
  'Cada día es una oportunidad nueva.',
  'El cambio empieza en el paso siguiente.',
  'La constancia vence al talento.',
  'Hoy eliges lo que serás mañana.',
  'Los pequeños progresos también cuentan.',
  'Tu esfuerzo de hoy es el logro de mañana.',
  'No se trata de perfección, sino de progresión.',
  'Empezar ya es la mitad del camino.',
  'Un paso adelante vale más que mil intenciones.',
  'La disciplina supera a la motivación.',
];

const TONE_LABELS: Record<string, string> = {
  cercano:     'amigable y cercano',
  profesional: 'profesional y formal',
  divertido:   'energético y divertido',
  premium:     'sofisticado y exclusivo',
};

const VISUAL_STYLE_LABELS: Record<string, string> = {
  creative:   'creativo y colorido',
  elegant:    'elegante y minimalista',
  warm:       'cálido y humano',
  dynamic:    'dinámico y energético',
  editorial:  'editorial y sofisticado',
  dark:       'oscuro y dramático',
  fresh:      'fresco y luminoso',
  vintage:    'vintage y texturado',
};

// ─── Batch creative content (copy + image prompt) ────────────────────────────

export interface StorySlotInput {
  index:        number;
  type:         StoryType;
  existingCopy: string | null;
}

export function buildStoryCreativeBatchPrompt(brand: Brand, slots: StorySlotInput[]): string {
  const toneDesc  = brand.tone         ? (TONE_LABELS[brand.tone]               ?? String(brand.tone))         : 'profesional y cálido';
  const styleDesc = brand.visual_style ? (VISUAL_STYLE_LABELS[brand.visual_style] ?? brand.visual_style)       : 'limpio y profesional';

  const brandCtx = [
    `Negocio: ${brand.name}`,
    `Sector: ${brand.sector ?? 'negocio local'}`,
    brand.location         ? `Ubicación: ${brand.location}`                                 : null,
    `Tono: ${toneDesc}`,
    `Estilo visual: ${styleDesc}`,
    brand.description      ? `Descripción: ${brand.description}`                            : null,
    brand.services?.length  ? `Servicios: ${brand.services.slice(0, 6).join(', ')}`         : null,
    brand.slogans?.length   ? `Eslóganes: ${brand.slogans.slice(0, 3).join(' / ')}`         : null,
    brand.brand_voice_doc   ? `Voz de marca: ${brand.brand_voice_doc.slice(0, 400)}`        : null,
  ].filter(Boolean).join('\n');

  return `Eres un director creativo especialista en redes sociales para negocios del sector ${brand.sector ?? 'local'}.

MARCA:
${brandCtx}

TAREA: Para cada slot de historia de Instagram genera "copy" e "imagePrompt".

"copy" — texto breve en español (máx 15 palabras):
  - schedule: copia EXACTA del existingCopy (días y horas sin ningún cambio)
  - promo: texto promocional atractivo basado en existingCopy
  - quote/custom/data: frase auténtica y específica para este sector
    Dental: "Tu sonrisa habla antes de que digas nada.", "No esperes a que sea tarde.", "Una boca sana es tu mejor carta de presentación."
    Gym: "Cada repetición es un argumento contra las excusas.", "El dolor de hoy es el orgullo de mañana."
    Restaurante: "La mejor mesa es la que compartes.", "Cocina con alma para personas reales."

"imagePrompt" — prompt en INGLÉS para IA de imágenes (Flux Dev, fotorealista, sin texto en imagen, máx 70 palabras):
  Incluye: sujeto + estilo fotográfico + iluminación + mood. Adapta al sector con gran especificidad.
  Dental/schedule → "professional modern dental clinic reception, warm lighting, clean minimal, editorial photography, shallow depth of field"
  Dental/quote sonrisa → "extreme close-up perfect white teeth smiling, high contrast black and white, studio lighting, beauty photography"
  Dental/quote urgencia → "single tooth macro photography, dramatic side lighting, fine art healthcare concept, moody"
  Gym → "athletic person lifting weights, dramatic gym lighting, sweat, determination, cinematic, dark moody"
  Restaurante → "beautifully plated dish, natural side light, food photography, shallow bokeh, warm tones"

Slots:
${JSON.stringify(slots, null, 2)}

Responde ÚNICAMENTE con JSON array de ${slots.length} objetos:
[{ "copy": "...", "imagePrompt": "..." }, ...]`;
}

// ─── Legacy quote-only prompt ────────────────────────────────────────────────

export function buildQuotesPrompt(brand: Brand, count: number): string {
  const toneDesc = brand.tone
    ? (TONE_LABELS[brand.tone] ?? String(brand.tone))
    : 'profesional y cálido';

  const lines: string[] = [
    `Genera ${count} frases breves para historias de Instagram.`,
    '',
    `Negocio: ${brand.name}`,
    `Sector: ${brand.sector ?? 'negocio local'}`,
  ];

  if (brand.location)        lines.push(`Ubicación: ${brand.location}`);
  lines.push(`Tono de marca: ${toneDesc}`);
  if (brand.description)     lines.push(`Descripción: ${brand.description}`);
  if (brand.brand_voice_doc) {
    lines.push(`Voz de marca: ${brand.brand_voice_doc.slice(0, 300)}`);
  }

  lines.push(
    '',
    'Requisitos:',
    '- Cada frase 1-2 líneas, máximo 15 palabras.',
    '- Tono coherente con la voz de marca indicada.',
    '- Sin emojis.',
    '- Evita clichés genéricos.',
    '- Relacionadas con el sector/negocio cuando sea posible.',
    '',
    'Formato de respuesta: JSON array con strings.',
    'Ejemplo: ["Frase 1", "Frase 2"]',
    '',
    `Genera exactamente ${count} frases.`,
  );

  return lines.join('\n');
}
