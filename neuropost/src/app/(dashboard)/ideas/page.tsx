'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import { Send, Zap, Copy, Check, ArrowRight, Image, Film } from 'lucide-react';
import type { IdeaItem, SocialSector } from '@/types';
import { useAppStore } from '@/store/useAppStore';

const UNS = (id: string, w = 400) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&q=80&auto=format&fit=crop`;

// Sector prompts with images
const SECTOR_PROMPTS: Partial<Record<SocialSector, { hint: string; img: string }[]>> = {
  heladeria:    [
    { hint: 'Ideas para el verano con helados', img: UNS('1563805042-7684c019e1cb') },
    { hint: 'Nuevos sabores de temporada', img: UNS('1570145820259-b5b80c5c8bd6') },
    { hint: 'Combinaciones especiales para parejas', img: UNS('1497034825429-c343d7c6a68f') },
  ],
  restaurante: [
    { hint: 'Menú del día especial', img: UNS('1565299624946-b28f40a0ae38') },
    { hint: 'Platos estrella para Instagram', img: UNS('1482049016688-2d3e1b311543') },
    { hint: 'Evento gastronómico del mes', img: UNS('1567306226416-28f0efdc88ce') },
  ],
  cafeteria: [
    { hint: 'Nuevas bebidas de temporada', img: UNS('1501339847302-ac426a4a7cbb') },
    { hint: 'Rituales de café matutino', img: UNS('1495474472287-4d71bcdd2085') },
    { hint: 'Brunch especial de fin de semana', img: UNS('1521017432531-fbd92d768814') },
  ],
  gym: [
    { hint: 'Reto fitness del mes', img: UNS('1534438327276-14e5300c3a48') },
    { hint: 'Transformaciones de clientes', img: UNS('1571019614242-c5c5dee9f50b') },
    { hint: 'Nueva clase o actividad', img: UNS('1517963879433-6ad2a56fcd15') },
  ],
  barberia: [
    { hint: 'Tendencia de corte del mes', img: UNS('1503951914875-452162b0f3f1') },
    { hint: 'Antes y después de clientes', img: UNS('1508214751196-c5bf6f5e2751') },
    { hint: 'Servicio especial de temporada', img: UNS('1560066984-138dadb4c305') },
  ],
  boutique: [
    { hint: 'Nueva colección de temporada', img: UNS('1441984904996-e0b6ba687e04') },
    { hint: 'Look del día', img: UNS('1558618666-fcd25c85cd64') },
    { hint: 'Outfit para evento especial', img: UNS('1507003211169-0a1dd7228f2d') },
  ],
  inmobiliaria: [
    { hint: 'Propiedad destacada de la semana', img: UNS('1560518883-ce09059eeffa') },
    { hint: 'Consejos para compradores', img: UNS('1570129477492-45c003edd2be') },
    { hint: 'El mercado inmobiliario hoy', img: UNS('1582653291997-79a4f2b7d9a7') },
  ],
};

// Campaign data with images
const CAMPAIGNS: { key: string; prompt: string; img: string }[] = [
  { key: 'summer',       prompt: 'Campaña de verano: contenido fresco y veraniego para aumentar ventas en la temporada estival', img: UNS('1507525428034-b723cf961d3e') },
  { key: 'valentines',   prompt: 'Campaña San Valentín: ideas románticas y ofertas especiales para parejas', img: UNS('1518199266791-5375a83190b7') },
  { key: 'backToSchool', prompt: 'Campaña vuelta al cole: contenido enfocado en familia y preparación para septiembre', img: UNS('1503676260728-1c00da094a0b') },
  { key: 'blackFriday',  prompt: 'Campaña Black Friday: ofertas especiales, descuentos y urgencia de compra', img: UNS('1607083206869-4c7672e72a8a') },
  { key: 'christmas',    prompt: 'Campaña Navidad: contenido festivo, felicitaciones y regalos especiales', img: UNS('1512389142860-9c449e58a814') },
  { key: 'newYear',      prompt: 'Campaña Año Nuevo: propósitos, nuevos comienzos y celebración de logros', img: UNS('1467810563316-b5476525c0f9') },
  { key: 'loyalty',      prompt: 'Contenido de fidelización: agradecimiento a clientes, historias de éxito y testimonios', img: UNS('1521791136064-7986c2920216') },
  { key: 'launch',       prompt: 'Lanzamiento de nuevo producto o servicio: generar expectación y conversión', img: UNS('1460925895917-afdab827c52f') },
];

const f = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

type SavedIdea = { id: string; title: string; caption: string; format: string; hashtags: string[]; category: string };

// Pre-loaded idea bank (stored in DB in production)
const IDEA_BANK: SavedIdea[] = [
  { id: 's1', title: 'Reel de proceso de cocina', caption: 'Muestra cómo preparas tu plato estrella paso a paso', format: 'reel', hashtags: ['cocina', 'receta', 'restaurante'], category: 'restaurante' },
  { id: 's2', title: 'Foto de producto con fondo limpio', caption: 'Destaca tu producto estrella con fondo neutro y luz natural', format: 'image', hashtags: ['producto', 'foto', 'ecommerce'], category: 'general' },
  { id: 's3', title: 'Reel de antes y después', caption: 'Transforma un espacio, look o plato y muestra el resultado', format: 'reel', hashtags: ['antesydespues', 'transformacion'], category: 'general' },
  { id: 's4', title: 'Carrusel de tips del sector', caption: '3-5 consejos útiles para tu audiencia en formato carrusel', format: 'carousel', hashtags: ['tips', 'consejos'], category: 'general' },
  { id: 's5', title: 'Video de equipo', caption: 'Presenta a tu equipo de forma cercana y profesional', format: 'video', hashtags: ['equipo', 'detrasdelascamaras'], category: 'general' },
  { id: 's6', title: 'Foto de ambiente del local', caption: 'Captura la esencia de tu espacio con buena luz', format: 'image', hashtags: ['local', 'ambiente', 'interiorismo'], category: 'general' },
  { id: 's7', title: 'Reel de un día en el negocio', caption: 'Muestra un día típico desde la apertura hasta el cierre', format: 'reel', hashtags: ['undia', 'negocio', 'rutina'], category: 'general' },
  { id: 's8', title: 'Story de pregunta a seguidores', caption: 'Usa el sticker de pregunta para interactuar con tu comunidad', format: 'story', hashtags: ['encuesta', 'interaccion'], category: 'general' },
  { id: 's9', title: 'Foto de mascota del local', caption: 'Si tienes mascota en el negocio, los seguidores la amarán', format: 'image', hashtags: ['mascota', 'perro', 'gato'], category: 'general' },
  { id: 's10', title: 'Reel de tendencia adaptada', caption: 'Coge un audio viral y adáptalo a tu negocio', format: 'reel', hashtags: ['tendencia', 'viral', 'reels'], category: 'general' },
  { id: 's11', title: 'Foto de helado close-up', caption: 'Primer plano de tu helado más vendido con textura visible', format: 'image', hashtags: ['helado', 'closeup', 'heladeria'], category: 'heladeria' },
  { id: 's12', title: 'Reel de corte de pelo', caption: 'Transición de antes a después del corte', format: 'reel', hashtags: ['barberia', 'corte', 'fade'], category: 'barberia' },
];

export default function IdeasPage() {
  const t = useTranslations('ideas');
  const router = useRouter();
  const brand = useAppStore((s) => s.brand);
  const [ideas, setIdeas] = useState<IdeaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState(3);
  const promptRef = useRef<HTMLInputElement>(null);

  // Saved ideas search
  const [searchQuery, setSearchQuery] = useState('');
  const [savedFilter, setSavedFilter] = useState<'all' | 'image' | 'reel' | 'video' | 'carousel'>('all');
  const filteredSaved = IDEA_BANK.filter(idea => {
    const matchesSearch = !searchQuery || idea.title.toLowerCase().includes(searchQuery.toLowerCase()) || idea.caption.toLowerCase().includes(searchQuery.toLowerCase()) || idea.hashtags.some(h => h.includes(searchQuery.toLowerCase()));
    const matchesFormat = savedFilter === 'all' || idea.format === savedFilter;
    return matchesSearch && matchesFormat;
  });

  // Selection + generation state
  const [selectedIdeas, setSelectedIdeas] = useState<Set<number>>(new Set());
  const [format, setFormat] = useState<'image' | 'reel' | 'video'>('image');
  const [duration, setDuration] = useState(15);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);

  // Duration options per plan
  const plan = brand?.plan ?? 'starter';
  const DURATION_OPTIONS = plan === 'starter'
    ? [{ s: 10, label: '10s' }, { s: 15, label: '15s' }]
    : plan === 'pro'
    ? [{ s: 10, label: '10s' }, { s: 15, label: '15s' }, { s: 30, label: '30s' }]
    : [{ s: 10, label: '10s' }, { s: 15, label: '15s' }, { s: 30, label: '30s' }, { s: 60, label: '60s' }];

  function toggleIdeaSelection(idx: number) {
    setSelectedIdeas(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else if (next.size < 3) next.add(idx);
      else toast.error('Máximo 3 ideas');
      return next;
    });
  }

  async function handleGenerate() {
    if (selectedIdeas.size === 0) { toast.error('Selecciona al menos 1 idea'); return; }
    setGenerating(true);
    const selectedItems = Array.from(selectedIdeas).map(i => ideas[i]).filter(Boolean);
    const desc = selectedItems.map(i => `${i.title}: ${i.caption}`).join('\n');
    try {
      const res = await fetch('/api/solicitudes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'campaign',
          title: `Generar ${selectedItems.length} post(s) - ${format}`,
          description: `Formato: ${format}${format !== 'image' ? ` (${duration}s)` : ''}\nBasado en:\n${desc}`,
          deadline_at: null,
        }),
      });
      if (res.ok) {
        setGenerated(true);
        toast.success('Solicitud enviada. Tu equipo está trabajando en ello.');
      } else toast.error('Error al enviar');
    } catch { toast.error('Error de conexión'); }
    setGenerating(false);
  }

  const generate = useCallback(async (overridePrompt?: string) => {
    const prompt = overridePrompt ?? promptRef.current?.value.trim();
    if (!prompt) { toast.error('Escribe un prompt para generar ideas'); return; }
    setLoading(true);
    try {
      const res  = await fetch('/api/agents/ideas', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ prompt, count }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error al generar ideas');
      setIdeas(json.data.ideas);
      toast.success(t('ideasCount', { count: json.data.ideas.length }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setLoading(false);
    }
  }, [count, t]);

  function usePreset(prompt: string) {
    if (promptRef.current) promptRef.current.value = prompt;
    generate(prompt);
  }

  function copyCaption(caption: string) {
    navigator.clipboard.writeText(caption);
    toast.success(t('copied'));
  }

  const sectorHints = brand?.sector ? SECTOR_PROMPTS[brand.sector] ?? [] : [];

  return (
    <div className="page-content dashboard-feature-page" style={{ maxWidth: 1000 }}>
      {/* ── Title ── */}
      <div className="dashboard-feature-header" style={{ padding: '48px 0 40px' }}>
        <h1 style={{
          fontFamily: fc, fontWeight: 900,
          fontSize: 'clamp(2.5rem, 5vw, 3.5rem)',
          textTransform: 'uppercase', letterSpacing: '0.01em',
          color: 'var(--text-primary)', lineHeight: 0.95, marginBottom: 12,
        }}>
          {t('title')}
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 15, fontFamily: f }}>
          {t('subtitle')}
        </p>
      </div>

      <div className="dashboard-feature-body">

      {/* ── Prompt input — Stripe-style clean bar ── */}
      <div style={{
        border: '1px solid var(--border)', padding: '12px 16px',
        display: 'flex', gap: 12, alignItems: 'center', marginBottom: 48,
      }}>
        <input
          ref={promptRef}
          placeholder={t('inputPlaceholder')}
          onKeyDown={(e) => e.key === 'Enter' && generate()}
          style={{
            flex: 1, border: 'none', outline: 'none', background: 'none',
            fontFamily: f, fontSize: 14, color: 'var(--text-primary)',
          }}
        />
        <select
          value={count}
          onChange={(e) => setCount(Number(e.target.value))}
          style={{
            border: '1px solid var(--border)', background: 'var(--bg)',
            padding: '6px 12px', fontFamily: f, fontSize: 13,
            color: 'var(--text-secondary)', cursor: 'pointer', outline: 'none',
          }}
        >
          {[1, 2, 3].map((n) => <option key={n} value={n}>{n} {n === 1 ? 'idea' : 'ideas'}</option>)}
        </select>
        <button
          onClick={() => generate()}
          disabled={loading}
          style={{
            background: 'var(--text-primary)', color: 'var(--bg)',
            border: 'none', padding: '8px 20px',
            fontFamily: fc, fontSize: 12, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.08em',
            cursor: loading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            opacity: loading ? 0.5 : 1,
          }}
        >
          {loading ? <span className="loading-spinner" /> : <Send size={14} />}
          {loading ? t('generating') : t('generate')}
        </button>
      </div>

      {/* ── Saved ideas — searchable bank ── */}
      <div style={{ marginBottom: 48 }}>
        <h2 style={{ fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--text-tertiary)', marginBottom: 16, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
          Banco de ideas
        </h2>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
          <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Buscar ideas... (ej: perro, reel, cocina)"
            style={{ flex: 1, padding: '8px 14px', border: '1px solid var(--border)', fontFamily: f, fontSize: 13, color: 'var(--text-primary)', outline: 'none' }} />
          <div style={{ display: 'flex', gap: 0 }}>
            {(['all', 'image', 'reel', 'video', 'carousel'] as const).map((fmt, i, arr) => (
              <button key={fmt} onClick={() => setSavedFilter(fmt)} style={{
                padding: '6px 12px', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)',
                borderLeft: '1px solid var(--border)', borderRight: i === arr.length - 1 ? '1px solid var(--border)' : 'none',
                background: savedFilter === fmt ? 'var(--text-primary)' : 'var(--bg)',
                color: savedFilter === fmt ? 'var(--bg)' : 'var(--text-tertiary)',
                fontFamily: f, fontSize: 10, fontWeight: 600, cursor: 'pointer', textTransform: 'uppercase',
              }}>
                {fmt === 'all' ? 'Todo' : fmt === 'image' ? 'Foto' : fmt === 'reel' ? 'Reel' : fmt === 'video' ? 'Video' : 'Carrusel'}
              </button>
            ))}
          </div>
        </div>
        {filteredSaved.length === 0 ? (
          <p style={{ fontFamily: f, fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center', padding: '24px 0' }}>
            No hay ideas para "{searchQuery}"
          </p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', background: 'var(--border)', border: '1px solid var(--border)' }}>
            {filteredSaved.map((idea) => (
              <div key={idea.id} onClick={() => { if (promptRef.current) promptRef.current.value = idea.caption; }}
                style={{ background: 'var(--bg)', padding: '14px 16px', cursor: 'pointer', transition: 'background 0.1s' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 6 }}>
                  <span style={{ fontFamily: fc, fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase' }}>{idea.title}</span>
                  <span style={{ fontFamily: f, fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', border: '1px solid var(--border)', padding: '1px 6px', flexShrink: 0 }}>
                    {idea.format}
                  </span>
                </div>
                <p style={{ fontFamily: f, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>{idea.caption}</p>
                <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                  {idea.hashtags.slice(0, 3).map(h => <span key={h} style={{ fontFamily: f, fontSize: 9, color: 'var(--text-tertiary)' }}>#{h}</span>)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Sector ideas — Image carousel ── */}
      {sectorHints.length > 0 && (
        <div style={{ marginBottom: 48 }}>
          <h2 style={{
            fontFamily: f, fontSize: 10, fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: '0.14em',
            color: 'var(--text-tertiary)', marginBottom: 16,
            paddingBottom: 8, borderBottom: '1px solid var(--border)',
          }}>
            {t('sectorLabel')}
          </h2>
          <div style={{
            display: 'flex', gap: '1px', background: 'var(--border)',
            border: '1px solid var(--border)', overflowX: 'auto', scrollbarWidth: 'none',
          }}>
            {sectorHints.map(({ hint, img }) => (
              <button
                key={hint}
                onClick={() => usePreset(hint)}
                disabled={loading}
                style={{
                  flex: '0 0 260px', background: 'none', border: 'none',
                  padding: 0, cursor: loading ? 'wait' : 'pointer',
                  position: 'relative', overflow: 'hidden', display: 'block',
                  textAlign: 'left',
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img} alt="" style={{
                  width: '100%', height: 160, objectFit: 'cover', display: 'block',
                  transition: 'transform 0.3s',
                }} />
                <div style={{
                  position: 'absolute', inset: 0,
                  background: 'linear-gradient(transparent 30%, rgba(0,0,0,0.7))',
                }} />
                <div style={{
                  position: 'absolute', bottom: 14, left: 14, right: 14,
                }}>
                  <p style={{
                    fontFamily: f, fontSize: 13, fontWeight: 600,
                    color: '#ffffff', lineHeight: 1.3,
                  }}>
                    {hint}
                  </p>
                  <p style={{
                    fontFamily: f, fontSize: 10, fontWeight: 500,
                    color: 'rgba(255,255,255,0.6)', marginTop: 4,
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                  }}>
                    Generar ideas →
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Campaigns — Visual carousel ── */}
      <div style={{ marginBottom: 48 }}>
        <h2 style={{
          fontFamily: f, fontSize: 10, fontWeight: 600,
          textTransform: 'uppercase', letterSpacing: '0.14em',
          color: 'var(--text-tertiary)', marginBottom: 16,
          paddingBottom: 8, borderBottom: '1px solid var(--border)',
        }}>
          {t('campaignsLabel')}
        </h2>
        <div style={{
          display: 'flex', gap: '1px', background: 'var(--border)',
          border: '1px solid var(--border)', overflowX: 'auto', scrollbarWidth: 'none',
        }}>
          {CAMPAIGNS.map(({ key, prompt, img }) => (
            <button
              key={key}
              onClick={() => usePreset(prompt)}
              disabled={loading}
              style={{
                flex: '0 0 200px', background: 'none', border: 'none',
                padding: 0, cursor: loading ? 'wait' : 'pointer',
                position: 'relative', overflow: 'hidden', display: 'block',
                textAlign: 'left',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img} alt="" style={{
                width: '100%', height: 140, objectFit: 'cover', display: 'block',
                transition: 'transform 0.3s',
              }} />
              <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(transparent 20%, rgba(0,0,0,0.75))',
              }} />
              <div style={{ position: 'absolute', bottom: 12, left: 12, right: 12 }}>
                <p style={{
                  fontFamily: fc, fontSize: 14, fontWeight: 700,
                  color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.02em',
                }}>
                  {t(`campaigns.${key}`)}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Results ── */}
      {ideas.length > 0 && (
        <>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 16, paddingBottom: 8, borderBottom: '1px solid var(--border)',
          }}>
            <h2 style={{
              fontFamily: f, fontSize: 10, fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.14em',
              color: 'var(--text-tertiary)', margin: 0,
            }}>
              {t('ideasCount', { count: ideas.length })}
            </h2>
            <button
              onClick={() => generate()}
              style={{
                background: 'none', border: '1px solid var(--border)',
                padding: '6px 16px', cursor: 'pointer',
                fontFamily: f, fontSize: 12, fontWeight: 600,
                color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6,
                transition: 'background 0.15s',
              }}
            >
              <Zap size={12} /> {t('regenerate')}
            </button>
          </div>

          <div className="dash-grid-auto-lg" style={{
            background: 'var(--border)', border: '1px solid var(--border)',
            marginBottom: 48,
          }}>
            {ideas.map((idea, i) => {
              const isSel = selectedIdeas.has(i);
              return (
                <div key={i} onClick={() => toggleIdeaSelection(i)} style={{
                  background: isSel ? '#f0fdf4' : 'var(--bg)', padding: 24,
                  display: 'flex', flexDirection: 'column', gap: 8,
                  transition: 'all 0.15s', cursor: 'pointer',
                  borderLeft: isSel ? '3px solid #0F766E' : '3px solid transparent',
                  position: 'relative',
                }}>
                  {isSel && (
                    <div style={{ position: 'absolute', top: 12, right: 12, width: 20, height: 20, background: '#0F766E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Check size={12} color="#ffffff" />
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, paddingRight: isSel ? 28 : 0 }}>
                    <h3 style={{ fontFamily: fc, fontWeight: 700, fontSize: 18, color: 'var(--text-primary)', lineHeight: 1.2, textTransform: 'uppercase', letterSpacing: '0.01em' }}>
                      {idea.title}
                    </h3>
                    <span style={{ fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', whiteSpace: 'nowrap', border: '1px solid var(--border)', padding: '2px 8px', flexShrink: 0 }}>
                      {idea.format}
                    </span>
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, fontFamily: f, flex: 1 }}>{idea.caption}</p>
                  {idea.hashtags.length > 0 && (
                    <p style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: f }}>{idea.hashtags.slice(0, 5).map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ')}</p>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTop: '1px solid var(--border)', marginTop: 4 }}>
                    <span style={{ fontFamily: f, fontSize: 11, color: 'var(--text-tertiary)' }}>{idea.bestTime || t('anyTime')}</span>
                    <button onClick={(e) => { e.stopPropagation(); copyCaption(idea.caption); }} style={{
                      background: 'none', border: '1px solid var(--border)', padding: '4px 12px', cursor: 'pointer',
                      fontFamily: f, fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4,
                    }}>
                      <Copy size={11} /> {t('copy')}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── Empty state ── */}
      {ideas.length === 0 && !loading && (
        <div style={{ textAlign: 'center', padding: '80px 20px' }}>
          <p style={{
            fontFamily: fc, fontWeight: 900, fontSize: 24,
            textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: 8,
          }}>
            {t('emptyTitle')}
          </p>
          <p style={{ fontSize: 14, color: 'var(--text-tertiary)', fontFamily: f, marginBottom: 32 }}>
            {t('emptySub')}
          </p>
        </div>
      )}
      {/* ── Selection panel — fixed bottom bar ── */}
      {ideas.length > 0 && selectedIdeas.size > 0 && !generated && (
        <div style={{
          position: 'fixed', bottom: 0, left: 200, right: 0,
          background: '#111827', padding: '16px 28px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
          zIndex: 40,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontFamily: f, fontSize: 13, color: '#ffffff', fontWeight: 600 }}>
              {selectedIdeas.size}/3 ideas seleccionadas
            </span>
            <div style={{ display: 'flex', gap: 0 }}>
              {(['image', 'reel', 'video'] as const).map((fmt, i, arr) => (
                <button key={fmt} onClick={() => { setFormat(fmt); if (fmt === 'image') setDuration(0); else if (duration === 0) setDuration(DURATION_OPTIONS[0].s); }} style={{
                  padding: '6px 14px', borderTop: '1px solid #374151', borderBottom: '1px solid #374151',
                  borderLeft: '1px solid #374151', borderRight: i === arr.length - 1 ? '1px solid #374151' : 'none',
                  background: format === fmt ? '#ffffff' : 'transparent',
                  color: format === fmt ? '#111827' : '#9ca3af',
                  fontFamily: f, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                }}>
                  {fmt === 'image' ? 'Foto' : fmt === 'reel' ? 'Reel' : 'Video'}
                </button>
              ))}
            </div>
            {/* Duration — only for reel/video */}
            {format !== 'image' && (
              <div style={{ display: 'flex', gap: 0 }}>
                {DURATION_OPTIONS.map((opt, i) => (
                  <button key={opt.s} onClick={() => setDuration(opt.s)} style={{
                    padding: '6px 10px', borderTop: '1px solid #374151', borderBottom: '1px solid #374151',
                    borderLeft: '1px solid #374151', borderRight: i === DURATION_OPTIONS.length - 1 ? '1px solid #374151' : 'none',
                    background: duration === opt.s ? '#ffffff' : 'transparent',
                    color: duration === opt.s ? '#111827' : '#9ca3af',
                    fontFamily: f, fontSize: 10, fontWeight: 600, cursor: 'pointer',
                  }}>
                    {opt.label}
                  </button>
                ))}
                {plan === 'starter' && (
                  <span style={{ fontFamily: f, fontSize: 9, color: '#6b7280', marginLeft: 8, alignSelf: 'center' }}>
                    Pro: hasta 30s
                  </span>
                )}
              </div>
            )}
            <button onClick={() => setSelectedIdeas(new Set())} style={{
              background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer',
              fontFamily: f, fontSize: 12,
            }}>
              Limpiar
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Link href="/biblioteca" style={{
              padding: '8px 16px', border: '1px solid #374151', background: 'transparent',
              color: '#9ca3af', fontFamily: f, fontSize: 12, fontWeight: 600,
              textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <Image size={13} /> Añadir fotos
            </Link>
            <button onClick={handleGenerate} disabled={generating} style={{
              padding: '8px 24px', background: '#ffffff', color: '#111827', border: 'none',
              fontFamily: fc, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
              cursor: generating ? 'wait' : 'pointer', opacity: generating ? 0.6 : 1,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              {generating ? 'Enviando...' : 'Generar contenido'} <ArrowRight size={13} />
            </button>
          </div>
        </div>
      )}

      {/* ── Generated success ── */}
      {generated && (
        <div style={{ textAlign: 'center', padding: '40px 20px', background: '#f0fdf4', border: '1px solid #e5e7eb', marginBottom: 32 }}>
          <p style={{ fontFamily: fc, fontWeight: 900, fontSize: 22, textTransform: 'uppercase', color: '#111827', marginBottom: 6 }}>
            Solicitud enviada
          </p>
          <p style={{ fontFamily: f, fontSize: 14, color: '#6b7280', marginBottom: 24 }}>
            Tu equipo está preparando {selectedIdeas.size} publicación(es). Te avisaremos cuando esté listo.
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button onClick={() => router.push('/posts')} style={{
              padding: '10px 24px', background: '#111827', color: '#ffffff', border: 'none',
              fontFamily: fc, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer',
            }}>
              Ver posts
            </button>
            <button onClick={() => { setGenerated(false); setSelectedIdeas(new Set()); }} style={{
              padding: '10px 20px', border: '1px solid #e5e7eb', background: '#ffffff', color: '#6b7280',
              fontFamily: f, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>
              Seguir explorando
            </button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
