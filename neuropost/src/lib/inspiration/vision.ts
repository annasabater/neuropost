// =============================================================================
// NEUROPOST — Claude Vision analysis for inspiration images
// Returns hidden prompt (EN) + category + tags + colors + mood
// =============================================================================

import { anthropic } from '@/lib/anthropic';
import type { VisionAnalysisImage, InspirationCategory } from './types';

const SYSTEM_PROMPT = `Eres un analista visual para un banco de inspiración de marketing en redes sociales.
Recibes una imagen y debes clasificarla y describirla para un motor de generación tipo Flux.

Devuelves SOLO un JSON válido (sin fences markdown, sin texto alrededor) con esta forma exacta:

{
  "hidden_prompt": "string en INGLÉS, muy descriptivo (70-120 palabras), incluyendo: sujeto, acción, composición, iluminación, paleta, estilo fotográfico, ambiente. Este prompt se usa para regenerar imágenes similares.",
  "category": "uno de: heladeria, restaurante, cafeteria, gym, clinica, barberia, boutique, inmobiliaria, panaderia, cocteleria, street_food, vinoteca, nail_art, estetica, maquillaje, peluqueria, tattoo, moda_hombre, zapateria, skincare, yoga, dental, clinica_estetica, nutricion, psicologia, fisioterapia, decoracion, jardineria, reformas, inmobiliaria_lujo, arquitectura, fotografia, academia, abogado, veterinario, mecanica, consultoria, teatro, arte, libreria, gaming, viajes, hotel, floristeria, regalos, tecnologia, ecommerce, agencia_marketing, hostal, casa_rural, camping, agencia_viajes, museo, galeria, sala_conciertos, cine, escape_room, otros",
  "tags": ["3-8 tags cortos en español, minúsculas, sin almohadilla"],
  "dominant_colors": ["3-5 hex codes exactos tipo #F5E6C8"],
  "mood": "1-3 palabras en español describiendo el ambiente emocional"
}

Si no identificas el sector con seguridad, usa "otros". Nunca inventes datos.`;

function cleanJsonFromMarkdown(raw: string): string {
  // Strip ```json fences if Claude ever adds them
  return raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();
}

export async function analyzeImage(
  buffer:   Buffer,
  mimeType: string = 'image/jpeg',
): Promise<VisionAnalysisImage> {
  const b64 = buffer.toString('base64');

  const msg = await anthropic.messages.create({
    model:      'claude-sonnet-4-5',
    max_tokens: 800,
    system:     SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: {
            type:       'base64',
            media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
            data:       b64,
          },
        },
        {
          type: 'text',
          text: 'Analiza esta imagen y devuelve el JSON.',
        },
      ],
    }],
  });

  const text = msg.content
    .filter(b => b.type === 'text')
    .map(b => (b as { type: 'text'; text: string }).text)
    .join('');

  const cleaned = cleanJsonFromMarkdown(text);
  let parsed: VisionAnalysisImage;
  try {
    parsed = JSON.parse(cleaned) as VisionAnalysisImage;
  } catch (err) {
    throw new Error(`Vision returned invalid JSON: ${String(err)} — raw: ${cleaned.slice(0, 200)}`);
  }

  // Defensive defaults — Vision should always provide these, but be safe
  return {
    hidden_prompt:   parsed.hidden_prompt ?? '',
    category:        (parsed.category ?? 'otros') as InspirationCategory,
    tags:            Array.isArray(parsed.tags) ? parsed.tags : [],
    dominant_colors: Array.isArray(parsed.dominant_colors) ? parsed.dominant_colors : [],
    mood:            parsed.mood ?? '',
  };
}
