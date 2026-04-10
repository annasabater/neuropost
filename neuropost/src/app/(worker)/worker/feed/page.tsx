'use client';

import { useEffect, useState, useRef } from 'react';
import { Radio, Pause, Play, AlertCircle, CheckCircle, Info, AlertTriangle, X } from 'lucide-react';
import { createBrowserClient } from '@/lib/supabase';

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

interface FeedEvent {
  id: string;
  agent: string;
  brand_id: string | null;
  action_type: string;
  title: string;
  details: Record<string, unknown>;
  severity: 'info' | 'warning' | 'error' | 'success';
  brand_name: string | null;
  thumbnail_url: string | null;
  requires_attention: boolean;
  created_at: string;
}

const SEVERITY_COLORS = {
  info: '#3b82f6',
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
};

const SEVERITY_ICONS = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error: AlertCircle,
};

export default function FeedPage() {
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [paused, setPaused] = useState(false);
  const [filter, setFilter] = useState<'all' | 'attention'>('all');
  const [selectedAgent, setSelectedAgent] = useState<string>('all');
  const [selected, setSelected] = useState<FeedEvent | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sb = createBrowserClient();
    let mounted = true;

    // Initial load
    (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (sb as any)
        .from('agent_activity_feed')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (mounted && data) setEvents(data);
    })();

    // Realtime subscription
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const channel = (sb as any)
      .channel('feed-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'agent_activity_feed' }, (payload: { new: FeedEvent }) => {
        if (paused || !mounted) return;
        setEvents((prev) => [payload.new, ...prev].slice(0, 200));
      })
      .subscribe();

    return () => { mounted = false; channel.unsubscribe(); };
  }, [paused]);

  const filtered = events.filter((e) => {
    if (filter === 'attention' && !e.requires_attention) return false;
    if (selectedAgent !== 'all' && e.agent !== selectedAgent) return false;
    return true;
  });

  const agents = Array.from(new Set(events.map((e) => e.agent)));

  return (
    <div style={{ padding: 28, color: C.text }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Radio size={22} style={{ color: C.accent2 }} /> Feed de agentes
          </h1>
          <p style={{ color: C.muted, fontSize: 13, margin: '4px 0 0' }}>
            Actividad en tiempo real de todos los agentes IA
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setPaused(!paused)} style={{
            padding: '8px 16px', background: paused ? C.accent2 : C.card, color: paused ? '#fff' : C.text,
            border: `1px solid ${C.border}`, borderRadius: 0, cursor: 'pointer', fontSize: 12, fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            {paused ? <Play size={13} /> : <Pause size={13} />} {paused ? 'Reanudar' : 'Pausar'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <button onClick={() => setFilter('all')} style={chipStyle(filter === 'all')}>Todos ({events.length})</button>
        <button onClick={() => setFilter('attention')} style={chipStyle(filter === 'attention')}>
          Requiere atención ({events.filter((e) => e.requires_attention).length})
        </button>
        <div style={{ width: 1, background: C.border, margin: '0 4px' }} />
        <button onClick={() => setSelectedAgent('all')} style={chipStyle(selectedAgent === 'all')}>Todos los agentes</button>
        {agents.map((a) => (
          <button key={a} onClick={() => setSelectedAgent(a)} style={chipStyle(selectedAgent === a)}>{a}</button>
        ))}
      </div>

      {/* Layout: feed + detail */}
      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 380px' : '1fr', gap: 16 }}>
        <div ref={feedRef} style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 'calc(100vh - 220px)', overflowY: 'auto' }}>
          {filtered.length === 0 && (
            <div style={{ padding: 48, textAlign: 'center', color: C.muted, fontSize: 13 }}>
              No hay eventos
            </div>
          )}
          {filtered.map((e) => {
            const Icon = SEVERITY_ICONS[e.severity];
            const color = SEVERITY_COLORS[e.severity];
            return (
              <div key={e.id} onClick={() => setSelected(e)} style={{
                background: C.card, border: `1px solid ${C.border}`, borderLeft: `3px solid ${color}`,
                borderRadius: 0, padding: '12px 16px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 12,
                outline: selected?.id === e.id ? `2px solid ${C.accent2}` : 'none',
              }}>
                <Icon size={16} style={{ color, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {e.title}
                  </p>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 2 }}>
                    <span style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      {e.agent}
                    </span>
                    {e.brand_name && (
                      <span style={{ fontSize: 10, color: C.accent2 }}>{e.brand_name}</span>
                    )}
                    <span style={{ fontSize: 10, color: C.muted, marginLeft: 'auto' }}>
                      {timeAgo(e.created_at)}
                    </span>
                  </div>
                </div>
                {e.thumbnail_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={e.thumbnail_url} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 0 }} />
                )}
                {e.requires_attention && (
                  <span style={{ background: C.red, color: '#fff', fontSize: 9, padding: '2px 6px', borderRadius: 0, fontWeight: 700 }}>
                    !
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Detail panel */}
        {selected && (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 0, padding: 20, height: 'fit-content', position: 'sticky', top: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Detalle</h3>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer' }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ marginBottom: 12 }}>
              <span style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 1 }}>Agente</span>
              <p style={{ fontSize: 13, fontWeight: 600, margin: '2px 0 0' }}>{selected.agent}</p>
            </div>
            <div style={{ marginBottom: 12 }}>
              <span style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 1 }}>Evento</span>
              <p style={{ fontSize: 13, margin: '2px 0 0' }}>{selected.title}</p>
            </div>
            {selected.brand_name && (
              <div style={{ marginBottom: 12 }}>
                <span style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 1 }}>Brand</span>
                <p style={{ fontSize: 13, margin: '2px 0 0', color: C.accent2 }}>{selected.brand_name}</p>
              </div>
            )}
            <div style={{ marginBottom: 12 }}>
              <span style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 1 }}>Detalles</span>
              <pre style={{ fontSize: 11, background: C.bg1, padding: 10, borderRadius: 0, marginTop: 4, overflow: 'auto', maxHeight: 240 }}>
                {JSON.stringify(selected.details, null, 2)}
              </pre>
            </div>
            <div>
              <span style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 1 }}>Hora</span>
              <p style={{ fontSize: 12, margin: '2px 0 0', color: C.muted }}>
                {new Date(selected.created_at).toLocaleString('es-ES')}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function chipStyle(active: boolean): React.CSSProperties {
  return {
    padding: '6px 12px', background: active ? C.accent2 : C.card, color: active ? '#fff' : C.text,
    border: `1px solid ${active ? C.accent2 : C.border}`, borderRadius: 0,
    cursor: 'pointer', fontSize: 11, fontWeight: 600, transition: 'all 0.15s',
  };
}

function timeAgo(date: string): string {
  const sec = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (sec < 60) return `hace ${sec}s`;
  if (sec < 3600) return `hace ${Math.floor(sec / 60)}min`;
  if (sec < 86400) return `hace ${Math.floor(sec / 3600)}h`;
  return new Date(date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}
