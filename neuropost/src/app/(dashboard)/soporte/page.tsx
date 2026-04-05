'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, X, ArrowLeft, Send } from 'lucide-react';

type Ticket = {
  id: string;
  subject: string;
  description: string | null;
  category: string;
  priority: string;
  status: string;
  resolution: string | null;
  satisfaction_rating: number | null;
  created_at: string;
  resolved_at: string | null;
};

type TicketMessage = {
  id: string;
  sender_type: 'client' | 'worker';
  message: string;
  created_at: string;
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  open:        { label: 'Abierto',     color: '#92400e', bg: '#fef3c7' },
  in_progress: { label: 'En proceso',  color: '#1d4ed8', bg: '#dbeafe' },
  resolved:    { label: 'Resuelto',    color: '#065f46', bg: '#d1fae5' },
  closed:      { label: 'Cerrado',     color: '#6b7280', bg: '#f3f4f6' },
};

const CATEGORIES = [
  { value: 'billing',   label: '💳 Facturación y pagos' },
  { value: 'technical', label: '🔧 Problema técnico' },
  { value: 'instagram', label: '📱 Conexión con Instagram o Facebook' },
  { value: 'content',   label: '📝 Contenido y publicaciones' },
  { value: 'account',   label: '👤 Mi cuenta' },
  { value: 'other',     label: '❓ Otra consulta' },
];

