import { NextResponse } from 'next/server';
import { requireServerUser, createAdminClient } from '@/lib/supabase';

export async function GET() {
  try {
    const user = await requireServerUser();
    if (user.app_metadata?.role !== 'superadmin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const db = createAdminClient();
    const { data: entries } = await db.from('changelog_entries').select('*').order('created_at', { ascending: false });
    return NextResponse.json({ entries: entries ?? [] });
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
    const { version, title, summary, changes = [], publish = false } = body;

    if (!title?.trim()) return NextResponse.json({ error: 'Title required' }, { status: 400 });

    const now = new Date().toISOString();
    const { data: entry, error } = await db.from('changelog_entries').insert({
      version: version?.trim() ?? null,
      title: title.trim(),
      summary: summary?.trim() ?? null,
      changes,
      is_published: publish,
      published_at: publish ? now : null,
    }).select().single();
    if (error) throw error;

    if (publish) await notifyChangelog(entry, db);

    return NextResponse.json({ entry });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function notifyChangelog(entry: any, db: any) {
  const { data: subs } = await db.from('status_subscribers').select('email').eq('confirmed', true).limit(500);
  if (!subs?.length || !process.env.RESEND_API_KEY) return;
  const { Resend } = await import('resend');
  const resend = new Resend(process.env.RESEND_API_KEY);
  const from = process.env.RESEND_FROM_EMAIL ?? 'noreply@neuropost.app';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://neuropost.app';
  const subject = entry.version ? `NeuroPost ${entry.version} — ${entry.title}` : `NeuroPost — ${entry.title}`;
  for (const sub of subs.slice(0, 50)) {
    await resend.emails.send({
      from, to: sub.email,
      subject,
      html: `<p>${entry.summary ?? entry.title}</p><p><a href="${appUrl}/novedades">Ver todas las novedades →</a></p>`,
    }).catch(() => null);
  }
  // In-app notification to all brands
  const { data: brands } = await db.from('brands').select('id').limit(500);
  if (brands?.length) {
    const notifications = brands.map((b: any) => ({
      brand_id: b.id,
      type: 'changelog',
      message: `🆕 Hay novedades en NeuroPost — ${entry.title}`,
      read: false,
      metadata: { entry_id: entry.id },
    }));
    await db.from('notifications').insert(notifications).catch(() => null);
  }
}
