'use client';

import { useEffect, useState, useCallback } from 'react';
import { Search, X, Download, AlertTriangle, AlertCircle, Info, ChevronDown } from 'lucide-react';

const f = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";
const C = { bg: '#ffffff', bg1: '#f3f4f6', border: '#e5e7eb', text: '#111', muted: '#6b7280', accent: '#0F766E', accent2: '#0D9488' };

type AuditLog = {
  id: string; actor_type: string; actor_id: string | null; actor_name: string | null; actor_ip: string | null;
  action: string; resource_type: string; resource_id: string | null; resource_name: string | null;
  brand_id: string | null; description: string; changes: Record<string, { old: unknown; new: unknown }> | null;
  metadata: Record<string, unknown> | null; severity: string; created_at: string;
};
type Stats = { count24: number; warn24: number; crit24: number; count7: number; warn7: number; crit7: number };

const SEV_ICON: Record<string, React.ComponentType<{ size?: number; style?: React.CSSProperties }>> = { info: Info, warning: AlertTriangle, critical: AlertCircle };
const SEV_COLOR: Record<string, string> = { info: '#0D9488', warning: '#d97706', critical: '#dc2626' };

function timeAgo(d: string) { const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000); if (m < 1) return 'ahora'; if (m < 60) return `hace ${m}m`; const h = Math.floor(m / 60); if (h < 24) return `hace ${h}h`; return `hace ${Math.floor(h / 24)}d`; }

