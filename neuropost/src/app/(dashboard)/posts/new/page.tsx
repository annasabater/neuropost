'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Check } from 'lucide-react';
import { PostEditor } from '@/components/posts/PostEditor';
import { useAppStore } from '@/store/useAppStore';
import { PLAN_LIMITS } from '@/types';
import toast from 'react-hot-toast';

const f = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

export default function NewPostPage() {
  const router = useRouter();
  const brand = useAppStore((s) => s.brand);
  const addPost = useAppStore((s) => s.addPost);
  const [mode, setMode] = useState<'proposal' | 'instant' | null>(null);
  const [clientNote, setClientNote] = useState('');
  const [contentType, setContentType] = useState('promocion');
  const [quantity, setQuantity] = useState(1);
  const [customQty, setCustomQty] = useState('');
  const [preferredDate, setPreferredDate] = useState('');
  const [urgency, setUrgency] = useState<'flexible' | 'urgente'>('flexible');
  const [hasImages, setHasImages] = useState<'si' | 'no'>('no');
  const [extraNotes, setExtraNotes] = useState('');
  const [requestSent, setRequestSent] = useState(false);
  const [sending, setSending] = useState(false);

  const allowStories = PLAN_LIMITS[brand?.plan ?? 'starter'].storiesPerWeek > 0;

  async function handleSave(data: {
    imageUrl: string | null; caption: string; hashtags: string[];
    platforms: ('instagram' | 'facebook')[]; format: string; goal: string;
    aiExplanation?: string; qualityScore?: number; isStory?: boolean;
  }) {
    const res = await fetch('/api/posts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_url: data.imageUrl, caption: data.caption, hashtags: data.hashtags,
        platform: data.platforms, format: data.format, status: 'generated',
        ai_explanation: data.aiExplanation ?? null, quality_score: data.qualityScore ?? null,
        is_story: data.isStory ?? false, story_type: data.isStory ? 'new' : null,
        versions: [], edit_level: 0, client_edit_mode: 'instant',
        client_notes_for_worker: null, requires_worker_validation: false,
      }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Error al guardar');
    addPost(json.post);
    toast.success('Post guardado');
    router.push(`/posts/${json.post.id}`);
  }

  const finalQty = customQty ? Number(customQty) : quantity;

  async function submitRequest() {
    if (!clientNote.trim()) { toast.error('Describe qué quieres publicar'); return; }
    setSending(true);
    try {
      const desc = [
        clientNote.trim(),
        `\n---`,
        `Tipo: ${contentType}`,
        `Cantidad: ${finalQty} publicaciones`,
        preferredDate ? `Fecha: ${preferredDate}` : null,
        `Urgencia: ${urgency}`,
        `Imágenes: ${hasImages === 'si' ? 'El cliente las proporciona' : 'NeuroPost las prepara'}`,
        extraNotes ? `Notas: ${extraNotes}` : null,
      ].filter(Boolean).join('\n');
      const res = await fetch('/api/solicitudes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'campaign', title: clientNote.trim().slice(0, 80), description: desc, deadline_at: preferredDate || null }),
      });
      if (res.ok) { setRequestSent(true); toast.success('Solicitud enviada. Nuestro equipo ya está trabajando en ello.'); }
      else toast.error('Error al enviar');
    } catch { toast.error('Error de conexión'); }
    setSending(false);
  }

  // ── Mode selector ──
  if (!mode) {
    return (
      <div className="page-content" style={{ maxWidth: 860 }}>
        <div style={{ padding: '48px 0 40px' }}>
          <h1 style={{ fontFamily: fc, fontWeight: 900, fontSize: 'clamp(2.5rem, 5vw, 3.5rem)', textTransform: 'uppercase', letterSpacing: '0.01em', color: '#111827', lineHeight: 0.95, marginBottom: 12 }}>
            Nuevo contenido
          </h1>
          <p style={{ color: '#6b7280', fontSize: 15, fontFamily: f }}>
            Elige cómo quieres crear tu próxima publicación
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: '#e5e7eb', border: '1px solid #e5e7eb', marginBottom: 48 }}>
          {/* OPTION 1 — NeuroPost creates */}
          <button onClick={() => setMode('proposal')} style={{
            padding: '40px 32px', background: '#111827', border: 'none',
            cursor: 'pointer', textAlign: 'left', display: 'flex', flexDirection: 'column',
            transition: 'opacity 0.15s',
          }}>
            <p style={{ fontFamily: fc, fontWeight: 900, fontSize: 'clamp(1.3rem, 3vw, 1.8rem)', textTransform: 'uppercase', letterSpacing: '0.01em', color: '#ffffff', lineHeight: 1.0, marginBottom: 12 }}>
              NeuroPost crea tu contenido
            </p>
            <p style={{ fontFamily: f, fontSize: 14, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, marginBottom: 24 }}>
              Nuestro equipo prepara, optimiza y programa tu contenido para que tu negocio crezca.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 28, flex: 1 }}>
              {['Estrategia adaptada a tu negocio', 'Copy optimizado para engagement', 'Revisión profesional', 'Programación incluida'].map((feat) => (
                <div key={feat} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Check size={12} style={{ color: '#0F766E', flexShrink: 0 }} />
                  <span style={{ fontFamily: f, fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>{feat}</span>
                </div>
              ))}
            </div>
            <div style={{
              padding: '12px 24px', background: '#ffffff', color: '#111827',
              fontFamily: fc, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
              display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
            }}>
              Solicitar contenido <ArrowRight size={14} />
            </div>
          </button>

          {/* OPTION 2 — User creates */}
          <button onClick={() => router.push('/ideas')} style={{
            padding: '40px 32px', background: '#ffffff', border: 'none',
            cursor: 'pointer', textAlign: 'left', display: 'flex', flexDirection: 'column',
            transition: 'background 0.15s',
          }}>
            <p style={{ fontFamily: fc, fontWeight: 900, fontSize: 'clamp(1.3rem, 3vw, 1.8rem)', textTransform: 'uppercase', letterSpacing: '0.01em', color: '#111827', lineHeight: 1.0, marginBottom: 12 }}>
              Crear contenido tú mismo
            </p>
            <p style={{ fontFamily: f, fontSize: 14, color: '#6b7280', lineHeight: 1.6, marginBottom: 24 }}>
              Crea y publica contenido con nuestras herramientas de edición y generación de ideas.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 28, flex: 1 }}>
              {['Editor manual completo', 'Generación de ideas', 'Asistencia en copy'].map((feat) => (
                <div key={feat} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Check size={12} style={{ color: '#9ca3af', flexShrink: 0 }} />
                  <span style={{ fontFamily: f, fontSize: 13, color: '#374151' }}>{feat}</span>
                </div>
              ))}
            </div>
            <div style={{
              padding: '12px 24px', border: '1px solid #e5e7eb', background: '#ffffff', color: '#111827',
              fontFamily: fc, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
              display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
            }}>
              Crear manualmente <ArrowRight size={14} />
            </div>
          </button>
        </div>
      </div>
    );
  }

  // ── Proposal mode — request form ──
  if (mode === 'proposal') {
    if (requestSent) {
      return (
        <div className="page-content" style={{ maxWidth: 600 }}>
          <div style={{ textAlign: 'center', padding: '80px 20px' }}>
            <p style={{ fontFamily: fc, fontWeight: 900, fontSize: 32, textTransform: 'uppercase', color: '#111827', marginBottom: 8 }}>
              Solicitud enviada
            </p>
            <p style={{ fontFamily: f, fontSize: 15, color: '#6b7280', marginBottom: 32, maxWidth: 400, margin: '0 auto 32px' }}>
              Tu equipo NeuroPost ya está trabajando en tu contenido. Te avisaremos cuando esté listo para revisar.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button onClick={() => router.push('/dashboard')} style={{
                padding: '12px 28px', background: '#111827', color: '#ffffff', border: 'none',
                fontFamily: fc, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer',
              }}>
                Ir al inicio
              </button>
              <button onClick={() => { setMode(null); setRequestSent(false); setClientNote(''); }} style={{
                padding: '12px 24px', border: '1px solid #e5e7eb', background: '#ffffff', color: '#6b7280',
                fontFamily: f, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>
                Crear otra solicitud
              </button>
            </div>
          </div>
        </div>
      );
    }

    const labelStyle: React.CSSProperties = { display: 'block', fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#9ca3af', marginBottom: 8 };
    const inputStyle: React.CSSProperties = { width: '100%', padding: '12px 14px', border: '1px solid #e5e7eb', fontFamily: f, fontSize: 14, color: '#111827', outline: 'none', boxSizing: 'border-box' };
    const toggleStyle = (active: boolean): React.CSSProperties => ({ padding: '8px 16px', border: `1px solid ${active ? '#111827' : '#e5e7eb'}`, background: active ? '#111827' : '#ffffff', color: active ? '#ffffff' : '#6b7280', fontFamily: f, fontSize: 12, fontWeight: 600, cursor: 'pointer' });

    return (
      <div className="page-content" style={{ maxWidth: 640 }}>
        <div style={{ padding: '48px 0 32px' }}>
          <button onClick={() => setMode(null)} style={{ fontFamily: f, fontSize: 12, color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 16, padding: 0 }}>
            ← Volver
          </button>
          <h1 style={{ fontFamily: fc, fontWeight: 900, fontSize: 'clamp(2rem, 4vw, 2.5rem)', textTransform: 'uppercase', color: '#111827', lineHeight: 0.95, marginBottom: 8 }}>
            Solicitar contenido
          </h1>
          <p style={{ color: '#6b7280', fontSize: 15, fontFamily: f }}>
            Rellena los detalles y tu equipo se encarga del resto
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, border: '1px solid #e5e7eb', marginBottom: 24 }}>
          {/* 1. Main request */}
          <div style={{ padding: '24px', background: '#ffffff' }}>
            <label style={labelStyle}>¿Qué quieres publicar? *</label>
            <textarea value={clientNote} onChange={(e) => setClientNote(e.target.value)}
              placeholder="Ej: Quiero posts del nuevo menú de otoño con fotos de los platos. Tono cercano, que invite a reservar."
              rows={4} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }} />
          </div>

          {/* 2. Content type */}
          <div style={{ padding: '20px 24px', background: '#ffffff' }}>
            <label style={labelStyle}>Tipo de contenido</label>
            <div style={{ display: 'flex', gap: 0 }}>
              {[
                { v: 'promocion', l: 'Promoción' }, { v: 'educativo', l: 'Educativo' },
                { v: 'branding', l: 'Branding' }, { v: 'testimonio', l: 'Testimonio' }, { v: 'otro', l: 'Otro' },
              ].map(({ v, l }) => (
                <button key={v} onClick={() => setContentType(v)} style={{
                  ...toggleStyle(contentType === v),
                  borderRight: v !== 'otro' ? 'none' : undefined,
                }}>{l}</button>
              ))}
            </div>
          </div>

          {/* 3. Quantity */}
          <div style={{ padding: '20px 24px', background: '#ffffff' }}>
            <label style={labelStyle}>¿Cuántas publicaciones?</label>
            <div style={{ display: 'flex', gap: 0 }}>
              {[1, 3, 5].map((n) => (
                <button key={n} onClick={() => { setQuantity(n); setCustomQty(''); }} style={{
                  ...toggleStyle(quantity === n && !customQty),
                  borderRight: 'none', minWidth: 48,
                }}>{n}</button>
              ))}
              <input type="number" min={1} max={20} placeholder="Otro" value={customQty}
                onChange={(e) => setCustomQty(e.target.value)}
                style={{ ...inputStyle, width: 80, textAlign: 'center', borderLeft: 'none' }} />
            </div>
          </div>

          {/* 4. Date + urgency */}
          <div style={{ padding: '20px 24px', background: '#ffffff', display: 'flex', gap: 16, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Fecha preferida <span style={{ opacity: 0.5, textTransform: 'none', fontWeight: 400 }}>(opcional)</span></label>
              <input type="date" value={preferredDate} onChange={(e) => setPreferredDate(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Urgencia</label>
              <div style={{ display: 'flex', gap: 0 }}>
                <button onClick={() => setUrgency('flexible')} style={toggleStyle(urgency === 'flexible')}>Flexible</button>
                <button onClick={() => setUrgency('urgente')} style={{ ...toggleStyle(urgency === 'urgente'), borderLeft: 'none' }}>Urgente</button>
              </div>
            </div>
          </div>

          {/* 5. Images */}
          <div style={{ padding: '20px 24px', background: '#ffffff' }}>
            <label style={labelStyle}>¿Tienes imágenes?</label>
            <div style={{ display: 'flex', gap: 0 }}>
              <button onClick={() => setHasImages('si')} style={toggleStyle(hasImages === 'si')}>Sí, las subo yo</button>
              <button onClick={() => setHasImages('no')} style={{ ...toggleStyle(hasImages === 'no'), borderLeft: 'none' }}>No, que NeuroPost las prepare</button>
            </div>
          </div>

          {/* 6. Notes */}
          <div style={{ padding: '20px 24px', background: '#ffffff' }}>
            <label style={labelStyle}>Notas adicionales <span style={{ opacity: 0.5, textTransform: 'none', fontWeight: 400 }}>(tono, referencias...)</span></label>
            <textarea value={extraNotes} onChange={(e) => setExtraNotes(e.target.value)}
              placeholder="Ej: Tono profesional, con referencias a nuestra web. No usar emojis." rows={2}
              style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setMode(null)} style={{
            padding: '12px 20px', border: '1px solid #e5e7eb', background: '#ffffff', color: '#6b7280',
            fontFamily: f, fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>
            Cancelar
          </button>
          <button onClick={submitRequest} disabled={sending} style={{
            padding: '12px 28px', background: '#111827', color: '#ffffff', border: 'none',
            fontFamily: fc, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
            cursor: sending ? 'wait' : 'pointer', opacity: sending ? 0.5 : 1,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            {sending ? 'Enviando...' : `Enviar solicitud (${finalQty} posts)`} <ArrowRight size={14} />
          </button>
        </div>
      </div>
    );
  }

  // ── Instant mode — editor (fallback, shouldn't reach here normally) ──
  return (
    <div className="page-content" style={{ maxWidth: 1200 }}>
      <div style={{ padding: '32px 0 24px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1 style={{ fontFamily: fc, fontWeight: 900, fontSize: 'clamp(1.5rem, 3vw, 2rem)', textTransform: 'uppercase', color: '#111827', marginBottom: 4 }}>
            Nuevo post
          </h1>
          <p style={{ color: '#6b7280', fontSize: 13, fontFamily: f }}>Edita y publica tu contenido</p>
        </div>
        <button onClick={() => setMode(null)} style={{ fontSize: 12, color: '#6b7280', background: '#ffffff', border: '1px solid #d4d4d8', padding: '6px 14px', cursor: 'pointer', fontFamily: f }}>
          ← Volver
        </button>
      </div>
      <PostEditor brandName={brand?.name ?? 'Tu negocio'} allowStories={allowStories} onSave={handleSave} />
    </div>
  );
}
