'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import type { SocialSector, BrandTone, PublishMode, PostGoal, VisualStyle } from '@/types';
import { TONE_OPTIONS, PUBLISH_MODE_OPTIONS } from '@/lib/brand-options';
import { useTagInput } from '@/hooks/useTagInput';

// ─── Sector catalog ───────────────────────────────────────────────────────────

type SectorGroup = { group: string; items: { value: SocialSector; label: string; emoji: string }[] };

const SECTOR_GROUPS: SectorGroup[] = [
  { group: 'Comida y Bebida', items: [
    { value: 'restaurante', label: 'Gastronomía', emoji: '🍕' },
    { value: 'heladeria',   label: 'Heladería / Pastelería', emoji: '🍦' },
    { value: 'cafeteria',   label: 'Cafetería / Brunch', emoji: '☕' },
    { value: 'cocteleria',  label: 'Cócteles / Bar', emoji: '🍸' },
    { value: 'street_food', label: 'Street food / Take away', emoji: '🌮' },
    { value: 'vinoteca',    label: 'Vinoteca / Maridaje', emoji: '🍷' },
    { value: 'panaderia',   label: 'Panadería / Bollería', emoji: '🥐' },
  ]},
  { group: 'Belleza y Estética', items: [
    { value: 'barberia',   label: 'Peluquería / Barbería', emoji: '💇' },
    { value: 'nail_art',   label: 'Nail art / Uñas', emoji: '💅' },
    { value: 'estetica',   label: 'Centro estético / Spa', emoji: '🧖' },
    { value: 'maquillaje', label: 'Maquillaje / Cosmética', emoji: '💄' },
  ]},
  { group: 'Moda y Estilo', items: [
    { value: 'boutique',    label: 'Boutique / Moda mujer', emoji: '👗' },
    { value: 'moda_hombre', label: 'Moda hombre', emoji: '👔' },
    { value: 'zapateria',   label: 'Zapatería / Accesorios', emoji: '👟' },
    { value: 'skincare',    label: 'Cosmética / Skincare', emoji: '🧴' },
  ]},
  { group: 'Salud y Bienestar', items: [
    { value: 'gym',      label: 'Gimnasio / Fitness', emoji: '🏋️' },
    { value: 'yoga',     label: 'Yoga / Pilates', emoji: '🧘' },
    { value: 'dental',   label: 'Clínica dental', emoji: '🦷' },
    { value: 'clinica',  label: 'Clínica / Medicina', emoji: '🏥' },
    { value: 'nutricion',label: 'Nutrición / Dietética', emoji: '🌿' },
  ]},
  { group: 'Hogar y Diseño', items: [
    { value: 'decoracion',  label: 'Decoración / Interiorismo', emoji: '🛋️' },
    { value: 'jardineria',  label: 'Jardinería / Plantas', emoji: '🌱' },
    { value: 'reformas',    label: 'Reformas / Construcción', emoji: '🔨' },
    { value: 'inmobiliaria',label: 'Inmobiliaria', emoji: '🏠' },
  ]},
  { group: 'Servicios Locales', items: [
    { value: 'fotografia', label: 'Fotografía / Vídeo', emoji: '📸' },
    { value: 'academia',   label: 'Academia / Formación', emoji: '🎓' },
    { value: 'abogado',    label: 'Abogado / Gestor', emoji: '⚖️' },
    { value: 'veterinario',label: 'Veterinario / Mascotas', emoji: '🐾' },
    { value: 'mecanica',   label: 'Mecánica / Automoción', emoji: '🚗' },
  ]},
  { group: 'Ocio y Cultura', items: [
    { value: 'teatro',  label: 'Teatro / Espectáculos', emoji: '🎭' },
    { value: 'arte',    label: 'Arte / Galería', emoji: '🎨' },
    { value: 'libreria',label: 'Librería / Editorial', emoji: '📚' },
    { value: 'gaming',  label: 'Gaming / Entretenimiento', emoji: '🎮' },
    { value: 'viajes',  label: 'Viajes / Turismo', emoji: '✈️' },
    { value: 'hotel',   label: 'Hotel / Alojamiento', emoji: '🏨' },
  ]},
  { group: 'Comercio', items: [
    { value: 'floristeria',label: 'Floristería', emoji: '🌸' },
    { value: 'regalos',    label: 'Regalos / Artesanía', emoji: '🎁' },
    { value: 'tecnologia', label: 'Tecnología / Electrónica', emoji: '🖥️' },
    { value: 'otro',       label: 'Otro negocio', emoji: '🏪' },
  ]},
];

