'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import type { SocialSector, BrandTone, PublishMode, PostGoal, VisualStyle } from '@/types';
import { TONE_OPTIONS, PUBLISH_MODE_OPTIONS } from '@/lib/brand-options';
import { useTagInput } from '@/hooks/useTagInput';
import CouponInput from '@/components/billing/CouponInput';

// ─── Unsplash helper ──────────────────────────────────────────────────────────

const UNS = (id: string, w = 400) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&q=80&auto=format&fit=crop`;

// ─── Sector data with images ──────────────────────────────────────────────────

type SectorItem = { value: SocialSector; label: string; img: string };
type SectorGroup = { group: string; items: SectorItem[] };

const SECTOR_GROUPS: SectorGroup[] = [
  { group: 'Comida y Bebida', items: [
    { value: 'restaurante', label: 'Gastronomía',        img: UNS('1517248135467-4c7edcad34c4') },
    { value: 'heladeria',   label: 'Heladería',           img: UNS('1563805042-7684c019e1cb') },
    { value: 'cafeteria',   label: 'Cafetería / Brunch', img: UNS('1501339847302-ac426a4a7cbb') },
    { value: 'cocteleria',  label: 'Cócteles / Bar',     img: UNS('1514362545857-3bc16c4c7d1b') },
    { value: 'street_food', label: 'Street Food',        img: UNS('1565299624946-b28f40a0ae38') },
    { value: 'vinoteca',    label: 'Vinoteca',           img: UNS('1510812431401-41d2bd2722f3') },
    { value: 'panaderia',   label: 'Panadería',          img: UNS('1509440159596-0249088772ff') },
  ]},
  { group: 'Belleza y Estética', items: [
    { value: 'barberia',   label: 'Barbería',    img: UNS('1503951914875-452162b0f3f1') },
    { value: 'nail_art',   label: 'Nail Art',    img: UNS('1604654894610-df63bc536371') },
    { value: 'estetica',   label: 'Centro Spa',  img: UNS('1540555700478-4be289fbecef') },
    { value: 'maquillaje', label: 'Cosmética',   img: UNS('1522335789203-aabd1fc54bc9') },
  ]},
  { group: 'Moda y Estilo', items: [
    { value: 'boutique',    label: 'Boutique',    img: UNS('1441984904996-e0b6ba687e04') },
    { value: 'moda_hombre', label: 'Moda Hombre', img: UNS('1490874106543-4c8e13f21f96') },
    { value: 'zapateria',   label: 'Zapatería',   img: UNS('1542291026-7eec264c27ff') },
    { value: 'skincare',    label: 'Skincare',    img: UNS('1556228578-8c89e6adf883') },
  ]},
  { group: 'Salud y Bienestar', items: [
    { value: 'gym',       label: 'Gimnasio / Fitness', img: UNS('1534438327276-14e5300c3a48') },
    { value: 'yoga',      label: 'Yoga / Pilates',     img: UNS('1571019614242-c5c5dee9f50b') },
    { value: 'dental',    label: 'Clínica Dental',     img: UNS('1559757148-5c350d0d3c56') },
    { value: 'clinica',   label: 'Clínica / Medicina', img: UNS('1519494026892-80bbd2d6fd0d') },
    { value: 'nutricion', label: 'Nutrición',          img: UNS('1512621776951-a57141f2eefd') },
  ]},
  { group: 'Hogar y Servicios', items: [
    { value: 'decoracion',  label: 'Decoración',   img: UNS('1555041469-dd5e56068b4d') },
    { value: 'jardineria',  label: 'Jardinería',   img: UNS('1416879595882-3373a0480b5b') },
    { value: 'reformas',    label: 'Reformas',     img: UNS('1504307651254-35680f356dfd') },
    { value: 'inmobiliaria',label: 'Inmobiliaria', img: UNS('1560518883-ce09059eeffa') },
    { value: 'fotografia',  label: 'Fotografía',   img: UNS('1516035069371-29a1b244cc32') },
    { value: 'floristeria', label: 'Floristería',  img: UNS('1487530811576-3780949e7b0b') },
    { value: 'otro',        label: 'Otro negocio', img: UNS('1497366216548-37526070297c') },
  ]},
];

// ─── Visual style data ────────────────────────────────────────────────────────

const VISUAL_STYLES: {
  value: VisualStyle; title: string; tag: string; imgs: string[]; palette: string[];
}[] = [
  { value: 'creative', title: 'Creativo y Colorido', tag: 'Impactante · Editorial · Vibrante',
    imgs: [UNS('1513104890138-7c749659a591',300), UNS('1570145820259-b5b80c5c8bd6',300), UNS('1514362545857-3bc16c4c7d1b',300), UNS('1563805042-7684c019e1cb',300)],
    palette: ['#FF6B9D','#FF9500','#34C759','#007AFF'] },
  { value: 'elegant', title: 'Elegante y Minimal', tag: 'Limpio · Sofisticado · Premium',
    imgs: [UNS('1490312278390-ab64016e0aa9',300), UNS('1507003211169-0a1dd7228f2d',300), UNS('1441984904996-e0b6ba687e04',300), UNS('1560518883-ce09059eeffa',300)],
    palette: ['#F5F5F0','#D4C5B0','#8B7355','#2C2C2C'] },
  { value: 'warm', title: 'Cálido y Cercano', tag: 'Auténtico · Local · Próximo',
    imgs: [UNS('1495474472287-4d71bcdd2085',300), UNS('1521017432531-fbd92d768814',300), UNS('1501339847302-ac426a4a7cbb',300), UNS('1563805042-7684c019e1cb',300)],
    palette: ['#D4916A','#C17D52','#F2CDA0','#8B4513'] },
  { value: 'dynamic', title: 'Dinámico y Moderno', tag: 'Energía · Urbano · Tendencia',
    imgs: [UNS('1534438327276-14e5300c3a48',300), UNS('1571019614242-c5c5dee9f50b',300), UNS('1503951914875-452162b0f3f1',300), UNS('1490874106543-4c8e13f21f96',300)],
    palette: ['#1C1C1E','#FF3B30','#636366','#AEAEB2'] },
];

// ─── Preview post images per sector ──────────────────────────────────────────

const SECTOR_POSTS: Partial<Record<SocialSector, string[]>> = {
  restaurante: [UNS('1565299624946-b28f40a0ae38',300), UNS('1482049016688-2d3e1b311543',300), UNS('1567306226416-28f0efdc88ce',300)],
  heladeria:   [UNS('1563805042-7684c019e1cb',300), UNS('1570145820259-b5b80c5c8bd6',300), UNS('1497034825429-c343d7c6a68f',300)],
  cafeteria:   [UNS('1501339847302-ac426a4a7cbb',300), UNS('1495474472287-4d71bcdd2085',300), UNS('1521017432531-fbd92d768814',300)],
  gym:         [UNS('1534438327276-14e5300c3a48',300), UNS('1571019614242-c5c5dee9f50b',300), UNS('1517963879433-6ad2a56fcd15',300)],
  barberia:    [UNS('1503951914875-452162b0f3f1',300), UNS('1508214751196-c5bf6f5e2751',300), UNS('1560066984-138dadb4c305',300)],
  boutique:    [UNS('1441984904996-e0b6ba687e04',300), UNS('1490874106543-4c8e13f21f96',300), UNS('1558618666-fcd25c85cd64',300)],
  inmobiliaria:[UNS('1560518883-ce09059eeffa',300), UNS('1570129477492-45c003edd2be',300), UNS('1582653291997-79a4f2b7d9a7',300)],
  floristeria: [UNS('1487530811576-3780949e7b0b',300), UNS('1499444819541-60e4a698ecf5',300), UNS('1439127989242-9da695f9ca26',300)],
  yoga:        [UNS('1571019614242-c5c5dee9f50b',300), UNS('1506126613408-eca07ce68773',300), UNS('1544367654-00eb648f0b1f',300)],
};
const DEFAULT_POSTS = [UNS('1497366216548-37526070297c',300), UNS('1517248135467-4c7edcad34c4',300), UNS('1501339847302-ac426a4a7cbb',300)];

const SECTOR_CAPTIONS: Partial<Record<SocialSector, string[]>> = {
  restaurante: ['El mejor risotto de la ciudad 🍝', 'Mesa lista para esta noche ✨', 'Ingredientes frescos cada mañana 🌿'],
  heladeria:   ['Pistacho artesanal recién hecho 🍦', 'El sabor del verano ☀️', 'Hecho con amor desde 1995 💛'],
  cafeteria:   ['Empieza el día con el mejor café ☕', 'Brunch perfecto para el domingo 🥑', 'Tu rincón favorito te espera 🌸'],
  gym:         ['Sin excusas, solo resultados 💪', 'Tu mejor versión empieza hoy 🔥', 'Clase de las 7am. ¿Te apuntas? ⚡'],
  barberia:    ['Corte clásico, estilo eterno ✂️', 'Cuida tu imagen, cuida tu actitud 💈', 'Reserva ya tu cita 📞'],
};
const DEFAULT_CAPTIONS = ['Contenido adaptado a tu negocio ✨', 'Tu historia, nuestra voz 🎯', 'Conectamos con tu audiencia 💬'];

function getDynamicQuestions(sector: SocialSector): { label: string; placeholder: string; key: string }[] {
  const map: Partial<Record<SocialSector, { label: string; placeholder: string; key: string }[]>> = {
    heladeria:   [{ label: 'Producto estrella',      placeholder: 'Ej: helado de pistacho artesanal', key: 'star_product' }],
    restaurante: [{ label: 'Tipo de cocina',          placeholder: 'Ej: italiana, mediterránea',       key: 'cuisine' }],
    cafeteria:   [{ label: 'Especialidad',             placeholder: 'Ej: specialty coffee, brunch',     key: 'specialty' }],
    gym:         [{ label: 'Tipo de entrenamiento',   placeholder: 'Ej: CrossFit, funcional, yoga',     key: 'training' }],
    clinica:     [{ label: 'Especialidad médica',     placeholder: 'Ej: estética, dental',              key: 'specialty' }],
    barberia:    [{ label: 'Servicios destacados',    placeholder: 'Ej: corte clásico, barba',          key: 'services' }],
    boutique:    [{ label: 'Tipo de moda',            placeholder: 'Ej: casual, formal, boho',          key: 'fashion_type' }],
    inmobiliaria:[{ label: 'Zonas de operación',      placeholder: 'Ej: Barcelona centro',              key: 'zones' }],
    yoga:        [{ label: 'Tipos de clases',         placeholder: 'Ej: hatha, vinyasa, meditación',    key: 'classes' }],
  };
  return map[sector] ?? [{ label: 'Tu producto o servicio estrella', placeholder: 'Lo más popular de tu negocio', key: 'star_product' }];
}

// ─── Shared design tokens ─────────────────────────────────────────────────────

const ACCENT = '#ff5c1a';
const BG_L   = '#0f0e0c';
const BG_R   = '#141720';
const INK    = '#e8edf8';
const MUTED  = 'rgba(232,237,248,0.4)';
const BORDER = 'rgba(255,255,255,0.08)';

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 16px',
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 10, color: INK,
  fontFamily: "'Cabinet Grotesk', sans-serif",
  fontSize: '0.9rem', outline: 'none',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: MUTED, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6, fontFamily: "'Cabinet Grotesk', sans-serif" }}>
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 900, fontSize: '1.55rem', color: INK, letterSpacing: '-0.03em', marginBottom: 6, lineHeight: 1.15 }}>
      {children}
    </div>
  );
}

function StepSub({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: '0.88rem', color: MUTED, marginBottom: 28, lineHeight: 1.6 }}>
      {children}
    </div>
  );
}

function BtnPrimary({ onClick, disabled, children }: { onClick?: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: '13px 28px', borderRadius: 40,
      background: disabled ? 'rgba(255,255,255,0.1)' : ACCENT,
      color: 'white', border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
      fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 800, fontSize: '0.9rem',
      display: 'inline-flex', alignItems: 'center', gap: 8, transition: 'all 0.2s',
    }}>
      {children}
    </button>
  );
}

function BtnBack({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: '13px 20px', borderRadius: 40,
      background: 'transparent', border: '1px solid rgba(255,255,255,0.15)',
      color: MUTED, cursor: 'pointer',
      fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 700, fontSize: '0.9rem',
      transition: 'all 0.2s',
    }}>
      ← Atrás
    </button>
  );
}

function MockPost({ img, caption, index }: { img: string; caption: string; index: number }) {
  const handles = ['@tunegocio', '@tunegocio', '@tunegocio'];
  const likes   = [234, 189, 312];
  const comms   = [18, 24, 9];
  return (
    <div style={{
      background: '#1a1d2e', borderRadius: 14, overflow: 'hidden',
      border: '1px solid rgba(255,255,255,0.07)', flexShrink: 0, width: 200,
    }}>
      <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: `linear-gradient(135deg, ${ACCENT}, #ff8c42)`, flexShrink: 0 }} />
        <span style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: '0.75rem', fontWeight: 700, color: INK }}>{handles[index]}</span>
      </div>
      <img src={img} alt="" style={{ width: '100%', height: 160, objectFit: 'cover', display: 'block' }} />
      <div style={{ padding: '10px 12px' }}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
          <span style={{ fontSize: '0.78rem', color: MUTED }}>♥ {likes[index]}</span>
          <span style={{ fontSize: '0.78rem', color: MUTED }}>💬 {comms[index]}</span>
        </div>
        <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: '0.75rem', color: INK, lineHeight: 1.5 }}>
          {caption}
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 4 | 5;

