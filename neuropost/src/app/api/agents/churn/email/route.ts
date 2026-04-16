import { NextResponse } from 'next/server';
import { rateLimitAgents } from '@/lib/ratelimit';
import { apiError } from '@/lib/api-utils';
import { requireSuperAdmin, adminErrorResponse } from '@/lib/admin';
import { createAdminClient } from '@/lib/supabase';
import { generateRetentionEmail } from '@/agents/ChurnAgent';
import { Resend } from 'resend';
import type { Brand } from '@/types';

export async function POST(request: Request) {
  try {
    const rl = await rateLimitAgents(request);
    if (rl) return rl;
    await requireSuperAdmin();
    const { brandId, send = false } = await request.json() as { brandId: string; send?: boolean };

    const db = createAdminClient();

    const { data: brand } = await db.from('brands').select('*').eq('id', brandId).single();
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });

    const b = brand as Brand & { churn_score: number; churn_risk: string; last_login_at: string; last_post_published_at: string };

    // Get user email
    const { data: profile } = await db
      .from('profiles')
      .select('full_name')
      .eq('id', b.user_id)
      .single();

    const { data: authUser } = await db.auth.admin.getUserById(b.user_id);
    const email = authUser?.user?.email;

    const now = Date.now();
    const diasInactivo = b.last_login_at
      ? Math.floor((now - new Date(b.last_login_at).getTime()) / 86400000)
      : 999;

    const { subject, body } = await generateRetentionEmail({
      brandName:    b.name,
      sector:       b.sector ?? 'negocio',
      diasInactivo,
      lastActivity: b.last_login_at ?? b.created_at,
      churnRisk:    b.churn_risk as never ?? 'medium',
      reasons:      [],
    });

    // Log the action
    await db.from('churn_actions').insert({
      brand_id:             brandId,
      action_type:          `email_${b.churn_risk}`,
      churn_score_at_action: b.churn_score ?? 0,
      email_subject:        subject,
      email_body:           body,
    });

    if (send && email) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from:    'NeuroPost <hola@neuropost.app>',
        to:      email,
        subject,
        html:    body,
      });
    }

    return NextResponse.json({ subject, body, email, sent: send && !!email });
  } catch (err) {
    const { error, status } = adminErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}