// ─── Visual styles ────────────────────────────────────────────────────────────

const VISUAL_STYLES: {
  value: VisualStyle; title: string; tagline: string; perfect: string; colors: string[]; emoji: string;
}[] = [
  { value: 'creative', title: 'Creativo y Colorido', emoji: '🎨',
    tagline: 'Colores potentes, composiciones originales, contenido que para el scroll',
    perfect: 'Heladerías, nail art, moda colorida, street food',
    colors: ['#FF6B9D', '#FF9500', '#34C759', '#007AFF'] },
  { value: 'elegant', title: 'Elegante y Minimal', emoji: '🤍',
    tagline: 'Sofisticado, limpio y atemporal. Menos es más.',
    perfect: 'Joyería, clínicas, inmobiliarias, hoteles, moda premium',
    colors: ['#F5F5F0', '#D4C5B0', '#8B7355', '#2C2C2C'] },
  { value: 'warm', title: 'Cálido y Cercano', emoji: '🧡',
    tagline: 'Auténtico, familiar y cercano. Como si lo hiciera un amigo.',
    perfect: 'Cafeterías, restaurantes familiares, yoga, nutrición, mascotas',
    colors: ['#D4916A', '#C17D52', '#F2CDA0', '#8B4513'] },
  { value: 'dynamic', title: 'Dinámico y Moderno', emoji: '⚡',
    tagline: 'Energía, actitud y tendencia. Para los que quieren ser referentes.',
    perfect: 'Gimnasios, barbería, moda urbana, bar de noche, gaming',
    colors: ['#1C1C1E', '#FF3B30', '#636366', '#AEAEB2'] },
];

// ─── Dynamic sector questions ─────────────────────────────────────────────────

