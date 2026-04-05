import { NextResponse } from 'next/server';
import { requireServerUser, createAdminClient } from '@/lib/supabase';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await requireServerUser();
    if (user.app_metadata?.role !== 'superadmin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const db = createAdminClient();
    const body = await request.json();
    const { status, message, resolve } = body;

    const updates: Record<string, unknown> = {};
    if (status) updates.status = status;
    if (resolve) { updates.status = 'resolved'; updates.resolved_at = new Date().toISOString(); }

    const { data: incident, error } = await db
      .from('service_incidents').update(updates).eq('id', id).select().single();
    if (error) throw error;

    if (message?.trim()) {
      await db.from('incident_updates').insert({
        incident_id: id,
        message: message.trim(),
        status: updates.status ?? status,
      });
    }

    // Notify on resolve
    if (resolve) {
      const { data: subs } = await db.from('status_subscribers').select('email').eq('confirmed', true).limit(500);
      if (subs && subs.length > 0 && process.env.RESEND_API_KEY) {
        const { Resend } = await import('resend');
        const resend = new Resend(process.env.RESEND_API_KEY);
        const from = process.env.RESEND_FROM_EMAIL ?? 'noreply@neuropost.app';
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://neuropost.app';
        for (const sub of subs.slice(0, 50)) {
          await resend.emails.send({
            from, to: sub.email,
            subject: `✅ Incidencia resuelta — ${incident.title}`,
            html: `<p>La incidencia <strong>${incident.title}</strong> ha sido resuelta. <a href="${appUrl}/estado">Ver detalles</a></p>`,
          }).catch(() => null);
        }
      }
    }

    return NextResponse.json({ incident });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
