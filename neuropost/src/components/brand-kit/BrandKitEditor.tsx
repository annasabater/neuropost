'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppStore } from '@/store/useAppStore';
import type {
  BrandTone, VisualStyle, PublishMode, SocialSector,
  BrandRules, BrandPreferences, BrandVoicePreset, SubscriptionPlan,
} from '@/types';
import { PLAN_LIMITS, PLAN_META } from '@/types';
import { PUBLISH_MODE_OPTIONS, SECTOR_OPTIONS } from '@/lib/brand-options';
import { defaultPreferencesFor, normalizePreferences, minimumPlanFor, upgradeLabel } from '@/lib/plan-features';
import { useTagInput } from '@/hooks/useTagInput';
import { AESTHETIC_PRESETS, type AestheticPreset } from '@/lib/brand/aesthetic-presets';
import { FONT_CATALOG } from '@/lib/stories/fonts-catalog';

type AestheticPresetId = AestheticPreset['id'];
type OverlayIntensity  = 'none' | 'subtle' | 'medium' | 'strong';

const OVERLAY_OPTIONS: { value: OverlayIntensity; label: string; opacity: number }[] = [
  { value: 'none',   label: 'Sin overlay', opacity: 0    },
  { value: 'subtle', label: 'Sutil',       opacity: 0.30 },
  { value: 'medium', label: 'Medio',       opacity: 0.55 },
  { value: 'strong', label: 'Fuerte',      opacity: 0.75 },
];

