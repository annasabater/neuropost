'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, Check, Sparkles, Send, Paintbrush, Flame, X, Maximize2, ExternalLink, Film, Images } from 'lucide-react';
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

  // ── Request (pedido) state ──────────────────────────────────────────────
  // Global description: quick-pick kind + free text
  const [clientNote, setClientNote] = useState('');
  const [requestKind, setRequestKind] = useState<string | null>(null);

  // Target platforms for the request (self-service has its own picker
  // inside PostEditor; this drives only the request flow).
  // Default to Instagram — that's still the most common use case and we
  // don't want to force the user to tick anything on the existing form.
  const [requestPlatforms, setRequestPlatforms] = useState<Array<'instagram' | 'facebook' | 'tiktok'>>(['instagram']);

  // Extra AI-generated photos beyond the ones the user uploaded
  const [extraGenerated, setExtraGenerated] = useState(0);

  // Preferred timing
  const [preferredDate, setPreferredDate] = useState('');   // yyyy-mm-dd, empty if quick pick used
  const [timingPreset, setTimingPreset] = useState<'30min' | 'today' | 'tomorrow' | 'week' | 'custom' | null>(null);

  // Optional extras
  const [extraNotes, setExtraNotes] = useState('');
  const [proposedCaption, setProposedCaption] = useState('');
  const [selectedMedia, setSelectedMedia] = useState<SelectedMedia[]>([]);

  // Per-media details: note + optional inspiration reference, keyed by media id
  type PerMedia = { note: string; inspirationId: string | null };
  const [perMedia, setPerMedia] = useState<Record<string, PerMedia>>({});
  const [expandedMediaId, setExpandedMediaId] = useState<string | null>(null);

  // Global inspiration references (picked from saved inspirations for the whole request)
  const [globalInspirationIds, setGlobalInspirationIds] = useState<string[]>([]);
  const [showGlobalInspirationPicker, setShowGlobalInspirationPicker] = useState(false);

  // Inspirations catalog (loaded when the per-image inspiration picker opens)
  type InspirationRef = {
    id: string; title: string; thumbnail_url: string | null;
    format: string | null; source_url: string | null; notes: string | null;
    type: string;
  };
  const [inspirations, setInspirations] = useState<InspirationRef[]>([]);
  const [inspirationsLoaded, setInspirationsLoaded] = useState(false);
  // Lightbox
  const [lightboxRef, setLightboxRef] = useState<InspirationRef | null>(null);

  const [requestSent, setRequestSent] = useState(false);
  const [sending, setSending] = useState(false);

  // ── Quick-pick descriptions ─────────────────────────────────────────────
  const REQUEST_KINDS: { v: string; l: string; hint: string }[] = [
    { v: 'promo',       l: 'Promoción / descuento', hint: 'Anuncia una promo, oferta o descuento limitado.' },
    { v: 'post_normal', l: 'Post normal',            hint: 'Una publicación regular para tu feed.' },
    { v: 'novedad',     l: 'Novedad / lanzamiento',  hint: 'Presenta un producto, servicio o novedad.' },
    { v: 'evento',      l: 'Evento',                 hint: 'Comunica un evento próximo o especial.' },
    { v: 'testimonio',  l: 'Testimonio / reseña',    hint: 'Destaca una opinión o caso de éxito.' },
    { v: 'tips',        l: 'Tips / consejos',        hint: 'Contenido educativo o de valor para tu audiencia.' },
  ];
  function pickKind(v: string, hint: string) {
    setRequestKind(v);
    setClientNote(hint);
  }

  // Timing presets → derives urgency + scheduled_at
  function pickTiming(preset: 'now' | 'today' | 'tomorrow' | 'week' | 'custom') {
    if (preset === 'now') {
      setTimingPreset('30min');
      const t = new Date(Date.now() + 30 * 60 * 1000);
      setPreferredDate(t.toISOString().slice(0, 10));
    } else if (preset === 'today') {
      setTimingPreset('today');
      setPreferredDate(new Date().toISOString().slice(0, 10));
    } else if (preset === 'tomorrow') {
      setTimingPreset('tomorrow');
      setPreferredDate(new Date(Date.now() + 86400000).toISOString().slice(0, 10));
    } else if (preset === 'week') {
      setTimingPreset('week');
      setPreferredDate(new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
    } else {
      setTimingPreset('custom');
    }
  }

  // Lazily load saved inspirations when the picker is first opened
  async function ensureInspirations() {
    if (inspirationsLoaded) return;
    try {
      const res = await fetch('/api/inspiracion/referencias');
      if (res.ok) {
        const d = await res.json();
        const refs: InspirationRef[] = (d.references ?? []).map((r: { id: string; title: string | null; thumbnail_url: string | null; format: string | null; source_url: string | null; notes: string | null; type: string }) => ({
          id: r.id, title: r.title ?? 'Referencia', thumbnail_url: r.thumbnail_url,
          format: r.format ?? null, source_url: r.source_url ?? null,
          notes: r.notes ?? null, type: r.type ?? 'image',
        }));
        setInspirations(refs);
      }
    } catch { /* ignore — picker stays empty */ }
    setInspirationsLoaded(true);
  }

  // Urgency is now derived, not a toggle: "30min" or "today" → urgente.
  const urgency: 'flexible' | 'urgente' = timingPreset === '30min' || timingPreset === 'today' ? 'urgente' : 'flexible';

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
    platforms: ('instagram' | 'facebook' | 'tiktok')[]; format: string; goal: string;
    aiExplanation?: string; qualityScore?: number; isStory?: boolean;
    publications?: Array<{ platform: 'instagram' | 'facebook' | 'tiktok'; scheduledAt: string | null }>;
  }) {
    // Merge from_self_service into ai_explanation so the detail page can show
    // the original image and the "Regenerar propuesta" action.
    let aiExpl: Record<string, unknown> = {};
    try { aiExpl = data.aiExplanation ? JSON.parse(data.aiExplanation) : {}; } catch { /* ignore */ }
    const aiExplanation = JSON.stringify({ ...aiExpl, from_self_service: true, original_image_url: data.imageUrl });

    // 1. Create the post (legacy route — still writes all the normal fields).
    const res = await fetch('/api/posts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_url: data.imageUrl, caption: data.caption, hashtags: data.hashtags,
        platform: data.platforms, format: data.format, status: 'request',
        ai_explanation: aiExplanation, quality_score: data.qualityScore ?? null,
        is_story: data.isStory ?? false, story_type: data.isStory ? 'new' : null,
        versions: [], edit_level: 0, client_edit_mode: 'instant',
        client_notes_for_worker: null, requires_worker_validation: false,
      }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Error al guardar');
    addPost(json.post);

    // 2. If the user configured per-platform schedules, fan them out into
    //    post_publications via the new multi-platform endpoint. Legacy
    //    posts.scheduled_at keeps being set by the normal flow for
    //    backward compatibility.
    if (data.publications && data.publications.length > 0) {
      try {
        const pubRes = await fetch(`/api/posts/${json.post.id}/publications`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ publications: data.publications }),
        });
        const pubJson = await pubRes.json() as {
          outcomes?: Array<{ platform: string; mode: string; error?: string }>;
          error?:    string;
        };

        if (!pubRes.ok) {
          // Post created but publications failed — don't throw so the user
          // isn't stuck with a half-created post. Show a warning toast.
          toast.error(`Post creado, pero falló la programación: ${pubJson.error ?? 'error desconocido'}`);
        } else {
          const outcomes = pubJson.outcomes ?? [];
          const failures = outcomes.filter(o => o.mode === 'failed' || o.mode === 'unsupported');
          const skipped  = outcomes.filter(o => o.mode === 'skipped');
          if (failures.length > 0) {
            toast.error(`Algunas plataformas fallaron: ${failures.map(f => f.platform).join(', ')}`);
          } else if (skipped.length > 0) {
            toast.success(`Post guardado. Conecta ${skipped.map(s => s.platform).join(', ')} para publicar en esas plataformas.`);
          } else {
            const published = outcomes.filter(o => o.mode === 'published').length;
            const scheduled = outcomes.filter(o => o.mode === 'scheduled').length;
            if (published > 0 && scheduled > 0) {
              toast.success(`Publicado en ${published} plataforma(s), programado en ${scheduled}.`);
            } else if (published > 0) {
              toast.success(`Publicado en ${published} plataforma(s).`);
            } else if (scheduled > 0) {
              toast.success(`Programado en ${scheduled} plataforma(s).`);
            } else {
              toast.success('Post guardado');
            }
          }
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Error al programar en plataformas');
      }
    } else {
      toast.success('Post guardado');
    }

    router.push(`/posts/${json.post.id}`);
  }

  // Total photos = user-selected + extras-to-generate. Capped by plan.
  const finalQty = selectedMedia.length + extraGenerated;

  async function submitRequest() {
    if (!clientNote.trim() && !requestKind) {
      toast.error('Describe qué quieres publicar o elige un tipo');
      return;
    }
    if (finalQty > maxImages) { toast.error(`Máximo ${maxImages} fotos según tu plan`); return; }
    if (finalQty === 0) { toast.error('Selecciona al menos una foto o pide que generemos una'); return; }
    setSending(true);
    try {
      // Per-image payload for the worker to consume
      const perImageMeta = selectedMedia.map((m) => ({
        media_id: m.id,
        media_url: m.url,
        note: perMedia[m.id]?.note?.trim() || null,
        inspiration_id: perMedia[m.id]?.inspirationId ?? null,
      }));
      const meta = JSON.stringify({
        request_kind: requestKind,
        global_description: clientNote.trim(),
        user_provided_count: selectedMedia.length,
        extra_to_generate: extraGenerated,
        total_quantity: finalQty,
        urgency,                                // derived: 'urgente' if 30min/today
        timing_preset: timingPreset,            // 30min | today | tomorrow | week | custom | null
        preferred_date: preferredDate || null,
        extra_notes: extraNotes || null,
        proposed_caption: proposedCaption.trim() || null,
        global_inspiration_ids: globalInspirationIds.length > 0 ? globalInspirationIds : null,
        per_image: perImageMeta,
      });

      let created = 0;
      for (let i = 0; i < finalQty; i++) {
        const isUserProvided = i < selectedMedia.length;
        const media = isUserProvided ? selectedMedia[i] : null;
        const perNote = media ? perMedia[media.id]?.note?.trim() : null;
        const caption = finalQty > 1
          ? `${clientNote.trim()} (${i + 1}/${finalQty})${perNote ? ` — ${perNote}` : ''}`
          : `${clientNote.trim()}${perNote ? ` — ${perNote}` : ''}`;
        const res = await fetch('/api/posts', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            caption,
            image_url: media?.url ?? null, // null → worker will generate
            status: 'request',
            format: 'image',
            // Use the platforms the user picked (defaults to ['instagram']).
            // If nothing ticked, fall back to instagram so the request is
            // still routeable.
            platform: requestPlatforms.length > 0 ? requestPlatforms : ['instagram'],
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
              lineHeight: 1.6, marginBottom: 8, flex: 1,
            }}>
              Cada semana generamos propuestas de contenido adaptadas a tu negocio. Solo tienes que aprobar.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 }}>
              {[
                `${limits.autoProposalsPerWeek} propuestas/semana`,
                'Basado en tendencias',
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
              lineHeight: 1.6, marginBottom: 8, flex: 1,
            }}>
              Dinos qué necesitas y nuestro equipo lo prepara.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 }}>
              {[
                'Selecciona tus fotos',
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
              lineHeight: 1.6, marginBottom: 8, flex: 1,
            }}>
              Usa nuestras herramientas de edición para crear y generar fotos y vídeos con IA.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 }}>
              {[
                'Selecciona tus fotos',
                'Crea y edita fotos y vídeos con IA totalmente a tu medida.',
                'Biblioteca de inspiración',
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
                ...(requestKind ? [{ label: 'Tipo', value: REQUEST_KINDS.find((k) => k.v === requestKind)?.l ?? requestKind }] : []),
                { label: 'Cantidad', value: `${finalQty} foto${finalQty === 1 ? '' : 's'}` },
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
              <button onClick={() => {
                setMode(null); setRequestSent(false);
                setClientNote(''); setRequestKind(null);
                setProposedCaption(''); setExtraNotes('');
                setSelectedMedia([]); setPerMedia({}); setExpandedMediaId(null);
                setExtraGenerated(0); setPreferredDate(''); setTimingPreset(null);
                setGlobalInspirationIds([]); setShowGlobalInspirationPicker(false);
              }} style={{
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

    // Ready when there's a description or a quick-pick kind, AND at least one photo
    // (selected OR extras to generate).
    const isReady = (clientNote.trim().length > 0 || !!requestKind) && finalQty > 0;

    return (
      <div className="page-content" style={{ maxWidth: 900 }}>

        {/* ── Lightbox modal ── */}
        {lightboxRef && (
          <div
            onClick={() => setLightboxRef(null)}
            style={{
              position: 'fixed', inset: 0, zIndex: 1000,
              background: 'rgba(0,0,0,0.88)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 24,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: '#111', maxWidth: 680, width: '100%',
                display: 'flex', flexDirection: 'column', maxHeight: '90vh',
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid #333' }}>
                <div style={{ background: ({ image: '#3B82F6', reel: '#EF4444', carousel: '#F59E0B', video: '#8B5CF6' } as Record<string,string>)[lightboxRef.format ?? lightboxRef.type] ?? '#6b7280', padding: '2px 7px' }}>
                  <span style={{ fontFamily: f, fontSize: 9, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {({ image: 'Imagen', reel: 'Reel', carousel: 'Carrusel', video: 'Vídeo' } as Record<string,string>)[lightboxRef.format ?? lightboxRef.type] ?? (lightboxRef.format ?? lightboxRef.type)}
                  </span>
                </div>
                <span style={{ fontFamily: fc, fontWeight: 700, fontSize: 15, color: '#fff', flex: 1 }}>{lightboxRef.title}</span>
                <button
                  type="button"
                  onClick={() => setLightboxRef(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', display: 'flex', padding: 4 }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Image / media area */}
              <div style={{ flex: 1, overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', minHeight: 300 }}>
                {lightboxRef.thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={lightboxRef.thumbnail_url}
                    alt={lightboxRef.title}
                    style={{ maxWidth: '100%', maxHeight: '60vh', objectFit: 'contain', display: 'block' }}
                  />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, color: '#6b7280' }}>
                    {(lightboxRef.format === 'reel' || lightboxRef.format === 'video') ? <Film size={48} /> : lightboxRef.format === 'carousel' ? <Images size={48} /> : <Flame size={48} />}
                    <span style={{ fontFamily: f, fontSize: 12 }}>Sin imagen de vista previa</span>
                  </div>
                )}
              </div>

              {/* Footer: notes + source link + select button */}
              <div style={{ padding: '14px 16px', borderTop: '1px solid #333', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {lightboxRef.notes && (
                  <p style={{ fontFamily: f, fontSize: 12, color: '#d1d5db', margin: 0, lineHeight: 1.6 }}>{lightboxRef.notes}</p>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {lightboxRef.source_url && (
                    <a
                      href={lightboxRef.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: f, fontSize: 11, fontWeight: 600, color: '#60a5fa', textDecoration: 'none' }}
                    >
                      <ExternalLink size={12} />
                      Ver original{(lightboxRef.format === 'carousel') ? ' (todas las fotos)' : (lightboxRef.format === 'reel' || lightboxRef.format === 'video') ? ' (vídeo completo)' : ''}
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setGlobalInspirationIds(prev =>
                        prev.includes(lightboxRef.id) ? prev.filter(x => x !== lightboxRef.id) : [...prev, lightboxRef.id]
                      );
                      setLightboxRef(null);
                    }}
                    style={{
                      marginLeft: 'auto',
                      padding: '9px 20px',
                      background: globalInspirationIds.includes(lightboxRef.id) ? '#065f46' : '#0D9488',
                      border: 'none', cursor: 'pointer',
                      fontFamily: fc, fontSize: 12, fontWeight: 700,
                      textTransform: 'uppercase', letterSpacing: '0.05em',
                      color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 6,
                    }}
                  >
                    {globalInspirationIds.includes(lightboxRef.id) ? (
                      <><Check size={13} /> Seleccionada</>
                    ) : (
                      <><Check size={13} /> Seleccionar como referencia</>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

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
          <p style={{ color: 'var(--text-secondary)', fontSize: 15, fontFamily: f }}>
            Selecciona el contenido, comparte tu idea y nuestro equipo creativo la transformará en contenido profesional listo para publicar.
          </p>
        </div>

        {/* ── 2-column layout ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 32, alignItems: 'start' }}>

          {/* ── LEFT: Form ── */}
          <div>
            {/* STEP 1 — Describe tu contenido (global) */}
            <div style={{ border: '1px solid var(--border)', marginBottom: 2 }}>
              <div style={{
                padding: '16px 20px', background: 'var(--bg-1)',
                display: 'flex', alignItems: 'center', gap: 10,
                borderBottom: '1px solid var(--border)',
              }}>
                <StepNum n={1} />
                <span style={{ fontFamily: f, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-primary)' }}>
                  ¿Qué quieres publicar?
                </span>
                <span style={{ fontFamily: f, fontSize: 10, color: 'var(--text-tertiary)', marginLeft: 'auto' }}>Descripción global</span>
              </div>

              {/* Quick-pick chips */}
              <div style={{ padding: '18px 20px 10px' }}>
                <label style={labelStyle}>Tipo de publicación</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {REQUEST_KINDS.map(({ v, l, hint }) => (
                    <button type="button" key={v} onClick={() => pickKind(v, hint)} style={{
                      padding: '8px 14px',
                      border: `1px solid ${requestKind === v ? 'var(--accent)' : 'var(--border)'}`,
                      background: requestKind === v ? 'var(--accent)' : 'var(--bg)',
                      color: requestKind === v ? '#ffffff' : 'var(--text-secondary)',
                      fontFamily: f, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}>{l}</button>
                  ))}
                </div>
              </div>

              {/* Global free-text description */}
              <div style={{ padding: '10px 20px 20px' }}>
                <label style={labelStyle}>Descripción</label>
                <textarea
                  value={clientNote}
                  onChange={(e) => setClientNote(e.target.value)}
                  placeholder="Ej: Promo del menú de otoño todos los viernes: 2x1 en entrantes. Tono cercano, invita a reservar."
                  rows={3}
                  style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.7 }}
                />
                <p style={{ fontFamily: f, fontSize: 10, color: 'var(--text-tertiary)', marginTop: 6 }}>
                  Esta descripción vale para todas las fotos. Luego podrás añadir un contexto específico a cada una.
                </p>
              </div>

              {/* Global inspiration references */}
              <div style={{ borderTop: '1px solid var(--border)', padding: '16px 20px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div>
                    <label style={{ ...labelStyle, marginBottom: 2 }}>Referencias visuales</label>
                    <p style={{ fontFamily: f, fontSize: 10, color: 'var(--text-tertiary)', margin: 0 }}>
                      Elige imágenes de tu inspiración guardada para guiar al equipo
                    </p>
                  </div>
                  <button type="button"
                    onClick={() => { void ensureInspirations(); setShowGlobalInspirationPicker(v => !v); }}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '7px 14px', cursor: 'pointer', flexShrink: 0,
                      border: `1px solid ${showGlobalInspirationPicker ? '#0D9488' : 'var(--border)'}`,
                      background: showGlobalInspirationPicker ? 'rgba(13,148,136,0.08)' : 'var(--bg)',
                      fontFamily: f, fontSize: 11, fontWeight: 600,
                      color: showGlobalInspirationPicker ? '#0D9488' : 'var(--text-tertiary)',
                    }}>
                    <Flame size={12} />
                    {globalInspirationIds.length > 0 ? `${globalInspirationIds.length} seleccionada${globalInspirationIds.length === 1 ? '' : 's'}` : 'Elegir referencias'}
                  </button>
                </div>

                {/* Selected inspiration thumbnails */}
                {globalInspirationIds.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: showGlobalInspirationPicker ? 14 : 0 }}>
                    {globalInspirationIds.map(id => {
                      const ref = inspirations.find(r => r.id === id);
                      if (!ref) return null;
                      return (
                        <div key={id} style={{ position: 'relative', width: 64, height: 64 }}>
                          {ref.thumbnail_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={ref.thumbnail_url} alt={ref.title} style={{ width: 64, height: 64, objectFit: 'cover', display: 'block', border: '2px solid #0D9488' }} />
                          ) : (
                            <div style={{ width: 64, height: 64, background: 'var(--bg-2)', border: '2px solid #0D9488', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Flame size={16} style={{ color: '#0D9488' }} />
                            </div>
                          )}
                          <button type="button"
                            onClick={() => setGlobalInspirationIds(prev => prev.filter(x => x !== id))}
                            style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, background: '#111827', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                            <X size={10} style={{ color: '#ffffff' }} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Picker grid */}
                {showGlobalInspirationPicker && (
                  <div>
                    {!inspirationsLoaded ? (
                      <p style={{ fontFamily: f, fontSize: 11, color: 'var(--text-tertiary)' }}>Cargando...</p>
                    ) : inspirations.length === 0 ? (
                      <div style={{ padding: '16px', border: '1px solid var(--border)', background: 'var(--bg-1)', textAlign: 'center' }}>
                        <p style={{ fontFamily: f, fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 8 }}>
                          No tienes referencias guardadas todavía.
                        </p>
                        <a href="/inspiracion?tab=referencias" target="_blank" style={{ fontFamily: f, fontSize: 11, fontWeight: 600, color: '#0D9488', textDecoration: 'none' }}>
                          Ir a Referencias →
                        </a>
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8, maxHeight: 340, overflowY: 'auto', padding: 2 }}>
                        {inspirations.map(r => {
                          const selected = globalInspirationIds.includes(r.id);
                          const fmtColor: Record<string, string> = { image: '#3B82F6', reel: '#EF4444', carousel: '#F59E0B', video: '#8B5CF6' };
                          const fmtLabel: Record<string, string> = { image: 'Imagen', reel: 'Reel', carousel: 'Carrusel', video: 'Vídeo' };
                          const fmt = r.format ?? r.type ?? 'image';
                          const isVideo = fmt === 'reel' || fmt === 'video';
                          const isCarousel = fmt === 'carousel';
                          return (
                            <div key={r.id} style={{ position: 'relative', border: `2px solid ${selected ? '#0D9488' : 'var(--border)'}`, background: '#000', display: 'flex', flexDirection: 'column' }}>
                              {/* Image area — click to SELECT */}
                              <button type="button"
                                onClick={() => setGlobalInspirationIds(prev =>
                                  selected ? prev.filter(x => x !== r.id) : [...prev, r.id]
                                )}
                                style={{ padding: 0, cursor: 'pointer', border: 'none', background: 'transparent', display: 'block', position: 'relative', aspectRatio: '1' }}
                              >
                                {r.thumbnail_url ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={r.thumbnail_url} alt={r.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', opacity: selected ? 1 : 0.8 }} />
                                ) : (
                                  <div style={{ width: '100%', height: '100%', minHeight: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#111', padding: 6 }}>
                                    {isVideo ? <Film size={24} color="#6b7280" /> : isCarousel ? <Images size={24} color="#6b7280" /> : <Flame size={24} color="#6b7280" />}
                                  </div>
                                )}
                                {/* Format badge */}
                                <div style={{ position: 'absolute', top: 4, left: 4, background: fmtColor[fmt] ?? '#6b7280', padding: '2px 5px' }}>
                                  <span style={{ fontFamily: f, fontSize: 8, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    {fmtLabel[fmt] ?? fmt}
                                  </span>
                                </div>
                                {/* Type icon for carousel/video */}
                                {(isVideo || isCarousel) && (
                                  <div style={{ position: 'absolute', bottom: 4, left: 4, color: 'rgba(255,255,255,0.9)' }}>
                                    {isVideo ? <Film size={12} /> : <Images size={12} />}
                                  </div>
                                )}
                                {/* Selected check */}
                                {selected && (
                                  <div style={{ position: 'absolute', top: 4, right: 4, width: 18, height: 18, background: '#0D9488', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Check size={11} style={{ color: '#ffffff' }} />
                                  </div>
                                )}
                              </button>
                              {/* Footer: title + expand button */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 6px', background: '#111', minHeight: 28 }}>
                                <span style={{ fontFamily: f, fontSize: 9, color: '#d1d5db', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.title}>
                                  {r.title}
                                </span>
                                {/* Expand / lightbox button */}
                                <button type="button"
                                  onClick={(e) => { e.stopPropagation(); setLightboxRef(r); }}
                                  style={{ padding: 3, background: 'transparent', border: 'none', cursor: 'pointer', flexShrink: 0, color: '#9ca3af', display: 'flex', alignItems: 'center' }}
                                  title="Ver en grande"
                                >
                                  <Maximize2 size={11} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* STEP 2 — Tus fotos + ajustes */}
            <div style={{ border: '1px solid var(--border)', marginBottom: 2 }}>
              <div style={{
                padding: '16px 20px', background: 'var(--bg-1)',
                display: 'flex', alignItems: 'center', gap: 10,
                borderBottom: '1px solid var(--border)',
              }}>
                <StepNum n={2} />
                <span style={{ fontFamily: f, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-primary)' }}>
                  Tus fotos
                </span>
                <span style={{ fontFamily: f, fontSize: 10, color: 'var(--text-tertiary)', marginLeft: 'auto' }}>
                  {selectedMedia.length} seleccionada{selectedMedia.length === 1 ? '' : 's'}
                </span>
              </div>

              {/* Media picker */}
              <div style={{ padding: '20px' }}>
                <MediaPicker selected={selectedMedia} onChange={setSelectedMedia} max={maxImages} />
              </div>

              {/* Per-image notes + inspiration */}
              {selectedMedia.length > 0 && (
                <div style={{ borderTop: '1px solid var(--border)' }}>
                  <div style={{ padding: '14px 20px', background: 'var(--bg-1)' }}>
                    <span style={{ fontFamily: f, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-primary)' }}>
                      Contexto por imagen
                    </span>
                    <span style={{ fontFamily: f, fontSize: 10, color: 'var(--text-tertiary)', marginLeft: 8 }}>
                      opcional — pulsa en una foto para añadir un comentario o una referencia
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '16px 20px' }}>
                    {selectedMedia.map((m, idx) => {
                      const per = perMedia[m.id] ?? { note: '', inspirationId: null };
                      const hasNote = per.note.trim().length > 0;
                      const hasInspo = !!per.inspirationId;
                      const isOpen = expandedMediaId === m.id;
                      return (
                        <button type="button" key={m.id}
                          onClick={() => setExpandedMediaId(isOpen ? null : m.id)}
                          style={{
                            position: 'relative', width: 76, height: 76, padding: 0,
                            border: `2px solid ${isOpen ? 'var(--accent)' : 'var(--border)'}`,
                            background: '#000', cursor: 'pointer',
                          }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={m.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                          <div style={{
                            position: 'absolute', bottom: 2, left: 2,
                            background: isOpen ? 'var(--accent)' : '#111827', color: '#ffffff',
                            fontFamily: fc, fontSize: 9, fontWeight: 700,
                            width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>{idx + 1}</div>
                          {hasNote && <div style={{ position: 'absolute', top: 2, left: 2, width: 6, height: 6, background: 'var(--accent)' }} />}
                          {hasInspo && (
                            <div style={{ position: 'absolute', top: 2, right: 2 }}>
                              <Flame size={10} style={{ color: 'var(--accent)' }} />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Active image editor */}
                  {expandedMediaId && (() => {
                    const m = selectedMedia.find((x) => x.id === expandedMediaId);
                    if (!m) return null;
                    const per = perMedia[m.id] ?? { note: '', inspirationId: null };
                    const setPer = (patch: Partial<PerMedia>) =>
                      setPerMedia((prev) => ({ ...prev, [m.id]: { ...(prev[m.id] ?? { note: '', inspirationId: null }), ...patch } }));
                    const currentInspo = inspirations.find((r) => r.id === per.inspirationId) ?? null;
                    return (
                      <div style={{ borderTop: '1px solid var(--border)', padding: '18px 20px', display: 'grid', gridTemplateColumns: '200px 1fr', gap: 16, alignItems: 'start' }}>
                        <div>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={m.url} alt="" style={{ width: '100%', height: 'auto', maxHeight: 240, objectFit: 'contain', display: 'block', background: 'transparent' }} />
                        </div>
                        <div>
                          <label style={labelStyle}>Contexto para esta imagen</label>
                          <textarea
                            value={per.note}
                            onChange={(e) => setPer({ note: e.target.value })}
                            placeholder="Ej: aquí destaca el plato del día y añade el precio con letras grandes."
                            rows={3}
                            style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6, marginBottom: 14 }}
                          />

                          <label style={labelStyle}>Inspiración (opcional)</label>
                          {currentInspo ? (
                            <div style={{
                              padding: '10px 12px', border: '1px solid var(--accent)',
                              background: 'var(--accent-soft, rgba(15,118,110,0.08))',
                              display: 'flex', gap: 10, alignItems: 'center',
                            }}>
                              {currentInspo.thumbnail_url && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={currentInspo.thumbnail_url} alt="" style={{ width: 36, height: 36, objectFit: 'cover', flexShrink: 0 }} />
                              )}
                              <span style={{ flex: 1, fontFamily: f, fontSize: 12, color: 'var(--accent)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {currentInspo.title}
                              </span>
                              <button type="button" onClick={() => setPer({ inspirationId: null })}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex' }}>
                                <X size={13} style={{ color: 'var(--accent)' }} />
                              </button>
                            </div>
                          ) : (
                            <button type="button"
                              onClick={() => { void ensureInspirations(); }}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                                padding: '10px 14px', cursor: 'pointer',
                                border: '1px solid var(--border)', background: 'var(--bg)',
                                fontFamily: f, fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)',
                              }}>
                              <Flame size={13} /> Elegir inspiración
                            </button>
                          )}
                          {!currentInspo && inspirationsLoaded && (
                            inspirations.length === 0 ? (
                              <p style={{ fontFamily: f, fontSize: 10, color: 'var(--text-tertiary)', marginTop: 8 }}>
                                No tienes referencias guardadas todavía. Guarda alguna en /inspiracion.
                              </p>
                            ) : (
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginTop: 8, maxHeight: 180, overflowY: 'auto' }}>
                                {inspirations.map((r) => (
                                  <button type="button" key={r.id} onClick={() => setPer({ inspirationId: r.id })}
                                    style={{ padding: 0, border: '1px solid var(--border)', background: '#000', cursor: 'pointer', position: 'relative', aspectRatio: '1' }}>
                                    {r.thumbnail_url ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img src={r.thumbnail_url} alt={r.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                    ) : (
                                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: f, fontSize: 10, color: '#9ca3af' }}>{r.title}</div>
                                    )}
                                  </button>
                                ))}
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Extras to generate + plan notice */}
              <div style={{ borderTop: '1px solid var(--border)', padding: '18px 20px' }}>
                <label style={labelStyle}>¿Quieres que generemos fotos extra?</label>
                {(() => {
                  const remaining = Math.max(0, maxImages - selectedMedia.length);
                  if (remaining === 0) {
                    return (
                      <p style={{ fontFamily: f, fontSize: 11, color: 'var(--text-tertiary)' }}>
                        Has alcanzado el máximo de {maxImages} fotos de tu plan.
                      </p>
                    );
                  }
                  return (
                    <>
                      <div style={{ display: 'flex', gap: 0 }}>
                        {[0, 1, 2, 3].filter((n) => n <= remaining).map((n, i, arr) => (
                          <button type="button" key={n} onClick={() => setExtraGenerated(n)}
                            style={{
                              ...toggleStyle(extraGenerated === n),
                              borderRight: i < arr.length - 1 ? 'none' : undefined,
                              minWidth: 48, padding: '10px 14px', justifyContent: 'center',
                            }}>
                            {n === 0 ? 'Ninguna' : `+${n}`}
                          </button>
                        ))}
                      </div>
                      <p style={{ fontFamily: f, fontSize: 10, color: 'var(--text-tertiary)', marginTop: 6 }}>
                        Total: <strong style={{ color: 'var(--text-primary)' }}>{finalQty} foto{finalQty === 1 ? '' : 's'}</strong>
                        {' · '}Tu plan permite hasta {maxImages}.
                        {extraGenerated > 0 && ' Las extras las generará el equipo.'}
                      </p>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* STEP 3 — ¿Para cuándo? */}
            <div style={{ border: '1px solid var(--border)', marginBottom: 2 }}>
              <div style={{
                padding: '16px 20px', background: 'var(--bg-1)',
                display: 'flex', alignItems: 'center', gap: 10,
                borderBottom: '1px solid var(--border)',
              }}>
                <StepNum n={3} />
                <span style={{ fontFamily: f, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-primary)' }}>
                  Fecha preferida para tenerlo
                </span>
                <span style={{ fontFamily: f, fontSize: 10, color: 'var(--text-tertiary)', marginLeft: 'auto' }}>
                  {urgency === 'urgente' ? 'URGENTE' : 'Flexible'}
                </span>
              </div>
              <div style={{ padding: '18px 20px' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                  {([
                    ['now',      'Hoy (30 min)'],
                    ['today',    'Hoy'],
                    ['tomorrow', 'Mañana'],
                    ['week',     'Esta semana'],
                    ['custom',   'Otro día'],
                  ] as const).map(([v, l]) => {
                    const active =
                      (v === 'now'      && timingPreset === '30min') ||
                      (v === 'today'    && timingPreset === 'today') ||
                      (v === 'tomorrow' && timingPreset === 'tomorrow') ||
                      (v === 'week'     && timingPreset === 'week') ||
                      (v === 'custom'   && timingPreset === 'custom');
                    const isUrgent = v === 'now';
                    return (
                      <button type="button" key={v} onClick={() => pickTiming(v)} style={{
                        padding: '8px 14px',
                        border: `1px solid ${active ? (isUrgent ? 'var(--warning, #e65100)' : 'var(--accent)') : 'var(--border)'}`,
                        background: active ? (isUrgent ? 'var(--warning, #e65100)' : 'var(--accent)') : 'var(--bg)',
                        color: active ? '#ffffff' : 'var(--text-secondary)',
                        fontFamily: f, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                      }}>{l}</button>
                    );
                  })}
                </div>
                {timingPreset === 'custom' && (
                  <input type="date" value={preferredDate} onChange={(e) => setPreferredDate(e.target.value)}
                    min={new Date().toISOString().slice(0, 10)} style={inputStyle} />
                )}
                {timingPreset === '30min' && (
                  <p style={{ fontFamily: f, fontSize: 11, color: 'var(--warning, #e65100)', fontWeight: 600 }}>
                    ⚡ Lo clasificaremos como urgente y el equipo empezará ahora mismo.
                  </p>
                )}
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
                {/* Target platforms — drives post.platform[] on submit so the
                    worker knows where to publish. Self-service uses
                    PostEditor's own picker; this one only shows in request
                    mode. */}
                <div style={{ padding: '18px 20px', background: 'var(--bg)' }}>
                  <label style={labelStyle}>
                    Publicar en
                  </label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {(['instagram', 'facebook', 'tiktok'] as const).map((p) => {
                      const active = requestPlatforms.includes(p);
                      const meta = { instagram: '📷 Instagram', facebook: '📘 Facebook', tiktok: '🎵 TikTok' }[p];
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => {
                            setRequestPlatforms(prev =>
                              prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p],
                            );
                          }}
                          style={{
                            padding: '8px 14px',
                            border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                            background: active ? 'var(--accent-light, #f0fdfa)' : 'var(--bg)',
                            color: active ? 'var(--accent)' : 'var(--text-secondary)',
                            fontFamily: f, fontSize: 13, fontWeight: active ? 700 : 500,
                            cursor: 'pointer',
                          }}
                        >
                          {meta}
                        </button>
                      );
                    })}
                  </div>
                  <p style={{ fontFamily: f, fontSize: 11, color: 'var(--text-tertiary)', marginTop: 8 }}>
                    Tu equipo adaptará el contenido a cada plataforma que marques.
                  </p>
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
                  ...(requestKind ? [{ label: 'Tipo', value: REQUEST_KINDS.find((k) => k.v === requestKind)?.l ?? requestKind }] : []),
                  { label: 'Fotos tuyas', value: `${selectedMedia.length}` },
                  ...(extraGenerated > 0 ? [{ label: 'Generadas', value: `+${extraGenerated}` }] : []),
                  { label: 'Total', value: `${finalQty} foto${finalQty === 1 ? '' : 's'}` },
                  { label: 'Urgencia', value: urgency === 'urgente' ? 'Urgente' : 'Flexible', highlight: urgency === 'urgente' },
                  ...(preferredDate ? [{ label: 'Para', value: new Date(preferredDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) }] : []),
                  ...(Object.values(perMedia).some((p) => p.note.trim()) ? [{ label: 'Contexto x foto', value: `${Object.values(perMedia).filter((p) => p.note.trim()).length}` }] : []),
                  ...(Object.values(perMedia).some((p) => p.inspirationId) ? [{ label: 'Inspiración', value: `${Object.values(perMedia).filter((p) => p.inspirationId).length}` }] : []),
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
