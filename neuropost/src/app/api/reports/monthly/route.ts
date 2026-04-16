// =============================================================================
// GET /api/reports/monthly — styled HTML monthly report (print-to-PDF ready)
// =============================================================================
// Returns a standalone HTML page with full monthly metrics, charts (CSS-only),
// top posts, and recommendations. The user opens it and uses Ctrl+P → Save as PDF.
// Also used by the monthly cron to email a link.
//
// Query params: ?month=2026-03 (defaults to previous month)

import { NextResponse } from 'next/server';
import { requireServerUser, createAdminClient } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export async function GET(request: Request) {
  try {
    const user = await requireServerUser();
    const db = createAdminClient() as DB;
    const { searchParams } = new URL(request.url);

    const { data: brand } = await db.from('brands').select('id, name, sector, logo_url').eq('user_id', user.id).single();
    if (!brand) return new Response('Brand not found', { status: 404 });

    // Parse month param (default: previous month)
    const now = new Date();
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const monthParam = searchParams.get('month') ?? `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`;
    const [year, month] = monthParam.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1).toISOString().slice(0, 10);
    const endDate   = new Date(year, month, 0).toISOString().slice(0, 10);
    const monthName = new Date(year, month - 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

    // Fetch analytics for the month
    const { data: analytics } = await db
      .from('post_analytics')
      .select('impressions, reach, likes, comments, saves, shares, engagement_rate, best_hour, best_day')
      .eq('brand_id', brand.id)
      .gte('published_at', startDate)
      .lte('published_at', endDate);

    const rows = (analytics ?? []) as Record<string, number>[];
    const sum = (f: string) => rows.reduce((a, r) => a + (r[f] ?? 0), 0);
    const avg = (f: string) => rows.length ? Math.round(sum(f) / rows.length * 100) / 100 : 0;

    const totalImpressions = sum('impressions');
    const totalReach       = sum('reach');
    const totalLikes       = sum('likes');
    const totalComments    = sum('comments');
    const totalSaves       = sum('saves');
    const totalShares      = sum('shares');
    const avgEngagement    = avg('engagement_rate');
    const totalPosts       = rows.length;

    // Previous month for comparison
    const prevStart = new Date(year, month - 2, 1).toISOString().slice(0, 10);
    const prevEnd   = new Date(year, month - 1, 0).toISOString().slice(0, 10);
    const { data: prevAnalytics } = await db
      .from('post_analytics')
      .select('impressions, reach, engagement_rate')
      .eq('brand_id', brand.id)
      .gte('published_at', prevStart)
      .lte('published_at', prevEnd);

    const prevRows = (prevAnalytics ?? []) as Record<string, number>[];
    const prevImpressions = prevRows.reduce((a, r) => a + (r.impressions ?? 0), 0);
    const prevReach       = prevRows.reduce((a, r) => a + (r.reach ?? 0), 0);
    const prevEngagement  = prevRows.length ? prevRows.reduce((a, r) => a + (r.engagement_rate ?? 0), 0) / prevRows.length : 0;

    const pct = (c: number, p: number) => p === 0 ? (c > 0 ? '+100' : '0') : (((c - p) / p) * 100).toFixed(1);
    const arrow = (v: string) => Number(v) >= 0 ? `<span style="color:#059669">+${v}%</span>` : `<span style="color:#DC2626">${v}%</span>`;

    // Top 3 posts
    const { data: topPosts } = await db
      .from('posts')
      .select('id, caption, image_url, edited_image_url, published_at, metrics')
      .eq('brand_id', brand.id)
      .eq('status', 'published')
      .gte('published_at', startDate)
      .lte('published_at', endDate)
      .order('published_at', { ascending: false })
      .limit(50);

    const sorted = ((topPosts ?? []) as Array<{ id: string; caption: string; image_url: string; edited_image_url: string; published_at: string; metrics: Record<string, number> | null }>)
      .filter(p => p.metrics)
      .sort((a, b) => ((b.metrics?.likes ?? 0) + (b.metrics?.comments ?? 0)) - ((a.metrics?.likes ?? 0) + (a.metrics?.comments ?? 0)))
      .slice(0, 3);

    // Best hour/day
    const hours = rows.map(r => r.best_hour).filter(h => h != null);
    const bestHour = hours.length ? Math.round(hours.reduce((a, b) => a + b, 0) / hours.length) : null;
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const days = rows.map(r => r.best_day).filter(d => d != null);
    const bestDay = days.length ? dayNames[Math.round(days.reduce((a, b) => a + b, 0) / days.length)] : null;

    // Build HTML report
    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Informe Mensual — ${brand.name} — ${monthName}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Barlow:wght@400;600;800&family=Barlow+Condensed:wght@700&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Barlow', sans-serif; background: #f8f8f8; color: #1a1a1a; }
    @media print { body { background: #fff; } .no-print { display: none !important; } }
    .container { max-width: 800px; margin: 0 auto; padding: 40px 24px; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; border-bottom: 3px solid #000; padding-bottom: 16px; }
    .header h1 { font-family: 'Barlow Condensed', sans-serif; font-size: 32px; font-weight: 700; text-transform: uppercase; }
    .header .date { color: #666; font-size: 14px; }
    .brand-name { font-size: 18px; font-weight: 600; color: #0F766E; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin: 24px 0; }
    .metric { background: #fff; border: 2px solid #e5e5e5; padding: 20px; text-align: center; }
    .metric .value { font-family: 'Barlow Condensed', sans-serif; font-size: 36px; font-weight: 700; }
    .metric .label { font-size: 12px; text-transform: uppercase; color: #666; margin-top: 4px; }
    .metric .change { font-size: 13px; margin-top: 4px; font-weight: 600; }
    .section { margin: 32px 0; }
    .section h2 { font-family: 'Barlow Condensed', sans-serif; font-size: 22px; font-weight: 700; text-transform: uppercase; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 16px; }
    .bar-chart { display: flex; flex-direction: column; gap: 8px; }
    .bar-row { display: flex; align-items: center; gap: 12px; }
    .bar-label { width: 100px; font-size: 13px; font-weight: 600; text-align: right; }
    .bar-bg { flex: 1; background: #e5e5e5; height: 24px; position: relative; }
    .bar-fill { height: 100%; background: #0F766E; transition: width 0.3s; }
    .bar-value { position: absolute; right: 8px; top: 3px; font-size: 12px; font-weight: 600; color: #fff; }
    .top-posts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
    .top-post { background: #fff; border: 2px solid #e5e5e5; overflow: hidden; }
    .top-post img { width: 100%; aspect-ratio: 1; object-fit: cover; display: block; }
    .top-post .info { padding: 12px; }
    .top-post .info p { font-size: 12px; color: #666; line-height: 1.4; }
    .top-post .info .stats { font-weight: 600; color: #000; margin-top: 8px; font-size: 13px; }
    .insight-box { background: #f0fdfa; border-left: 4px solid #0F766E; padding: 16px; margin: 8px 0; }
    .footer { margin-top: 40px; padding-top: 16px; border-top: 2px solid #e5e5e5; text-align: center; color: #999; font-size: 12px; }
    .print-btn { position: fixed; bottom: 24px; right: 24px; background: #0F766E; color: #fff; border: none; padding: 12px 24px; font-family: 'Barlow', sans-serif; font-weight: 700; font-size: 14px; cursor: pointer; text-transform: uppercase; }
    .print-btn:hover { background: #0D9488; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <div class="brand-name">${brand.name}</div>
        <h1>Informe Mensual</h1>
      </div>
      <div class="date">${monthName.charAt(0).toUpperCase() + monthName.slice(1)}</div>
    </div>

    <div class="grid">
      <div class="metric">
        <div class="value">${totalPosts}</div>
        <div class="label">Posts publicados</div>
      </div>
      <div class="metric">
        <div class="value">${totalImpressions.toLocaleString('es-ES')}</div>
        <div class="label">Impresiones</div>
        <div class="change">${arrow(pct(totalImpressions, prevImpressions))} vs mes anterior</div>
      </div>
      <div class="metric">
        <div class="value">${totalReach.toLocaleString('es-ES')}</div>
        <div class="label">Alcance</div>
        <div class="change">${arrow(pct(totalReach, prevReach))} vs mes anterior</div>
      </div>
    </div>

    <div class="grid">
      <div class="metric">
        <div class="value">${totalLikes.toLocaleString('es-ES')}</div>
        <div class="label">Likes</div>
      </div>
      <div class="metric">
        <div class="value">${totalComments.toLocaleString('es-ES')}</div>
        <div class="label">Comentarios</div>
      </div>
      <div class="metric">
        <div class="value">${totalSaves + totalShares}</div>
        <div class="label">Guardados + Compartidos</div>
      </div>
    </div>

    <div class="section">
      <h2>Engagement</h2>
      <div class="grid" style="grid-template-columns: 1fr 1fr;">
        <div class="metric">
          <div class="value">${avgEngagement.toFixed(2)}%</div>
          <div class="label">Tasa de engagement media</div>
          <div class="change">${arrow(pct(avgEngagement, prevEngagement))} vs mes anterior</div>
        </div>
        <div class="metric">
          <div class="value">${bestHour != null ? `${bestHour}:00` : '—'}</div>
          <div class="label">Mejor hora para publicar</div>
          ${bestDay ? `<div class="change" style="color:#0F766E">${bestDay}</div>` : ''}
        </div>
      </div>
    </div>

    <div class="section">
      <h2>Desglose de interacciones</h2>
      <div class="bar-chart">
        ${[
          { label: 'Likes', value: totalLikes },
          { label: 'Comentarios', value: totalComments },
          { label: 'Guardados', value: totalSaves },
          { label: 'Compartidos', value: totalShares },
        ].map(({ label, value }) => {
          const maxVal = Math.max(totalLikes, totalComments, totalSaves, totalShares, 1);
          const width = Math.max(2, (value / maxVal) * 100);
          return `<div class="bar-row">
            <div class="bar-label">${label}</div>
            <div class="bar-bg">
              <div class="bar-fill" style="width:${width}%">
                <span class="bar-value">${value.toLocaleString('es-ES')}</span>
              </div>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>

    ${sorted.length > 0 ? `
    <div class="section">
      <h2>Top Posts del Mes</h2>
      <div class="top-posts">
        ${sorted.map((p, i) => `
          <div class="top-post">
            ${(p.edited_image_url ?? p.image_url) ? `<img src="${p.edited_image_url ?? p.image_url}" alt="Post ${i + 1}">` : ''}
            <div class="info">
              <p>${(p.caption ?? '').slice(0, 80)}${(p.caption ?? '').length > 80 ? '...' : ''}</p>
              <div class="stats">${p.metrics?.likes ?? 0} likes &middot; ${p.metrics?.comments ?? 0} comentarios</div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>` : ''}

    <div class="section">
      <h2>Recomendaciones</h2>
      <div class="insight-box">
        ${bestHour != null ? `<p><strong>Publica a las ${bestHour}:00</strong> — es cuando tu audiencia interactúa más.</p>` : '<p>Publica más contenido para obtener datos de mejor horario.</p>'}
      </div>
      ${avgEngagement > 3 ? '<div class="insight-box"><p><strong>Engagement excelente</strong> — tu contenido resuena con tu audiencia. Mantén la estrategia actual.</p></div>' : ''}
      ${avgEngagement < 1.5 && avgEngagement > 0 ? '<div class="insight-box"><p><strong>Engagement bajo</strong> — prueba formatos como reels y carruseles para aumentar la interacción.</p></div>' : ''}
      ${totalPosts < 8 ? '<div class="insight-box"><p><strong>Publica más</strong> — con menos de 2 posts/semana es difícil crecer. Apunta a 3-4 posts semanales.</p></div>' : ''}
    </div>

    <div class="footer">
      <p>Generado por NeuroPost &middot; ${new Date().toLocaleDateString('es-ES')} &middot; ${brand.name}</p>
    </div>
  </div>

  <button class="print-btn no-print" onclick="window.print()">Descargar PDF</button>
</body>
</html>`;

    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (err) {
    console.error('[reports/monthly]', err);
    return new Response('Error generando el informe', { status: 500 });
  }
}
