// =============================================================================
// NEUROPOST — SeasonalAgent
// Generates posts for seasonal dates adapted to each brand's sector.
// =============================================================================

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SeasonalDate {
  id:          string;
  name:        string;
  date_type:   string;
  month:       number | null;
  day:         number | null;
  sectors:     string[];
  priority:    string;
  days_advance: number;
}

export interface UpcomingDate extends SeasonalDate {
  nextOccurrence: Date;
  daysUntil:      number;
}

export interface SeasonalContent {
  caption:            string;
  hashtags:           string[];
  visualIdea:         string;
  offerSuggestion:    string | null;
  publishDate:        string;
  format:             'imagen' | 'reel' | 'carrusel';
  alternativeCaption: string;
}

// ─── Upcoming dates calculator ────────────────────────────────────────────────

export function getUpcomingDatesForBrand(
  dates: SeasonalDate[],
  sector: string,
  daysAhead = 35,
): UpcomingDate[] {
  const now   = new Date();
  const limit = new Date(now.getTime() + daysAhead * 86400000);
  const year  = now.getFullYear();

  const upcoming: UpcomingDate[] = [];

  for (const d of dates) {
    // Filter by sector relevance
    if (!d.sectors.includes('all') && !d.sectors.includes(sector)) continue;
    if (d.date_type === 'variable' || d.month == null || d.day == null) continue;

    let target = new Date(year, d.month - 1, d.day);
    if (target < now) target = new Date(year + 1, d.month - 1, d.day);

    if (target <= limit) {
      const daysUntil = Math.ceil((target.getTime() - now.getTime()) / 86400000);
      upcoming.push({ ...d, nextOccurrence: target, daysUntil });
    }
  }

  return upcoming.sort((a, b) => a.daysUntil - b.daysUntil);
}

// ─── Content generator ───────────────────────────────────────────────────────

export async function generateSeasonalContent(input: {
  fecha:            string;
  diasRestantes:    number;
  sector:           string;
  brandName:        string;
  brandVoiceDoc:    string;
  previousYearPost: string | null;
  /** Words the brand has marked as forbidden. */
  forbiddenWords?:  string[];
  /** Topics the brand wants to avoid. */
  forbiddenTopics?: string[];
  /** Drop all emojis from captions. */
  noEmojis?:        boolean;
  /** Format preferences to honour the brand kit. */
  likesCarousels?:  boolean;
  includeVideos?:   boolean;
}): Promise<SeasonalContent> {
  const constraints: string[] = [];
  if (input.forbiddenWords?.length) {
    constraints.push(`NO uses jamás estas palabras: ${input.forbiddenWords.join(', ')}.`);
  }
  if (input.forbiddenTopics?.length) {
    constraints.push(`Evita por completo estos temas: ${input.forbiddenTopics.join(', ')}.`);
  }
  if (input.noEmojis) {
    constraints.push('NO uses emojis ni emoticonos en el caption ni en la alternativa.');
  }
  if (input.likesCarousels === false) {
    constraints.push('El cliente NO quiere carruseles — elige "imagen" o "reel" como formato.');
  }
  if (input.includeVideos === false) {
    constraints.push('El cliente NO incluye vídeos — elige "imagen" o "carrusel" como formato.');
  }

  const message = await client.messages.create({
    model:      'claude-opus-4-6',
    max_tokens: 1200,
    system: `Eres el creador de contenido de ${input.brandName}, una ${input.sector}.
Genera el contenido para ${input.fecha} que cae en ${input.diasRestantes} días.

El contenido debe:
- Ser relevante para la fecha sin ser forzado
- Conectar la fecha con el producto/servicio del negocio
- Tener el tono de marca correcto
- Incluir una oferta o promoción si tiene sentido para la fecha
- No repetir el contenido del año anterior
${constraints.length ? `\nREGLAS ESTRICTAS DE LA MARCA:\n${constraints.map(c => `- ${c}`).join('\n')}` : ''}

Devuelve SOLO JSON válido:
{
  "caption": "texto principal",
  "hashtags": ["#uno", "#dos"],
  "visualIdea": "descripción de qué foto o vídeo hacer",
  "offerSuggestion": "oferta sugerida o null",
  "publishDate": "días antes recomendados (ej: 2 días antes)",
  "format": "imagen",
  "alternativeCaption": "variante B"
}`,
    messages: [{
      role: 'user',
      content: `Fecha: ${input.fecha}
Días restantes: ${input.diasRestantes}
Guía de voz de marca: ${input.brandVoiceDoc}
Post del año anterior: ${input.previousYearPost ?? 'ninguno'}

Genera el contenido para esta fecha especial.`,
    }],
  });

  const text = (message.content[0] as { type: string; text: string }).text;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON in seasonal response');
  return JSON.parse(jsonMatch[0]) as SeasonalContent;
}
