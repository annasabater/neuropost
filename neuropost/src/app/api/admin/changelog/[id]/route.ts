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
    const { version, title, summary, changes, publish } = body;

    const updates: Record<string, unknown> = {};
    if (version !== undefined) updates.version = version;
    if (title !== undefined) updates.title = title;
    if (summary !== undefined) updates.summary = summary;
    if (changes !== undefined) updates.changes = changes;
    if (publish) { updates.is_published = true; updates.published_at = new Date().toISOString(); }

    const { data: entry, error } = await db.from('changelog_entries').update(updates).eq('id', id).select().single();
    if (error) throw error;

    if (publish) {
      const { Resend } = await import('resend');
      if (process.env.RESEND_API_KEY) {
        const resend = new Resend(process.env.RESEND_API_KEY);
        const { data: subs } = await db.from('status_subscribers').select('email').eq('confirmed', true).limit(500);
        const from = process.env.RESEND_FROM_EMAIL ?? 'noreply@neuropost.app';
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://neuropost.app';
        const subject = entry.version ? `NeuroPost ${entry.version} — ${entry.title}` : `NeuroPost — ${entry.title}`;
        for (const sub of (subs ?? []).slice(0, 50) as any[]) {
          await resend.emails.send({ from, to: sub.email, subject, html: `<p>${entry.summary ?? entry.title}</p><p><a href="${appUrl}/novedades">Ver novedades →</a></p>` }).catch(() => null);
        }
        const { data: brands } = await db.from('brands').select('id').limit(500);
        if (brands?.length) {
          await db.from('notifications').insert(
            (brands as any[]).map((b) => ({ brand_id: b.id, type: 'changelog', message: `🆕 Hay novedades en NeuroPost — ${entry.title}`, read: false, metadata: { entry_id: id } }))
          ).catch(() => null);
        }
      }
    }

    return NextResponse.json({ entry });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
