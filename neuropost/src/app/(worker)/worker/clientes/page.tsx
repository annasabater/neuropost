'use client';

import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Users, Activity } from 'lucide-react';

const f = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";
const C = {
  bg: '#ffffff',
  bg1: '#f3f4f6',
  bg2: '#ecfdf5',
  card: '#ffffff',
  border: '#e5e7eb',
  text: '#111111',
  muted: '#6b7280',
  accent: '#0F766E',
  accent2: '#0D9488',
  red: '#0F766E',
  orange: '#0D9488',
  green: '#0F766E',
};

type Client = {
  id: string; name: string; sector: string | null; plan: string;
  ig_username: string | null; email: string | null;
  pending_in_queue: number; created_at: string;
};

type Event = { id: string; action: string; created_at: string; details: Record<string, unknown> | null; brands?: { name: string; sector: string } };

const PLAN_COLOR: Record<string, string> = { starter: '#6b7280', pro: '#3b82f6', total: '#8b5cf6', agency: '#f59e0b' };

const ACTION_ICON: Record<string, string> = {
  post_uploaded: '📸', post_approved: '✅', post_rejected: '❌', post_published: '🚀',
  logged_in: '🔑', settings_changed: '⚙️', plan_changed: '💳',
  instagram_connected: '📱', feedback_sent: '💬',
};

function timeAgo(d: string) {
  const min = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (min < 1) return 'hace un momento';
  if (min < 60) return `hace ${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h}h`;
  return `hace ${Math.floor(h / 24)}d`;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TAB 1: LISTA
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function ListaTab() {
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [planFilter, setPlan] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/worker/clientes').then((r) => r.json()).then((d) => {
      setClients(d.clients ?? []);
      setLoading(false);
    });
  }, []);

  const filtered = clients.filter((c) => {
    const q = search.toLowerCase();
    const matchSearch = !search
      || c.name.toLowerCase().includes(q)
      || c.ig_username?.toLowerCase().includes(q)
      || c.email?.toLowerCase().includes(q);
    const matchPlan = !planFilter || c.plan === planFilter;
    return matchSearch && matchPlan;
  });

  return (
    <div style={{ padding: '32px 40px', flex: 1, overflow: 'auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 4 }}>Todos los clientes</h1>
        <p style={{ color: C.muted, fontSize: 14 }}>{clients.length} clientes asignados</p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Buscar por nombre o @username..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: '1 1 280px', padding: '9px 14px', borderRadius: 0,
            background: C.card, border: `1px solid ${C.border}`,
            color: C.text, fontSize: 13, outline: 'none',
          }}
        />
        <select value={planFilter} onChange={(e) => setPlan(e.target.value)} style={{ padding: '9px 14px', borderRadius: 0, background: C.card, border: `1px solid ${C.border}`, color: C.text, fontSize: 13 }}>
          <option value="">Todos los planes</option>
          <option value="starter">Starter</option>
          <option value="pro">Pro</option>
          <option value="total">Total</option>
          <option value="agency">Agency</option>
        </select>
      </div>

      {loading ? (
        <p style={{ color: C.muted, fontSize: 13 }}>Cargando...</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {filtered.map((client) => (
            <Link key={client.id} href={`/worker/clientes/${client.id}`} style={{ textDecoration: 'none' }}>
              <div style={{
                background: C.card, border: `1px solid ${C.border}`, borderRadius: 0, padding: 20,
                cursor: 'pointer', transition: 'border-color 0.2s',
              }} onMouseEnter={(e) => (e.currentTarget.style.borderColor = C.accent2)}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = C.border)}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10, gap: 10 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {client.name}
                    </div>
                    {client.ig_username && (
                      <div style={{ fontSize: 12, color: C.muted }}>@{client.ig_username}</div>
                    )}
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 0, textTransform: 'uppercase',
                    letterSpacing: '0.05em', fontFamily: fc, flexShrink: 0,
                    background: `${PLAN_COLOR[client.plan] ?? '#6b7280'}22`,
                    color: PLAN_COLOR[client.plan] ?? '#6b7280',
                    border: `1px solid ${PLAN_COLOR[client.plan] ?? '#6b7280'}44`,
                  }}>
                    {client.plan}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
                  <div style={{ fontSize: 12, color: C.text, fontWeight: 600, textTransform: 'capitalize' }}>
                    {client.sector?.replace(/_/g, ' ') ?? 'Sin sector'}
                  </div>
                  {client.email && (
                    <div style={{ fontSize: 11, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {client.email}
                    </div>
                  )}
                  <div style={{ fontSize: 10, color: C.muted, fontFamily: fc, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Cliente desde {new Date(client.created_at).toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })}
                  </div>
                </div>

                {client.pending_in_queue > 0 && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(239,68,68,0.1)', color: C.red, fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 0 }}>
                    ⏳ {client.pending_in_queue} pendiente{client.pending_in_queue > 1 ? 's' : ''}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TAB 2: ACTIVIDAD
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function ActividadTab() {
  const [events, setEvents] = useState<Event[]>([]);
  const [mine, setMine] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/worker/actividad${mine ? '?mine=1' : ''}`).then((r) => r.json()).then((d) => {
      setEvents(d.events ?? []);
      setLoading(false);
    });
  }, [mine]);

  return (
    <div style={{ padding: '32px 40px', maxWidth: 800, flex: 1, overflow: 'auto' }}>
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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN PAGE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

type ClientesTab = 'lista' | 'actividad';
type IconProps = { size?: number; style?: React.CSSProperties };

const CLIENTES_TABS: { key: ClientesTab; title: string; desc: string; icon: React.ComponentType<IconProps> }[] = [
  { key: 'lista', title: 'Clientes', desc: 'Todos los clientes', icon: Users },
  { key: 'actividad', title: 'Actividad', desc: 'Historial de acciones', icon: Activity },
];

export default function ClientesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = (searchParams.get('tab') as ClientesTab) || 'lista';

  function setTab(t: ClientesTab) {
    router.push(`/worker/clientes?tab=${t}`);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: C.bg }}>
      {/* Header */}
      <div style={{ padding: '48px 40px 40px', borderBottom: `1px solid ${C.border}` }}>
        <h1 style={{ fontFamily: fc, fontWeight: 900, fontSize: 'clamp(2.5rem, 5vw, 3.5rem)', textTransform: 'uppercase', letterSpacing: '0.01em', color: C.text, lineHeight: 0.95, marginBottom: 8 }}>
          Clientes
        </h1>
        <p style={{ color: C.muted, fontSize: 15, fontFamily: f }}>Gestión de cuentas</p>
      </div>

      {/* Tab selector — Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1px', background: C.border, border: `1px solid ${C.border}`, margin: '40px', marginBottom: 0 }}>
        {CLIENTES_TABS.map((s) => {
          const active = tab === s.key;
          const Icon = s.icon;
          return (
            <button
              key={s.key}
              onClick={() => setTab(s.key)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12,
                padding: '28px 20px',
                background: active ? C.accent : C.card,
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <Icon size={28} style={{ color: active ? '#ffffff' : C.accent2 }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: fc, fontWeight: 700, fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.06em', color: active ? '#ffffff' : C.text }}>
                  {s.title}
                </div>
                <div style={{ fontSize: 12, color: active ? 'rgba(255,255,255,0.8)' : C.muted, marginTop: 4 }}>
                  {s.desc}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {tab === 'lista' && <ListaTab />}
        {tab === 'actividad' && <ActividadTab />}
      </div>
    </div>
  );
}
