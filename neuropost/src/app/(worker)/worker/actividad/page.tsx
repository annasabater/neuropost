'use client';

import { useEffect, useState } from 'react';

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

type Event = { id: string; action: string; created_at: string; details: Record<string, unknown> | null; brands?: { name: string; sector: string } };

function timeAgo(d: string) {
  const min = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (min < 1) return 'hace un momento';
  if (min < 60) return `hace ${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h}h`;
  return `hace ${Math.floor(h / 24)}d`;
}

const ACTION_ICON: Record<string, string> = {
  post_uploaded: '📸', post_approved: '✅', post_rejected: '❌', post_published: '🚀',
  logged_in: '🔑', settings_changed: '⚙️', plan_changed: '💳',
  instagram_connected: '📱', feedback_sent: '💬',
};

export default function ActividadPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [mine, setMine]     = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/worker/actividad${mine ? '?mine=1' : ''}`).then((r) => r.json()).then((d) => {
      setEvents(d.events ?? []);
      setLoading(false);
    });
  }, [mine]);

  return (
    <div style={{ padding: '32px 40px', maxWidth: 800 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 4 }}>Actividad reciente</h1>
          <p style={{ color: C.muted, fontSize: 14 }}>Todo lo que pasa con los clientes</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[{ label: 'Todos', value: false }, { label: 'Mis clientes', value: true }].map((opt) => (
            <button key={String(opt.value)} onClick={() => setMine(opt.value)} style={{
              padding: '6px 14px', borderRadius: 0, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: mine === opt.value ? C.accent2 : 'transparent',
              color: mine === opt.value ? '#fff' : C.muted,
              border: `1px solid ${mine === opt.value ? C.accent2 : C.border}`,
            }}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? <p style={{ color: C.muted }}>Cargando...</p> : (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 0, overflow: 'hidden' }}>
          {events.length === 0 ? (
            <p style={{ color: C.muted, fontSize: 13, padding: '40px', textAlign: 'center' }}>Sin actividad</p>
          ) : events.map((event, i) => (
            <div key={event.id} style={{
              display: 'flex', gap: 14, padding: '14px 20px',
              borderBottom: i < events.length - 1 ? `1px solid ${C.border}` : 'none',
            }}>
              <div style={{ fontSize: 20, lineHeight: 1, marginTop: 2 }}>{ACTION_ICON[event.action] ?? '📌'}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: C.text }}>
                  <strong>{event.brands?.name ?? 'Cliente'}</strong>{' '}
                  {event.action.replace(/_/g, ' ')}
                  {!!event.details?.code && <> — código <strong>{String(event.details.code)}</strong></>}
                </div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>
                  {event.brands?.sector?.replace(/_/g, ' ')} · {timeAgo(event.created_at)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
