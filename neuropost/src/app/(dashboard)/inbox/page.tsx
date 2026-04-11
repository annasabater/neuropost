'use client';

import { useState, useEffect, useRef, Suspense, useMemo, useSyncExternalStore } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MessageSquare, MessageCircle, LifeBuoy, Sparkles, Bell, ArrowRight, Plus, Send, X, TrendingUp, AlertCircle, TrendingDown, CheckCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppStore } from '@/store/useAppStore';
import { createBrowserClient } from '@/lib/supabase';

// Realtime row shapes delivered by postgres_changes payloads.
type ChatRow = {
  id: string; brand_id: string; sender_id: string | null;
  sender_type: 'client' | 'worker'; message: string; created_at: string;
};
type NotificationRow = {
  id: string; brand_id: string; type: string; message: string;
  read: boolean; created_at: string; metadata?: Record<string, unknown> | null;
};
type TicketRow = {
  id: string; brand_id: string; subject: string; status: string;
  category: string; created_at: string; resolution?: string | null;
};
type ChangelogRow = {
  id: string; version: string | null; title: string; summary: string | null;
  published_at: string | null;
};
import {
  addPendingTestimonial,
  subscribeTestimonials,
  getTestimonialsSnapshot,
  getTestimonialsServerSnapshot,
} from '@/lib/site-testimonials';

const f = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

type Tab = 'comentarios' | 'mensajes' | 'soporte' | 'novedades' | 'notificaciones';
type IconProps = { size?: number; style?: React.CSSProperties };

const TABS: { key: Tab; title: string; desc: string; icon: React.ComponentType<IconProps> }[] = [
  { key: 'notificaciones', title: 'Notificaciones', desc: 'Actividad reciente',   icon: Bell },
  { key: 'mensajes',       title: 'Mensajes',       desc: 'Tu equipo NeuroPost',  icon: MessageCircle },
  { key: 'comentarios',    title: 'Comentarios',    desc: 'Instagram y Facebook', icon: MessageSquare },
  { key: 'soporte',        title: 'Soporte',        desc: 'Tickets y consultas',  icon: LifeBuoy },
  { key: 'novedades',      title: 'Novedades',      desc: 'Mejoras del producto', icon: Sparkles },
];

// ── Types ──
type Ticket = { id: string; subject: string; status: string; category: string; created_at: string };
type ChatMsg = { id: string; sender_type: 'client' | 'worker'; message: string; created_at: string };
type ChangeEntry = { id: string; version: string | null; title: string; summary: string | null; changes: { type: string; text: string }[]; published_at: string | null };

const TYPE_COLOR: Record<string, string> = { new: '#0F766E', improved: '#0D9488', fixed: '#0F766E', removed: '#6b7280' };
const TYPE_LABEL: Record<string, string> = { new: 'NUEVO', improved: 'MEJORADO', fixed: 'CORREGIDO', removed: 'ELIMINADO' };
const TYPE_ICON: Record<string, React.ComponentType<IconProps>> = { new: TrendingUp, improved: TrendingUp, fixed: AlertCircle, removed: TrendingDown };
const STATUS_STYLE: Record<string, { color: string; bg: string; label: string }> = {
  open: { color: '#0F766E', bg: '#f0fdfa', label: 'Abierto' },
  in_progress: { color: '#0D9488', bg: '#ecfeff', label: 'En proceso' },
  resolved: { color: '#0F766E', bg: '#ecfdf5', label: 'Resuelto' },
  closed: { color: '#6b7280', bg: '#f3f4f6', label: 'Cerrado' },
};

function InboxInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = (searchParams.get('tab') as Tab) || 'comentarios';
  const brand = useAppStore((s) => s.brand);
  const unreadComments = useAppStore((s) => s.unreadComments);
  const unreadNotifications = useAppStore((s) => s.unreadNotifications);
  const notifications = useAppStore((s) => s.notifications);
  const setNotifications = useAppStore((s) => s.setNotifications);
  const markAllNotificationsRead = useAppStore((s) => s.markAllNotificationsRead);

  // Soporte state — loading arranca en true; solo se baja dentro del .then() del fetch
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [ticketForm, setTicketForm] = useState({ subject: '', description: '', category: 'technical', priority: 'normal' });
  const [saving, setSaving] = useState(false);

  // Site testimonials (web feedback) — read from localStorage via external store.
  const allTestimonials = useSyncExternalStore(
    subscribeTestimonials,
    getTestimonialsSnapshot,
    getTestimonialsServerSnapshot,
  );
  const testimonials = useMemo(
    () => allTestimonials.filter((t) => t.status === 'approved'),
    [allTestimonials],
  );
  const [testimonialMessage, setTestimonialMessage] = useState('');
  const [showAllComments, setShowAllComments] = useState(false);

  function submitTestimonial() {
    const msg = testimonialMessage.trim();
    if (msg.length < 5) { toast.error('Escribe al menos 5 caracteres'); return; }
    addPendingTestimonial({ name: brand?.name ?? 'Cliente', message: msg });
    setTestimonialMessage('');
    toast.success('Gracias. Tu comentario será revisado por el equipo antes de publicarse');
  }

  // Chat state
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [chatLoading, setChatLoading] = useState(true);
  const [chatText, setChatText] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const chatBottom = useRef<HTMLDivElement>(null);

  // Changelog state
  const [entries, setEntries] = useState<ChangeEntry[]>([]);

  // Supabase browser client — created once and reused across realtime subscriptions.
  const supabase = useMemo(() => createBrowserClient(), []);

  // ── Realtime: chat_messages scoped to this brand ────────────────────────
  useEffect(() => {
    if (!brand?.id) return;
    const brandId = brand.id;
    // Cast: `.on('postgres_changes', ...)` overloads are narrow in newer
    // @supabase/supabase-js type defs; use a loose cast so we can pass filters.
    const ch = (supabase.channel(`client-chat-${brandId}`) as unknown as {
      on: (event: string, filter: Record<string, unknown>, cb: (payload: { new: ChatRow }) => void) => typeof ch;
      subscribe: () => typeof ch;
    });
    ch.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `brand_id=eq.${brandId}` },
      (payload) => {
        const row = payload.new;
        setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row as ChatMsg]));
        if (row.sender_type === 'worker') toast.success('Nuevo mensaje de tu equipo');
      },
    ).subscribe();
    return () => { supabase.removeChannel(ch as unknown as Parameters<typeof supabase.removeChannel>[0]); };
  }, [brand?.id, supabase]);

  // ── Realtime: notifications for this brand (push into store + toast) ─────
  useEffect(() => {
    if (!brand?.id) return;
    const brandId = brand.id;
    const ch = (supabase.channel(`client-notifications-${brandId}`) as unknown as {
      on: (event: string, filter: Record<string, unknown>, cb: (payload: { new: NotificationRow }) => void) => typeof ch;
      subscribe: () => typeof ch;
    });
    ch.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: `brand_id=eq.${brandId}` },
      (payload) => {
        const n = payload.new;
        // Best-effort: shape the row into whatever the store's Notification type expects.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        useAppStore.getState().addNotification(n as any);
        toast(n.message, { icon: '🔔' });
      },
    ).subscribe();
    return () => { supabase.removeChannel(ch as unknown as Parameters<typeof supabase.removeChannel>[0]); };
  }, [brand?.id, supabase]);

  // ── Realtime: support ticket status changes for this brand ──────────────
  useEffect(() => {
    if (!brand?.id) return;
    const brandId = brand.id;
    const ch = (supabase.channel(`client-tickets-${brandId}`) as unknown as {
      on: (event: string, filter: Record<string, unknown>, cb: (payload: { old: TicketRow; new: TicketRow }) => void) => typeof ch;
      subscribe: () => typeof ch;
    });
    ch.on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'support_tickets', filter: `brand_id=eq.${brandId}` },
      (payload) => {
        const prev = payload.old;
        const next = payload.new;
        setTickets((list) => list.map((t) => (t.id === next.id ? { ...t, ...next } : t)));
        if (prev.status !== next.status) {
          const label =
            next.status === 'resolved' ? 'aceptado y resuelto' :
            next.status === 'in_progress' ? 'aceptado — en proceso' :
            next.status === 'closed' ? 'denegado' :
            next.status;
          toast(`Tu ticket "${next.subject}" ha sido ${label}`, { icon: '🎟️' });
        }
      },
    ).subscribe();
    return () => { supabase.removeChannel(ch as unknown as Parameters<typeof supabase.removeChannel>[0]); };
  }, [brand?.id, supabase]);

  // ── Realtime: new changelog / novedades entries ─────────────────────────
  useEffect(() => {
    const ch = (supabase.channel('client-changelog') as unknown as {
      on: (event: string, filter: Record<string, unknown>, cb: (payload: { new: ChangelogRow }) => void) => typeof ch;
      subscribe: () => typeof ch;
    });
    ch.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'changelog_entries' },
      (payload) => {
        const n = payload.new;
        if (!n.published_at) return; // skip drafts
        toast(`Nueva novedad: ${n.title}`, { icon: '✨' });
        setEntries((prev) => (prev.some((e) => e.id === n.id) ? prev : [{
          id: n.id, version: n.version, title: n.title, summary: n.summary,
          changes: [], published_at: n.published_at,
        }, ...prev]));
      },
    ).subscribe();
    return () => { supabase.removeChannel(ch as unknown as Parameters<typeof supabase.removeChannel>[0]); };
  }, [supabase]);

  function setTab(t: Tab) { router.push(`/inbox?tab=${t}`); }

  // Banderas "cargado" por tab — usamos refs para NO disparar re-render al mutarlas
  // y evitar el loop infinito cuando la API devuelve [].
  const loadedTabsRef = useRef<Record<string, boolean>>({});

  // Fechas base (hoy/ayer) calculadas una sola vez al montar con lazy useState.
  // Lazy initializers sí pueden llamar funciones impuras (solo corren 1 vez).
  const [dateStrings] = useState(() => ({
    today: new Date().toDateString(),
    yesterday: new Date(Date.now() - 86400000).toDateString(),
  }));

  // Agrupar notificaciones por fecha (Hoy / Ayer / Anteriores).
  const notificationGroups = useMemo(() => {
    const groups: { label: string; items: typeof notifications }[] = [];
    for (const n of notifications) {
      const d = new Date(n.created_at).toDateString();
      const label = d === dateStrings.today ? 'Hoy' : d === dateStrings.yesterday ? 'Ayer' : 'Anteriores';
      const last = groups[groups.length - 1];
      if (last && last.label === label) last.items.push(n);
      else groups.push({ label, items: [n] });
    }
    return groups;
  }, [notifications, dateStrings]);

  // Load data per tab — solo la primera vez que entras a cada tab.
  useEffect(() => {
    if (loadedTabsRef.current[tab]) return;
    loadedTabsRef.current[tab] = true;

    if (tab === 'soporte') {
      fetch('/api/soporte')
        .then((r) => r.json())
        .then((d) => setTickets(d.tickets ?? []))
        .catch(() => { loadedTabsRef.current[tab] = false; })
        .finally(() => setTicketsLoading(false));
    } else if (tab === 'mensajes') {
      fetch('/api/chat')
        .then((r) => r.json())
        .then((d) => setMessages(d.messages ?? []))
        .catch(() => { loadedTabsRef.current[tab] = false; })
        .finally(() => setChatLoading(false));
    } else if (tab === 'novedades') {
      fetch('/api/changelog')
        .then((r) => r.json())
        .then((d) => setEntries(d.entries ?? []))
        .catch(() => { loadedTabsRef.current[tab] = false; });
    } else if (tab === 'notificaciones') {
      fetch('/api/notifications')
        .then((r) => r.json())
        .then((d) => { if (d.notifications) setNotifications(d.notifications); })
        .catch(() => { loadedTabsRef.current[tab] = false; });
    }
  }, [tab, setNotifications]);

  useEffect(() => { chatBottom.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function createTicket() {
    if (!ticketForm.subject.trim()) { toast.error('Añade un asunto'); return; }
    setSaving(true);
    const res = await fetch('/api/soporte', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ticketForm) });
    const d = await res.json();
    if (res.ok) { setTickets(p => [d.ticket, ...p]); setCreating(false); setTicketForm({ subject: '', description: '', category: 'technical', priority: 'normal' }); toast.success('Ticket abierto'); }
    else toast.error(d.error ?? 'Error');
    setSaving(false);
  }

  async function sendChat() {
    if (!chatText.trim() || chatSending) return;
    setChatSending(true);
    const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: chatText.trim() }) });
    if (res.ok) setChatText('');
    else toast.error('Error al enviar');
    setChatSending(false);
  }

  return (
    <div className="page-content dashboard-unified-page" style={{ maxWidth: 1000 }}>
      {/* Header */}
      <div className="dashboard-unified-header" style={{ padding: '48px 0 40px' }}>
        <h1 style={{ fontFamily: fc, fontWeight: 900, fontSize: 'clamp(2.5rem, 5vw, 3.5rem)', textTransform: 'uppercase', letterSpacing: '0.01em', color: '#111827', lineHeight: 0.95, marginBottom: 8 }}>
          Inbox
        </h1>
        <p style={{ color: '#6b7280', fontSize: 15, fontFamily: f }}>Todo lo que necesitas atender</p>
      </div>

      {/* Tab selector — 4 cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1px', background: 'var(--border)', border: '1px solid var(--border)', marginBottom: 40 }}>
        {TABS.map((s) => {
          const active = tab === s.key;
          const Icon = s.icon;
          const badge = s.key === 'comentarios' ? unreadComments : s.key === 'notificaciones' ? unreadNotifications : 0;
          return (
            <button key={s.key} onClick={() => setTab(s.key)} style={{
              padding: '24px 20px', background: active ? 'var(--accent)' : '#ffffff',
              border: 'none', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Icon size={18} style={{ color: active ? '#ffffff' : 'var(--accent)' }} />
                {badge > 0 && <span style={{ fontSize: 10, background: 'var(--accent)', color: '#fff', padding: '1px 6px', fontFamily: f, fontWeight: 700 }}>{badge}</span>}
              </div>
              <p style={{ fontFamily: fc, fontWeight: 800, fontSize: 15, textTransform: 'uppercase', color: active ? '#ffffff' : '#111827', marginBottom: 4 }}>{s.title}</p>
              <p style={{ fontFamily: f, fontSize: 12, color: active ? 'rgba(255,255,255,0.5)' : '#9ca3af' }}>{s.desc}</p>
            </button>
          );
        })}
      </div>

      {/* ── COMENTARIOS ── */}
      {tab === 'comentarios' && (() => {
        const seeded: { name: string; platform: string; msg: string; time: string }[] = [
          { name: 'María García', platform: 'Instagram', msg: '¡Me encanta vuestro producto! ¿Cuándo online?', time: 'Hace 2h' },
          { name: 'Carlos López', platform: 'Facebook', msg: 'Llevo 2 semanas esperando respuesta...', time: 'Hace 5h' },
          { name: 'Ana Martín', platform: 'Instagram', msg: '¿Hacéis envíos a Canarias?', time: 'Ayer' },
          { name: 'Pedro Ruiz', platform: 'Instagram', msg: 'El mejor sitio de la ciudad', time: 'Hace 2 días' },
        ];
        const fromWeb = testimonials.map((t) => ({
          name: t.name, platform: 'Web', msg: t.message, time: new Date(t.created_at).toLocaleDateString(),
        }));
        const all = [...fromWeb, ...seeded];
        const visible = showAllComments ? all : all.slice(0, 6);
        return (
        <div>
          <h2 style={{ fontFamily: fc, fontWeight: 800, fontSize: 22, textTransform: 'uppercase', color: '#111827', marginBottom: 20 }}>Comentarios</h2>

          {/* Deja tu comentario — web feedback form */}
          <div style={{ border: '1px solid #e5e7eb', padding: 20, marginBottom: 24, background: '#ffffff' }}>
            <h3 style={{ fontFamily: fc, fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#111827', marginBottom: 4 }}>
              Deja tu comentario
            </h3>
            <p style={{ fontFamily: f, fontSize: 12, color: '#6b7280', marginBottom: 14 }}>
              Publicarás como <strong style={{ color: '#111827' }}>{brand?.name ?? 'Cliente'}</strong>. Cuéntanos qué te parece la web — tu comentario será revisado por el equipo antes de publicarse.
            </p>
            <textarea
              value={testimonialMessage}
              onChange={(e) => setTestimonialMessage(e.target.value)}
              placeholder="¿Qué te parece la web?"
              rows={3}
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', fontFamily: f, fontSize: 13, outline: 'none', color: '#111827', background: '#f9fafb', resize: 'vertical', marginBottom: 10 }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" onClick={submitTestimonial} disabled={!testimonialMessage.trim()}
                style={{ padding: '8px 20px', background: testimonialMessage.trim() ? '#111827' : '#e5e7eb', color: '#ffffff', border: 'none', fontFamily: fc, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', cursor: testimonialMessage.trim() ? 'pointer' : 'not-allowed' }}>
                Enviar comentario
              </button>
            </div>
          </div>

          {/* Lista */}
          <div style={{ border: '1px solid #e5e7eb' }}>
            {visible.map((item, i) => (
              <div key={`${item.name}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', borderBottom: i < visible.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                <div style={{ width: 32, height: 32, background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: f, fontSize: 12, fontWeight: 700, color: 'var(--accent)', flexShrink: 0 }}>{item.name.charAt(0)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <span style={{ fontFamily: f, fontSize: 13, fontWeight: 600, color: '#111827' }}>{item.name}</span>
                    <span style={{ fontFamily: f, fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.platform}</span>
                  </div>
                  <p style={{ fontFamily: f, fontSize: 13, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.msg}</p>
                </div>
                <span style={{ fontFamily: f, fontSize: 11, color: '#d1d5db', flexShrink: 0 }}>{item.time}</span>
              </div>
            ))}
          </div>

          {/* Ver todos / ver menos */}
          {all.length > 6 && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
              <button type="button" onClick={() => setShowAllComments((v) => !v)}
                style={{ padding: '8px 20px', background: '#ffffff', color: '#111827', border: '1px solid #e5e7eb', fontFamily: fc, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer' }}>
                {showAllComments ? 'Ver menos' : `Ver todos los comentarios (${all.length})`}
              </button>
            </div>
          )}
        </div>
        );
      })()}

      {/* ── MENSAJES — inline chat ── */}
      {tab === 'mensajes' && (
        <div>
          <h2 style={{ fontFamily: fc, fontWeight: 800, fontSize: 22, textTransform: 'uppercase', color: '#111827', marginBottom: 20 }}>Mensajes</h2>
          <div style={{ border: '1px solid #e5e7eb', height: 400, display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
              {chatLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20 }}>
                  {[180, 140, 200].map((w, i) => <div key={i} style={{ width: w, height: 28, background: '#f3f4f6', alignSelf: i % 2 ? 'flex-start' : 'flex-end' }} />)}
                </div>
              ) : messages.length === 0 ? (
                <div style={{ textAlign: 'center', marginTop: 80 }}>
                  <p style={{ fontFamily: f, fontWeight: 600, fontSize: 15, color: '#111827', marginBottom: 4 }}>Tu equipo está listo</p>
                  <p style={{ fontFamily: f, fontSize: 13, color: '#9ca3af' }}>Envía un mensaje y te respondemos en menos de 2h</p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div key={msg.id} style={{ display: 'flex', justifyContent: msg.sender_type === 'client' ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
                    <div style={{ maxWidth: '65%', background: msg.sender_type === 'client' ? '#f3f4f6' : '#e6f6f3', border: `1px solid ${msg.sender_type === 'client' ? '#d1d5db' : '#6fb7aa'}`, padding: '10px 14px' }}>
                      <p style={{ fontFamily: f, fontSize: 13, color: '#111827', lineHeight: 1.5, whiteSpace: 'pre-wrap', margin: 0 }}>{msg.message}</p>
                      <p style={{ fontFamily: f, fontSize: 10, color: '#d1d5db', marginTop: 4, textAlign: 'right' }}>{new Date(msg.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>
                ))
              )}
              <div ref={chatBottom} />
            </div>
            <div style={{ borderTop: '1px solid #e5e7eb', padding: '10px 16px', display: 'flex', gap: 8, alignItems: 'center' }}>
              <input value={chatText} onChange={(e) => setChatText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
                placeholder="Escribe un mensaje..." style={{ flex: 1, padding: '10px 14px', border: '1px solid #e5e7eb', fontFamily: f, fontSize: 14, outline: 'none', color: '#111827', background: '#f9fafb' }} />
              <button onClick={sendChat} disabled={!chatText.trim()} style={{
                width: 36, height: 36, background: chatText.trim() ? 'var(--accent)' : '#e5e7eb', border: 'none',
                cursor: chatText.trim() ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Send size={14} color="#ffffff" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SOPORTE — inline tickets ── */}
      {tab === 'soporte' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <h2 style={{ fontFamily: fc, fontWeight: 800, fontSize: 22, textTransform: 'uppercase', color: '#111827' }}>Soporte</h2>
            <button onClick={() => setCreating(true)} style={{
              background: 'var(--accent)', color: '#ffffff', border: 'none', padding: '8px 20px',
              fontFamily: fc, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <Plus size={14} /> Nuevo ticket
            </button>
          </div>

          {/* Create ticket form */}
          {creating && (
            <div style={{ border: '1px solid #e5e7eb', padding: '24px', marginBottom: 24, background: '#ffffff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h3 style={{ fontFamily: fc, fontSize: 16, fontWeight: 800, textTransform: 'uppercase', color: '#111827' }}>Nuevo ticket</h3>
                <button onClick={() => setCreating(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}><X size={16} /></button>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9ca3af', marginBottom: 6 }}>Asunto *</label>
                <input value={ticketForm.subject} onChange={(e) => setTicketForm(p => ({ ...p, subject: e.target.value }))} placeholder="Describe el problema"
                  style={{ width: '100%', padding: '12px 14px', border: '1px solid #e5e7eb', fontFamily: f, fontSize: 14, outline: 'none', boxSizing: 'border-box', color: '#111827' }} />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9ca3af', marginBottom: 6 }}>Descripción</label>
                <textarea value={ticketForm.description} onChange={(e) => setTicketForm(p => ({ ...p, description: e.target.value }))} placeholder="Detalla el problema..."
                  rows={3} style={{ width: '100%', padding: '12px 14px', border: '1px solid #e5e7eb', fontFamily: f, fontSize: 14, outline: 'none', boxSizing: 'border-box', resize: 'vertical', color: '#111827' }} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setCreating(false)} style={{ padding: '10px 20px', border: '1px solid #e5e7eb', background: '#ffffff', fontFamily: f, fontSize: 13, fontWeight: 600, color: '#6b7280', cursor: 'pointer' }}>Cancelar</button>
                <button onClick={createTicket} disabled={saving} style={{
                  padding: '10px 24px', background: 'var(--accent)', color: '#ffffff', border: 'none',
                  fontFamily: fc, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer', opacity: saving ? 0.5 : 1,
                }}>{saving ? 'Enviando...' : 'Abrir ticket →'}</button>
              </div>
            </div>
          )}

          {/* Tickets list */}
          {ticketsLoading ? (
            <div style={{ border: '1px solid #e5e7eb' }}>
              {[1,2,3].map(i => <div key={i} style={{ padding: '16px 20px', borderBottom: i < 3 ? '1px solid #f3f4f6' : 'none' }}><div style={{ width: '40%', height: 12, background: '#f3f4f6' }} /></div>)}
            </div>
          ) : tickets.length === 0 && !creating ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', border: '1px solid #e5e7eb' }}>
              <p style={{ fontFamily: fc, fontWeight: 900, fontSize: 20, textTransform: 'uppercase', color: '#111827', marginBottom: 8 }}>Todo en orden</p>
              <p style={{ fontFamily: f, fontSize: 14, color: '#9ca3af', marginBottom: 24 }}>Si necesitas ayuda, abre un ticket</p>
              <button onClick={() => setCreating(true)} style={{
                background: 'var(--accent)', color: '#ffffff', border: 'none', padding: '12px 28px',
                fontFamily: fc, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer',
              }}>Abrir ticket</button>
            </div>
          ) : tickets.length > 0 && (
            <div style={{ border: '1px solid #e5e7eb' }}>
              {tickets.map((t, i) => {
                const st = STATUS_STYLE[t.status] ?? STATUS_STYLE.open;
                return (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: i < tickets.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                    <div>
                      <p style={{ fontFamily: f, fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 2 }}>{t.subject}</p>
                      <p style={{ fontFamily: f, fontSize: 11, color: '#9ca3af' }}>{new Date(t.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</p>
                    </div>
                    <span style={{ fontFamily: f, fontSize: 10, fontWeight: 600, padding: '2px 8px', color: st.color, background: st.bg, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{st.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── NOVEDADES — inline changelog ── */}
      {tab === 'novedades' && (
        <div>
          <h2 style={{ fontFamily: fc, fontWeight: 800, fontSize: 22, textTransform: 'uppercase', color: '#111827', marginBottom: 20 }}>Novedades</h2>
          {entries.length === 0 ? (
            <div style={{ border: '1px solid #e5e7eb' }}>
              {[1,2,3].map(i => <div key={i} style={{ padding: '20px 24px', borderBottom: i < 3 ? '1px solid #f3f4f6' : 'none' }}><div style={{ width: '50%', height: 14, background: '#f3f4f6', marginBottom: 8 }} /><div style={{ width: '80%', height: 10, background: '#f3f4f6' }} /></div>)}
            </div>
          ) : (
            <div style={{ position: 'relative', paddingLeft: 28 }}>
              <div style={{ position: 'absolute', left: 5, top: 0, bottom: 0, width: 1, background: '#e5e7eb' }} />
              {entries.slice(0, 8).map((entry) => {
                const byType: Record<string, { type: string; text: string }[]> = {};
                for (const c of (Array.isArray(entry.changes) ? entry.changes : [])) { if (!byType[c.type]) byType[c.type] = []; byType[c.type].push(c); }
                return (
                  <div key={entry.id} style={{ position: 'relative', marginBottom: 24 }}>
                    <div style={{ position: 'absolute', left: -24, top: 4, width: 8, height: 8, background: 'var(--accent)', borderRadius: '50%' }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      {entry.published_at && <span style={{ fontFamily: f, fontSize: 11, color: '#9ca3af' }}>{new Date(entry.published_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>}
                      {entry.version && <span style={{ fontFamily: f, fontSize: 9, fontWeight: 600, color: 'var(--accent)', background: 'var(--accent-light)', padding: '1px 6px', textTransform: 'uppercase' }}>v{entry.version}</span>}
                    </div>
                    <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', padding: '16px 20px' }}>
                      <h3 style={{ fontFamily: fc, fontSize: 16, fontWeight: 800, textTransform: 'uppercase', color: '#111827', marginBottom: entry.summary ? 4 : 10 }}>{entry.title}</h3>
                      {entry.summary && <p style={{ fontFamily: f, fontSize: 13, color: '#6b7280', lineHeight: 1.6, marginBottom: 10 }}>{entry.summary}</p>}
                      {Object.entries(byType).map(([type, changes]) => {
                        const Icon = TYPE_ICON[type] ?? TrendingUp;
                        return (
                          <div key={type} style={{ marginBottom: 6 }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', background: 'var(--accent-light)', fontFamily: f, fontSize: 9, fontWeight: 600, color: TYPE_COLOR[type] ?? '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                              <Icon size={10} style={{ color: TYPE_COLOR[type] }} /> {TYPE_LABEL[type] ?? type}
                            </span>
                            <ul style={{ margin: '4px 0 0', paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 2 }}>
                              {changes.map((c, i) => <li key={i} style={{ fontFamily: f, fontSize: 12, color: '#374151', lineHeight: 1.5 }}>{c.text}</li>)}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      {/* ── NOTIFICACIONES ── */}
      {tab === 'notificaciones' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <h2 style={{ fontFamily: fc, fontWeight: 800, fontSize: 22, textTransform: 'uppercase', color: '#111827' }}>Notificaciones</h2>
            {notifications.filter(n => !n.read).length > 0 && (
              <button onClick={() => { markAllNotificationsRead(); fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ all: true }) }); }} style={{
                background: '#ffffff', border: '1px solid var(--accent)', padding: '6px 14px', cursor: 'pointer',
                fontFamily: f, fontSize: 12, fontWeight: 600, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <CheckCheck size={13} /> Marcar todo como leído
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', border: '1px solid #e5e7eb' }}>
              <p style={{ fontFamily: fc, fontWeight: 900, fontSize: 20, textTransform: 'uppercase', color: '#111827', marginBottom: 8 }}>Sin notificaciones</p>
              <p style={{ fontFamily: f, fontSize: 14, color: '#9ca3af' }}>Aquí aparecerán las novedades sobre tu contenido</p>
            </div>
          ) : (() => {
            // Usa los grupos precomputados en notificationGroups (useMemo arriba)
            const groups = notificationGroups;

            const NOTIF_ICON: Record<string, string> = {
              approval_needed: '⏳', published: '✅', failed: '❌', comment: '💬',
              limit_reached: '🚫', meta_connected: '🔗', token_expired: '⚠️',
              payment_failed: '💳', plan_activated: '🎉', team_invite: '👥', trend_detected: '🔥',
            };

            const NOTIF_LINK: Record<string, string> = {
              approval_needed: '/posts', published: '/posts', failed: '/posts',
              comment: '/inbox?tab=comentarios', limit_reached: '/settings/plan',
              meta_connected: '/settings#redes', token_expired: '/settings#redes',
              payment_failed: '/settings/plan', plan_activated: '/settings/plan',
              team_invite: '/settings/team', trend_detected: '/tendencias',
            };

            return (
              <div style={{ border: '1px solid #e5e7eb' }}>
                {groups.map((group) => (
                  <div key={group.label}>
                    <div style={{ padding: '10px 20px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                      <span style={{ fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--accent)' }}>{group.label}</span>
                    </div>
                    {group.items.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => {
                          const link = NOTIF_LINK[n.type] ?? '/dashboard';
                          if (link.startsWith('/inbox')) setTab(link.split('tab=')[1] as Tab);
                          else router.push(link);
                        }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 14, padding: '12px 20px',
                          borderBottom: '1px solid #f3f4f6', cursor: 'pointer',
                          background: n.read ? '#ffffff' : 'var(--accent-light)',
                          transition: 'background 0.1s',
                        }}
                      >
                        <span style={{ fontSize: 16, flexShrink: 0 }}>{NOTIF_ICON[n.type] ?? '📌'}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontFamily: f, fontSize: 13, fontWeight: n.read ? 400 : 600, color: '#111827', marginBottom: 2 }}>{n.message}</p>
                          <p style={{ fontFamily: f, fontSize: 11, color: '#d1d5db' }}>
                            {new Date(n.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        {!n.read && <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}

export default function InboxPage() {
  return <Suspense><InboxInner /></Suspense>;
}
