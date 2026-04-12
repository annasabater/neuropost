'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { X, Plus, Trash2, Send, Zap, Flame, Heart } from 'lucide-react';
import toast from 'react-hot-toast';
import { MediaPicker, type SelectedMedia } from '@/components/posts/MediaPicker';
import { useAppStore } from '@/store/useAppStore';
import { PLAN_LIMITS } from '@/types';
import type { IdeaItem } from '@/types';

const f  = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

// ─── Types ────────────────────────────────────────────────────────────────────

type Template = {
  id: string; title: string; description: string; thumbnail_url: string | null;
  sectors: string[]; styles: string[]; format: string; tags: string[]; times_used: number;
};
type Reference = {
  id: string; type: string; source_url: string | null; thumbnail_url: string | null;
  title: string; notes: string | null; style_tags: string[] | null; format: string | null;
  created_at: string; recreation?: { id: string; status: string } | null;
};
type SavedIdea = { id: string; title: string; caption: string; format: string; hashtags: string[] };
type Campaign  = { key: string; prompt: string; img: string; format: string };

// ─── Constants ────────────────────────────────────────────────────────────────

const UNS = (id: string, w = 400) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&q=80&auto=format&fit=crop`;

const CAMPAIGNS: Campaign[] = [
  { key: 'summer',       format: 'reel',     img: UNS('1507525428034-b723cf961d3e'), prompt: 'Campaña de verano: contenido fresco y veraniego para aumentar ventas en la temporada estival' },
  { key: 'valentines',   format: 'image',    img: UNS('1518199266791-5375a83190b7'), prompt: 'Campaña San Valentín: ideas románticas y ofertas especiales para parejas' },
  { key: 'backToSchool', format: 'carousel', img: UNS('1503676260728-1c00da094a0b'), prompt: 'Campaña vuelta al cole: contenido enfocado en familia y preparación para septiembre' },
  { key: 'blackFriday',  format: 'carousel', img: UNS('1607083206869-4c7672e72a8a'), prompt: 'Campaña Black Friday: ofertas especiales, descuentos y urgencia de compra' },
  { key: 'christmas',    format: 'image',    img: UNS('1512389142860-9c449e58a814'), prompt: 'Campaña Navidad: contenido festivo, felicitaciones y regalos especiales' },
  { key: 'newYear',      format: 'reel',     img: UNS('1467810563316-b5476525c0f9'), prompt: 'Campaña Año Nuevo: propósitos, nuevos comienzos y celebración de logros' },
  { key: 'loyalty',      format: 'image',    img: UNS('1521791136064-7986c2920216'), prompt: 'Contenido de fidelización: agradecimiento a clientes, historias de éxito y testimonios' },
  { key: 'launch',       format: 'carousel', img: UNS('1460925895917-afdab827c52f'), prompt: 'Lanzamiento de nuevo producto o servicio: generar expectación y conversión' },
];

const CAMPAIGN_LABELS: Record<string, string> = {
  summer: 'Verano', valentines: 'San Valentín', backToSchool: 'Vuelta al cole',
  blackFriday: 'Black Friday', christmas: 'Navidad', newYear: 'Año Nuevo',
  loyalty: 'Fidelización', launch: 'Lanzamiento',
};

const IDEA_BANK: SavedIdea[] = [
  { id: 's1',  title: 'Reel de proceso de cocina',      caption: 'Muestra cómo preparas tu plato estrella paso a paso',               format: 'reel',     hashtags: ['cocina','receta','restaurante'] },
  { id: 's2',  title: 'Foto de producto con fondo limpio', caption: 'Destaca tu producto estrella con fondo neutro y luz natural',    format: 'image',    hashtags: ['producto','foto','ecommerce'] },
  { id: 's3',  title: 'Reel de antes y después',        caption: 'Transforma un espacio, look o plato y muestra el resultado',        format: 'reel',     hashtags: ['antesydespues','transformacion'] },
  { id: 's4',  title: 'Carrusel de tips del sector',    caption: '3-5 consejos útiles para tu audiencia en formato carrusel',         format: 'carousel', hashtags: ['tips','consejos'] },
  { id: 's5',  title: 'Video de equipo',                caption: 'Presenta a tu equipo de forma cercana y profesional',               format: 'video',    hashtags: ['equipo','detrasdelascamaras'] },
  { id: 's6',  title: 'Foto de ambiente del local',     caption: 'Captura la esencia de tu espacio con buena luz',                    format: 'image',    hashtags: ['local','ambiente','interiorismo'] },
  { id: 's7',  title: 'Reel de un día en el negocio',   caption: 'Muestra un día típico desde la apertura hasta el cierre',           format: 'reel',     hashtags: ['undia','negocio','rutina'] },
  { id: 's8',  title: 'Carrusel de preguntas frecuentes', caption: 'Responde las 5 dudas más comunes sobre tu negocio',              format: 'carousel', hashtags: ['faq','preguntas','negocio'] },
  { id: 's9',  title: 'Foto de producto hero',          caption: 'Tu producto estrella en primer plano con styling cuidado',          format: 'image',    hashtags: ['producto','hero','branding'] },
  { id: 's10', title: 'Reel de tendencia adaptada',     caption: 'Coge un audio viral y adáptalo a tu negocio',                      format: 'reel',     hashtags: ['tendencia','viral','reels'] },
  { id: 's11', title: 'Carrusel de proceso creativo',   caption: 'Muestra paso a paso cómo creas tu producto o servicio',            format: 'carousel', hashtags: ['proceso','creativo','making'] },
  { id: 's12', title: 'Foto de testimonio visual',      caption: 'Cita de cliente sobre fondo limpio con su foto',                   format: 'image',    hashtags: ['testimonio','cliente','review'] },
];

const FORMAT_OPTIONS = ['all', 'image', 'reel', 'carousel', 'video'];
const FORMAT_LABEL: Record<string, string> = { all: 'Todos', image: 'Imagen', reel: 'Reel', carousel: 'Carrusel', video: 'Vídeo', story: 'Story' };
const FORMAT_COLOR: Record<string, string> = { image: '#3B82F6', reel: '#EF4444', carousel: '#F59E0B', video: '#8B5CF6' };

// ─── Sub-components ─────────────────────────────────────────────────────���─────

// Curated Unsplash IDs — visually rich, content/social-media themed, all verified working
const FORMAT_FALLBACK: Record<string, string[]> = {
  image:    [
    '1611162616305-c69b3fa7fbe0', // vibrant neon lights
    '1493612276216-ee3925520721', // colorful creative workspace
    '1558618666-fcd25c85cd64', // bold product photography
    '1542744173-05336fcc7ad4', // bright creative desk
    '1501854140801-50d01698950b', // aerial colorful
  ],
  reel:     [
    '1574717024653-f3e8f4aa8d3e', // phone filming
    '1611532736597-de2d4265fba3', // vertical phone content
    '1598550476439-6a1f857b5757', // social media recording
    '1536240478227-bd2745d0ee8e', // video production
    '1467810563316-b5476525c0f9', // celebration reel
  ],
  carousel: [
    '1607082348824-0a96f2a4b9da', // product grid flatlay
    '1558769132-cb1aea458c5e', // styled grid
    '1511707171634-5f897ff02aa9', // tech product grid
    '1607083206869-4c7672e72a8a', // black friday dark
    '1460925895917-afdab827c52f', // laptop workspace
  ],
  video:    [
    '1536240478227-bd2745d0ee8e', // video studio
    '1574717024653-f3e8f4aa8d3e', // filming vertical
    '1611532736597-de2d4265fba3', // phone recording
    '1467810563316-b5476525c0f9', // night timelapse
    '1574717024653-f3e8f4aa8d3e', // content creator
  ],
};
function getFallbackImage(format: string | null | undefined, seed: string) {
  const arr = FORMAT_FALLBACK[format ?? ''] ?? FORMAT_FALLBACK.image;
  return `https://images.unsplash.com/photo-${arr[seed.charCodeAt(0) % arr.length]}?w=600&q=85&auto=format&fit=crop`;
}

