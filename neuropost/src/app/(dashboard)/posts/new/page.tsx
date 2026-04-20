'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, Check, Sparkles, Send, Paintbrush, Flame, X, Maximize2, ExternalLink, Film, Images, Video, ImageIcon, Clock } from 'lucide-react';
import { PostEditor } from '@/components/posts/PostEditor';
import { MediaPicker, type SelectedMedia } from '@/components/posts/MediaPicker';
import { useAppStore } from '@/store/useAppStore';
import { useSubscribedPlatforms } from '@/hooks/useSubscribedPlatforms';
import { PLAN_LIMITS, type ContentMode, type PostFormat, type SourceType } from '@/types';
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

  // ── Subscribed platforms ─────────────────────────────────────────────────
  const { platforms: subscribedPlatforms, platformsForFormat } = useSubscribedPlatforms();

  // ── Request (pedido) state ──────────────────────────────────────────────
  // Global description: quick-pick kind + free text
  const [clientNote, setClientNote] = useState('');
  const [requestKind, setRequestKind] = useState<string | null>(null);

  // ── Source + output format ─────────────────────────────────────────────
  // Step A: what did the client upload?
  const [sourceType, setSourceType] = useState<SourceType>('none');
  // Step B: what format should the output be?
  const [outputFormat, setOutputFormat] = useState<PostFormat>('image');
  // Video duration (only when outputFormat is video/reel)
  const [videoDuration, setVideoDuration] = useState<number>(10);

  // Target platforms for the request — filtered by plan + format
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

  // ── Paso 1: Objetivo del post (nivel 1) ────────────────────────────────
  type PostObjective = 'vender' | 'informar' | 'conectar' | 'ensenar' | 'demostrar';
  const [postObjective, setPostObjective] = useState<PostObjective | null>(null);

  const OBJECTIVES: { v: PostObjective; l: string; desc: string }[] = [
    { v: 'vender',    l: 'Vender',          desc: 'Promociones, ofertas, llamadas a reserva o compra' },
    { v: 'informar',  l: 'Informar',         desc: 'Novedades, eventos, horarios, recordatorios' },
    { v: 'conectar',  l: 'Conectar',         desc: 'Equipo, detrás de cámara, historia, preguntas' },
    { v: 'ensenar',   l: 'Enseñar',          desc: 'Tips, tutoriales, mitos, comparativas, datos' },
    { v: 'demostrar', l: 'Demostrar valor',  desc: 'Testimonios, antes/después, casos de éxito' },
  ];

  // Nivel 2: tipos específicos por objetivo
  const SUBTYPES: Record<PostObjective, { v: string; l: string; placeholder: string }[]> = {
    vender: [
      { v: 'promo',        l: 'Promoción / descuento',  placeholder: '¿Qué ofreces, desde cuándo, hasta cuándo, condiciones?' },
      { v: 'producto',     l: 'Destacar producto',      placeholder: '¿Qué producto o servicio quieres destacar? ¿Qué lo hace especial?' },
      { v: 'reserva',      l: 'Llamada a reserva',      placeholder: '¿Qué servicio ofreces? ¿Cómo se reserva? ¿Hay plazas limitadas?' },
      { v: 'sorteo',       l: 'Sorteo / concurso',      placeholder: '¿Qué sorteas? ¿Cómo participar? ¿Cuándo acaba?' },
      { v: 'novedad',      l: 'Novedad / lanzamiento',  placeholder: 'Presenta un producto, servicio o novedad. ¿Qué cambia o es nuevo?' },
      { v: 'colaboracion', l: 'Colaboración',           placeholder: '¿Con quién colaboras? ¿Qué hacéis juntos? ¿Hay algo especial para la audiencia?' },
    ],
    informar: [
      { v: 'evento',      l: 'Evento',                  placeholder: '¿Qué evento, cuándo, dónde, cómo se apuntan?' },
      { v: 'horarios',    l: 'Horarios / cambios',      placeholder: '¿Qué horario o cambio comunicas? ¿Desde cuándo aplica?' },
      { v: 'recordatorio',l: 'Recordatorio',            placeholder: '¿Qué quieres recordar a tu audiencia? ¿Hay fecha límite?' },
      { v: 'temporada',   l: 'Temporada / fecha',       placeholder: '¿Qué fecha o temporada especial es? ¿Cómo lo celebras en tu negocio?' },
      { v: 'faq',         l: 'FAQ / pregunta frecuente',placeholder: '¿Qué pregunta responderás? ¿Cuál es la respuesta en pocas palabras?' },
    ],
    conectar: [
      { v: 'equipo',        l: 'Equipo / personas',     placeholder: 'Presenta a tu equipo o a una persona. ¿Nombre, rol, algo curioso sobre ellos?' },
      { v: 'detras_camara', l: 'Detrás de cámara',      placeholder: 'Muestra el día a día o el proceso. ¿Qué momento o rutina quieres mostrar?' },
      { v: 'historia',      l: 'Historia / origen',     placeholder: '¿Qué historia quieres contar? ¿Cómo empezó tu negocio o por qué existe?' },
      { v: 'agradecimiento',l: 'Agradecimiento',        placeholder: '¿A quién agradeces? ¿Por qué? ¿Hay un hito o celebración detrás?' },
      { v: 'pregunta',      l: 'Pregunta a audiencia',  placeholder: '¿Qué pregunta quieres lanzar? ¿Qué quieres que responda tu comunidad?' },
    ],
    ensenar: [
      { v: 'tips',        l: 'Tips / consejos',         placeholder: '¿Cuántos tips? ¿Sobre qué tema? ¿Qué problema resuelven?' },
      { v: 'tutorial',    l: 'Tutorial / paso a paso',  placeholder: '¿Qué enseñas paso a paso? ¿Cuántos pasos? ¿Qué resultado obtiene el usuario?' },
      { v: 'mito',        l: 'Mito o verdad',           placeholder: '¿Qué mito desmientes o qué verdad reveladoras compartes sobre tu sector?' },
      { v: 'comparativa', l: 'Comparativa',             placeholder: '¿Qué comparas? ¿Cuál es la diferencia clave que quieres destacar?' },
      { v: 'dato',        l: 'Dato curioso',            placeholder: '¿Qué dato o estadística sorprendente quieres compartir?' },
    ],
    demostrar: [
      { v: 'testimonio',   l: 'Testimonio / reseña',   placeholder: 'Pega aquí la reseña o cuéntanos qué dijo el cliente.' },
      { v: 'antes_despues',l: 'Antes / después',       placeholder: '¿Qué tratamiento o servicio? ¿Cuánto tiempo entre ambas fotos? ¿Qué cambió?' },
      { v: 'caso_exito',   l: 'Caso de éxito',         placeholder: '¿Qué cliente o proyecto? ¿Cuál era el problema y cuál el resultado?' },
      { v: 'ugc',          l: 'Contenido de clientes', placeholder: '¿Qué compartió el cliente? ¿Quieres mencionarlo o agradecerlo?' },
    ],
  };

  function pickObjective(v: PostObjective) {
    setPostObjective(v);
    setRequestKind(null);
    setClientNote('');
  }

  function pickKind(v: string, placeholder: string) {
    setRequestKind(v);
    // Only pre-fill if the field is empty — don't overwrite what the user typed
    if (!clientNote.trim()) setClientNote('');
    // Store placeholder separately for use in textarea
    setActivePlaceholder(placeholder);
  }

  const [activePlaceholder, setActivePlaceholder] = useState('Describe qué quieres en esta publicación, qué mensaje quieres transmitir...');

  // Flat list for summary display
  const REQUEST_KINDS_FLAT = Object.values(SUBTYPES).flat();

  // Timing presets → derives urgency + scheduled_at
  function pickTiming(preset: 'today' | 'tomorrow' | 'week' | 'custom') {
    if (preset === 'today') {
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

  // Urgency is now derived, not a toggle: "today" → urgente.
  const urgency: 'flexible' | 'urgente' = timingPreset === 'today' ? 'urgente' : 'flexible';

  const limits = PLAN_LIMITS[brand?.plan ?? 'starter'];
  const allowStories = limits.storiesPerWeek > 0;
  const maxImages = limits.carouselMaxPhotos;
  const allowVideos = limits.videosPerWeek > 0;

  // Sync requestPlatforms when output format changes
  useEffect(() => {
    const available = platformsForFormat(outputFormat);
    setRequestPlatforms((prev) => {
      const filtered = prev.filter((p) => available.includes(p));
      return filtered.length > 0 ? filtered : [available[0]];
    });
  }, [outputFormat, platformsForFormat]);

  // Derive available output formats based on sourceType
  const availableOutputFormats: { value: PostFormat; label: string; icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>; desc: string }[] = (() => {
    switch (sourceType) {
      case 'photos':
        if (selectedMedia.length === 1) {
          return [
            { value: 'image', label: 'Foto', icon: ImageIcon, desc: 'Publicar como foto' },
            { value: 'video', label: 'Vídeo / Reel', icon: Film, desc: 'Generar vídeo a partir de la foto' },
          ];
        }
        return [
          { value: 'carousel', label: 'Carrusel', icon: Images, desc: 'Publicar como carrusel de fotos' },
          { value: 'video', label: 'Vídeo / Reel', icon: Film, desc: 'Generar vídeo a partir de las fotos' },
        ];
      case 'video':
        return [
          { value: 'video', label: 'Vídeo / Reel', icon: Film, desc: 'Publicar como vídeo/reel' },
        ];
      case 'none':
      default:
        return [
          { value: 'image', label: 'Foto', icon: ImageIcon, desc: 'La IA genera la foto' },
          { value: 'carousel', label: 'Carrusel', icon: Images, desc: 'La IA genera varias fotos' },
          { value: 'video', label: 'Vídeo / Reel', icon: Film, desc: 'La IA genera el vídeo desde cero' },
        ];
    }
  })();

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
    const isVideo = outputFormat === 'video' || outputFormat === 'reel';
    if (!clientNote.trim() && !requestKind) {
      toast.error('Describe qué quieres publicar o elige un tipo');
      return;
    }
    if (!isVideo && finalQty > maxImages) { toast.error(`Máximo ${maxImages} fotos según tu plan`); return; }
    if (!isVideo && finalQty === 0) { toast.error('Selecciona al menos una foto o pide que generemos una'); return; }
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
        post_objective: postObjective,
        request_kind: requestKind,
        global_description: clientNote.trim(),
        source_type: sourceType,
        output_format: outputFormat,
        video_duration: (outputFormat === 'video' || outputFormat === 'reel') ? videoDuration : null,
        user_provided_count: selectedMedia.length,
        extra_to_generate: extraGenerated,
        total_quantity: finalQty,
        urgency,
        timing_preset: timingPreset,
        preferred_date: preferredDate || null,
        extra_notes: extraNotes || null,
        proposed_caption: proposedCaption.trim() || null,
        global_inspiration_ids: globalInspirationIds.length > 0 ? globalInspirationIds : null,
        per_image: perImageMeta,
      });

      let created = 0;

      if (isVideo) {
        // Video/reel: single post with all source files as context
        const sourceFiles = selectedMedia.map(m => m.url);
        const res = await fetch('/api/posts', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            caption: clientNote.trim(),
            image_url: selectedMedia[0]?.url ?? null,
            status: 'request',
            source_type: sourceType,
            format: outputFormat,
            video_duration: videoDuration,
            platform: requestPlatforms.length > 0 ? requestPlatforms : ['instagram'],
            scheduled_at: preferredDate ? new Date(preferredDate).toISOString() : null,
            ai_explanation: JSON.stringify({ ...JSON.parse(meta), source_files: sourceFiles }),
          }),
        });
        if (res.ok) created++;
      } else {
        // Photo/carousel: one post per image
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
              image_url: media?.url ?? null,
              status: 'request',
              source_type: sourceType,
              format: outputFormat,
              video_duration: null,
              platform: requestPlatforms.length > 0 ? requestPlatforms : ['instagram'],
              scheduled_at: preferredDate ? new Date(preferredDate).toISOString() : null,
              ai_explanation: meta,
            }),
          });
          if (res.ok) created++;
        }
      }

      if (created > 0) {
        setRequestSent(true);
        toast.success(`Solicitud enviada (${created} ${isVideo ? 'vídeo' : `post${created > 1 ? 's' : ''}`}). Nuestro equipo ya está trabajando en ello.`);
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
      <div className="page-content dashboard-unified-page" style={{ maxWidth: 960 }}>
        <div className="dashboard-unified-header" style={{ padding: '48px 0 24px' }}>
          <h1 style={{
            fontFamily: fc, fontWeight: 900,
            fontSize: 'clamp(2.5rem, 5vw, 3.5rem)',
            textTransform: 'uppercase', letterSpacing: '0.01em',
            color: 'var(--text-primary)', lineHeight: 0.95, marginBottom: 10,
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
                ...(postObjective ? [{ label: 'Objetivo', value: OBJECTIVES.find(o => o.v === postObjective)?.l ?? postObjective }] : []),
                ...(requestKind ? [{ label: 'Tipo', value: REQUEST_KINDS_FLAT.find((k) => k.v === requestKind)?.l ?? requestKind }] : []),
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
                setPostObjective(null); setClientNote(''); setRequestKind(null);
                setActivePlaceholder('Describe qué quieres en esta publicación, qué mensaje quieres transmitir...');
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

    // Ready: must have picked an objective + have a description.
    // For photo/carousel: need at least one photo (selected OR extras to generate).
    // For video/reel: source photos optional.
    const isVideoFormat = outputFormat === 'video' || outputFormat === 'reel';
    const isReady = !!postObjective
      && (clientNote.trim().length > 0 || !!requestKind)
      && (isVideoFormat || finalQty > 0);

    return (
      <div className="page-content dashboard-unified-page" style={{ maxWidth: 900 }}>

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
        <div className="dashboard-unified-header" style={{ padding: '48px 0 24px' }}>
          <button onClick={() => setMode(null)} style={{
            fontFamily: f, fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)',
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.08em',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <ArrowRight size={12} style={{ transform: 'rotate(180deg)' }} /> Volver
          </button>
          <h1 style={{
            fontFamily: fc, fontWeight: 900,
            fontSize: 'clamp(2.5rem, 5vw, 3.5rem)',
            textTransform: 'uppercase', letterSpacing: '0.01em',
            color: 'var(--text-primary)', lineHeight: 0.95, marginBottom: 10,
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

            {/* ═══ PASO 1 — Objetivo del post ════════════════════════════ */}
            <div style={{ border: '1px solid var(--border)', marginBottom: 2 }}>
              <div style={{ padding: '12px 20px', background: '#111827', display: 'flex', alignItems: 'center', gap: 10 }}>
                <StepNum n={1} />
                <span style={{ fontFamily: f, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#ffffff' }}>
                  ¿Qué quieres comunicar?
                </span>
              </div>
              {/* Nivel 1: objetivos en fila compacta */}
              <div style={{ padding: '12px 20px 10px', display: 'flex', gap: 4 }}>
                {OBJECTIVES.map(({ v, l }) => {
                  const active = postObjective === v;
                  return (
                    <button type="button" key={v} onClick={() => pickObjective(v)} style={{
                      flex: 1, padding: '10px 6px', textAlign: 'center', cursor: 'pointer',
                      border: `2px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                      background: active ? 'rgba(15,118,110,0.07)' : 'var(--bg)',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                    }}>
                      <span style={{ fontFamily: f, fontSize: 11, fontWeight: 700, color: active ? 'var(--accent)' : 'var(--text-primary)' }}>{l}</span>
                    </button>
                  );
                })}
              </div>

              {/* Nivel 2: subtipos + campo "Otro" */}
              {postObjective && (
                <div style={{ borderTop: '1px solid var(--border)', padding: '10px 20px 12px' }}>
                  <label style={{ ...labelStyle, marginBottom: 8 }}>Tipo específico</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {SUBTYPES[postObjective].map(({ v, l, placeholder }) => (
                      <button type="button" key={v} onClick={() => pickKind(v, placeholder)} style={{
                        padding: '6px 12px',
                        border: `1px solid ${requestKind === v ? 'var(--accent)' : 'var(--border)'}`,
                        background: requestKind === v ? 'var(--accent)' : 'var(--bg)',
                        color: requestKind === v ? '#ffffff' : 'var(--text-secondary)',
                        fontFamily: f, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                      }}>{l}</button>
                    ))}
                    <button type="button" onClick={() => pickKind('otro', '')} style={{
                      padding: '6px 12px',
                      border: `1px solid ${requestKind === 'otro' ? 'var(--accent)' : 'var(--border)'}`,
                      background: requestKind === 'otro' ? 'var(--accent)' : 'var(--bg)',
                      color: requestKind === 'otro' ? '#ffffff' : 'var(--text-tertiary)',
                      fontFamily: f, fontSize: 11, fontWeight: 500, cursor: 'pointer',
                    }}>Otro</button>
                  </div>
                  {/* Cuando selecciona "Otro" aparece un campo de descripción obligatorio */}
                  {requestKind === 'otro' && (
                    <textarea
                      value={clientNote}
                      onChange={(e) => setClientNote(e.target.value)}
                      placeholder="Describe qué quieres publicar y qué mensaje quieres transmitir."
                      rows={2}
                      style={{ ...inputStyle, resize: 'none', lineHeight: 1.6, marginTop: 10, fontSize: 13 }}
                    />
                  )}
                </div>
              )}
            </div>

            {/* ═══ PASO 2 — ¿Tienes material? (compacto) ════════════════ */}
            <div style={{ border: '1px solid var(--border)', marginBottom: 2 }}>
              <div style={{ padding: '12px 20px', background: 'var(--bg-1)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <StepNum n={2} />
                <span style={{ fontFamily: f, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-primary)' }}>
                  ¿Tienes material o lo creamos nosotros?
                </span>
              </div>
              <div style={{ padding: '10px 20px 12px', display: 'flex', gap: 4 }}>
                {([
                  { v: 'photos' as const, l: 'Subo mis fotos', icon: ImageIcon },
                  ...(allowVideos ? [{ v: 'video' as const, l: 'Subo un vídeo', icon: Video }] : []),
                ] as const).map(({ v, l, icon: Icon }) => {
                  const active = sourceType === v;
                  return (
                    <button type="button" key={v} onClick={() => {
                      setSourceType(v);
                      if (v === 'video') setOutputFormat('video');
                      else if (v === 'photos' && selectedMedia.length <= 1) setOutputFormat('image');
                    }} style={{
                      flex: 1, padding: '9px 14px',
                      border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                      background: active ? 'rgba(15,118,110,0.06)' : 'var(--bg)',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                    }}>
                      <Icon size={14} style={{ color: active ? 'var(--accent)' : 'var(--text-tertiary)', flexShrink: 0 }} />
                      <span style={{ fontFamily: f, fontSize: 12, fontWeight: active ? 700 : 500, color: active ? 'var(--accent)' : 'var(--text-primary)' }}>{l}</span>
                    </button>
                  );
                })}
                {allowVideos ? (
                  <button type="button" onClick={() => { setSourceType('none'); setOutputFormat('image'); }} style={{
                    flex: 1, padding: '9px 14px',
                    border: `1px solid ${sourceType === 'none' ? 'var(--accent)' : 'var(--border)'}`,
                    background: sourceType === 'none' ? 'rgba(15,118,110,0.06)' : 'var(--bg)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    <Sparkles size={14} style={{ color: sourceType === 'none' ? 'var(--accent)' : 'var(--text-tertiary)', flexShrink: 0 }} />
                    <span style={{ fontFamily: f, fontSize: 12, fontWeight: sourceType === 'none' ? 700 : 500, color: sourceType === 'none' ? 'var(--accent)' : 'var(--text-primary)' }}>Lo crea el equipo</span>
                  </button>
                ) : (
                  <div style={{ flex: 1, padding: '9px 14px', border: '1px solid var(--border)', background: 'var(--bg-1)', display: 'flex', alignItems: 'center', gap: 8, opacity: 0.6 }}>
                    <Sparkles size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                    <div>
                      <span style={{ fontFamily: f, fontSize: 12, color: 'var(--text-tertiary)', display: 'block' }}>Lo crea el equipo</span>
                      <span style={{ fontFamily: f, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-tertiary)', background: 'var(--bg-2)', padding: '1px 5px' }}>Plan Pro</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ═══ PASO 3 — Formato + Fotos (integrado) ═════════════════ */}
            <div style={{ border: '1px solid var(--border)', marginBottom: 2 }}>
              <div style={{ padding: '12px 20px', background: 'var(--bg-1)', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--border)' }}>
                <StepNum n={3} />
                <span style={{ fontFamily: f, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-primary)' }}>
                  ¿Qué formato?
                </span>
              </div>
              <div style={{ padding: '12px 20px' }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  {availableOutputFormats.map(({ value, label, icon: Icon }) => {
                    const active = outputFormat === value;
                    const disabled = value === 'video' && !allowVideos;
                    return (
                      <button type="button" key={value} onClick={() => !disabled && setOutputFormat(value)} style={{
                        flex: 1, padding: '9px 12px',
                        border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                        background: active ? 'var(--accent)' : disabled ? 'var(--bg-1)' : 'var(--bg)',
                        cursor: disabled ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', gap: 8,
                      }}>
                        <Icon size={15} style={{ color: active ? '#ffffff' : 'var(--text-tertiary)', flexShrink: 0 }} />
                        <div>
                          <span style={{ fontFamily: f, fontSize: 12, fontWeight: active ? 700 : 500, color: active ? '#ffffff' : 'var(--text-primary)', display: 'block' }}>{label}</span>
                          {disabled && <span style={{ fontFamily: f, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-tertiary)', background: 'var(--bg-2)', padding: '1px 5px', display: 'inline-block' }}>Plan superior</span>}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Carrusel: selector de nº de slides */}
                {outputFormat === 'carousel' && (
                  <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontFamily: f, fontSize: 11, color: 'var(--text-tertiary)' }}>Slides:</span>
                    <div style={{ display: 'flex', gap: 0 }}>
                      {Array.from({ length: maxImages }, (_, i) => i + 2).map((n, i, arr) => {
                        const active = finalQty === n || (i === arr.length - 1 && finalQty > arr[arr.length - 1]);
                        const borderColor = active ? 'var(--accent)' : 'var(--border)';
                        return (
                          <button type="button" key={n} onClick={() => {
                            const toAdd = Math.max(0, n - selectedMedia.length);
                            setExtraGenerated(Math.min(toAdd, 3));
                          }} style={{
                            padding: '6px 12px', minWidth: 36, textAlign: 'center',
                            borderTop: `1px solid ${borderColor}`, borderBottom: `1px solid ${borderColor}`,
                            borderLeft: `1px solid ${borderColor}`, borderRight: i < arr.length - 1 ? 'none' : `1px solid ${borderColor}`,
                            background: active ? 'var(--accent)' : 'var(--bg)',
                            color: active ? '#ffffff' : 'var(--text-secondary)',
                            fontFamily: f, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                          }}>{n}</button>
                        );
                      })}
                    </div>
                    <span style={{ fontFamily: f, fontSize: 10, color: 'var(--text-tertiary)' }}>Máx. {maxImages}</span>
                  </div>
                )}

                {/* Video duration */}
                {(outputFormat === 'video' || outputFormat === 'reel') && (
                  <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontFamily: f, fontSize: 11, color: 'var(--text-tertiary)' }}>Duración:</span>
                    <div style={{ display: 'flex', gap: 0 }}>
                      {[6, 10, 15, 20, 30].map((sec, i, arr) => {
                        const active = videoDuration === sec;
                        const borderColor = active ? 'var(--accent)' : 'var(--border)';
                        return (
                          <button type="button" key={sec} onClick={() => setVideoDuration(sec)} style={{
                            padding: '6px 12px', minWidth: 40, textAlign: 'center',
                            borderTop: `1px solid ${borderColor}`, borderBottom: `1px solid ${borderColor}`,
                            borderLeft: `1px solid ${borderColor}`, borderRight: i < arr.length - 1 ? 'none' : `1px solid ${borderColor}`,
                            background: active ? 'var(--accent)' : 'var(--bg)',
                            color: active ? '#ffffff' : 'var(--text-secondary)',
                            fontFamily: f, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                          }}>{sec}s</button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* ── Tus fotos (integrado en paso 3, solo si sourceType !== none) ── */}
              {sourceType !== 'none' && (
                <div style={{ borderTop: '1px solid var(--border)' }}>
                  <div style={{ padding: '10px 20px', background: 'var(--bg-1)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ImageIcon size={12} style={{ color: 'var(--text-tertiary)' }} />
                    <span style={{ fontFamily: f, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-primary)' }}>
                      {sourceType === 'video' ? 'Tu vídeo' : 'Tus fotos'}
                    </span>
                    <span style={{ fontFamily: f, fontSize: 10, color: 'var(--text-tertiary)', marginLeft: 'auto' }}>
                      {selectedMedia.length} seleccionada{selectedMedia.length === 1 ? '' : 's'}
                    </span>
                  </div>
                  <div style={{ padding: '14px 20px' }}>
                    <MediaPicker selected={selectedMedia} onChange={setSelectedMedia} max={maxImages} />
                  </div>

                  {/* Per-image notes */}
                  {selectedMedia.length > 0 && (
                    <div style={{ borderTop: '1px solid var(--border)' }}>
                      <div style={{ padding: '10px 20px', background: 'var(--bg-1)' }}>
                        <span style={{ fontFamily: f, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-primary)' }}>
                          Contexto por foto
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '12px 20px' }}>
                        {selectedMedia.map((m, idx) => {
                          const per = perMedia[m.id] ?? { note: '', inspirationId: null };
                          const hasNote = per.note.trim().length > 0;
                          const hasInspo = !!per.inspirationId;
                          const isOpen = expandedMediaId === m.id;
                          return (
                            <button type="button" key={m.id}
                              onClick={() => setExpandedMediaId(isOpen ? null : m.id)}
                              style={{
                                position: 'relative', width: 68, height: 68, padding: 0,
                                border: `2px solid ${isOpen ? 'var(--accent)' : hasNote ? '#0D9488' : 'var(--border)'}`,
                                background: '#000', cursor: 'pointer',
                              }}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={m.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', imageOrientation: 'from-image' }} />
                              <div style={{ position: 'absolute', bottom: 2, left: 2, background: isOpen ? 'var(--accent)' : '#111827', color: '#ffffff', fontFamily: fc, fontSize: 9, fontWeight: 700, width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{idx + 1}</div>
                              {hasInspo && <div style={{ position: 'absolute', top: 2, right: 2 }}><Flame size={9} style={{ color: 'var(--accent)' }} /></div>}
                            </button>
                          );
                        })}
                      </div>

                      {expandedMediaId && (() => {
                        const m = selectedMedia.find((x) => x.id === expandedMediaId);
                        if (!m) return null;
                        const per = perMedia[m.id] ?? { note: '', inspirationId: null };
                        const setPer = (patch: Partial<PerMedia>) =>
                          setPerMedia((prev) => ({ ...prev, [m.id]: { ...(prev[m.id] ?? { note: '', inspirationId: null }), ...patch } }));
                        const currentInspo = inspirations.find((r) => r.id === per.inspirationId) ?? null;
                        return (
                          <div style={{ borderTop: '1px solid var(--border)', padding: '14px 20px', display: 'grid', gridTemplateColumns: '140px 1fr', gap: 14, alignItems: 'start' }}>
                            <div>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={m.url} alt="" style={{ width: '100%', height: 'auto', maxHeight: 180, objectFit: 'contain', display: 'block', imageOrientation: 'from-image' }} />
                            </div>
                            <div>
                              <label style={labelStyle}>¿Qué quieres hacer con esta foto?</label>
                              <textarea
                                value={per.note}
                                onChange={(e) => setPer({ note: e.target.value })}
                                placeholder="Ej: Retocar la iluminación, añadir texto en la parte superior..."
                                rows={3}
                                style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5, marginBottom: 10, fontSize: 13 }}
                              />
                              <label style={labelStyle}>Inspiración</label>
                              {currentInspo ? (
                                <div style={{ padding: '8px 10px', border: '1px solid var(--accent)', background: 'rgba(15,118,110,0.06)', display: 'flex', gap: 8, alignItems: 'center' }}>
                                  {currentInspo.thumbnail_url && (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={currentInspo.thumbnail_url} alt="" style={{ width: 28, height: 28, objectFit: 'cover', flexShrink: 0 }} />
                                  )}
                                  <span style={{ flex: 1, fontFamily: f, fontSize: 11, color: 'var(--accent)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentInspo.title}</span>
                                  <button type="button" onClick={() => setPer({ inspirationId: null })} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex' }}>
                                    <X size={11} style={{ color: 'var(--accent)' }} />
                                  </button>
                                </div>
                              ) : (
                                <button type="button" onClick={() => { void ensureInspirations(); }} style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '8px 12px', cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--bg)', fontFamily: f, fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)' }}>
                                  <Flame size={12} /> Elegir inspiración
                                </button>
                              )}
                              {!currentInspo && inspirationsLoaded && inspirations.length > 0 && (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4, marginTop: 8, maxHeight: 120, overflowY: 'auto' }}>
                                  {inspirations.map((r) => (
                                    <button type="button" key={r.id} onClick={() => setPer({ inspirationId: r.id })} style={{ padding: 0, border: '1px solid var(--border)', background: '#000', cursor: 'pointer', position: 'relative', aspectRatio: '1' }}>
                                      {r.thumbnail_url ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={r.thumbnail_url} alt={r.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                      ) : (
                                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: f, fontSize: 9, color: '#9ca3af' }}>{r.title}</div>
                                      )}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* Extras a generar */}
                  {outputFormat !== 'video' && outputFormat !== 'reel' && (() => {
                    const remaining = Math.max(0, maxImages - selectedMedia.length);
                    if (remaining === 0) return null;
                    return (
                      <div style={{ borderTop: '1px solid var(--border)', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontFamily: f, fontSize: 11, color: 'var(--text-secondary)', flexShrink: 0 }}>Fotos extra a generar:</span>
                        <div style={{ display: 'flex', gap: 0 }}>
                          {[0, 1, 2, 3].filter((n) => n <= remaining).map((n, i, arr) => {
                            const active = extraGenerated === n;
                            const borderColor = active ? 'var(--accent)' : 'var(--border)';
                            return (
                              <button type="button" key={n} onClick={() => setExtraGenerated(n)} style={{
                                minWidth: 40, padding: '6px 10px', textAlign: 'center', cursor: 'pointer',
                                borderTop: `1px solid ${borderColor}`, borderBottom: `1px solid ${borderColor}`,
                                borderLeft: `1px solid ${borderColor}`, borderRight: i < arr.length - 1 ? 'none' : `1px solid ${borderColor}`,
                                background: active ? 'var(--accent)' : 'var(--bg)',
                                color: active ? '#ffffff' : 'var(--text-tertiary)',
                                fontFamily: f, fontSize: 11, fontWeight: 600,
                              }}>
                                {n === 0 ? '0' : `+${n}`}
                              </button>
                            );
                          })}
                        </div>
                        <span style={{ fontFamily: f, fontSize: 10, color: 'var(--text-tertiary)' }}>
                          Total: <strong style={{ color: 'var(--text-primary)' }}>{finalQty}</strong> / {maxImages}
                        </span>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* ═══ PASO 4 — Briefing (compacto) ════════════════════════ */}
            <div style={{ border: '1px solid var(--border)', marginBottom: 2 }}>
              <div style={{ padding: '12px 20px', background: 'var(--bg-1)', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--border)' }}>
                <StepNum n={4} />
                <span style={{ fontFamily: f, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-primary)' }}>
                  Cuéntanos el detalle
                </span>
              </div>
              {requestKind !== 'otro' && (
                <div style={{ padding: '12px 20px 14px' }}>
                  <textarea
                    value={clientNote}
                    onChange={(e) => setClientNote(e.target.value)}
                    placeholder={activePlaceholder}
                    rows={3}
                    style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6, fontSize: 13 }}
                  />
                </div>
              )}
              {requestKind === 'otro' && (
                <p style={{ padding: '10px 20px', fontFamily: f, fontSize: 11, color: 'var(--text-tertiary)', margin: 0 }}>
                  Ya escribiste tu descripción en el paso 1.
                </p>
              )}

              {/* Referencias visuales — colapsables */}
              <div style={{ borderTop: '1px solid var(--border)', padding: '10px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)' }}>
                    Referencias visuales
                    {globalInspirationIds.length > 0 && <span style={{ marginLeft: 6, color: '#0D9488' }}>({globalInspirationIds.length})</span>}
                  </span>
                  <button type="button"
                    onClick={() => { void ensureInspirations(); setShowGlobalInspirationPicker(v => !v); }}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', cursor: 'pointer', border: `1px solid ${showGlobalInspirationPicker ? '#0D9488' : 'var(--border)'}`, background: showGlobalInspirationPicker ? 'rgba(13,148,136,0.08)' : 'var(--bg)', fontFamily: f, fontSize: 11, fontWeight: 600, color: showGlobalInspirationPicker ? '#0D9488' : 'var(--text-tertiary)' }}>
                    <Flame size={11} />
                    {globalInspirationIds.length > 0 ? `${globalInspirationIds.length} seleccionada${globalInspirationIds.length === 1 ? '' : 's'}` : 'Elegir'}
                  </button>
                </div>

                {globalInspirationIds.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    {globalInspirationIds.map(id => {
                      const ref = inspirations.find(r => r.id === id);
                      if (!ref) return null;
                      return (
                        <div key={id} style={{ position: 'relative', width: 48, height: 48 }}>
                          {ref.thumbnail_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={ref.thumbnail_url} alt={ref.title} style={{ width: 48, height: 48, objectFit: 'cover', display: 'block', border: '2px solid #0D9488' }} />
                          ) : (
                            <div style={{ width: 48, height: 48, background: 'var(--bg-2)', border: '2px solid #0D9488', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Flame size={12} style={{ color: '#0D9488' }} />
                            </div>
                          )}
                          <button type="button" onClick={() => setGlobalInspirationIds(prev => prev.filter(x => x !== id))}
                            style={{ position: 'absolute', top: -5, right: -5, width: 16, height: 16, background: '#111827', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                            <X size={9} style={{ color: '#ffffff' }} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {showGlobalInspirationPicker && (
                  <div style={{ marginTop: 10 }}>
                    {!inspirationsLoaded ? (
                      <p style={{ fontFamily: f, fontSize: 11, color: 'var(--text-tertiary)' }}>Cargando...</p>
                    ) : inspirations.length === 0 ? (
                      <div style={{ padding: '12px', border: '1px solid var(--border)', background: 'var(--bg-1)', textAlign: 'center' }}>
                        <p style={{ fontFamily: f, fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 6 }}>No tienes referencias guardadas todavía.</p>
                        <a href="/inspiracion?tab=referencias" target="_blank" style={{ fontFamily: f, fontSize: 11, fontWeight: 600, color: '#0D9488', textDecoration: 'none' }}>Ir a Referencias →</a>
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 6, maxHeight: 260, overflowY: 'auto' }}>
                        {inspirations.map(r => {
                          const selected = globalInspirationIds.includes(r.id);
                          const fmtColor: Record<string, string> = { image: '#3B82F6', reel: '#EF4444', carousel: '#F59E0B', video: '#8B5CF6' };
                          const fmtLabel: Record<string, string> = { image: 'Imagen', reel: 'Reel', carousel: 'Carrusel', video: 'Vídeo' };
                          const fmt = r.format ?? r.type ?? 'image';
                          const isVideo = fmt === 'reel' || fmt === 'video';
                          const isCarousel = fmt === 'carousel';
                          return (
                            <div key={r.id} style={{ position: 'relative', border: `2px solid ${selected ? '#0D9488' : 'var(--border)'}`, background: '#000', display: 'flex', flexDirection: 'column' }}>
                              <button type="button" onClick={() => setGlobalInspirationIds(prev => selected ? prev.filter(x => x !== r.id) : [...prev, r.id])}
                                style={{ padding: 0, cursor: 'pointer', border: 'none', background: 'transparent', display: 'block', position: 'relative', aspectRatio: '1' }}>
                                {r.thumbnail_url ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={r.thumbnail_url} alt={r.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', opacity: selected ? 1 : 0.8 }} />
                                ) : (
                                  <div style={{ width: '100%', height: '100%', minHeight: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#111' }}>
                                    {isVideo ? <Film size={20} color="#6b7280" /> : isCarousel ? <Images size={20} color="#6b7280" /> : <Flame size={20} color="#6b7280" />}
                                  </div>
                                )}
                                <div style={{ position: 'absolute', top: 3, left: 3, background: fmtColor[fmt] ?? '#6b7280', padding: '1px 4px' }}>
                                  <span style={{ fontFamily: f, fontSize: 7, fontWeight: 700, color: '#fff', textTransform: 'uppercase' }}>{fmtLabel[fmt] ?? fmt}</span>
                                </div>
                                {(isVideo || isCarousel) && <div style={{ position: 'absolute', bottom: 3, left: 3, color: 'rgba(255,255,255,0.9)' }}>{isVideo ? <Film size={10} /> : <Images size={10} />}</div>}
                                {selected && <div style={{ position: 'absolute', top: 3, right: 3, width: 16, height: 16, background: '#0D9488', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={10} style={{ color: '#ffffff' }} /></div>}
                              </button>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '4px 5px', background: '#111', minHeight: 22 }}>
                                <span style={{ fontFamily: f, fontSize: 8, color: '#d1d5db', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.title}>{r.title}</span>
                                <button type="button" onClick={(e) => { e.stopPropagation(); setLightboxRef(r); }} style={{ padding: 2, background: 'transparent', border: 'none', cursor: 'pointer', flexShrink: 0, color: '#9ca3af', display: 'flex' }} title="Ver en grande"><Maximize2 size={9} /></button>
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

            {/* STEP 5 — ¿Para cuándo? (compacto) */}
            <div style={{ border: '1px solid var(--border)', marginBottom: 2 }}>
              <div style={{ padding: '12px 20px', background: 'var(--bg-1)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <StepNum n={5} />
                <span style={{ fontFamily: f, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-primary)' }}>
                  ¿Para cuándo?
                </span>
                {timingPreset && <span style={{ fontFamily: f, fontSize: 10, color: urgency === 'urgente' ? '#e65100' : 'var(--text-tertiary)', marginLeft: 'auto', fontWeight: urgency === 'urgente' ? 700 : 400 }}>
                  {urgency === 'urgente' ? 'URGENTE' : preferredDate ? new Date(preferredDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : 'Flexible'}
                </span>}
              </div>
              <div style={{ padding: '10px 20px 12px', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {([['today','Hoy'],['tomorrow','Mañana'],['week','Esta semana'],['custom','Otro día']] as const).map(([v, l]) => {
                  const active = timingPreset === v;
                  return (
                    <button type="button" key={v} onClick={() => pickTiming(v)} style={{
                      padding: '7px 12px',
                      border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                      background: active ? 'var(--accent)' : 'var(--bg)',
                      color: active ? '#ffffff' : 'var(--text-secondary)',
                      fontFamily: f, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    }}>{l}</button>
                  );
                })}
                {timingPreset === 'custom' && (
                  <input type="date" value={preferredDate} onChange={(e) => setPreferredDate(e.target.value)}
                    min={new Date().toISOString().slice(0, 10)}
                    style={{ ...inputStyle, padding: '7px 10px', fontSize: 12, width: 'auto' }} />
                )}
              </div>
            </div>

            {/* STEP 6 — Detalles opcionales (compacto) */}
            <div style={{ border: '1px solid var(--border)', marginBottom: 32 }}>
              <div style={{ padding: '12px 20px', background: 'var(--bg-1)', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--border)' }}>
                <StepNum n={6} />
                <span style={{ fontFamily: f, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-primary)' }}>
                  Detalles extra
                </span>
                <span style={{ fontFamily: f, fontSize: 10, color: 'var(--text-tertiary)', marginLeft: 'auto' }}>Opcional</span>
              </div>
              <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Caption sugerido</label>
                  <textarea value={proposedCaption} onChange={(e) => setProposedCaption(e.target.value)}
                    placeholder="Si ya tienes una idea de texto, escríbela aquí."
                    rows={2} style={{ ...inputStyle, resize: 'none', lineHeight: 1.5, fontSize: 13 }} />
                </div>
                <div>
                  <label style={labelStyle}>Notas para el equipo</label>
                  <textarea value={extraNotes} onChange={(e) => setExtraNotes(e.target.value)}
                    placeholder="Tono, referencias, restricciones..."
                    rows={2} style={{ ...inputStyle, resize: 'none', lineHeight: 1.5, fontSize: 13 }} />
                </div>
                <div>
                  <label style={labelStyle}>Publicar en</label>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {platformsForFormat(outputFormat).map((p) => {
                      const active = requestPlatforms.includes(p);
                      const meta: Record<string, string> = { instagram: '📷 Instagram', facebook: '📘 Facebook', tiktok: '🎵 TikTok' };
                      return (
                        <button key={p} type="button"
                          onClick={() => setRequestPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])}
                          style={{
                            padding: '7px 12px',
                            border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                            background: active ? 'rgba(15,118,110,0.08)' : 'var(--bg)',
                            color: active ? 'var(--accent)' : 'var(--text-secondary)',
                            fontFamily: f, fontSize: 12, fontWeight: active ? 700 : 500, cursor: 'pointer',
                          }}>
                          {meta[p] ?? p}
                        </button>
                      );
                    })}
                  </div>
                  <p style={{ fontFamily: f, fontSize: 10, color: 'var(--text-tertiary)', marginTop: 6 }}>
                    Solo redes contratadas. El equipo adaptará el contenido a cada plataforma.
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
                  ...(postObjective ? [{ label: 'Objetivo', value: OBJECTIVES.find(o => o.v === postObjective)?.l ?? postObjective }] : [{ label: 'Objetivo', value: '—', highlight: true }]),
                  ...(requestKind ? [{ label: 'Tipo', value: REQUEST_KINDS_FLAT.find((k) => k.v === requestKind)?.l ?? requestKind }] : []),
                  { label: 'Material', value: sourceType === 'none' ? 'Lo crea el equipo' : sourceType === 'video' ? 'Vídeo propio' : 'Fotos propias' },
                  { label: 'Formato', value: { image: 'Foto', video: 'Vídeo/Reel', reel: 'Reel', carousel: 'Carrusel', story: 'Story' }[outputFormat] ?? outputFormat },
                  ...((outputFormat === 'video' || outputFormat === 'reel') ? [{ label: 'Duración', value: `${videoDuration}s` }] : []),
                  ...(sourceType !== 'none' ? [{ label: 'Fotos tuyas', value: `${selectedMedia.length}` }] : []),
                  ...(extraGenerated > 0 ? [{ label: 'Generadas', value: `+${extraGenerated}` }] : []),
                  ...((outputFormat !== 'video' && outputFormat !== 'reel') ? [{ label: 'Total', value: `${finalQty} foto${finalQty === 1 ? '' : 's'}` }] : []),
                  { label: 'Urgencia', value: urgency === 'urgente' ? 'Urgente' : 'Flexible', highlight: urgency === 'urgente' },
                  ...(preferredDate ? [{ label: 'Para', value: new Date(preferredDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) }] : []),
                  { label: 'Plataformas', value: requestPlatforms.map(p => ({ instagram: 'IG', facebook: 'FB', tiktok: 'TK' }[p])).join(', ') },
                  ...(Object.values(perMedia).some((p) => p.note.trim()) ? [{ label: 'Contexto x foto', value: `${Object.values(perMedia).filter((p) => p.note.trim()).length}` }] : []),
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
    <div className="page-content dashboard-unified-page" style={{ maxWidth: 1200 }}>
      <div className="dashboard-unified-header" style={{ padding: '48px 0 24px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1 style={{ fontFamily: fc, fontWeight: 900, fontSize: 'clamp(2.5rem, 5vw, 3.5rem)', textTransform: 'uppercase', letterSpacing: '0.01em', color: 'var(--text-primary)', lineHeight: 0.95, marginBottom: 10 }}>
            Crear contenido
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 15, fontFamily: f }}>
            Edita, genera ideas y publica tu contenido
          </p>
        </div>
        <button onClick={() => setMode(null)} style={{
          fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', background: 'none',
          border: 'none', padding: 0, cursor: 'pointer', fontFamily: f,
          textTransform: 'uppercase', letterSpacing: '0.08em',
          display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
        }}>
          <ArrowRight size={12} style={{ transform: 'rotate(180deg)' }} /> Volver
        </button>
      </div>
      <PostEditor brandName={brand?.name ?? 'Tu negocio'} allowStories={allowStories} onSave={handleSave} />
    </div>
  );
}
