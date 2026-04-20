// =============================================================================
// NEUROPOST — Claude Vision analysis for inspiration items
// Three flavours:
//   analyzeImage     → single image  (original)
//   analyzeCarousel  → N images      (Instagram carousel)
//   analyzeVideo     → 3 frames      (video treated as ordered frames)
// All return hidden_prompt (EN) + category + tags + colors + mood.
// =============================================================================

import { anthropic } from '@/lib/anthropic';
import type {
  VisionAnalysisImage,
  VisionAnalysisCarousel,
  VisionAnalysisVideo,
  InspirationCategory,
} from './types';

const CATEGORY_LIST =
  'heladeria, restaurante, cafeteria, gym, clinica, barberia, boutique, inmobiliaria, ' +
  'panaderia, cocteleria, street_food, vinoteca, nail_art, estetica, maquillaje, peluqueria, tattoo, ' +
  'moda_hombre, zapateria, skincare, yoga, dental, clinica_estetica, nutricion, psicologia, fisioterapia, ' +
  'decoracion, jardineria, reformas, inmobiliaria_lujo, arquitectura, fotografia, academia, abogado, ' +
  'veterinario, mecanica, consultoria, teatro, arte, libreria, gaming, viajes, hotel, floristeria, ' +
  'regalos, tecnologia, ecommerce, agencia_marketing, hostal, casa_rural, camping, agencia_viajes, ' +
  'museo, galeria, sala_conciertos, cine, escape_room, otros';

const SYSTEM_IMAGE = `Eres un analista visual para un banco de inspiración de marketing en redes sociales.
Recibes una imagen y debes clasificarla y describirla para un motor de generación tipo Flux.

Devuelves SOLO un JSON válido (sin fences markdown, sin texto alrededor) con esta forma exacta:

{
  "hidden_prompt": "string en INGLÉS, muy descriptivo (70-120 palabras), incluyendo: sujeto, acción, composición, iluminación, paleta, estilo fotográfico, ambiente.",
  "category": "uno de: ${CATEGORY_LIST}",
  "tags": ["3-8 tags cortos en español, minúsculas, sin almohadilla"],
  "dominant_colors": ["3-5 hex codes exactos tipo #F5E6C8"],
  "mood": "1-3 palabras en español describiendo el ambiente emocional"
}

Si no identificas el sector con seguridad, usa "otros". Nunca inventes datos.`;

const SYSTEM_CAROUSEL = `Eres un analista visual para carruseles de Instagram.
Recibes varias slides (imágenes) en orden. Clasifica el carrusel en conjunto y describe cada slide.

Devuelves SOLO un JSON válido con esta forma exacta:

{
  "hidden_prompt": "string en INGLÉS describiendo el carrusel completo — el concepto general, el estilo cohesivo entre slides, y el objetivo comunicativo (70-120 palabras).",
  "slide_prompts": ["un prompt en INGLÉS por cada slide, 30-60 palabras cada uno, en el MISMO orden recibido"],
  "category": "uno de: ${CATEGORY_LIST}",
  "tags": ["3-8 tags en español"],
  "dominant_colors": ["3-5 hex codes"],
  "mood": "1-3 palabras en español"
}`;

const SYSTEM_VIDEO = `Eres un analista visual para vídeos cortos (Reels/TikTok).
Recibes 3 frames extraídos del vídeo en orden temporal (inicio, medio, final).

Devuelves SOLO un JSON válido con esta forma exacta:

{
  "hidden_prompt": "string en INGLÉS describiendo la escena completa, como si fueras a generar un vídeo similar con Kling v2 — sujeto, setting, mood, estilo (70-120 palabras).",
  "scene_prompts": ["un prompt en INGLÉS por cada frame, 30-50 palabras cada uno, en orden temporal"],
  "motion_description": "string en INGLÉS describiendo el movimiento entre frames: cámara, sujeto, transiciones (30-60 palabras)",
  "category": "uno de: ${CATEGORY_LIST}",
  "tags": ["3-8 tags en español"],
  "dominant_colors": ["3-5 hex codes"],
  "mood": "1-3 palabras en español"
}`;

function cleanJsonFromMarkdown(raw: string): string {
  return raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
}

