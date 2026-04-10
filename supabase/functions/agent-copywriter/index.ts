import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import { callClaudeJSON } from '../_shared/claude.ts';
import { logAgent, timer } from '../_shared/logger.ts';
import { handleCors, json } from '../_shared/cors.ts';
import { COPYWRITER_SYSTEM_PROMPT } from './prompt.ts';

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const sb = getServiceClient();
  const elapsed = timer();

  try {
    // Get pending proposals
    const { data: proposals, error } = await sb
      .from('proposals')
      .select('*')
      .eq('status', 'pending_copy')
      .order('created_at', { ascending: true })
      .limit(10);

    if (error) throw new Error(error.message);
    if (!proposals?.length) return json({ message: 'No pending copy', processed: 0 });

    let processed = 0;

    for (const proposal of proposals) {
      const t = timer();
      try {
        // Mark as processing
        await sb.from('proposals').update({ status: 'processing_copy' }).eq('id', proposal.id);

        // Get brand
        const { data: brand } = await sb
          .from('brands')
          .select('name, sector, tone, visual_style, services, keywords, hashtags, slogans, brand_voice_doc, location, rules')
          .eq('id', proposal.brand_id)
          .single();

        if (!brand) throw new Error('Brand not found');

        // Get last 10 published captions
        const { data: recentCaptions } = await sb
          .from('posts')
          .select('caption, published_at, format')
          .eq('brand_id', proposal.brand_id)
          .eq('status', 'published')
          .order('published_at', { ascending: false })
          .limit(10);

        const input = {
          propuesta: {
            tema: proposal.tema,
            concepto_detallado: proposal.concepto,
            categoria: proposal.categoria,
            objetivo_negocio: proposal.objetivo,
            brief_copy: proposal.brief_copy,
            plataforma_principal: proposal.plataforma,
          },
          brand: {
            nombre: brand.name,
            sector: brand.sector,
            tono: brand.tone,
            servicios: brand.services ?? [],
            keywords: brand.keywords ?? [],
            hashtags_marca: brand.hashtags ?? [],
            esloganes: brand.slogans ?? [],
            voz_marca: brand.brand_voice_doc ?? '',
            ubicacion: brand.location,
            reglas: {
              sin_emojis: brand.rules?.no_emojis ?? false,
              palabras_prohibidas: brand.rules?.forbidden_words ?? [],
              temas_prohibidos: brand.rules?.forbidden_topics ?? [],
            },
          },
          ultimos_10_captions: (recentCaptions ?? []).map((c: Record<string, unknown>) => ({
            caption: (c.caption as string)?.slice(0, 300),
            tipo: c.format,
          })),
        };

        const result = await callClaudeJSON<{
          caption_instagram: string;
          caption_facebook: string;
          hashtags: { branded: string[]; nicho: string[]; broad: string[] };
          hook: string;
          cta: string;
          alt_text: string;
        }>(
          [{ role: 'user', content: JSON.stringify(input) }],
          { system: COPYWRITER_SYSTEM_PROMPT, maxTokens: 4096, temperature: 0.8 },
        );

        // Validate: check forbidden words
        const forbidden = brand.rules?.forbidden_words ?? [];
        const captionLower = (result.caption_instagram + ' ' + result.caption_facebook).toLowerCase();
        const foundForbidden = forbidden.filter((w: string) => captionLower.includes(w.toLowerCase()));

        if (foundForbidden.length > 0 && proposal.retry_count < 3) {
          // Regenerate with explicit instruction
          await sb.from('proposals').update({
            status: 'pending_copy',
            retry_count: (proposal.retry_count ?? 0) + 1,
            feedback: `Contenía palabras prohibidas: ${foundForbidden.join(', ')}. Regenerar evitándolas.`,
          }).eq('id', proposal.id);
          continue;
        }

        // Update proposal with copy
        await sb.from('proposals').update({
          caption_ig: result.caption_instagram,
          caption_fb: result.caption_facebook,
          hashtags: result.hashtags,
          status: 'pending_visual',
        }).eq('id', proposal.id);

        await logAgent(sb, 'copywriter', proposal.brand_id, 'success', { proposal_id: proposal.id }, t());
        processed++;
      } catch (err) {
        await sb.from('proposals').update({
          status: proposal.retry_count >= 2 ? 'failed' : 'pending_copy',
          retry_count: (proposal.retry_count ?? 0) + 1,
          feedback: String(err),
        }).eq('id', proposal.id);
        await logAgent(sb, 'copywriter', proposal.brand_id, 'error', { error: String(err), proposal_id: proposal.id }, t());
      }
    }

    return json({ processed });
  } catch (err) {
    await logAgent(sb, 'copywriter', null, 'error', { error: String(err) }, elapsed());
    return json({ error: String(err) }, 500);
  }
});
