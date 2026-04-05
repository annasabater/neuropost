'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Send, Clock, AlertTriangle } from 'lucide-react';

const W = { bg: '#0a0a14', card: '#111827', border: '#1e2533', blue: '#3b82f6', text: '#e5e7eb', muted: '#6b7280' };

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

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  open:        { label: 'Abierto',    color: '#fbbf24' },
  in_progress: { label: 'En proceso', color: '#60a5fa' },
  resolved:    { label: 'Resuelto',   color: '#34d399' },
  closed:      { label: 'Cerrado',    color: W.muted },
};

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

export default function WorkerSoportePage() {
  const [tickets, setTickets]     = useState<Ticket[]>([]);
  const [selected, setSelected]   = useState<Ticket | null>(null);
  const [messages, setMessages]   = useState<TicketMessage[]>([]);
  const [loading, setLoading]     = useState(true);
  const [reply, setReply]         = useState('');
  const [sending, setSending]     = useState(false);
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
      <div style={{ padding: '28px 36px', maxWidth: 800, color: W.text }}>
        <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: W.muted, cursor: 'pointer', fontSize: 13, marginBottom: 16, padding: 0 }}>
          ← Todos los tickets
        </button>
        <div style={{ background: W.card, border: `1px solid ${W.border}`, borderRadius: 12, padding: '20px 24px', marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: W.text, marginBottom: 6 }}>{selected.subject}</h2>
              <div style={{ fontSize: 13, color: W.muted }}>
                {selected.brands?.name} · {hoursAgo(selected.created_at)}
                {isOverdue && <span style={{ marginLeft: 10, color: '#ef4444', fontWeight: 700 }}>⚠ Sin respuesta +4h</span>}
              </div>
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20, color: st.color, background: 'rgba(255,255,255,0.1)', border: `1px solid ${st.color}` }}>{st.label}</span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            {['in_progress', 'resolved'].map((s) => (
              <button key={s} onClick={() => sendReply(s)} style={{ padding: '6px 16px', border: `1px solid ${W.border}`, borderRadius: 8, background: 'none', color: W.muted, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                {s === 'in_progress' ? '🔄 Marcar en proceso' : '✅ Resolver'}
              </button>
            ))}
          </div>
        </div>

        {/* Messages */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
          {messages.map((msg) => {
            const isWorker = msg.sender_type === 'worker';
            return (
              <div key={msg.id} style={{ display: 'flex', justifyContent: isWorker ? 'flex-end' : 'flex-start' }}>
                <div style={{ maxWidth: '70%', background: isWorker ? 'rgba(59,130,246,0.15)' : W.card, border: `1px solid ${isWorker ? W.blue : W.border}`, borderRadius: 12, padding: '10px 14px' }}>
                  <div style={{ fontSize: 11, color: W.muted, marginBottom: 4, fontWeight: 600 }}>
                    {isWorker ? 'Tú (worker)' : selected.brands?.name ?? 'Cliente'}
                  </div>
                  <div style={{ fontSize: 14, color: W.text, lineHeight: 1.5 }}>{msg.message}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Quick replies */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: W.muted, marginBottom: 6, fontWeight: 600 }}>RESPUESTAS RÁPIDAS</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {QUICK_REPLIES.map((qr) => (
              <button key={qr} onClick={() => setReply(qr)} style={{ padding: '4px 12px', border: `1px solid ${W.border}`, borderRadius: 20, background: 'none', color: W.muted, cursor: 'pointer', fontSize: 11 }}>
                {qr.slice(0, 40)}…
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={3} placeholder="Escribe una respuesta..."
            style={{ flex: 1, padding: '10px 14px', background: W.card, border: `1px solid ${W.border}`, borderRadius: 10, color: W.text, fontSize: 14, resize: 'none', outline: 'none', fontFamily: 'inherit' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button onClick={() => sendReply()} disabled={!reply.trim() || sending}
              style={{ padding: '10px 20px', background: W.blue, color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Send size={15} /> Enviar
            </button>
            <button onClick={() => sendReply('resolved')} disabled={!reply.trim() || sending}
              style={{ padding: '10px 16px', background: 'none', border: `1px solid #34d399`, borderRadius: 10, cursor: 'pointer', color: '#34d399', fontWeight: 600, fontSize: 12 }}>
              Enviar y resolver
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '28px 36px', maxWidth: 1000, color: W.text }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Tickets de soporte</h1>
        <p style={{ color: W.muted, fontSize: 14 }}>Gestiona las consultas e incidencias de los clientes</p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[{ v: 'open', l: 'Abiertos' }, { v: 'in_progress', l: 'En proceso' }, { v: 'resolved', l: 'Resueltos' }, { v: 'all', l: 'Todos' }].map((opt) => (
          <button key={opt.v} onClick={() => setStatusFilter(opt.v)} style={{
            padding: '6px 16px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none',
            background: statusFilter === opt.v ? W.blue : W.card,
            color: statusFilter === opt.v ? '#fff' : W.muted,
          }}>
            {opt.l}
          </button>
        ))}
      </div>

      {loading ? <p style={{ color: W.muted }}>Cargando...</p> : tickets.length === 0 ? (
        <p style={{ color: W.muted, textAlign: 'center', padding: '60px 0' }}>Sin tickets con este filtro</p>
      ) : (
        <div style={{ background: W.card, border: `1px solid ${W.border}`, borderRadius: 12, overflow: 'hidden' }}>
          {tickets.map((ticket, i) => {
            const st = STATUS_CONFIG[ticket.status] ?? STATUS_CONFIG.open;
            const hoursOld = (Date.now() - new Date(ticket.created_at).getTime()) / 3600000;
            const isOverdue = hoursOld > 4 && ticket.status === 'open';
            return (
              <div key={ticket.id} onClick={() => openTicket(ticket)} style={{ padding: '16px 24px', borderBottom: i < tickets.length - 1 ? `1px solid ${W.border}` : 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    {ticket.priority === 'urgent' && <AlertTriangle size={14} color="#ef4444" />}
                    <span style={{ fontWeight: 600, fontSize: 14, color: W.text }}>{ticket.subject}</span>
                  </div>
                  <div style={{ fontSize: 12, color: W.muted }}>{ticket.brands?.name ?? '—'} · {hoursAgo(ticket.created_at)}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {isOverdue && <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 700 }}>+4h sin resp.</span>}
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, color: st.color, background: 'rgba(255,255,255,0.08)', border: `1px solid ${st.color}` }}>{st.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
