import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requireWorker, workerErrorResponse } from '@/lib/worker';
import { createAdminClient } from '@/lib/supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

/**
 * GET /api/worker/search?q=term
 * Global search across clients, posts, tickets, agent jobs, and solicitudes.
 */
export async function GET(req: NextRequest) {
  try {
    await requireWorker();
    const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';
    if (q.length < 2) return NextResponse.json({ results: [] });

    const db: DB = createAdminClient();
    const term = `%${q}%`;

    const [brandsRes, postsRes, ticketsRes, jobsRes, requestsRes] = await Promise.all([
      // Clients by name
      db.from('brands').select('id, name, plan, sector').ilike('name', term).limit(5),
      // Posts by caption or ID
      db.from('posts').select('id, brand_id, caption, status, format, created_at, brands(name)')
        .or(`caption.ilike.${term},id.eq.${q}`)
        .order('created_at', { ascending: false }).limit(5),
      // Tickets by number or subject
      db.from('tickets').select('id, ticket_number, subject, status, brand_id, brands(name)')
        .or(`ticket_number.ilike.${term},subject.ilike.${term}`)
        .order('created_at', { ascending: false }).limit(5),
      // Agent jobs by ID
      q.length >= 8 // UUID partial match
        ? db.from('agent_jobs').select('id, agent_type, action, status, brand_id, created_at')
            .ilike('id', `${q}%`).limit(5)
        : Promise.resolve({ data: [] }),
      // Special requests by title
      db.from('special_requests').select('id, brand_id, title, status, created_at, brands(name)')
        .ilike('title', term).order('created_at', { ascending: false }).limit(5),
    ]);

    const results: Array<{ type: string; id: string; title: string; subtitle: string; href: string }> = [];

    for (const b of (brandsRes.data ?? [])) {
      results.push({ type: 'cliente', id: b.id, title: b.name, subtitle: `${b.plan} · ${b.sector ?? ''}`, href: `/worker/clientes/${b.id}` });
    }
    for (const p of (postsRes.data ?? [])) {
      results.push({ type: 'post', id: p.id, title: p.caption?.slice(0, 60) ?? `Post ${p.id.slice(0, 8)}`, subtitle: `${(p.brands as { name?: string })?.name ?? ''} · ${p.status}`, href: `/worker/clientes/${p.brand_id}` });
    }
    for (const t of (ticketsRes.data ?? [])) {
      results.push({ type: 'ticket', id: t.id, title: `${t.ticket_number} — ${t.subject}`, subtitle: `${(t.brands as { name?: string })?.name ?? ''} · ${t.status}`, href: `/worker/inbox?tab=soporte` });
    }
    for (const j of (jobsRes.data ?? [])) {
      results.push({ type: 'job', id: j.id, title: `${j.agent_type}:${j.action}`, subtitle: `${j.status} · ${j.id.slice(0, 8)}`, href: `/worker?tab=agentes` });
    }
    for (const r of (requestsRes.data ?? [])) {
      results.push({ type: 'solicitud', id: r.id, title: r.title, subtitle: `${(r.brands as { name?: string })?.name ?? ''} · ${r.status}`, href: `/worker/clientes/${r.brand_id}` });
    }

    return NextResponse.json({ results });
  } catch (err) {
    const { error, status } = workerErrorResponse(err);
    return NextResponse.json({ error }, { status });
  }
}
