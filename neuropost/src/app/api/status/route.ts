import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';

const SERVICES = [
  { key: 'dashboard',            label: 'Dashboard de clientes',    icon: '📱' },
  { key: 'instagram_publishing', label: 'Publicación en Instagram', icon: '📸' },
  { key: 'facebook_publishing',  label: 'Publicación en Facebook',  icon: '👍' },
  { key: 'image_editing',        label: 'Edición de imágenes',      icon: '🎨' },
  { key: 'ai_content',           label: 'Generación de contenido',  icon: '🤖' },
  { key: 'notifications',        label: 'Notificaciones',           icon: '🔔' },
  { key: 'emails',               label: 'Emails',                   icon: '📧' },
  { key: 'analytics',            label: 'Analíticas',               icon: '📊' },
];

export async function GET() {
  try {
    const db = createAdminClient();

    // Active incidents
    const { data: activeIncidents } = await db
      .from('service_incidents')
      .select('*, incident_updates(*)')
      .neq('status', 'resolved')
      .order('started_at', { ascending: false });

    // Recent resolved (last 30 days for history)
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const { data: recentResolved } = await db
      .from('service_incidents')
      .select('id, title, severity, status, affected_services, started_at, resolved_at')
      .eq('status', 'resolved')
      .gte('started_at', since.toISOString())
      .order('started_at', { ascending: false })
      .limit(30);

    // Build per-service status
    const active = activeIncidents ?? [];
    const serviceStatus = SERVICES.map((svc) => {
      const affecting = active.filter((i: any) => i.affected_services?.includes(svc.key));
      let status = 'operational';
      if (affecting.some((i: any) => i.severity === 'critical')) status = 'outage';
      else if (affecting.some((i: any) => i.severity === 'major')) status = 'degraded';
      else if (affecting.length > 0) status = 'degraded';
      return { ...svc, status };
    });

    const globalStatus = active.length === 0 ? 'operational'
      : active.some((i: any) => i.severity === 'critical') ? 'critical'
      : active.some((i: any) => i.severity === 'major') ? 'major'
      : 'minor';

    return NextResponse.json({
      status: globalStatus,
      services: serviceStatus,
      activeIncidents: active,
      recentIncidents: recentResolved ?? [],
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