export default function AuditoriaPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<Stats>({ count24: 0, warn24: 0, crit24: 0, count7: 0, warn7: 0, crit7: 0 });
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Filters
  const [q, setQ] = useState('');
  const [actorType, setActorType] = useState('');
  const [action, setAction] = useState('');
  const [resType, setResType] = useState('');
  const [severity, setSeverity] = useState('');

  const fetchLogs = useCallback(async (off: number) => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('limit', '50');
    params.set('offset', String(off));
    if (q) params.set('q', q);
    if (actorType) params.set('actor_type', actorType);
    if (action) params.set('action', action);
    if (resType) params.set('resource_type', resType);
    if (severity) params.set('severity', severity);
    try {
      const res = await fetch(`/api/worker/audit?${params}`);
      const d = await res.json();
      setLogs(off === 0 ? (d.logs ?? []) : [...logs, ...(d.logs ?? [])]);
      setTotal(d.total ?? 0);
      setStats(d.stats ?? stats);
    } catch { /* ignore */ }
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, actorType, action, resType, severity]);

  useEffect(() => { setOffset(0); fetchLogs(0); }, [fetchLogs]);

  function clearFilters() { setQ(''); setActorType(''); setAction(''); setResType(''); setSeverity(''); }

  const selectStyle: React.CSSProperties = { padding: '6px 10px', border: `1px solid ${C.border}`, background: C.bg, fontSize: 12, fontFamily: f, color: C.text, outline: 'none' };

  return (
    <div style={{ padding: '0 40px 60px', maxWidth: 1200, margin: '0 auto', color: C.text }}>
      {/* Header */}
      <div style={{ padding: '40px 0 24px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontFamily: fc, fontWeight: 900, fontSize: 'clamp(2.5rem, 5vw, 3.5rem)', textTransform: 'uppercase', letterSpacing: '0.01em', lineHeight: 0.95, marginBottom: 8 }}>
            Log de auditor&iacute;a
          </h1>
          <p style={{ color: C.muted, fontSize: 13, fontFamily: f }}>
            24h: {stats.count24} eventos · {stats.warn24} warnings · {stats.crit24} critical
            {' · '}7d: {stats.count7} eventos
          </p>
        </div>
        <a href={`/api/worker/audit?limit=1000&${new URLSearchParams({ ...(q ? { q } : {}), ...(severity ? { severity } : {}) })}`}
          download="audit_logs.json" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', border: `1px solid ${C.border}`, background: C.bg, fontSize: 12, fontWeight: 600, fontFamily: f, color: C.text, textDecoration: 'none', cursor: 'pointer' }}>
          <Download size={13} /> Exportar
        </a>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', border: `1px solid ${C.border}`, background: C.bg, flex: '1 1 200px', maxWidth: 300 }}>
          <Search size={14} style={{ color: C.muted }} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar..." style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 12, fontFamily: f, color: C.text }} />
          {q && <button type="button" onClick={() => setQ('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: C.muted }}><X size={12} /></button>}
        </div>
        <select value={actorType} onChange={e => setActorType(e.target.value)} style={selectStyle}>
          <option value="">Actor: Todos</option>
          <option value="user">Usuarios</option><option value="worker">Workers</option>
          <option value="agent">Agentes</option><option value="system">Sistema</option>
          <option value="stripe_webhook">Webhooks</option><option value="cron">Cron</option>
        </select>
        <select value={resType} onChange={e => setResType(e.target.value)} style={selectStyle}>
          <option value="">Recurso: Todos</option>
          <option value="post">Posts</option><option value="agent_job">Jobs</option>
          <option value="special_request">Solicitudes</option><option value="ticket">Tickets</option>
          <option value="subscription">Suscripciones</option><option value="fixed_cost">Gastos</option>
        </select>
        <select value={severity} onChange={e => setSeverity(e.target.value)} style={selectStyle}>
          <option value="">Severidad: Todas</option>
          <option value="warning">Warning+</option><option value="critical">Solo Critical</option>
        </select>
        {(q || actorType || action || resType || severity) && (
          <button type="button" onClick={clearFilters} style={{ ...selectStyle, cursor: 'pointer', fontWeight: 600 }}>Limpiar</button>
        )}
      </div>

      {/* Logs timeline */}
      <div style={{ border: `1px solid ${C.border}`, background: C.bg }}>
        {logs.length === 0 && !loading && (
          <div style={{ padding: 48, textAlign: 'center', color: C.muted, fontSize: 13 }}>No hay logs para estos filtros</div>
        )}
        {logs.map(log => {
          const Icon = SEV_ICON[log.severity] ?? Info;
          const color = SEV_COLOR[log.severity] ?? C.accent2;
          const isExpanded = expanded === log.id;
          return (
            <div key={log.id} style={{ borderBottom: `1px solid ${C.border}`, padding: '12px 18px', cursor: 'pointer' }} onClick={() => setExpanded(isExpanded ? null : log.id)}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <Icon size={15} style={{ color, flexShrink: 0, marginTop: 2 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color, fontFamily: f }}>{log.severity}</span>
                    <span style={{ fontSize: 9, color: C.muted, fontFamily: f }}>{log.actor_type}</span>
                    {log.actor_name && <span style={{ fontSize: 11, fontWeight: 600, color: C.text, fontFamily: f }}>{log.actor_name}</span>}
                  </div>
                  <p style={{ fontSize: 13, fontWeight: 500, color: C.text, margin: 0, fontFamily: f }}>{log.description}</p>
                  <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: 11, color: C.muted, fontFamily: f }}>
                    <span>{log.resource_type}{log.resource_name ? `: ${log.resource_name}` : ''}</span>
                    <span>{new Date(log.created_at).toLocaleString('es-ES')}</span>
                    <span>{timeAgo(log.created_at)}</span>
                    {log.actor_ip && <span>IP: {log.actor_ip}</span>}
                  </div>
                </div>
                <ChevronDown size={14} style={{ color: C.muted, flexShrink: 0, transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div style={{ marginTop: 12, marginLeft: 27, padding: '12px 16px', background: C.bg1, border: `1px solid ${C.border}`, fontSize: 12, fontFamily: f }}>
                  {log.changes && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.muted }}>Cambios</div>
                      {Object.entries(log.changes).map(([field, { old: o, new: n }]) => (
                        <div key={field} style={{ display: 'flex', gap: 8, padding: '2px 0' }}>
                          <span style={{ fontWeight: 600, minWidth: 80 }}>{field}:</span>
                          <span style={{ color: '#dc2626', textDecoration: 'line-through' }}>{JSON.stringify(o)}</span>
                          <span>→</span>
                          <span style={{ color: C.accent }}>{JSON.stringify(n)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {log.metadata && (
                    <div>
                      <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.muted }}>Metadata</div>
                      <pre style={{ margin: 0, fontSize: 11, overflow: 'auto', maxHeight: 120 }}>{JSON.stringify(log.metadata, null, 2)}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {loading && <div style={{ padding: 20, textAlign: 'center', color: C.muted, fontSize: 12 }}>Cargando...</div>}
      </div>

      {/* Load more */}
      {logs.length < total && !loading && (
        <button type="button" onClick={() => { const next = offset + 50; setOffset(next); fetchLogs(next); }}
          style={{ display: 'block', width: '100%', padding: '12px', marginTop: 12, border: `1px solid ${C.border}`, background: C.bg, fontSize: 12, fontWeight: 600, fontFamily: f, color: C.text, cursor: 'pointer', textAlign: 'center' }}>
          Cargar más ({total - logs.length} restantes)
        </button>
      )}
    </div>
  );
}
