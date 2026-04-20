import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import { callClaudeJSON } from '../_shared/claude.ts';
import { logAgent, timer } from '../_shared/logger.ts';
import { handleCors, json } from '../_shared/cors.ts';

const CLASSIFIER_SYSTEM = `Clasificas comentarios de redes sociales para negocios locales. Responde SOLO con JSON:
{
  "sentimiento": "positivo | neutro | negativo",
  "categoria": "pregunta | queja | cumplido | spam | general | crisis",
  "prioridad": "urgente | normal | baja",
  "requiere_humano": true | false,
  "es_spam": true | false
}
URGENTE si: intoxicación, denuncia, insulto grave, múltiples quejas. SPAM si: promo, links, "DM for collab".`;

const RESPONDER_SYSTEM = `Eres el community manager de un negocio local. Respondes en 1-3 frases, natural y humano. NADIE debe sospechar que eres IA.

Devuelve SOLO JSON:
{ "respuesta": "...", "tono_usado": "agradecido | informativo | empático | entusiasta" }

REGLAS: usa el tono de marca, nunca inventes datos (horarios, precios), si no sabes algo invita a escribir por DM.`;

const PLANS_WITH_AUTORESPOND = ['total', 'agency'];

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const sb = getServiceClient();
  const elapsed = timer();

  try {
    // Get unprocessed comments
    const { data: comments } = await sb
      .from('comments')
      .select('*, posts!inner(brand_id, caption)')
      .is('sentiment', null)
      .order('created_at', { ascending: true })
      .limit(20);

    if (!comments?.length) return json({ message: 'No pending comments', processed: 0 });

    let processed = 0;
    let autoReplied = 0;
    let escalated = 0;

    for (const comment of comments) {
      const t = timer();
      const brandId = comment.posts?.brand_id;
      if (!brandId) continue;

      try {
        // Get brand
        const { data: brand } = await sb
          .from('brands')
          .select('name, tone, plan, rules, meta_access_token, ig_user_id')
          .eq('id', brandId)
          .single();

        if (!brand) continue;

        // Step 1: Classify with Haiku (fast + cheap)
        const classification = await callClaudeJSON<{
          sentimiento: string;
          categoria: string;
          prioridad: string;
          requiere_humano: boolean;
          es_spam: boolean;
        }>(
          [{ role: 'user', content: JSON.stringify({
            comentario: comment.text,
            usuario: comment.author_name,
            contexto_post: comment.posts?.caption?.slice(0, 200),
          }) }],
          { system: CLASSIFIER_SYSTEM, model: 'claude-haiku-4-5-20251001', maxTokens: 256, temperature: 0.1 },
        );

        // Update comment with classification
        await sb.from('comments').update({
          sentiment: classification.sentimiento,
          category: classification.categoria,
          priority: classification.prioridad,
        }).eq('id', comment.id);

        // Decision logic
        if (classification.es_spam) {
          await sb.from('comments').update({ status: 'spam' }).eq('id', comment.id);
          continue;
        }

        if (classification.requiere_humano || classification.prioridad === 'urgente') {
          await sb.from('comments').update({ status: 'escalated' }).eq('id', comment.id);
          // Notify
          const { data: brandOwner } = await sb.from('brands').select('user_id').eq('id', brandId).single();
          if (brandOwner?.user_id) {
            await sb.from('notifications').insert({
              user_id: brandOwner.user_id,
              type: 'comment_escalated',
              title: classification.prioridad === 'urgente' ? 'Comentario urgente' : 'Comentario requiere atención',
              body: `${comment.author_name}: "${comment.text?.slice(0, 80)}"`,
              data: { comment_id: comment.id },
            });
          }
          escalated++;
          continue;
        }

        // Check no-auto-reply to negative
        if (classification.sentimiento === 'negativo' && brand.rules?.no_auto_reply_negative) {
          await sb.from('comments').update({ status: 'escalated' }).eq('id', comment.id);
          escalated++;
          continue;
        }

        // Auto-respond only if plan includes it
        if (!PLANS_WITH_AUTORESPOND.includes(brand.plan)) {
          await sb.from('comments').update({ status: 'classified' }).eq('id', comment.id);
          processed++;
          continue;
        }

        // Step 2: Generate response with Sonnet
        const response = await callClaudeJSON<{
          respuesta: string;
          tono_usado: string;
        }>(
          [{ role: 'user', content: JSON.stringify({
            comentario: comment.text,
            usuario: comment.author_name,
            sentimiento: classification.sentimiento,
            categoria: classification.categoria,
            brand: { nombre: brand.name, tono: brand.tone, reglas: brand.rules },
            contexto_post: comment.posts?.caption?.slice(0, 300),
          }) }],
          { system: RESPONDER_SYSTEM, maxTokens: 512, temperature: 0.7 },
        );

        // Post reply to Meta
        if (brand.meta_access_token && comment.ig_comment_id) {
          try {
            const metaRes = await fetch(
              `https://graph.facebook.com/v19.0/${comment.ig_comment_id}/replies`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  message: response.respuesta,
                  access_token: brand.meta_access_token,
                }),
              },
            );
            if (metaRes.ok) autoReplied++;
          } catch { /* Meta API failure is non-fatal */ }
        }

        await sb.from('comments').update({
          status: 'responded_auto',
          ai_reply: response.respuesta,
          ai_reply_tone: response.tono_usado,
        }).eq('id', comment.id);

        await logAgent(sb, 'community-manager', brandId, 'success', {
          comment_id: comment.id,
          action: 'auto_reply',
        }, t());
        processed++;
      } catch (err) {
        await logAgent(sb, 'community-manager', brandId, 'error', { error: String(err), comment_id: comment.id }, t());
      }
    }

    return json({ processed, autoReplied, escalated });
  } catch (err) {
    await logAgent(sb, 'community-manager', null, 'error', { error: String(err) }, elapsed());
    return json({ error: String(err) }, 500);
  }
});
