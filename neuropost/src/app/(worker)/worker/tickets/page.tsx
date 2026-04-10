'use client';

import { useEffect, useState } from 'react';
import { Ticket as TicketIcon, Clock, AlertCircle } from 'lucide-react';
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

interface Ticket {
  id: string;
  ticket_number: string;
  brand_id: string;
  subject: string;
  description: string;
  status: string;
  priority: 'critical' | 'high' | 'normal' | 'low';
  category: string;
  source: string;
  assigned_worker_id: string | null;
  sla_deadline: string | null;
  sla_breached: boolean;
  created_at: string;
  brands?: { name: string };
}

const COLUMNS = [
  { key: 'open', label: 'Abiertos' },
  { key: 'assigned', label: 'Asignados' },
  { key: 'in_progress', label: 'En progreso' },
  { key: 'waiting_user', label: 'Esperando user' },
  { key: 'resolved', label: 'Resueltos' },
];

const PRIORITY_COLORS = {
  critical: '#ef4444',
  high: '#f59e0b',
  normal: '#3b82f6',
  low: '#6b7280',
};

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Ticket | null>(null);

  useEffect(() => {
    (async () => {
      const sb = createBrowserClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (sb as any)
        .from('tickets')
        .select('*, brands(name)')
        .order('created_at', { ascending: false })
        .limit(200);
      setTickets(data ?? []);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div style={{ padding: 40, color: C.muted }}>Cargando tickets...</div>;

  const byColumn = COLUMNS.map((col) => ({
    ...col,
    items: tickets.filter((t) => t.status === col.key),
  }));

  return (
    <div style={{ padding: 28, color: C.text }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          <TicketIcon size={22} style={{ color: C.accent2 }} /> Tickets
        </h1>
        <p style={{ color: C.muted, fontSize: 13, margin: '4px 0 0' }}>{tickets.length} tickets totales</p>
      </div>

      {/* Kanban */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
        {byColumn.map((col) => (
          <div key={col.key} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 0, padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 8, borderBottom: `1px solid ${C.border}` }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{col.label}</span>
              <span style={{ fontSize: 11, color: C.muted, background: C.bg1, padding: '2px 8px', borderRadius: 0 }}>{col.items.length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 200 }}>
              {col.items.map((t) => (
                <div key={t.id} onClick={() => setSelected(t)} style={{
                  background: C.bg1, padding: 10, borderRadius: 0, cursor: 'pointer',
                  borderLeft: `3px solid ${PRIORITY_COLORS[t.priority]}`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 10, color: C.muted, fontFamily: 'monospace' }}>{t.ticket_number}</span>
                    {t.sla_breached && <AlertCircle size={11} style={{ color: C.red }} />}
                  </div>
                  <p style={{ fontSize: 12, fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {t.subject}
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                    <span style={{ fontSize: 10, color: C.accent2 }}>{t.brands?.name ?? '—'}</span>
                    <span style={{ fontSize: 10, color: C.muted, display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Clock size={9} /> {timeAgo(t.created_at)}
                    </span>
                  </div>
                </div>
              ))}
              {col.items.length === 0 && (
                <p style={{ fontSize: 11, color: C.muted, textAlign: 'center', padding: 20 }}>—</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Detail modal */}
      {selected && (
        <div onClick={() => setSelected(null)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 20,
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: C.card, border: `1px solid ${C.border}`, borderRadius: 0,
            padding: 28, maxWidth: 600, width: '100%', maxHeight: '90vh', overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <span style={{ fontSize: 11, color: C.muted, fontFamily: 'monospace' }}>{selected.ticket_number}</span>
                <h2 style={{ fontSize: 20, fontWeight: 700, margin: '4px 0' }}>{selected.subject}</h2>
              </div>
              <span style={{ fontSize: 10, padding: '4px 10px', background: PRIORITY_COLORS[selected.priority] + '22', color: PRIORITY_COLORS[selected.priority], borderRadius: 0, fontWeight: 700, textTransform: 'uppercase' }}>
                {selected.priority}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
              <Field label="Estado" value={selected.status} />
              <Field label="Categoría" value={selected.category} />
              <Field label="Origen" value={selected.source} />
              <Field label="Brand" value={selected.brands?.name ?? '—'} />
              <Field label="Creado" value={timeAgo(selected.created_at)} />
              <Field label="SLA" value={selected.sla_breached ? 'Vencido' : (selected.sla_deadline ? timeAgo(selected.sla_deadline) : '—')} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <span style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 1 }}>Descripción</span>
              <p style={{ fontSize: 13, lineHeight: 1.6, marginTop: 4, whiteSpace: 'pre-wrap' }}>{selected.description}</p>
            </div>
            <button onClick={() => setSelected(null)} style={{
              padding: '10px 20px', background: C.accent2, color: '#fff', border: 'none',
              borderRadius: 0, cursor: 'pointer', fontWeight: 600,
            }}>
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</span>
      <p style={{ fontSize: 12, margin: '2px 0 0', textTransform: 'capitalize' }}>{value}</p>
    </div>
  );
}

function timeAgo(date: string): string {
  const sec = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}min`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h`;
  return `${Math.floor(sec / 86400)}d`;
}