function getDynamicQuestions(sector: SocialSector): { label: string; placeholder: string; key: string }[] {
  const map: Partial<Record<SocialSector, { label: string; placeholder: string; key: string }[]>> = {
    heladeria:   [{ label: 'Producto estrella',       placeholder: 'Ej: helado de pistacho artesanal',   key: 'star_product' }, { label: 'Lo que os hace únicos', placeholder: 'Ej: recetas italianas de la abuela', key: 'unique' }],
    restaurante: [{ label: 'Tipo de cocina',          placeholder: 'Ej: italiana, mediterránea, fusión', key: 'cuisine' },      { label: 'Ambiente y precio',     placeholder: 'Ej: familiar, 15-25€/persona',   key: 'ambiente' }],
    cafeteria:   [{ label: 'Especialidad',             placeholder: 'Ej: specialty coffee, brunch',      key: 'specialty' },    { label: 'Ambiente',              placeholder: 'Ej: coworking, acogedor, terraza', key: 'ambiente' }],
    gym:         [{ label: 'Tipo de entrenamiento',   placeholder: 'Ej: CrossFit, funcional, yoga',      key: 'training' },     { label: 'A quién va dirigido',   placeholder: 'Ej: principiantes, avanzados',   key: 'target' }],
    clinica:     [{ label: 'Especialidad médica',     placeholder: 'Ej: estética, dental, fisioterapia', key: 'specialty' },    { label: 'Diferencial',           placeholder: 'Ej: tecnología de última generación', key: 'unique' }],
    barberia:    [{ label: 'Servicios destacados',    placeholder: 'Ej: corte clásico, barba, color',    key: 'services' },     { label: 'Estilo del local',      placeholder: 'Ej: vintage, urbano, clásico',   key: 'style' }],
    boutique:    [{ label: 'Tipo de moda',            placeholder: 'Ej: casual, formal, boho, sport',    key: 'fashion_type' }, { label: 'Marcas o estilo propio',placeholder: 'Ej: marcas locales, ropa propia', key: 'brands' }],
    inmobiliaria:[{ label: 'Zonas de operación',      placeholder: 'Ej: Barcelona centro, Sarrià',       key: 'zones' },        { label: 'Especialidad',          placeholder: 'Ej: residencial, lujo, comercial', key: 'specialty' }],
    yoga:        [{ label: 'Tipos de clases',         placeholder: 'Ej: hatha, vinyasa, meditación',     key: 'classes' },      { label: 'Nivel y ambiente',      placeholder: 'Ej: para principiantes, tranquilo', key: 'level' }],
    dental:      [{ label: 'Servicios principales',  placeholder: 'Ej: ortodoncia, blanqueamiento',      key: 'services' },     { label: 'Diferencial',           placeholder: 'Ej: sin dolor, tecnología digital',  key: 'unique' }],
    hotel:       [{ label: 'Tipo de alojamiento',    placeholder: 'Ej: boutique, rural, urbano',         key: 'type' },         { label: 'Experiencia estrella',  placeholder: 'Ej: spa, vistas al mar, gastronomía', key: 'experience' }],
  };
  return map[sector] ?? [
    { label: 'Tu producto o servicio estrella', placeholder: 'Ej: lo más popular de tu negocio', key: 'star_product' },
    { label: 'Lo que te hace diferente',        placeholder: 'Ej: experiencia, calidad, precio',  key: 'unique' },
  ];
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 4 | 5;

export default function OnboardingPage() {
  const router  = useRouter();
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

  const dynamicQuestions = getDynamicQuestions(sector);

  function toggleSecondary(s: SocialSector) {
    if (s === sector) return;
    setSecondarySectors((prev) =>
      prev.includes(s)
        ? prev.filter((x) => x !== s)
        : prev.length < 2 ? [...prev, s] : prev,
    );
  }

  async function handleSubmit() {
    if (!name.trim()) { toast.error('El nombre del negocio es obligatorio'); return; }
    setSaving(true);
    try {
      const extraContext = dynamicQuestions
        .map((q) => `${q.label}: ${dynamicAnswers[q.key] ?? ''}`)
        .filter((l) => !l.endsWith(': '))
        .join('. ');

      const styleInstructions: Record<VisualStyle, string> = {
        creative: 'Estilo creativo y colorido: usa emojis, exclamaciones y texto dinámico.',
        elegant:  'Estilo elegante y minimal: sin emojis, frases cortas y sofisticadas.',
        warm:     'Estilo cálido y cercano: tono familiar, tuteo y proximidad.',
        dynamic:  'Estilo dinámico y moderno: frases cortas, imperativas y mucha energía.',
      };

      const res = await fetch('/api/brands', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          name,
          sector,
          secondary_sectors: secondarySectors,
          visual_style:      visualStyle,
          tone,
          hashtags:          keywords,
          location:          location || null,
          slogans:           slogan ? [slogan] : [],
          publish_mode:      publishMode,
          colors:            { primary: primaryColor, secondary: secondaryColor, accent: primaryColor },
          rules: {
            forbiddenWords:      forbidden,
            noPublishDays:       [],
            noEmojis:            visualStyle === 'elegant',
            noAutoReplyNegative: false,
            forbiddenTopics:     [],
          },
          brand_voice_doc: [
            `Negocio: ${name}.`,
            `Sector: ${sector}.${secondarySectors.length > 0 ? ` Sectores secundarios: ${secondarySectors.join(', ')}.` : ''}`,
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
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="auth-page" style={{ maxWidth: step === 1 ? 700 : 540 }}>
      <div className="auth-card" style={{ padding: '36px 32px' }}>
        <div className="auth-logo">NeuroPost</div>

        {/* Progress */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          {([1,2,3,4,5] as Step[]).map((s) => (
            <div key={s} style={{
              flex: s === step ? 3 : 1, height: 4, borderRadius: 4,
              background: s <= step ? 'var(--orange)' : 'var(--border)',
              transition: 'flex 0.3s, background 0.3s',
            }} />
          ))}
        </div>
        <p style={{ fontSize: '0.75rem', color: 'var(--muted)', textAlign: 'center', marginBottom: 24 }}>
          Paso {step} de 5
        </p>

        {/* ── STEP 1: Sector ── */}
        {step === 1 && (
          <>
            <h1 className="auth-title">¿De qué trata tu negocio?</h1>
            <p className="auth-sub">Elegiremos el tipo de contenido, tono e ideas adaptados a ti</p>

            {SECTOR_GROUPS.map((group) => (
              <div key={group.group} style={{ marginBottom: 14 }}>
                <p style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', fontFamily: "'Cabinet Grotesk', sans-serif", marginBottom: 7 }}>
                  {group.group}
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
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
                          padding: '7px 12px', borderRadius: 20,
                          border: `1.5px solid ${isPrimary ? 'var(--orange)' : isSecondary ? 'var(--green)' : 'var(--border)'}`,
                          background: isPrimary ? 'var(--orange-light)' : isSecondary ? 'var(--green-light)' : 'white',
                          cursor: 'pointer', fontSize: '0.82rem',
                          fontFamily: "'Cabinet Grotesk', sans-serif",
                          fontWeight: isPrimary || isSecondary ? 700 : 500,
                          display: 'flex', alignItems: 'center', gap: 5,
                        }}
                      >
                        {s.emoji} {s.label}
                        {isPrimary   && <span style={{ color: 'var(--orange)', fontSize: '0.7rem' }}>✓</span>}
                        {isSecondary && <span style={{ color: 'var(--green)',  fontSize: '0.7rem' }}>+</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            <p style={{ fontSize: '0.74rem', color: 'var(--muted)', marginTop: 6, marginBottom: 20, fontFamily: "'Cabinet Grotesk', sans-serif" }}>
              Clic derecho en otro sector para añadirlo como secundario (máx. 2)
            </p>
            <button className="btn-primary btn-full btn-orange" onClick={() => setStep(2)}>
              Siguiente →
            </button>
          </>
        )}

        {/* ── STEP 2: Visual style ── */}
        {step === 2 && (
          <>
            <h1 className="auth-title">¿Cómo quieres que se vea?</h1>
            <p className="auth-sub">La IA adaptará la edición, los colores y el tipo de contenido a tu estilo</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
              {VISUAL_STYLES.map((style) => {
                const selected = visualStyle === style.value;
                return (
                  <button key={style.value} type="button" onClick={() => setVisualStyle(style.value)} style={{
                    padding: '16px', borderRadius: 12,
                    border: `2px solid ${selected ? 'var(--orange)' : 'var(--border)'}`,
                    background: selected ? 'var(--orange-light)' : 'white',
                    cursor: 'pointer', textAlign: 'left',
                    display: 'grid', gridTemplateColumns: '1fr auto', gap: '10px 16px',
                  }}>
                    <div>
                      <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 800, fontSize: '0.95rem', marginBottom: 3 }}>
                        {style.emoji} {style.title}
                      </div>
                      <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: '0.8rem', color: 'var(--muted)', marginBottom: 5 }}>
                        {style.tagline}
                      </div>
                      <div style={{ fontSize: '0.73rem', color: 'var(--muted)' }}>
                        Perfecto para: {style.perfect}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'flex-start', paddingTop: 2 }}>
                      {style.colors.map((c) => (
                        <div key={c} style={{ width: 18, height: 18, borderRadius: 4, background: c, border: '1px solid rgba(0,0,0,0.08)' }} />
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn-outline" onClick={() => setStep(1)}>← Atrás</button>
              <button className="btn-primary btn-full btn-orange" onClick={() => setStep(3)}>Siguiente →</button>
            </div>
          </>
        )}

        {/* ── STEP 3: Details ── */}
        {step === 3 && (
          <>
            <h1 className="auth-title">Cuéntanos sobre ti</h1>
            <p className="auth-sub">Para que NeuroPost adapte el contenido a tu negocio</p>

            <div className="form-group">
              <label>Nombre del negocio *</label>
              <input type="text" placeholder="Ej: Heladería La Nube" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </div>

            {dynamicQuestions.map((q) => (
              <div key={q.key} className="form-group">
                <label>{q.label}</label>
                <input type="text" placeholder={q.placeholder} value={dynamicAnswers[q.key] ?? ''} onChange={(e) => setDynamicAnswers((prev) => ({ ...prev, [q.key]: e.target.value }))} />
              </div>
            ))}

            <div className="form-group">
              <label>Ubicación <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(opcional)</span></label>
              <input type="text" placeholder="Ej: Barcelona, Gràcia" value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Slogan <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(opcional)</span></label>
              <input type="text" placeholder="Ej: El sabor de lo auténtico" value={slogan} onChange={(e) => setSlogan(e.target.value)} />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn-outline" onClick={() => setStep(2)}>← Atrás</button>
              <button className="btn-primary btn-full btn-orange" onClick={() => { if (!name.trim()) { toast.error('El nombre es obligatorio'); return; } setStep(4); }}>
                Siguiente →
              </button>
            </div>
          </>
        )}

        {/* ── STEP 4: Brand voice ── */}
        {step === 4 && (
          <>
            <h1 className="auth-title">Tu voz de marca</h1>
            <p className="auth-sub">Cómo quieres comunicarte con tu audiencia</p>

            <div className="form-group">
              <label>Tono de comunicación</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {TONE_OPTIONS.map((t) => (
                  <button key={t.value} type="button" onClick={() => setTone(t.value)} style={{
                    padding: '12px', borderRadius: 'var(--r)',
                    border: `1.5px solid ${tone === t.value ? 'var(--orange)' : 'var(--border)'}`,
                    background: tone === t.value ? 'var(--orange-light)' : 'white',
                    cursor: 'pointer', textAlign: 'left',
                  }}>
                    <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 700, fontSize: '0.88rem' }}>{t.label}</div>
                    <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: '0.75rem', color: 'var(--muted)', marginTop: 2 }}>{t.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>Palabras clave <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(Enter para añadir)</span></label>
              <div className="tags-input-area">
                {keywords.map((k) => (
                  <span key={k} className="tag-chip">{k}<button type="button" onClick={() => removeTag(keywords, setKeywords, k)}>×</button></span>
                ))}
                <input value={kwInput} onChange={(e) => setKwInput(e.target.value)}
                  onKeyDown={(e) => handleTagKeyDown(e, keywords, setKeywords, kwInput, setKwInput)}
                  onBlur={() => { if (kwInput.trim()) { addTag(keywords, setKeywords, kwInput); setKwInput(''); } }}
                  placeholder="artesanal, sostenible, familiar..." />
              </div>
            </div>

            <div className="form-group">
              <label>Palabras prohibidas <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(Enter para añadir)</span></label>
              <div className="tags-input-area">
                {forbidden.map((f) => (
                  <span key={f} className="tag-chip" style={{ background: '#ffeded' }}>{f}<button type="button" onClick={() => removeTag(forbidden, setForbidden, f)}>×</button></span>
                ))}
                <input value={fbInput} onChange={(e) => setFbInput(e.target.value)}
                  onKeyDown={(e) => handleTagKeyDown(e, forbidden, setForbidden, fbInput, setFbInput)}
                  onBlur={() => { if (fbInput.trim()) { addTag(forbidden, setForbidden, fbInput); setFbInput(''); } }}
                  placeholder="barato, descuento..." />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn-outline" onClick={() => setStep(3)}>← Atrás</button>
              <button className="btn-primary btn-full btn-orange" onClick={() => setStep(5)}>Siguiente →</button>
            </div>
          </>
        )}

        {/* ── STEP 5: Publish mode + colors ── */}
        {step === 5 && (
          <>
            <h1 className="auth-title">Modo de publicación</h1>
            <p className="auth-sub">¿Cómo quieres que gestionemos la publicación de tu contenido?</p>

            <div className="form-group">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {PUBLISH_MODE_OPTIONS.map((m) => (
                  <button key={m.value} type="button" onClick={() => setPublishMode(m.value)} style={{
                    padding: '14px 16px', borderRadius: 'var(--r)',
                    border: `1.5px solid ${publishMode === m.value ? 'var(--orange)' : 'var(--border)'}`,
                    background: publishMode === m.value ? 'var(--orange-light)' : 'white',
                    cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 14,
                  }}>
                    <span style={{ fontSize: '1.4rem' }}>{m.emoji}</span>
                    <div>
                      <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontWeight: 700, fontSize: '0.9rem' }}>{m.label}</div>
                      <div style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: '0.78rem', color: 'var(--muted)', marginTop: 2 }}>{m.desc}</div>
                    </div>
                    {publishMode === m.value && <span style={{ marginLeft: 'auto', color: 'var(--orange)', fontWeight: 700 }}>✓</span>}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>Colores de marca</label>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                {[{ label: 'Principal', value: primaryColor, set: setPrimaryColor }, { label: 'Secundario', value: secondaryColor, set: setSecondaryColor }].map((c) => (
                  <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input type="color" value={c.value} onChange={(e) => c.set(e.target.value)} style={{ width: 44, height: 44, borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer', padding: 2 }} />
                    <div>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, fontFamily: "'Cabinet Grotesk', sans-serif" }}>{c.label}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>{c.value}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn-outline" onClick={() => setStep(4)}>← Atrás</button>
              <button className="btn-primary btn-full btn-orange" onClick={handleSubmit} disabled={saving}>
                {saving ? <><span className="loading-spinner" />Configurando...</> : '¡Empezar a crear contenido! 🚀'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
