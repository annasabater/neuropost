'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, X, ArrowLeft, Send, CreditCard, Wrench, Smartphone, FileText, User, HelpCircle } from 'lucide-react';

const f = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

type Ticket = {
  id: string; subject: string; description: string | null; category: string;
  priority: string; status: string; resolution: string | null;
  satisfaction_rating: number | null; created_at: string; resolved_at: string | null;
};

type TicketMessage = { id: string; sender_type: 'client' | 'worker'; message: string; created_at: string };

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  open:        { label: 'Abierto',    color: '#e65100', bg: '#fff3e0' },
  in_progress: { label: 'En proceso', color: '#1565c0', bg: '#e3f2fd' },
  resolved:    { label: 'Resuelto',   color: '#0F766E', bg: '#f0fdf4' },
  closed:      { label: 'Cerrado',    color: '#6b7280', bg: '#f3f4f6' },
};

const CATEGORIES = [
  { value: 'billing',   label: 'Facturación y pagos', icon: CreditCard },
  { value: 'technical', label: 'Problema técnico', icon: Wrench },
  { value: 'instagram', label: 'Conexión Instagram / Facebook', icon: Smartphone },
  { value: 'content',   label: 'Contenido y publicaciones', icon: FileText },
  { value: 'account',   label: 'Mi cuenta', icon: User },
  { value: 'other',     label: 'Otra consulta', icon: HelpCircle },
];

