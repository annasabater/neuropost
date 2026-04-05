import { NextResponse } from 'next/server';
import { requireServerUser, createAdminClient } from '@/lib/supabase';

export async function GET() {
  try {
    const user = await requireServerUser();
    if (user.app_metadata?.role !== 'superadmin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const db = createAdminClient();

    const { data: incidents } = await db
      .from('service_incidents')
      .select('*, incident_updates(*)')
      .order('created_at', { ascending: false })
      .limit(50);

    return NextResponse.json({ incidents: incidents ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireServerUser();
    if (user.app_metadata?.role !== 'superadmin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const db = createAdminClient();
    const body = await request.json();
    const { title, description, severity = 'minor', affected_services = [] } = body;

    if (!title?.trim()) return NextResponse.json({ error: 'Title required' }, { status: 400 });

    const { data: incident, error } = await db.from('service_incidents').insert({
      title: title.trim(),
      description: description?.trim() ?? null,
      severity,
      affected_services,
      status: 'investigating',
    }).select().single();
    if (error) throw error;

    // First update
    await db.from('incident_updates').insert({
      incident_id: incident.id,
      message: description?.trim() ?? title.trim(),
      status: 'investigating',
    });

    // Notify subscribers
    const { data: subs } = await db.from('status_subscribers').select('email').eq('confirmed', true).limit(500);
    if (subs && subs.length > 0) {
      const resendKey = process.env.RESEND_API_KEY;
      if (resendKey) {
        const { Resend } = await import('resend');
        const resend = new Resend(resendKey);
        const from = process.env.RESEND_FROM_EMAIL ?? 'noreply@neuropost.app';
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://neuropost.app';
        for (const sub of subs.slice(0, 50)) {
          await resend.emails.send({
            from, to: sub.email,
            subject: `⚠️ Incidencia detectada — ${title}`,
            html: `<p>Hemos detectado una incidencia en NeuroPost: <strong>${title}</strong>.</p><p>Puedes seguir el estado en <a href="${appUrl}/estado">${appUrl}/estado</a></p>`,
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
