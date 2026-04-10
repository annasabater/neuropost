import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import { callClaudeJSON } from '../_shared/claude.ts';
import { logAgent, timer } from '../_shared/logger.ts';
import { handleCors, json } from '../_shared/cors.ts';

const QC_SYSTEM = `Eres el director de calidad de una agencia de social media premium. Evalúas imagen + caption contra los estándares de la marca.

Recibirás: imagen URL, caption, datos de marca, brief original.

Devuelve EXCLUSIVAMENTE JSON:
{
  "aprobado": true | false,
  "puntuacion_imagen": 1-10,
  "puntuacion_caption": 1-10,
  "puntuacion_coherencia": 1-10,
  "puntuacion_global": 1-10,
  "artefactos": [{"tipo": "...", "severidad": "critico | menor", "descripcion": "..."}],
  "caption_issues": {
    "contiene_prohibidas": false,
    "palabras_encontradas": [],
    "suena_a_ia": "alta | media | baja",
    "inventa_info": false
  },
  "decision": "aprobar | rechazar_imagen | rechazar_caption | rechazar_ambos",
  "feedback": "Si rechaza: instrucciones específicas para mejorar",
  "prompt_visual_mejorado": "Si rechaza imagen: nuevo prompt" | null
}

APRUEBA SI: global >= 7, 0 artefactos críticos, 0 prohibidas, suena_a_ia != alta
RECHAZA SI: global < 5, artefacto crítico, prohibidas, inventa info, suena_a_ia = alta
ZONA GRIS (5-7): si retry >= 2 aprobar, si < 2 rechazar con feedback`;

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const sb = getServiceClient();
  const elapsed = timer();

  try {
    const { data: proposals } = await sb
      .from('proposals')
      .select('*')
      .eq('status', 'pending_qc')
      .order('created_at', { ascending: true })
      .limit(10);

    if (!proposals?.length) return json({ message: 'No pending QC', processed: 0 });

    let processed = 0;

    for (const proposal of proposals) {
      const t = timer();
      try {
        await sb.from('proposals').update({ status: 'processing_qc' }).eq('id', proposal.id);

        const { data: brand } = await sb
          .from('brands')
          .select('name, sector, tone, visual_style, rules')
          .eq('id', proposal.brand_id)
          .single();

        const messages = [
          {
            role: 'user' as const,
            content: proposal.image_url
              ? [
                  { type: 'image', source: { type: 'url', url: proposal.image_url } },
                  { type: 'text', text: JSON.stringify({
                    caption_ig: proposal.caption_ig,
                    caption_fb: proposal.caption_fb,
                    hashtags: proposal.hashtags,
                    brief_original: { tema: proposal.tema, concepto: proposal.concepto, brief_visual: proposal.brief_visual, brief_copy: proposal.brief_copy },
                    brand: { nombre: brand?.name, sector: brand?.sector, tono: brand?.tone, estilo_visual: brand?.visual_style, reglas: brand?.rules },
                    retry_count: proposal.retry_count,
                  }) },
                ]
              : JSON.stringify({
                  caption_ig: proposal.caption_ig,
                  caption_fb: proposal.caption_fb,
                  hashtags: proposal.hashtags,
                  brief_original: { tema: proposal.tema },
                  brand: { nombre: brand?.name, tono: brand?.tone, reglas: brand?.rules },
                  retry_count: proposal.retry_count,
                  nota: 'No hay imagen — evaluar solo caption',
                }),
          },
        ];

        const result = await callClaudeJSON<{
          aprobado: boolean;
          puntuacion_global: number;
          decision: string;
          feedback: string;
          prompt_visual_mejorado: string | null;
          caption_issues: { contiene_prohibidas: boolean; suena_a_ia: string };
        }>(messages, { system: QC_SYSTEM, model: 'claude-sonnet-4-20250514', maxTokens: 4096, temperature: 0.2 });

        if (result.aprobado) {
          // Create actual post from approved proposal
          const { data: post } = await sb.from('posts').insert({
            brand_id: proposal.brand_id,
            caption: proposal.caption_ig,
            hashtags: [
              ...(proposal.hashtags?.branded ?? []),
              ...(proposal.hashtags?.nicho ?? []),
              ...(proposal.hashtags?.broad ?? []),
            ],
            image_url: proposal.image_url,
            format: proposal.tipo === 'carrusel' ? 'carousel' : proposal.tipo === 'foto' ? 'image' : proposal.tipo,
            platform: proposal.plataforma === 'ambas' ? ['instagram', 'facebook'] : [proposal.plataforma],
            status: 'generated',
            ai_explanation: JSON.stringify({ tema: proposal.tema, categoria: proposal.categoria, objetivo: proposal.objetivo }),
            quality_score: result.puntuacion_global,
            scheduled_at: proposal.dia_publicacion ? `${proposal.dia_publicacion}T${proposal.hora_publicacion ?? '10:00'}:00` : null,
          }).select('id').single();

          await sb.from('proposals').update({
            status: 'approved',
            quality_score: result.puntuacion_global,
            qc_feedback: result,
            post_id: post?.id ?? null,
          }).eq('id', proposal.id);

          // Notify user
          if (post?.id) {
            const { data: brandData } = await sb.from('brands').select('user_id').eq('id', proposal.brand_id).single();
            if (brandData?.user_id) {
              await sb.from('notifications').insert({
                user_id: brandData.user_id,
                type: 'approval_needed',
                title: `Nueva propuesta: ${proposal.tema}`,
                body: 'Tienes contenido nuevo para revisar',
                data: { post_id: post.id },
              });
            }
          }
        } else {
          // Handle rejection
          const nextStatus =
            result.decision === 'rechazar_imagen' ? 'pending_visual' :
            result.decision === 'rechazar_caption' ? 'pending_copy' :
            'pending_copy'; // rechazar_ambos starts from copy

          if ((proposal.retry_count ?? 0) >= 3) {
            await sb.from('proposals').update({
              status: 'failed',
              qc_feedback: result,
              feedback: result.feedback,
            }).eq('id', proposal.id);
          } else {
            await sb.from('proposals').update({
              status: nextStatus,
              retry_count: (proposal.retry_count ?? 0) + 1,
              qc_feedback: result,
              feedback: result.feedback,
              ...(result.prompt_visual_mejorado ? { brief_visual: { ...proposal.brief_visual, prompt_mejorado: result.prompt_visual_mejorado } } : {}),
            }).eq('id', proposal.id);
          }
        }

        await logAgent(sb, 'quality-control', proposal.brand_id, 'success', {
          proposal_id: proposal.id,
          aprobado: result.aprobado,
          score: result.puntuacion_global,
        }, t());
        processed++;
      } catch (err) {
        await sb.from('proposals').update({
          status: 'pending_qc',
          retry_count: (proposal.retry_count ?? 0) + 1,
        }).eq('id', proposal.id);
        await logAgent(sb, 'quality-control', proposal.brand_id, 'error', { error: String(err) }, t());
      }
    }

    return json({ processed });
  } catch (err) {
    await logAgent(sb, 'quality-control', null, 'error', { error: String(err) }, elapsed());
    return json({ error: String(err) }, 500);
  }
});
