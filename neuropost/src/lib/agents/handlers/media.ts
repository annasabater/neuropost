// =============================================================================
// content:tag_media — Media library intelligence
// =============================================================================
// When a user uploads images, this handler auto-tags them with category keys
// from the brand's taxonomy + descriptive labels. The strategy agent can then
// use existing assets instead of generating new ones.
//
// Input: { file_url: string, file_name?: string }
// Output: { tags: string[], category_key: string | null, description: string }

import Anthropic from '@anthropic-ai/sdk';
import { createAdminClient } from '@/lib/supabase';
import { registerHandler } from '../registry';
import type { AgentHandler, AgentJob, HandlerResult } from '../types';

const client = new Anthropic();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

const SYSTEM = `Eres un clasificador de imágenes para redes sociales de un negocio. Devuelve SOLO JSON:

{
  "tags": ["instalaciones", "zona pesas", "mañana"],
  "category_key": "facilities" o null si no encaja en ninguna,
  "description": "Foto del área de pesas del gimnasio con luz natural"
}

Reglas:
- "tags" son etiquetas descriptivas (3-8 tags, en español)
- "category_key" solo si existe una categoría que encaje en la lista proporcionada
- "description" es 1 frase para alt-text/búsqueda`;

const tagMediaHandler: AgentHandler = async (job: AgentJob): Promise<HandlerResult> => {
  if (!job.brand_id) return { type: 'fail', error: 'brand_id is required' };

  const input = job.input as { file_url?: string; file_name?: string };
  if (!input.file_url) return { type: 'fail', error: 'file_url is required' };

  try {
    const db = createAdminClient() as DB;

    // Load brand's taxonomy for category matching.
    const { data: categories } = await db
      .from('content_categories')
      .select('category_key, name')
      .eq('brand_id', job.brand_id);

    const catList = (categories ?? []) as Array<{ category_key: string; name: string }>;
    const catBlock = catList.length > 0
      ? `\nCategorías del negocio:\n${catList.map((c) => `• ${c.category_key} — ${c.name}`).join('\n')}`
      : '\nNo hay categorías definidas — deja category_key como null.';

    // Load the brand sector for context.
    const { data: brand } = await db
      .from('brands')
      .select('sector, name')
      .eq('id', job.brand_id)
      .maybeSingle();
    const sector = (brand as { sector?: string } | null)?.sector ?? 'unknown';
    const brandName = (brand as { name?: string } | null)?.name ?? '';

    const message = await client.messages.create({
      model:      'claude-haiku-4-5-20251001', // fast + cheap for classification
      max_tokens: 500,
      system:     SYSTEM,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: `Negocio: ${brandName} (${sector})${catBlock}\n\nClasifica esta imagen:` },
          { type: 'image', source: { type: 'url', url: input.file_url } },
        ],
      }],
    });

    const textBlock = message.content.find((c) => c.type === 'text');
    if (!textBlock || textBlock.type !== 'text') throw new Error('LLM returned no text');
    const cleaned = textBlock.text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const parsed = JSON.parse(cleaned) as {
      tags?: string[]; category_key?: string | null; description?: string;
    };

    return {
      type: 'ok',
      outputs: [{
        kind:    'analysis',
        payload: {
          file_url:     input.file_url,
          file_name:    input.file_name ?? null,
          tags:         parsed.tags ?? [],
          category_key: parsed.category_key ?? null,
          description:  parsed.description ?? '',
        } as unknown as Record<string, unknown>,
        model: 'claude-haiku-4-5-20251001',
      }],
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const transient = /timeout|rate.?limit|overloaded|503|504|ECONN/i.test(msg);
    return transient ? { type: 'retry', error: msg } : { type: 'fail', error: msg };
  }
};

export function registerMediaHandlers(): void {
  registerHandler({ agent_type: 'content', action: 'tag_media' }, tagMediaHandler);
}
