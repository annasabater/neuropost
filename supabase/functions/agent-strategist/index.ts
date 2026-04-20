import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import { callClaudeJSON } from '../_shared/claude.ts';
import { logAgent, timer } from '../_shared/logger.ts';
import { handleCors, json } from '../_shared/cors.ts';
import { STRATEGIST_SYSTEM_PROMPT } from './prompt.ts';

const PLAN_PROPOSALS: Record<string, number> = {
  starter: 3, pro: 5, total: 7, agency: 7,
};

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const sb = getServiceClient();
  const elapsed = timer();

  try {
    // 1. Get all active brands with valid subscriptions
    const { data: brands, error: bErr } = await sb
      .from('brands')
      .select('id, name, sector, plan, tone, visual_style, location, services, keywords, hashtags, slogans, brand_voice_doc, colors, rules, last_login_at')
      .not('plan', 'is', null);

    if (bErr) throw new Error(`Brands query: ${bErr.message}`);
    if (!brands?.length) return json({ message: 'No brands to process' });

    // Current week boundaries (Monday-Sunday)
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const weekStart = monday.toISOString().slice(0, 10);

    let processed = 0;
    let errors = 0;

    for (const brand of brands) {
      try {
        // Skip if proposals already exist for this week
        const { count } = await sb
          .from('proposals')
          .select('id', { count: 'exact', head: true })
          .eq('brand_id', brand.id)
          .eq('week_start', weekStart);

        if ((count ?? 0) > 0) continue;

        const proposalsPerWeek = PLAN_PROPOSALS[brand.plan] ?? 3;

        // Get last 30 posts with metrics
        const { data: recentPosts } = await sb
          .from('posts')
          .select('id, caption, status, format, published_at, created_at, quality_score, hashtags, platform, metrics')
          .eq('brand_id', brand.id)
          .order('created_at', { ascending: false })
          .limit(30);

        // Get upcoming seasonal dates
        const { data: seasonalDates } = await sb
          .from('seasonal_dates')
          .select('*')
          .gte('date', weekStart)
          .lte('date', sunday.toISOString().slice(0, 10));

        // Get previously rejected proposals this month
        const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        const { data: prevProposals } = await sb
          .from('proposals')
          .select('tema, categoria, status')
          .eq('brand_id', brand.id)
          .gte('week_start', monthStart);

        // Build available days (excluding no-publish days)
        const noPublishDays: number[] = brand.rules?.dias_sin_publicacion ?? brand.rules?.no_publish_days ?? [];
        const availableDays: string[] = [];
        for (let d = 0; d < 7; d++) {
          const date = new Date(monday);
          date.setDate(monday.getDate() + d);
          const dayOfWeek = date.getDay();
          if (!noPublishDays.includes(dayOfWeek)) {
            availableDays.push(date.toISOString().slice(0, 10));
          }
        }

        // Build historial summary
        const posts = recentPosts ?? [];
        const publishedPosts = posts.filter(p => p.status === 'published' && p.metrics);
        const avgEngagement = publishedPosts.length > 0
          ? publishedPosts.reduce((sum, p) => sum + (p.metrics?.engagement_rate ?? 0), 0) / publishedPosts.length
          : 0;

        // Call Claude
        const input = {
          brand: {
            nombre: brand.name,
            sector: brand.sector,
            tono: brand.tone,
            estilo_visual: brand.visual_style,
            ubicacion: brand.location,
            servicios: brand.services ?? [],
            keywords: brand.keywords ?? [],
            hashtags_marca: brand.hashtags ?? [],
            esloganes: brand.slogans ?? [],
            voz_marca: brand.brand_voice_doc ?? '',
            colores: brand.colors ?? {},
            reglas: {
              dias_sin_publicacion: noPublishDays,
              sin_emojis: brand.rules?.no_emojis ?? false,
              palabras_prohibidas: brand.rules?.forbidden_words ?? [],
              temas_prohibidos: brand.rules?.forbidden_topics ?? [],
            },
          },
          plan: {
            nombre: brand.plan,
            propuestas_semana: proposalsPerWeek,
          },
          historial: {
            ultimos_30_posts: posts.map(p => ({
              tipo: p.format,
              tema_resumen: p.caption?.slice(0, 100) ?? '',
              metricas: p.metrics ?? {},
              fecha: (p.published_at ?? p.created_at)?.slice(0, 10),
            })),
            engagement_rate_medio: avgEngagement,
          },
          calendario_fechas: (seasonalDates ?? []).map((d: Record<string, unknown>) => ({
            fecha: d.date,
            nombre: d.name,
            relevancia_sector: d.sectors?.includes?.(brand.sector) ? 'alta' : 'media',
          })),
          semana_actual: {
            lunes: weekStart,
            domingo: sunday.toISOString().slice(0, 10),
            dias_disponibles: availableDays,
          },
          propuestas_anteriores_mes: (prevProposals ?? []).map((p: Record<string, unknown>) => ({
            tema_resumen: p.tema,
            categoria: p.categoria,
            estado: p.status,
          })),
        };

        const result = await callClaudeJSON<{
          propuestas: Array<{
            orden: number;
            tipo: string;
            categoria: string;
            tema: string;
            concepto_detallado: string;
            objetivo_negocio: string;
            dia_publicacion: string;
            hora_publicacion: string;
            plataforma_principal: string;
            brief_visual: Record<string, unknown>;
            brief_copy: Record<string, unknown>;
            notas_estrategicas: string;
          }>;
        }>(
          [{ role: 'user', content: JSON.stringify(input) }],
          { system: STRATEGIST_SYSTEM_PROMPT, model: 'claude-sonnet-4-20250514', maxTokens: 8192, temperature: 0.7 },
        );

        // Insert proposals
        const rows = (result.propuestas ?? []).map(p => ({
          brand_id: brand.id,
          week_start: weekStart,
          orden: p.orden,
          tipo: p.tipo,
          categoria: p.categoria,
          tema: p.tema,
          concepto: p.concepto_detallado,
          objetivo: p.objetivo_negocio,
          dia_publicacion: p.dia_publicacion,
          hora_publicacion: p.hora_publicacion,
          plataforma: p.plataforma_principal,
          brief_visual: p.brief_visual,
          brief_copy: p.brief_copy,
          strategy_notes: p.notas_estrategicas,
          status: 'pending_copy',
        }));

        if (rows.length > 0) {
          const { error: insErr } = await sb.from('proposals').insert(rows);
          if (insErr) throw new Error(`Insert proposals: ${insErr.message}`);
        }

        await logAgent(sb, 'content-strategist', brand.id, 'success', { proposals: rows.length }, elapsed());
        processed++;
      } catch (err) {
        errors++;
        await logAgent(sb, 'content-strategist', brand.id, 'error', { error: String(err) }, elapsed());
      }
    }

    return json({ processed, errors, week: weekStart });
  } catch (err) {
    await logAgent(sb, 'content-strategist', null, 'error', { error: String(err) }, elapsed());
    return json({ error: String(err) }, 500);
  }
});
