// =============================================================================
// NEUROPOST — TrendsAgent
// Detects viral Instagram trends by sector and adapts them to each brand.
// =============================================================================

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Trend {
  title:       string;
  format:      'reel' | 'imagen' | 'carrusel';
  description: string;
  example:     string;
  viralScore:  number;
  expiresIn:   string;
  hashtags:    string[];
}

export interface TrendsDetectionResult {
  trends:      Trend[];
  weekSummary: string;
}

export interface AdaptedTrend {
  adaptedTitle:        string;
  caption:             string;
  hashtags:            string[];
  visualInstructions:  string;
  bestTimeToPost:      'ahora' | 'esta semana' | 'próxima semana';
  urgency:             'alta' | 'media' | 'baja';
}

export interface TrendsAdaptInput {
  trend:           Trend;
  brandVoiceDoc:   string;
  sector:          string;
  tone:            string;
  recentPosts:     string[];  // last 5 captions
}

// ─── Step 1: Detect trends by sector ─────────────────────────────────────────

export async function detectTrendsBySector(
  sector: string,
  ciudad: string,
  semanaActual: string,
): Promise<TrendsDetectionResult> {
  const message = await client.messages.create({
    model:      'claude-opus-4-6',
    max_tokens: 2000,
    system: `Eres un experto en tendencias de redes sociales.
Busca qué tipo de contenido está siendo viral esta semana en Instagram para negocios de tipo ${sector} en España.

Busca específicamente:
- Formatos que están funcionando (reels cortos, carruseles, fotos)
- Temas o narrativas populares en este sector
- Estilos visuales que generan más engagement
- Audios o músicas tendencia para reels (si aplica)
- Hashtags en auge esta semana

Devuelve SOLO JSON válido con esta estructura exacta:
{
  "trends": [
    {
      "title": "nombre de la tendencia",
      "format": "reel",
      "description": "cómo aplicarla",
      "example": "ejemplo concreto para este sector",
      "viralScore": 85,
      "expiresIn": "1-2 semanas",
      "hashtags": ["#uno", "#dos"]
    }
  ],
  "weekSummary": "resumen de qué está funcionando esta semana"
}`,
    messages: [{
      role: 'user',
      content: `Sector: ${sector}\nCiudad/Región: ${ciudad}\nSemana: ${semanaActual}\n\nGenera 5 tendencias actuales.`,
    }],
  });

  const text = (message.content[0] as { type: string; text: string }).text;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON in trends response');
  return JSON.parse(jsonMatch[0]) as TrendsDetectionResult;
}

// ─── Step 2: Adapt trend to brand ────────────────────────────────────────────

export async function adaptTrendToBrand(input: TrendsAdaptInput): Promise<AdaptedTrend> {
  const message = await client.messages.create({
    model:      'claude-opus-4-6',
    max_tokens: 1000,
    system: `Tienes una tendencia viral de Instagram y el perfil de un negocio local.
Adapta la tendencia al estilo específico de este negocio.

La adaptación debe:
- Mantener el formato viral pero con el contenido del negocio
- Respetar el tono de marca del cliente
- Ser ejecutable con fotos normales del negocio
- Incluir caption y hashtags listos para publicar

Devuelve SOLO JSON válido:
{
  "adaptedTitle": "cómo aplicar la tendencia a este negocio",
  "caption": "texto listo para publicar",
  "hashtags": ["#uno", "#dos"],
  "visualInstructions": "qué foto o vídeo hacer",
  "bestTimeToPost": "ahora",
  "urgency": "alta"
}`,
    messages: [{
      role: 'user',
      content: `Tendencia: ${JSON.stringify(input.trend)}
Sector: ${input.sector}
Tono de marca: ${input.tone}
Guía de voz de marca: ${input.brandVoiceDoc}
Últimos 5 posts del cliente: ${input.recentPosts.join(' | ')}`,
    }],
  });

  const text = (message.content[0] as { type: string; text: string }).text;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON in adapt response');
  return JSON.parse(jsonMatch[0]) as AdaptedTrend;
}