function formatTime(d: string) {
  return new Date(d).toLocaleString(undefined, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function SoportePage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDrawer, setShowDrawer] = useState(false);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [rating, setRating] = useState(0);
  const [form, setForm] = useState({ subject: '', description: '', category: 'billing', priority: 'normal' });

  useEffect(() => { fetch('/api/soporte').then((r) => r.json()).then((d) => { setTickets(d.tickets ?? []); setLoading(false); }); }, []);

  async function openTicket(ticket: Ticket) {
    setSelected(ticket);
    const d = await fetch(`/api/soporte/${ticket.id}`).then((r) => r.json());
    setMessages(d.messages ?? []);
    setRating(ticket.satisfaction_rating ?? 0);
  }

  async function createTicket() {
    if (!form.subject.trim()) { toast.error('Añade un asunto'); return; }
    setSending(true);
    const res = await fetch('/api/soporte', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const d = await res.json();
    if (res.ok) { setTickets((p) => [d.ticket, ...p]); setShowDrawer(false); setForm({ subject: '', description: '', category: 'billing', priority: 'normal' }); toast.success('Ticket abierto'); }
    else toast.error(d.error ?? 'Error');
    setSending(false);
  }

  async function sendReply() {
    if (!reply.trim() || !selected) return;
    setSending(true);
    const res = await fetch(`/api/soporte/${selected.id}/message`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: reply }) });
    const d = await res.json();
    if (res.ok) { setMessages((p) => [...p, d.message]); setReply(''); }
    else toast.error(d.error ?? 'Error');
    setSending(false);
  }

  async function rateTicket(stars: number) {
    if (!selected) return;
    setRating(stars);
    await fetch(`/api/soporte/${selected.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ satisfaction_rating: stars }) });
    toast.success('Gracias por tu valoración');
  }

  async function reopenTicket() {
    if (!selected) return;
    const res = await fetch(`/api/soporte/${selected.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'open' }) });
    const d = await res.json();
    if (res.ok) { setSelected(d.ticket); setTickets((p) => p.map((t) => t.id === d.ticket.id ? d.ticket : t)); }
  }

  // ── Ticket detail ──
  if (selected) {
    const st = STATUS_CONFIG[selected.status] ?? STATUS_CONFIG.open;
    const catIcon = CATEGORIES.find((c) => c.value === selected.category);
    return (
      <div className="page-content" style={{ maxWidth: 740 }}>
        <button onClick={() => setSelected(null)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontFamily: f, fontSize: 12, marginBottom: 24, padding: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          <ArrowLeft size={14} /> Todos los tickets
        </button>

        {/* Header card */}
        <div style={{ background: '#ffffff', border: '1px solid #d4d4d8', padding: '20px 24px', marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h2 style={{ fontFamily: fc, fontSize: 22, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.01em', color: '#111827', marginBottom: 8 }}>{selected.subject}</h2>
              <div style={{ display: 'flex', gap: 12, fontFamily: f, fontSize: 12, color: '#9ca3af' }}>
                <span>{catIcon?.label ?? selected.category}</span>
                <span>{new Date(selected.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              </div>
            </div>
            <span style={{ fontFamily: f, fontSize: 10, fontWeight: 600, padding: '3px 10px', color: st.color, background: st.bg, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{st.label}</span>
          </div>
          {selected.resolution && (
            <div style={{ marginTop: 16, background: '#f0fdf4', padding: '10px 14px', fontFamily: f, fontSize: 13, color: '#0F766E', borderLeft: '2px solid #0F766E' }}>
              {selected.resolution}
            </div>
          )}
        </div>

        {/* Messages */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
          {messages.map((msg) => {
            const isClient = msg.sender_type === 'client';
            return (
              <div key={msg.id} style={{ display: 'flex', justifyContent: isClient ? 'flex-end' : 'flex-start' }}>
                {!isClient && (
                  <div style={{ width: 28, height: 28, background: '#111827', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, fontFamily: f, flexShrink: 0, marginRight: 8, alignSelf: 'flex-end' }}>NP</div>
                )}
                <div style={{ maxWidth: '65%', background: isClient ? '#eef2ff' : '#ffffff', border: `1px solid ${isClient ? '#c7d2fe' : '#e5e7eb'}`, borderRadius: isClient ? '12px 12px 2px 12px' : '12px 12px 12px 2px', padding: '12px 16px' }}>
                  <p style={{ fontFamily: f, fontSize: 10, color: '#9ca3af', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {isClient ? 'Tú' : 'Equipo NeuroPost'}
                  </p>
                  <p style={{ fontFamily: f, fontSize: 14, lineHeight: 1.6, color: '#111827', margin: 0, whiteSpace: 'pre-wrap' }}>{msg.message}</p>
                  <p style={{ fontFamily: f, fontSize: 10, color: '#d1d5db', marginTop: 6, textAlign: 'right' }}>{formatTime(msg.created_at)}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Rating */}
        {selected.status === 'resolved' && (
          <div style={{ background: '#ffffff', border: '1px solid #d4d4d8', padding: '16px 20px', marginBottom: 20 }}>
            <p style={{ fontFamily: f, fontWeight: 600, fontSize: 14, color: '#111827', marginBottom: 10 }}>¿Te ayudamos bien?</p>
            <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
              {[1,2,3,4,5].map((s) => (
                <button key={s} onClick={() => rateTicket(s)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, padding: 2, opacity: s <= rating ? 1 : 0.3, transition: 'opacity 0.15s' }}>
                  ★
                </button>
              ))}
            </div>
            <button onClick={reopenTicket} style={{ fontFamily: f, fontSize: 12, color: '#6b7280', background: 'none', border: '1px solid #d4d4d8', padding: '6px 14px', cursor: 'pointer' }}>
              El problema continúa, reabrir
            </button>
          </div>
        )}

        {/* Reply */}
        {selected.status !== 'closed' && selected.status !== 'resolved' && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <div style={{ flex: 1, background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 14px' }}>
              <textarea value={reply} onChange={(e) => setReply(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
                placeholder="Escribe tu mensaje..." rows={2}
                style={{ width: '100%', background: 'none', border: 'none', outline: 'none', resize: 'none', fontFamily: f, fontSize: 14, color: '#111827', lineHeight: 1.5 }} />
            </div>
            <button onClick={sendReply} disabled={!reply.trim() || sending} title="Enviar" aria-label="Enviar" style={{
              width: 40, height: 40, background: reply.trim() ? '#111827' : '#e5e7eb', border: 'none',
              cursor: reply.trim() ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s',
            }}>
              <Send size={16} color="#ffffff" />
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── Ticket list ──
  return (
    <div className="page-content" style={{ maxWidth: 900 }}>
      <div style={{ padding: '48px 0 32px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1 style={{ fontFamily: fc, fontWeight: 900, fontSize: 'clamp(2.5rem, 5vw, 3.5rem)', textTransform: 'uppercase', letterSpacing: '0.01em', color: '#111827', lineHeight: 0.95, marginBottom: 8 }}>
            Soporte
          </h1>
          <p style={{ color: '#6b7280', fontSize: 15, fontFamily: f }}>Estamos aquí para ayudarte. Respuesta en menos de 2h</p>
        </div>
        <button onClick={() => setShowDrawer(true)} style={{
          background: '#111827', color: '#ffffff', border: 'none', padding: '10px 24px',
          fontFamily: fc, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
        }}>
          <Plus size={14} /> Nuevo ticket
        </button>
      </div>

      {loading ? (
        <div style={{ border: '1px solid #d4d4d8' }}>
          {[1,2,3].map((i) => <div key={i} style={{ padding: '16px 24px', borderBottom: i < 3 ? '1px solid #f3f4f6' : 'none', background: '#ffffff' }}><div style={{ width: '40%', height: 12, background: '#f3f4f6', borderRadius: 2 }} /></div>)}
        </div>
      ) : tickets.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 20px' }}>
          <p style={{ fontFamily: fc, fontWeight: 900, fontSize: 28, textTransform: 'uppercase', color: '#111827', marginBottom: 8 }}>Todo en orden</p>
          <p style={{ fontSize: 14, color: '#9ca3af', fontFamily: f, marginBottom: 32 }}>Si necesitas ayuda, abre un ticket y te respondemos rápido</p>
          <button onClick={() => setShowDrawer(true)} style={{
            background: '#111827', color: '#ffffff', border: 'none', padding: '14px 32px',
            fontFamily: fc, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', cursor: 'pointer',
          }}>
            Abrir ticket
          </button>
        </div>
      ) : (
        <div style={{ border: '1px solid #d4d4d8' }}>
          {tickets.map((ticket, i) => {
            const st = STATUS_CONFIG[ticket.status] ?? STATUS_CONFIG.open;
            return (
              <div key={ticket.id} onClick={() => openTicket(ticket)} style={{
                padding: '16px 24px', borderBottom: i < tickets.length - 1 ? '1px solid #e5e7eb' : 'none',
                cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16,
                background: '#ffffff', transition: 'background 0.15s',
              }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontFamily: f, fontWeight: 600, fontSize: 14, color: '#111827', marginBottom: 4 }}>{ticket.subject}</p>
                  <p style={{ fontFamily: f, fontSize: 12, color: '#9ca3af' }}>
                    {CATEGORIES.find((c) => c.value === ticket.category)?.label ?? ticket.category} · {new Date(ticket.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                  </p>
                </div>
                <span style={{ fontFamily: f, fontSize: 10, fontWeight: 600, padding: '3px 10px', color: st.color, background: st.bg, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {st.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Drawer: New ticket ── */}
      {showDrawer && (
        <>
          <div onClick={() => setShowDrawer(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 50 }} />
          <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0, width: '100%', maxWidth: 440,
            background: '#ffffff', zIndex: 51, overflowY: 'auto', padding: 32,
            boxShadow: '-8px 0 40px rgba(0,0,0,0.12)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
              <h2 style={{ fontFamily: fc, fontSize: 20, fontWeight: 800, textTransform: 'uppercase', color: '#111827' }}>Nuevo ticket</h2>
              <button onClick={() => setShowDrawer(false)} title="Cerrar" aria-label="Cerrar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}><X size={20} /></button>
            </div>

            {/* Category cards */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#9ca3af', marginBottom: 10 }}>Categoría</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {CATEGORIES.map((cat) => {
                  const Icon = cat.icon;
                  const active = form.category === cat.value;
                  return (
                    <button key={cat.value} onClick={() => setForm((prev) => ({ ...prev, category: cat.value }))} style={{
                      padding: '10px 12px', background: active ? '#f0fdf4' : '#ffffff',
                      border: `1px solid ${active ? '#0F766E' : '#e5e7eb'}`, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left',
                      transition: 'all 0.15s',
                    }}>
                      <Icon size={14} style={{ color: active ? '#0F766E' : '#9ca3af', flexShrink: 0 }} />
                      <span style={{ fontFamily: f, fontSize: 12, fontWeight: active ? 600 : 400, color: active ? '#0F766E' : '#374151' }}>{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Priority */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#9ca3af', marginBottom: 10 }}>Prioridad</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {[{ v: 'normal', l: 'Normal' }, { v: 'urgent', l: 'Urgente' }].map((opt) => {
                  const active = form.priority === opt.v;
                  return (
                    <button key={opt.v} onClick={() => setForm((prev) => ({ ...prev, priority: opt.v }))} style={{
                      padding: '8px 20px', border: `1px solid ${active ? '#111827' : '#e5e7eb'}`,
                      background: active ? '#111827' : '#ffffff', color: active ? '#ffffff' : '#6b7280',
                      fontFamily: f, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                    }}>
                      {opt.l}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Subject */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#9ca3af', marginBottom: 6 }}>Asunto *</label>
              <input value={form.subject} onChange={(e) => setForm((prev) => ({ ...prev, subject: e.target.value.slice(0, 80) }))} placeholder="Describe el problema brevemente" maxLength={80}
                style={{ width: '100%', padding: '12px 14px', border: '1px solid #e5e7eb', fontFamily: f, fontSize: 14, outline: 'none', boxSizing: 'border-box', color: '#111827' }} />
            </div>

            {/* Description */}
            <div style={{ marginBottom: 28 }}>
              <label style={{ display: 'block', fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#9ca3af', marginBottom: 6 }}>Descripción</label>
              <textarea value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} rows={4}
                placeholder="Describe con detalle. Si hay un error, cópialo aquí."
                style={{ width: '100%', padding: '12px 14px', border: '1px solid #e5e7eb', fontFamily: f, fontSize: 14, resize: 'vertical', outline: 'none', boxSizing: 'border-box', color: '#111827' }} />
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 1 }}>
              <button onClick={() => setShowDrawer(false)} style={{
                flex: 1, padding: 12, border: '1px solid #d4d4d8', background: '#ffffff',
                fontFamily: f, fontSize: 13, fontWeight: 600, color: '#6b7280', cursor: 'pointer',
              }}>Cancelar</button>
              <button onClick={createTicket} disabled={sending} style={{
                flex: 2, padding: 12, border: 'none', background: '#111827', color: '#ffffff',
                fontFamily: fc, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                cursor: 'pointer', opacity: sending ? 0.5 : 1,
              }}>{sending ? 'Abriendo...' : 'Abrir ticket →'}</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