function ensureGoogleFont(family: string, weight: number) {
  if (typeof document === 'undefined') return;
  const id = `gfont-${family.replace(/\s+/g, '-')}-${weight}`;
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id   = id;
  link.rel  = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, '+')}:wght@${weight}&display=swap`;
  document.head.appendChild(link);
}

const f  = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

type EditSection =
  | 'basics' | 'visual' | 'estetica' | 'tone' | 'colors'
  | 'hashtags' | 'voice' | 'publish' | 'rules' | 'preferences'
  | null;

const VALID_SECTIONS: EditSection[] = [
  'basics', 'visual', 'estetica', 'tone', 'colors', 'hashtags',
  'voice', 'publish', 'rules', 'preferences',
];

const STYLE_DATA: { value: VisualStyle; title: string }[] = [
  { value: 'creative', title: 'Creativo' },
  { value: 'elegant',  title: 'Elegante' },
  { value: 'warm',     title: 'Cálido'   },
  { value: 'dynamic',  title: 'Dinámico' },
];

const TONE_DATA: { value: BrandTone; label: string; desc: string; example: string }[] = [
  { value: 'cercano',      label: 'Cercano',      desc: 'Amigable y accesible',      example: '¡Buenos días! ☀️ Empezamos el día con energía.' },
  { value: 'profesional',  label: 'Profesional',  desc: 'Formal y de confianza',     example: 'Nos complace presentar nuestra nueva propuesta.' },
  { value: 'divertido',    label: 'Divertido',    desc: 'Energético y dinámico',     example: '¿Quién dijo que los lunes son aburridos? 🎉' },
  { value: 'premium',      label: 'Premium',      desc: 'Exclusivo y sofisticado',   example: 'Donde la artesanía encuentra la elegancia.' },
];

const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const PERSONALITY_CHIPS = [
  'Cercano', 'Premium', 'Disruptivo', 'Enérgico', 'Elegante',
  'Minimalista', 'Divertido', 'Cálido', 'Profesional', 'Inspirador',
  'Educativo', 'Creativo',
];

const LENGTH_OPTIONS: { value: BrandVoicePreset['length']; label: string; desc: string }[] = [
  { value: 'short',  label: 'Corto',  desc: 'Frases directas, 1-2 líneas' },
  { value: 'medium', label: 'Medio',  desc: 'Un párrafo, 3-5 líneas'      },
  { value: 'long',   label: 'Largo',  desc: 'Historia completa, 6+ líneas' },
];

const ADDRESSING_OPTIONS: { value: BrandVoicePreset['addressing']; label: string; example: string }[] = [
  { value: 'tu',    label: 'Tuteo',    example: '"Te va a encantar"'   },
  { value: 'usted', label: 'Ustedeo', example: '"Le invitamos a…"'    },
  { value: 'mixed', label: 'Mezclado', example: 'Según contexto'       },
];

const STORYTELLING_OPTIONS: { value: BrandVoicePreset['storytelling']; label: string; desc: string }[] = [
  { value: 'low',    label: 'Factual',     desc: 'Datos, productos, CTAs'    },
  { value: 'medium', label: 'Equilibrado', desc: 'Mezcla historia y datos'   },
  { value: 'high',   label: 'Narrativo',   desc: 'Cuentos, emoción, personas' },
];

const DEFAULT_VOICE_PRESET: BrandVoicePreset = {
  personality:  [],
  length:       'medium',
  addressing:   'tu',
  storytelling: 'medium',
  extraNotes:   '',
};

function composeVoiceDoc(
  preset: BrandVoicePreset,
  ctx: { name: string; sector: string | null; tone: string | null },
): string {
  const lines: string[] = [];
  lines.push(`Negocio: ${ctx.name || 'Sin nombre'}.`);
  if (ctx.sector) lines.push(`Sector: ${ctx.sector}.`);
  if (ctx.tone)   lines.push(`Tono principal: ${ctx.tone}.`);
  if (preset.personality.length) lines.push(`Personalidad: ${preset.personality.join(', ').toLowerCase()}.`);
  const lengthLbl = LENGTH_OPTIONS.find(l => l.value === preset.length)?.desc ?? preset.length;
  lines.push(`Longitud preferida: ${lengthLbl}.`);
  const addrLbl = preset.addressing === 'tu' ? 'tuteo (tú)' : preset.addressing === 'usted' ? 'ustedeo (usted)' : 'mezclado según contexto';
  lines.push(`Cómo hablar al lector: ${addrLbl}.`);
  const storyLbl = STORYTELLING_OPTIONS.find(s => s.value === preset.storytelling)?.desc ?? preset.storytelling;
  lines.push(`Storytelling: ${storyLbl}.`);
  if (preset.extraNotes.trim()) lines.push(`Notas: ${preset.extraNotes.trim()}`);
  return lines.join(' ');
}

const SECTOR_HASHTAG_SUGGESTIONS: Partial<Record<SocialSector, string[]>> = {
  restaurante: ['gastronomia', 'foodie', 'restaurante', 'cocinalocal', 'km0', 'chef', 'menu', 'productofresco'],
  gym:         ['gym', 'fitness', 'workout', 'entrenamiento', 'motivation', 'crossfit', 'strong', 'fitfam'],
  dental:      ['dental', 'sonrisa', 'clinicadental', 'dentist', 'ortodoncia', 'saludbucal', 'dentalcare'],
  clinica:     ['salud', 'clinica', 'medicina', 'bienestar', 'healthcare', 'doctores'],
  otro:        ['emprendimiento', 'negociolocal', 'españa', 'pyme', 'emprendedor'],
};
function suggestedHashtagsFor(sector: SocialSector | null | undefined): string[] {
  return SECTOR_HASHTAG_SUGGESTIONS[sector ?? 'otro'] ?? SECTOR_HASHTAG_SUGGESTIONS.otro ?? [];
}

export function BrandKitEditor() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const brand        = useAppStore((s) => s.brand);
  const updateBrand  = useAppStore((s) => s.updateBrand);

  const editParam = searchParams.get('edit') as EditSection | null;
  const editing: EditSection = VALID_SECTIONS.includes(editParam as EditSection) ? editParam : null;

  function close() {
    router.push('/brand-kit');
  }

  const [saving, setSaving] = useState(false);

  const currentPlan: SubscriptionPlan = brand?.plan ?? 'starter';
  const planLimits = PLAN_LIMITS[currentPlan];

  const [name,                 setName]                 = useState(brand?.name ?? '');
  const [sector,               setSector]               = useState<SocialSector>(brand?.sector ?? 'otro');
  const [otherSector,          setOtherSector]          = useState((brand?.rules as BrandRules | null)?.sectorOther ?? '');
  const [country,              setCountry]              = useState('España');
  const [region,               setRegion]               = useState('');
  const [visualStyle,          setVisualStyle]          = useState<VisualStyle>(brand?.visual_style ?? 'warm');
  const [tone,                 setTone]                 = useState<BrandTone>(brand?.tone ?? 'cercano');
  const [primaryColor,         setPrimaryColor]         = useState(brand?.colors?.primary ?? '#0F766E');
  const [secondaryColor,       setSecondaryColor]       = useState(brand?.colors?.secondary ?? '#374151');
  const [hashtags,             setHashtags]             = useState(brand?.hashtags?.join(' ') ?? '');
  const [slogans,              setSlogans]              = useState(brand?.slogans?.join('\n') ?? '');
  const [publishMode,          setPublishMode]          = useState<PublishMode>(brand?.publish_mode ?? 'semi');
  const [noPublishDays,        setNoPublishDays]        = useState<number[]>([]);
  const [noEmojis,             setNoEmojis]             = useState(false);
  const [noAutoReplyNegative,  setNoAutoReplyNegative]  = useState(false);
  const [forbiddenWords,       setForbiddenWords]       = useState<string[]>([]);
  const [forbiddenTopics,      setForbiddenTopics]      = useState<string[]>([]);
  const [fwInput,              setFwInput]              = useState('');
  const [ftInput,              setFtInput]              = useState('');
  const [preferences,          setPreferences]          = useState<BrandPreferences>(() => defaultPreferencesFor(currentPlan));
  const [voicePreset,          setVoicePreset]          = useState<BrandVoicePreset>(DEFAULT_VOICE_PRESET);

  // Phase 1 — creative direction
  const [aestheticPreset,      setAestheticPreset]      = useState<AestheticPresetId>((brand?.aesthetic_preset as AestheticPresetId | null | undefined) ?? 'editorial');
  const [realismLevel,         setRealismLevel]         = useState<number>(brand?.realism_level ?? 70);
  const [typographyDisplay,    setTypographyDisplay]    = useState<string>(brand?.typography_display ?? 'barlow_condensed');
  const [typographyBody,       setTypographyBody]       = useState<string>(brand?.typography_body ?? 'barlow');
  const [overlayIntensity,     setOverlayIntensity]     = useState<OverlayIntensity>((brand?.overlay_intensity as OverlayIntensity | null | undefined) ?? 'medium');
  const [allowGraphicElements, setAllowGraphicElements] = useState<boolean>(brand?.allow_graphic_elements ?? true);
  const [aestheticSavedAt,     setAestheticSavedAt]     = useState<number | null>(null);

  const { addTag, removeTag, handleTagKeyDown } = useTagInput();

  useEffect(() => {
    if (!brand) return;
    setName(brand.name ?? '');
    setSector(brand.sector ?? 'otro');
    setOtherSector((brand.rules as BrandRules | null)?.sectorOther ?? '');
    const loc = brand.location ?? '';
    const parts = loc.split(',').map(s => s.trim());
    setRegion(parts[0] ?? '');
    if (parts[1]) setCountry(parts[1]);
    setVisualStyle(brand.visual_style ?? 'warm');
    setTone(brand.tone ?? 'cercano');
    setPrimaryColor(brand.colors?.primary ?? '#0F766E');
    setSecondaryColor(brand.colors?.secondary ?? '#374151');
    setHashtags(brand.hashtags?.join(' ') ?? '');
    setSlogans(brand.slogans?.join('\n') ?? '');
    setPublishMode(brand.publish_mode ?? 'semi');
    const rules = brand.rules as BrandRules | null;
    setNoPublishDays(rules?.noPublishDays ?? []);
    setNoEmojis(rules?.noEmojis ?? false);
    setNoAutoReplyNegative(rules?.noAutoReplyNegative ?? false);
    setForbiddenWords(rules?.forbiddenWords ?? []);
    setForbiddenTopics(rules?.forbiddenTopics ?? []);
    setPreferences(normalizePreferences(brand.plan ?? 'starter', rules?.preferences));
    setVoicePreset(rules?.voicePreset ?? DEFAULT_VOICE_PRESET);
    setAestheticPreset((brand.aesthetic_preset as AestheticPresetId | null | undefined) ?? 'editorial');
    setRealismLevel(brand.realism_level ?? 70);
    setTypographyDisplay(brand.typography_display ?? 'barlow_condensed');
    setTypographyBody(brand.typography_body ?? 'barlow');
    setOverlayIntensity((brand.overlay_intensity as OverlayIntensity | null | undefined) ?? 'medium');
    setAllowGraphicElements(brand.allow_graphic_elements ?? true);
  }, [brand]);

  // Inject Google Fonts for the live previews in the typography selectors
  useEffect(() => {
    const display = FONT_CATALOG.find(f => f.id === typographyDisplay);
    const body    = FONT_CATALOG.find(f => f.id === typographyBody);
    if (display) ensureGoogleFont(display.google_family, display.weight);
    if (body)    ensureGoogleFont(body.google_family,    body.weight);
  }, [typographyDisplay, typographyBody]);

  async function patchAesthetic(patch: Record<string, unknown>) {
    try {
      const res  = await fetch('/api/brand/aesthetic', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const json = await res.json();
      if (res.ok && json.brand) {
        updateBrand(json.brand);
        setAestheticSavedAt(Date.now());
      } else {
        toast.error(json.error ?? 'Error al guardar');
      }
    } catch {
      toast.error('Error de conexión');
    }
  }

  // Auto-clear "Guardado ✓" after 2s
  useEffect(() => {
    if (aestheticSavedAt === null) return;
    const t = setTimeout(() => setAestheticSavedAt(null), 2000);
    return () => clearTimeout(t);
  }, [aestheticSavedAt]);

  function toggleDay(d: number) {
    setNoPublishDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  }

  async function save() {
    setSaving(true);
    const patch: Record<string, unknown> = {};

    if (editing === 'basics') {
      if (!name.trim()) { toast.error('El nombre es obligatorio'); setSaving(false); return; }
      patch.name   = name.trim();
      patch.sector = sector;
      const combined = [region.trim(), country.trim()].filter(Boolean).join(', ');
      patch.location = combined || null;
      const existingPreset = (brand?.rules as BrandRules | null)?.voicePreset ?? voicePreset;
      const effectiveSector = sector === 'otro' ? (otherSector.trim() || null) : sector;
      patch.brand_voice_doc = composeVoiceDoc(existingPreset, { name: name.trim(), sector: effectiveSector, tone: brand?.tone ?? tone });
      patch.rules = {
        noPublishDays, noEmojis, noAutoReplyNegative, forbiddenWords, forbiddenTopics,
        preferences: normalizePreferences(currentPlan, preferences), voicePreset,
        ...(sector === 'otro' ? { sectorOther: otherSector.trim() || undefined } : {}),
      } satisfies BrandRules;
    }
    if (editing === 'visual')  patch.visual_style = visualStyle;
    if (editing === 'tone')    patch.tone = tone;
    if (editing === 'colors')  patch.colors = { primary: primaryColor, secondary: secondaryColor, accent: primaryColor };
    if (editing === 'hashtags') {
      patch.hashtags = hashtags.split(/[\s,]+/).map(h => h.replace(/^#/, '').trim()).filter(Boolean);
      patch.slogans  = slogans.split('\n').map(s => s.trim()).filter(Boolean);
      patch.rules    = { noPublishDays, noEmojis, noAutoReplyNegative, forbiddenWords, forbiddenTopics, preferences: normalizePreferences(currentPlan, preferences), voicePreset } satisfies BrandRules;
    }
    if (editing === 'voice') {
      const doc = composeVoiceDoc(voicePreset, { name: brand?.name ?? name, sector: brand?.sector ?? sector ?? null, tone: brand?.tone ?? tone });
      patch.brand_voice_doc = doc;
      patch.rules = { noPublishDays, noEmojis, noAutoReplyNegative, forbiddenWords, forbiddenTopics, preferences: normalizePreferences(currentPlan, preferences), voicePreset } satisfies BrandRules;
    }
    if (editing === 'publish')     patch.publish_mode = publishMode;
    if (editing === 'rules')       patch.rules = { noPublishDays, noEmojis, noAutoReplyNegative, forbiddenWords, forbiddenTopics, preferences: normalizePreferences(currentPlan, preferences), voicePreset } satisfies BrandRules;
    if (editing === 'preferences') patch.rules = { noPublishDays, noEmojis, noAutoReplyNegative, forbiddenWords, forbiddenTopics, preferences: normalizePreferences(currentPlan, preferences), voicePreset } satisfies BrandRules;

    try {
      const res  = await fetch('/api/brands', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
      const json = await res.json();
      if (res.ok && json.brand) {
        updateBrand(json.brand);
        toast.success('Guardado');
        router.refresh();
        close();
      } else {
        toast.error(json.error ?? 'Error');
      }
    } catch {
      toast.error('Error de conexión');
    }
    setSaving(false);
  }

  if (!editing) return null;

  const labelStyle: React.CSSProperties = { fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9ca3af', marginBottom: 4, display: 'block' };
  const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 14px', border: '1px solid #e5e7eb', fontFamily: f, fontSize: 14, color: '#111827', outline: 'none', boxSizing: 'border-box' };
  const niceInputStyle: React.CSSProperties = { width: '100%', padding: '14px 16px', border: '1.5px solid #e5e7eb', background: '#ffffff', fontFamily: f, fontSize: 14, color: '#111827', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s' };

  const sectionTitle: Record<NonNullable<EditSection>, string> = {
    basics:      'Datos del negocio',
    visual:      'Estilo visual',
    estetica:    'Estética',
    tone:        'Tono',
    colors:      'Colores',
    hashtags:    'Hashtags y slogans',
    voice:       'Voz de marca',
    publish:     'Modo de publicación',
    rules:       'Reglas de contenido',
    preferences: 'Preferencias de publicación',
  };

  const suggested = suggestedHashtagsFor(brand?.sector ?? null);
  const current   = hashtags.split(/[\s,]+/).map(h => h.replace(/^#/, '').trim()).filter(Boolean);
  const setCurrent = (tags: string[]) => setHashtags(tags.map(t => `#${t}`).join(' '));
  const filteredSuggestions = suggested.filter(s => !current.includes(s));

  return (
    <>
      {/* Backdrop */}
      <div onClick={close} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 50 }} />

      {/* Side panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: '50%', maxWidth: 560,
        background: '#f5f5f5', zIndex: 51, overflowY: 'auto',
        boxShadow: '-8px 0 40px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 28px', borderBottom: '1px solid #e5e7eb', background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <h2 style={{ fontFamily: fc, fontSize: 18, fontWeight: 800, textTransform: 'uppercase', color: '#111827', margin: 0 }}>
            {sectionTitle[editing]}
          </h2>
          <button onClick={close} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, padding: 28, overflowY: 'auto' }}>

          {/* ── Basics ── */}
          {editing === 'basics' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <label style={labelStyle}>Nombre del negocio *</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Heladería La Nube" style={niceInputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = '#0F766E')}
                  onBlur={e  => (e.currentTarget.style.borderColor = '#e5e7eb')} />
              </div>
              <div>
                <label style={labelStyle}>Sector</label>
                <select value={sector} onChange={e => setSector(e.target.value as SocialSector)} style={{ ...niceInputStyle, padding: '14px 44px 14px 16px', cursor: 'pointer', appearance: 'none' as React.CSSProperties['appearance'] }}>
                  {SECTOR_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              {sector === 'otro' && (
                <div>
                  <label style={labelStyle}>¿Qué tipo de negocio? *</label>
                  <input value={otherSector} onChange={e => setOtherSector(e.target.value)} placeholder="Ej: Floristería, Estudio de yoga..." style={niceInputStyle}
                    onFocus={e => (e.currentTarget.style.borderColor = '#0F766E')}
                    onBlur={e  => (e.currentTarget.style.borderColor = '#e5e7eb')} />
                </div>
              )}
              <div>
                <label style={labelStyle}>País</label>
                <input value={country} onChange={e => setCountry(e.target.value)} placeholder="Ej: España" style={niceInputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = '#0F766E')}
                  onBlur={e  => (e.currentTarget.style.borderColor = '#e5e7eb')} />
              </div>
              <div>
                <label style={labelStyle}>Comunidad autónoma</label>
                <input value={region} onChange={e => setRegion(e.target.value)} placeholder="Ej: Cataluña, Madrid, Valencia..." style={niceInputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = '#0F766E')}
                  onBlur={e  => (e.currentTarget.style.borderColor = '#e5e7eb')} />
              </div>
            </div>
          )}

          {/* ── Visual ── */}
          {editing === 'visual' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {STYLE_DATA.map(s => (
                <button key={s.value} onClick={() => setVisualStyle(s.value)} style={{
                  padding: '24px 16px', border: `2px solid ${visualStyle === s.value ? '#111827' : '#e5e7eb'}`,
                  cursor: 'pointer', background: visualStyle === s.value ? '#111827' : '#ffffff', textAlign: 'left',
                }}>
                  <p style={{ fontFamily: fc, fontSize: 14, fontWeight: 700, textTransform: 'uppercase', color: visualStyle === s.value ? '#ffffff' : '#111827', margin: 0 }}>{s.title}</p>
                </button>
              ))}
            </div>
          )}

          {/* ── Estética ── */}
          {editing === 'estetica' && (() => {
            const currentPreset = AESTHETIC_PRESETS.find(p => p.id === aestheticPreset) ?? AESTHETIC_PRESETS[2]!;
            const displayFont = FONT_CATALOG.find(f => f.id === typographyDisplay);
            const bodyFont    = FONT_CATALOG.find(f => f.id === typographyBody);
            const overlayOpt  = OVERLAY_OPTIONS.find(o => o.value === overlayIntensity) ?? OVERLAY_OPTIONS[2]!;
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 32, position: 'relative' }}>
                {aestheticSavedAt !== null && (
                  <span style={{ position: 'absolute', top: -8, right: 0, fontFamily: f, fontSize: 11, fontWeight: 600, color: '#0F766E' }}>
                    Guardado ✓
                  </span>
                )}

                {/* Bloque 1 — Preset */}
                <div>
                  <label style={labelStyle}>Elige el look de tu marca</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10, marginTop: 8 }}>
                    {AESTHETIC_PRESETS.map(preset => {
                      const active = preset.id === aestheticPreset;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => {
                            setAestheticPreset(preset.id);
                            void patchAesthetic({ aesthetic_preset: preset.id });
                          }}
                          style={{
                            position: 'relative',
                            padding: 0,
                            border: `2px solid ${active ? '#0F766E' : '#e5e7eb'}`,
                            background: '#ffffff',
                            cursor: 'pointer',
                            textAlign: 'left',
                            overflow: 'hidden',
                            display: 'flex',
                            flexDirection: 'column',
                          }}
                        >
                          <div
                            style={{
                              width: '100%',
                              height: 90,
                              backgroundImage: `url(${preset.cover_image})`,
                              backgroundSize: 'cover',
                              backgroundPosition: 'center',
                            }}
                          />
                          {active && (
                            <span style={{ position: 'absolute', top: 6, right: 6, width: 22, height: 22, background: '#0F766E', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700 }}>
                              ✓
                            </span>
                          )}
                          <div style={{ padding: '10px 12px' }}>
                            <p style={{ fontFamily: fc, fontSize: 13, fontWeight: 800, textTransform: 'uppercase', color: '#111827', margin: 0 }}>
                              {preset.name}
                            </p>
                            <p style={{ fontFamily: f, fontSize: 10, color: '#6b7280', marginTop: 4 }}>
                              {preset.tagline}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Bloque 2 — Realismo */}
                <div>
                  <label style={labelStyle}>
                    Afinar {currentPreset.name} · <strong style={{ color: '#111827', fontSize: 12 }}>{realismLevel}%</strong>
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={realismLevel}
                    onChange={e => setRealismLevel(Number(e.target.value))}
                    onMouseUp={() => void patchAesthetic({ realism_level: realismLevel })}
                    onTouchEnd={() => void patchAesthetic({ realism_level: realismLevel })}
                    onKeyUp={() => void patchAesthetic({ realism_level: realismLevel })}
                    style={{ width: '100%', accentColor: '#0F766E', marginTop: 6 }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: f, fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                    <span>Artístico</span><span>Fotorrealista</span>
                  </div>
                </div>

                {/* Bloque 3 — Tipografías */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  <div>
                    <label style={labelStyle}>Tipografía de titulares</label>
                    <select
                      value={typographyDisplay}
                      onChange={e => {
                        setTypographyDisplay(e.target.value);
                        void patchAesthetic({ typography_display: e.target.value });
                      }}
                      style={{ ...niceInputStyle, padding: '12px 16px', cursor: 'pointer', appearance: 'none' as React.CSSProperties['appearance'] }}
                    >
                      {FONT_CATALOG.filter(font => font.role === 'display').map(font => (
                        <option key={font.id} value={font.id}>{font.google_family} — {font.description}</option>
                      ))}
                    </select>
                    {displayFont && (
                      <div style={{ marginTop: 10, padding: '14px 18px', background: '#ffffff', border: '1px solid #e5e7eb' }}>
                        <div style={{ fontFamily: `'${displayFont.google_family}', sans-serif`, fontWeight: displayFont.weight, fontSize: 70, color: '#111827', lineHeight: 1 }}>Aa</div>
                        <div style={{ fontFamily: `'${displayFont.google_family}', sans-serif`, fontWeight: displayFont.weight, fontSize: 18, color: '#374151', marginTop: 6 }}>Tu marca, tu voz.</div>
                      </div>
                    )}
                    {typographyDisplay === 'archivo_black' && (
                      <p style={{ fontFamily: f, fontSize: 11, color: '#6b7280', marginTop: 6, fontStyle: 'italic' }}>
                        Archivo Black es una fuente con un único peso (siempre gruesa).
                      </p>
                    )}
                  </div>
                  <div>
                    <label style={labelStyle}>Tipografía de cuerpo</label>
                    <select
                      value={typographyBody}
                      onChange={e => {
                        setTypographyBody(e.target.value);
                        void patchAesthetic({ typography_body: e.target.value });
                      }}
                      style={{ ...niceInputStyle, padding: '12px 16px', cursor: 'pointer', appearance: 'none' as React.CSSProperties['appearance'] }}
                    >
                      {FONT_CATALOG.filter(font => font.role === 'body').map(font => (
                        <option key={font.id} value={font.id}>{font.google_family} — {font.description}</option>
                      ))}
                    </select>
                    {bodyFont && (
                      <div style={{ marginTop: 10, padding: '14px 18px', background: '#ffffff', border: '1px solid #e5e7eb' }}>
                        <div style={{ fontFamily: `'${bodyFont.google_family}', sans-serif`, fontWeight: bodyFont.weight, fontSize: 70, color: '#111827', lineHeight: 1 }}>Aa</div>
                        <div style={{ fontFamily: `'${bodyFont.google_family}', sans-serif`, fontWeight: bodyFont.weight, fontSize: 18, color: '#374151', marginTop: 6 }}>Tu marca, tu voz.</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bloque 4 — Intensidad de overlay */}
                <div>
                  <label style={labelStyle}>Intensidad de overlays en fotos</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginTop: 6 }}>
                    {OVERLAY_OPTIONS.map(opt => {
                      const active = opt.value === overlayIntensity;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            setOverlayIntensity(opt.value);
                            void patchAesthetic({ overlay_intensity: opt.value });
                          }}
                          style={{ padding: '10px 8px', border: `1.5px solid ${active ? '#0F766E' : '#e5e7eb'}`, background: active ? '#f0fdf4' : '#ffffff', color: active ? '#0F766E' : '#374151', fontFamily: f, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ marginTop: 12, position: 'relative', width: '100%', height: 140, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
                    <div
                      style={{
                        position: 'absolute', inset: 0,
                        backgroundImage: 'url(https://picsum.photos/seed/overlay-preview/400/300)',
                        backgroundSize: 'cover', backgroundPosition: 'center',
                      }}
                    />
                    <div style={{ position: 'absolute', inset: 0, background: `rgba(0,0,0,${overlayOpt.opacity})` }} />
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: fc, fontSize: 18, fontWeight: 800, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      Vista previa
                    </div>
                  </div>
                </div>

                {/* Bloque 5 — Permisividad de grafismos */}
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={allowGraphicElements}
                      onChange={e => {
                        setAllowGraphicElements(e.target.checked);
                        void patchAesthetic({ allow_graphic_elements: e.target.checked });
                      }}
                      style={{ width: 18, height: 18, accentColor: '#0F766E' }}
                    />
                    <span style={{ fontFamily: f, fontWeight: 600, fontSize: 13, color: '#111827' }}>
                      Permitir grafismos decorativos en fechas especiales
                    </span>
                  </label>
                  <p style={{ fontFamily: f, fontSize: 12, color: '#6b7280', marginTop: 6, lineHeight: 1.5 }}>
                    Cuando esté activo, el agente puede añadir elementos gráficos (rosas en Sant Jordi, corazones en San Valentín, confeti en Black Friday) en los colores de tu marca.
                  </p>
                </div>
              </div>
            );
          })()}

          {/* ── Tone ── */}
          {editing === 'tone' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {TONE_DATA.map(t => (
                <button key={t.value} onClick={() => setTone(t.value)} style={{
                  padding: 16, border: `2px solid ${tone === t.value ? '#0F766E' : '#e5e7eb'}`,
                  cursor: 'pointer', background: tone === t.value ? '#f0fdf4' : '#ffffff', textAlign: 'left',
                }}>
                  <p style={{ fontFamily: fc, fontSize: 14, fontWeight: 700, textTransform: 'uppercase', color: '#111827', marginBottom: 4 }}>{t.label}</p>
                  <p style={{ fontFamily: f, fontSize: 11, color: '#9ca3af', marginBottom: 8 }}>{t.desc}</p>
                  <p style={{ fontFamily: f, fontSize: 12, fontStyle: 'italic', color: '#6b7280', lineHeight: 1.5 }}>&ldquo;{t.example}&rdquo;</p>
                </button>
              ))}
            </div>
          )}

          {/* ── Colors ── */}
          {editing === 'colors' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {[
                { label: 'Color principal',   value: primaryColor,   set: setPrimaryColor   },
                { label: 'Color secundario',  value: secondaryColor, set: setSecondaryColor },
              ].map(c => (
                <div key={c.label}>
                  <label style={labelStyle}>{c.label}</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6 }}>
                    <input type="color" value={c.value} onChange={e => c.set(e.target.value)} style={{ width: 48, height: 48, border: '1px solid #e5e7eb', cursor: 'pointer', padding: 2, background: 'none' }} />
                    <span style={{ fontFamily: f, fontSize: 14, color: '#111827' }}>{c.value}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Hashtags ── */}
          {editing === 'hashtags' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {filteredSuggestions.length > 0 && (
                <div>
                  <label style={labelStyle}>Sugerencias para tu sector</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                    {filteredSuggestions.map(tag => (
                      <button key={tag} type="button" onClick={() => setCurrent([...current, tag])} style={{ padding: '6px 12px', border: '1.5px dashed #e5e7eb', background: '#ffffff', color: '#0F766E', fontFamily: f, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
                        + #{tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <label style={labelStyle}>Hashtags seleccionados</label>
                {current.length === 0 ? (
                  <p style={{ fontFamily: f, fontSize: 12, color: '#9ca3af', marginTop: 4 }}>Ninguno aún.</p>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                    {current.map(tag => (
                      <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px 6px 12px', background: '#0F766E', color: '#ffffff', fontFamily: f, fontWeight: 600, fontSize: 12 }}>
                        #{tag}
                        <button type="button" onClick={() => setCurrent(current.filter(x => x !== tag))} style={{ background: 'transparent', border: 'none', color: '#ffffff', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}>×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label style={labelStyle}>Añadir manualmente</label>
                <input placeholder="barriogotico bcn local (separa con espacios)" style={{ ...inputStyle, marginTop: 4 }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const raw   = (e.target as HTMLInputElement).value;
                      const parts = raw.split(/[\s,]+/).map(s => s.replace(/^#/, '').trim()).filter(Boolean);
                      if (parts.length) { setCurrent(Array.from(new Set([...current, ...parts]))); (e.target as HTMLInputElement).value = ''; }
                    }
                  }}
                />
              </div>
              <div>
                <label style={labelStyle}>Slogans (uno por línea, opcional)</label>
                <textarea value={slogans} onChange={e => setSlogans(e.target.value)} rows={4} style={{ ...inputStyle, resize: 'vertical', marginTop: 4, lineHeight: 1.6 }} />
              </div>
            </div>
          )}

          {/* ── Voice ── */}
          {editing === 'voice' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
              <div>
                <label style={labelStyle}>Personalidad de la marca</label>
                <p style={{ fontFamily: f, fontSize: 11, color: '#9ca3af', marginBottom: 8 }}>Hasta 4 adjetivos.</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {PERSONALITY_CHIPS.map(chip => {
                    const active  = voicePreset.personality.includes(chip);
                    const atLimit = voicePreset.personality.length >= 4 && !active;
                    return (
                      <button key={chip} type="button" disabled={atLimit}
                        onClick={() => setVoicePreset(v => ({ ...v, personality: active ? v.personality.filter(x => x !== chip) : [...v.personality, chip] }))}
                        style={{ padding: '7px 14px', border: `1.5px solid ${active ? '#0F766E' : '#e5e7eb'}`, background: active ? '#0F766E' : '#ffffff', color: active ? '#ffffff' : atLimit ? '#d1d5db' : '#374151', fontFamily: f, fontWeight: 600, fontSize: 12, cursor: atLimit ? 'not-allowed' : 'pointer', opacity: atLimit ? 0.5 : 1 }}>
                        {chip}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label style={labelStyle}>Longitud de los textos</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 6 }}>
                  {LENGTH_OPTIONS.map(opt => {
                    const active = voicePreset.length === opt.value;
                    return (
                      <button key={opt.value} type="button" onClick={() => setVoicePreset(v => ({ ...v, length: opt.value }))} style={{ padding: '12px 10px', border: `1.5px solid ${active ? '#0F766E' : '#e5e7eb'}`, background: active ? '#f0fdf4' : '#ffffff', cursor: 'pointer', textAlign: 'left' }}>
                        <div style={{ fontFamily: fc, fontWeight: 700, fontSize: 12, textTransform: 'uppercase', color: active ? '#0F766E' : '#111827' }}>{opt.label}</div>
                        <div style={{ fontFamily: f, fontSize: 10, color: '#6b7280', marginTop: 2 }}>{opt.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label style={labelStyle}>¿Cómo hablas al lector?</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 6 }}>
                  {ADDRESSING_OPTIONS.map(opt => {
                    const active = voicePreset.addressing === opt.value;
                    return (
                      <button key={opt.value} type="button" onClick={() => setVoicePreset(v => ({ ...v, addressing: opt.value }))} style={{ padding: '12px 10px', border: `1.5px solid ${active ? '#0F766E' : '#e5e7eb'}`, background: active ? '#f0fdf4' : '#ffffff', cursor: 'pointer', textAlign: 'left' }}>
                        <div style={{ fontFamily: fc, fontWeight: 700, fontSize: 12, textTransform: 'uppercase', color: active ? '#0F766E' : '#111827' }}>{opt.label}</div>
                        <div style={{ fontFamily: f, fontSize: 10, color: '#6b7280', marginTop: 2, fontStyle: 'italic' }}>{opt.example}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label style={labelStyle}>Storytelling</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 6 }}>
                  {STORYTELLING_OPTIONS.map(opt => {
                    const active = voicePreset.storytelling === opt.value;
                    return (
                      <button key={opt.value} type="button" onClick={() => setVoicePreset(v => ({ ...v, storytelling: opt.value }))} style={{ padding: '12px 10px', border: `1.5px solid ${active ? '#0F766E' : '#e5e7eb'}`, background: active ? '#f0fdf4' : '#ffffff', cursor: 'pointer', textAlign: 'left' }}>
                        <div style={{ fontFamily: fc, fontWeight: 700, fontSize: 12, textTransform: 'uppercase', color: active ? '#0F766E' : '#111827' }}>{opt.label}</div>
                        <div style={{ fontFamily: f, fontSize: 10, color: '#6b7280', marginTop: 2 }}>{opt.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label style={labelStyle}>Notas adicionales <span style={{ color: '#9ca3af', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(opcional)</span></label>
                <textarea value={voicePreset.extraNotes} onChange={e => setVoicePreset(v => ({ ...v, extraNotes: e.target.value }))} rows={3} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6, marginTop: 4 }} />
              </div>
            </div>
          )}

          {/* ── Publish ── */}
          {editing === 'publish' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {PUBLISH_MODE_OPTIONS.map(m => (
                <button key={m.value} onClick={() => setPublishMode(m.value)} style={{
                  padding: 16, border: `2px solid ${publishMode === m.value ? '#0F766E' : '#e5e7eb'}`,
                  cursor: 'pointer', background: publishMode === m.value ? '#f0fdf4' : '#ffffff', textAlign: 'left',
                  display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  <span style={{ fontSize: 20 }}>{m.emoji}</span>
                  <div>
                    <p style={{ fontFamily: fc, fontSize: 14, fontWeight: 700, textTransform: 'uppercase', color: '#111827' }}>{m.label}</p>
                    <p style={{ fontFamily: f, fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{m.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* ── Rules ── */}
          {editing === 'rules' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div>
                <label style={labelStyle}>Días sin publicar</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                  {DAY_LABELS.map((d, i) => (
                    <button key={i} type="button" onClick={() => toggleDay(i)} style={{ padding: '8px 14px', border: `1.5px solid ${noPublishDays.includes(i) ? '#0F766E' : '#e5e7eb'}`, background: noPublishDays.includes(i) ? '#f0fdf4' : '#ffffff', color: noPublishDays.includes(i) ? '#0F766E' : '#374151', fontFamily: f, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={labelStyle}>Palabras prohibidas</label>
                <div className="tags-input-area" style={{ marginTop: 6 }}>
                  {forbiddenWords.map(w => (
                    <span key={w} className="tag-chip" style={{ background: '#ffeded' }}>
                      {w}<button type="button" onClick={() => removeTag(forbiddenWords, setForbiddenWords, w)}>×</button>
                    </span>
                  ))}
                  <input value={fwInput} onChange={e => setFwInput(e.target.value)} onKeyDown={e => handleTagKeyDown(e, forbiddenWords, setForbiddenWords, fwInput, setFwInput)} onBlur={() => { if (fwInput.trim()) { addTag(forbiddenWords, setForbiddenWords, fwInput); setFwInput(''); } }} placeholder="barato, descuento..." />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Temas prohibidos</label>
                <div className="tags-input-area" style={{ marginTop: 6 }}>
                  {forbiddenTopics.map(topic => (
                    <span key={topic} className="tag-chip" style={{ background: '#fff3cd' }}>
                      {topic}<button type="button" onClick={() => removeTag(forbiddenTopics, setForbiddenTopics, topic)}>×</button>
                    </span>
                  ))}
                  <input value={ftInput} onChange={e => setFtInput(e.target.value)} onKeyDown={e => handleTagKeyDown(e, forbiddenTopics, setForbiddenTopics, ftInput, setFtInput)} onBlur={() => { if (ftInput.trim()) { addTag(forbiddenTopics, setForbiddenTopics, ftInput); setFtInput(''); } }} placeholder="política, religión..." />
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { checked: noEmojis, set: setNoEmojis, label: 'Sin emojis', desc: 'Los posts no incluirán emojis' },
                  { checked: noAutoReplyNegative, set: setNoAutoReplyNegative, label: 'Sin auto-respuestas negativas', desc: 'No responder automáticamente a comentarios negativos' },
                ].map(({ checked, set, label, desc }) => (
                  <label key={label} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                    <input type="checkbox" checked={checked} onChange={e => set(e.target.checked)} style={{ width: 18, height: 18, accentColor: '#0F766E' }} />
                    <div>
                      <span style={{ fontFamily: f, fontWeight: 600, fontSize: 13 }}>{label}</span>
                      <span style={{ fontFamily: f, fontSize: 12, color: '#9ca3af', marginLeft: 8 }}>{desc}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* ── Preferences ── */}
          {editing === 'preferences' && (() => {
            const limits      = PLAN_LIMITS[currentPlan];
            const videosPlan  = minimumPlanFor('videos');
            const videosLocked = limits.videosPerWeek === 0;
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div style={{ padding: '12px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                  <p style={{ fontFamily: fc, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#0F766E', marginBottom: 4 }}>
                    Plan actual · {PLAN_META[currentPlan].label} · {PLAN_META[currentPlan].price}€/mes
                  </p>
                  <p style={{ fontFamily: f, fontSize: 12, color: '#065f46' }}>
                    {limits.postsPerWeek} posts/sem{limits.videosPerWeek > 0 && ` · ${limits.videosPerWeek} vídeos/sem`}{' · '}carruseles hasta {limits.carouselMaxPhotos} fotos
                  </p>
                </div>
                <div>
                  <label style={labelStyle}>Días preferidos para publicar</label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                    {DAY_LABELS.map((d, i) => {
                      const active = preferences.preferredDays.includes(i);
                      return (
                        <button key={i} type="button" onClick={() => setPreferences(p => ({ ...p, preferredDays: active ? p.preferredDays.filter(x => x !== i) : [...p.preferredDays, i].sort((a, b) => a - b) }))} style={{ padding: '8px 14px', border: `1.5px solid ${active ? '#0F766E' : '#e5e7eb'}`, background: active ? '#f0fdf4' : '#ffffff', color: active ? '#0F766E' : '#374151', fontFamily: f, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
                          {d}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Posts por semana: <strong style={{ color: '#111827', fontSize: 14 }}>{preferences.postsPerWeek}</strong></label>
                  <input type="range" min={0} max={limits.postsPerWeek} step={1} value={preferences.postsPerWeek} onChange={e => setPreferences(p => ({ ...p, postsPerWeek: Number(e.target.value) }))} style={{ width: '100%', accentColor: '#0F766E', marginTop: 6 }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: f, fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                    <span>0</span><span>Máx {PLAN_META[currentPlan].label}: {limits.postsPerWeek}</span>
                  </div>
                </div>
                <div>
                  <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>Vídeos por semana</span>
                    {videosLocked && <span style={{ fontFamily: f, fontSize: 10, color: '#e65100', textTransform: 'none', letterSpacing: 0 }}>🔒 {upgradeLabel(videosPlan)}</span>}
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: videosLocked ? 'not-allowed' : 'pointer', marginTop: 6, opacity: videosLocked ? 0.5 : 1 }}>
                    <input type="checkbox" disabled={videosLocked} checked={preferences.includeVideos} onChange={e => setPreferences(p => ({ ...p, includeVideos: e.target.checked }))} style={{ width: 18, height: 18, accentColor: '#0F766E' }} />
                    <span style={{ fontFamily: f, fontSize: 13, color: '#374151' }}>Incluir vídeos en la rotación</span>
                  </label>
                </div>
                <div>
                  <label style={labelStyle}>Carruseles</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginTop: 6 }}>
                    <input type="checkbox" checked={preferences.likesCarousels} onChange={e => setPreferences(p => ({ ...p, likesCarousels: e.target.checked }))} style={{ width: 18, height: 18, accentColor: '#0F766E' }} />
                    <span style={{ fontFamily: f, fontSize: 13, color: '#374151' }}>Me gustan los carruseles</span>
                  </label>
                  {preferences.likesCarousels && (
                    <>
                      <p style={{ fontFamily: f, fontSize: 12, color: '#6b7280', marginTop: 10 }}>Fotos por carrusel: <strong style={{ color: '#111827' }}>{preferences.carouselSize}</strong></p>
                      <input type="range" min={2} max={limits.carouselMaxPhotos} step={1} value={Math.max(2, preferences.carouselSize)} onChange={e => setPreferences(p => ({ ...p, carouselSize: Number(e.target.value) }))} style={{ width: '100%', accentColor: '#0F766E', marginTop: 4 }} />
                    </>
                  )}
                </div>
              </div>
            );
          })()}

        </div>

        {/* Footer */}
        <div style={{ padding: '16px 28px', borderTop: '1px solid #e5e7eb', background: '#ffffff', display: 'flex', gap: 8, flexShrink: 0 }}>
          <button onClick={close} style={{ flex: 1, padding: 10, border: '1px solid #e5e7eb', background: '#ffffff', fontFamily: f, fontSize: 13, fontWeight: 600, color: '#6b7280', cursor: 'pointer' }}>
            Cancelar
          </button>
          <button onClick={save} disabled={saving} style={{ flex: 2, padding: 10, background: '#111827', color: '#ffffff', border: 'none', fontFamily: fc, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer', opacity: saving ? 0.5 : 1 }}>
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
        <p style={{ fontFamily: f, fontSize: 10, color: '#e65100', textAlign: 'center', padding: '0 28px 16px' }}>
          Los cambios afectarán a tu contenido futuro
        </p>
      </div>
    </>
  );
}
