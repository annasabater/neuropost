'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { Send, AlertTriangle, Mail, Bell } from 'lucide-react';
import toast from 'react-hot-toast';

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

type Tab = 'mensajes' | 'soporte' | 'notificaciones';
type IconProps = { size?: number; style?: React.CSSProperties };

const TABS: { key: Tab; title: string; desc: string; icon: React.ComponentType<IconProps> }[] = [
  { key: 'mensajes', title: 'Mensajes', desc: 'Comunicación del equipo', icon: Mail },
  { key: 'soporte', title: 'Soporte', desc: 'Tickets y consultas', icon: AlertTriangle },
  { key: 'notificaciones', title: 'Notificaciones', desc: 'Actividad del sistema', icon: Bell },
];

type Msg = { id: string; message: string; created_at: string; from_worker_id: string; workers?: { full_name: string } };
type Ticket = {
  id: string;
  subject: string;
  description: string | null;
  category: string;
  priority: string;
  status: string;
  resolution: string | null;
  created_at: string;
  resolved_at: string | null;
  brands: { id: string; name: string } | null;
};
type TicketMessage = {
  id: string;
  sender_type: 'client' | 'worker';
  message: string;
  created_at: string;
};

function timeAgo(d: string) {
  const min = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h}h`;
  return `hace ${Math.floor(h / 24)}d`;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  open:        { label: 'Abierto',    color: '#fbbf24' },
  in_progress: { label: 'En proceso', color: '#60a5fa' },
  resolved:    { label: 'Resuelto',   color: '#34d399' },
  closed:      { label: 'Cerrado',    color: C.muted },
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TAB 1: MENSAJES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function MensajesTab() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  function fetchMessages() {
    fetch('/api/worker/mensajes').then((r) => r.json()).then((d) => {
      setMessages((d.messages ?? []).reverse());
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    });
  }

  useEffect(() => { fetchMessages(); }, []);

  async function send() {
    if (!text.trim() || loading) return;
    setLoading(true);
    const res = await fetch('/api/worker/mensajes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text }),
    });
    if (res.ok) { setText(''); fetchMessages(); }
    else toast.error('Error al enviar');
    setLoading(false);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '24px 32px' }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: C.text, marginBottom: 4 }}>Mensajes</h1>
      <p style={{ color: C.muted, fontSize: 13, marginBottom: 20 }}>Comunicación interna del equipo</p>

      <div style={{ flex: 1, overflowY: 'auto', background: C.card, border: `1px solid ${C.border}`, borderRadius: 0, padding: '16px 20px', marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.length === 0 ? (
          <p style={{ color: C.muted, fontSize: 13, textAlign: 'center', margin: 'auto' }}>Sin mensajes todavía. ¡Sé el primero! 👋</p>
        ) : messages.map((msg) => (
          <div key={msg.id} style={{ display: 'flex', gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: C.accent2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
              {(msg.workers?.full_name ?? 'W').charAt(0)}
            </div>
            <div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{msg.workers?.full_name ?? 'Worker'}</span>
                <span style={{ fontSize: 10, color: C.muted }}>{timeAgo(msg.created_at)}</span>
              </div>
              <div style={{ fontSize: 13, color: C.text, background: C.bg1, borderRadius: 0, padding: '8px 12px', display: 'inline-block', maxWidth: 480 }}>
                {msg.message}
              </div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
          placeholder="Escribe un mensaje..."
          style={{ flex: 1, padding: '10px 14px', borderRadius: 0, background: C.card, border: `1px solid ${C.border}`, color: C.text, fontSize: 13, outline: 'none' }}
        />
        <button onClick={send} disabled={loading || !text.trim()} style={{ padding: '10px 20px', borderRadius: 0, background: C.accent2, color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer', opacity: loading || !text.trim() ? 0.5 : 1 }}>
          Enviar
        </button>
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TAB 2: SOPORTE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const QUICK_REPLIES = [
  'Estamos investigando el problema, te informamos en breve.',
  'Hemos solucionado el problema. Comprueba si todo funciona correctamente.',
  'Para esto necesitamos que vayas a Ajustes y nos indiques el error exacto.',
  'Tu consulta ha sido procesada correctamente.',
];

function hoursAgo(d: string) {
  const h = (Date.now() - new Date(d).getTime()) / 3600000;
  if (h < 1) return `hace ${Math.floor(h * 60)}min`;
  if (h < 24) return `hace ${Math.floor(h)}h`;
  return `hace ${Math.floor(h / 24)}d`;
}

function SoporteTab() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [statusFilter, setStatusFilter] = useState('open');

  useEffect(() => {
    const params = statusFilter !== 'all' ? `?status=${statusFilter}` : '';
    fetch(`/api/worker/soporte${params}`).then((r) => r.json()).then((d) => {
      setTickets(d.tickets ?? []);
      setLoading(false);
    });
  }, [statusFilter]);

  async function openTicket(ticket: Ticket) {
    setSelected(ticket);
    const d = await fetch(`/api/soporte/${ticket.id}`).then((r) => r.json());
    setMessages(d.messages ?? []);
  }

  async function sendReply(status?: string) {
    if (!selected) return;
    if (!reply.trim() && !status) return;
    setSending(true);
    const body: Record<string, string> = {};
    if (status) body.status = status;
    if (reply.trim()) body.message = reply.trim();
    if (status === 'resolved') body.resolution = reply.trim();

    const res = await fetch(`/api/worker/soporte?id=${selected.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const d = await res.json();
    if (res.ok) {
      setSelected(d.ticket);
      setTickets((prev) => prev.map((t) => t.id === d.ticket.id ? d.ticket : t));
      if (reply.trim()) {
        setMessages((prev) => [...prev, { id: Date.now().toString(), sender_type: 'worker', message: reply.trim(), created_at: new Date().toISOString() }]);
      }
      setReply('');
      toast.success(status === 'resolved' ? 'Ticket resuelto' : 'Respuesta enviada');
    } else toast.error(d.error ?? 'Error');
    setSending(false);
  }

  if (selected) {
    const st = STATUS_CONFIG[selected.status] ?? STATUS_CONFIG.open;
    const isOverdue = (Date.now() - new Date(selected.created_at).getTime()) > 4 * 3600000 && selected.status === 'open';
    return (
      <div style={{ padding: '28px 36px', maxWidth: 800, color: C.text, overflow: 'auto', flex: 1 }}>
        <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 13, marginBottom: 16, padding: 0 }}>
          ← Todos los tickets
        </button>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 0, padding: '20px 24px', marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 6 }}>{selected.subject}</h2>
              <div style={{ fontSize: 13, color: C.muted }}>
                {selected.brands?.name} · {hoursAgo(selected.created_at)}
                {isOverdue && <span style={{ marginLeft: 10, color: C.red, fontWeight: 700 }}>⚠ Sin respuesta +4h</span>}
              </div>
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 0, color: st.color, background: 'rgba(255,255,255,0.1)', border: `1px solid ${st.color}` }}>{st.label}</span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            {['in_progress', 'resolved'].map((s) => (
              <button key={s} onClick={() => sendReply(s)} style={{ padding: '6px 16px', border: `1px solid ${C.border}`, borderRadius: 0, background: 'none', color: C.muted, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                {s === 'in_progress' ? '🔄 Marcar en proceso' : '✅ Resolver'}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
          {messages.map((msg) => {
            const isWorker = msg.sender_type === 'worker';
            return (
              <div key={msg.id} style={{ display: 'flex', justifyContent: isWorker ? 'flex-end' : 'flex-start' }}>
                <div style={{ maxWidth: '70%', background: isWorker ? 'rgba(59,130,246,0.15)' : C.card, border: `1px solid ${isWorker ? C.accent2 : C.border}`, borderRadius: 0, padding: '10px 14px' }}>
                  <div style={{ fontSize: 11, color: C.muted, marginBottom: 4, fontWeight: 600 }}>
                    {isWorker ? 'Tú (worker)' : selected.brands?.name ?? 'Cliente'}
                  </div>
                  <div style={{ fontSize: 14, color: C.text, lineHeight: 1.5 }}>{msg.message}</div>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 6, fontWeight: 600 }}>RESPUESTAS RÁPIDAS</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {QUICK_REPLIES.map((qr) => (
              <button key={qr} onClick={() => setReply(qr)} style={{ padding: '4px 12px', border: `1px solid ${C.border}`, borderRadius: 0, background: 'none', color: C.muted, cursor: 'pointer', fontSize: 11 }}>
                {qr.slice(0, 40)}…
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={3} placeholder="Escribe una respuesta..."
            style={{ flex: 1, padding: '10px 14px', background: C.card, border: `1px solid ${C.border}`, borderRadius: 0, color: C.text, fontSize: 14, resize: 'none', outline: 'none', fontFamily: 'inherit' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button onClick={() => sendReply()} disabled={!reply.trim() || sending}
              style={{ padding: '10px 20px', background: C.accent2, color: '#fff', border: 'none', borderRadius: 0, cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Send size={15} /> Enviar
            </button>
            <button onClick={() => sendReply('resolved')} disabled={!reply.trim() || sending}
              style={{ padding: '10px 16px', background: 'none', border: `1px solid #34d399`, borderRadius: 0, cursor: 'pointer', color: '#34d399', fontWeight: 600, fontSize: 12 }}>
              Enviar y resolver
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '28px 36px', maxWidth: 1000, color: C.text, overflow: 'auto', flex: 1 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Soporte</h1>
        <p style={{ color: C.muted, fontSize: 14 }}>Gestiona las consultas e incidencias de los clientes</p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[{ v: 'open', l: 'Abiertos' }, { v: 'in_progress', l: 'En proceso' }, { v: 'resolved', l: 'Resueltos' }, { v: 'all', l: 'Todos' }].map((opt) => (
          <button key={opt.v} onClick={() => setStatusFilter(opt.v)} style={{
            padding: '6px 16px', borderRadius: 0, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none',
            background: statusFilter === opt.v ? C.accent2 : C.card,
            color: statusFilter === opt.v ? '#fff' : C.muted,
          }}>
            {opt.l}
          </button>
        ))}
      </div>

      {loading ? <p style={{ color: C.muted }}>Cargando...</p> : tickets.length === 0 ? (
        <p style={{ color: C.muted, textAlign: 'center', padding: '60px 0' }}>Sin tickets con este filtro</p>
      ) : (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 0, overflow: 'hidden' }}>
          {tickets.map((ticket, i) => {
            const st = STATUS_CONFIG[ticket.status] ?? STATUS_CONFIG.open;
            const hoursOld = (Date.now() - new Date(ticket.created_at).getTime()) / 3600000;
            const isOverdue = hoursOld > 4 && ticket.status === 'open';
            return (
              <div key={ticket.id} onClick={() => openTicket(ticket)} style={{ padding: '16px 24px', borderBottom: i < tickets.length - 1 ? `1px solid ${C.border}` : 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0.02)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    {ticket.priority === 'urgent' && <AlertTriangle size={14} color={C.red} />}
                    <span style={{ fontWeight: 600, fontSize: 14, color: C.text }}>{ticket.subject}</span>
                  </div>
                  <div style={{ fontSize: 12, color: C.muted }}>{ticket.brands?.name ?? '—'} · {hoursAgo(ticket.created_at)}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {isOverdue && <span style={{ fontSize: 11, color: C.red, fontWeight: 700 }}>+4h sin resp.</span>}
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 0, color: st.color, background: 'rgba(255,255,255,0.08)', border: `1px solid ${st.color}` }}>{st.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TAB 3: NOTIFICACIONES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function NotificacionesTab() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(false);
    setNotifications([]);
  }, []);

  return (
    <div style={{ padding: '28px 36px', maxWidth: 800, color: C.text, flex: 1, overflow: 'auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Notificaciones</h1>
        <p style={{ color: C.muted, fontSize: 14 }}>Tu panel de notificaciones del sistema</p>
      </div>

      {loading ? (
        <p style={{ color: C.muted }}>Cargando notificaciones...</p>
      ) : notifications.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: C.card, border: `1px solid ${C.border}`, borderRadius: 0 }}>
          <Bell size={48} style={{ color: C.muted, margin: '0 auto 16px' }} />
          <p style={{ fontSize: 14, color: C.muted }}>Sin notificaciones por ahora</p>
        </div>
      ) : (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 0, overflow: 'hidden' }}>
          {/* Notificaciones irían aquí */}
        </div>
      )}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN PAGE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function InboxPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = (searchParams.get('tab') as Tab) || 'mensajes';

  function setTab(t: Tab) { router.push(`/worker/inbox?tab=${t}`); }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: C.bg }}>
      {/* Header */}
      <div style={{ padding: '48px 40px 40px', borderBottom: `1px solid ${C.border}` }}>
        <h1 style={{ fontFamily: fc, fontWeight: 900, fontSize: 'clamp(2.5rem, 5vw, 3.5rem)', textTransform: 'uppercase', letterSpacing: '0.01em', color: C.text, lineHeight: 0.95, marginBottom: 8 }}>
          Inbox
        </h1>
        <p style={{ color: C.muted, fontSize: 15, fontFamily: f }}>Todo lo que necesitas atender en tu equipo</p>
      </div>

      {/* Tab selector — Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', background: C.border, border: `1px solid ${C.border}`, margin: '40px', marginBottom: 0 }}>
        {TABS.map((s) => {
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
        {tab === 'mensajes' && <MensajesTab />}
        {tab === 'soporte' && <SoporteTab />}
        {tab === 'notificaciones' && <NotificacionesTab />}
      </div>
    </div>
  );
}
