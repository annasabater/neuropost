'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Worker, ContentQueue } from '@/types';

const f = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";
const C = {
  bg: '#ffffff',
  bg1: '#f5f5f5',
  bg2: '#fafafa',
  card: '#ffffff',
  border: '#E5E7EB',
  text: '#111111',
  muted: '#6B7280',
  accent: '#0F766E',
  accent2: '#3B82F6',
  red: '#EF4444',
  orange: '#F59E0B',
  green: '#14B8A6',
};

function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 0, padding: '20px 24px', fontFamily: f }}>
      <div style={{ fontSize: 28, fontWeight: 800, color: color ?? C.accent2, fontFamily: fc }}>{value}</div>
      <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>{label}</div>
    </div>
  );
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min  = Math.floor(diff / 60000);
  if (min < 1) return 'ahora mismo';
  if (min < 60) return `hace ${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h}h`;
  return `hace ${Math.floor(h / 24)}d`;
}

function waitingColor(dateStr: string) {
  const h = (Date.now() - new Date(dateStr).getTime()) / 3600000;
  if (h < 1) return C.green;
  if (h < 3) return C.orange;
  return C.red;
}

export default function WorkerDashboard() {
  const [worker, setWorker]   = useState<Worker | null>(null);
  const [queue, setQueue]     = useState<ContentQueue[]>([]);
  const [metrics, setMetrics] = useState({ totalValidated: 0, approvalRate: 0, avgResponseTimeH: '0' });
  const [activity, setActivity] = useState<{ id: string; action: string; details: Record<string, unknown> | null; created_at: string; brands?: { name: string } }[]>([]);

  useEffect(() => {
    fetch('/api/worker/me').then((r) => r.json()).then((d) => setWorker(d.worker));
    fetch('/api/worker/cola?status=pending_worker').then((r) => r.json()).then((d) => setQueue(d.queue ?? []));
    fetch('/api/worker/metricas?mine=1').then((r) => r.json()).then((d) => setMetrics(d));
    fetch('/api/worker/actividad?mine=1').then((r) => r.json()).then((d) => setActivity((d.events ?? []).slice(0, 10)));
  }, []);

  const urgent   = queue.filter((q) => q.priority === 'urgent');
  const longWait = queue.filter((q) => (Date.now() - new Date(q.created_at).getTime()) > 2 * 3600000);

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1200, background: C.bg }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: C.text, marginBottom: 4, fontFamily: fc }}>
          Hola, {worker?.full_name?.split(' ')[0] ?? 'trabajador'} 👋
        </h1>
        <p style={{ color: C.muted, fontSize: 15, fontFamily: f }}>
          Tienes <strong style={{ color: queue.length > 0 ? C.red : C.green }}>{queue.length} posts</strong> pendientes de validar.
        </p>
      </div>

      {/* Alert */}
      {longWait.length > 0 && (
        <div style={{
          background: 'rgba(239,68,68,0.1)', border: `1px solid ${C.red}`,
          borderRadius: 0, padding: '14px 20px', marginBottom: 28,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontFamily: f,
        }}>
          <span style={{ color: C.red, fontSize: 14 }}>
            ⚠️ {longWait.length} post{longWait.length > 1 ? 's llevan' : ' lleva'} más de 2 horas sin revisar
          </span>
          <Link href="/worker/cola" style={{ color: C.red, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
            Ver ahora →
          </Link>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
        <StatCard label="Pendientes de validar" value={queue.length} color={C.red} />
        <StatCard label="Validados este mes" value={metrics.totalValidated} />
        <StatCard label="Tasa aprobación clientes" value={`${metrics.approvalRate}%`} color={C.green} />
        <StatCard label="Tiempo medio respuesta" value={`${metrics.avgResponseTimeH}h`} color={C.orange} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Queue preview */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 0, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, fontFamily: fc, textTransform: 'uppercase', letterSpacing: '0.02em' }}>Cola de hoy</h2>
            <Link href="/worker/cola" style={{ fontSize: 12, color: C.accent, textDecoration: 'none', fontFamily: f }}>Ver todo →</Link>
          </div>
          {queue.length === 0 ? (
            <p style={{ color: C.muted, fontSize: 13, textAlign: 'center', padding: '20px 0', fontFamily: f }}>¡Sin pendientes! 🎉</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[...queue].sort((a, b) => {
                if (a.priority === 'urgent' && b.priority !== 'urgent') return -1;
                if (b.priority === 'urgent' && a.priority !== 'urgent') return 1;
                return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
              }).slice(0, 5).map((item) => (
                <Link key={item.id} href={`/worker/cola?id=${item.id}`} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 12px', background: C.bg1, borderRadius: 0,
                  textDecoration: 'none', border: `1px solid ${C.border}`, fontFamily: f,
                  transition: 'background 0.15s',
                }}>
                  <div style={{ width: 40, height: 40, borderRadius: 0, background: C.border, flexShrink: 0, overflow: 'hidden' }}>
                    {(item as { posts?: { image_url?: string } }).posts?.image_url && (
                      <img src={(item as { posts?: { image_url?: string } }).posts!.image_url!} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {(item as { brands?: { name?: string } }).brands?.name ?? 'Cliente'}
                    </div>
                    <div style={{ fontSize: 11, color: waitingColor(item.created_at) }}>
                      ⏱ {timeAgo(item.created_at)}
                      {item.priority === 'urgent' && <span style={{ marginLeft: 6, background: C.red, color: '#fff', fontSize: 9, padding: '1px 5px', borderRadius: 0, fontWeight: 700 }}> URGENTE</span>}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Activity feed */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 0, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, fontFamily: fc, textTransform: 'uppercase', letterSpacing: '0.02em' }}>Actividad reciente</h2>
            <Link href="/worker/actividad" style={{ fontSize: 12, color: C.accent, textDecoration: 'none', fontFamily: f }}>Ver todo →</Link>
          </div>
          {activity.length === 0 ? (
            <p style={{ color: C.muted, fontSize: 13, textAlign: 'center', padding: '20px 0', fontFamily: f }}>Sin actividad reciente</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {activity.map((event) => (
                <div key={event.id} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: `1px solid ${C.border}`, fontFamily: f }}>
                  <div style={{ fontSize: 16 }}>
                    {event.action === 'post_uploaded' ? '📸'
                     : event.action === 'post_approved' ? '✅'
                     : event.action === 'post_rejected' ? '❌'
                     : event.action === 'instagram_connected' ? '🔑'
                     : event.action === 'plan_changed' ? '💳'
                     : '📌'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: C.text, lineHeight: 1.4 }}>
                      <strong>{event.brands?.name ?? 'Cliente'}</strong>{' '}
                      {event.action.replace(/_/g, ' ')}
                    </div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{timeAgo(event.created_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
