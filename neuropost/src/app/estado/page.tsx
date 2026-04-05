import { createAdminClient } from '@/lib/supabase';
import EstadoClient from './EstadoClient';

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

async function getStatusData() {
  const db = createAdminClient();

  const { data: activeIncidents } = await db
    .from('service_incidents')
    .select('*, incident_updates(*)')
    .neq('status', 'resolved')
    .order('started_at', { ascending: false });

  const since90 = new Date();
  since90.setDate(since90.getDate() - 90);
  const { data: allIncidents } = await db
    .from('service_incidents')
    .select('id, title, severity, status, affected_services, started_at, resolved_at')
    .gte('started_at', since90.toISOString())
    .order('started_at', { ascending: false })
    .limit(60);

  const active = activeIncidents ?? [];
  const serviceStatus = SERVICES.map((svc) => {
    const affecting = active.filter((i: any) => i.affected_services?.includes(svc.key));
    let status = 'operational';
    if (affecting.some((i: any) => i.severity === 'critical')) status = 'outage';
    else if (affecting.length > 0) status = 'degraded';
    return { ...svc, status };
  });

  const globalStatus = active.length === 0 ? 'operational'
    : active.some((i: any) => i.severity === 'critical') ? 'critical'
    : active.some((i: any) => i.severity === 'major') ? 'major'
    : 'minor';

  return { globalStatus, serviceStatus, activeIncidents: active, allIncidents: allIncidents ?? [] };
}

export default async function EstadoPage() {
  const { globalStatus, serviceStatus, activeIncidents, allIncidents } = await getStatusData();

  const globalConfig = {
    operational: { bg: '#f0fdf4', border: '#86efac', text: '#166534', icon: '🟢', msg: 'Todos los sistemas funcionan correctamente' },
    minor:       { bg: '#fefce8', border: '#fde047', text: '#713f12', icon: '🟡', msg: 'Incidencia menor en curso' },
    major:       { bg: '#fff7ed', border: '#fdba74', text: '#9a3412', icon: '🟡', msg: 'Incidencia en curso — servicio degradado' },
    critical:    { bg: '#fef2f2', border: '#fca5a5', text: '#7f1d1d', icon: '🔴', msg: 'Incidencia grave — servicio interrumpido' },
  }[globalStatus] ?? { bg: '#f0fdf4', border: '#86efac', text: '#166534', icon: '🟢', msg: 'Todos los sistemas funcionan correctamente' };

  const serviceConfig = {
    operational: { icon: '🟢', label: 'Operativo',   color: '#166534' },
    degraded:    { icon: '🟡', label: 'Degradado',   color: '#713f12' },
    outage:      { icon: '🔴', label: 'Interrupción', color: '#7f1d1d' },
  };

  const statusLabel = { investigating: 'Investigando', identified: 'Identificado', monitoring: 'Monitorizando', resolved: 'Resuelto' };
  const sevLabel    = { minor: 'Menor', major: 'Mayor', critical: 'Crítica' };
  const sevColor    = { minor: '#713f12', major: '#9a3412', critical: '#7f1d1d' };
  const sevBg       = { minor: '#fefce8', major: '#fff7ed', critical: '#fef2f2' };

  // Group resolved by month
  const resolvedByMonth: Record<string, typeof allIncidents> = {};
  for (const inc of allIncidents.filter((i: any) => i.status === 'resolved')) {
    const month = new Date((inc as any).started_at).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    if (!resolvedByMonth[month]) resolvedByMonth[month] = [];
    resolvedByMonth[month].push(inc);
  }

  function durationStr(inc: any) {
    if (!inc.resolved_at) return '';
    const ms = new Date(inc.resolved_at).getTime() - new Date(inc.started_at).getTime();
    const min = Math.floor(ms / 60000);
    if (min < 60) return `${min}min`;
    return `${Math.floor(min / 60)}h ${min % 60}min`;
  }

  return (
    <div style={{ background: '#fff', minHeight: '100vh', fontFamily: "'Inter', sans-serif", color: '#111827' }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid #e5e7eb', padding: '20px 0' }}>
        <div style={{ maxWidth: 860, margin: '0 auto', padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 800, fontSize: 20, color: '#ff6b35' }}>NeuroPost</div>
          <div style={{ fontSize: 13, color: '#9ca3af' }}>
            Estado del servicio · Actualizado hace unos segundos
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '40px 24px' }}>
        {/* Global status banner */}
        <div style={{ background: globalConfig.bg, border: `2px solid ${globalConfig.border}`, borderRadius: 14, padding: '20px 28px', marginBottom: 36, display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 28 }}>{globalConfig.icon}</span>
          <span style={{ fontSize: 17, fontWeight: 700, color: globalConfig.text }}>{globalConfig.msg}</span>
        </div>

        {/* Services list */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, marginBottom: 36, overflow: 'hidden' }}>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid #e5e7eb', fontWeight: 700, fontSize: 14, color: '#374151' }}>
            Estado de los servicios
          </div>
          {serviceStatus.map((svc, i) => {
            const sc = serviceConfig[svc.status as keyof typeof serviceConfig] ?? serviceConfig.operational;
            return (
              <div key={svc.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 24px', borderBottom: i < serviceStatus.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                <span style={{ fontSize: 14 }}>{svc.icon} {svc.label}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: sc.color }}>{sc.icon} {sc.label}</span>
              </div>
            );
          })}
        </div>

        {/* Active incidents */}
        {activeIncidents.length > 0 && (
          <div style={{ marginBottom: 36 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Incidencias activas</h2>
            {activeIncidents.map((inc: any) => (
              <div key={inc.id} style={{ background: '#fff', border: '1px solid #fde047', borderRadius: 12, padding: '20px 24px', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>🟡 {inc.title}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, color: (sevColor as any)[inc.severity] ?? '#713f12', background: (sevBg as any)[inc.severity] ?? '#fefce8' }}>
                    {(sevLabel as any)[inc.severity] ?? inc.severity}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 12 }}>
                  Iniciada {new Date(inc.started_at).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}h
                </div>
                {inc.incident_updates && inc.incident_updates.length > 0 && (
                  <div style={{ borderLeft: '2px solid #e5e7eb', paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {[...inc.incident_updates].sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()).map((upd: any) => (
                      <div key={upd.id}>
                        <div style={{ fontSize: 12, color: '#9ca3af' }}>
                          {new Date(upd.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} — <strong>{(statusLabel as any)[upd.status] ?? upd.status}</strong>
                        </div>
                        <div style={{ fontSize: 13, color: '#374151', marginTop: 2 }}>{upd.message}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Incident history */}
        {Object.keys(resolvedByMonth).length > 0 && (
          <div style={{ marginBottom: 48 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Historial de incidencias</h2>
            {Object.entries(resolvedByMonth).map(([month, incs]) => (
              <div key={month} style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', textTransform: 'capitalize', marginBottom: 8 }}>{month}</div>
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
                  {incs.map((inc: any, i: number) => (
                    <div key={inc.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 20px', borderBottom: i < incs.length - 1 ? '1px solid #f3f4f6' : 'none', fontSize: 13 }}>
                      <span>
                        {new Date(inc.started_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} — {inc.title}
                      </span>
                      <span style={{ color: '#059669', fontWeight: 600, whiteSpace: 'nowrap', marginLeft: 16 }}>
                        Resuelto {durationStr(inc) && `(${durationStr(inc)})`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Subscribe */}
        <EstadoClient />
      </div>
    </div>
  );
}
