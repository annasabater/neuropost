'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, Check, Sparkles, Send, Paintbrush, Flame } from 'lucide-react';
import { PostEditor } from '@/components/posts/PostEditor';
import { MediaPicker, type SelectedMedia } from '@/components/posts/MediaPicker';
import { useAppStore } from '@/store/useAppStore';
import { PLAN_LIMITS, type ContentMode } from '@/types';
import toast from 'react-hot-toast';

const f = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

export default function NewPostPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const brand = useAppStore((s) => s.brand);
  const addPost = useAppStore((s) => s.addPost);

  const initialMode = searchParams.get('mode') as ContentMode | null;
  const [mode, setMode] = useState<ContentMode | null>(initialMode);

  // Request (pedido) state
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
  const [useInspiration, setUseInspiration] = useState(false);

  const limits = PLAN_LIMITS[brand?.plan ?? 'starter'];
  const allowStories = limits.storiesPerWeek > 0;
  const maxImages = limits.carouselMaxPhotos;

  // Sync URL mode param
  useEffect(() => {
    const urlMode = searchParams.get('mode') as ContentMode | null;
    if (urlMode && ['request', 'self-service'].includes(urlMode)) {
      setMode(urlMode);
    }
  }, [searchParams]);

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
      const meta = JSON.stringify({
        content_type: contentType,
        quantity: finalQty,
        urgency,
        preferred_date: preferredDate || null,
        extra_notes: extraNotes || null,
        proposed_caption: proposedCaption.trim() || null,
        media_urls: selectedMedia.map(m => m.url),
        from_inspiration: useInspiration,
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

  // ══════════════════════════════════════════════════════════════════════
  // MODE SELECTOR — 3 options
  // ══════════════════════════════════════════════════════════════════════
  if (!mode) {
    return (
      <div className="page-content" style={{ maxWidth: 960 }}>
        <div style={{ padding: '32px 0 24px' }}>
          <h1 style={{
            fontFamily: fc, fontWeight: 900,
            fontSize: 'clamp(2.5rem, 5vw, 3.5rem)',
            textTransform: 'uppercase', letterSpacing: '0.01em',
            color: 'var(--text-primary)', lineHeight: 0.95, marginBottom: 12,
          }}>
            Nuevo contenido
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 15, fontFamily: f }}>
            Elige cómo quieres crear tu próxima publicación
          </p>
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px',
          background: 'var(--border)', border: '1px solid var(--border)', marginBottom: 32,
        }}>
          {/* ── AUTO: Propuestas semanales ── */}
          <button onClick={() => router.push('/dashboard#proposals')} style={{
            padding: '32px 24px', background: '#111827', border: 'none',
            cursor: 'pointer', textAlign: 'left', display: 'flex', flexDirection: 'column',
            transition: 'opacity 0.15s',
          }}>
            <div style={{
              width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--accent)', marginBottom: 20,
            }}>
              <Sparkles size={18} style={{ color: '#ffffff' }} />
            </div>
            <p style={{
              fontFamily: fc, fontWeight: 900,
              fontSize: 'clamp(1.2rem, 2.5vw, 1.6rem)',
              textTransform: 'uppercase', letterSpacing: '0.01em',
              color: '#ffffff', lineHeight: 1.0, marginBottom: 10,
            }}>
              Automático
            </p>
            <p style={{
              fontFamily: f, fontSize: 13, color: 'rgba(255,255,255,0.5)',
              lineHeight: 1.6, marginBottom: 20, flex: 1,
            }}>
              Cada semana generamos propuestas de contenido adaptadas a tu negocio. Solo tienes que aprobar.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {[
                `${limits.autoProposalsPerWeek} propuestas/semana`,
                'Basado en tendencias',
                'Copy optimizado',
                limits.autopilot ? 'Piloto automático' : 'Aprueba y publica',
              ].map((feat) => (
                <div key={feat} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Check size={12} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                  <span style={{ fontFamily: f, fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{feat}</span>
                </div>
              ))}
            </div>
            <div style={{
              padding: '10px 20px', background: 'var(--accent)', color: '#ffffff',
              fontFamily: fc, fontSize: 12, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.06em', display: 'inline-flex', alignItems: 'center',
              gap: 6, alignSelf: 'flex-start',
            }}>
              Ver propuestas <ArrowRight size={13} />
            </div>
          </button>

          {/* ── REQUEST: Pedir contenido ── */}
          <button onClick={() => setMode('request')} style={{
            padding: '32px 24px', background: 'var(--bg)', border: 'none',
            cursor: 'pointer', textAlign: 'left', display: 'flex', flexDirection: 'column',
            transition: 'background 0.15s',
          }}>
            <div style={{
              width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '2px solid var(--accent)', marginBottom: 20,
            }}>
              <Send size={16} style={{ color: 'var(--accent)' }} />
            </div>
            <p style={{
              fontFamily: fc, fontWeight: 900,
              fontSize: 'clamp(1.2rem, 2.5vw, 1.6rem)',
              textTransform: 'uppercase', letterSpacing: '0.01em',
              color: 'var(--text-primary)', lineHeight: 1.0, marginBottom: 10,
            }}>
              Solicitar contenido
            </p>
            <p style={{
              fontFamily: f, fontSize: 13, color: 'var(--text-tertiary)',
              lineHeight: 1.6, marginBottom: 20, flex: 1,
            }}>
              Dinos qué necesitas y nuestro equipo lo prepara: promos, ediciones, carruseles, reels...
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {[
                'Sube tus fotos o referencias',
                'Estrategia adaptada',
                'Revisión profesional',
                limits.requestsPerMonth === Infinity ? 'Pedidos ilimitados' : `${limits.requestsPerMonth} pedidos/mes`,
              ].map((feat) => (
                <div key={feat} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Check size={12} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                  <span style={{ fontFamily: f, fontSize: 12, color: 'var(--text-secondary)' }}>{feat}</span>
                </div>
              ))}
            </div>
            <div style={{
              padding: '10px 20px', border: '2px solid var(--accent)',
              background: 'var(--bg)', color: 'var(--accent)',
              fontFamily: fc, fontSize: 12, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.06em', display: 'inline-flex', alignItems: 'center',
              gap: 6, alignSelf: 'flex-start',
            }}>
              Hacer pedido <ArrowRight size={13} />
            </div>
          </button>

          {/* ── SELF-SERVICE: Crear tú mismo ── */}
          <button onClick={() => setMode('self-service')} style={{
            padding: '32px 24px', background: 'var(--bg)', border: 'none',
            cursor: 'pointer', textAlign: 'left', display: 'flex', flexDirection: 'column',
            transition: 'background 0.15s',
          }}>
            <div style={{
              width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '2px solid var(--text-tertiary)', marginBottom: 20,
            }}>
              <Paintbrush size={16} style={{ color: 'var(--text-secondary)' }} />
            </div>
            <p style={{
              fontFamily: fc, fontWeight: 900,
              fontSize: 'clamp(1.2rem, 2.5vw, 1.6rem)',
              textTransform: 'uppercase', letterSpacing: '0.01em',
              color: 'var(--text-primary)', lineHeight: 1.0, marginBottom: 10,
            }}>
              Crear tú mismo
            </p>
            <p style={{
              fontFamily: f, fontSize: 13, color: 'var(--text-tertiary)',
              lineHeight: 1.6, marginBottom: 20, flex: 1,
            }}>
              Usa nuestras herramientas de edición, generación de ideas e inspiración para crear contenido.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {[
                'Editor completo',
                'Generación de ideas con IA',
                'Biblioteca de inspiración',
                'Presets y estilos',
              ].map((feat) => (
                <div key={feat} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Check size={12} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                  <span style={{ fontFamily: f, fontSize: 12, color: 'var(--text-secondary)' }}>{feat}</span>
                </div>
              ))}
            </div>
            <div style={{
              padding: '10px 20px', border: '1px solid var(--border)',
              background: 'var(--bg)', color: 'var(--text-secondary)',
              fontFamily: fc, fontSize: 12, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.06em', display: 'inline-flex', alignItems: 'center',
              gap: 6, alignSelf: 'flex-start',
            }}>
              Abrir editor <ArrowRight size={13} />
            </div>
          </button>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  // REQUEST MODE — Solicitar contenido (pedido)
  // ══════════════════════════════════════════════════════════════════════
  if (mode === 'request') {
    if (requestSent) {
      return (
        <div className="page-content" style={{ maxWidth: 700 }}>
          <div style={{ padding: '80px 0', textAlign: 'center' }}>
            {/* Success icon */}
            <div style={{
              width: 56, height: 56, margin: '0 auto 24px',
              background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Check size={28} style={{ color: '#ffffff' }} />
            </div>
            <h1 style={{
              fontFamily: fc, fontWeight: 900, fontSize: 'clamp(2rem, 4vw, 3rem)',
              textTransform: 'uppercase', color: 'var(--text-primary)',
              letterSpacing: '0.01em', lineHeight: 0.95, marginBottom: 16,
            }}>
              Solicitud enviada
            </h1>
            <p style={{
              fontFamily: f, fontSize: 15, color: 'var(--text-secondary)',
              maxWidth: 380, margin: '0 auto 40px', lineHeight: 1.6,
            }}>
              Nuestro equipo ya está trabajando en tu contenido. Te avisaremos cuando esté listo para que lo revises.
            </p>

            {/* Summary card */}
            <div style={{
              border: '1px solid var(--border)', maxWidth: 360, margin: '0 auto 40px',
              textAlign: 'left',
            }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-tertiary)' }}>
                  Resumen del pedido
                </span>
              </div>
              {[
                { label: 'Contenido', value: contentType.charAt(0).toUpperCase() + contentType.slice(1) },
                { label: 'Cantidad', value: `${finalQty} foto${finalQty > 1 ? 's' : ''}` },
                { label: 'Urgencia', value: urgency === 'urgente' ? 'Urgente' : 'Flexible' },
                ...(preferredDate ? [{ label: 'Fecha', value: new Date(preferredDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' }) }] : []),
              ].map(({ label, value }, i, arr) => (
                <div key={label} style={{
                  padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
                }}>
                  <span style={{ fontFamily: f, fontSize: 12, color: 'var(--text-tertiary)' }}>{label}</span>
                  <span style={{ fontFamily: f, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{value}</span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 1, justifyContent: 'center', background: 'var(--border)', border: '1px solid var(--border)', maxWidth: 360, margin: '0 auto' }}>
              <button onClick={() => router.push('/dashboard')} style={{
                flex: 1, padding: '14px 24px', background: '#111827', color: '#ffffff', border: 'none',
                fontFamily: fc, fontSize: 12, fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.06em', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
                Ir al inicio <ArrowRight size={13} />
              </button>
              <button onClick={() => { setMode(null); setRequestSent(false); setClientNote(''); setProposedCaption(''); setExtraNotes(''); setSelectedMedia([]); }} style={{
                flex: 1, padding: '14px 24px', border: 'none', background: 'var(--bg)', color: 'var(--text-secondary)',
                fontFamily: f, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}>
                Nuevo pedido
              </button>
            </div>
          </div>
        </div>
      );
    }

    const labelStyle: React.CSSProperties = {
      display: 'block', fontFamily: f, fontSize: 10, fontWeight: 600,
      textTransform: 'uppercase', letterSpacing: '0.12em',
      color: 'var(--text-tertiary)', marginBottom: 10,
    };
    const inputStyle: React.CSSProperties = {
      width: '100%', padding: '14px 16px',
      border: '1px solid var(--border)', fontFamily: f, fontSize: 14,
      color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
      background: 'var(--bg)', transition: 'border-color 0.15s',
    };
    const bc = (active: boolean) => active ? 'var(--accent)' : 'var(--border)';
    const toggleStyle = (active: boolean): React.CSSProperties => ({
      padding: '10px 18px',
      border: `1px solid ${bc(active)}`,
      background: active ? 'var(--accent)' : 'var(--bg)',
      color: active ? '#ffffff' : 'var(--text-tertiary)',
      fontFamily: f, fontSize: 12, fontWeight: 600, cursor: 'pointer',
      transition: 'all 0.15s',
    });

    // Step number badge
    const StepNum = ({ n }: { n: number }) => (
      <div style={{
        width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#111827', color: '#ffffff', fontFamily: fc, fontSize: 11, fontWeight: 700,
        flexShrink: 0,
      }}>
        {n}
      </div>
    );

    const isReady = clientNote.trim().length > 0;

    return (
      <div className="page-content" style={{ maxWidth: 900 }}>
        {/* ── Header ── */}
        <div style={{ padding: '48px 0 32px' }}>
          <button onClick={() => setMode(null)} style={{
            fontFamily: f, fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)',
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            marginBottom: 20, textTransform: 'uppercase', letterSpacing: '0.08em',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <ArrowRight size={12} style={{ transform: 'rotate(180deg)' }} /> Volver
          </button>
          <h1 style={{
            fontFamily: fc, fontWeight: 900,
            fontSize: 'clamp(2.5rem, 5vw, 3.5rem)',
            textTransform: 'uppercase', letterSpacing: '0.01em',
            color: 'var(--text-primary)', lineHeight: 0.95, marginBottom: 12,
          }}>
            Solicitar contenido
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 15, fontFamily: f, maxWidth: 500 }}>
            Describe lo que necesitas y nuestro equipo creativo se encarga de todo: diseño, copy y programación.
          </p>
        </div>

        {/* ── 2-column layout ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 32, alignItems: 'start' }}>

          {/* ── LEFT: Form ── */}
          <div>
            {/* STEP 1 — Describe tu contenido */}
            <div style={{ border: '1px solid var(--border)', marginBottom: 2 }}>
              <div style={{
                padding: '16px 20px', background: 'var(--bg-1)',
                display: 'flex', alignItems: 'center', gap: 10,
                borderBottom: '1px solid var(--border)',
              }}>
                <StepNum n={1} />
                <span style={{ fontFamily: f, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-primary)' }}>
                  Describe tu contenido
                </span>
                <span style={{ fontFamily: f, fontSize: 10, color: 'var(--text-tertiary)', marginLeft: 'auto' }}>Obligatorio</span>
              </div>
              <div style={{ padding: '20px' }}>
                <textarea
                  value={clientNote}
                  onChange={(e) => setClientNote(e.target.value)}
                  placeholder="Ej: Quiero 3 posts del nuevo menú de otoño con fotos de los platos. Tono cercano, que invite a reservar mesa."
                  rows={5}
                  style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.7 }}
                />
              </div>

              {/* Media & Inspiration row */}
              <div style={{ padding: '0 20px 20px' }}>
                <MediaPicker selected={selectedMedia} onChange={setSelectedMedia} />
              </div>
              <div style={{
                padding: '14px 20px', borderTop: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <button onClick={() => setUseInspiration(!useInspiration)} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px',
                  border: `1px solid ${useInspiration ? 'var(--accent)' : 'var(--border)'}`,
                  background: useInspiration ? 'var(--accent)' : 'var(--bg)',
                  cursor: 'pointer', fontFamily: f, fontSize: 11, fontWeight: 600,
                  color: useInspiration ? '#ffffff' : 'var(--text-tertiary)',
                  transition: 'all 0.15s',
                }}>
                  <Flame size={13} />
                  {useInspiration ? 'Inspiración aplicada' : 'Usar mi inspiración'}
                </button>
                {useInspiration && (
                  <span style={{ fontFamily: f, fontSize: 10, color: 'var(--accent)', fontWeight: 500 }}>
                    Usaremos tus referencias guardadas como guía
                  </span>
                )}
              </div>
            </div>

            {/* STEP 2 — Configuración */}
            <div style={{ border: '1px solid var(--border)', marginBottom: 2 }}>
              <div style={{
                padding: '16px 20px', background: 'var(--bg-1)',
                display: 'flex', alignItems: 'center', gap: 10,
                borderBottom: '1px solid var(--border)',
              }}>
                <StepNum n={2} />
                <span style={{ fontFamily: f, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-primary)' }}>
                  Configuración
                </span>
              </div>

              {/* Content type + Image count in 1px gap grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: 'var(--border)' }}>
                {/* Content type */}
                <div style={{ padding: '18px 20px', background: 'var(--bg)' }}>
                  <label style={labelStyle}>Tipo</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {[
                      { v: 'promocion', l: 'Promoción' }, { v: 'educativo', l: 'Educativo' },
                      { v: 'branding', l: 'Branding' }, { v: 'testimonio', l: 'Testimonio' }, { v: 'otro', l: 'Otro' },
                    ].map(({ v, l }) => (
                      <button key={v} onClick={() => setContentType(v)} style={{
                        padding: '7px 14px',
                        border: `1px solid ${contentType === v ? 'var(--accent)' : 'var(--border)'}`,
                        background: contentType === v ? 'var(--accent)' : 'var(--bg)',
                        color: contentType === v ? '#ffffff' : 'var(--text-tertiary)',
                        fontFamily: f, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}>{l}</button>
                    ))}
                  </div>
                </div>

                {/* Image count */}
                <div style={{ padding: '18px 20px', background: 'var(--bg)' }}>
                  <label style={labelStyle}>Fotos</label>
                  <div style={{ display: 'flex', gap: 0 }}>
                    {(maxImages <= 3 ? [1, 3] : maxImages <= 8 ? [1, 3, 5, 8] : [1, 3, 5, 10, 20]).map((n, i, arr) => (
                      <button key={n} onClick={() => { setImageCount(n); setCustomImageCount(''); }} style={{
                        ...toggleStyle(imageCount === n && !customImageCount),
                        borderRight: i < arr.length - 1 ? 'none' : undefined,
                        minWidth: 40, padding: '10px 12px',
                      }}>{n}</button>
                    ))}
                    <input type="number" min={1} max={maxImages} placeholder="#" value={customImageCount}
                      onChange={(e) => setCustomImageCount(e.target.value)}
                      style={{ ...inputStyle, width: 56, textAlign: 'center', borderLeft: 'none', padding: '10px 6px' }} />
                  </div>
                  {maxImages < 20 && (
                    <p style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 6, fontFamily: f, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Máx {maxImages} (tu plan)
                    </p>
                  )}
                </div>
              </div>

              {/* Date + Urgency in 1px gap grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: 'var(--border)', borderTop: '1px solid var(--border)' }}>
                <div style={{ padding: '18px 20px', background: 'var(--bg)' }}>
                  <label style={labelStyle}>Fecha preferida <span style={{ opacity: 0.5, textTransform: 'none', fontWeight: 400, letterSpacing: 0 }}>opcional</span></label>
                  <input type="date" value={preferredDate} onChange={(e) => setPreferredDate(e.target.value)} style={inputStyle} />
                </div>
                <div style={{ padding: '18px 20px', background: 'var(--bg)' }}>
                  <label style={labelStyle}>Urgencia</label>
                  <div style={{ display: 'flex', gap: 0 }}>
                    <button onClick={() => setUrgency('flexible')} style={{
                      ...toggleStyle(urgency === 'flexible'),
                      flex: 1, justifyContent: 'center', display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                      Flexible
                    </button>
                    <button onClick={() => setUrgency('urgente')} style={{
                      ...toggleStyle(urgency === 'urgente'),
                      borderLeft: 'none', flex: 1, justifyContent: 'center',
                      display: 'flex', alignItems: 'center', gap: 6,
                      ...(urgency === 'urgente' ? { background: 'var(--warning, #e65100)' } : {}),
                    }}>
                      Urgente
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* STEP 3 — Detalles opcionales */}
            <div style={{ border: '1px solid var(--border)', marginBottom: 32 }}>
              <div style={{
                padding: '16px 20px', background: 'var(--bg-1)',
                display: 'flex', alignItems: 'center', gap: 10,
                borderBottom: '1px solid var(--border)',
              }}>
                <StepNum n={3} />
                <span style={{ fontFamily: f, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-primary)' }}>
                  Detalles extra
                </span>
                <span style={{ fontFamily: f, fontSize: 10, color: 'var(--text-tertiary)', marginLeft: 'auto' }}>Opcional</span>
              </div>
              <div style={{ display: 'grid', gap: '1px', background: 'var(--border)' }}>
                <div style={{ padding: '18px 20px', background: 'var(--bg)' }}>
                  <label style={labelStyle}>
                    Texto / caption sugerido
                  </label>
                  <textarea value={proposedCaption} onChange={(e) => setProposedCaption(e.target.value)}
                    placeholder="Si ya tienes una idea de texto, escríbela aquí. Si no, te proponemos una."
                    rows={3} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }} />
                </div>
                <div style={{ padding: '18px 20px', background: 'var(--bg)' }}>
                  <label style={labelStyle}>
                    Notas para el equipo
                  </label>
                  <textarea value={extraNotes} onChange={(e) => setExtraNotes(e.target.value)}
                    placeholder="Ej: Tono profesional, referencias visuales a nuestra web, evitar emojis..."
                    rows={2} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }} />
                </div>
              </div>
            </div>
          </div>

          {/* ── RIGHT: Summary sidebar ── */}
          <div style={{ position: 'sticky', top: 24 }}>
            {/* Summary card */}
            <div style={{ border: '1px solid var(--border)', marginBottom: 16 }}>
              <div style={{
                padding: '20px', background: '#111827',
              }}>
                <p style={{
                  fontFamily: fc, fontWeight: 900, fontSize: 16,
                  textTransform: 'uppercase', letterSpacing: '0.04em',
                  color: '#ffffff', marginBottom: 4,
                }}>
                  Tu pedido
                </p>
                <p style={{ fontFamily: f, fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                  Revisa antes de enviar
                </p>
              </div>

              <div>
                {[
                  { label: 'Tipo', value: contentType.charAt(0).toUpperCase() + contentType.slice(1) },
                  { label: 'Cantidad', value: `${finalQty} foto${finalQty > 1 ? 's' : ''}` },
                  { label: 'Urgencia', value: urgency === 'urgente' ? 'Urgente' : 'Flexible', highlight: urgency === 'urgente' },
                  ...(preferredDate ? [{ label: 'Fecha', value: new Date(preferredDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) }] : []),
                  ...(selectedMedia.length > 0 ? [{ label: 'Archivos', value: `${selectedMedia.length} adjunto${selectedMedia.length > 1 ? 's' : ''}` }] : []),
                  ...(useInspiration ? [{ label: 'Inspiración', value: 'Activada' }] : []),
                ].map(({ label, value, highlight }, i, arr) => (
                  <div key={label} style={{
                    padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
                  }}>
                    <span style={{ fontFamily: f, fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {label}
                    </span>
                    <span style={{
                      fontFamily: f, fontSize: 13, fontWeight: 600,
                      color: (highlight as boolean) ? 'var(--warning, #e65100)' : 'var(--text-primary)',
                    }}>
                      {value}
                    </span>
                  </div>
                ))}
              </div>

              {/* Description preview */}
              {clientNote.trim() && (
                <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)' }}>
                  <span style={{ fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', display: 'block', marginBottom: 6 }}>
                    Descripción
                  </span>
                  <p style={{
                    fontFamily: f, fontSize: 12, color: 'var(--text-secondary)',
                    lineHeight: 1.5, margin: 0,
                    display: '-webkit-box', WebkitLineClamp: 4,
                    WebkitBoxOrient: 'vertical', overflow: 'hidden',
                  }}>
                    {clientNote}
                  </p>
                </div>
              )}
            </div>

            {/* Submit button */}
            <button onClick={submitRequest} disabled={sending || !isReady} style={{
              width: '100%', padding: '16px 24px',
              background: isReady ? 'var(--accent)' : 'var(--bg-2)',
              color: isReady ? '#ffffff' : 'var(--text-tertiary)',
              border: 'none', fontFamily: fc, fontSize: 14, fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.06em',
              cursor: isReady && !sending ? 'pointer' : 'default',
              opacity: sending ? 0.5 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'all 0.15s', marginBottom: 12,
            }}>
              {sending ? 'Enviando...' : 'Enviar solicitud'} <Send size={15} />
            </button>

            {/* Cancel */}
            <button onClick={() => setMode(null)} style={{
              width: '100%', padding: '12px 24px',
              border: '1px solid var(--border)', background: 'var(--bg)',
              color: 'var(--text-tertiary)',
              fontFamily: f, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              textAlign: 'center',
            }}>
              Cancelar
            </button>

            {/* Plan upgrade nudge */}
            {brand?.plan === 'starter' && (
              <div style={{
                marginTop: 16, padding: '14px 16px',
                background: 'var(--bg-1)', border: '1px solid var(--border)',
              }}>
                <p style={{ fontFamily: f, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-primary)', margin: '0 0 6px' }}>
                  Desbloquea más
                </p>
                <p style={{ fontFamily: f, fontSize: 11, color: 'var(--text-tertiary)', margin: 0, lineHeight: 1.5 }}>
                  Pro: 8 fotos, 10 pedidos/mes. Total: 20 fotos, pedidos ilimitados.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  // SELF-SERVICE MODE — Editor + Ideas + Inspiración
  // ══════════════════════════════════════════════════════════════════════
  return (
    <div className="page-content" style={{ maxWidth: 1200 }}>
      <div style={{ padding: '24px 0 16px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid var(--text-tertiary)',
          }}>
            <Paintbrush size={14} style={{ color: 'var(--text-secondary)' }} />
          </div>
          <div>
            <h1 style={{ fontFamily: fc, fontWeight: 900, fontSize: 'clamp(1.5rem, 3vw, 2rem)', textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: 4 }}>
              Crear contenido
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, fontFamily: f }}>
              Edita, genera ideas y publica tu contenido
            </p>
          </div>
        </div>
        <button onClick={() => setMode(null)} style={{
          fontSize: 12, color: 'var(--text-tertiary)', background: 'var(--bg)',
          border: '1px solid var(--border)', padding: '6px 14px',
          cursor: 'pointer', fontFamily: f,
        }}>
          ← Volver
        </button>
      </div>
      <PostEditor brandName={brand?.name ?? 'Tu negocio'} allowStories={allowStories} onSave={handleSave} />
    </div>
  );
}
