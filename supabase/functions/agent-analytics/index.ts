import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import { callClaudeJSON } from '../_shared/claude.ts';
import { logAgent, timer } from '../_shared/logger.ts';
import { handleCors, json } from '../_shared/cors.ts';

const ANALYST_SYSTEM = `Eres un analista de marketing digital para negocios locales. Generas informes mensuales claros en el idioma del negocio.

Recibirás: métricas de posts del mes, datos de comunidad, datos del mes anterior.

Devuelve EXCLUSIVAMENTE JSON:
{
  "scores": { "overall": 1-10, "content": 1-10, "community": 1-10, "growth": 1-10, "execution": 1-10 },
  "top_posts": [{"post_id": "...", "razon": "..."}],
  "low_posts": [{"post_id": "...", "razon": "..."}],
  "insights": [{"tipo": "fortaleza | debilidad | oportunidad", "texto": "..."}],
  "recommendations": [{"prioridad": "alta | media | baja", "texto": "...", "impacto_esperado": "..."}],
  "resumen_ejecutivo": "3-5 frases resumiendo el mes"
}

Benchmarks engagement por sector: restaurante 2.5-4%, heladería 3-5.5%, retail 1.5-3%, otro 1.5-3.5%.
Escribe en el idioma del negocio. Lenguaje directo, sin jerga de marketing.`;

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const sb = getServiceClient();
  const elapsed = timer();

  try {
    // Determine period (previous month)
    const now = new Date();
    const month = now.getMonth() === 0 ? 12 : now.getMonth();
    const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
    const nextMonth = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`;

    const { data: brands } = await sb.from('brands').select('id, name, sector, plan, tone').not('plan', 'is', null);
    if (!brands?.length) return json({ message: 'No brands' });

    let processed = 0;

    for (const brand of brands) {
      const t = timer();
      try {
        // Get posts from this month
        const { data: posts } = await sb
          .from('posts')
          .select('id, caption, status, format, published_at, quality_score, metrics, hashtags')
          .eq('brand_id', brand.id)
          .gte('created_at', monthStart)
          .lt('created_at', nextMonth);

        if (!posts?.length) continue;

        // Get previous month posts for comparison
        const prevMonthStart = month === 1
          ? `${year - 1}-12-01`
          : `${year}-${String(month - 1).padStart(2, '0')}-01`;
        const { data: prevPosts } = await sb
          .from('posts')
          .select('id, status, metrics')
          .eq('brand_id', brand.id)
          .gte('created_at', prevMonthStart)
          .lt('created_at', monthStart);

        // Get community stats
        const { count: totalComments } = await sb
          .from('comments')
          .select('id', { count: 'exact', head: true })
          .eq('brand_id', brand.id)
          .gte('created_at', monthStart)
          .lt('created_at', nextMonth);

        const result = await callClaudeJSON<Record<string, unknown>>(
          [{ role: 'user', content: JSON.stringify({
            periodo: { mes: month, año: year },
            brand: { nombre: brand.name, sector: brand.sector, tono: brand.tone },
            posts_mes: posts.map(p => ({
              id: p.id, status: p.status, format: p.format, quality_score: p.quality_score,
              metricas: p.metrics ?? {}, publicado: p.published_at,
            })),
            posts_mes_anterior: (prevPosts ?? []).map(p => ({
              id: p.id, status: p.status, metricas: p.metrics ?? {},
            })),
            comunidad: { total_comentarios: totalComments ?? 0 },
          }) }],
          { system: ANALYST_SYSTEM, maxTokens: 4096, temperature: 0.3 },
        );

        // Store report
        await sb.from('analytics_reports').insert({
          brand_id: brand.id,
          month,
          year,
          report: result,
          created_at: new Date().toISOString(),
        });

        await logAgent(sb, 'analytics', brand.id, 'success', { month, year }, t());
        processed++;
      } catch (err) {
        await logAgent(sb, 'analytics', brand.id, 'error', { error: String(err) }, t());
      }
    }

    return json({ processed, month, year });
  } catch (err) {
    await logAgent(sb, 'analytics', null, 'error', { error: String(err) }, elapsed());
    return json({ error: String(err) }, 500);
  }
});
