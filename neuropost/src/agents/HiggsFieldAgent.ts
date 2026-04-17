// =============================================================================
// NEUROPOST — HiggsFieldAgent
//
// Genera fotos y vídeos con personas usando Higgsfield AI cloud.
// Se activa cuando la solicitud requiere sujetos humanos (personas reales,
// retratos, equipo, clientes, escenas con gente).
//
// Flow:
//   1. Claude detecta si hay personas y construye el prompt óptimo
//   2. Se llama a Higgsfield (/api/v1/photo o /api/v1/video)
//   3. Se sube el resultado a Supabase Storage (assets bucket)
//   4. Se devuelve la URL pública para materializarla en un post
//   5. El post aparece en el dashboard del usuario con status 'generated'
// =============================================================================

import Anthropic from '@anthropic-ai/sdk';
import { generateHiggsImage, generateHiggsVideo } from '@/lib/higgsfield';
import type { VisualStyle, SocialSector, BrandColors } from '@/types';

const anthropic = new Anthropic();

// ─── Types ────────────────────────────────────────────────────────────────────

export type HiggsMediaFormat = 'photo' | 'video';

export interface HiggsFieldInput {
  /** Qué quiere el usuario: descripción libre de la solicitud. */
  userPrompt:        string;
  /** Formato de salida: foto estática o vídeo corto. */
  format:            HiggsMediaFormat;
  sector:            SocialSector;
  visualStyle:       VisualStyle;
  brandContext:      string;
  /** URL de imagen de referencia (opcional — para animar o mantener coherencia). */
  referenceImageUrl?: string;
  /** Duración del vídeo en segundos (sólo para format=video). */
  durationSec?:      number;
  brandId?:          string;
  colors?:           BrandColors | null;
  /** Palabras/conceptos que NO deben aparecer en el prompt ni en el output. */
  forbiddenWords?:   string[];
}

export interface HiggsFieldOutput {
  /** URL pública (Supabase) del archivo generado. */
  mediaUrl:       string;
  format:         HiggsMediaFormat;
  higgsTaskId:    string;
  enhancedPrompt: string;
  generationMs?:  number;
}

// ─── Aspect ratio por formato ─────────────────────────────────────────────────

const ASPECT_RATIO = {
  photo: {
    post:  '1:1'  as const,
    story: '9:16' as const,
    reel:  '4:5'  as const,
  },
  video: '9:16' as const,  // siempre vertical para Reels/Stories
};

// ─── Agent ────────────────────────────────────────────────────────────────────

export async function runHiggsFieldAgent(
  input: HiggsFieldInput,
): Promise<HiggsFieldOutput> {
  const start = Date.now();

  // ── Step 1: Claude construye el prompt optimizado para Higgsfield ─────────
  //
  // Higgsfield está especializado en personas: le damos contexto de marca,
  // sector y estilo para que el prompt sea preciso y coherente.

  const forbiddenClause = input.forbiddenWords?.length
    ? `\nDO NOT include: ${input.forbiddenWords.join(', ')}.`
    : '';

  const colorClause = input.colors?.primary
    ? `\nColor palette: primary ${input.colors.primary}${input.colors.secondary ? `, secondary ${input.colors.secondary}` : ''}.`
    : '';

  const systemPrompt = input.format === 'photo'
    ? `You are a prompt engineer specialised in Higgsfield AI photo generation.
Write a precise, vivid English prompt for a photo featuring REAL PEOPLE.
Focus on: subject description, pose, expression, clothing, lighting, background, mood.
Keep it under 120 words. No emojis, no hashtags.`
    : `You are a prompt engineer specialised in Higgsfield AI video generation.
Write a precise, vivid English prompt for a short social media video featuring REAL PEOPLE.
Focus on: who is in the scene, what they are doing, camera movement, lighting, atmosphere.
Keep it under 120 words. No emojis, no hashtags.`;

  const userMessage = `
Request: "${input.userPrompt}"
Sector: ${input.sector}
Visual style: ${input.visualStyle}
Brand context: ${input.brandContext}
Format: ${input.format === 'photo' ? 'square or 4:5 Instagram photo' : '9:16 vertical Instagram Reel/video'}
${colorClause}${forbiddenClause}

Write ONLY the prompt. No explanation.`.trim();

  const msg = await anthropic.messages.create({
    model:      'claude-sonnet-4-20250514',
    max_tokens: 200,
    messages: [{ role: 'user', content: `${systemPrompt}\n\n${userMessage}` }],
  });

  const enhancedPrompt = msg.content[0].type === 'text'
    ? msg.content[0].text.trim()
    : input.userPrompt;

  // ── Step 2: Llamar a Higgsfield ───────────────────────────────────────────

  let rawUrl: string;
  let taskId:  string;

  if (input.format === 'photo') {
    const result = await generateHiggsImage({
      prompt:              enhancedPrompt,
      negative_prompt:     'blurry, deformed, watermark, text, logo, low quality, distorted face',
      aspect_ratio:        ASPECT_RATIO.photo.post,
      ...(input.referenceImageUrl ? {} : {}),  // Higgsfield photo: no ref image needed
    });
    rawUrl = result.imageUrl;
    taskId  = result.taskId;
  } else {
    const result = await generateHiggsVideo({
      prompt:               enhancedPrompt,
      negative_prompt:      'blurry, shaky, watermark, text overlay, logo, low quality',
      aspect_ratio:         ASPECT_RATIO.video,
      duration:             (input.durationSec ?? 5) as import('@/lib/higgsfield').HiggsDuration,
      reference_image_url:  input.referenceImageUrl,
    });
    rawUrl = result.videoUrl;
    taskId  = result.taskId;
  }

  // ── Step 3: Upload a Supabase Storage ────────────────────────────────────

  let finalUrl = rawUrl;

  if (input.brandId) {
    try {
      const { createServerClient } = await import('@/lib/supabase');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const supabase = await createServerClient() as any;

      const mediaRes  = await fetch(rawUrl);
      const mediaBlob = await mediaRes.blob();

      const ext      = input.format === 'photo' ? 'jpg' : 'mp4';
      const folder   = input.format === 'photo' ? 'higgsfield/photos' : 'higgsfield/videos';
      const fileName = `${folder}/hf-${Date.now()}-${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}.${ext}`;
      const mime     = input.format === 'photo' ? 'image/jpeg' : 'video/mp4';

      const { error: uploadErr } = await supabase.storage
        .from('assets')
        .upload(fileName, mediaBlob, { contentType: mime, upsert: false });

      if (!uploadErr) {
        const { data: { publicUrl } } = supabase.storage.from('assets').getPublicUrl(fileName);
        finalUrl = publicUrl;
      } else {
        console.warn('[HiggsField] Supabase upload failed, usando URL directa:', uploadErr);
      }
    } catch (err) {
      console.warn('[HiggsField] Error subiendo a Supabase:', err);
    }
  }

  // ── Step 4: El runner persiste el output en agent_outputs ─────────────────
  //
  // Después de que el handler retorne, el runner guarda el output y el
  // campo preview_url. content:materialize_post puede entonces crear el
  // post en la tabla posts con status='generated'.
  //
  // El usuario ve el resultado en /posts (dashboard) de forma automática.
  // Si la marca tiene auto_publish=true, se publica directamente.

  return {
    mediaUrl:       finalUrl,
    format:         input.format,
    higgsTaskId:    taskId,
    enhancedPrompt,
    generationMs:   Date.now() - start,
  };
}
