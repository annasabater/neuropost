'use client';

import { use, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { X, Edit2, Save, Send, MessageCircle, LifeBuoy, BookOpen, Sparkles, Plus, Flag, Upload, Share2, Settings, BarChart3 } from 'lucide-react';
import toast from 'react-hot-toast';
import { StatusProgressBar } from '@/components/posts/StatusProgressBar';
import { WorkerCockpit }     from '@/components/worker/WorkerCockpit';
import { HumanReviewCard }   from './_components/HumanReviewCard';
import { PLAN_META } from '@/types';
import type { SubscriptionPlan, HumanReviewConfig } from '@/types';

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
};

const f = "var(--font-barlow)";
const fc = "var(--font-barlow-condensed)";

type Brand = Record<string, unknown> & {
  id: string;
  name: string;
  plan: string;
  price?: number;
  renewal_date?: string;
  promo_code?: string;
  ig_username?: string;
  email?: string;
  phone?: string;
  created_at?: string;
  meta_token_expires_at?: string;
  human_review_config?: HumanReviewConfig | null;
};

type AgentBrief = {
  intent:     string;
  mode:       'txt2img' | 'img2img';
  prompt:     string;
  guidance:   number;
  strength:   number | null;
  model:      string;
  confidence: number;
  reasoning:  string;
  risk_flags: string[];
};

type Post = Record<string, unknown> & {
  id: string;
  image_url?: string;
  edited_image_url?: string;
  caption?: string;
  hashtags?: string[];
  format?: string;
  status: string;
  created_at: string;
  agent_id?: string;
  agent_name?: string;
  ai_explanation?: string;
  agent_brief?: AgentBrief | null;
};

type Agent = { id: string; name: string };
type Note = { id: string; note: string; is_pinned: boolean; created_at: string; workers?: { full_name: string } };
type Activity = { id: string; action: string; details: Record<string, unknown> | null; created_at: string };
type ChatMsg = {
  id: string;
  brand_id: string;
  sender_type: 'client' | 'worker';
  message: string;
  created_at: string;
  read_at: string | null;
};
type SupportTicket = {
  id: string;
  subject: string;
  description: string | null;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  created_at: string;
  resolved_at: string | null;
};
type ClientRequest = {
  id: string;
  kind: 'special' | 'recreation';
  title: string | null;
  description: string | null;
  type: string | null;
  status: string;
  deadline_at: string | null;
  created_at: string;
  completed_at: string | null;
  worker_response: string | null;
};

const REQUEST_TYPES = [
  { key: 'campaign', label: 'Campaña' },
  { key: 'seasonal', label: 'Temporal' },
  { key: 'custom', label: 'Personalizada' },
  { key: 'urgent', label: 'Urgente' },
  { key: 'consultation', label: 'Consulta' },
  { key: 'other', label: 'Otra' },
] as const;

const REQUEST_STATUS: Record<string, { label: string; color: string }> = {
  pending:     { label: 'Pendiente',   color: '#f59e0b' },
  accepted:    { label: 'Aceptada',    color: '#0d9488' },
  in_progress: { label: 'En proceso',  color: '#3b82f6' },
  completed:   { label: 'Completada',  color: '#10b981' },
  rejected:    { label: 'Rechazada',   color: '#6b7280' },
};

const TABS = ['Resumen', 'Contenido', 'Solicitudes', 'Comunicación', 'Config', 'Analytics'];
const CONTENT_STATES = [
  { id: 'preparing', label: 'En preparación', icon: '📋' },
  { id: 'pending', label: 'En pendiente', icon: '⏳' },
  { id: 'planned', label: 'En planificado', icon: '📅' },
  { id: 'published', label: 'Publicado', icon: '📤' },
];

