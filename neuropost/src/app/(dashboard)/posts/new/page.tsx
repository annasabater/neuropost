'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Check } from 'lucide-react';
import { PostEditor } from '@/components/posts/PostEditor';
import { MediaPicker, type SelectedMedia } from '@/components/posts/MediaPicker';
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
  const [imageCount, setImageCount] = useState(1);
  const [customImageCount, setCustomImageCount] = useState('');
  const [preferredDate, setPreferredDate] = useState('');
  const [urgency, setUrgency] = useState<'flexible' | 'urgente'>('flexible');
  const [extraNotes, setExtraNotes] = useState('');
  const [proposedCaption, setProposedCaption] = useState('');
  const [selectedMedia, setSelectedMedia] = useState<SelectedMedia[]>([]);
  const [requestSent, setRequestSent] = useState(false);
  const [sending, setSending] = useState(false);

  const allowStories = PLAN_LIMITS[brand?.plan ?? 'starter'].storiesPerWeek > 0;
  const planLimits = {
    starter: { maxImages: 3, label: 'Starter' },
    pro: { maxImages: 8, label: 'Pro' },
    total: { maxImages: 20, label: 'Total' },
    agency: { maxImages: 20, label: 'Agency' },
  };
  const maxImages = planLimits[brand?.plan ?? 'starter'].maxImages;

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

  const finalQty = customImageCount ? Number(customImageCount) : imageCount;

  async function submitRequest() {
    if (!clientNote.trim()) { toast.error('Describe qué quieres publicar'); return; }
    const finalImages = customImageCount ? Number(customImageCount) : imageCount;
    if (finalImages > maxImages) { toast.error(`Máximo ${maxImages} fotos según tu plan`); return; }
    setSending(true);
    try {
      // Metadata interna (no visible en preview)
      const meta = JSON.stringify({
        content_type: contentType,
        quantity: finalQty,
        urgency,
        preferred_date: preferredDate || null,
        extra_notes: extraNotes || null,
        proposed_caption: proposedCaption.trim() || null,
        media_urls: selectedMedia.map(m => m.url),
      });

      let created = 0;
      for (let i = 0; i < finalQty; i++) {
        const res = await fetch('/api/posts', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            caption: finalQty > 1 ? `${clientNote.trim()} (${i + 1}/${finalQty})` : clientNote.trim(),
            image_url: selectedMedia[i]?.url ?? selectedMedia[0]?.url ?? null,
            status: 'request',
            format: 'image',
            platform: ['instagram'],
            scheduled_at: preferredDate ? new Date(preferredDate).toISOString() : null,
            ai_explanation: meta,
          }),
        });
        if (res.ok) created++;
      }

      if (created > 0) {
        setRequestSent(true);
        toast.success(`Solicitud enviada (${created} post${created > 1 ? 's' : ''}). Nuestro equipo ya está trabajando en ello.`);
      } else {
        toast.error('Error al enviar');
      }
    } catch { toast.error('Error de conexión'); }
    setSending(false);
  }

  // ── Mode selector ──
  if (!mode) {
    return (
      <div className="page-content" style={{ maxWidth: 860 }}>
        <div style={{ padding: '32px 0 24px' }}>
          <h1 style={{ fontFamily: fc, fontWeight: 900, fontSize: 'clamp(2.5rem, 5vw, 3.5rem)', textTransform: 'uppercase', letterSpacing: '0.01em', color: '#111827', lineHeight: 0.95, marginBottom: 12 }}>
            Nuevo contenido
          </h1>
          <p style={{ color: '#6b7280', fontSize: 15, fontFamily: f }}>
            Elige cómo quieres crear tu próxima publicación
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: 'var(--border)', border: '1px solid var(--border)', marginBottom: 32 }}>
          {/* OPTION 1 — NeuroPost creates */}
          <button onClick={() => setMode('proposal')} style={{
            padding: '32px 28px', background: '#111827', border: 'none',
            cursor: 'pointer', textAlign: 'left', display: 'flex', flexDirection: 'column',
            transition: 'opacity 0.15s',
          }}>
            <p style={{ fontFamily: fc, fontWeight: 900, fontSize: 'clamp(1.3rem, 3vw, 1.8rem)', textTransform: 'uppercase', letterSpacing: '0.01em', color: '#ffffff', lineHeight: 1.0, marginBottom: 12 }}>
              NeuroPost crea tu contenido
            </p>
            <p style={{ fontFamily: f, fontSize: 14, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, marginBottom: 20 }}>
              Nuestro equipo prepara, optimiza y programa tu contenido para que tu negocio crezca.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20, flex: 1 }}>
              {['Estrategia adaptada a tu negocio', 'Copy optimizado para engagement', 'Revisión profesional', 'Programación incluida'].map((feat) => (
                <div key={feat} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Check size={12} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                  <span style={{ fontFamily: f, fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>{feat}</span>
                </div>
              ))}
            </div>
            <div style={{
              padding: '12px 24px', background: 'var(--accent)', color: '#ffffff',
              fontFamily: fc, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
              display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
            }}>
              Solicitar contenido <ArrowRight size={14} />
            </div>
          </button>

          {/* OPTION 2 — User creates */}
          <button onClick={() => router.push('/ideas')} style={{
            padding: '32px 28px', background: '#ffffff', border: 'none',
            cursor: 'pointer', textAlign: 'left', display: 'flex', flexDirection: 'column',
            transition: 'background 0.15s',
          }}>
            <p style={{ fontFamily: fc, fontWeight: 900, fontSize: 'clamp(1.3rem, 3vw, 1.8rem)', textTransform: 'uppercase', letterSpacing: '0.01em', color: 'var(--accent)', lineHeight: 1.0, marginBottom: 12 }}>
              Crear contenido tú mismo
            </p>
            <p style={{ fontFamily: f, fontSize: 14, color: '#6b7280', lineHeight: 1.6, marginBottom: 20 }}>
              Crea y publica contenido con nuestras herramientas de edición y generación de ideas.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20, flex: 1 }}>
              {['Editor manual completo', 'Generación de ideas', 'Asistencia en copy'].map((feat) => (
                <div key={feat} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Check size={12} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                  <span style={{ fontFamily: f, fontSize: 13, color: '#374151' }}>{feat}</span>
                </div>
              ))}
            </div>
            <div style={{
              padding: '12px 24px', border: '2px solid var(--accent)', background: '#ffffff', color: 'var(--accent)',
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
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <p style={{ fontFamily: fc, fontWeight: 900, fontSize: 32, textTransform: 'uppercase', color: '#111827', marginBottom: 8 }}>
              Solicitud enviada
            </p>
            <p style={{ fontFamily: f, fontSize: 15, color: 'var(--text-secondary)', marginBottom: 32, maxWidth: 400, margin: '0 auto 32px' }}>
              Tu equipo NeuroPost ya está trabajando en tu contenido. Te avisaremos cuando esté listo para revisar.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button onClick={() => router.push('/dashboard')} style={{
                padding: '12px 28px', background: 'var(--accent)', color: '#ffffff', border: 'none',
                fontFamily: fc, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer',
              }}>
                Ir al inicio
              </button>
              <button onClick={() => { setMode(null); setRequestSent(false); setClientNote(''); }} style={{
                padding: '12px 24px', border: '1px solid var(--border)', background: '#ffffff', color: '#6b7280',
                fontFamily: f, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>
                Crear otra solicitud
              </button>
            </div>
          </div>
        </div>
      );
    }

    const labelStyle: React.CSSProperties = { display: 'block', fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-tertiary)', marginBottom: 8 };
    const inputStyle: React.CSSProperties = { width: '100%', padding: '12px 14px', border: '1px solid var(--border)', fontFamily: f, fontSize: 14, color: '#111827', outline: 'none', boxSizing: 'border-box' };
    const bc = (active: boolean) => active ? 'var(--accent)' : 'var(--border)';
    const toggleStyle = (active: boolean): React.CSSProperties => ({ padding: '8px 16px', borderTop: `1px solid ${bc(active)}`, borderBottom: `1px solid ${bc(active)}`, borderLeft: `1px solid ${bc(active)}`, borderRight: `1px solid ${bc(active)}`, background: active ? 'var(--accent)' : '#ffffff', color: active ? '#ffffff' : '#6b7280', fontFamily: f, fontSize: 12, fontWeight: 600, cursor: 'pointer' });

    return (
      <div className="page-content" style={{ maxWidth: 640 }}>
        <div style={{ padding: '32px 0 20px' }}>
          <button onClick={() => setMode(null)} style={{ fontFamily: f, fontSize: 12, color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 16, padding: 0 }}>
            ← Volver
          </button>
          <h1 style={{ fontFamily: fc, fontWeight: 900, fontSize: 'clamp(2rem, 4vw, 2.5rem)', textTransform: 'uppercase', color: '#111827', lineHeight: 0.95, marginBottom: 8 }}>
            Solicitar contenido
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 15, fontFamily: f }}>
            Rellena los detalles y tu equipo se encarga del resto
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, border: '1px solid var(--border)', marginBottom: 10 }}>
          {/* 1. Main request */}
          <div style={{ padding: '10px 16px', background: '#ffffff' }}>
            <label style={labelStyle}>¿Qué quieres publicar? *</label>
            <textarea value={clientNote} onChange={(e) => setClientNote(e.target.value)}
              placeholder="Ej: Quiero posts del nuevo menú de otoño con fotos de los platos. Tono cercano, que invite a reservar."
              rows={4} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }} />
          </div>

          {/* 1b. Media picker */}
          <div style={{ padding: '10px 16px', background: '#ffffff' }}>
            <MediaPicker selected={selectedMedia} onChange={setSelectedMedia} />
          </div>

          {/* 2. Content type */}
          <div style={{ padding: '10px 16px', background: '#ffffff' }}>
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

          {/* 3. Image count */}
          <div style={{ padding: '10px 16px', background: '#ffffff' }}>
            <label style={labelStyle}>¿Cuántas fotos por publicación?</label>
            <div style={{ display: 'flex', gap: 0 }}>
              {maxImages === 3 ? (
                [1, 3].map((n) => (
                  <button key={n} onClick={() => { setImageCount(n); setCustomImageCount(''); }} style={{
                    ...toggleStyle(imageCount === n && !customImageCount),
                    borderRight: 'none', minWidth: 48,
                  }}>{n}</button>
                ))
              ) : maxImages === 8 ? (
                [1, 3, 5, 8].map((n) => (
                  <button key={n} onClick={() => { setImageCount(n); setCustomImageCount(''); }} style={{
                    ...toggleStyle(imageCount === n && !customImageCount),
                    borderRight: 'none', minWidth: 48,
                  }}>{n}</button>
                ))
              ) : (
                [1, 3, 5, 10, 20].map((n) => (
                  <button key={n} onClick={() => { setImageCount(n); setCustomImageCount(''); }} style={{
                    ...toggleStyle(imageCount === n && !customImageCount),
                    borderRight: 'none', minWidth: n >= 10 ? 50 : 48,
                  }}>{n}</button>
                ))
              )}
              <input type="number" min={1} max={maxImages} placeholder="Otro" value={customImageCount}
                onChange={(e) => setCustomImageCount(e.target.value)}
                style={{ ...inputStyle, width: 80, textAlign: 'center', borderLeft: 'none' }} />
            </div>
            {maxImages < 20 && (
              <p style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 6 }}>
                Plan {planLimits[brand?.plan ?? 'starter'].label}: máx {maxImages} foto{maxImages > 1 ? 's' : ''}
              </p>
            )}
          </div>

          {/* 4. Date + urgency */}
          <div style={{ padding: '10px 16px', background: '#ffffff', display: 'flex', gap: 12, alignItems: 'flex-end' }}>
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

          {/* 5. Proposed caption */}
          <div style={{ padding: '10px 16px', background: '#ffffff' }}>
            <label style={labelStyle}>Descripción del post <span style={{ opacity: 0.5, textTransform: 'none', fontWeight: 400 }}>(opcional — si no la pones, te proponemos una)</span></label>
            <textarea value={proposedCaption} onChange={(e) => setProposedCaption(e.target.value)}
              placeholder="Ej: Descubre nuestro nuevo menú de otoño 🍂 Reserva tu mesa y déjate sorprender..."
              rows={3} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }} />
          </div>

          {/* 6. Notes */}
          <div style={{ padding: '10px 16px', background: '#ffffff' }}>
            <label style={labelStyle}>Notas adicionales <span style={{ opacity: 0.5, textTransform: 'none', fontWeight: 400 }}>(tono, referencias...)</span></label>
            <textarea value={extraNotes} onChange={(e) => setExtraNotes(e.target.value)}
              placeholder="Ej: Tono profesional, con referencias a nuestra web. No usar emojis." rows={2}
              style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setMode(null)} style={{
            padding: '12px 20px', border: '1px solid var(--border)', background: '#ffffff', color: '#6b7280',
            fontFamily: f, fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>
            Cancelar
          </button>
          <button onClick={submitRequest} disabled={sending} style={{
            padding: '12px 28px', background: 'var(--accent)', color: '#ffffff', border: 'none',
            fontFamily: fc, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
            cursor: sending ? 'wait' : 'pointer', opacity: sending ? 0.5 : 1,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            {sending ? 'Enviando...' : `Enviar solicitud (${finalQty} foto${finalQty > 1 ? 's' : ''})`} <ArrowRight size={14} />
          </button>
        </div>

        {brand?.plan === 'starter' && (
          <div style={{ marginTop: 16, padding: '12px 14px', background: '#f0fdfa', border: '1px solid var(--accent-light)', borderRadius: 4 }}>
            <p style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600, margin: '0 0 4px' }}>
              📸 Desbloquea carruseles más completos
            </p>
            <p style={{ fontSize: 11, color: 'var(--accent)', margin: 0, opacity: 0.8 }}>
              Plan Pro: hasta 8 fotos. Plan Total: hasta 20 fotos por carrusel.
            </p>
          </div>
        )}
        {brand?.plan === 'pro' && (
          <div style={{ marginTop: 16, padding: '12px 14px', background: '#f0fdfa', border: '1px solid var(--accent-light)', borderRadius: 4 }}>
            <p style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600, margin: '0 0 4px' }}>
              ✨ Plan Total disponible
            </p>
            <p style={{ fontSize: 11, color: 'var(--accent)', margin: 0, opacity: 0.8 }}>
              Lleva tus carruseles al máximo con hasta 20 fotos por publicación.
            </p>
          </div>
        )}
      </div>
    );
  }

  // ── Instant mode — editor (fallback, shouldn't reach here normally) ──
  return (
    <div className="page-content" style={{ maxWidth: 1200 }}>
      <div style={{ padding: '24px 0 16px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1 style={{ fontFamily: fc, fontWeight: 900, fontSize: 'clamp(1.5rem, 3vw, 2rem)', textTransform: 'uppercase', color: '#111827', marginBottom: 4 }}>
            Nuevo post
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, fontFamily: f }}>Edita y publica tu contenido</p>
        </div>
        <button onClick={() => setMode(null)} style={{ fontSize: 12, color: 'var(--text-tertiary)', background: '#ffffff', border: '1px solid var(--border)', padding: '6px 14px', cursor: 'pointer', fontFamily: f }}>
          ← Volver
        </button>
      </div>
      <PostEditor brandName={brand?.name ?? 'Tu negocio'} allowStories={allowStories} onSave={handleSave} />
    </div>
  );
}