export default function OnboardingPage() {
  const router = useRouter();
  const { addTag, removeTag, handleTagKeyDown } = useTagInput();
  const [step,   setStep]   = useState<Step>(1);
  const [saving, setSaving] = useState(false);

  const [sector,           setSector]           = useState<SocialSector>('restaurante');
  const [secondarySectors, setSecondarySectors] = useState<SocialSector[]>([]);
  const [visualStyle,      setVisualStyle]      = useState<VisualStyle>('warm');
  const [name,             setName]             = useState('');
  const [location,         setLocation]         = useState('');
  const [slogan,           setSlogan]           = useState('');
  const [dynamicAnswers,   setDynamicAnswers]   = useState<Record<string, string>>({});
  const [tone,             setTone]             = useState<BrandTone>('cercano');
  const [keywords,         setKeywords]         = useState<string[]>([]);
  const [kwInput,          setKwInput]          = useState('');
  const [forbidden,        setForbidden]        = useState<string[]>([]);
  const [fbInput,          setFbInput]          = useState('');
  const [objective]                             = useState<PostGoal>('engagement');
  const [publishMode,      setPublishMode]      = useState<PublishMode>('manual');
  const [primaryColor,     setPrimaryColor]     = useState('#FF6B35');
  const [secondaryColor,   setSecondaryColor]   = useState('#1A1A2E');
  const [promoCodeId,      setPromoCodeId]      = useState<string | null>(null);
  const [discountText,     setDiscountText]     = useState('');

  const dynamicQuestions = getDynamicQuestions(sector);

  function toggleSecondary(s: SocialSector) {
    if (s === sector) return;
    setSecondarySectors((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : prev.length < 2 ? [...prev, s] : prev,
    );
  }

  async function handleSubmit() {
    if (!name.trim()) { toast.error('El nombre del negocio es obligatorio'); return; }
    setSaving(true);
    try {
      const extraContext = dynamicQuestions
        .map((q) => `${q.label}: ${dynamicAnswers[q.key] ?? ''}`)
        .filter((l) => !l.endsWith(': ')).join('. ');
      const styleInstructions: Record<VisualStyle, string> = {
        creative: 'Estilo creativo y colorido: usa emojis, exclamaciones y texto dinámico.',
        elegant:  'Estilo elegante y minimal: sin emojis, frases cortas y sofisticadas.',
        warm:     'Estilo cálido y cercano: tono familiar, tuteo y proximidad.',
        dynamic:  'Estilo dinámico y moderno: frases cortas, imperativas y mucha energía.',
      };
      const res = await fetch('/api/brands', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, sector, secondary_sectors: secondarySectors,
          visual_style: visualStyle, tone, hashtags: keywords,
          location: location || null, slogans: slogan ? [slogan] : [],
          publish_mode: publishMode,
          colors: { primary: primaryColor, secondary: secondaryColor, accent: primaryColor },
          promo_code_id: promoCodeId ?? undefined,
          rules: { forbiddenWords: forbidden, noPublishDays: [], noEmojis: visualStyle === 'elegant', noAutoReplyNegative: false, forbiddenTopics: [] },
          brand_voice_doc: [
            `Negocio: ${name}. Sector: ${sector}.`,
            `Estilo visual: ${visualStyle}. ${styleInstructions[visualStyle]}`,
            `Tono de marca: ${tone}.`,
            extraContext,
            keywords.length > 0 ? `Palabras clave: ${keywords.join(', ')}.` : '',
            `Objetivo principal: ${objective}.`,
            location ? `Ubicación: ${location}.` : '',
          ].filter(Boolean).join(' '),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error al crear el negocio');
      toast.success('¡Negocio configurado correctamente!');
      router.push('/dashboard');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error inesperado');
    } finally { setSaving(false); }
  }

  const previewPosts    = SECTOR_POSTS[sector] ?? DEFAULT_POSTS;
  const previewCaptions = SECTOR_CAPTIONS[sector] ?? DEFAULT_CAPTIONS;
  const selectedStyle   = VISUAL_STYLES.find((s) => s.value === visualStyle)!;

  // ─── Right column previews ─────────────────────────────────────────────────

  const rightStep1 = (
    <div style={{ padding: '48px 40px', display: 'flex', flexDirection: 'column', gap: 16, height: '100%', overflowY: 'auto' }}>
      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: MUTED, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: "'Cabinet Grotesk', sans-serif", marginBottom: 8 }}>
        Así quedará tu feed
      </div>
      <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 8 }}>
        {previewPosts.map((img, i) => (
          <MockPost key={i} img={img} caption={previewCaptions[i] ?? DEFAULT_CAPTIONS[i]} index={i} />
        ))}
      </div>
      <div style={{ marginTop: 'auto', padding: '20px', background: 'rgba(255,255,255,0.04)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: '0.8rem', color: MUTED, lineHeight: 1.7 }}>
          NeuroPost adapta el tono, los hashtags y el tipo de contenido según tu sector. Puedes añadir un sector secundario con clic derecho.
        </div>
      </div>
    </div>
  );

  const rightStep2 = (
    <div style={{ padding: '48px 40px', height: '100%', overflowY: 'auto' }}>
      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: MUTED, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: "'Cabinet Grotesk', sans-serif", marginBottom: 16 }}>
        Preview de tu feed
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 3, borderRadius: 12, overflow: 'hidden' }}>
        {[...selectedStyle.imgs, ...selectedStyle.imgs, selectedStyle.imgs[0]].slice(0, 9).map((img, i) => (
          <img key={i} src={img} alt="" style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', display: 'block', filter: visualStyle === 'elegant' ? 'saturate(0.3) brightness(1.1)' : visualStyle === 'dynamic' ? 'contrast(1.2) saturate(1.3)' : visualStyle === 'creative' ? 'saturate(1.4)' : 'saturate(0.9) warmth(1.1)' }} />
        ))}
      </div>
      <div style={{ marginTop: 16, display: 'flex', gap: 6 }}>
        {selectedStyle.palette.map((c) => (
          <div key={c} style={{ flex: 1, height: 6, borderRadius: 3, background: c }} />
        ))}
      </div>
      <div style={{ marginTop: 8, fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: '0.78rem', color: MUTED }}>
        Paleta de colores · {selectedStyle.tag}
      </div>
    </div>
  );

  const rightStep3 = (
    <div style={{ padding: '48px 40px', display: 'flex', flexDirection: 'column', gap: 20, height: '100%' }}>
      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: MUTED, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: "'Cabinet Grotesk', sans-serif" }}>
        Tu tarjeta de negocio
      </div>
      <div style={{ background: '#1a1d2e', borderRadius: 18, padding: '32px', border: '1px solid rgba(255,255,255,0.08)', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ width: 56, height: 56, borderRadius: 14, background: `linear-gradient(135deg, ${ACCENT}, #ff8c42)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 900, color: 'white', fontFamily: "'Cabinet Grotesk', sans-serif" }}>
          {name ? name[0].toUpperCase() : 'N'}
        </div>
        <div>
          <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 900, fontSize: '1.4rem', color: INK, letterSpacing: '-0.03em' }}>
            {name || 'Tu negocio'}
          </div>
          {location && <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: '0.85rem', color: MUTED, marginTop: 2 }}>{location}</div>}
        </div>
        {slogan && (
          <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontStyle: 'italic', fontSize: '0.9rem', color: 'rgba(232,237,248,0.6)', borderLeft: `3px solid ${ACCENT}`, paddingLeft: 12 }}>
            "{slogan}"
          </div>
        )}
        <div style={{ marginTop: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ background: 'rgba(255,92,26,0.15)', color: ACCENT, fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: '0.72rem', fontWeight: 700, padding: '4px 10px', borderRadius: 40, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {sector}
          </span>
          <span style={{ background: 'rgba(255,255,255,0.07)', color: MUTED, fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: '0.72rem', fontWeight: 700, padding: '4px 10px', borderRadius: 40 }}>
            {visualStyle}
          </span>
        </div>
      </div>
    </div>
  );

  const toneExamples: Record<BrandTone, string> = {
    cercano:     '¡Buenos días! ☀️ Empezamos el día con energía. ¿Nos cuentas cómo arrancas tú?',
    profesional: 'Nos complace presentar nuestra nueva colección. Calidad y excelencia en cada detalle.',
    divertido:   '¿Quién dijo que los lunes son aburridos? 🎉 ¡Nosotros tenemos el plan perfecto!',
    premium:     'Donde la artesanía encuentra la elegancia. Cada pieza, una experiencia única.',
  };

  const rightStep4 = (
    <div style={{ padding: '48px 40px', height: '100%' }}>
      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: MUTED, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: "'Cabinet Grotesk', sans-serif", marginBottom: 16 }}>
        Ejemplo de post con tu tono
      </div>
      <div style={{ background: '#1a1d2e', borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: `linear-gradient(135deg, ${ACCENT}, #ff8c42)` }} />
          <div>
            <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: '0.82rem', fontWeight: 700, color: INK }}>{name || 'tunegocio'}</div>
            <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: '0.7rem', color: MUTED }}>hace 2h</div>
          </div>
        </div>
        <img src={previewPosts[0]} alt="" style={{ width: '100%', height: 200, objectFit: 'cover', display: 'block' }} />
        <div style={{ padding: '14px' }}>
          <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: '0.85rem', color: INK, lineHeight: 1.6, marginBottom: 8 }}>
            {toneExamples[tone]}
          </div>
          {keywords.length > 0 && (
            <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: '0.8rem', color: '#818cf8' }}>
              {keywords.slice(0, 3).map((k) => `#${k}`).join(' ')}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const modeDescriptions: Record<PublishMode, string> = {
    manual: 'Recibirás propuestas de contenido. Tú decides qué publicar y cuándo.',
    semi:   'Preparamos el contenido y te lo enviamos para aprobación. Un clic y publicamos.',
    auto:   'Publicamos de forma autónoma según tu estrategia. Tú revisas los resultados.',
  };

  const rightStep5 = (
    <div style={{ padding: '48px 40px', height: '100%', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: MUTED, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: "'Cabinet Grotesk', sans-serif" }}>
        Cómo funciona
      </div>
      <div style={{ background: '#1a1d2e', borderRadius: 14, padding: 24, border: '1px solid rgba(255,255,255,0.07)', flex: 1 }}>
        <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 800, fontSize: '1rem', color: INK, marginBottom: 12 }}>
          {PUBLISH_MODE_OPTIONS.find((m) => m.value === publishMode)?.label}
        </div>
        <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: '0.88rem', color: MUTED, lineHeight: 1.7, marginBottom: 20 }}>
          {modeDescriptions[publishMode]}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {['Contenido creado por IA', 'Revisado por tu equipo', 'Publicado en Instagram y Facebook'].map((step, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: `rgba(255,92,26,${0.3 + i * 0.2})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 800, color: ACCENT, fontFamily: "'Cabinet Grotesk', sans-serif", flexShrink: 0 }}>
                {i + 1}
              </div>
              <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: '0.83rem', color: INK }}>{step}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const rightContent = [rightStep1, rightStep2, rightStep3, rightStep4, rightStep5][step - 1];

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', zIndex: 50, overflow: 'hidden' }}>

      {/* ── Left column ── */}
      <div style={{ width: '42%', background: BG_L, display: 'flex', flexDirection: 'column', padding: '44px 44px', overflowY: 'auto', flexShrink: 0 }}>

        {/* Logo */}
        <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 900, fontSize: '1.3rem', color: INK, letterSpacing: '-0.04em', marginBottom: 36, flexShrink: 0 }}>
          NeuroPost
        </div>

        {/* Progress */}
        <div style={{ marginBottom: 36, flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
            {([1,2,3,4,5] as Step[]).map((s) => (
              <div key={s} style={{ flex: 1, height: 3, borderRadius: 2, background: s <= step ? ACCENT : 'rgba(255,255,255,0.1)', transition: 'background 0.3s' }} />
            ))}
          </div>
          <p style={{ fontSize: '0.72rem', color: MUTED, fontFamily: "'Cabinet Grotesk', sans-serif", letterSpacing: '0.06em' }}>
            PASO {step} DE 5
          </p>
        </div>

        {/* ── Step 1: Sector ── */}
        {step === 1 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <SectionTitle>¿De qué trata tu negocio?</SectionTitle>
            <StepSub>Elige tu sector principal. Clic derecho en otro sector para añadirlo como secundario.</StepSub>

            <div style={{ flex: 1, overflowY: 'auto', marginBottom: 24 }}>
              {SECTOR_GROUPS.map((group) => (
                <div key={group.group} style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 700, color: MUTED, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: "'Cabinet Grotesk', sans-serif", marginBottom: 10 }}>
                    {group.group}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    {group.items.map((s) => {
                      const isPrimary   = sector === s.value;
                      const isSecondary = secondarySectors.includes(s.value);
                      return (
                        <button
                          key={s.value}
                          type="button"
                          onClick={() => { if (isPrimary) return; if (isSecondary) { toggleSecondary(s.value); return; } setSector(s.value as SocialSector); setSecondarySectors([]); }}
                          onContextMenu={(e) => { e.preventDefault(); toggleSecondary(s.value as SocialSector); }}
                          style={{
                            position: 'relative', height: 80, borderRadius: 10,
                            overflow: 'hidden', border: `2px solid ${isPrimary ? ACCENT : isSecondary ? '#059669' : 'transparent'}`,
                            cursor: 'pointer', padding: 0, background: 'transparent',
                            outline: 'none', transition: 'border-color 0.2s, transform 0.15s',
                            transform: isPrimary ? 'scale(1.02)' : 'scale(1)',
                            boxShadow: isPrimary ? `0 0 0 4px rgba(255,92,26,0.15)` : 'none',
                          }}
                        >
                          <img src={s.img} alt={s.label} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                          <div style={{ position: 'absolute', inset: 0, background: isPrimary ? 'rgba(255,92,26,0.25)' : 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.1) 60%)' }} />
                          <div style={{ position: 'absolute', bottom: 6, left: 7, right: 7, fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 700, fontSize: '0.72rem', color: 'white', textAlign: 'left', lineHeight: 1.2 }}>
                            {s.label}
                          </div>
                          {isPrimary && (
                            <div style={{ position: 'absolute', top: 6, right: 6, width: 18, height: 18, borderRadius: '50%', background: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', color: 'white', fontWeight: 900 }}>✓</div>
                          )}
                          {isSecondary && (
                            <div style={{ position: 'absolute', top: 6, right: 6, width: 18, height: 18, borderRadius: '50%', background: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', color: 'white', fontWeight: 900 }}>+</div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <BtnPrimary onClick={() => setStep(2)}>Siguiente →</BtnPrimary>
          </div>
        )}

        {/* ── Step 2: Visual style ── */}
        {step === 2 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <SectionTitle>¿Cómo quieres que se vea?</SectionTitle>
            <StepSub>El estilo visual define la edición, los colores y el tipo de contenido.</StepSub>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 28 }}>
              {VISUAL_STYLES.map((style) => {
                const selected = visualStyle === style.value;
                return (
                  <button key={style.value} type="button" onClick={() => setVisualStyle(style.value)} style={{
                    padding: 0, borderRadius: 12, overflow: 'hidden',
                    border: `2px solid ${selected ? ACCENT : 'rgba(255,255,255,0.08)'}`,
                    cursor: 'pointer', background: 'transparent', outline: 'none',
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                    boxShadow: selected ? `0 0 0 4px rgba(255,92,26,0.12)` : 'none',
                    position: 'relative',
                  }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                      {style.imgs.map((img, i) => (
                        <img key={i} src={img} alt="" style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', display: 'block' }} />
                      ))}
                    </div>
                    <div style={{ background: '#1a1d2e', padding: '10px 12px' }}>
                      <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 800, fontSize: '0.82rem', color: INK, marginBottom: 3 }}>
                        {style.title}
                      </div>
                      <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: '0.68rem', color: MUTED }}>
                        {style.tag}
                      </div>
                    </div>
                    {selected && (
                      <div style={{ position: 'absolute', top: 8, right: 8, width: 20, height: 20, borderRadius: '50%', background: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', color: 'white', fontWeight: 900 }}>✓</div>
                    )}
                  </button>
                );
              })}
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 'auto' }}>
              <BtnBack onClick={() => setStep(1)} />
              <BtnPrimary onClick={() => setStep(3)}>Siguiente →</BtnPrimary>
            </div>
          </div>
        )}

        {/* ── Step 3: Business details ── */}
        {step === 3 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <SectionTitle>Cuéntanos sobre ti</SectionTitle>
            <StepSub>Para que NeuroPost adapte el contenido a tu negocio.</StepSub>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 28 }}>
              <div>
                <Label>Nombre del negocio *</Label>
                <input style={inputStyle} type="text" placeholder="Ej: Heladería La Nube" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
              </div>
              {dynamicQuestions.map((q) => (
                <div key={q.key}>
                  <Label>{q.label}</Label>
                  <input style={inputStyle} type="text" placeholder={q.placeholder} value={dynamicAnswers[q.key] ?? ''} onChange={(e) => setDynamicAnswers((prev) => ({ ...prev, [q.key]: e.target.value }))} />
                </div>
              ))}
              <div>
                <Label>Ubicación <span style={{ opacity: 0.5, textTransform: 'none', fontWeight: 400 }}>(opcional)</span></Label>
                <input style={inputStyle} type="text" placeholder="Ej: Barcelona, Gràcia" value={location} onChange={(e) => setLocation(e.target.value)} />
              </div>
              <div>
                <Label>Slogan <span style={{ opacity: 0.5, textTransform: 'none', fontWeight: 400 }}>(opcional)</span></Label>
                <input style={inputStyle} type="text" placeholder="Ej: El sabor de lo auténtico" value={slogan} onChange={(e) => setSlogan(e.target.value)} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 'auto' }}>
              <BtnBack onClick={() => setStep(2)} />
              <BtnPrimary onClick={() => { if (!name.trim()) { toast.error('El nombre es obligatorio'); return; } setStep(4); }}>Siguiente →</BtnPrimary>
            </div>
          </div>
        )}

        {/* ── Step 4: Brand voice ── */}
        {step === 4 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <SectionTitle>Tu voz de marca</SectionTitle>
            <StepSub>Cómo quieres comunicarte con tu audiencia.</StepSub>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 24 }}>
              <div>
                <Label>Tono de comunicación</Label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {TONE_OPTIONS.map((t) => (
                    <button key={t.value} type="button" onClick={() => setTone(t.value)} style={{
                      padding: '12px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                      border: `1.5px solid ${tone === t.value ? ACCENT : 'rgba(255,255,255,0.08)'}`,
                      background: tone === t.value ? 'rgba(255,92,26,0.1)' : 'rgba(255,255,255,0.03)',
                      outline: 'none', transition: 'all 0.15s',
                    }}>
                      <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 700, fontSize: '0.88rem', color: tone === t.value ? INK : 'rgba(232,237,248,0.7)' }}>{t.label}</div>
                      <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: '0.74rem', color: MUTED, marginTop: 3 }}>{t.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label>Palabras clave <span style={{ opacity: 0.6, textTransform: 'none', fontWeight: 400 }}>(Enter para añadir)</span></Label>
                <div style={{ ...inputStyle, display: 'flex', flexWrap: 'wrap', gap: 6, padding: '8px 12px', minHeight: 44, height: 'auto' }}>
                  {keywords.map((k) => (
                    <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(255,92,26,0.15)', color: ACCENT, padding: '2px 10px', borderRadius: 40, fontSize: '0.78rem', fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 700 }}>
                      {k}
                      <button type="button" onClick={() => removeTag(keywords, setKeywords, k)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 12, padding: 0, lineHeight: 1 }}>×</button>
                    </span>
                  ))}
                  <input value={kwInput} onChange={(e) => setKwInput(e.target.value)}
                    onKeyDown={(e) => handleTagKeyDown(e, keywords, setKeywords, kwInput, setKwInput)}
                    onBlur={() => { if (kwInput.trim()) { addTag(keywords, setKeywords, kwInput); setKwInput(''); } }}
                    placeholder="artesanal, sostenible..."
                    style={{ background: 'none', border: 'none', outline: 'none', color: INK, fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: '0.85rem', flex: 1, minWidth: 100 }} />
                </div>
              </div>

              <div>
                <Label>Palabras prohibidas <span style={{ opacity: 0.6, textTransform: 'none', fontWeight: 400 }}>(opcional)</span></Label>
                <div style={{ ...inputStyle, display: 'flex', flexWrap: 'wrap', gap: 6, padding: '8px 12px', minHeight: 44, height: 'auto' }}>
                  {forbidden.map((f) => (
                    <span key={f} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(239,68,68,0.15)', color: '#f87171', padding: '2px 10px', borderRadius: 40, fontSize: '0.78rem', fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 700 }}>
                      {f}
                      <button type="button" onClick={() => removeTag(forbidden, setForbidden, f)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 12, padding: 0, lineHeight: 1 }}>×</button>
                    </span>
                  ))}
                  <input value={fbInput} onChange={(e) => setFbInput(e.target.value)}
                    onKeyDown={(e) => handleTagKeyDown(e, forbidden, setForbidden, fbInput, setFbInput)}
                    onBlur={() => { if (fbInput.trim()) { addTag(forbidden, setForbidden, fbInput); setFbInput(''); } }}
                    placeholder="barato, descuento..."
                    style={{ background: 'none', border: 'none', outline: 'none', color: INK, fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: '0.85rem', flex: 1, minWidth: 100 }} />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 'auto' }}>
              <BtnBack onClick={() => setStep(3)} />
              <BtnPrimary onClick={() => setStep(5)}>Siguiente →</BtnPrimary>
            </div>
          </div>
        )}

        {/* ── Step 5: Publish mode + colors ── */}
        {step === 5 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <SectionTitle>Modo de publicación</SectionTitle>
            <StepSub>¿Cómo quieres que gestionemos tu contenido?</StepSub>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
              {PUBLISH_MODE_OPTIONS.map((m) => (
                <button key={m.value} type="button" onClick={() => setPublishMode(m.value)} style={{
                  padding: '16px', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
                  border: `1.5px solid ${publishMode === m.value ? ACCENT : 'rgba(255,255,255,0.08)'}`,
                  background: publishMode === m.value ? 'rgba(255,92,26,0.1)' : 'rgba(255,255,255,0.03)',
                  display: 'flex', alignItems: 'center', gap: 14, outline: 'none', transition: 'all 0.15s',
                }}>
                  <span style={{ fontSize: '1.4rem', flexShrink: 0 }}>{m.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 700, fontSize: '0.9rem', color: publishMode === m.value ? INK : 'rgba(232,237,248,0.7)' }}>{m.label}</div>
                    <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: '0.78rem', color: MUTED, marginTop: 2 }}>{m.desc}</div>
                  </div>
                  {publishMode === m.value && <span style={{ color: ACCENT, fontWeight: 900, fontSize: '1rem', flexShrink: 0 }}>✓</span>}
                </button>
              ))}
            </div>

            <div style={{ marginBottom: 20 }}>
              <Label>Colores de marca</Label>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                {[{ label: 'Principal', value: primaryColor, set: setPrimaryColor }, { label: 'Secundario', value: secondaryColor, set: setSecondaryColor }].map((c) => (
                  <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input type="color" value={c.value} onChange={(e) => c.set(e.target.value)} style={{ width: 44, height: 44, borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', padding: 2, background: 'none' }} />
                    <div>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, fontFamily: "'Cabinet Grotesk', sans-serif", color: INK }}>{c.label}</div>
                      <div style={{ fontSize: '0.72rem', color: MUTED }}>{c.value}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <CouponInput
                onValidCoupon={(id, text) => { setPromoCodeId(id); setDiscountText(text); }}
                onClearCoupon={() => { setPromoCodeId(null); setDiscountText(''); }}
              />
              {discountText && <p style={{ fontSize: '0.8rem', color: '#4ade80', marginTop: 6, fontFamily: "'Cabinet Grotesk', sans-serif" }}>{discountText}</p>}
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 'auto' }}>
              <BtnBack onClick={() => setStep(4)} />
              <BtnPrimary onClick={handleSubmit} disabled={saving}>
                {saving ? (
                  <><span style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> Configurando...</>
                ) : '¡Empezar a publicar!'}
              </BtnPrimary>
            </div>
          </div>
        )}
      </div>

      {/* ── Right column ── */}
      <div style={{ flex: 1, background: BG_R, borderLeft: `1px solid ${BORDER}`, overflowY: 'auto' }}>
        {rightContent}
      </div>
    </div>
  );
}
