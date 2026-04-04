'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { TrendingUp, TrendingDown, Users, MessageSquare, Mail, Inbox, AlertCircle } from 'lucide-react';

const A = { bg: '#0f0e0c', card: '#1a1917', border: '#2a2927', orange: '#ff6b35', muted: '#666', text: '#e8e3db', green: '#4ade80', red: '#f87171' };

interface MetricBox { now: number; prev: number }
interface Metrics {
  contacted: MetricBox; replied: MetricBox; interested: MetricBox; converted: MetricBox;
}
interface Activity { id: string; type: string; content: string; created_at: string; prospect_id: string; prospects?: { username: string } }
interface DashData {
  metrics: Metrics;
  channels: Record<string, number>;
  pendingActions: { commentReplies: number; unreadMessages: number; interestedNoFollowup: number };
  activity: Activity[];
}

function pct(now: number, prev: number) {
  if (!prev) return null;
  const diff = ((now - prev) / prev) * 100;
  return Math.round(diff);
}

function MetricCard({ label, metric, icon: Icon, href }: { label: string; metric: MetricBox; icon: React.ElementType; href: string }) {
  const change = pct(metric.now, metric.prev);
  const up     = change !== null && change >= 0;
  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
      <div style={{ background: A.card, border: `1px solid ${A.border}`, borderRadius: 12, padding: '20px 24px', cursor: 'pointer', transition: 'border-color 0.15s' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div style={{ background: 'rgba(255,107,53,0.12)', borderRadius: 8, padding: 8 }}>
            <Icon size={18} color={A.orange} />
          </div>
          {change !== null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: up ? A.green : A.red }}>
              {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {up ? '+' : ''}{change}%
            </div>
          )}
        </div>
        <div style={{ fontSize: 28, fontWeight: 800, color: A.text }}>{metric.now}</div>
        <div style={{ fontSize: 12, color: A.muted, marginTop: 4 }}>{label}</div>
      </div>
    </Link>
  );
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'ahora';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

const TYPE_LABEL: Record<string, string> = {
  comment_sent: 'Comentario enviado', comment_reply_received: 'Respondió al comentario',
  dm_received: 'DM recibido', dm_sent: 'DM enviado',
  email_sent: 'Email enviado', email_replied: 'Respondió al email',
  status_changed: 'Estado cambiado', note_added: 'Nota añadida',
  ad_lead: 'Lead de anuncio',
};

export default function CaptacionDashboard() {
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/metrics')
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ padding: 40, color: A.muted, fontSize: 14 }}>Cargando métricas...</div>
  );

  if (!data) return (
    <div style={{ padding: 40, color: A.red, fontSize: 14 }}>Error al cargar datos.</div>
  );

  const { metrics, channels, pendingActions, activity } = data;

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1200 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: A.text, margin: '0 0 6px' }}>Dashboard de captación</h1>
      <p style={{ color: A.muted, fontSize: 13, margin: '0 0 32px' }}>Esta semana vs. semana pasada</p>

      {/* KPI grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
        <MetricCard label="Contactados"  metric={metrics.contacted}  icon={Users}         href="/captacion/prospects" />
        <MetricCard label="Respondieron" metric={metrics.replied}    icon={MessageSquare} href="/captacion/comentarios/respuestas" />
        <MetricCard label="Interesados"  metric={metrics.interested} icon={Mail}          href="/captacion/prospects?status=interested" />
        <MetricCard label="Convertidos"  metric={metrics.converted}  icon={TrendingUp}    href="/captacion/prospects?status=converted" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Pending actions */}
        <div style={{ background: A.card, border: `1px solid ${A.border}`, borderRadius: 12, padding: 24 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: A.text, margin: '0 0 16px' }}>Acciones pendientes</h2>
          {[
            { label: 'Comentarios sin responder', count: pendingActions.commentReplies, href: '/captacion/comentarios/respuestas', icon: MessageSquare },
            { label: 'DMs sin leer',              count: pendingActions.unreadMessages,      href: '/captacion/mensajes',               icon: Inbox },
            { label: 'Interesados sin seguimiento (3d)', count: pendingActions.interestedNoFollowup, href: '/captacion/prospects?status=interested', icon: AlertCircle },
          ].map(({ label, count, href, icon: Icon }) => (
            <Link key={href} href={href} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 8, marginBottom: 8, background: '#0f0e0c', border: `1px solid ${A.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Icon size={14} color={count > 0 ? A.orange : A.muted} />
                <span style={{ fontSize: 13, color: count > 0 ? A.text : A.muted }}>{label}</span>
              </div>
              <span style={{ fontSize: 18, fontWeight: 800, color: count > 0 ? A.orange : A.muted }}>{count}</span>
            </Link>
          ))}
        </div>

        {/* Channel breakdown */}
        <div style={{ background: A.card, border: `1px solid ${A.border}`, borderRadius: 12, padding: 24 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: A.text, margin: '0 0 16px' }}>Canales (esta semana)</h2>
          {Object.entries(channels).length === 0 && (
            <p style={{ color: A.muted, fontSize: 13 }}>Sin datos todavía.</p>
          )}
          {Object.entries(channels).map(([ch, n]) => {
            const total = Object.values(channels).reduce((a, b) => a + b, 0);
            const pctVal = total ? Math.round((n / total) * 100) : 0;
            return (
              <div key={ch} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: A.muted, marginBottom: 4 }}>
                  <span style={{ textTransform: 'capitalize' }}>{ch}</span>
                  <span>{n} ({pctVal}%)</span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: A.border, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pctVal}%`, background: A.orange, borderRadius: 3 }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Activity feed */}
      <div style={{ marginTop: 24, background: A.card, border: `1px solid ${A.border}`, borderRadius: 12, padding: 24 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: A.text, margin: '0 0 16px' }}>Actividad reciente</h2>
        {activity.length === 0 && <p style={{ color: A.muted, fontSize: 13 }}>Sin actividad todavía.</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {activity.map((a) => (
            <Link key={a.id} href={`/captacion/prospects/${a.prospect_id}`} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 12, padding: '9px 12px', borderRadius: 8, background: 'transparent' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: A.orange, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: A.orange, minWidth: 160 }}>{TYPE_LABEL[a.type] ?? a.type}</span>
              <span style={{ fontSize: 12, color: A.text, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.content}</span>
              <span style={{ fontSize: 11, color: A.muted, flexShrink: 0 }}>{timeAgo(a.created_at)}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
