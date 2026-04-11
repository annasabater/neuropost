'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useRef, useMemo, useSyncExternalStore } from 'react';
import { Send, AlertTriangle, MessageCircle, MessageSquare, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { createBrowserClient } from '@/lib/supabase';
import {
  approveTestimonial,
  rejectTestimonial,
  deleteTestimonial,
  subscribeTestimonials,
  getTestimonialsSnapshot,
  getTestimonialsServerSnapshot,
} from '@/lib/site-testimonials';

// Realtime row shapes
type ChatRow = {
  id: string; brand_id: string; sender_id: string | null;
  sender_type: 'client' | 'worker'; message: string; created_at: string;
  read_at: string | null; brands?: { name: string } | null;
};
type TicketRow = {
  id: string; brand_id: string; subject: string; status: string;
  category: string; priority: string; created_at: string;
  brands?: { id: string; name: string } | null;
};

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

type Tab = 'cliente' | 'soporte' | 'testimonios';
type IconProps = { size?: number; style?: React.CSSProperties };

const TABS: { key: Tab; title: string; desc: string; icon: React.ComponentType<IconProps> }[] = [
  { key: 'cliente',     title: 'Clientes',    desc: 'Chat con clientes',    icon: MessageCircle },
  { key: 'soporte',     title: 'Soporte',     desc: 'Tickets y consultas',  icon: AlertTriangle },
  { key: 'testimonios', title: 'Testimonios', desc: 'Comentarios sobre la web', icon: MessageSquare },
];

type ChatMsg = {
  id: string;
  brand_id: string;
  sender_type: 'client' | 'worker';
  message: string;
  created_at: string;
  read_at: string | null;
  brands?: { name: string } | null;
};
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
// TAB 1: CLIENTES (chat cliente ↔ worker)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

type Conversation = {
  brandId: string;
  brandName: string;
  lastMessage: string;
  lastAt: string;
  answered: boolean; // último mensaje es del worker → contestado
  clientCount: number; // nº de mensajes del cliente
};

function ClienteTab() {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unanswered' | 'answered'>('all');
  const bottomRef = useRef<HTMLDivElement>(null);
  const supabase = useMemo(() => createBrowserClient(), []);

  async function fetchAll() {
    setLoading(true);
    try {
      const res = await fetch('/api/chat/worker');
      const data = await res.json();
      setMessages(data.messages ?? []);
    } catch {
      toast.error('Error cargando mensajes');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchAll(); }, []);

  // ── Realtime: any new chat_messages row lands here instantly ───────────
  useEffect(() => {
    const ch = (supabase.channel('worker-chat-all') as unknown as {
      on: (event: string, filter: Record<string, unknown>, cb: (payload: { new: ChatRow }) => void) => typeof ch;
      subscribe: () => typeof ch;
    });
    ch.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'chat_messages' },
      (payload) => {
        const row = payload.new;
        setMessages((prev) => {
          if (prev.some((m) => m.id === row.id)) return prev;
          return [...prev, row as unknown as ChatMsg];
        });
        if (row.sender_type === 'client') {
          const name = row.brands?.name ?? 'cliente';
          toast.success(`Nuevo mensaje de ${name}`);
        }
      },
    ).subscribe();
    return () => { supabase.removeChannel(ch as unknown as Parameters<typeof supabase.removeChannel>[0]); };
  }, [supabase]);

  // Agrupa por brand y calcula si está contestado
  const conversations = useMemo<Conversation[]>(() => {
    const byBrand = new Map<string, ChatMsg[]>();
    for (const m of messages) {
      if (!byBrand.has(m.brand_id)) byBrand.set(m.brand_id, []);
      byBrand.get(m.brand_id)!.push(m);
    }
    const list: Conversation[] = [];
    for (const [brandId, msgs] of byBrand.entries()) {
      const sorted = [...msgs].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      const last = sorted[sorted.length - 1];
      list.push({
        brandId,
        brandName: last.brands?.name ?? 'Cliente',
        lastMessage: last.message,
        lastAt: last.created_at,
        answered: last.sender_type === 'worker',
        clientCount: sorted.filter((m) => m.sender_type === 'client').length,
      });
    }
    return list.sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime());
  }, [messages]);

  const filtered = conversations.filter((c) => {
    if (filter === 'unanswered') return !c.answered;
    if (filter === 'answered') return c.answered;
    return true;
  });

  const selectedMessages = useMemo(
    () => messages
      .filter((m) => m.brand_id === selected)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [messages, selected],
  );

  const selectedConv = conversations.find((c) => c.brandId === selected);

  useEffect(() => {
    if (selected) setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }, [selected, selectedMessages.length]);

  async function send() {
    if (!text.trim() || sending || !selected) return;
    setSending(true);
    try {
      const res = await fetch('/api/chat/worker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand_id: selected, message: text.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error');
      setMessages((prev) => [...prev, data.message]);
      setText('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al enviar');
    } finally {
      setSending(false);
    }
  }

  const unansweredCount = conversations.filter((c) => !c.answered).length;

  return (
    <div style={{ display: 'flex', height: '100%', padding: '24px 32px', gap: 20 }}>
      {/* Lista de conversaciones */}
      <div style={{ width: 340, display: 'flex', flexDirection: 'column', background: C.card, border: `1px solid ${C.border}` }}>
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
            <h3 style={{ fontSize: 13, fontWeight: 800, color: C.text, margin: 0, fontFamily: fc, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Conversaciones
            </h3>
            {unansweredCount > 0 && (
              <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', background: C.accent, color: '#fff', fontFamily: fc }}>
                {unansweredCount} pendientes
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {([['all', 'Todas'], ['unanswered', 'Pendientes'], ['answered', 'Contestadas']] as const).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setFilter(k)}
                style={{
                  flex: 1, padding: '6px 4px', fontSize: 10, fontWeight: 800,
                  fontFamily: fc, textTransform: 'uppercase', letterSpacing: '0.04em',
                  background: filter === k ? C.accent : 'transparent',
                  color: filter === k ? '#fff' : C.muted,
                  border: `1px solid ${filter === k ? C.accent : C.border}`,
                  cursor: 'pointer',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: 24, color: C.muted, fontSize: 13 }}>Cargando…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 24, color: C.muted, fontSize: 13, textAlign: 'center' }}>
              Sin conversaciones{filter !== 'all' ? ` ${filter === 'unanswered' ? 'pendientes' : 'contestadas'}` : ''}.
            </div>
          ) : filtered.map((c) => {
            const isActive = selected === c.brandId;
            // Contestado → fondo gris, opacidad reducida. Pendiente → destacado.
            const bg = isActive ? C.bg2 : c.answered ? C.bg1 : C.card;
            return (
              <button
                key={c.brandId}
                onClick={() => setSelected(c.brandId)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '14px 18px',
                  // Longhand para los 4 lados: evita conflicto shorthand/longhand en rerender
                  borderTopWidth: 0,
                  borderTopStyle: 'none',
                  borderTopColor: 'transparent',
                  borderRightWidth: 0,
                  borderRightStyle: 'none',
                  borderRightColor: 'transparent',
                  borderBottomWidth: 1,
                  borderBottomStyle: 'solid',
                  borderBottomColor: C.border,
                  borderLeftWidth: 3,
                  borderLeftStyle: 'solid',
                  borderLeftColor: isActive ? C.accent : 'transparent',
                  background: bg,
                  cursor: 'pointer',
                  opacity: c.answered && !isActive ? 0.65 : 1,
                  display: 'block',
                  fontFamily: f,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 190 }}>
                    {c.brandName}
                  </span>
                  <span style={{ fontSize: 10, color: C.muted, flexShrink: 0 }}>{timeAgo(c.lastAt)}</span>
                </div>
                <div style={{ fontSize: 12, color: c.answered ? C.muted : C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.answered && <span style={{ fontSize: 10, color: C.muted, marginRight: 6 }}>✓</span>}
                  {c.lastMessage}
                </div>
                {!c.answered && (
                  <div style={{ marginTop: 6, fontSize: 9, fontWeight: 800, color: C.accent, fontFamily: fc, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    ● Pendiente de respuesta
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Panel de chat */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.card, border: `1px solid ${C.border}` }}>
        {!selected || !selectedConv ? (
          <div style={{ margin: 'auto', color: C.muted, fontSize: 14, textAlign: 'center' }}>
            <MessageCircle size={48} style={{ color: C.muted, marginBottom: 12 }} />
            <div>Selecciona una conversación</div>
          </div>
        ) : (
          <>
            <div style={{ padding: '14px 22px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 38, height: 38, background: C.accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontFamily: fc }}>
                {selectedConv.brandName.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{selectedConv.brandName}</div>
                <div style={{ fontSize: 11, color: C.muted }}>{selectedMessages.length} mensajes</div>
              </div>
              <a
                href={`/worker/clientes/${selected}?tab=2`}
                style={{ fontSize: 11, fontWeight: 800, color: C.accent, textDecoration: 'none', fontFamily: fc, textTransform: 'uppercase', letterSpacing: '0.05em' }}
              >
                Ver cliente →
              </a>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 10, background: C.bg1 }}>
              {selectedMessages.map((m) => {
                const isClient = m.sender_type === 'client';
                // Worker view: client on the LEFT (grey), worker on the RIGHT (accent).
                return (
                  <div key={m.id} style={{ display: 'flex', justifyContent: isClient ? 'flex-start' : 'flex-end' }}>
                    <div
                      style={{
                        maxWidth: '76%',
                        padding: '10px 14px',
                        background: isClient ? '#e5e7eb' : '#d1fae5',
                        color: C.text,
                        fontSize: 13,
                        lineHeight: 1.5,
                        border: `1px solid ${isClient ? '#d1d5db' : '#a7f3d0'}`,
                      }}
                    >
                      <div style={{ fontSize: 10, fontWeight: 800, color: C.muted, marginBottom: 4, fontFamily: fc, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {isClient ? selectedConv.brandName : 'Tú'}
                      </div>
                      <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.message}</div>
                      <div style={{ fontSize: 10, color: C.muted, marginTop: 4, textAlign: 'right' }}>
                        {new Date(m.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            <div style={{ padding: 14, borderTop: `1px solid ${C.border}`, display: 'flex', gap: 8 }}>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
                }}
                placeholder="Escribe una respuesta…"
                rows={2}
                style={{
                  flex: 1, padding: '10px 12px', background: C.bg1, border: `1px solid ${C.border}`,
                  borderRadius: 0, color: C.text, fontSize: 13, resize: 'none', outline: 'none', fontFamily: f,
                }}
              />
              <button
                onClick={send}
                disabled={!text.trim() || sending}
                style={{
                  padding: '10px 18px', background: C.accent, color: '#fff', border: 'none', borderRadius: 0,
                  fontWeight: 800, fontSize: 12, fontFamily: fc, textTransform: 'uppercase', letterSpacing: '0.05em',
                  cursor: !text.trim() || sending ? 'not-allowed' : 'pointer',
                  opacity: !text.trim() || sending ? 0.5 : 1,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <Send size={13} /> {sending ? '…' : 'Enviar'}
              </button>
            </div>
          </>
        )}
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
  const supabase = useMemo(() => createBrowserClient(), []);

  useEffect(() => {
    const params = statusFilter !== 'all' ? `?status=${statusFilter}` : '';
    fetch(`/api/worker/soporte${params}`).then((r) => r.json()).then((d) => {
      setTickets(d.tickets ?? []);
      setLoading(false);
    });
  }, [statusFilter]);

  // ── Realtime: new tickets + status updates ─────────────────────────────
  useEffect(() => {
    const ch = (supabase.channel('worker-support-tickets') as unknown as {
      on: (event: string, filter: Record<string, unknown>, cb: (payload: { new: TicketRow; old?: TicketRow; eventType?: string }) => void) => typeof ch;
      subscribe: () => typeof ch;
    });
    ch.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'support_tickets' },
      (payload) => {
        const row = payload.new;
        setTickets((prev) => (prev.some((t) => t.id === row.id) ? prev : [row as unknown as Ticket, ...prev]));
        const name = row.brands?.name ?? 'un cliente';
        toast.success(`Nuevo ticket de ${name}: ${row.subject}`);
      },
    );
    ch.on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'support_tickets' },
      (payload) => {
        const row = payload.new;
        setTickets((prev) => prev.map((t) => (t.id === row.id ? { ...t, ...row } as Ticket : t)));
      },
    );
    ch.subscribe();
    return () => { supabase.removeChannel(ch as unknown as Parameters<typeof supabase.removeChannel>[0]); };
  }, [supabase]);

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
      const label =
        status === 'resolved' ? 'Ticket resuelto' :
        status === 'in_progress' ? 'Ticket aceptado' :
        status === 'closed' ? 'Ticket denegado' :
        'Respuesta enviada';
      toast.success(label);
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
          <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            {selected.status === 'open' && (
              <>
                <button type="button" onClick={() => sendReply('in_progress')}
                  style={{ padding: '6px 16px', border: 'none', background: C.accent, color: '#ffffff', cursor: 'pointer', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  ✓ Aceptar
                </button>
                <button type="button" onClick={() => sendReply('closed')}
                  style={{ padding: '6px 16px', border: `1px solid ${C.red}`, background: '#ffffff', color: C.red, cursor: 'pointer', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  ✕ Denegar
                </button>
              </>
            )}
            {selected.status === 'in_progress' && (
              <button type="button" onClick={() => sendReply('resolved')}
                style={{ padding: '6px 16px', border: 'none', background: C.accent, color: '#ffffff', cursor: 'pointer', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                ✅ Resolver
              </button>
            )}
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
            // Tramitado: ya no está abierto → fondo gris y opacidad reducida
            const isHandled = ticket.status !== 'open';
            return (
              <div
                key={ticket.id}
                onClick={() => openTicket(ticket)}
                style={{
                  padding: '16px 24px',
                  borderBottom: i < tickets.length - 1 ? `1px solid ${C.border}` : 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 16,
                  background: isHandled ? C.bg1 : 'transparent',
                  opacity: isHandled ? 0.7 : 1,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = isHandled ? '#e9ebef' : 'rgba(0,0,0,0.02)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = isHandled ? C.bg1 : 'transparent')}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    {ticket.priority === 'urgent' && !isHandled && <AlertTriangle size={14} color={C.red} />}
                    {isHandled && <span style={{ fontSize: 11, color: C.muted }}>✓</span>}
                    <span style={{ fontWeight: 600, fontSize: 14, color: isHandled ? C.muted : C.text }}>{ticket.subject}</span>
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
// TAB 3: TESTIMONIOS — moderación de comentarios sobre la web
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function TestimoniosTab() {
  const all = useSyncExternalStore(
    subscribeTestimonials,
    getTestimonialsSnapshot,
    getTestimonialsServerSnapshot,
  );
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected'>('pending');

  const filtered = useMemo(
    () => all.filter((t) => t.status === filter).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [all, filter],
  );
  const counts = useMemo(() => ({
    pending:  all.filter((t) => t.status === 'pending').length,
    approved: all.filter((t) => t.status === 'approved').length,
    rejected: all.filter((t) => t.status === 'rejected').length,
  }), [all]);

  function onApprove(id: string) { approveTestimonial(id); toast.success('Comentario aprobado'); }
  function onReject(id: string)  { rejectTestimonial(id);  toast.success('Comentario rechazado'); }
  function onDelete(id: string)  { deleteTestimonial(id);  toast.success('Comentario eliminado'); }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '24px 40px' }}>
      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {([
          { k: 'pending' as const,  l: 'Pendientes', n: counts.pending },
          { k: 'approved' as const, l: 'Aprobados',  n: counts.approved },
          { k: 'rejected' as const, l: 'Rechazados', n: counts.rejected },
        ]).map(({ k, l, n }) => (
          <button type="button" key={k} onClick={() => setFilter(k)}
            style={{
              padding: '8px 16px',
              background: filter === k ? C.accent : C.card,
              color: filter === k ? '#ffffff' : C.text,
              border: `1px solid ${filter === k ? C.accent : C.border}`,
              fontFamily: f, fontSize: 12, fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer',
            }}>
            {l} ({n})
          </button>
        ))}
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', border: `1px solid ${C.border}` }}>
          <MessageSquare size={28} style={{ color: C.muted, marginBottom: 12 }} />
          <p style={{ fontFamily: fc, fontWeight: 800, fontSize: 16, textTransform: 'uppercase', color: C.text, marginBottom: 4 }}>
            Sin comentarios
          </p>
          <p style={{ fontFamily: f, fontSize: 13, color: C.muted }}>
            {filter === 'pending' ? 'Ningún comentario pendiente de moderar' : filter === 'approved' ? 'Aún no has aprobado ningún comentario' : 'No hay comentarios rechazados'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map((t) => (
            <div key={t.id} style={{ border: `1px solid ${C.border}`, padding: 16, background: C.card }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, background: C.bg2, color: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: f, fontSize: 13, fontWeight: 700 }}>
                    {t.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontFamily: f, fontSize: 13, fontWeight: 600, color: C.text }}>{t.name}</div>
                    <div style={{ fontFamily: f, fontSize: 11, color: C.muted }}>{new Date(t.created_at).toLocaleString()}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {filter === 'pending' && (
                    <>
                      <button type="button" onClick={() => onApprove(t.id)} title="Aprobar"
                        style={{ padding: '6px 12px', background: C.accent, color: '#ffffff', border: 'none', fontFamily: f, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Check size={13} /> Aprobar
                      </button>
                      <button type="button" onClick={() => onReject(t.id)} title="Rechazar"
                        style={{ padding: '6px 12px', background: '#ffffff', color: C.text, border: `1px solid ${C.border}`, fontFamily: f, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <X size={13} /> Rechazar
                      </button>
                    </>
                  )}
                  {filter === 'approved' && (
                    <button type="button" onClick={() => onReject(t.id)}
                      style={{ padding: '6px 12px', background: '#ffffff', color: C.text, border: `1px solid ${C.border}`, fontFamily: f, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer' }}>
                      Despublicar
                    </button>
                  )}
                  {filter === 'rejected' && (
                    <>
                      <button type="button" onClick={() => onApprove(t.id)}
                        style={{ padding: '6px 12px', background: C.accent, color: '#ffffff', border: 'none', fontFamily: f, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer' }}>
                        Restaurar
                      </button>
                      <button type="button" onClick={() => onDelete(t.id)}
                        style={{ padding: '6px 12px', background: '#ffffff', color: C.text, border: `1px solid ${C.border}`, fontFamily: f, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer' }}>
                        Eliminar
                      </button>
                    </>
                  )}
                </div>
              </div>
              <p style={{ fontFamily: f, fontSize: 14, color: C.text, lineHeight: 1.5, whiteSpace: 'pre-wrap', margin: 0 }}>{t.message}</p>
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

export default function InboxPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawTab = searchParams.get('tab');
  // Legacy redirects: mensajes/notificaciones → cliente
  const tab: Tab = rawTab === 'soporte' ? 'soporte' : rawTab === 'testimonios' ? 'testimonios' : 'cliente';

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
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${TABS.length}, 1fr)`, gap: '1px', background: C.border, border: `1px solid ${C.border}`, margin: '40px', marginBottom: 0 }}>
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
        {tab === 'cliente' && <ClienteTab />}
        {tab === 'soporte' && <SoporteTab />}
        {tab === 'testimonios' && <TestimoniosTab />}
      </div>
    </div>
  );
}