function HeartBtn({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      title={active ? 'Quitar de favoritos' : 'Añadir a favoritos'}
      style={{
        width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: active ? '#e11d48' : 'rgba(0,0,0,0.55)',
        border: 'none', cursor: 'pointer', flexShrink: 0,
        transition: 'background 0.15s',
      }}
    >
      <Heart size={15} style={{ color: '#fff', fill: active ? '#fff' : 'none' }} />
    </button>
  );
}

function InspirationCard({ image, title, description, format, onSave, onRecreate, extraAction, onFavorite, isFavorited }: {
  image: string | null; title: string; description?: string; format?: string;
  tags?: string[]; onSave?: () => void; onRecreate?: () => void;
  extraAction?: React.ReactNode;
  onFavorite?: () => void; isFavorited?: boolean;
}) {
  const fallback = getFallbackImage(format, title);
  const imgSrc = image ?? fallback;
  return (
    <div style={{ background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'relative', overflow: 'hidden' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imgSrc}
          alt={title}
          onError={(e) => { if (e.currentTarget.src !== fallback) e.currentTarget.src = fallback; }}
          style={{ width: '100%', height: 200, objectFit: 'cover', display: 'block' }}
        />
        {format && (
          <div style={{ position: 'absolute', top: 8, left: 8, background: FORMAT_COLOR[format] ?? 'rgba(0,0,0,0.6)', color: '#fff', fontFamily: f, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', padding: '3px 8px' }}>
            {FORMAT_LABEL[format] ?? format}
          </div>
        )}
        <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 4 }}>
          {onFavorite && <HeartBtn active={!!isFavorited} onClick={onFavorite} />}
          {extraAction}
        </div>
      </div>
      <div style={{ padding: '14px 16px', flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <p style={{ fontFamily: fc, fontWeight: 900, fontSize: 14, textTransform: 'uppercase', color: 'var(--text-primary)', letterSpacing: '0.01em', lineHeight: 1.2 }}>{title}</p>
        {description && <p style={{ fontFamily: f, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55, flex: 1 }}>{description}</p>}
        {(onSave || onRecreate) && (
          <div style={{ display: 'flex', gap: 1, marginTop: 4 }}>
            {onSave && (
              <button type="button" onClick={onSave} style={{ flex: 1, padding: '8px 0', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', fontFamily: f, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', cursor: 'pointer' }}>
                Guardar
              </button>
            )}
            {onRecreate && (
              <button type="button" onClick={onRecreate} style={{ flex: 2, padding: '8px 0', border: 'none', background: '#0D9488', color: '#ffffff', fontFamily: fc, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', cursor: 'pointer' }}>
                Recrear →
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const TABS = ['ideas', 'campanas', 'plantillas', 'referencias', 'favoritos'] as const;
type Tab = typeof TABS[number];
const TAB_LABEL: Record<Tab, string> = { ideas: 'Ideas', campanas: 'Campañas', plantillas: 'Plantillas', referencias: 'Mis referencias', favoritos: 'Favoritos' };

// ─── Favorites helpers (localStorage) ────────────────────────────────────────

type FavoriteItem = {
  id: string; title: string; image: string | null; format: string | null;
  description: string | null; source: 'idea' | 'campaign' | 'template' | 'reference';
  savedAt: string;
};

const FAV_KEY = 'neuropost.inspiracion.favorites.v1';

function loadFavorites(): FavoriteItem[] {
  if (typeof window === 'undefined') return [];
  try { const raw = localStorage.getItem(FAV_KEY); return raw ? JSON.parse(raw) : []; } catch { return []; }
}

function saveFavorites(list: FavoriteItem[]) {
  try { localStorage.setItem(FAV_KEY, JSON.stringify(list)); } catch { /* ignore */ }
}

export default function InspiracionPage() {
  const searchParams  = useSearchParams();
  const router        = useRouter();
  const brand         = useAppStore((s) => s.brand);
  const planLimits    = PLAN_LIMITS[brand?.plan ?? 'starter'];
  const allowsVideo   = planLimits.videosPerWeek > 0;
  const maxImages     = planLimits.carouselMaxPhotos;

  // ── Tab ────────────────────────────────────────────────────────────────────
  const initialTab = (searchParams.get('tab') ?? 'ideas') as Tab;
  const [tab, setTab] = useState<Tab>((TABS as readonly string[]).includes(initialTab) ? initialTab : 'ideas');
  function switchTab(t: Tab) { setTab(t); router.replace(`/inspiracion?tab=${t}`, { scroll: false }); }

  // ── Templates + references ─────────────────────────────────────────────────
  const [templates,        setTemplates]        = useState<Template[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [references,       setReferences]       = useState<Reference[]>([]);
  const [loadingRefs,      setLoadingRefs]      = useState(true);
  const [filterFormat,     setFilterFormat]     = useState('all');
  const [page,             setPage]             = useState(1);
  const PAGE_SIZE = 12;

  useEffect(() => {
    fetch('/api/inspiracion/templates').then(r => r.json()).then(d => { setTemplates(d.templates ?? []); setLoadingTemplates(false); }).catch(() => setLoadingTemplates(false));
    fetch('/api/inspiracion/referencias').then(r => r.json()).then(d => { setReferences(d.references ?? []); setLoadingRefs(false); }).catch(() => setLoadingRefs(false));
  }, []);

  const filteredTemplates = templates
    .filter(t => filterFormat === 'all' || t.format === filterFormat)
    .sort((a, b) => (b.times_used ?? 0) - (a.times_used ?? 0));
  const totalPages    = Math.max(1, Math.ceil(filteredTemplates.length / PAGE_SIZE));
  const currentPage   = Math.min(page, totalPages);
  const pagedTemplates = filteredTemplates.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const maxTimesUsed  = templates.length ? Math.max(...templates.map(t => t.times_used ?? 0), 1) : 1;

  function handleFilterChange(v: string) { setFilterFormat(v); setPage(1); }

  // ── AI Ideas generator ──────────────────────────────────────────────────────
  const [aiIdeas,   setAiIdeas]   = useState<IdeaItem[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const promptRef  = useRef<HTMLInputElement>(null);

  const generateAiIdeas = useCallback(async (overridePrompt?: string) => {
    const prompt = overridePrompt ?? promptRef.current?.value.trim();
    if (!prompt) { toast.error('Escribe un prompt'); return; }
    setAiLoading(true);
    try {
      const res  = await fetch('/api/agents/ideas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, count: 3 }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error');
      setAiIdeas(json.data.ideas ?? []);
      toast.success(`${json.data.ideas?.length ?? 0} ideas generadas`);
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Error'); }
    finally { setAiLoading(false); }
  }, []);

  // ── Idea bank filter ───────────────────────────────────────────────────────
  const [ideaSearch,  setIdeaSearch]  = useState('');
  const [ideaFormat,  setIdeaFormat]  = useState('all');
  const filteredIdeas = IDEA_BANK.filter(idea => {
    const q = ideaSearch.toLowerCase();
    const matchQ = !q || idea.title.toLowerCase().includes(q) || idea.caption.toLowerCase().includes(q) || idea.hashtags.some(h => h.includes(q));
    const matchF = ideaFormat === 'all' || idea.format === ideaFormat;
    return matchQ && matchF;
  });

  // ── Campaign filter ────────────────────────────────────────────────────────
  const [campaignFormat, setCampaignFormat] = useState('all');
  const filteredCampaigns = CAMPAIGNS.filter(c => campaignFormat === 'all' || c.format === campaignFormat);

  // ── "Recrear" & "Guardar" for ideas/campaigns (simple post request) ─────────
  async function recreateIdea(idea: SavedIdea | Campaign, kind: 'idea' | 'campaign') {
    const title   = kind === 'idea' ? (idea as SavedIdea).title : CAMPAIGN_LABELS[(idea as Campaign).key];
    const caption = kind === 'idea' ? (idea as SavedIdea).caption : (idea as Campaign).prompt;
    const format  = idea.format;
    const res = await fetch('/api/posts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caption: `${title}\n${caption}`,
        status: 'request', format,
        platform: ['instagram'],
        ai_explanation: JSON.stringify({ request_kind: kind, idea_title: title, format }),
      }),
    });
    if (res.ok) toast.success('Solicitud enviada — el equipo ya está en ello ✓');
    else toast.error('Error al enviar');
  }

  async function saveIdeaAsRef(idea: SavedIdea | Campaign, kind: 'idea' | 'campaign') {
    const title  = kind === 'idea' ? (idea as SavedIdea).title : CAMPAIGN_LABELS[(idea as Campaign).key];
    const notes  = kind === 'idea' ? (idea as SavedIdea).caption : (idea as Campaign).prompt;
    const thumb  = kind === 'campaign' ? (idea as Campaign).img : null;
    const res = await fetch('/api/inspiracion/referencias', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: kind, title, thumbnail_url: thumb, format: idea.format, notes }),
    });
    if (res.ok) { const d = await res.json(); if (d.reference) setReferences(p => [d.reference, ...p]); toast.success('Guardada en Mis referencias'); }
    else toast.error('Error al guardar');
  }

  // ── "Añadir referencia" modal ──────────────────────────────────────────────
  const [showAddModal,  setShowAddModal]  = useState(false);
  const [addFormat,     setAddFormat]     = useState<'image' | 'reel' | 'carousel'>('image');
  const [addRefSource,  setAddRefSource]  = useState<'url' | 'upload'>('url');
  const [addRefUrl,     setAddRefUrl]     = useState('');
  const [addRefFile,    setAddRefFile]    = useState<File | null>(null);
  const [addOwnMedia,   setAddOwnMedia]   = useState<SelectedMedia[]>([]);
  const [addQuantity,   setAddQuantity]   = useState(1);
  const [addDescription, setAddDescription] = useState('');
  const [saving,        setSaving]        = useState(false);
  const [addSuccess,    setAddSuccess]    = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function resetAddForm() { setAddFormat('image'); setAddRefSource('url'); setAddRefUrl(''); setAddRefFile(null); setAddOwnMedia([]); setAddQuantity(1); setAddDescription(''); }

  async function handleSaveReference() {
    const hasRef = (addRefSource === 'url' && addRefUrl.trim().length > 0) || (addRefSource === 'upload' && !!addRefFile);
    if (!hasRef) { toast.error('Pega una URL o sube una imagen de referencia'); return; }
    if (addFormat === 'reel' && !allowsVideo) { toast.error('Tu plan no incluye vídeos'); return; }
    setSaving(true);
    try {
      let thumbnailUrl: string | null = null;
      if (addRefSource === 'upload' && addRefFile) {
        const fd = new FormData(); fd.append('file', addRefFile);
        const up = await fetch('/api/inspiracion/upload', { method: 'POST', body: fd });
        if (up.ok) { const d = await up.json(); thumbnailUrl = d.url ?? null; }
      }
      const refTitle = addDescription.trim().slice(0, 80) || `Referencia ${addFormat}`;
      const refRes = await fetch('/api/inspiracion/referencias', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: addRefSource, source_url: addRefSource === 'url' ? (addRefUrl || null) : null, thumbnail_url: thumbnailUrl, title: refTitle, notes: addDescription.trim() || null, format: addFormat }),
      });
      if (!refRes.ok) { const e = await refRes.json().catch(() => ({})); toast.error(`Error: ${e.error ?? refRes.status}`); setSaving(false); return; }
      const refData = await refRes.json();
      const newRef  = refData.reference;
      if (!newRef?.id) { toast.error('Respuesta inválida'); setSaving(false); return; }

      const ownUrls  = addOwnMedia.map((m) => m.url);
      const recRes   = await fetch('/api/inspiracion/recrear', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference_id: newRef.id, client_notes: [addDescription.trim(), `[FORMATO_DESEADO] ${addFormat}`, `[CANTIDAD] ${addQuantity}`].filter(Boolean).join('\n'), media_urls: ownUrls, style_to_adapt: [] }),
      });
      let recreation: { id: string; status: string } | null = null;
      if (recRes.ok) { const recData = await recRes.json(); recreation = recData.recreation ? { id: recData.recreation.id, status: recData.recreation.status } : null; }
      else { const e = await recRes.json().catch(() => ({})); toast.error(`Error solicitud: ${e.error ?? recRes.status}`); setSaving(false); return; }

      const postsToCreate = addFormat === 'reel' ? 1 : addQuantity;
      const meta = JSON.stringify({ from_inspiration: true, reference_id: newRef.id, recreation_id: recreation?.id ?? null, request_kind: 'inspiration_recreation', format: addFormat, quantity: addQuantity, global_description: addDescription.trim(), ordered_media_urls: ownUrls });
      for (let i = 0; i < postsToCreate; i++) {
        await fetch('/api/posts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ caption: addDescription.trim() || `Recreación inspirada — ${addFormat}`, image_url: ownUrls[i] ?? ownUrls[0] ?? thumbnailUrl ?? null, status: 'request', format: addFormat, platform: ['instagram'], scheduled_at: null, ai_explanation: meta }) }).catch(() => null);
      }
      setReferences((p) => [{ ...newRef, recreation }, ...p]);
      setAddSuccess(true);
      setTimeout(() => { setShowAddModal(false); setAddSuccess(false); resetAddForm(); }, 1800);
    } catch { toast.error('Error al enviar'); }
    finally { setSaving(false); }
  }

  // ── Recreate modal ─────────────────────────────────────────────────────────
  const [showRecreateModal,   setShowRecreateModal]   = useState(false);
  const [recreateTitle,       setRecreateTitle]       = useState('');
  const [recreateRefId,       setRecreateRefId]       = useState<string | null>(null);
  const [recreateSourceTemplate, setRecreateSourceTemplate] = useState<Template | null>(null);
  const [recreateRefThumb,    setRecreateRefThumb]    = useState<string | null>(null);
  const [recreateFormat,      setRecreateFormat]      = useState<string>('image');
  const [recreateNotes,       setRecreateNotes]       = useState('');
  const [recreateMedia,       setRecreateMedia]       = useState<SelectedMedia[]>([]);
  type CarouselSlot = { include: boolean; ownMediaId: string | null; note: string };
  const blankSlot = (): CarouselSlot => ({ include: true, ownMediaId: null, note: '' });
  const [recreateSlotCount, setRecreateSlotCount] = useState(4);
  const [recreateSlots, setRecreateSlots] = useState<CarouselSlot[]>(() => Array(4).fill(null).map(blankSlot));
  const [recreating,    setRecreating]    = useState(false);
  const [recreateSuccess, setRecreateSuccess] = useState(false);

  function openRecreateForTemplate(t: Template) { setRecreateSourceTemplate(t); setRecreateRefId(null); setRecreateTitle(t.title); setRecreateFormat(t.format ?? 'image'); setRecreateRefThumb(t.thumbnail_url ?? null); setRecreateNotes(''); setRecreateMedia([]); setRecreateSlotCount(4); setRecreateSlots(Array(4).fill(null).map(blankSlot)); setRecreateSuccess(false); setShowRecreateModal(true); }
  function openRecreateForRef(r: Reference) { setRecreateSourceTemplate(null); setRecreateRefId(r.id); setRecreateTitle(r.title); setRecreateFormat(r.format ?? 'image'); setRecreateRefThumb(r.thumbnail_url ?? null); setRecreateNotes(''); setRecreateMedia([]); setRecreateSlotCount(4); setRecreateSlots(Array(4).fill(null).map(blankSlot)); setRecreateSuccess(false); setShowRecreateModal(true); }

  async function handleRecreate() {
    if (!recreateNotes.trim() && recreateMedia.length === 0) { toast.error('Describe qué quieres o adjunta al menos una foto'); return; }
    setRecreating(true);
    let refId = recreateRefId;
    if (recreateSourceTemplate && !refId) {
      const sr = await fetch('/api/inspiracion/referencias', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'template', title: recreateSourceTemplate.title, thumbnail_url: recreateSourceTemplate.thumbnail_url, format: recreateSourceTemplate.format, style_tags: recreateSourceTemplate.styles, notes: '' }) });
      if (sr.ok) { const sd = await sr.json(); refId = sd.reference?.id ?? null; if (sd.reference) setReferences(p => [sd.reference, ...p]); }
    }
    if (!refId) { toast.error('Error'); setRecreating(false); return; }
    const mediaUrls = recreateMedia.map((m) => m.url);
    let composedNotes = recreateNotes.trim();
    if (recreateFormat === 'carousel') {
      const lines = recreateSlots.slice(0, recreateSlotCount).map((s, i) => {
        const header = `Slot ${i + 1}:`;
        if (!s.include) return `${header} NO HACER`;
        const parts: string[] = [];
        if (s.ownMediaId) { const owned = recreateMedia.find((m) => m.id === s.ownMediaId); if (owned) parts.push(`usar mi foto → ${owned.url}`); else parts.push('basarse en la referencia'); } else { parts.push('basarse en la referencia'); }
        if (s.note.trim()) parts.push(`indicaciones: ${s.note.trim()}`);
        return `${header} ${parts.join(' · ')}`;
      });
      composedNotes = `${composedNotes ? composedNotes + '\n\n' : ''}[CARRUSEL — ${recreateSlotCount} slots]\n${lines.join('\n')}`;
    }
    const res = await fetch('/api/inspiracion/recrear', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reference_id: refId, client_notes: composedNotes || null, media_urls: mediaUrls, style_to_adapt: [] }) });
    if (!res.ok) { const e = await res.json().catch(() => ({})); toast.error(`Error: ${e.error ?? res.status}`); setRecreating(false); return; }
    const d = await res.json();
    if (d.recreation) setReferences(p => p.map(r => r.id === refId ? { ...r, recreation: { id: d.recreation.id, status: d.recreation.status } } : r));

    const ownUrls = recreateMedia.map((m) => m.url);
    let postsToCreate: { caption: string; image_url: string | null }[] = [];
    if (recreateFormat === 'carousel') {
      postsToCreate = recreateSlots.slice(0, recreateSlotCount).map((s, i) => ({ slot: s, idx: i })).filter((x) => x.slot.include).map(({ slot, idx }) => {
        const owned = slot.ownMediaId ? recreateMedia.find((m) => m.id === slot.ownMediaId) ?? null : null;
        return { caption: [`Recreación inspirada (${idx + 1}/${recreateSlotCount}) — ${recreateTitle}`, slot.note.trim()].filter(Boolean).join(' — '), image_url: owned?.url ?? recreateRefThumb ?? null };
      });
    } else {
      postsToCreate = [{ caption: `Recreación inspirada — ${recreateTitle}${recreateNotes.trim() ? ' — ' + recreateNotes.trim() : ''}`, image_url: ownUrls[0] ?? recreateRefThumb ?? null }];
    }
    const meta = JSON.stringify({ from_inspiration: true, reference_id: refId, recreation_id: d.recreation?.id ?? null, request_kind: 'inspiration_recreation', format: recreateFormat, global_description: recreateNotes.trim(), ordered_media_urls: ownUrls });
    for (const p of postsToCreate) {
      await fetch('/api/posts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ caption: p.caption, image_url: p.image_url, status: 'request', format: recreateFormat, platform: ['instagram'], scheduled_at: null, ai_explanation: meta }) }).catch(() => null);
    }
    setRecreateSuccess(true);
    setTimeout(() => { setShowRecreateModal(false); setRecreateSuccess(false); setRecreating(false); setRecreateMedia([]); }, 2000);
  }

  async function handleDeleteRef(id: string) {
    const res = await fetch(`/api/inspiracion/referencias/${id}`, { method: 'DELETE' });
    if (res.ok) { setReferences(p => p.filter(r => r.id !== id)); toast.success('Eliminada'); } else toast.error('Error');
  }

  async function saveTemplate(template: Template) {
    const res = await fetch('/api/inspiracion/referencias', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'template', title: template.title, thumbnail_url: template.thumbnail_url, format: template.format, style_tags: template.styles, notes: '' }) });
    if (res.ok) { const d = await res.json(); setReferences(p => [d.reference, ...p]); toast.success('Guardado en Mis referencias'); } else toast.error('Error');
  }

  // ── Favorites ──────────────────────────────────────────────────────────────
  const [favorites, setFavorites] = useState<FavoriteItem[]>(() => loadFavorites());

  function isFav(id: string) { return favorites.some(f => f.id === id); }

  function toggleFav(item: FavoriteItem) {
    setFavorites(prev => {
      const exists = prev.some(f => f.id === item.id);
      const next = exists ? prev.filter(f => f.id !== item.id) : [{ ...item, savedAt: new Date().toISOString() }, ...prev];
      saveFavorites(next);
      return next;
    });
  }

  const inputStyle: React.CSSProperties = { width: '100%', padding: '12px 14px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', fontFamily: f, fontSize: 14, outline: 'none', boxSizing: 'border-box' };
  const labelSm: React.CSSProperties = { display: 'block', fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 8 };

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="page-content dashboard-feature-page dashboard-unified-page" style={{ maxWidth: 1000 }}>

      {/* Header */}
      <div className="dashboard-feature-header dashboard-unified-header" style={{ padding: '48px 0 24px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1 style={{ fontFamily: fc, fontWeight: 900, fontSize: 'clamp(2.5rem, 5vw, 3.5rem)', textTransform: 'uppercase', letterSpacing: '0.01em', color: 'var(--text-primary)', lineHeight: 0.95, marginBottom: 12 }}>Ideas e inspiración</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 15, fontFamily: f }}>Ideas, campañas y referencias para tu contenido</p>
        </div>
        <button onClick={() => setShowAddModal(true)} style={{ background: '#0D9488', color: '#ffffff', border: 'none', padding: '10px 24px', fontFamily: fc, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <Plus size={14} /> Añadir referencia
        </button>
      </div>

      <div className="dashboard-feature-body dashboard-unified-content">

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 28, overflowX: 'auto' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => switchTab(t)} style={{
            background: 'none', border: 'none', borderBottom: tab === t ? '2px solid #0D9488' : '2px solid transparent',
            cursor: 'pointer', padding: '0 20px 14px', flexShrink: 0,
            fontFamily: fc, fontSize: 16, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.02em',
            color: tab === t ? '#0D9488' : 'var(--text-tertiary)', transition: 'all 0.15s',
          }}>
            {TAB_LABEL[t]}
            {t === 'referencias' && references.length > 0 && (
              <span style={{ marginLeft: 6, fontFamily: f, fontSize: 10, fontWeight: 600, background: 'var(--bg-2)', color: 'var(--text-secondary)', padding: '2px 6px' }}>
                {references.length}
              </span>
            )}
            {t === 'favoritos' && favorites.length > 0 && (
              <span style={{ marginLeft: 6, fontFamily: f, fontSize: 10, fontWeight: 600, background: '#fce7f3', color: '#e11d48', padding: '2px 6px' }}>
                {favorites.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
           TAB 1: IDEAS
         ═══════════════════════════════════════════════════════════════════ */}
      {tab === 'ideas' && (
        <div>
          {/* AI generator */}
          <div style={{ border: '1px solid var(--border)', padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'center', marginBottom: 32 }}>
            <input ref={promptRef} placeholder="Describe tu negocio o pide ideas... (ej: cafetería, lanzamiento de producto verano)"
              onKeyDown={(e) => e.key === 'Enter' && generateAiIdeas()}
              style={{ flex: 1, border: 'none', outline: 'none', background: 'none', fontFamily: f, fontSize: 14, color: 'var(--text-primary)' }} />
            <button onClick={() => generateAiIdeas()} disabled={aiLoading} style={{
              background: 'var(--text-primary)', color: 'var(--bg)', border: 'none', padding: '8px 20px',
              fontFamily: fc, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
              cursor: aiLoading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: aiLoading ? 0.5 : 1,
            }}>
              {aiLoading ? <span className="loading-spinner" /> : <Zap size={14} />}
              {aiLoading ? 'Generando...' : 'Generar'}
            </button>
          </div>

          {/* AI-generated results */}
          {aiIdeas.length > 0 && (
            <div style={{ marginBottom: 40 }}>
              <p style={{ fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--accent)', marginBottom: 14, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
                Ideas generadas
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 1, background: 'var(--border)' }}>
                {aiIdeas.map((idea, i) => {
                  const favId = `ai-idea-${idea.title.slice(0,20)}-${idea.format}`;
                  return (
                    <div key={i} style={{ background: 'var(--bg)', padding: '20px 20px', position: 'relative' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <p style={{ fontFamily: fc, fontWeight: 800, fontSize: 14, textTransform: 'uppercase', color: 'var(--text-primary)', lineHeight: 1.2 }}>{idea.title}</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 8 }}>
                          <span style={{ background: FORMAT_COLOR[idea.format] ?? 'var(--bg-3)', color: '#fff', fontFamily: f, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '2px 7px' }}>{idea.format}</span>
                          <HeartBtn active={isFav(favId)} onClick={() => toggleFav({ id: favId, title: idea.title, image: null, format: idea.format, description: idea.caption, source: 'idea', savedAt: '' })} />
                        </div>
                      </div>
                      <p style={{ fontFamily: f, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 14 }}>{idea.caption}</p>
                      {idea.hashtags?.length > 0 && (
                        <p style={{ fontFamily: f, fontSize: 11, color: 'var(--accent)', marginBottom: 14 }}>{idea.hashtags.map(h => `#${h}`).join(' ')}</p>
                      )}
                      <div style={{ display: 'flex', gap: 1 }}>
                        <button type="button" onClick={() => saveIdeaAsRef({ id: `ai-${i}`, title: idea.title, caption: idea.caption, format: idea.format, hashtags: idea.hashtags ?? [] }, 'idea')}
                          style={{ flex: 1, padding: '8px 0', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', fontFamily: f, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', cursor: 'pointer' }}>
                          Guardar
                        </button>
                        <button type="button" onClick={() => recreateIdea({ id: `ai-${i}`, title: idea.title, caption: idea.caption, format: idea.format, hashtags: idea.hashtags ?? [] }, 'idea')}
                          style={{ flex: 2, padding: '8px 0', border: 'none', background: '#0D9488', color: '#ffffff', fontFamily: fc, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', cursor: 'pointer' }}>
                          Solicitar →
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Idea bank */}
          <div>
            <p style={{ fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--text-tertiary)', marginBottom: 14, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
              Banco de ideas
            </p>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
              <input value={ideaSearch} onChange={(e) => setIdeaSearch(e.target.value)} placeholder="Buscar ideas... (reel, tips, producto)"
                style={{ flex: '1 1 200px', padding: '8px 14px', border: '1px solid var(--border)', fontFamily: f, fontSize: 13, color: 'var(--text-primary)', outline: 'none' }} />
              <div style={{ display: 'flex', gap: 0 }}>
                {(['all', 'image', 'reel', 'video', 'carousel'] as const).map((fmt, i, arr) => (
                  <button key={fmt} onClick={() => setIdeaFormat(fmt)} style={{
                    padding: '6px 12px', border: '1px solid var(--border)', borderRight: i < arr.length - 1 ? 'none' : '1px solid var(--border)',
                    background: ideaFormat === fmt ? 'var(--text-primary)' : 'var(--bg)',
                    color: ideaFormat === fmt ? 'var(--bg)' : 'var(--text-tertiary)',
                    fontFamily: f, fontSize: 10, fontWeight: 600, cursor: 'pointer', textTransform: 'uppercase',
                  }}>
                    {FORMAT_LABEL[fmt]}
                  </button>
                ))}
              </div>
            </div>
            {filteredIdeas.length === 0 ? (
              <p style={{ fontFamily: f, fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center', padding: '32px 0' }}>Sin resultados</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 1, background: 'var(--border)' }}>
                {filteredIdeas.map(idea => (
                  <div key={idea.id} style={{ background: 'var(--bg)', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                      <p style={{ fontFamily: fc, fontWeight: 800, fontSize: 13, textTransform: 'uppercase', color: 'var(--text-primary)', lineHeight: 1.3, flex: 1 }}>{idea.title}</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                        <span style={{ background: FORMAT_COLOR[idea.format] ?? 'var(--bg-3)', color: '#fff', fontFamily: f, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '3px 7px' }}>{FORMAT_LABEL[idea.format] ?? idea.format}</span>
                        <HeartBtn active={isFav(idea.id)} onClick={() => toggleFav({ id: idea.id, title: idea.title, image: null, format: idea.format, description: idea.caption, source: 'idea', savedAt: '' })} />
                      </div>
                    </div>
                    <p style={{ fontFamily: f, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{idea.caption}</p>
                    <p style={{ fontFamily: f, fontSize: 11, color: 'var(--accent)' }}>{idea.hashtags.map(h => `#${h}`).join(' ')}</p>
                    <div style={{ display: 'flex', gap: 1, marginTop: 4 }}>
                      <button type="button" onClick={() => saveIdeaAsRef(idea, 'idea')} style={{ flex: 1, padding: '7px 0', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', fontFamily: f, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', cursor: 'pointer' }}>Guardar</button>
                      <button type="button" onClick={() => recreateIdea(idea, 'idea')} style={{ flex: 2, padding: '7px 0', border: 'none', background: '#0D9488', color: '#ffffff', fontFamily: fc, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', cursor: 'pointer' }}>Solicitar →</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
           TAB 2: CAMPAÑAS
         ═══════════════════════════════════════════════════════════════════ */}
      {tab === 'campanas' && (
        <div>
          {/* Format filter bar */}
          <div style={{ display: 'flex', marginBottom: 28, alignItems: 'center', gap: 12 }}>
            <span style={{ fontFamily: f, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', flexShrink: 0 }}>Formato</span>
            <div style={{ display: 'inline-flex', background: '#F3F4F6', borderRadius: 10, padding: 4, gap: 2, flexWrap: 'wrap' }}>
              {FORMAT_OPTIONS.filter(v => v !== 'story').map(v => (
                <button key={v} onClick={() => setCampaignFormat(v)} style={{
                  background: campaignFormat === v ? '#0D9488' : 'transparent',
                  border: 'none',
                  borderRadius: 7,
                  cursor: 'pointer',
                  fontFamily: f,
                  fontSize: 12,
                  fontWeight: campaignFormat === v ? 700 : 500,
                  color: campaignFormat === v ? '#ffffff' : '#6B7280',
                  padding: '6px 14px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  transition: 'all 0.15s',
                  boxShadow: campaignFormat === v ? '0 1px 3px rgba(13,148,136,0.25)' : 'none',
                }}>
                  {FORMAT_LABEL[v]}
                </button>
              ))}
            </div>
          </div>

          {filteredCampaigns.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <p style={{ fontFamily: fc, fontWeight: 900, fontSize: 20, textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: 8 }}>Sin campañas</p>
              <p style={{ fontFamily: f, fontSize: 13, color: 'var(--text-tertiary)' }}>Prueba con otro formato</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 1, background: 'var(--border)' }}>
              {filteredCampaigns.map(c => (
                <div key={c.key} style={{ background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ position: 'relative', overflow: 'hidden' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={c.img} alt={CAMPAIGN_LABELS[c.key]} style={{ width: '100%', height: 200, objectFit: 'cover', display: 'block' }} />
                    <div style={{ position: 'absolute', top: 8, left: 8, background: FORMAT_COLOR[c.format] ?? 'rgba(0,0,0,0.6)', color: '#fff', fontFamily: f, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', padding: '3px 8px' }}>{FORMAT_LABEL[c.format]}</div>
                    <div style={{ position: 'absolute', top: 8, right: 8 }}>
                      <HeartBtn active={isFav(`campaign-${c.key}`)} onClick={() => toggleFav({ id: `campaign-${c.key}`, title: CAMPAIGN_LABELS[c.key], image: c.img, format: c.format, description: c.prompt, source: 'campaign', savedAt: '' })} />
                    </div>
                  </div>
                  <div style={{ padding: '16px 18px', flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <p style={{ fontFamily: fc, fontWeight: 900, fontSize: 15, textTransform: 'uppercase', color: 'var(--text-primary)', letterSpacing: '0.01em' }}>{CAMPAIGN_LABELS[c.key]}</p>
                    <p style={{ fontFamily: f, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, flex: 1 }}>{c.prompt}</p>
                    <div style={{ display: 'flex', gap: 1 }}>
                      <button onClick={() => saveIdeaAsRef(c, 'campaign')} style={{ flex: 1, padding: '8px 0', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', fontFamily: f, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', cursor: 'pointer' }}>Guardar</button>
                      <button onClick={() => recreateIdea(c, 'campaign')} style={{ flex: 2, padding: '8px 0', border: 'none', background: '#0D9488', color: '#ffffff', fontFamily: fc, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', cursor: 'pointer' }}>Solicitar →</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
           TAB 3: PLANTILLAS
         ═══════════════════════════════════════════════════════════════════ */}
      {tab === 'plantillas' && (
        <div>
          {/* Format filter */}
          <div style={{ display: 'flex', marginBottom: 28, alignItems: 'center', gap: 12 }}>
            <span style={{ fontFamily: f, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', flexShrink: 0 }}>Formato</span>
            <div style={{ display: 'inline-flex', background: '#F3F4F6', borderRadius: 10, padding: 4, gap: 2, flexWrap: 'wrap' }}>
              {FORMAT_OPTIONS.map(v => (
                <button key={v} onClick={() => handleFilterChange(v)} style={{
                  background: filterFormat === v ? '#0D9488' : 'transparent',
                  border: 'none',
                  borderRadius: 7,
                  cursor: 'pointer',
                  fontFamily: f,
                  fontSize: 12,
                  fontWeight: filterFormat === v ? 700 : 500,
                  color: filterFormat === v ? '#ffffff' : '#6B7280',
                  padding: '6px 14px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  transition: 'all 0.15s',
                  boxShadow: filterFormat === v ? '0 1px 3px rgba(13,148,136,0.25)' : 'none',
                }}>
                  {FORMAT_LABEL[v]}
                </button>
              ))}
            </div>
          </div>

          {/* Trending indicator */}
          {filterFormat === 'all' && maxTimesUsed > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, padding: '8px 14px', border: '1px solid var(--accent-soft)', background: 'var(--accent-soft)' }}>
              <Flame size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
              <p style={{ fontFamily: f, fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>Ordenadas por más utilizadas — las más populares primero</p>
            </div>
          )}

          {loadingTemplates ? (
            <p style={{ color: 'var(--text-tertiary)', fontFamily: f }}>Cargando...</p>
          ) : filteredTemplates.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 20px' }}>
              <p style={{ fontFamily: fc, fontWeight: 900, fontSize: 24, textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: 8 }}>Sin resultados</p>
              <p style={{ fontSize: 14, color: 'var(--text-tertiary)', fontFamily: f }}>Prueba con otros filtros</p>
            </div>
          ) : (
            <>
              <div className="inspiration-gallery-grid" style={{ display: 'flex', flexWrap: 'wrap', gap: 2, background: 'transparent', padding: 0 }}>
                {pagedTemplates.map(t => (
                  <div key={t.id} style={{ flex: '1 1 260px', minWidth: 0, position: 'relative' }}>
                    {t.times_used >= maxTimesUsed * 0.6 && t.times_used > 0 && (
                      <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 10, background: '#111', color: '#fff', fontFamily: f, fontSize: 9, fontWeight: 700, padding: '3px 8px', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 4 }}>
                        🔥 Tendencia
                      </div>
                    )}
                    <InspirationCard image={t.thumbnail_url} title={t.title} description={t.description} format={t.format} tags={t.tags} onSave={() => saveTemplate(t)} onRecreate={() => openRecreateForTemplate(t)} isFavorited={isFav(`template-${t.id}`)} onFavorite={() => toggleFav({ id: `template-${t.id}`, title: t.title, image: t.thumbnail_url, format: t.format, description: t.description, source: 'template', savedAt: '' })} />
                  </div>
                ))}
              </div>
              {totalPages > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 24 }}>
                  <button type="button" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                    style={{ padding: '8px 14px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', fontFamily: f, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', opacity: currentPage === 1 ? 0.4 : 1 }}>← Anterior</button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                    <button type="button" key={n} onClick={() => setPage(n)}
                      style={{ minWidth: 36, padding: '8px 12px', border: '1px solid var(--border)', background: n === currentPage ? 'var(--text-primary)' : 'var(--bg)', color: n === currentPage ? 'var(--bg)' : 'var(--text-primary)', fontFamily: f, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{n}</button>
                  ))}
                  <button type="button" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                    style={{ padding: '8px 14px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', fontFamily: f, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', opacity: currentPage === totalPages ? 0.4 : 1 }}>Siguiente →</button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
           TAB 4: MIS REFERENCIAS
         ═══════════════════════════════════════════════════════════════════ */}
      {tab === 'referencias' && (
        <div>
          {loadingRefs ? (
            <p style={{ color: 'var(--text-tertiary)', fontFamily: f }}>Cargando...</p>
          ) : references.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 20px' }}>
              <p style={{ fontFamily: fc, fontWeight: 900, fontSize: 24, textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: 8 }}>Sin referencias</p>
              <p style={{ fontSize: 14, color: 'var(--text-tertiary)', fontFamily: f, marginBottom: 32 }}>Guarda plantillas, ideas o campañas que te gusten</p>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button onClick={() => switchTab('ideas')} style={{ background: 'var(--bg)', border: '1px solid var(--border)', padding: '12px 24px', fontFamily: fc, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', cursor: 'pointer', color: 'var(--text-primary)' }}>Ver ideas</button>
                <button onClick={() => switchTab('plantillas')} style={{ background: 'var(--text-primary)', color: 'var(--bg)', border: 'none', padding: '12px 24px', fontFamily: fc, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', cursor: 'pointer' }}>Ver plantillas →</button>
              </div>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, padding: '8px 14px', border: '1px solid var(--border)', background: 'var(--bg-1)' }}>
                <Send size={13} style={{ color: 'var(--text-tertiary)' }} />
                <p style={{ fontFamily: f, fontSize: 12, color: 'var(--text-secondary)' }}>Haz clic en <strong>Añadir referencia</strong> para guardar una URL o imagen de Instagram y solicitar que la recreemos para tu negocio.</p>
              </div>
              <div className="inspiration-gallery-grid" style={{ display: 'flex', flexWrap: 'wrap', gap: 2, background: 'transparent', padding: 0 }}>
                {references.map(ref => (
                  <div key={ref.id} style={{ position: 'relative', flex: '1 1 260px', minWidth: 0 }}>
                    <InspirationCard image={ref.thumbnail_url} title={ref.title} description={ref.notes ?? ''} format={ref.format ?? undefined} onRecreate={ref.recreation ? undefined : () => openRecreateForRef(ref)} isFavorited={isFav(`ref-${ref.id}`)} onFavorite={() => toggleFav({ id: `ref-${ref.id}`, title: ref.title, image: ref.thumbnail_url, format: ref.format, description: ref.notes, source: 'reference', savedAt: '' })} />
                    <button onClick={() => handleDeleteRef(ref.id)} title="Eliminar" style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', padding: '4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontFamily: f, fontSize: 10, fontWeight: 600 }}><Trash2 size={11} /> Eliminar</button>
                    {ref.recreation && (
                      <div style={{ position: 'absolute', top: 8, left: 8, background: ref.recreation.status === 'completed' ? 'var(--accent)' : 'rgba(0,0,0,0.6)', color: '#fff', fontFamily: f, fontSize: 9, fontWeight: 600, padding: '3px 8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        {ref.recreation.status === 'completed' ? '✓ Recreado' : 'En preparación'}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
           TAB 5: FAVORITOS
         ═══════════════════════════════════════════════════════════════════ */}
      {tab === 'favoritos' && (
        <div>
          {favorites.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 20px' }}>
              <div style={{ width: 56, height: 56, background: '#fce7f3', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <Heart size={26} style={{ color: '#e11d48' }} />
              </div>
              <p style={{ fontFamily: fc, fontWeight: 900, fontSize: 24, textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: 8 }}>Sin favoritos todavía</p>
              <p style={{ fontSize: 14, color: 'var(--text-tertiary)', fontFamily: f, marginBottom: 32 }}>
                Pulsa el ❤️ en cualquier idea, campaña, plantilla o referencia para guardarla aquí
              </p>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                {(['ideas','campanas','plantillas','referencias'] as const).map(t => (
                  <button key={t} onClick={() => switchTab(t)} style={{ background: 'var(--bg)', border: '1px solid var(--border)', padding: '10px 20px', fontFamily: fc, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', cursor: 'pointer', color: 'var(--text-primary)' }}>
                    {TAB_LABEL[t]}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <p style={{ fontFamily: f, fontSize: 12, color: 'var(--text-secondary)' }}>
                  {favorites.length} elemento{favorites.length !== 1 ? 's' : ''} guardado{favorites.length !== 1 ? 's' : ''}
                </p>
                <button
                  type="button"
                  onClick={() => { setFavorites([]); saveFavorites([]); }}
                  style={{ background: 'none', border: '1px solid var(--border)', padding: '6px 14px', fontFamily: f, fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.06em' }}
                >
                  Limpiar todo
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 1, background: 'var(--border)' }}>
                {favorites.map(fav => (
                  <div key={fav.id} style={{ position: 'relative' }}>
                    <InspirationCard
                      image={fav.image}
                      title={fav.title}
                      description={fav.description ?? ''}
                      format={fav.format ?? undefined}
                      isFavorited={true}
                      onFavorite={() => toggleFav(fav)}
                    />
                    <div style={{ position: 'absolute', bottom: 54, left: 8 }}>
                      <span style={{ background: 'rgba(0,0,0,0.6)', color: '#d1d5db', fontFamily: f, fontSize: 9, fontWeight: 600, padding: '2px 7px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        {fav.source === 'idea' ? 'Idea' : fav.source === 'campaign' ? 'Campaña' : fav.source === 'template' ? 'Plantilla' : 'Referencia'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      </div>

      {/* ─── Modal: Añadir referencia ─────────────────────────────────────────── */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'var(--bg)', padding: 32, width: '100%', maxWidth: 640, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontFamily: fc, fontSize: 20, fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-primary)' }}>Añadir referencia</h2>
              <button onClick={() => { setShowAddModal(false); resetAddForm(); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4 }} aria-label="Cerrar"><X size={20} /></button>
            </div>
            {addSuccess ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <p style={{ fontFamily: fc, fontSize: 24, fontWeight: 900, textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: 8 }}>✓ En preparación</p>
                <p style={{ fontFamily: f, fontSize: 14, color: 'var(--text-secondary)' }}>El equipo ya está trabajando en tu solicitud.</p>
              </div>
            ) : (
              <>
                <div style={{ marginBottom: 22 }}>
                  <label style={labelSm}>1. ¿Qué quieres que creemos?</label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {([{ v: 'image', l: 'Imagen' }, { v: 'carousel', l: 'Carrusel' }, { v: 'reel', l: 'Reel', locked: !allowsVideo }] as {v: 'image'|'reel'|'carousel'; l: string; locked?: boolean}[]).map(({ v, l, locked }) => (
                      <button type="button" key={v} disabled={locked} onClick={() => setAddFormat(v)} style={{ padding: '10px 16px', border: `1px solid ${addFormat === v ? 'var(--accent)' : 'var(--border)'}`, background: addFormat === v ? 'var(--accent)' : 'var(--bg)', color: addFormat === v ? '#fff' : locked ? 'var(--text-tertiary)' : 'var(--text-secondary)', fontFamily: f, fontSize: 12, fontWeight: 600, cursor: locked ? 'not-allowed' : 'pointer', opacity: locked ? 0.5 : 1 }}>
                        {l}{locked ? ' 🔒' : ''}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ marginBottom: 22 }}>
                  <label style={labelSm}>2. Tu referencia — URL o imagen de lo que quieres recrear</label>
                  <div style={{ display: 'flex', gap: 0, border: '1px solid var(--border)', marginBottom: 10 }}>
                    {(['url', 'upload'] as const).map((s) => (
                      <button type="button" key={s} onClick={() => setAddRefSource(s)} style={{ flex: 1, padding: 8, border: 'none', cursor: 'pointer', background: addRefSource === s ? 'var(--text-primary)' : 'var(--bg)', color: addRefSource === s ? 'var(--bg)' : 'var(--text-tertiary)', fontFamily: f, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s === 'url' ? 'Pegar URL' : 'Subir imagen'}</button>
                    ))}
                  </div>
                  {addRefSource === 'url'
                    ? <input key="ref-url" value={addRefUrl} onChange={(e) => setAddRefUrl(e.target.value)} placeholder="https://instagram.com/p/..." style={inputStyle} />
                    : <input key="ref-file" ref={fileInputRef} type="file" accept="image/*,video/*" onChange={(e) => setAddRefFile(e.target.files?.[0] ?? null)} style={inputStyle} />
                  }
                </div>
                <div style={{ marginBottom: 22 }}>
                  <label style={labelSm}>3. Tus fotos <span style={{ opacity: 0.6, textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>— opcional, varias permitidas</span></label>
                  <MediaPicker selected={addOwnMedia} onChange={setAddOwnMedia} max={maxImages} />
                </div>
                <div style={{ marginBottom: 22 }}>
                  <label style={labelSm}>4. ¿Cuántas {addFormat === 'reel' ? 'piezas' : 'fotos'} quieres?</label>
                  {addFormat === 'reel' ? (
                    <p style={{ fontFamily: f, fontSize: 12, color: 'var(--text-secondary)' }}>{allowsVideo ? '1 reel' : 'Tu plan no incluye vídeos.'}</p>
                  ) : (
                    <div style={{ display: 'flex', gap: 0 }}>
                      {Array.from({ length: Math.min(maxImages, 10) }, (_, i) => i + 1).map((n, i, arr) => (
                        <button type="button" key={n} onClick={() => setAddQuantity(n)} style={{ minWidth: 42, padding: '10px 12px', border: `1px solid ${addQuantity === n ? 'var(--accent)' : 'var(--border)'}`, borderRight: i < arr.length - 1 ? 'none' : undefined, background: addQuantity === n ? 'var(--accent)' : 'var(--bg)', color: addQuantity === n ? '#fff' : 'var(--text-tertiary)', fontFamily: f, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{n}</button>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ marginBottom: 24 }}>
                  <label style={labelSm}>5. Descripción <span style={{ opacity: 0.6, textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>— opcional</span></label>
                  <textarea value={addDescription} onChange={(e) => setAddDescription(e.target.value)} placeholder="Cuéntanos qué quieres conseguir, tono, qué destacar..." rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
                </div>
                <div style={{ display: 'flex', gap: 1 }}>
                  <button onClick={() => { setShowAddModal(false); resetAddForm(); }} style={{ flex: 1, padding: 12, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', fontFamily: f, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
                  <button onClick={handleSaveReference} disabled={saving} style={{ flex: 2, padding: 12, border: 'none', background: 'var(--text-primary)', color: 'var(--bg)', fontFamily: fc, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer', opacity: saving ? 0.5 : 1 }}>{saving ? 'Enviando...' : 'Enviar solicitud →'}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ─── Modal: Recrear ───────────────────────────────────────────────────── */}
      {showRecreateModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'var(--bg)', padding: 32, width: '100%', maxWidth: 640, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontFamily: fc, fontSize: 18, fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-primary)', flex: 1 }}>Recrear: {recreateTitle}</h2>
              <button onClick={() => setShowRecreateModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4 }} aria-label="Cerrar"><X size={20} /></button>
            </div>
            {recreateSuccess ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <p style={{ fontFamily: fc, fontSize: 24, fontWeight: 900, textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: 8 }}>✓ En preparación</p>
                <p style={{ fontFamily: f, fontSize: 14, color: 'var(--text-secondary)' }}>El equipo ya está trabajando en ello.</p>
              </div>
            ) : (
              <>
                {recreateRefThumb && (
                  <div style={{ marginBottom: 20 }}>
                    <label style={labelSm}>Referencia</label>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={recreateRefThumb} alt="Referencia" style={{ width: '100%', maxHeight: 220, objectFit: 'cover', display: 'block', border: '1px solid var(--border)' }} />
                  </div>
                )}
                <div style={{ marginBottom: 20 }}>
                  <label style={labelSm}>Formato</label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {(['image', 'carousel', 'reel', 'video'] as const).map(fmt => (
                      <button type="button" key={fmt} onClick={() => { setRecreateFormat(fmt); if (fmt === 'carousel') { setRecreateSlotCount(4); setRecreateSlots(Array(4).fill(null).map(blankSlot)); } }}
                        style={{ padding: '8px 14px', border: `1px solid ${recreateFormat === fmt ? 'var(--accent)' : 'var(--border)'}`, background: recreateFormat === fmt ? 'var(--accent)' : 'var(--bg)', color: recreateFormat === fmt ? '#fff' : 'var(--text-secondary)', fontFamily: f, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                        {FORMAT_LABEL[fmt]}
                      </button>
                    ))}
                  </div>
                </div>
                {recreateFormat === 'reel' && (
                  <div style={{ marginBottom: 20, padding: '14px 16px', background: '#111', border: '1px solid #222' }}>
                    <p style={{ fontFamily: fc, fontWeight: 800, fontSize: 13, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>REEL / VIDEO</p>
                    <p style={{ fontFamily: f, fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>Indícanos qué quieres recrear, qué música o estilo prefieres, y sube tus imágenes o clips base.</p>
                  </div>
                )}
                {recreateFormat === 'carousel' && (
                  <div style={{ marginBottom: 20 }}>
                    <label style={labelSm}>Número de slides</label>
                    <div style={{ display: 'flex', gap: 0, marginBottom: 16 }}>
                      {[2, 3, 4, 5, 6].map((n, i, arr) => (
                        <button type="button" key={n} onClick={() => { setRecreateSlotCount(n); setRecreateSlots(Array(n).fill(null).map(blankSlot)); }}
                          style={{ minWidth: 44, padding: '8px 0', border: '1px solid var(--border)', borderRight: i < arr.length - 1 ? 'none' : undefined, background: recreateSlotCount === n ? 'var(--text-primary)' : 'var(--bg)', color: recreateSlotCount === n ? 'var(--bg)' : 'var(--text-secondary)', fontFamily: f, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{n}</button>
                      ))}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {recreateSlots.slice(0, recreateSlotCount).map((slot, i) => (
                        <div key={i} style={{ border: '1px solid var(--border)', padding: '12px 14px', background: slot.include ? 'var(--bg)' : 'var(--bg-1)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: slot.include ? 8 : 0 }}>
                            <span style={{ fontFamily: fc, fontWeight: 700, fontSize: 12, color: slot.include ? 'var(--text-primary)' : 'var(--text-tertiary)', textTransform: 'uppercase', minWidth: 50 }}>Slide {i + 1}</span>
                            <button type="button" onClick={() => setRecreateSlots(s => s.map((x, j) => j === i ? { ...x, include: !x.include } : x))}
                              style={{ padding: '3px 10px', border: `1px solid ${slot.include ? 'var(--accent)' : 'var(--border)'}`, background: slot.include ? 'var(--accent-soft)' : 'var(--bg-2)', color: slot.include ? 'var(--accent)' : 'var(--text-tertiary)', fontFamily: f, fontSize: 10, fontWeight: 600, cursor: 'pointer', textTransform: 'uppercase' }}>
                              {slot.include ? 'Incluir' : 'Saltar'}
                            </button>
                          </div>
                          {slot.include && (
                            <input placeholder={`Indicaciones para slide ${i + 1}...`} value={slot.note}
                              onChange={(e) => setRecreateSlots(s => s.map((x, j) => j === i ? { ...x, note: e.target.value } : x))}
                              style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', background: 'var(--bg-1)', fontFamily: f, fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div style={{ marginBottom: 20 }}>
                  <label style={labelSm}>Tus fotos <span style={{ opacity: 0.6, textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>— opcional</span></label>
                  <MediaPicker selected={recreateMedia} onChange={setRecreateMedia} max={maxImages} />
                </div>
                <div style={{ marginBottom: 24 }}>
                  <label style={labelSm}>Notas para el equipo</label>
                  <textarea value={recreateNotes} onChange={(e) => setRecreateNotes(e.target.value)} placeholder="Personaliza el estilo, mensaje, tono..." rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
                </div>
                <div style={{ display: 'flex', gap: 1 }}>
                  <button onClick={() => setShowRecreateModal(false)} style={{ flex: 1, padding: 12, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', fontFamily: f, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
                  <button onClick={handleRecreate} disabled={recreating} style={{ flex: 2, padding: 12, border: 'none', background: 'var(--text-primary)', color: 'var(--bg)', fontFamily: fc, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer', opacity: recreating ? 0.5 : 1 }}>{recreating ? 'Enviando...' : 'Solicitar recreación →'}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
