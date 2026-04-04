import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { calculateChurnScore, generateRetentionEmail } from '@/agents/ChurnAgent';
import { Resend } from 'resend';
import type { Brand } from '@/types';

export async function GET(request: Request) {
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET ?? ''}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const db     = createAdminClient();
  const resend = new Resend(process.env.RESEND_API_KEY);
  const now    = Date.now();

  const { data: brands } = await db
    .from('brands')
    .select('id,name,sector,user_id,plan,last_login_at,last_post_published_at,rejected_in_a_row,churn_risk,created_at');

  let processed = 0;
  let emailsSent = 0;

  for (const brand of brands ?? []) {
    const b = brand as Brand & { last_login_at: string | null; last_post_published_at: string | null; rejected_in_a_row: number; churn_risk: string };

    const daysSinceLogin     = b.last_login_at     ? Math.floor((now - new Date(b.last_login_at).getTime()) / 86400000)     : 999;
    const daysSincePublished = b.last_post_published_at ? Math.floor((now - new Date(b.last_post_published_at).getTime()) / 86400000) : 999;

    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
    const { count: postsThisMonth } = await db
      .from('posts').select('id', { count: 'exact', head: true })
      .eq('brand_id', b.id).eq('status', 'published')
      .gte('published_at', monthStart.toISOString());

    const planLimit    = b.plan === 'starter' ? 3 : 999;
    const planUsagePct = planLimit === 999 ? 1 : Math.min((postsThisMonth ?? 0) / planLimit, 1);

    const { score, risk, reasons } = calculateChurnScore({
      daysSinceLogin,
      daysSincePublished,
      planUsagePct,
      rejectedInARow: b.rejected_in_a_row ?? 0,
      engagementDropPct: 0,
    });

    // Update churn score
    await db.from('brands').update({ churn_score: score, churn_risk: risk }).eq('id', b.id);

    processed++;

    if (risk === 'low') continue;

    // Check if we sent a retention email recently (within 7 days)
    const sevenDaysAgo = new Date(now - 7 * 86400000).toISOString();
    const { count: recentActions } = await db
      .from('churn_actions').select('id', { count: 'exact', head: true })
      .eq('brand_id', b.id)
      .gte('created_at', sevenDaysAgo);

    if ((recentActions ?? 0) > 0) continue;

    // Get user email
    const { data: authUser } = await db.auth.admin.getUserById(b.user_id);
    const email = authUser?.user?.email;
    if (!email) continue;

    try {
      const { subject, body } = await generateRetentionEmail({
        brandName:    b.name,
        sector:       b.sector ?? 'negocio',
        diasInactivo: daysSinceLogin,
        lastActivity: b.last_login_at ?? b.created_at,
        churnRisk:    risk,
        reasons,
      });

      await resend.emails.send({
        from:    'NeuroPost <hola@neuropost.app>',
        to:      email,
        subject,
        html:    body,
      });

      await db.from('churn_actions').insert({
        brand_id:             b.id,
        action_type:          `email_${risk}`,
        churn_score_at_action: score,
        email_subject:        subject,
        email_body:           body,
      });

      emailsSent++;
    } catch { /* continue */ }
  }

  return NextResponse.json({ ok: true, processed, emailsSent });
}
