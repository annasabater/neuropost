import type { Brand } from '@/types';

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

  if (brand.location)       lines.push(`Ubicación: ${brand.location}`);
  lines.push(`Tono de marca: ${toneDesc}`);
  if (brand.description)    lines.push(`Descripción: ${brand.description}`);
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