function buildImageBlock(buffer: Buffer, mimeType: string) {
  return {
    type: 'image' as const,
    source: {
      type:       'base64' as const,
      media_type: (mimeType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'),
      data:       buffer.toString('base64'),
    },
  };
}

async function askVision<T>(systemPrompt: string, userContent: unknown[]): Promise<T> {
  const msg = await anthropic.messages.create({
    model:      'claude-sonnet-4-5',
    max_tokens: 1500,
    system:     systemPrompt,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    messages:   [{ role: 'user', content: userContent as any }],
  });
  const text = msg.content
    .filter(b => b.type === 'text')
    .map(b => (b as { type: 'text'; text: string }).text)
    .join('');
  const cleaned = cleanJsonFromMarkdown(text);
  try {
    return JSON.parse(cleaned) as T;
  } catch (err) {
    throw new Error(`Vision returned invalid JSON: ${String(err)} — raw: ${cleaned.slice(0, 200)}`);
  }
}

// ─── Single image ───────────────────────────────────────────────────────────

export async function analyzeImage(
  buffer:   Buffer,
  mimeType: string = 'image/jpeg',
): Promise<VisionAnalysisImage> {
  const parsed = await askVision<VisionAnalysisImage>(SYSTEM_IMAGE, [
    buildImageBlock(buffer, mimeType),
    { type: 'text', text: 'Analiza esta imagen y devuelve el JSON.' },
  ]);

  return {
    hidden_prompt:   parsed.hidden_prompt ?? '',
    category:        (parsed.category ?? 'otros') as InspirationCategory,
    tags:            Array.isArray(parsed.tags) ? parsed.tags : [],
    dominant_colors: Array.isArray(parsed.dominant_colors) ? parsed.dominant_colors : [],
    mood:            parsed.mood ?? '',
  };
}

// ─── Carousel (multiple images) ─────────────────────────────────────────────

export async function analyzeCarousel(
  images: { buffer: Buffer; mimeType: string }[],
): Promise<VisionAnalysisCarousel> {
  const blocks: unknown[] = [];
  images.forEach((img, i) => {
    blocks.push(buildImageBlock(img.buffer, img.mimeType));
    blocks.push({ type: 'text', text: `Slide ${i + 1}.` });
  });
  blocks.push({ type: 'text', text: 'Devuelve el JSON analizando el carrusel completo.' });

  const parsed = await askVision<VisionAnalysisCarousel>(SYSTEM_CAROUSEL, blocks);

  return {
    hidden_prompt:   parsed.hidden_prompt ?? '',
    slide_prompts:   Array.isArray(parsed.slide_prompts) ? parsed.slide_prompts : [],
    category:        (parsed.category ?? 'otros') as InspirationCategory,
    tags:            Array.isArray(parsed.tags) ? parsed.tags : [],
    dominant_colors: Array.isArray(parsed.dominant_colors) ? parsed.dominant_colors : [],
    mood:            parsed.mood ?? '',
  };
}

// ─── Video (3 ordered frames) ───────────────────────────────────────────────

export async function analyzeVideo(
  frames: { buffer: Buffer; mimeType: string }[],
): Promise<VisionAnalysisVideo> {
  const blocks: unknown[] = [];
  frames.forEach((f, i) => {
    blocks.push(buildImageBlock(f.buffer, f.mimeType));
    blocks.push({ type: 'text', text: `Frame ${i + 1} (${i === 0 ? 'inicio' : i === frames.length - 1 ? 'final' : 'medio'}).` });
  });
  blocks.push({ type: 'text', text: 'Analiza los frames como un vídeo corto y devuelve el JSON.' });

  const parsed = await askVision<VisionAnalysisVideo>(SYSTEM_VIDEO, blocks);

  return {
    hidden_prompt:       parsed.hidden_prompt ?? '',
    scene_prompts:       Array.isArray(parsed.scene_prompts) ? parsed.scene_prompts : [],
    motion_description:  parsed.motion_description ?? '',
    category:            (parsed.category ?? 'otros') as InspirationCategory,
    tags:                Array.isArray(parsed.tags) ? parsed.tags : [],
    dominant_colors:     Array.isArray(parsed.dominant_colors) ? parsed.dominant_colors : [],
    mood:                parsed.mood ?? '',
  };
}
