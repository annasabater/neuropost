'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, Edit2, Save } from 'lucide-react';
import toast from 'react-hot-toast';

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
};

type Post = Record<string, unknown> & {
  id: string;
  image_url?: string;
  status: string;
  created_at: string;
  agent_id?: string;
  agent_name?: string;
};

type Agent = { id: string; name: string };
type Note = { id: string; note: string; is_pinned: boolean; created_at: string; workers?: { full_name: string } };
type Activity = { id: string; action: string; details: Record<string, unknown> | null; created_at: string };

const TABS = ['Resumen', 'Contenido', 'Actividad', 'Notas'];
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

export default function ClientProfilePage({ params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = use(params);
  const router = useRouter();

  const [brand, setBrand] = useState<Brand | null>(null);
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

  useEffect(() => {
    async function load() {
      try {
        const [brandRes, agentsRes] = await Promise.all([
          fetch(`/api/worker/clientes/${brandId}`),
          fetch('/api/worker/agents'),
        ]);

        const brandData = await brandRes.json();
        if (!brandData.brand) { router.push('/worker/clientes'); return; }

        setBrand(brandData.brand);
        setPosts(brandData.posts ?? []);
        setActivity(brandData.activity ?? []);
        setNotes(brandData.notes ?? []);

        const agentsData = await agentsRes.json();
        setAgents(agentsData.agents ?? []);

        setLoading(false);
      } catch (err) {
        console.error(err);
        toast.error('Error cargando datos');
      }
    }

    load();
  }, [brandId, router]);

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
              Plan {String(brand.plan).toUpperCase()}
              {brand.ig_username && ` · @${brand.ig_username}`}
            </p>

            {/* CONTACTO */}
            <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
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

      {/* TAB 2: ACTIVIDAD */}
      {tab === 2 && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, padding: 24, borderRadius: 0 }}>
          {activity.length === 0 ? (
            <p style={{ color: C.muted, fontSize: 13, margin: 0, fontFamily: f }}>Sin actividad registrada.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {activity.map((event, idx) => (
                <div key={event.id} style={{ padding: '16px 0', borderBottom: idx !== activity.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                  <div style={{ fontSize: 13, color: C.text, fontWeight: 700, marginBottom: 4, fontFamily: f }}>
                    {event.action.replace(/_/g, ' ')}
                  </div>
                  <div style={{ fontSize: 12, color: C.muted, fontFamily: f }}>
                    {timeAgo(event.created_at)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: NOTAS */}
      {tab === 3 && (
        <div>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 0, padding: 24, marginBottom: 24 }}>
            <h3 style={{ fontSize: 12, fontWeight: 700, color: C.muted, margin: '0 0 12px 0', textTransform: 'uppercase', letterSpacing: 0.5, fontFamily: fc }}>
              Añadir nota interna
            </h3>
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Escribe una nota interna (no visible para el cliente)..."
              rows={3}
              style={{
                width: '100%',
                background: C.bg1,
                border: `1px solid ${C.border}`,
                borderRadius: 0,
                padding: '12px 14px',
                color: C.text,
                fontSize: 13,
                resize: 'vertical',
                outline: 'none',
                boxSizing: 'border-box',
                fontFamily: f,
                marginBottom: 12,
              }}
            />
            <button
              onClick={addNote}
              style={{
                padding: '10px 20px',
                background: C.accent,
                color: '#fff',
                border: 'none',
                borderRadius: 0,
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
                fontFamily: f,
              }}
            >
              + Añadir nota
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {notes.map((note) => (
              <div
                key={note.id}
                style={{
                  background: C.card,
                  border: `1px solid ${note.is_pinned ? C.accent : C.border}`,
                  borderRadius: 0,
                  padding: 16,
                  borderLeft: note.is_pinned ? `4px solid ${C.accent}` : '4px solid transparent',
                }}
              >
                {note.is_pinned && (
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.accent, marginBottom: 8, textTransform: 'uppercase', fontFamily: fc }}>
                    Fijada
                  </div>
                )}
                <div style={{ fontSize: 13, color: C.text, lineHeight: 1.6, marginBottom: 8, fontFamily: f }}>
                  {note.note}
                </div>
                <div style={{ fontSize: 12, color: C.muted, fontFamily: f }}>
                  {note.workers?.full_name || 'Worker'} · {timeAgo(note.created_at)}
                </div>
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

      <ModalPhotoEditor
        isOpen={photoModalOpen}
        onClose={() => setPhotoModalOpen(false)}
        post={selectedPhoto}
        agents={agents}
        onSave={(agentId) => updatePhotoAgent(selectedPhoto!.id, agentId)}
      />
    </div>
  );
}
