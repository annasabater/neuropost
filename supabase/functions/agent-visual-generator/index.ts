import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import { callClaudeJSON } from '../_shared/claude.ts';
import { logAgent, timer } from '../_shared/logger.ts';
import { handleCors, json } from '../_shared/cors.ts';
import { VISUAL_PROMPT_SYSTEM } from './prompt.ts';

const NB2_API = 'https://api.nanobanana.com/v2/generate';

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const sb = getServiceClient();
  const elapsed = timer();

  try {
    const { data: proposals } = await sb
      .from('proposals')
      .select('*')
      .eq('status', 'pending_visual')
      .order('created_at', { ascending: true })
      .limit(5);

    if (!proposals?.length) return json({ message: 'No pending visuals', processed: 0 });

    let processed = 0;

    for (const proposal of proposals) {
      const t = timer();
      try {
        await sb.from('proposals').update({ status: 'generating_visual' }).eq('id', proposal.id);

        // Get brand for style context
        const { data: brand } = await sb
          .from('brands')
          .select('sector, visual_style, colors, name')
          .eq('id', proposal.brand_id)
          .single();

        // Generate optimized prompt via Claude
        const promptResult = await callClaudeJSON<{
          prompt: string;
          negative_prompt: string;
          aspect_ratio: string;
          style_preset: string;
        }>(
          [{ role: 'user', content: JSON.stringify({
            brief_visual: proposal.brief_visual,
            tipo: proposal.tipo,
            sector: brand?.sector,
            estilo_visual: brand?.visual_style,
            colores: brand?.colors,
          }) }],
          { system: VISUAL_PROMPT_SYSTEM, model: 'claude-haiku-4-5-20251001', maxTokens: 1024, temperature: 0.5 },
        );

        // Determine dimensions
        const dims: Record<string, { w: number; h: number }> = {
          '1:1': { w: 1080, h: 1080 },
          '4:5': { w: 1080, h: 1350 },
          '9:16': { w: 1080, h: 1920 },
        };
        const dim = dims[promptResult.aspect_ratio] ?? dims['1:1'];

        // Call image generation API
        const nbKey = Deno.env.get('NANOBANANA_API_KEY');
        let imageUrl: string | null = null;

        if (nbKey) {
          const genRes = await fetch(NB2_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${nbKey}` },
            body: JSON.stringify({
              prompt: promptResult.prompt,
              negative_prompt: promptResult.negative_prompt,
              width: dim.w,
              height: dim.h,
              num_outputs: 1,
            }),
          });

          if (genRes.ok) {
            const genData = await genRes.json();
            const rawUrl = genData.images?.[0]?.url ?? genData.output?.[0];

            if (rawUrl) {
              // Download and upload to Supabase Storage
              const imgRes = await fetch(rawUrl);
              const imgBlob = await imgRes.blob();
              const path = `generated/${proposal.brand_id}/${proposal.id}.webp`;

              await sb.storage.from('generated').upload(path, imgBlob, { contentType: 'image/webp', upsert: true });
              const { data: { publicUrl } } = sb.storage.from('generated').getPublicUrl(path);
              imageUrl = publicUrl;
            }
          }
        }

        if (!imageUrl) {
          // Fallback: use a placeholder or retry
          if ((proposal.retry_count ?? 0) < 3) {
            await sb.from('proposals').update({
              status: 'pending_visual',
              retry_count: (proposal.retry_count ?? 0) + 1,
              feedback: 'Image generation failed, retrying',
            }).eq('id', proposal.id);
            continue;
          }
          // After 3 retries, skip visual and move to QC without image
          await sb.from('proposals').update({ status: 'pending_qc' }).eq('id', proposal.id);
          continue;
        }

        await sb.from('proposals').update({
          image_url: imageUrl,
          status: 'pending_qc',
        }).eq('id', proposal.id);

        await logAgent(sb, 'visual-generator', proposal.brand_id, 'success', {
          proposal_id: proposal.id,
          prompt: promptResult.prompt.slice(0, 200),
        }, t());
        processed++;
      } catch (err) {
        await sb.from('proposals').update({
          status: (proposal.retry_count ?? 0) >= 2 ? 'failed' : 'pending_visual',
          retry_count: (proposal.retry_count ?? 0) + 1,
          feedback: String(err),
        }).eq('id', proposal.id);
        await logAgent(sb, 'visual-generator', proposal.brand_id, 'error', { error: String(err) }, t());
      }
    }

    return json({ processed });
  } catch (err) {
    await logAgent(sb, 'visual-generator', null, 'error', { error: String(err) }, elapsed());
    return json({ error: String(err) }, 500);
  }
});