function formatTime(d: string) {
  return new Date(d).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function SoportePage() {
  const [tickets, setTickets]     = useState<Ticket[]>([]);
  const [selected, setSelected]   = useState<Ticket | null>(null);
  const [messages, setMessages]   = useState<TicketMessage[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [reply, setReply]         = useState('');
  const [sending, setSending]     = useState(false);
  const [rating, setRating]       = useState(0);
  const [form, setForm] = useState({ subject: '', description: '', category: 'billing', priority: 'normal' });

  useEffect(() => {
    fetch('/api/soporte').then((r) => r.json()).then((d) => {
      setTickets(d.tickets ?? []);
      setLoading(false);
    });
  }, []);

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
    if (res.ok) {
      setTickets((prev) => [d.ticket, ...prev]);
      setShowModal(false);
      setForm({ subject: '', description: '', category: 'billing', priority: 'normal' });
      toast.success('Ticket abierto');
    } else toast.error(d.error ?? 'Error');
    setSending(false);
  }

  async function sendReply() {
    if (!reply.trim() || !selected) return;
    setSending(true);
    const res = await fetch(`/api/soporte/${selected.id}/message`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: reply }) });
    const d = await res.json();
    if (res.ok) { setMessages((prev) => [...prev, d.message]); setReply(''); }
    else toast.error(d.error ?? 'Error');
    setSending(false);
  }

  async function rateTicket(stars: number) {
    if (!selected) return;
    setRating(stars);
    await fetch(`/api/soporte/${selected.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ satisfaction_rating: stars }) });
    toast.success('¡Gracias por tu valoración!');
  }

  async function reopenTicket() {
    if (!selected) return;
    const res = await fetch(`/api/soporte/${selected.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'open' }) });
    const d = await res.json();
    if (res.ok) {
      setSelected(d.ticket);
      setTickets((prev) => prev.map((t) => t.id === d.ticket.id ? d.ticket : t));
    }
  }

  // Ticket detail view
  if (selected) {
    const st = STATUS_CONFIG[selected.status] ?? STATUS_CONFIG.open;
    return (
      <div style={{ padding: '32px 40px', maxWidth: 800 }}>
        <button onClick={() => setSelected(null)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: 13, marginBottom: 20, padding: 0 }}>
          <ArrowLeft size={15} /> Todos los tickets
        </button>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '20px 24px', marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>{selected.subject}</h2>
              <div style={{ display: 'flex', gap: 12, fontSize: 13, color: '#9ca3af' }}>
                <span>{CATEGORIES.find((c) => c.value === selected.category)?.label ?? selected.category}</span>
                <span>Abierto {new Date(selected.created_at).toLocaleDateString('es-ES')}</span>
              </div>
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 20, color: st.color, background: st.bg }}>{st.label}</span>
          </div>
          {selected.resolution && (
            <div style={{ marginTop: 14, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#166534' }}>
              Resolución: {selected.resolution}
            </div>
          )}
        </div>

        {/* Messages */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
          {messages.map((msg) => {
            const isClient = msg.sender_type === 'client';
            return (
              <div key={msg.id} style={{ display: 'flex', justifyContent: isClient ? 'flex-end' : 'flex-start' }}>
                <div style={{ maxWidth: '70%', background: isClient ? '#fff3ee' : '#f9fafb', border: `1px solid ${isClient ? '#ffd5c2' : '#e5e7eb'}`, borderRadius: 12, padding: '10px 14px' }}>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4, fontWeight: 600 }}>
                    {isClient ? 'Tú' : 'Equipo NeuroPost'}
                  </div>
                  <div style={{ fontSize: 14, lineHeight: 1.5 }}>{msg.message}</div>
                  <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4 }}>{formatTime(msg.created_at)}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Rating if resolved */}
        {selected.status === 'resolved' && (
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '16px 20px', marginBottom: 16 }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10 }}>¿Quedó resuelto tu problema?</div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              {[1,2,3,4,5].map((s) => (
                <button key={s} onClick={() => rateTicket(s)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 24, padding: 2 }}>
                  {s <= rating ? '⭐' : '☆'}
                </button>
              ))}
            </div>
            <button onClick={reopenTicket} style={{ fontSize: 13, color: '#6b7280', background: 'none', border: '1px solid #e5e7eb', borderRadius: 8, padding: '6px 14px', cursor: 'pointer' }}>
              El problema continúa, reabrir ticket
            </button>
          </div>
        )}

        {/* Reply */}
        {selected.status !== 'closed' && selected.status !== 'resolved' && (
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
            <textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Escribe una respuesta..." rows={3}
              style={{ flex: 1, padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 14, resize: 'none', outline: 'none', fontFamily: 'inherit' }} />
            <button onClick={sendReply} disabled={!reply.trim() || sending}
              style={{ padding: '10px 20px', background: '#ff6b35', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Send size={15} /> Enviar
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: '32px 40px', maxWidth: 900 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 6 }}>Soporte</h1>
          <p style={{ color: '#6b7280', fontSize: 14 }}>Abre un ticket si tienes algún problema técnico o duda de facturación</p>
        </div>
        <button onClick={() => setShowModal(true)} style={{ background: '#ff6b35', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Plus size={16} /> Abrir ticket
        </button>
      </div>

      {loading ? <p style={{ color: '#9ca3af' }}>Cargando...</p> : tickets.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 0' }}>
          <div style={{ fontSize: 56 }}>🎫</div>
          <div style={{ fontWeight: 700, fontSize: 18, marginTop: 16 }}>Sin tickets de soporte</div>
          <div style={{ color: '#6b7280', marginTop: 8, fontSize: 14 }}>Si tienes algún problema, abre un ticket y te ayudamos</div>
        </div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
          {tickets.map((ticket, i) => {
            const st = STATUS_CONFIG[ticket.status] ?? STATUS_CONFIG.open;
            return (
              <div key={ticket.id} onClick={() => openTicket(ticket)} style={{ padding: '16px 24px', borderBottom: i < tickets.length - 1 ? '1px solid #e5e7eb' : 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#fafafa')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{ticket.subject}</div>
                  <div style={{ fontSize: 12, color: '#9ca3af' }}>
                    {CATEGORIES.find((c) => c.value === ticket.category)?.label ?? ticket.category} · {new Date(ticket.created_at).toLocaleDateString('es-ES')}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, color: st.color, background: st.bg }}>{st.label}</span>
                  <span style={{ color: '#d1d5db', fontSize: 18 }}>›</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* New ticket modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '32px', width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontSize: 20, fontWeight: 800 }}>Nuevo ticket de soporte</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} color="#6b7280" />
              </button>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Categoría</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {CATEGORIES.map((cat) => (
                  <label key={cat.value} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', border: `2px solid ${form.category === cat.value ? '#ff6b35' : '#e5e7eb'}`, borderRadius: 8, cursor: 'pointer', background: form.category === cat.value ? '#fff8f5' : '#fff' }}>
                    <input type="radio" name="category" value={cat.value} checked={form.category === cat.value} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} style={{ display: 'none' }} />
                    <span style={{ fontSize: 13 }}>{cat.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Prioridad</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[{ v: 'normal', l: 'Normal' }, { v: 'urgent', l: 'Urgente' }].map((opt) => (
                  <label key={opt.v} style={{ padding: '7px 18px', border: `2px solid ${form.priority === opt.v ? '#ff6b35' : '#e5e7eb'}`, borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, background: form.priority === opt.v ? '#fff8f5' : '#fff' }}>
                    <input type="radio" name="priority" value={opt.v} checked={form.priority === opt.v} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))} style={{ display: 'none' }} />
                    {opt.l}
                  </label>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Asunto *</label>
              <input value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value.slice(0, 80) }))} placeholder="Describe el problema brevemente" maxLength={80}
                style={{ width: '100%', padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
            </div>

            <div style={{ marginBottom: 28 }}>
              <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Descripción</label>
              <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={4}
                placeholder="Describe el problema con el máximo detalle. Si hay un error, cópialo aquí."
                style={{ width: '100%', padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14, resize: 'vertical', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setShowModal(false)} style={{ flex: 1, padding: '12px', border: '1px solid #e5e7eb', borderRadius: 10, background: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
                Cancelar
              </button>
              <button onClick={createTicket} disabled={sending} style={{ flex: 2, padding: '12px', border: 'none', borderRadius: 10, background: '#ff6b35', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>
                {sending ? 'Abriendo...' : 'Abrir ticket →'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
