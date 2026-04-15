// =============================================================================
// Cron: monthly-report — send monthly PDF report link to all active brands
// =============================================================================
// Runs on the 1st of each month at 10am. Sends an email with a link to
// /api/reports/monthly?month=YYYY-MM for the previous month.

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { notify } from '@/lib/notify';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export const dynamic    = 'force-dynamic';
export const maxDuration = 30;

export async function GET(request: Request) {
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET ?? ''}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const db = createAdminClient() as DB;

  // Calculate previous month
  const now = new Date();
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const monthStr = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`;
  const monthName = prevMonth.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

  // Get all active brands (with at least 1 published post)
  const { data: brands } = await db
    .from('brands')
    .select('id, name, plan')
    .not('plan', 'is', null);

  let sent = 0;

  for (const brand of (brands ?? []) as Array<{ id: string; name: string; plan: string }>) {
    // Check if brand had any activity last month
    const startDate = prevMonth.toISOString().slice(0, 10);
    const endDate = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);

    const { count } = await db
      .from('posts')
      .select('id', { count: 'exact', head: true })
      .eq('brand_id', brand.id)
      .eq('status', 'published')
      .gte('published_at', startDate)
      .lte('published_at', endDate);

    if ((count ?? 0) === 0) continue;

    // Send notification with report link
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://neuropost.app';
    const reportUrl = `${appUrl}/api/reports/monthly?month=${monthStr}`;

    await notify(
      brand.id,
      'published',
      `Tu informe mensual de ${monthName} ya está listo. Revisa tus métricas de rendimiento.`,
      { report_url: reportUrl, month: monthStr },
    ).catch(() => null);

    sent++;
  }

  console.log(`[monthly-report] Sent ${sent} report notifications for ${monthName}`);
  return NextResponse.json({ ok: true, sent, month: monthStr });
}