function timeAgo(d: string) {
  const min = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h}h`;
  return `hace ${Math.floor(h / 24)}d`;
}

function ModalPromoCode({ brand, isOpen, onClose, onSave }: { brand: Brand; isOpen: boolean; onClose: () => void; onSave: (code: string) => void }) {
  const [code, setCode] = useState(brand.promo_code || '');

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 0, padding: 28, maxWidth: 400, width: '90%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, margin: 0, fontFamily: fc }}>Editar código de promoción</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, padding: 0 }}>
            <X size={20} />
          </button>
        </div>
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Ej: PROMO2025"
          style={{
            width: '100%',
            padding: '10px 12px',
            background: C.bg1,
            border: `1px solid ${C.border}`,
            borderRadius: 0,
            color: C.text,
            fontSize: 14,
            marginBottom: 20,
            boxSizing: 'border-box',
            outline: 'none',
            fontFamily: f,
          }}
        />
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={() => { setCode(''); onSave(''); }}
            style={{
              flex: 1,
              padding: '10px 16px',
              background: C.bg1,
              border: `1px solid ${C.border}`,
              borderRadius: 0,
              color: C.text,
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
              fontFamily: f,
            }}
          >
            Remover
          </button>
          <button
            onClick={() => { onSave(code); onClose(); }}
            style={{
              flex: 1,
              padding: '10px 16px',
              background: C.accent,
              border: 'none',
              borderRadius: 0,
              color: '#fff',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
              fontFamily: f,
            }}
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalPhotoEditor({
  isOpen,
  onClose,
  post,
  agents,
  onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  post: Post | null;
  agents: Agent[];
  onSave: (agentId: string) => void;
}) {
  const [selectedAgent, setSelectedAgent] = useState(post?.agent_id || '');

  if (!isOpen || !post) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: C.card, borderRadius: 0, maxWidth: 500, width: '90%', maxHeight: '80vh', overflow: 'auto' }}>
        <div style={{ position: 'sticky', top: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: `1px solid ${C.border}`, background: C.card }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: C.text, margin: 0, fontFamily: fc }}>Editar foto</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, padding: 0 }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '20px 24px' }}>
          {/* Preview */}
          <div style={{ marginBottom: 20, borderRadius: 0, overflow: 'hidden', border: `1px solid ${C.border}` }}>
            {post.image_url && <img src={String(post.image_url)} alt="" style={{ width: '100%', height: 'auto', display: 'block' }} />}
          </div>

          {/* Metadata */}
          <div style={{ marginBottom: 24, padding: '12px', background: C.bg1, borderRadius: 0 }}>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>
              Estado: <span style={{ fontWeight: 700, color: C.text }}>{String(post.status).replace(/_/g, ' ')}</span>
            </div>
            <div style={{ fontSize: 12, color: C.muted }}>
              Creado: <span style={{ fontWeight: 700, color: C.text }}>{timeAgo(String(post.created_at))}</span>
            </div>
          </div>

          {/* Agent selector */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: C.muted, marginBottom: 8, fontFamily: fc }}>
              ASIGNAR AGENTE
            </label>
            <select
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                background: C.bg1,
                border: `1px solid ${C.border}`,
                borderRadius: 0,
                color: C.text,
                fontSize: 13,
                cursor: 'pointer',
                fontFamily: f,
                marginBottom: 20,
                outline: 'none',
              }}
            >
              <option value="">-- Sin asignar --</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={onClose}
              style={{
                flex: 1,
                padding: '10px 16px',
                background: C.bg1,
                border: `1px solid ${C.border}`,
                borderRadius: 0,
                color: C.text,
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
                fontFamily: f,
              }}
            >
              Cancelar
            </button>
            <button
              onClick={() => { onSave(selectedAgent); onClose(); }}
              style={{
                flex: 1,
                padding: '10px 16px',
                background: C.accent,
                border: 'none',
                borderRadius: 0,
                color: '#fff',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
                fontFamily: f,
              }}
            >
              Guardar cambios
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── AgentBriefSection ─────────────────────────────────────────────────────────
function AgentBriefSection({
  brief, confidence, confColor, C, f, fc,
}: {
  brief:      AgentBrief;
  confidence: number;
  confColor:  string;
  C:          Record<string, string>;
  f:          string;
  fc:         string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: `1px solid ${C.border}` }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{ width: '100%', padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sparkles size={14} color={C.accent} />
          <span style={{ fontSize: 10, fontWeight: 800, color: C.accent, fontFamily: fc, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Brief del agente</span>
          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', background: '#f0fdf4', color: confColor, border: `1px solid ${confColor}`, fontFamily: fc }}>
            {confidence}% confianza
          </span>
        </span>
        <span style={{ fontSize: 12, color: C.muted, fontFamily: f }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{ padding: '0 20px 16px' }}>
          <p style={{ fontSize: 12, color: C.text, fontFamily: f, marginBottom: 10, lineHeight: 1.5 }}>
            <strong style={{ fontFamily: fc }}>Intención: </strong>{brief.intent}
          </p>
          <p style={{ fontSize: 12, color: C.muted, fontFamily: f, marginBottom: 10, lineHeight: 1.5, fontStyle: 'italic' }}>
            {brief.reasoning}
          </p>
          <div style={{ background: C.bg1, border: `1px solid ${C.border}`, padding: '10px 12px', marginBottom: 10 }}>
            <p style={{ fontSize: 9, fontWeight: 800, color: C.muted, fontFamily: fc, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Prompt Replicate</p>
            <p style={{ fontSize: 12, color: C.text, fontFamily: f, lineHeight: 1.5, margin: 0 }}>{brief.prompt}</p>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            <span style={{ fontSize: 10, fontFamily: fc, padding: '3px 8px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>
              {brief.mode}
            </span>
            <span style={{ fontSize: 10, fontFamily: fc, padding: '3px 8px', background: C.bg1, color: C.muted, border: `1px solid ${C.border}` }}>
              {brief.model}
            </span>
            <span style={{ fontSize: 10, fontFamily: fc, padding: '3px 8px', background: C.bg1, color: C.muted, border: `1px solid ${C.border}` }}>
              guidance {brief.guidance}
            </span>
            {brief.strength !== null && (
              <span style={{ fontSize: 10, fontFamily: fc, padding: '3px 8px', background: C.bg1, color: C.muted, border: `1px solid ${C.border}` }}>
                strength {brief.strength}
              </span>
            )}
          </div>
          {brief.risk_flags.length > 0 && (
            <div>
              <p style={{ fontSize: 9, fontWeight: 800, color: '#b45309', fontFamily: fc, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Flags</p>
              <ul style={{ margin: 0, paddingLeft: 16 }}>
                {brief.risk_flags.map((flag, i) => (
                  <li key={i} style={{ fontSize: 11, color: '#b45309', fontFamily: f, marginBottom: 3 }}>{flag}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ClientProfilePage({ params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = use(params);
  const router = useRouter();

  const [brand, setBrand] = useState<Brand | null>(null);
  const [hrDefaults, setHrDefaults] = useState<HumanReviewConfig | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [tab, setTab] = useState(0);
  const [contentTab, setContentTab] = useState(0);
  const [newNote, setNewNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [promoModalOpen, setPromoModalOpen] = useState(false);
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<Post | null>(null);

  // Comunicaciones
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [chatText, setChatText] = useState('');
  const [sendingChat, setSendingChat] = useState(false);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Solicitudes del cliente
  const [requests, setRequests] = useState<ClientRequest[]>([]);
  const [newRequestOpen, setNewRequestOpen] = useState(false);
  const [newRequest, setNewRequest] = useState({ title: '', description: '', type: 'custom' as string, deadline_at: '' });
  const [creatingRequest, setCreatingRequest] = useState(false);

  // Modal: ver solicitud de cliente + responder
  const [requestModalPost, setRequestModalPost] = useState<Post | null>(null);
  const [workerReplyImage, setWorkerReplyImage] = useState('');
  const [workerReplyCaption, setWorkerReplyCaption] = useState('');
  const [workerReplyNotes, setWorkerReplyNotes] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [brandRes, agentsRes, chatRes, ticketsRes, requestsRes, hrDefaultsRes] = await Promise.all([
          fetch(`/api/worker/clientes/${brandId}`),
          fetch('/api/worker/agents'),
          fetch(`/api/chat/worker?brandId=${brandId}`),
          fetch(`/api/worker/soporte?brandId=${brandId}`),
          fetch(`/api/worker/clientes/${brandId}/solicitudes`),
          fetch('/api/worker/settings/human-review-defaults'),
        ]);

        const brandData = await brandRes.json();
        if (!brandData.brand) { router.push('/worker/clientes'); return; }

        setBrand(brandData.brand);
        setPosts(brandData.posts ?? []);
        setActivity(brandData.activity ?? []);
        setNotes(brandData.notes ?? []);

        const agentsData = await agentsRes.json();
        setAgents(agentsData.agents ?? []);

        const chatData = await chatRes.json().catch(() => ({ messages: [] }));
        setChat(chatData.messages ?? []);

        const ticketsData = await ticketsRes.json().catch(() => ({ tickets: [] }));
        setTickets(ticketsData.tickets ?? []);

        const hrDefaultsData = await hrDefaultsRes.json().catch(() => ({ human_review_defaults: null }));
        setHrDefaults(hrDefaultsData.human_review_defaults ?? null);

        const requestsData = await requestsRes.json().catch(() => ({ requests: [] }));
        setRequests(requestsData.requests ?? []);

        setLoading(false);
      } catch (err) {
        console.error(err);
        toast.error('Error cargando datos');
      }
    }

    load();
  }, [brandId, router]);

  // Scroll al último mensaje cuando cambia el chat o se abre la tab
  useEffect(() => {
    if (tab === 2 && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [chat, tab]);

  async function sendChatMessage() {
    const text = chatText.trim();
    if (!text || sendingChat) return;
    setSendingChat(true);
    try {
      const res = await fetch('/api/chat/worker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand_id: brandId, message: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error');
      setChat((prev) => [...prev, data.message]);
      setChatText('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al enviar');
    } finally {
      setSendingChat(false);
    }
  }

  async function createRequest() {
    if (!newRequest.title.trim() || creatingRequest) return;
    setCreatingRequest(true);
    try {
      const res = await fetch(`/api/worker/clientes/${brandId}/solicitudes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newRequest.title.trim(),
          description: newRequest.description.trim() || null,
          type: newRequest.type,
          deadline_at: newRequest.deadline_at || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error');

      // Recarga lista desde servidor para unificar special + recreation
      const refreshed = await fetch(`/api/worker/clientes/${brandId}/solicitudes`).then((r) => r.json()).catch(() => ({ requests: [] }));
      setRequests(refreshed.requests ?? []);

      toast.success('Solicitud creada');
      setNewRequest({ title: '', description: '', type: 'custom', deadline_at: '' });
      setNewRequestOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al crear solicitud');
    } finally {
      setCreatingRequest(false);
    }
  }

  async function updatePromoCode(code: string) {
    try {
      const res = await fetch(`/api/worker/clientes/${brandId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ promo_code: code || null }),
      });

      if (res.ok) {
        setBrand((prev) => prev ? { ...prev, promo_code: code || undefined } : null);
        toast.success('Código de promoción actualizado');
      } else {
        toast.error('Error al actualizar');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error al actualizar');
    }
  }

  async function updatePhotoAgent(postId: string, agentId: string) {
    try {
      const res = await fetch(`/api/worker/posts/${postId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_id: agentId || null }),
      });

      if (res.ok) {
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId
              ? {
                  ...p,
                  agent_id: agentId || undefined,
                  agent_name: agents.find((a) => a.id === agentId)?.name || undefined,
                }
              : p
          )
        );
        toast.success('Agente actualizado');
      } else {
        toast.error('Error al actualizar');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error al actualizar');
    }
  }

  async function addNote() {
    if (!newNote.trim()) return;
    try {
      const res = await fetch('/api/worker/notas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand_id: brandId, note: newNote }),
      });

      const json = await res.json();
      if (res.ok) {
        setNotes((prev) => [json.note, ...prev]);
        setNewNote('');
        toast.success('Nota añadida');
      } else {
        toast.error(json.error ?? 'Error');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error al añadir nota');
    }
  }

  // Parse ai_explanation JSON safely
  function parseMeta(post: Post): Record<string, unknown> {
    if (!post.ai_explanation) return {};
    try { return JSON.parse(post.ai_explanation); } catch { return {}; }
  }
  const KIND_LABEL: Record<string, string> = {
    promo: 'Promoción / descuento', post_normal: 'Post normal', novedad: 'Novedad / lanzamiento',
    evento: 'Evento', testimonio: 'Testimonio / reseña', tips: 'Tips / consejos',
  };
  const TIMING_LABEL: Record<string, string> = {
    '30min': 'Urgente (30 min)', today: 'Hoy', tomorrow: 'Mañana', week: 'Esta semana', custom: 'Fecha personalizada',
  };

  async function sendWorkerReply() {
    if (!requestModalPost || sendingReply) return;
    if (!workerReplyImage.trim() && !workerReplyCaption.trim()) {
      toast.error('Añade al menos una imagen o un caption');
      return;
    }
    setSendingReply(true);
    try {
      const res = await fetch(`/api/worker/posts/${requestModalPost.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: workerReplyImage.trim() || requestModalPost.image_url || null,
          caption: workerReplyCaption.trim() || null,
          worker_notes: workerReplyNotes.trim() || null,
          status: 'pending',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error');
      setPosts(prev => prev.map(p => p.id === requestModalPost.id ? { ...p, ...data.post } : p));
      toast.success('Propuesta enviada al cliente');
      setRequestModalPost(null);
      setWorkerReplyImage(''); setWorkerReplyCaption(''); setWorkerReplyNotes('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al enviar');
    } finally { setSendingReply(false); }
  }

  const getPostsByState = (state: string) => {
    return posts.filter((p) => p.status === state || (state === 'preparing' && !p.status));
  };

  if (loading) return <div style={{ padding: 40, color: C.muted, fontFamily: f }}>Cargando...</div>;
  if (!brand) return null;

  return (
    <div style={{ padding: '28px 36px', maxWidth: 1200, fontFamily: f }}>
      {/* HEADER */}
      <div style={{ marginBottom: 32 }}>
        <button
          onClick={() => router.push('/worker/clientes')}
          style={{
            background: 'none',
            border: 'none',
            color: C.muted,
            cursor: 'pointer',
            fontSize: 13,
            marginBottom: 16,
            padding: 0,
            fontFamily: f,
          }}
        >
          ← Volver a clientes
        </button>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, marginBottom: 24 }}>
          <div
            style={{
              width: 64,
              height: 64,
              background: C.accent,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: 28,
              fontWeight: 800,
              flexShrink: 0,
            }}
          >
            {brand.name?.charAt(0).toUpperCase() || '?'}
          </div>

          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: C.text, margin: '0 0 8px 0', fontFamily: fc }}>
              {brand.name}
            </h1>
            <p style={{ fontSize: 14, color: C.muted, margin: 0, marginBottom: 12, fontFamily: f }}>
              Plan <strong style={{ color: C.accent }}>{PLAN_META[brand.plan as SubscriptionPlan]?.label ?? brand.plan}</strong>
              {brand.ig_username && ` · @${brand.ig_username}`}
              {brand.created_at && ` · Desde ${new Date(brand.created_at).toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })}`}
            </p>

            {/* CONTACTO */}
            <div style={{ display: 'flex', gap: 16, fontSize: 13, flexWrap: 'wrap' }}>
              {brand.email && (
                <div style={{ color: C.muted }}>
                  Email: <span style={{ color: C.text, fontWeight: 600 }}>{brand.email}</span>
                </div>
              )}
              {brand.phone && (
                <div style={{ color: C.muted }}>
                  Tel: <span style={{ color: C.text, fontWeight: 600 }}>{brand.phone}</span>
                </div>
              )}
            </div>
          </div>

          {/* Accesos rápidos */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Link
              href={`/worker/clientes/${brandId}/biblioteca`}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 14px', background: C.bg1, border: `1px solid ${C.border}`,
                color: C.text, textDecoration: 'none', fontSize: 12, fontWeight: 700,
                fontFamily: fc, textTransform: 'uppercase', letterSpacing: '0.05em',
              }}
            >
              <BookOpen size={14} color={C.accent} /> Biblioteca
            </Link>
            <Link
              href={`/worker/clientes/${brandId}/inspiracion`}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 14px', background: C.bg1, border: `1px solid ${C.border}`,
                color: C.text, textDecoration: 'none', fontSize: 12, fontWeight: 700,
                fontFamily: fc, textTransform: 'uppercase', letterSpacing: '0.05em',
              }}
            >
              <Sparkles size={14} color={C.accent} /> Inspiración
            </Link>
            <Link
              href={`/worker/clientes/${brandId}/plataformas`}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 14px', background: C.bg1, border: `1px solid ${C.border}`,
                color: C.text, textDecoration: 'none', fontSize: 12, fontWeight: 700,
                fontFamily: fc, textTransform: 'uppercase', letterSpacing: '0.05em',
              }}
            >
              <Share2 size={14} color={C.accent} /> Plataformas
            </Link>
          </div>
        </div>
      </div>

      {/* TABS */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 28, borderBottom: `1px solid ${C.border}` }}>
        {TABS.map((t, i) => (
          <button
            key={t}
            onClick={() => { setTab(i); setContentTab(0); }}
            style={{
              padding: '12px 20px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: tab === i ? 700 : 500,
              color: tab === i ? C.accent : C.muted,
              borderBottom: tab === i ? `2px solid ${C.accent}` : '2px solid transparent',
              fontFamily: f,
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* TAB 0: RESUMEN */}
      {tab === 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          {/* INFORMACIÓN DE PAGO */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, padding: 24, borderRadius: 0 }}>
            <h3 style={{ fontSize: 12, fontWeight: 700, color: C.muted, margin: '0 0 16px 0', textTransform: 'uppercase', letterSpacing: 0.5, fontFamily: fc }}>
              Información de Pago
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ paddingBottom: 12, borderBottom: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 4, fontFamily: fc }}>PLAN</div>
                <div style={{ fontSize: 14, color: C.text, fontWeight: 700, fontFamily: f }}>
                  {String(brand.plan).charAt(0).toUpperCase() + String(brand.plan).slice(1)}
                </div>
              </div>

              <div style={{ paddingBottom: 12, borderBottom: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 4, fontFamily: fc }}>PRECIO MENSUAL</div>
                <div style={{ fontSize: 14, color: C.text, fontWeight: 700, fontFamily: f }}>
                  {brand.price ? `€${brand.price.toFixed(2)}` : '—'}
                </div>
              </div>

              <div style={{ paddingBottom: 12, borderBottom: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 4, fontFamily: fc }}>PRÓXIMA RENOVACIÓN</div>
                <div style={{ fontSize: 14, color: C.text, fontWeight: 700, fontFamily: f }}>
                  {brand.renewal_date
                    ? new Date(String(brand.renewal_date)).toLocaleDateString('es-ES', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })
                    : '—'}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 4, fontFamily: fc }}>CÓDIGO DE PROMOCIÓN</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ fontSize: 14, color: C.text, fontWeight: 700, fontFamily: f, flex: 1 }}>
                    {brand.promo_code ? `${brand.promo_code}` : 'Sin código'}
                  </div>
                  <button
                    onClick={() => setPromoModalOpen(true)}
                    style={{
                      padding: '6px 14px',
                      background: C.bg1,
                      border: `1px solid ${C.border}`,
                      borderRadius: 0,
                      color: C.text,
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: 'pointer',
                      fontFamily: f,
                    }}
                  >
                    Editar
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ESTADÍSTICAS */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, padding: 24, borderRadius: 0 }}>
            <h3 style={{ fontSize: 12, fontWeight: 700, color: C.muted, margin: '0 0 16px 0', textTransform: 'uppercase', letterSpacing: 0.5, fontFamily: fc }}>
              Estadísticas
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                ['Publicados', posts.filter((p) => p.status === 'published').length],
                ['Pendientes', posts.filter((p) => p.status === 'pending').length],
                ['Aprobados', posts.filter((p) => p.status === 'approved').length],
                ['En preparación', posts.filter((p) => p.status === 'preparing').length],
              ].map(([label, count]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12, borderBottom: `1px solid ${C.border}` }}>
                  <span style={{ fontSize: 13, color: C.muted, fontFamily: f }}>{label}</span>
                  <span style={{ fontSize: 16, fontWeight: 800, color: C.text, fontFamily: f }}>{count}</span>
                </div>
              ))}

              {brand.meta_token_expires_at && new Date(String(brand.meta_token_expires_at)) < new Date(Date.now() + 3 * 86400000) && (
                <div style={{ marginTop: 8, padding: 12, background: 'rgba(239,68,68,0.08)', border: `1px solid rgba(239,68,68,0.3)`, borderRadius: 0, fontSize: 12, color: '#991b1b', fontFamily: f }}>
                  ⚠️ Token de Instagram expira pronto
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 1: CONTENIDO */}
      {tab === 1 && (
        <div>
          {/* ── POSTS EN SOLICITUD (status=request) ──────────────────── */}
          {posts.filter(p => p.status === 'request').length > 0 && (
            <div style={{ background: C.card, border: `1px solid ${C.accent}`, marginBottom: 28 }}>
              <div style={{ padding: '14px 22px', background: `${C.accent}10`, borderBottom: `1px solid ${C.accent}40`, display: 'flex', alignItems: 'center', gap: 10 }}>
                <Upload size={15} color={C.accent} />
                <h3 style={{ fontSize: 13, fontWeight: 800, color: C.accent, margin: 0, fontFamily: fc, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Solicitudes pendientes de respuesta
                </h3>
                <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 800, padding: '2px 8px', background: C.accent, color: '#fff', fontFamily: fc }}>
                  {posts.filter(p => p.status === 'request').length}
                </span>
              </div>
              <div>
                {posts.filter(p => p.status === 'request').map((post, i, arr) => {
                  const meta = parseMeta(post);
                  const kind = meta.request_kind as string | undefined;
                  const desc = meta.global_description as string | undefined;
                  const timing = meta.timing_preset as string | undefined;
                  const urgency = meta.urgency as string | undefined;
                  const perImage = meta.per_image as Array<{media_url?: string; note?: string}> | undefined;
                  const extraGenerate = meta.extra_to_generate as number | undefined;
                  return (
                    <div key={post.id} style={{ padding: '16px 22px', borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : 'none', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                      <div style={{ width: 72, height: 72, flexShrink: 0, background: C.bg1, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
                        {post.image_url
                          ? <img src={String(post.image_url)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>📋</div>
                        }
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                          {kind && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', fontFamily: fc, textTransform: 'uppercase' }}>{KIND_LABEL[kind] ?? kind}</span>}
                          {urgency === 'urgente' && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', fontFamily: fc, textTransform: 'uppercase' }}>⚡ Urgente</span>}
                          {timing && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', background: C.bg1, color: C.muted, border: `1px solid ${C.border}`, fontFamily: fc, textTransform: 'uppercase' }}>{TIMING_LABEL[timing] ?? timing}</span>}
                          {typeof extraGenerate === 'number' && extraGenerate > 0 && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', fontFamily: fc, textTransform: 'uppercase' }}>+{extraGenerate} a generar</span>}
                        </div>
                        {desc && <p style={{ fontSize: 13, color: C.text, lineHeight: 1.5, margin: '0 0 6px 0', fontFamily: f }}>{desc}</p>}
                        {Array.isArray(perImage) && perImage.length > 0 && (
                          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                            {perImage.slice(0, 5).map((pi, idx) => pi.media_url ? (
                              <div key={idx} style={{ position: 'relative' }}>
                                <img src={pi.media_url} alt="" style={{ width: 40, height: 40, objectFit: 'cover', border: `1px solid ${C.border}` }} />
                                {pi.note && <div title={pi.note} style={{ position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, background: C.accent, borderRadius: '50%' }} />}
                              </div>
                            ) : null)}
                          </div>
                        )}
                        <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>{timeAgo(post.created_at)}</div>
                      </div>
                      <button
                        onClick={() => { setRequestModalPost(post); setWorkerReplyCaption(post.caption ?? ''); setWorkerReplyImage(post.image_url ? String(post.image_url) : ''); }}
                        style={{ flexShrink: 0, padding: '9px 18px', background: C.accent, color: '#fff', border: 'none', fontFamily: fc, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer' }}
                      >
                        Responder →
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── SOLICITUDES DEL CLIENTE ──────────────────────────────── */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, marginBottom: 28 }}>
            <div style={{ padding: '16px 22px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Flag size={16} color={C.accent} />
                <h3 style={{ fontSize: 13, fontWeight: 800, color: C.text, margin: 0, fontFamily: fc, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Solicitudes del cliente
                </h3>
                {(() => {
                  const pending = requests.filter((r) => r.status === 'pending' || r.status === 'in_progress' || r.status === 'accepted').length;
                  return pending > 0 ? (
                    <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 7px', background: C.accent, color: '#fff', fontFamily: fc }}>
                      {pending} activas
                    </span>
                  ) : null;
                })()}
              </div>
              <button
                onClick={() => setNewRequestOpen(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 16px', background: C.accent, color: '#fff', border: 'none',
                  fontFamily: fc, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em',
                  cursor: 'pointer',
                }}
              >
                <Plus size={13} /> Nueva solicitud
              </button>
            </div>

            {requests.length === 0 ? (
              <div style={{ padding: '24px 22px', fontSize: 13, color: C.muted, textAlign: 'center' }}>
                Sin solicitudes de este cliente. Crea una en su nombre con el botón de arriba.
              </div>
            ) : (
              <div>
                {requests.slice(0, 6).map((r, i) => {
                  const st = REQUEST_STATUS[r.status] ?? { label: r.status, color: C.muted };
                  const isClosed = r.status === 'completed' || r.status === 'rejected';
                  return (
                    <div
                      key={r.id}
                      style={{
                        padding: '14px 22px',
                        borderBottom: i < Math.min(requests.length, 6) - 1 ? `1px solid ${C.border}` : 'none',
                        opacity: isClosed ? 0.6 : 1,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 4 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                            <span style={{
                              fontSize: 9, fontWeight: 800, padding: '2px 6px',
                              background: r.kind === 'recreation' ? '#ede9fe' : C.bg1,
                              color: r.kind === 'recreation' ? '#7c3aed' : C.muted,
                              fontFamily: fc, textTransform: 'uppercase', letterSpacing: '0.05em',
                              border: `1px solid ${r.kind === 'recreation' ? '#ddd6fe' : C.border}`,
                            }}>
                              {r.kind === 'recreation' ? 'Recreación' : r.type ?? 'Solicitud'}
                            </span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {r.title ?? '—'}
                            </span>
                          </div>
                          {r.description && (
                            <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                              {r.description}
                            </div>
                          )}
                        </div>
                        <span style={{
                          fontSize: 10, fontWeight: 800, padding: '3px 8px', flexShrink: 0,
                          color: st.color, background: `${st.color}15`, border: `1px solid ${st.color}44`,
                          fontFamily: fc, textTransform: 'uppercase', letterSpacing: '0.05em',
                        }}>
                          {st.label}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>
                        {timeAgo(r.created_at)}
                        {r.deadline_at && ` · Entrega ${new Date(r.deadline_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`}
                      </div>
                    </div>
                  );
                })}
                {requests.length > 6 && (
                  <div style={{ padding: '10px 22px', fontSize: 11, color: C.muted, textAlign: 'center', background: C.bg1 }}>
                    + {requests.length - 6} solicitudes más
                  </div>
                )}
              </div>
            )}
          </div>

          {/* SUB-TABS POR ESTADO */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 24, borderBottom: `1px solid ${C.border}`, paddingBottom: 0 }}>
            {CONTENT_STATES.map((state, i) => (
              <button
                key={state.id}
                onClick={() => setContentTab(i)}
                style={{
                  padding: '10px 16px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: contentTab === i ? 700 : 500,
                  color: contentTab === i ? C.accent : C.muted,
                  borderBottom: contentTab === i ? `2px solid ${C.accent}` : '2px solid transparent',
                  fontFamily: f,
                }}
              >
                {state.icon} {state.label}
              </button>
            ))}
          </div>

          {/* GRID DE FOTOS */}
          {getPostsByState(CONTENT_STATES[contentTab].id).length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: C.muted, fontFamily: f }}>
              Sin fotos en este estado
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 }}>
              {getPostsByState(CONTENT_STATES[contentTab].id).map((post) => (
                <div
                  key={post.id}
                  onClick={() => { setSelectedPhoto(post); setPhotoModalOpen(true); }}
                  style={{
                    background: C.card,
                    border: `1px solid ${C.border}`,
                    borderRadius: 0,
                    overflow: 'hidden',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    boxShadow: 'none',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 12px rgba(15, 118, 110, 0.1)`; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
                >
                  <div style={{ height: 140, background: C.bg1, overflow: 'hidden' }}>
                    {post.image_url && <img src={String(post.image_url)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                  </div>
                  <div style={{ padding: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.accent, marginBottom: 6, textTransform: 'uppercase', fontFamily: fc }}>
                      {String(post.status).replace(/_/g, ' ')}
                    </div>
                    <div style={{ fontSize: 12, color: C.muted, marginBottom: 6, fontFamily: f }}>
                      {post.agent_name ? `Agente: ${post.agent_name}` : 'Sin asignar'}
                    </div>
                    <div style={{ fontSize: 11, color: C.muted, fontFamily: f }}>
                      {timeAgo(String(post.created_at))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: SOLICITUDES */}
      {tab === 2 && (
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 800, marginBottom: 16, fontFamily: fc, textTransform: 'uppercase', color: C.text }}>
            Solicitudes del cliente
          </h3>
          {requests.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', border: `1px solid ${C.border}`, background: C.card, color: C.muted, fontSize: 13 }}>
              Sin solicitudes
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {requests.map((req) => {
                const st = REQUEST_STATUS[req.status] ?? { label: req.status, color: C.muted };
                return (
                  <div key={req.id} style={{ border: `1px solid ${C.border}`, background: C.card, padding: '16px 20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div>
                        <span style={{ fontSize: 14, fontWeight: 700, color: C.text, fontFamily: f }}>{req.title ?? 'Recreación'}</span>
                        <span style={{ marginLeft: 10, fontSize: 10, padding: '2px 8px', background: `${st.color}18`, color: st.color, fontWeight: 700, textTransform: 'uppercase' }}>{st.label}</span>
                      </div>
                      <span style={{ fontSize: 11, color: C.muted }}>{timeAgo(req.created_at)}</span>
                    </div>
                    {req.description && <p style={{ fontSize: 13, color: C.muted, margin: '0 0 10px', lineHeight: 1.5 }}>{req.description}</p>}
                    {req.worker_response && (
                      <div style={{ background: C.bg2, borderLeft: `2px solid ${C.accent}`, padding: '8px 12px', fontSize: 12, color: C.accent, marginBottom: 10 }}>
                        Respuesta: {req.worker_response}
                      </div>
                    )}
                    <StatusProgressBar currentStatus={req.status} compact />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: COMUNICACIÓN (chat + notas) */}
      {tab === 3 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24 }}>
          {/* Chat con cliente */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 0, display: 'flex', flexDirection: 'column', height: 560 }}>
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
              <MessageCircle size={16} color={C.accent} />
              <h3 style={{ fontSize: 13, fontWeight: 800, color: C.text, margin: 0, fontFamily: fc, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Chat con cliente
              </h3>
              <span style={{ fontSize: 11, color: C.muted, marginLeft: 'auto' }}>{chat.length} mensajes</span>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 10, background: C.bg1 }}>
              {chat.length === 0 ? (
                <div style={{ margin: 'auto', color: C.muted, fontSize: 13, textAlign: 'center' }}>
                  Todavía no hay mensajes con este cliente.
                  <br />
                  Escribe uno abajo para empezar.
                </div>
              ) : chat.map((m) => {
                const isClient = m.sender_type === 'client';
                return (
                  <div key={m.id} style={{ display: 'flex', justifyContent: isClient ? 'flex-start' : 'flex-end' }}>
                    <div
                      style={{
                        maxWidth: '78%',
                        padding: '10px 14px',
                        background: isClient ? '#e5e7eb' : C.accent,
                        color: isClient ? C.text : '#ffffff',
                        fontSize: 13,
                        lineHeight: 1.5,
                        border: `1px solid ${isClient ? '#d1d5db' : C.accent}`,
                      }}
                    >
                      <div style={{ fontSize: 10, fontWeight: 800, color: isClient ? C.muted : 'rgba(255,255,255,0.7)', marginBottom: 4, fontFamily: fc, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {isClient ? (brand.name ?? 'Cliente') : 'Tú'}
                      </div>
                      <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.message}</div>
                      <div style={{ fontSize: 10, color: isClient ? C.muted : 'rgba(255,255,255,0.6)', marginTop: 4, textAlign: 'right' }}>
                        {new Date(m.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>

            <div style={{ padding: 14, borderTop: `1px solid ${C.border}`, display: 'flex', gap: 8 }}>
              <textarea
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendChatMessage();
                  }
                }}
                placeholder="Escribe una respuesta…"
                rows={2}
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  background: C.bg1,
                  border: `1px solid ${C.border}`,
                  borderRadius: 0,
                  color: C.text,
                  fontSize: 13,
                  resize: 'none',
                  outline: 'none',
                  fontFamily: f,
                }}
              />
              <button
                onClick={sendChatMessage}
                disabled={!chatText.trim() || sendingChat}
                style={{
                  padding: '10px 18px',
                  background: C.accent,
                  color: '#fff',
                  border: 'none',
                  borderRadius: 0,
                  fontWeight: 800,
                  fontSize: 12,
                  fontFamily: fc,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  cursor: !chatText.trim() || sendingChat ? 'not-allowed' : 'pointer',
                  opacity: !chatText.trim() || sendingChat ? 0.5 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Send size={13} /> {sendingChat ? 'Enviando…' : 'Enviar'}
              </button>
            </div>
          </div>

          {/* Tickets de soporte */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 0, display: 'flex', flexDirection: 'column', height: 560 }}>
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
              <LifeBuoy size={16} color={C.accent} />
              <h3 style={{ fontSize: 13, fontWeight: 800, color: C.text, margin: 0, fontFamily: fc, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Tickets de soporte
              </h3>
              <span style={{ fontSize: 11, color: C.muted, marginLeft: 'auto' }}>{tickets.length}</span>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              {tickets.length === 0 ? (
                <div style={{ padding: 24, color: C.muted, fontSize: 13, textAlign: 'center' }}>
                  Sin tickets de este cliente.
                </div>
              ) : tickets.map((t) => {
                const isActive = t.status === 'open' || t.status === 'in_progress';
                const statusColor = isActive ? C.accent : C.muted;
                const statusLabel =
                  t.status === 'open' ? 'Abierto' :
                  t.status === 'in_progress' ? 'En proceso' :
                  t.status === 'resolved' ? 'Resuelto' : 'Cerrado';
                return (
                  <Link key={t.id} href={`/worker/inbox?tab=soporte&ticketId=${t.id}`} style={{ textDecoration: 'none' }}>
                    <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}`, cursor: 'pointer', opacity: isActive ? 1 : 0.6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: C.text, flex: 1 }}>{t.subject}</span>
                        <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 6px', background: `${statusColor}22`, color: statusColor, fontFamily: fc, textTransform: 'uppercase', letterSpacing: '0.05em', border: `1px solid ${statusColor}44` }}>
                          {statusLabel}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: C.muted }}>
                        {t.priority === 'urgent' && '⚠️ '}{timeAgo(t.created_at)}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: CONFIG */}
      {tab === 4 && (
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 800, marginBottom: 16, fontFamily: fc, textTransform: 'uppercase', color: C.text }}>
            Configuración del cliente
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 24 }}>
            {/* Brand info */}
            <div style={{ border: `1px solid ${C.border}`, background: C.card, padding: 20 }}>
              <h4 style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12, fontFamily: fc }}>Datos del negocio</h4>
              {[
                { label: 'Sector', value: String(brand.sector ?? '—') },
                { label: 'Plan', value: PLAN_META[brand.plan as SubscriptionPlan]?.label ?? brand.plan },
                { label: 'Desde', value: brand.created_at ? new Date(brand.created_at).toLocaleDateString('es-ES') : '—' },
                { label: 'Token Meta', value: brand.meta_token_expires_at ? `Caduca ${new Date(brand.meta_token_expires_at).toLocaleDateString('es-ES')}` : 'No conectado' },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${C.border}`, fontSize: 13, fontFamily: f }}>
                  <span style={{ color: C.muted }}>{label}</span>
                  <span style={{ color: C.text, fontWeight: 600 }}>{value}</span>
                </div>
              ))}
            </div>

            {/* Quick links */}
            <div style={{ border: `1px solid ${C.border}`, background: C.card, padding: 20 }}>
              <h4 style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12, fontFamily: fc }}>Recursos</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { href: `/worker/clientes/${brandId}/biblioteca`, label: 'Biblioteca de fotos', icon: BookOpen },
                  { href: `/worker/clientes/${brandId}/inspiracion`, label: 'Referencias de inspiración', icon: Sparkles },
                  { href: `/worker/clientes/${brandId}/plataformas`, label: 'Plataformas conectadas', icon: Share2 },
                ].map(({ href, label, icon: Icon }) => (
                  <Link key={href} href={href} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                    border: `1px solid ${C.border}`, background: C.bg1, textDecoration: 'none',
                    color: C.text, fontSize: 13, fontWeight: 600, fontFamily: f,
                  }}>
                    <Icon size={15} style={{ color: C.accent }} /> {label}
                  </Link>
                ))}
              </div>
            </div>

            {/* Human review config */}
            <HumanReviewCard
              brandId={brandId}
              initialConfig={brand.human_review_config ?? null}
              defaults={hrDefaults}
            />
          </div>

          {/* Internal notes */}
          <h3 style={{ fontSize: 14, fontWeight: 800, marginBottom: 12, fontFamily: fc, textTransform: 'uppercase', color: C.text }}>
            Notas internas
          </h3>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, padding: 20, marginBottom: 16 }}>
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Escribe una nota interna (no visible para el cliente)..."
              rows={3}
              style={{ width: '100%', background: C.bg1, border: `1px solid ${C.border}`, padding: '10px 12px', color: C.text, fontSize: 13, resize: 'vertical', outline: 'none', boxSizing: 'border-box', fontFamily: f, marginBottom: 10 }}
            />
            <button onClick={addNote} style={{ padding: '8px 16px', background: C.accent, color: '#fff', border: 'none', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: f }}>
              + Añadir nota
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {notes.map((note) => (
              <div key={note.id} style={{ background: C.card, border: `1px solid ${note.is_pinned ? C.accent : C.border}`, padding: 14, borderLeft: note.is_pinned ? `3px solid ${C.accent}` : '3px solid transparent' }}>
                {note.is_pinned && <div style={{ fontSize: 10, fontWeight: 700, color: C.accent, marginBottom: 6, textTransform: 'uppercase', fontFamily: fc }}>Fijada</div>}
                <div style={{ fontSize: 13, color: C.text, lineHeight: 1.5, marginBottom: 6, fontFamily: f }}>{note.note}</div>
                <div style={{ fontSize: 11, color: C.muted, fontFamily: f }}>{note.workers?.full_name || 'Worker'} · {timeAgo(note.created_at)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: ANALYTICS */}
      {tab === 5 && (
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 800, marginBottom: 16, fontFamily: fc, textTransform: 'uppercase', color: C.text }}>
            Analytics del cliente
          </h3>
          {/* Activity timeline */}
          <div style={{ border: `1px solid ${C.border}`, background: C.card, marginBottom: 24 }}>
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}`, background: C.bg1 }}>
              <h4 style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0, fontFamily: fc }}>Actividad reciente</h4>
            </div>
            <div style={{ padding: '16px 20px' }}>
              {activity.length === 0 ? (
                <p style={{ color: C.muted, fontSize: 13, margin: 0, fontFamily: f }}>Sin actividad registrada.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {activity.map((event, idx) => (
                    <div key={event.id} style={{ padding: '10px 0', borderBottom: idx !== activity.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                      <div style={{ fontSize: 13, color: C.text, fontWeight: 600, fontFamily: f }}>{event.action.replace(/_/g, ' ')}</div>
                      <div style={{ fontSize: 11, color: C.muted, fontFamily: f }}>{timeAgo(event.created_at)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Posts summary */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px', background: C.border, border: `1px solid ${C.border}` }}>
            {[
              { label: 'Total posts', value: posts.length },
              { label: 'Publicados', value: posts.filter(p => p.status === 'published').length },
              { label: 'Pendientes', value: posts.filter(p => p.status === 'pending' || p.status === 'request').length },
              { label: 'Solicitudes', value: requests.length },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: C.card, padding: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: C.accent, fontFamily: fc }}>{value}</div>
                <div style={{ fontSize: 10, color: C.muted, marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: f }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODALES */}
      <ModalPromoCode
        brand={brand}
        isOpen={promoModalOpen}
        onClose={() => setPromoModalOpen(false)}
        onSave={updatePromoCode}
      />

      {photoModalOpen && selectedPhoto && (
        <WorkerCockpit
          post={{
            id:               selectedPhoto.id,
            brand_id:         String(selectedPhoto.brand_id ?? brand?.id ?? ''),
            image_url:        selectedPhoto.image_url ?? null,
            edited_image_url: selectedPhoto.edited_image_url ?? null,
            caption:          selectedPhoto.caption ?? null,
            hashtags:         selectedPhoto.hashtags ?? null,
            format:           selectedPhoto.format ?? null,
            status:           selectedPhoto.status,
            ai_explanation:   selectedPhoto.ai_explanation ?? null,
            agent_brief:      (selectedPhoto.agent_brief as Record<string, unknown> | null) ?? null,
            created_at:       selectedPhoto.created_at,
          }}
          brandName={brand?.name}
          onClose={() => setPhotoModalOpen(false)}
        />
      )}

      {/* MODAL NUEVA SOLICITUD */}
      {newRequestOpen && (
        <div
          onClick={() => !creatingRequest && setNewRequestOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: C.bg, border: `1px solid ${C.border}`, width: 520, maxWidth: '92vw', padding: 32 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
              <div style={{ width: 40, height: 40, background: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Flag size={18} color="#fff" />
              </div>
              <h2 style={{ fontFamily: fc, fontSize: 22, fontWeight: 900, margin: 0, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                Nueva solicitud
              </h2>
            </div>
            <p style={{ fontSize: 13, color: C.muted, margin: '0 0 22px', lineHeight: 1.5 }}>
              Crea una solicitud en nombre de <strong style={{ color: C.text }}>{brand.name}</strong>. Se registra como aceptada y asignada a ti.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: C.muted, fontFamily: fc, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                  Título
                </label>
                <input
                  type="text"
                  value={newRequest.title}
                  onChange={(e) => setNewRequest((s) => ({ ...s, title: e.target.value }))}
                  placeholder="Ej: Campaña Black Friday"
                  style={{
                    width: '100%', padding: '11px 14px', background: C.bg, border: `1px solid ${C.border}`,
                    borderRadius: 0, color: C.text, fontSize: 14, fontFamily: f, outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: C.muted, fontFamily: fc, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                  Tipo
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                  {REQUEST_TYPES.map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => setNewRequest((s) => ({ ...s, type: opt.key }))}
                      style={{
                        padding: '10px 8px',
                        background: newRequest.type === opt.key ? C.accent : C.bg,
                        color: newRequest.type === opt.key ? '#fff' : C.muted,
                        border: `1px solid ${newRequest.type === opt.key ? C.accent : C.border}`,
                        fontFamily: fc, fontSize: 11, fontWeight: 800,
                        textTransform: 'uppercase', letterSpacing: '0.04em', cursor: 'pointer',
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: C.muted, fontFamily: fc, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                  Descripción <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(opcional)</span>
                </label>
                <textarea
                  value={newRequest.description}
                  onChange={(e) => setNewRequest((s) => ({ ...s, description: e.target.value }))}
                  rows={4}
                  placeholder="Detalles, referencias, tono, público objetivo…"
                  style={{
                    width: '100%', padding: '11px 14px', background: C.bg, border: `1px solid ${C.border}`,
                    borderRadius: 0, color: C.text, fontSize: 14, fontFamily: f, outline: 'none', boxSizing: 'border-box',
                    resize: 'vertical',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: C.muted, fontFamily: fc, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                  Fecha de entrega <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(opcional)</span>
                </label>
                <input
                  type="date"
                  value={newRequest.deadline_at}
                  onChange={(e) => setNewRequest((s) => ({ ...s, deadline_at: e.target.value }))}
                  style={{
                    width: '100%', padding: '11px 14px', background: C.bg, border: `1px solid ${C.border}`,
                    borderRadius: 0, color: C.text, fontSize: 14, fontFamily: f, outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 22 }}>
              <button
                onClick={() => setNewRequestOpen(false)}
                disabled={creatingRequest}
                style={{
                  padding: '12px 22px', background: 'transparent', color: C.muted,
                  border: `1px solid ${C.border}`, cursor: 'pointer',
                  fontFamily: fc, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: 12,
                }}
              >
                Cancelar
              </button>
              <button
                onClick={createRequest}
                disabled={!newRequest.title.trim() || creatingRequest}
                style={{
                  padding: '12px 26px', background: C.accent, color: '#fff', border: 'none',
                  cursor: !newRequest.title.trim() || creatingRequest ? 'not-allowed' : 'pointer',
                  opacity: !newRequest.title.trim() || creatingRequest ? 0.5 : 1,
                  fontFamily: fc, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: 12,
                }}
              >
                {creatingRequest ? 'Creando…' : 'Crear solicitud'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Ver solicitud + Responder ─────────────────────────── */}
      {requestModalPost && (() => {
        const meta = parseMeta(requestModalPost);
        const kind = meta.request_kind as string | undefined;
        const desc = meta.global_description as string | undefined;
        const timing = meta.timing_preset as string | undefined;
        const urgency = meta.urgency as string | undefined;
        const preferredDate = meta.preferred_date as string | undefined;
        const extraNotes = meta.extra_notes as string | undefined;
        const proposedCaption = meta.proposed_caption as string | undefined;
        const perImage = meta.per_image as Array<{media_url?: string; note?: string}> | undefined;
        const extraGenerate = meta.extra_to_generate as number | undefined;
        const globalInspirationIds = meta.global_inspiration_ids as string[] | undefined;
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div style={{ background: C.card, width: '100%', maxWidth: 760, maxHeight: '92vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '18px 24px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: C.card, zIndex: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Upload size={16} color={C.accent} />
                  <h2 style={{ fontSize: 15, fontWeight: 800, color: C.text, margin: 0, fontFamily: fc, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Solicitud del cliente</h2>
                  {urgency === 'urgente' && <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', fontFamily: fc }}>⚡ URGENTE</span>}
                </div>
                <button onClick={() => setRequestModalPost(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, padding: 4 }}><X size={20} /></button>
              </div>
              {/* ── Image comparison: original vs generated ──────────────────── */}
              {(requestModalPost.image_url || requestModalPost.edited_image_url) && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ padding: '14px 20px', borderRight: `1px solid ${C.border}` }}>
                    <p style={{ fontSize: 9, fontWeight: 800, color: C.muted, fontFamily: fc, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Original del cliente</p>
                    {requestModalPost.image_url ? (
                      <img src={String(requestModalPost.image_url)} alt="Original" style={{ width: '100%', maxHeight: 200, objectFit: 'contain', display: 'block', background: C.bg1, border: `1px solid ${C.border}` }} />
                    ) : (
                      <div style={{ height: 120, background: C.bg1, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: C.muted, fontFamily: f }}>Sin imagen original</div>
                    )}
                  </div>
                  <div style={{ padding: '14px 20px' }}>
                    <p style={{ fontSize: 9, fontWeight: 800, color: C.accent, fontFamily: fc, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Versión generada</p>
                    {requestModalPost.edited_image_url ? (
                      <img src={String(requestModalPost.edited_image_url)} alt="Versión generada" style={{ width: '100%', maxHeight: 200, objectFit: 'contain', display: 'block', background: C.bg1, border: `1px solid ${C.border}` }} />
                    ) : (
                      <div style={{ height: 120, background: C.bg1, border: `2px dashed ${C.border}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                        <div style={{ width: 28, height: 28, border: `2px solid ${C.muted}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: C.muted }}>⟳</div>
                        <span style={{ fontSize: 11, color: C.muted, fontFamily: f }}>Pendiente de generar</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {/* ── Agent Brief (Visual Strategist) — collapsible ──────────────── */}
              {requestModalPost.agent_brief && (() => {
                const brief = requestModalPost.agent_brief!;
                const confidence = Math.round(brief.confidence * 100);
                const confColor = confidence >= 75 ? '#0F766E' : confidence >= 50 ? '#b45309' : '#dc2626';
                return (
                  <AgentBriefSection brief={brief} confidence={confidence} confColor={confColor} C={C} f={f} fc={fc} />
                );
              })()}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
                {/* LEFT: lo que pide el cliente */}
                <div style={{ padding: '20px 24px', borderRight: `1px solid ${C.border}` }}>
                  <p style={{ fontSize: 10, fontWeight: 800, color: C.muted, fontFamily: fc, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>Lo que pide el cliente</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                    {kind && <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', fontFamily: fc, textTransform: 'uppercase' }}>{KIND_LABEL[kind] ?? kind}</span>}
                    {timing && <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', background: C.bg1, color: C.muted, border: `1px solid ${C.border}`, fontFamily: fc, textTransform: 'uppercase' }}>{TIMING_LABEL[timing] ?? timing}</span>}
                    {preferredDate && <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', background: C.bg1, color: C.text, border: `1px solid ${C.border}`, fontFamily: f }}>{new Date(preferredDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
                  </div>
                  {desc && (
                    <div style={{ marginBottom: 14 }}>
                      <p style={{ fontSize: 10, fontWeight: 700, color: C.muted, fontFamily: fc, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Descripción</p>
                      <p style={{ fontSize: 13, color: C.text, lineHeight: 1.6, fontFamily: f, padding: '10px 12px', background: C.bg1, border: `1px solid ${C.border}`, margin: 0 }}>{desc}</p>
                    </div>
                  )}
                  {proposedCaption && (
                    <div style={{ marginBottom: 14 }}>
                      <p style={{ fontSize: 10, fontWeight: 700, color: C.muted, fontFamily: fc, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Caption sugerido</p>
                      <p style={{ fontSize: 13, color: C.text, lineHeight: 1.6, fontFamily: f, padding: '10px 12px', background: '#f0fdf4', border: '1px solid #bbf7d0', margin: 0 }}>{proposedCaption}</p>
                    </div>
                  )}
                  {extraNotes && (
                    <div style={{ marginBottom: 14 }}>
                      <p style={{ fontSize: 10, fontWeight: 700, color: C.muted, fontFamily: fc, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Notas extra</p>
                      <p style={{ fontSize: 13, color: C.text, lineHeight: 1.6, fontFamily: f, padding: '10px 12px', background: '#fffbeb', border: '1px solid #fde68a', margin: 0 }}>{extraNotes}</p>
                    </div>
                  )}
                  {((Array.isArray(perImage) && perImage.length > 0) || (typeof extraGenerate === 'number' && extraGenerate > 0)) && (
                    <div style={{ marginBottom: 14 }}>
                      <p style={{ fontSize: 10, fontWeight: 700, color: C.muted, fontFamily: fc, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                        Fotos enviadas{typeof extraGenerate === 'number' && extraGenerate > 0 ? ` · +${extraGenerate} a generar` : ''}
                      </p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {(perImage ?? []).map((pi, idx) => pi.media_url ? (
                          <div key={idx} style={{ position: 'relative' }}>
                            <img src={pi.media_url} alt="" style={{ width: 80, height: 80, objectFit: 'cover', border: `1px solid ${C.border}`, display: 'block' }} />
                            {pi.note && <div title={pi.note} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '3px 5px', background: 'rgba(0,0,0,0.7)', fontSize: 9, color: '#fff', fontFamily: f, lineHeight: 1.3 }}>{pi.note}</div>}
                          </div>
                        ) : null)}
                        {typeof extraGenerate === 'number' && Array.from({ length: extraGenerate }).map((_, i) => (
                          <div key={`gen-${i}`} style={{ width: 80, height: 80, border: `2px dashed ${C.accent}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: C.accent, fontFamily: fc, fontWeight: 700 }}>IA</div>
                        ))}
                      </div>
                    </div>
                  )}
                  {Array.isArray(globalInspirationIds) && globalInspirationIds.length > 0 && (
                    <div>
                      <p style={{ fontSize: 10, fontWeight: 700, color: C.muted, fontFamily: fc, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Referencias de inspiración</p>
                      <p style={{ fontSize: 12, color: C.muted, fontFamily: f, margin: 0 }}>{globalInspirationIds.length} referencia{globalInspirationIds.length > 1 ? 's' : ''} seleccionada{globalInspirationIds.length > 1 ? 's' : ''}</p>
                    </div>
                  )}
                </div>
                {/* RIGHT: respuesta del worker */}
                <div style={{ padding: '20px 24px' }}>
                  <p style={{ fontSize: 10, fontWeight: 800, color: C.accent, fontFamily: fc, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>Tu respuesta</p>
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: C.muted, fontFamily: fc, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>URL imagen / vídeo generado</label>
                    <input type="text" value={workerReplyImage} onChange={e => setWorkerReplyImage(e.target.value)}
                      placeholder="https://... (pega la URL del resultado)"
                      style={{ width: '100%', padding: '10px 12px', border: `1px solid ${C.border}`, fontFamily: f, fontSize: 13, color: C.text, outline: 'none', boxSizing: 'border-box' }} />
                    {workerReplyImage.trim() && (
                      <img src={workerReplyImage.trim()} alt="preview" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                        style={{ marginTop: 8, width: '100%', maxHeight: 160, objectFit: 'cover', display: 'block', border: `1px solid ${C.border}` }} />
                    )}
                  </div>
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: C.muted, fontFamily: fc, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Caption propuesto</label>
                    <textarea value={workerReplyCaption} onChange={e => setWorkerReplyCaption(e.target.value)} rows={4}
                      placeholder="Escribe el caption que propones para este post..."
                      style={{ width: '100%', padding: '10px 12px', border: `1px solid ${C.border}`, fontFamily: f, fontSize: 13, color: C.text, outline: 'none', resize: 'vertical', lineHeight: 1.6, boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ marginBottom: 20 }}>
                    <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: C.muted, fontFamily: fc, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Notas para el cliente (opcional)</label>
                    <textarea value={workerReplyNotes} onChange={e => setWorkerReplyNotes(e.target.value)} rows={2}
                      placeholder="Explica qué has hecho o cambios que recomendarías..."
                      style={{ width: '100%', padding: '10px 12px', border: `1px solid ${C.border}`, fontFamily: f, fontSize: 13, color: C.text, outline: 'none', resize: 'vertical', lineHeight: 1.6, boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setRequestModalPost(null)}
                      style={{ flex: 1, padding: '11px 0', background: C.bg1, border: `1px solid ${C.border}`, color: C.muted, fontFamily: fc, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', cursor: 'pointer' }}>
                      Cancelar
                    </button>
                    <button onClick={sendWorkerReply} disabled={sendingReply}
                      style={{ flex: 2, padding: '11px 0', background: sendingReply ? C.muted : C.accent, border: 'none', color: '#fff', fontFamily: fc, fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', cursor: sendingReply ? 'wait' : 'pointer' }}>
                      {sendingReply ? 'Enviando...' : 'Enviar propuesta al cliente →'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
