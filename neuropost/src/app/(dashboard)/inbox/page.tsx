'use client';

import { useState, useEffect, useRef, Suspense, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MessageSquare, MessageCircle, LifeBuoy, Bell, ArrowRight, Plus, Send, X, CheckCheck } from 'lucide-react';
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

const f = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

type Tab = 'mensajes' | 'soporte' | 'notificaciones';
type IconProps = { size?: number; style?: React.CSSProperties };

const TABS: { key: Tab; title: string; desc: string; icon: React.ComponentType<IconProps> }[] = [
  { key: 'notificaciones', title: 'Notificaciones', desc: 'Actividad reciente',   icon: Bell },
  { key: 'mensajes',       title: 'Mensajes',       desc: 'Tu equipo NeuroPost',  icon: MessageCircle },
  { key: 'soporte',        title: 'Soporte',        desc: 'Tickets y consultas',  icon: LifeBuoy },
];

const FEEDBACK_OPTIONS = [
  { value: 5, label: 'Excelente' },
  { value: 4, label: 'Muy buena' },
  { value: 3, label: 'Buena' },
  { value: 2, label: 'Mejorable' },
] as const;

// ── Types ──
type Ticket = { id: string; subject: string; status: string; category: string; created_at: string };
type ChatMsg = { id: string; sender_type: 'client' | 'worker'; message: string; created_at: string };
const STATUS_STYLE: Record<string, { color: string; bg: string; label: string }> = {
  open: { color: '#0F766E', bg: '#f0fdfa', label: 'Abierto' },
  in_progress: { color: '#0D9488', bg: '#ecfeff', label: 'En proceso' },
  resolved: { color: '#0F766E', bg: '#ecfdf5', label: 'Resuelto' },
  closed: { color: '#6b7280', bg: '#f3f4f6', label: 'Cerrado' },
};

function normalizeNotificationMessage(type: string, message: string) {
  if (type === 'chat_message' || type === 'new_message') {
    if (message.startsWith('Nuevo mensaje del equipo de NeuroPost')) return message;
    return message
      .replace(/^Nuevo mensaje de tu equipo/, 'Nuevo mensaje del equipo de NeuroPost')
      .replace(/^Nuevo mensaje del equipo/, 'Nuevo mensaje del equipo de NeuroPost');
  }
  return message;
}

function getNotificationCategory(type: string) {
  const categories: Record<string, { label: string; color: string; bg: string }> = {
    approval_needed: { label: 'Contenido',   color: '#0F766E', bg: '#f0fdfa' },
    published:       { label: 'Publicación', color: '#166534', bg: '#ecfdf5' },
    failed:          { label: 'Incidencia',  color: '#b91c1c', bg: '#fef2f2' },
    comment:         { label: 'Comentarios', color: '#1d4ed8', bg: '#eff6ff' },
    limit_reached:   { label: 'Plan',        color: '#b45309', bg: '#fffbeb' },
    meta_connected:  { label: 'Conexiones',  color: '#0F766E', bg: '#f0fdfa' },
    token_expired:   { label: 'Conexiones',  color: '#b45309', bg: '#fffbeb' },
    payment_failed:  { label: 'Facturación', color: '#b91c1c', bg: '#fef2f2' },
    plan_activated:  { label: 'Plan',        color: '#166534', bg: '#ecfdf5' },
    team_invite:     { label: 'Equipo',      color: '#4338ca', bg: '#eef2ff' },
    trend_detected:  { label: 'Tendencias',  color: '#7c3aed', bg: '#f5f3ff' },
    chat_message:    { label: 'Mensajes',    color: '#0F766E', bg: '#f0fdfa' },
    new_message:     { label: 'Mensajes',    color: '#0F766E', bg: '#f0fdfa' },
    ticket_reply:    { label: 'Soporte',     color: '#0D9488', bg: '#ecfeff' },
  };
  return categories[type] ?? { label: 'Actualización', color: '#374151', bg: '#f3f4f6' };
}

function InboxInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawTab = searchParams.get('tab');
  const tab: Tab = rawTab === 'mensajes' || rawTab === 'soporte' || rawTab === 'notificaciones'
    ? rawTab
    : 'notificaciones';
  const brand = useAppStore((s) => s.brand);

  // Personal profile from Supabase auth metadata
  const [operatorFirstName, setOperatorFirstName] = useState('');
  const [operatorLastName,  setOperatorLastName]  = useState('');
  const [operatorShowName,  setOperatorShowName]  = useState(true);
  useEffect(() => {
    const supabase = createBrowserClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      const meta = user?.user_metadata ?? {};
      if (meta.first_name) setOperatorFirstName(meta.first_name as string);
      if (meta.last_name)  setOperatorLastName(meta.last_name as string);
      if (typeof meta.show_name === 'boolean') setOperatorShowName(meta.show_name);
    });
  }, []);
  const operatorDisplayName = (() => {
    const fullName = [operatorFirstName, operatorLastName].filter(Boolean).join(' ');
    const bName = brand?.name ?? '';
    if (operatorShowName && fullName) return `${fullName} · ${bName}`;
    return bName;
  })();

  const unreadNotifications = useAppStore((s) => s.unreadNotifications);
  const notifications = useAppStore((s) => s.notifications);
  const setNotifications = useAppStore((s) => s.setNotifications);
  const markAllNotificationsRead = useAppStore((s) => s.markAllNotificationsRead);
  const markNotificationRead = useAppStore((s) => s.markNotificationRead);

  // Soporte state
  const SUBJECT_OPTIONS = [
    'Problema con publicaciones',
    'Error en la plataforma',
    'Problema con mi cuenta',
    'Facturación y pagos',
    'Cambio de plan',
    'Solicitud de funcionalidad',
    'Problema con Instagram/Facebook',
    'No recibo respuestas del equipo',
    'Otro',
  ];
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [ticketForm, setTicketForm] = useState({ subject: '', customSubject: '', description: '', category: 'technical', priority: 'normal' });
  const [saving, setSaving] = useState(false);
  // Ticket detail view
  type TicketMsg = { id: string; sender_type: 'client' | 'worker'; message: string; created_at: string };
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [ticketMessages, setTicketMessages] = useState<TicketMsg[]>([]);
  const [ticketMsgLoading, setTicketMsgLoading] = useState(false);
  const [ticketReply, setTicketReply] = useState('');
  const [ticketReplySending, setTicketReplySending] = useState(false);
  const ticketMsgBottom = useRef<HTMLDivElement>(null);

  // Feedback form state
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackRating, setFeedbackRating] = useState(4);
  const [feedbackSending, setFeedbackSending] = useState(false);

  // Chat state
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [chatLoading, setChatLoading] = useState(true);
  const [chatText, setChatText] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const chatBottom = useRef<HTMLDivElement>(null);


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
        if (row.sender_type === 'worker') toast.success('Nuevo mensaje del equipo de NeuroPost');
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
        toast(normalizeNotificationMessage(n.type, n.message));
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

  useEffect(() => {
    if (rawTab !== tab) router.replace(`/inbox?tab=${tab}`);
  }, [rawTab, router, tab]);

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
    } else if (tab === 'notificaciones') {
      fetch('/api/notifications')
        .then((r) => r.json())
        .then((d) => { if (d.notifications) setNotifications(d.notifications); })
        .catch(() => { loadedTabsRef.current[tab] = false; });
    }
  }, [tab, setNotifications]);

  useEffect(() => { chatBottom.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function createTicket() {
    const finalSubject = ticketForm.subject === 'Otro' ? ticketForm.customSubject.trim() : ticketForm.subject;
    if (!finalSubject) { toast.error('Selecciona un asunto'); return; }
    if (!ticketForm.description.trim()) { toast.error('La descripción es obligatoria'); return; }
    setSaving(true);
    const res = await fetch('/api/soporte', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...ticketForm, subject: finalSubject }),
    });
    const d = await res.json();
    if (res.ok) {
      setTickets(p => [d.ticket, ...p]);
      setCreating(false);
      setTicketForm({ subject: '', customSubject: '', description: '', category: 'technical', priority: 'normal' });
      toast.success('Ticket abierto — el equipo de NeuroPost te responderá en breve');
    } else toast.error(d.error ?? 'Error');
    setSaving(false);
  }

  async function openTicketDetail(ticket: Ticket) {
    setSelectedTicket(ticket);
    setTicketMsgLoading(true);
    try {
      const res = await fetch(`/api/soporte/${ticket.id}`);
      const d = await res.json();
      setTicketMessages(d.messages ?? []);
    } catch { setTicketMessages([]); }
    setTicketMsgLoading(false);
  }

  async function sendTicketReply() {
    if (!ticketReply.trim() || ticketReplySending || !selectedTicket) return;
    setTicketReplySending(true);
    const res = await fetch(`/api/soporte/${selectedTicket.id}/message`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: ticketReply.trim() }),
    });
    if (res.ok) {
      const d = await res.json();
      setTicketMessages(p => [...p, d.message]);
      setTicketReply('');
    } else toast.error('Error al enviar');
    setTicketReplySending(false);
  }

  useEffect(() => { ticketMsgBottom.current?.scrollIntoView({ behavior: 'smooth' }); }, [ticketMessages]);

  function closeFeedbackModal() {
    setFeedbackOpen(false);
    setFeedbackText('');
    setFeedbackRating(4);
  }

  async function sendFeedback() {
    if (!feedbackText.trim() || feedbackSending) return;
    setFeedbackSending(true);
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: feedbackRating,
          message: feedbackText.trim(),
          page: window.location.pathname,
        }),
      });
      if (res.ok) {
        closeFeedbackModal();
        toast.success('Gracias por compartir tu opinión');
      } else {
        const d = await res.json();
        toast.error(d.error ?? 'Error al enviar');
      }
    } catch {
      toast.error('Error al enviar');
    }
    setFeedbackSending(false);
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

      {/* Tab selector — 3 cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', background: 'var(--border)', border: '1px solid var(--border)', marginBottom: 20 }}>
        {TABS.map((s) => {
          const active = tab === s.key;
          const Icon = s.icon;
          const badge = s.key === 'notificaciones' ? unreadNotifications : 0;
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

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) auto',
        gap: 20,
        alignItems: 'center',
        padding: '22px 24px',
        border: '1px solid #e5e7eb',
        background: 'linear-gradient(180deg, #ffffff 0%, #f8fbfb 100%)',
        marginBottom: 40,
      }}>
        <div>
          <p style={{ fontFamily: fc, fontWeight: 800, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent)', marginBottom: 8 }}>
            Feedback
          </p>
          <h2 style={{ fontFamily: fc, fontWeight: 900, fontSize: 24, textTransform: 'uppercase', color: '#111827', lineHeight: 1, marginBottom: 8 }}>
            Cuéntanos qué mejorarías en NeuroPost
          </h2>
          <p style={{ fontFamily: f, fontSize: 14, color: '#6b7280', maxWidth: 620 }}>
            Si quieres, puedes dejarnos un comentario sobre tu experiencia, sugerencias de mejora o cualquier detalle que creas que deberíamos pulir.
          </p>
        </div>
        <button
          onClick={() => setFeedbackOpen(true)}
          style={{
            background: '#ffffff',
            color: '#111827',
            border: '1px solid #d1d5db',
            padding: '12px 18px',
            fontFamily: fc,
            fontSize: 12,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            whiteSpace: 'nowrap',
          }}
        >
          <MessageSquare size={15} />
          Compartir feedback
        </button>
      </div>


      {/* MODAL DE VALORACIÓN */}
      {feedbackOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.18)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', boxShadow: '0 20px 50px rgba(15,23,42,0.14)', padding: 32, minWidth: 340, maxWidth: 560, width: 'calc(100vw - 32px)', position: 'relative' }}>
            <button onClick={closeFeedbackModal} style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}><X size={18} /></button>
            <p style={{ fontFamily: fc, fontWeight: 800, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent)', marginBottom: 8 }}>
              Feedback
            </p>
            <h2 style={{ fontFamily: fc, fontWeight: 900, fontSize: 26, textTransform: 'uppercase', color: '#111827', marginBottom: 10, lineHeight: 1 }}>
              Comparte tu opinión
            </h2>
            <p style={{ fontFamily: f, fontSize: 14, color: '#6b7280', marginBottom: 18, lineHeight: 1.6 }}>
              Queremos que la experiencia sea cada vez mejor. Cuéntanos qué te gusta, qué mejorarías o qué echas en falta.
            </p>
            <div style={{ marginBottom: 18 }}>
              <p style={{ fontFamily: f, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9ca3af', marginBottom: 8 }}>
                Valoración general
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {FEEDBACK_OPTIONS.map((option) => {
                  const active = feedbackRating === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setFeedbackRating(option.value)}
                      style={{
                        padding: '9px 12px',
                        border: `1px solid ${active ? 'var(--accent)' : '#d1d5db'}`,
                        background: active ? '#f0fdfa' : '#ffffff',
                        color: active ? '#0F766E' : '#374151',
                        fontFamily: f,
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <textarea
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder="Escribe aquí tu comentario o sugerencia..."
              rows={5}
              style={{ width: '100%', padding: '14px', border: '1px solid #e5e7eb', fontFamily: f, fontSize: 14, outline: 'none', color: '#111827', background: '#f9fafb', resize: 'vertical', marginBottom: 18, boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <button
                type="button"
                onClick={closeFeedbackModal}
                style={{ padding: '12px 18px', background: '#ffffff', color: '#6b7280', border: '1px solid #d1d5db', fontFamily: f, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button onClick={sendFeedback} disabled={!feedbackText.trim() || feedbackSending}
                style={{ padding: '12px 24px', background: feedbackText.trim() && !feedbackSending ? 'var(--accent)' : '#e5e7eb', color: '#ffffff', border: 'none', fontFamily: fc, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', cursor: feedbackText.trim() && !feedbackSending ? 'pointer' : 'not-allowed' }}>
                {feedbackSending ? 'Enviando...' : 'Enviar comentario'}
              </button>
            </div>
          </div>
        </div>
      )}

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
                  <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.sender_type === 'client' ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
                    {msg.sender_type === 'client' && operatorDisplayName && (
                      <span style={{ fontFamily: f, fontSize: 10, color: '#9ca3af', marginBottom: 2, paddingRight: 2 }}>{operatorDisplayName}</span>
                    )}
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

      {/* ── SOPORTE — tickets con detalle ── */}
      {tab === 'soporte' && (
        <div>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <h2 style={{ fontFamily: fc, fontWeight: 800, fontSize: 22, textTransform: 'uppercase', color: '#111827', marginBottom: 2 }}>Soporte</h2>
              {selectedTicket && (
                <button onClick={() => setSelectedTicket(null)} style={{ background: 'none', border: 'none', fontFamily: f, fontSize: 12, color: 'var(--accent)', cursor: 'pointer', padding: 0 }}>
                  ← Volver a tickets
                </button>
              )}
            </div>
            {!selectedTicket && (
              <button onClick={() => setCreating(true)} style={{
                background: 'var(--accent)', color: '#ffffff', border: 'none', padding: '8px 20px',
                fontFamily: fc, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <Plus size={14} /> Nuevo ticket
              </button>
            )}
          </div>

          {/* ── Create ticket form ── */}
          {creating && !selectedTicket && (
            <div style={{ border: '1px solid #e5e7eb', padding: '24px', marginBottom: 24, background: '#ffffff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h3 style={{ fontFamily: fc, fontSize: 16, fontWeight: 800, textTransform: 'uppercase', color: '#111827' }}>Nuevo ticket</h3>
                <button onClick={() => setCreating(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}><X size={16} /></button>
              </div>
              {/* Asunto — dropdown */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9ca3af', marginBottom: 6 }}>Asunto *</label>
                <select value={ticketForm.subject} onChange={(e) => setTicketForm(p => ({ ...p, subject: e.target.value, customSubject: '' }))}
                  style={{ width: '100%', padding: '12px 14px', border: '1px solid #e5e7eb', fontFamily: f, fontSize: 14, outline: 'none', boxSizing: 'border-box', color: ticketForm.subject ? '#111827' : '#9ca3af', background: '#ffffff', appearance: 'none', backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%239ca3af\' stroke-width=\'2\'%3E%3Cpath d=\'M6 9l6 6 6-6\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 14px center' }}>
                  <option value="" disabled>Selecciona el tipo de problema</option>
                  {SUBJECT_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>
              {/* Custom subject — solo si selecciona "Otro" */}
              {ticketForm.subject === 'Otro' && (
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9ca3af', marginBottom: 6 }}>Especifica el asunto *</label>
                  <input value={ticketForm.customSubject} onChange={(e) => setTicketForm(p => ({ ...p, customSubject: e.target.value }))} placeholder="Describe brevemente tu problema"
                    style={{ width: '100%', padding: '12px 14px', border: '1px solid #e5e7eb', fontFamily: f, fontSize: 14, outline: 'none', boxSizing: 'border-box', color: '#111827' }} />
                </div>
              )}
              {/* Descripción — obligatoria */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9ca3af', marginBottom: 6 }}>Descripción *</label>
                <textarea value={ticketForm.description} onChange={(e) => setTicketForm(p => ({ ...p, description: e.target.value }))} placeholder="Explica con detalle lo que ha pasado para que podamos ayudarte mejor..."
                  rows={4} style={{ width: '100%', padding: '12px 14px', border: '1px solid #e5e7eb', fontFamily: f, fontSize: 14, outline: 'none', boxSizing: 'border-box', resize: 'vertical', color: '#111827' }} />
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

          {/* ── Ticket detail view ── */}
          {selectedTicket && (
            <div>
              {/* Ticket info */}
              <div style={{ border: '1px solid #e5e7eb', padding: '20px', marginBottom: 16, background: '#ffffff' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <h3 style={{ fontFamily: f, fontSize: 16, fontWeight: 700, color: '#111827', margin: 0 }}>{selectedTicket.subject}</h3>
                  <span style={{ fontFamily: f, fontSize: 10, fontWeight: 600, padding: '2px 8px', color: (STATUS_STYLE[selectedTicket.status] ?? STATUS_STYLE.open).color, background: (STATUS_STYLE[selectedTicket.status] ?? STATUS_STYLE.open).bg, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {(STATUS_STYLE[selectedTicket.status] ?? STATUS_STYLE.open).label}
                  </span>
                </div>
                <p style={{ fontFamily: f, fontSize: 12, color: '#9ca3af' }}>
                  Creado el {new Date(selectedTicket.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>

              {/* Messages thread */}
              <div style={{ border: '1px solid #e5e7eb', height: 350, display: 'flex', flexDirection: 'column' }}>
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
                  {ticketMsgLoading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20 }}>
                      {[180, 140, 200].map((w, i) => <div key={i} style={{ width: w, height: 28, background: '#f3f4f6', alignSelf: i % 2 ? 'flex-start' : 'flex-end' }} />)}
                    </div>
                  ) : ticketMessages.length === 0 ? (
                    <div style={{ textAlign: 'center', marginTop: 60 }}>
                      <p style={{ fontFamily: f, fontSize: 13, color: '#9ca3af' }}>No hay mensajes en este ticket</p>
                    </div>
                  ) : (
                    ticketMessages.map((msg) => (
                      <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.sender_type === 'client' ? 'flex-end' : 'flex-start', marginBottom: 10 }}>
                        <span style={{ fontFamily: f, fontSize: 10, color: '#9ca3af', marginBottom: 2 }}>
                          {msg.sender_type === 'client' ? (operatorDisplayName || 'Tú') : 'Equipo de NeuroPost'}
                        </span>
                        <div style={{ maxWidth: '70%', background: msg.sender_type === 'client' ? '#f3f4f6' : '#ecfdf5', border: `1px solid ${msg.sender_type === 'client' ? '#d1d5db' : '#6fb7aa'}`, padding: '10px 14px' }}>
                          <p style={{ fontFamily: f, fontSize: 13, color: '#111827', lineHeight: 1.5, whiteSpace: 'pre-wrap', margin: 0 }}>{msg.message}</p>
                          <p style={{ fontFamily: f, fontSize: 10, color: '#d1d5db', marginTop: 4, textAlign: 'right' }}>{new Date(msg.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={ticketMsgBottom} />
                </div>
                {/* Reply input */}
                <div style={{ borderTop: '1px solid #e5e7eb', padding: '10px 16px', display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input value={ticketReply} onChange={(e) => setTicketReply(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendTicketReply(); } }}
                    placeholder="Escribe una respuesta..." style={{ flex: 1, padding: '10px 14px', border: '1px solid #e5e7eb', fontFamily: f, fontSize: 14, outline: 'none', color: '#111827', background: '#f9fafb' }} />
                  <button onClick={sendTicketReply} disabled={!ticketReply.trim() || ticketReplySending} style={{
                    width: 36, height: 36, background: ticketReply.trim() && !ticketReplySending ? 'var(--accent)' : '#e5e7eb', border: 'none',
                    cursor: ticketReply.trim() && !ticketReplySending ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Send size={14} color="#ffffff" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Tickets list ── */}
          {!selectedTicket && !creating && (
            <>
              {ticketsLoading ? (
                <div style={{ border: '1px solid #e5e7eb' }}>
                  {[1,2,3].map(i => <div key={i} style={{ padding: '16px 20px', borderBottom: i < 3 ? '1px solid #f3f4f6' : 'none' }}><div style={{ width: '40%', height: 12, background: '#f3f4f6' }} /></div>)}
                </div>
              ) : tickets.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', border: '1px solid #e5e7eb' }}>
                  <p style={{ fontFamily: fc, fontWeight: 900, fontSize: 20, textTransform: 'uppercase', color: '#111827', marginBottom: 8 }}>Todo en orden</p>
                  <p style={{ fontFamily: f, fontSize: 14, color: '#9ca3af', marginBottom: 24 }}>Si necesitas ayuda, abre un ticket</p>
                  <button onClick={() => setCreating(true)} style={{
                    background: 'var(--accent)', color: '#ffffff', border: 'none', padding: '12px 28px',
                    fontFamily: fc, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer',
                  }}>Abrir ticket</button>
                </div>
              ) : (
                <div style={{ border: '1px solid #e5e7eb' }}>
                  {tickets.map((t, i) => {
                    const st = STATUS_STYLE[t.status] ?? STATUS_STYLE.open;
                    return (
                      <div key={t.id} onClick={() => openTicketDetail(t)}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: i < tickets.length - 1 ? '1px solid #f3f4f6' : 'none', cursor: 'pointer', transition: 'background 0.15s' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = '#f9fafb')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = '#ffffff')}>
                        <div>
                          <p style={{ fontFamily: f, fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 2 }}>{t.subject}</p>
                          <p style={{ fontFamily: f, fontSize: 11, color: '#9ca3af' }}>
                            {new Date(t.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                            <span style={{ marginLeft: 8 }}>·</span>
                            <span style={{ marginLeft: 8 }}>Click para ver detalles</span>
                          </p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontFamily: f, fontSize: 10, fontWeight: 600, padding: '2px 8px', color: st.color, background: st.bg, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{st.label}</span>
                          <ArrowRight size={14} color="#d1d5db" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
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

            const NOTIF_LINK: Record<string, string> = {
              approval_needed: '/posts', published: '/posts', failed: '/posts',
              comment: '/comments', limit_reached: '/settings/plan',
              meta_connected: '/settings#redes', token_expired: '/settings#redes',
              payment_failed: '/settings/plan', plan_activated: '/settings/plan',
              team_invite: '/settings/team', trend_detected: '/tendencias',
              chat_message: '/inbox?tab=mensajes',
              new_message: '/inbox?tab=mensajes',
              ticket_reply: '/inbox?tab=soporte',
            };

            return (
              <div style={{ border: '1px solid #e5e7eb' }}>
                {groups.map((group) => (
                  <div key={group.label}>
                    <div style={{ padding: '10px 20px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                      <span style={{ fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--accent)' }}>{group.label}</span>
                    </div>
                    {group.items.map((n) => {
                      const category = getNotificationCategory(n.type);
                      const message = normalizeNotificationMessage(n.type, n.message);

                      return (
                        <div
                          key={n.id}
                          onClick={() => {
                            if (!n.read) {
                              markNotificationRead(n.id);
                              fetch('/api/notifications', {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ ids: [n.id] }),
                              }).catch(() => null);
                            }
                            const link = NOTIF_LINK[n.type] ?? '/dashboard';
                            if (link.startsWith('/inbox')) setTab(link.split('tab=')[1] as Tab);
                            else router.push(link);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            justifyContent: 'space-between',
                            gap: 16,
                            padding: '14px 20px',
                            borderBottom: '1px solid #f3f4f6',
                            cursor: 'pointer',
                            background: n.read ? '#ffffff' : '#fbfefe',
                            transition: 'background 0.1s',
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                              <span style={{
                                fontFamily: f,
                                fontSize: 10,
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                letterSpacing: '0.08em',
                                padding: '3px 8px',
                                background: category.bg,
                                color: category.color,
                              }}>
                                {category.label}
                              </span>
                              <span style={{ fontFamily: f, fontSize: 11, color: '#9ca3af' }}>
                                {new Date(n.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p style={{ fontFamily: f, fontSize: 13, fontWeight: n.read ? 500 : 700, color: '#111827', lineHeight: 1.55, margin: 0 }}>
                              {message}
                            </p>
                          </div>
                          {!n.read && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0, marginTop: 6 }} />}
                        </div>
                      );
                    })}
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
