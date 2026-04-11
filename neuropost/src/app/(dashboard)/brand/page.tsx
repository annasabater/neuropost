'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Pencil, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppStore } from '@/store/useAppStore';
import type { BrandTone, VisualStyle, PublishMode, SocialSector, BrandRules, BrandPreferences, BrandVoicePreset, SubscriptionPlan } from '@/types';
import { PLAN_LIMITS, PLAN_META } from '@/types';
import { PUBLISH_MODE_OPTIONS, SECTOR_OPTIONS } from '@/lib/brand-options';
import { defaultPreferencesFor, normalizePreferences, minimumPlanFor, upgradeLabel } from '@/lib/plan-features';
import { useTagInput } from '@/hooks/useTagInput';

const f = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";
const UNS = (id: string, w = 300) => `https://images.unsplash.com/photo-${id}?w=${w}&q=80&auto=format&fit=crop`;

const STYLE_DATA: { value: VisualStyle; title: string; img: string }[] = [
  { value: 'creative', title: 'Creativo', img: UNS('1513104890138-7c749659a591') },
  { value: 'elegant', title: 'Elegante', img: UNS('1507003211169-0a1dd7228f2d') },
  { value: 'warm', title: 'Cálido', img: UNS('1495474472287-4d71bcdd2085') },
  { value: 'dynamic', title: 'Dinámico', img: UNS('1517963879433-6ad2a56fcd15') },
];

const TONE_DATA: { value: BrandTone; label: string; desc: string; example: string }[] = [
  { value: 'cercano', label: 'Cercano', desc: 'Amigable y accesible', example: '¡Buenos días! ☀️ Empezamos el día con energía.' },
  { value: 'profesional', label: 'Profesional', desc: 'Formal y de confianza', example: 'Nos complace presentar nuestra nueva propuesta.' },
  { value: 'divertido', label: 'Divertido', desc: 'Energético y dinámico', example: '¿Quién dijo que los lunes son aburridos? 🎉' },
  { value: 'premium', label: 'Premium', desc: 'Exclusivo y sofisticado', example: 'Donde la artesanía encuentra la elegancia.' },
];

type EditSection = 'basics' | 'visual' | 'tone' | 'colors' | 'hashtags' | 'voice' | 'publish' | 'rules' | 'preferences' | null;

const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

// ─── Voice preset options ────────────────────────────────────────────────────
// Each chip is self-explanatory so the user doesn't have to type anything.
const PERSONALITY_CHIPS = [
  'Cercano',
  'Premium',
  'Disruptivo',
  'Enérgico',
  'Elegante',
  'Minimalista',
  'Divertido',
  'Cálido',
  'Profesional',
  'Inspirador',
  'Educativo',
  'Creativo',
];

const LENGTH_OPTIONS: { value: BrandVoicePreset['length']; label: string; desc: string }[] = [
  { value: 'short',  label: 'Corto',  desc: 'Frases directas, 1-2 líneas' },
  { value: 'medium', label: 'Medio',  desc: 'Un párrafo, 3-5 líneas' },
  { value: 'long',   label: 'Largo',  desc: 'Historia completa, 6+ líneas' },
];

const ADDRESSING_OPTIONS: { value: BrandVoicePreset['addressing']; label: string; example: string }[] = [
  { value: 'tu',    label: 'Tuteo',     example: '"Te va a encantar"' },
  { value: 'usted', label: 'Ustedeo',   example: '"Le invitamos a…"' },
  { value: 'mixed', label: 'Mezclado',  example: 'Según contexto' },
];

const STORYTELLING_OPTIONS: { value: BrandVoicePreset['storytelling']; label: string; desc: string }[] = [
  { value: 'low',    label: 'Factual',    desc: 'Datos, productos, CTAs' },
  { value: 'medium', label: 'Equilibrado',desc: 'Mezcla historia y datos' },
  { value: 'high',   label: 'Narrativo',  desc: 'Cuentos, emoción, personas' },
];

const DEFAULT_VOICE_PRESET: BrandVoicePreset = {
  personality:  [],
  length:       'medium',
  addressing:   'tu',
  storytelling: 'medium',
  extraNotes:   '',
};

// ─── Hashtag suggestions per sector ──────────────────────────────────────────
// Used to pre-seed the hashtags editor so the user never starts from zero.
const SECTOR_HASHTAG_SUGGESTIONS: Partial<Record<SocialSector, string[]>> = {
  restaurante:  ['gastronomia', 'foodie', 'restaurante', 'cocinalocal', 'km0', 'chef', 'menu', 'productofresco'],
  heladeria:    ['helados', 'heladeria', 'artesanal', 'gelato', 'verano', 'postres', 'sinlactosa', 'helado'],
  cafeteria:    ['cafeteria', 'specialtycoffee', 'brunch', 'desayuno', 'cafelover', 'coffeeshop', 'latte', 'bollydorm'],
  cocteleria:   ['cocktails', 'bar', 'mixology', 'bartender', 'coctel', 'happyhour', 'ginlover', 'afterwork'],
  street_food:  ['streetfood', 'burger', 'comidaurbana', 'tacos', 'foodporn', 'smashburger', 'streeteats'],
  vinoteca:     ['vino', 'vinos', 'winelover', 'vinoteca', 'cata', 'maridaje', 'naturalwine'],
  panaderia:    ['panaderia', 'pandemasamadre', 'bollería', 'artesanal', 'bakery', 'croissant', 'bread'],
  barberia:     ['barberia', 'barbershop', 'grooming', 'barber', 'fadehaircut', 'beard', 'menstyle'],
  nail_art:     ['nails', 'nailart', 'manicura', 'uñas', 'nailsaddict', 'nailstagram', 'gelnails'],
  estetica:     ['spa', 'bienestar', 'belleza', 'estetica', 'skincare', 'facial', 'wellness', 'selfcare'],
  maquillaje:   ['maquillaje', 'makeup', 'mua', 'belleza', 'makeupartist', 'beauty', 'glam'],
  boutique:     ['boutique', 'moda', 'ootd', 'fashion', 'style', 'newcollection', 'shopping'],
  moda_hombre:  ['mensfashion', 'menstyle', 'menswear', 'dapper', 'streetwear', 'modahombre'],
  zapateria:    ['shoes', 'sneakers', 'zapatos', 'footwear', 'shoeslover', 'sneakerhead'],
  skincare:     ['skincare', 'skincareroutine', 'naturalbeauty', 'glowingskin', 'skincarejunkie', 'beauty'],
  gym:          ['gym', 'fitness', 'workout', 'entrenamiento', 'motivation', 'crossfit', 'strong', 'fitfam'],
  yoga:         ['yoga', 'yogalife', 'meditation', 'mindfulness', 'wellness', 'namaste', 'yogaeveryday'],
  dental:       ['dental', 'sonrisa', 'clinicadental', 'dentist', 'ortodoncia', 'saludbucal', 'dentalcare'],
  clinica:      ['salud', 'clinica', 'medicina', 'bienestar', 'healthcare', 'doctores'],
  nutricion:    ['nutricion', 'comersano', 'healthyfood', 'nutricionista', 'alimentacion', 'dieta', 'saludable'],
  decoracion:   ['decoracion', 'interiordesign', 'homedecor', 'interiorismo', 'home', 'decoinspiration'],
  jardineria:   ['jardineria', 'garden', 'plants', 'jardin', 'gardening', 'plantslover', 'urbangarden'],
  reformas:     ['reformas', 'renovation', 'interiordesign', 'reformaintegral', 'beforeandafter'],
  inmobiliaria: ['inmobiliaria', 'realestate', 'vivienda', 'piso', 'compraventa', 'casapropia'],
  fotografia:   ['fotografia', 'photography', 'photooftheday', 'fotografo', 'portrait', 'streetphotography'],
  floristeria:  ['floristeria', 'flores', 'flowers', 'flowershop', 'ramos', 'floristry', 'bouquet'],
  otro:         ['emprendimiento', 'negociolocal', 'españa', 'pyme', 'emprendedor'],
};
function suggestedHashtagsFor(sector: SocialSector | null | undefined): string[] {
  return SECTOR_HASHTAG_SUGGESTIONS[sector ?? 'otro'] ?? SECTOR_HASHTAG_SUGGESTIONS.otro ?? [];
}

/** Compose the human-readable `brand_voice_doc` from a preset + base fields. */
function composeVoiceDoc(
  preset: BrandVoicePreset,
  ctx: { name: string; sector: string | null; tone: string | null },
): string {
  const lines: string[] = [];
  lines.push(`Negocio: ${ctx.name || 'Sin nombre'}.`);
  if (ctx.sector) lines.push(`Sector: ${ctx.sector}.`);
  if (ctx.tone)   lines.push(`Tono principal: ${ctx.tone}.`);
  if (preset.personality.length) {
    lines.push(`Personalidad: ${preset.personality.join(', ').toLowerCase()}.`);
  }
  const lengthLbl = LENGTH_OPTIONS.find(l => l.value === preset.length)?.desc ?? preset.length;
  lines.push(`Longitud preferida: ${lengthLbl}.`);
  const addrLbl = preset.addressing === 'tu' ? 'tuteo (tú)' : preset.addressing === 'usted' ? 'ustedeo (usted)' : 'mezclado según contexto';
  lines.push(`Cómo hablar al lector: ${addrLbl}.`);
  const storyLbl = STORYTELLING_OPTIONS.find(s => s.value === preset.storytelling)?.desc ?? preset.storytelling;
  lines.push(`Storytelling: ${storyLbl}.`);
  if (preset.extraNotes.trim()) lines.push(`Notas: ${preset.extraNotes.trim()}`);
  return lines.join(' ');
}

export default function BrandPage() {
  const brand = useAppStore((s) => s.brand);
  const brandLoading = useAppStore((s) => s.brandLoading);
  const setBrand = useAppStore((s) => s.setBrand);
  const updateBrand = useAppStore((s) => s.updateBrand);
  const [editing, setEditing] = useState<EditSection>(null);
  const [saving, setSaving] = useState(false);

  // Fallback: if the global store doesn't have the brand (cold reload,
  // navigation from outside the dashboard), refetch it from the API so the
  // page renders the real data instead of the empty-state CTA.
  useEffect(() => {
    if (brand || brandLoading) return;
    fetch('/api/brands')
      .then((r) => r.ok ? r.json() : null)
      .then((data: { brand?: Parameters<typeof setBrand>[0] } | null) => {
        if (data?.brand) setBrand(data.brand);
      })
      .catch(() => {});
  }, [brand, brandLoading, setBrand]);

  // Edit state
  // Basics (moved from /settings)
  const [name, setName] = useState(brand?.name ?? '');
  const [sector, setSector] = useState<SocialSector>(brand?.sector ?? 'otro');
  const [location, setLocation] = useState(brand?.location ?? '');
  // Identity
  const [visualStyle, setVisualStyle] = useState<VisualStyle>(brand?.visual_style ?? 'warm');
  const [tone, setTone] = useState<BrandTone>(brand?.tone ?? 'cercano');
  const [primaryColor, setPrimaryColor] = useState(brand?.colors?.primary ?? '#0F766E');
  const [secondaryColor, setSecondaryColor] = useState(brand?.colors?.secondary ?? '#374151');
  const [hashtags, setHashtags] = useState(brand?.hashtags?.join(' ') ?? '');
  const [slogans, setSlogans] = useState(brand?.slogans?.join('\n') ?? '');
  const [voiceDoc, setVoiceDoc] = useState(brand?.brand_voice_doc ?? '');
  const [publishMode, setPublishMode] = useState<PublishMode>(brand?.publish_mode ?? 'semi');
  // Rules (moved from /settings)
  const [noPublishDays, setNoPublishDays] = useState<number[]>([]);
  const [noEmojis, setNoEmojis] = useState(false);
  const [noAutoReplyNegative, setNoAutoReplyNegative] = useState(false);
  const [forbiddenWords, setForbiddenWords] = useState<string[]>([]);
  const [forbiddenTopics, setForbiddenTopics] = useState<string[]>([]);
  const [fwInput, setFwInput] = useState('');
  const [ftInput, setFtInput] = useState('');
  const { addTag, removeTag, handleTagKeyDown } = useTagInput();
  // Plan-aware publishing preferences
  const currentPlan: SubscriptionPlan = brand?.plan ?? 'starter';
  const planLimits = PLAN_LIMITS[currentPlan];
  const [preferences, setPreferences] = useState<BrandPreferences>(() =>
    defaultPreferencesFor(currentPlan),
  );
  // Structured voice preset (option-based editor).
  const [voicePreset, setVoicePreset] = useState<BrandVoicePreset>(DEFAULT_VOICE_PRESET);

  // Keep local edit state in sync when the brand finishes loading from the
  // API — otherwise the side panel would show the hardcoded defaults instead
  // of the user's saved values.
  useEffect(() => {
    if (!brand) return;
    setName(brand.name ?? '');
    setSector(brand.sector ?? 'otro');
    setLocation(brand.location ?? '');
    setVisualStyle(brand.visual_style ?? 'warm');
    setTone(brand.tone ?? 'cercano');
    setPrimaryColor(brand.colors?.primary ?? '#0F766E');
    setSecondaryColor(brand.colors?.secondary ?? '#374151');
    setHashtags(brand.hashtags?.join(' ') ?? '');
    setSlogans(brand.slogans?.join('\n') ?? '');
    setVoiceDoc(brand.brand_voice_doc ?? '');
    setPublishMode(brand.publish_mode ?? 'semi');
    const rules = brand.rules as BrandRules | null;
    setNoPublishDays(rules?.noPublishDays ?? []);
    setNoEmojis(rules?.noEmojis ?? false);
    setNoAutoReplyNegative(rules?.noAutoReplyNegative ?? false);
    setForbiddenWords(rules?.forbiddenWords ?? []);
    setForbiddenTopics(rules?.forbiddenTopics ?? []);
    setPreferences(normalizePreferences(brand.plan ?? 'starter', rules?.preferences));
    setVoicePreset(rules?.voicePreset ?? DEFAULT_VOICE_PRESET);
  }, [brand]);

  function toggleDay(d: number) {
    setNoPublishDays((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]);
  }

  async function save() {
    setSaving(true);
    const patch: Record<string, unknown> = {};
    if (editing === 'basics') {
      if (!name.trim()) { toast.error('El nombre es obligatorio'); setSaving(false); return; }
      patch.name = name.trim();
      patch.sector = sector;
      patch.location = location || null;
    }
    if (editing === 'visual') patch.visual_style = visualStyle;
    if (editing === 'tone') patch.tone = tone;
    if (editing === 'colors') patch.colors = { primary: primaryColor, secondary: secondaryColor, accent: primaryColor };
    if (editing === 'hashtags') {
      patch.hashtags = hashtags.split(/[\s,]+/).map(h => h.replace(/^#/, '').trim()).filter(Boolean);
      patch.slogans  = slogans.split('\n').map(s => s.trim()).filter(Boolean);
      // The enable/disable toggles live inside rules.preferences, so we have
      // to send the whole rules object to avoid clobbering the other fields.
      patch.rules = {
        noPublishDays, noEmojis, noAutoReplyNegative, forbiddenWords, forbiddenTopics,
        preferences: normalizePreferences(currentPlan, preferences),
        voicePreset,
      } satisfies BrandRules;
    }
    if (editing === 'voice') {
      const doc = composeVoiceDoc(voicePreset, {
        name:   brand?.name ?? name,
        sector: brand?.sector ?? sector ?? null,
        tone:   brand?.tone ?? tone,
      });
      patch.brand_voice_doc = doc;
      // Persist the structured preset inside rules so the editor can reopen
      // pre-selected on subsequent edits.
      patch.rules = {
        noPublishDays, noEmojis, noAutoReplyNegative, forbiddenWords, forbiddenTopics,
        preferences: normalizePreferences(currentPlan, preferences),
        voicePreset,
      } satisfies BrandRules;
    }
    if (editing === 'publish') patch.publish_mode = publishMode;
    if (editing === 'rules') {
      patch.rules = {
        noPublishDays, noEmojis, noAutoReplyNegative, forbiddenWords, forbiddenTopics,
        preferences: normalizePreferences(currentPlan, preferences),
        voicePreset,
      } satisfies BrandRules;
    }
    if (editing === 'preferences') {
      // Preferences live inside the `rules` JSON column, so we must send the
      // full rules object — otherwise PATCH would wipe the other rule fields.
      patch.rules = {
        noPublishDays, noEmojis, noAutoReplyNegative, forbiddenWords, forbiddenTopics,
        preferences: normalizePreferences(currentPlan, preferences),
        voicePreset,
      } satisfies BrandRules;
    }
    try {
      const res = await fetch('/api/brands', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
      const json = await res.json();
      if (res.ok && json.brand) { updateBrand(json.brand); toast.success('Guardado'); setEditing(null); }
      else toast.error(json.error ?? 'Error');
    } catch { toast.error('Error de conexión'); }
    setSaving(false);
  }

  if (brandLoading) return <div className="page-content" style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><span className="loading-spinner" /></div>;

  // No brand yet — show a soft empty state with a link to onboarding instead
  // of a hard gate. The rest of the page still renders so the user can see
  // what they'll configure.
  const emptyState = !brand;

  const labelStyle: React.CSSProperties = { fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9ca3af', marginBottom: 4, display: 'block' };
  const valueStyle: React.CSSProperties = { fontFamily: f, fontSize: 14, color: '#111827', fontWeight: 500 };
  const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 14px', border: '1px solid #e5e7eb', fontFamily: f, fontSize: 14, color: '#111827', outline: 'none', boxSizing: 'border-box' };

  function Row({ label, value, section }: { label: string; value: React.ReactNode; section: EditSection }) {
    return (
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid #f3f4f6' }}>
        <div style={{ flex: 1 }}>
          <span style={labelStyle}>{label}</span>
          <div style={{ marginTop: 4 }}>{value}</div>
        </div>
        <button onClick={() => setEditing(section)} style={{ background: 'none', border: '1px solid #e5e7eb', padding: '4px 12px', cursor: 'pointer', fontFamily: f, fontSize: 11, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, marginTop: 4 }}>
          <Pencil size={10} /> Editar
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="page-content dashboard-unified-page" style={{ maxWidth: 800 }}>
        <div className="dashboard-unified-header" style={{ padding: '48px 0 40px' }}>
          <h1 style={{ fontFamily: fc, fontWeight: 900, fontSize: 'clamp(2.5rem, 5vw, 3.5rem)', textTransform: 'uppercase', letterSpacing: '0.01em', color: '#111827', lineHeight: 0.95, marginBottom: 8 }}>Brand Kit</h1>
          <p style={{ color: '#6b7280', fontSize: 15, fontFamily: f }}>La identidad de tu marca</p>
        </div>

        {emptyState && (
          <div style={{ padding: '16px 20px', border: '1px solid #fde68a', background: '#fffbeb', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <p style={{ fontFamily: fc, fontWeight: 800, fontSize: 13, textTransform: 'uppercase', color: '#92400e', marginBottom: 2 }}>
                Aún no has configurado tu marca
              </p>
              <p style={{ fontFamily: f, fontSize: 13, color: '#78350f' }}>
                Completa el onboarding para que los agentes sepan cómo hablarle a tu audiencia.
              </p>
            </div>
            <Link href="/onboarding" style={{ padding: '10px 18px', background: '#111827', color: '#ffffff', fontFamily: fc, fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', textDecoration: 'none', whiteSpace: 'nowrap' }}>
              Ir al onboarding →
            </Link>
          </div>
        )}

        <div style={{ border: '1px solid #e5e7eb', background: '#ffffff' }}>
          {/* Basics (editable) — name + sector + location */}
          <Row label="Datos del negocio" section="basics" value={
            <div>
              <p style={{ ...valueStyle, fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
                {brand?.name ?? 'Sin nombre'}
              </p>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: f, fontSize: 12, color: '#9ca3af' }}>
                  {SECTOR_OPTIONS.find((s) => s.value === brand?.sector)?.label ?? brand?.sector ?? '—'}
                </span>
                <span style={{ fontFamily: f, fontSize: 12, color: '#9ca3af' }}>{brand?.location ?? '—'}</span>
                <span style={{ fontFamily: f, fontSize: 12, color: '#9ca3af', textTransform: 'capitalize' }}>
                  Plan: {brand?.plan ?? '—'}
                </span>
              </div>
            </div>
          } />

          {/* Visual style */}
          <Row label="Estilo visual" section="visual" value={
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {STYLE_DATA.find(s => s.value === brand?.visual_style) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={STYLE_DATA.find(s => s.value === brand?.visual_style)!.img} alt="" style={{ width: 48, height: 48, objectFit: 'cover' }} />
              )}
              <span style={{ ...valueStyle, textTransform: 'capitalize' }}>{brand?.visual_style ?? '—'}</span>
            </div>
          } />

          {/* Tone */}
          <Row label="Tono de comunicación" section="tone" value={
            <div>
              <p style={valueStyle}>{TONE_DATA.find(t => t.value === brand?.tone)?.label ?? brand?.tone ?? '—'}</p>
              <p style={{ fontFamily: f, fontSize: 12, fontStyle: 'italic', color: '#6b7280', marginTop: 4 }}>&quot;{TONE_DATA.find(t => t.value === brand?.tone)?.example ?? ''}&quot;</p>
            </div>
          } />

          {/* Colors */}
          <Row label="Colores de marca" section="colors" value={(() => {
            const hasCustomColors = !!(brand?.colors?.primary || brand?.colors?.secondary);
            if (!hasCustomColors) {
              return (
                <p style={{ fontFamily: f, fontSize: 13, color: '#9ca3af' }}>
                  Sin paleta personalizada — usaremos la predeterminada
                </p>
              );
            }
            return (
              <div style={{ display: 'flex', gap: 12 }}>
                {[
                  { label: 'Principal',  value: brand?.colors?.primary },
                  { label: 'Secundario', value: brand?.colors?.secondary },
                ].filter(c => c.value).map((c) => (
                  <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 18, height: 18, background: c.value!, border: '1px solid #e5e7eb' }} />
                    <span style={{ fontFamily: f, fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {c.label}
                    </span>
                  </div>
                ))}
              </div>
            );
          })()} />

          {/* Hashtags */}
          <Row label="Hashtags y slogans" section="hashtags" value={
            <div>
              <p style={{ fontFamily: f, fontSize: 12, color: '#374151' }}>{brand?.hashtags?.length ? brand.hashtags.map(h => `#${h}`).join(' ') : '—'}</p>
              {brand?.slogans?.length ? <p style={{ fontFamily: f, fontSize: 11, color: '#9ca3af', marginTop: 4 }}>{brand.slogans.join(' · ')}</p> : null}
            </div>
          } />

          {/* Voice */}
          <Row label="Voz de marca" section="voice" value={(() => {
            const preset = (brand?.rules as BrandRules | null)?.voicePreset;
            if (preset) {
              const parts: string[] = [];
              if (preset.personality.length) parts.push(preset.personality.slice(0, 3).join(', '));
              parts.push(LENGTH_OPTIONS.find(l => l.value === preset.length)?.label.toLowerCase() ?? preset.length);
              parts.push(preset.addressing === 'tu' ? 'tuteo' : preset.addressing === 'usted' ? 'ustedeo' : 'mezclado');
              return (
                <p style={{ fontFamily: f, fontSize: 13, color: '#374151' }}>
                  {parts.join(' · ')}
                </p>
              );
            }
            if (!brand?.brand_voice_doc) {
              return <p style={{ fontFamily: f, fontSize: 13, color: '#9ca3af' }}>Sin configurar</p>;
            }
            return (
              <p style={{ fontFamily: f, fontSize: 13, color: '#374151', lineHeight: 1.5 }}>
                {brand.brand_voice_doc.slice(0, 120)}{brand.brand_voice_doc.length > 120 ? '…' : ''}
              </p>
            );
          })()} />

          {/* Publish mode */}
          <Row label="Modo de publicación" section="publish" value={
            <p style={valueStyle}>{PUBLISH_MODE_OPTIONS.find(m => m.value === brand?.publish_mode)?.label ?? brand?.publish_mode ?? '—'}</p>
          } />

          {/* Rules (moved from /settings) */}
          <Row label="Reglas de contenido" section="rules" value={(() => {
            const rules = brand?.rules as BrandRules | null;
            const parts: string[] = [];
            if (rules?.noPublishDays?.length) parts.push(`No publicar: ${rules.noPublishDays.map(d => DAY_LABELS[d]).join(', ')}`);
            if (rules?.noEmojis) parts.push('Sin emojis');
            if (rules?.noAutoReplyNegative) parts.push('Sin auto-respuestas negativas');
            if (rules?.forbiddenWords?.length) parts.push(`${rules.forbiddenWords.length} palabras prohibidas`);
            if (rules?.forbiddenTopics?.length) parts.push(`${rules.forbiddenTopics.length} temas prohibidos`);
            return (
              <p style={{ fontFamily: f, fontSize: 13, color: parts.length ? '#374151' : '#9ca3af' }}>
                {parts.length ? parts.join(' · ') : 'Sin reglas definidas'}
              </p>
            );
          })()} />

          {/* Plan-aware publishing preferences */}
          <Row label="Preferencias de publicación" section="preferences" value={(() => {
            const prefs = normalizePreferences(currentPlan, (brand?.rules as BrandRules | null)?.preferences);
            const parts: string[] = [];
            parts.push(`${prefs.postsPerWeek} posts/sem`);
            if (prefs.includeVideos && prefs.videosPerWeek > 0) parts.push(`${prefs.videosPerWeek} vídeos/sem`);
            if (prefs.likesCarousels) parts.push(`carruseles de ${prefs.carouselSize}`);
            parts.push(`${String(prefs.preferredHourStart).padStart(2,'0')}:00–${String(prefs.preferredHourEnd).padStart(2,'0')}:00`);
            if (prefs.preferredDays.length) parts.push(`días: ${prefs.preferredDays.map(d => DAY_LABELS[d]).join(', ')}`);
            return (
              <div>
                <p style={{ fontFamily: f, fontSize: 13, color: '#374151' }}>
                  {parts.join(' · ')}
                </p>
                <p style={{ fontFamily: f, fontSize: 11, color: '#9ca3af', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Límite del plan {PLAN_META[currentPlan].label}: {planLimits.postsPerWeek} posts
                  {planLimits.videosPerWeek > 0 ? ` · ${planLimits.videosPerWeek} vídeos` : ''}
                  {' · '}carruseles hasta {planLimits.carouselMaxPhotos}
                </p>
              </div>
            );
          })()} />
        </div>
      </div>

      {/* ── Side panel — onboarding-style editor ── */}
      {editing && (
        <>
          <div onClick={() => setEditing(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 50 }} />
          <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0, width: '50%', maxWidth: 560,
            background: '#f5f5f5', zIndex: 51, overflowY: 'auto',
            boxShadow: '-8px 0 40px rgba(0,0,0,0.1)',
            display: 'flex', flexDirection: 'column',
          }}>
            {/* Panel header */}
            <div style={{ padding: '20px 28px', borderBottom: '1px solid #e5e7eb', background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <h2 style={{ fontFamily: fc, fontSize: 18, fontWeight: 800, textTransform: 'uppercase', color: '#111827' }}>
                {editing === 'basics' ? 'Datos del negocio'
                  : editing === 'visual' ? 'Estilo visual'
                  : editing === 'tone' ? 'Tono'
                  : editing === 'colors' ? 'Colores'
                  : editing === 'hashtags' ? 'Hashtags'
                  : editing === 'voice' ? 'Voz de marca'
                  : editing === 'rules' ? 'Reglas de contenido'
                  : editing === 'preferences' ? 'Preferencias de publicación'
                  : 'Publicación'}
              </h2>
              <button onClick={() => setEditing(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}><X size={20} /></button>
            </div>

            {/* Panel content — onboarding style */}
            <div style={{ flex: 1, padding: '28px', overflowY: 'auto' }}>

              {editing === 'basics' && (() => {
                // Prettier inputs for the basics form — larger padding, focus
                // ring via CSS variables, and a custom chevron on the select.
                const niceInputStyle: React.CSSProperties = {
                  width: '100%',
                  padding: '14px 16px',
                  border: '1.5px solid #e5e7eb',
                  background: '#ffffff',
                  fontFamily: f,
                  fontSize: 14,
                  color: '#111827',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.15s',
                };
                const niceSelectStyle: React.CSSProperties = {
                  ...niceInputStyle,
                  padding: '14px 44px 14px 16px',
                  cursor: 'pointer',
                  appearance: 'none' as React.CSSProperties['appearance'],
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' fill='%236b7280' viewBox='0 0 24 24'%3E%3Cpath d='M7 10l5 5 5-5z'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 16px center',
                  backgroundSize: '14px',
                };
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <div>
                      <label style={labelStyle}>Nombre del negocio *</label>
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Ej: Heladería La Nube"
                        style={niceInputStyle}
                        onFocus={(e) => (e.currentTarget.style.borderColor = '#0F766E')}
                        onBlur={(e) => (e.currentTarget.style.borderColor = '#e5e7eb')}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Sector</label>
                      <select
                        value={sector}
                        onChange={(e) => setSector(e.target.value as SocialSector)}
                        style={niceSelectStyle}
                        onFocus={(e) => (e.currentTarget.style.borderColor = '#0F766E')}
                        onBlur={(e) => (e.currentTarget.style.borderColor = '#e5e7eb')}
                      >
                        {SECTOR_OPTIONS.map((s) => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Ubicación</label>
                      <input
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder="Ej: Cataluña, España"
                        style={niceInputStyle}
                        onFocus={(e) => (e.currentTarget.style.borderColor = '#0F766E')}
                        onBlur={(e) => (e.currentTarget.style.borderColor = '#e5e7eb')}
                      />
                    </div>
                  </div>
                );
              })()}

              {editing === 'visual' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {STYLE_DATA.map(s => (
                    <button key={s.value} onClick={() => setVisualStyle(s.value)} style={{
                      padding: 0, border: `2px solid ${visualStyle === s.value ? '#0F766E' : '#e5e7eb'}`,
                      cursor: 'pointer', overflow: 'hidden', background: '#ffffff', textAlign: 'left',
                    }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={s.img} alt={s.title} style={{ width: '100%', height: 100, objectFit: 'cover', display: 'block' }} />
                      <div style={{ padding: '10px 12px' }}>
                        <p style={{ fontFamily: fc, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', color: visualStyle === s.value ? '#0F766E' : '#111827' }}>{s.title}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {editing === 'tone' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {TONE_DATA.map(t => (
                    <button key={t.value} onClick={() => setTone(t.value)} style={{
                      padding: '16px', border: `2px solid ${tone === t.value ? '#0F766E' : '#e5e7eb'}`,
                      cursor: 'pointer', background: tone === t.value ? '#f0fdf4' : '#ffffff', textAlign: 'left',
                    }}>
                      <p style={{ fontFamily: fc, fontSize: 14, fontWeight: 700, textTransform: 'uppercase', color: '#111827', marginBottom: 4 }}>{t.label}</p>
                      <p style={{ fontFamily: f, fontSize: 11, color: '#9ca3af', marginBottom: 8 }}>{t.desc}</p>
                      <p style={{ fontFamily: f, fontSize: 12, fontStyle: 'italic', color: '#6b7280', lineHeight: 1.5 }}>"{t.example}"</p>
                    </button>
                  ))}
                </div>
              )}

              {editing === 'colors' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {[{ label: 'Color principal', value: primaryColor, set: setPrimaryColor }, { label: 'Color secundario', value: secondaryColor, set: setSecondaryColor }].map(c => (
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

              {editing === 'hashtags' && (() => {
                // Work with a canonical array of tags instead of a string.
                const current = hashtags.split(/[\s,]+/).map(h => h.replace(/^#/, '').trim()).filter(Boolean);
                const setCurrent = (tags: string[]) =>
                  setHashtags(tags.map(t => `#${t}`).join(' '));
                const suggestions = suggestedHashtagsFor(brand?.sector ?? null);
                const suggested = suggestions.filter(s => !current.includes(s));
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

                    {/* Enable/disable toggles */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '14px 16px', background: '#f9fafb', border: '1px solid #e5e7eb' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={preferences.hashtagsEnabled}
                          onChange={(e) => setPreferences((p) => ({ ...p, hashtagsEnabled: e.target.checked }))}
                          style={{ width: 18, height: 18, accentColor: '#0F766E' }}
                        />
                        <div>
                          <div style={{ fontFamily: f, fontSize: 13, fontWeight: 600, color: '#111827' }}>
                            Usar hashtags en los posts
                          </div>
                          <div style={{ fontFamily: f, fontSize: 11, color: '#9ca3af' }}>
                            Si está apagado, los posts se publicarán sin hashtags.
                          </div>
                        </div>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={preferences.slogansEnabled}
                          onChange={(e) => setPreferences((p) => ({ ...p, slogansEnabled: e.target.checked }))}
                          style={{ width: 18, height: 18, accentColor: '#0F766E' }}
                        />
                        <div>
                          <div style={{ fontFamily: f, fontSize: 13, fontWeight: 600, color: '#111827' }}>
                            Usar slogans de marca
                          </div>
                          <div style={{ fontFamily: f, fontSize: 11, color: '#9ca3af' }}>
                            Frases recurrentes que los agentes pueden mencionar.
                          </div>
                        </div>
                      </label>
                    </div>

                    {preferences.hashtagsEnabled && (
                      <>
                        {/* Suggested chips per sector */}
                        {suggested.length > 0 && (
                          <div>
                            <label style={labelStyle}>
                              Sugerencias para tu sector
                              {brand?.sector && <span style={{ color: '#9ca3af', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}> · {brand.sector}</span>}
                            </label>
                            <p style={{ fontFamily: f, fontSize: 11, color: '#9ca3af', marginBottom: 8 }}>
                              Haz clic para añadir. Además, cada post generado incluirá hashtags extra adaptados al contenido.
                            </p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                              {suggested.map((tag) => (
                                <button
                                  key={tag}
                                  type="button"
                                  onClick={() => setCurrent([...current, tag])}
                                  style={{
                                    padding: '6px 12px',
                                    border: '1.5px dashed #e5e7eb',
                                    background: '#ffffff',
                                    color: '#0F766E',
                                    fontFamily: f,
                                    fontWeight: 600,
                                    fontSize: 12,
                                    cursor: 'pointer',
                                  }}
                                >
                                  + #{tag}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Current tags as removable chips */}
                        <div>
                          <label style={labelStyle}>Hashtags seleccionados</label>
                          {current.length === 0 ? (
                            <p style={{ fontFamily: f, fontSize: 12, color: '#9ca3af', marginTop: 4 }}>
                              Ninguno. Añade desde las sugerencias o escribe el tuyo abajo.
                            </p>
                          ) : (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                              {current.map((tag) => (
                                <span
                                  key={tag}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    padding: '6px 10px 6px 12px',
                                    background: '#0F766E',
                                    color: '#ffffff',
                                    fontFamily: f,
                                    fontWeight: 600,
                                    fontSize: 12,
                                  }}
                                >
                                  #{tag}
                                  <button
                                    type="button"
                                    onClick={() => setCurrent(current.filter(x => x !== tag))}
                                    style={{ background: 'transparent', border: 'none', color: '#ffffff', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}
                                    aria-label={`Quitar ${tag}`}
                                  >
                                    ×
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Free-form input */}
                        <div>
                          <label style={labelStyle}>Añadir manualmente</label>
                          <input
                            placeholder="barriogotico bcn local (separa con espacios)"
                            style={{ ...inputStyle, marginTop: 4 }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const raw = (e.target as HTMLInputElement).value;
                                const parts = raw.split(/[\s,]+/).map(s => s.replace(/^#/, '').trim()).filter(Boolean);
                                if (parts.length) {
                                  const merged = Array.from(new Set([...current, ...parts]));
                                  setCurrent(merged);
                                  (e.target as HTMLInputElement).value = '';
                                }
                              }
                            }}
                          />
                          <p style={{ fontFamily: f, fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                            Pulsa Enter para añadir. El agente IA generará hashtags extra para cada post.
                          </p>
                        </div>
                      </>
                    )}

                    {preferences.slogansEnabled && (
                      <div>
                        <label style={labelStyle}>Slogans (uno por línea, opcional)</label>
                        <textarea
                          value={slogans}
                          onChange={e => setSlogans(e.target.value)}
                          rows={4}
                          placeholder={`Ej:
El sabor del verano
Hecho con amor desde 1995`}
                          style={{ ...inputStyle, resize: 'vertical', marginTop: 4, lineHeight: 1.6 }}
                        />
                      </div>
                    )}
                  </div>
                );
              })()}

              {editing === 'voice' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
                  <p style={{ fontFamily: f, fontSize: 12, color: '#9ca3af', lineHeight: 1.6 }}>
                    Selecciona opciones en vez de escribir. Compondremos un documento de voz que leerán los agentes al generar contenido.
                  </p>

                  {/* Personalidad — chips multi-select */}
                  <div>
                    <label style={labelStyle}>Personalidad de la marca</label>
                    <p style={{ fontFamily: f, fontSize: 11, color: '#9ca3af', marginBottom: 8 }}>
                      Selecciona hasta 4 adjetivos que mejor la describan.
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {PERSONALITY_CHIPS.map((chip) => {
                        const active = voicePreset.personality.includes(chip);
                        const atLimit = voicePreset.personality.length >= 4 && !active;
                        return (
                          <button
                            key={chip}
                            type="button"
                            disabled={atLimit}
                            onClick={() => setVoicePreset((v) => ({
                              ...v,
                              personality: active
                                ? v.personality.filter(x => x !== chip)
                                : [...v.personality, chip],
                            }))}
                            style={{
                              padding: '7px 14px',
                              border: `1.5px solid ${active ? '#0F766E' : '#e5e7eb'}`,
                              background: active ? '#0F766E' : '#ffffff',
                              color: active ? '#ffffff' : atLimit ? '#d1d5db' : '#374151',
                              fontFamily: f,
                              fontWeight: 600,
                              fontSize: 12,
                              cursor: atLimit ? 'not-allowed' : 'pointer',
                              opacity: atLimit ? 0.5 : 1,
                            }}
                          >
                            {chip}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Longitud */}
                  <div>
                    <label style={labelStyle}>Longitud de los textos</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 6 }}>
                      {LENGTH_OPTIONS.map((opt) => {
                        const active = voicePreset.length === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setVoicePreset((v) => ({ ...v, length: opt.value }))}
                            style={{
                              padding: '12px 10px',
                              border: `1.5px solid ${active ? '#0F766E' : '#e5e7eb'}`,
                              background: active ? '#f0fdf4' : '#ffffff',
                              cursor: 'pointer',
                              textAlign: 'left',
                            }}
                          >
                            <div style={{ fontFamily: fc, fontWeight: 700, fontSize: 12, textTransform: 'uppercase', color: active ? '#0F766E' : '#111827' }}>
                              {opt.label}
                            </div>
                            <div style={{ fontFamily: f, fontSize: 10, color: '#6b7280', marginTop: 2 }}>
                              {opt.desc}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Addressing — tú/usted */}
                  <div>
                    <label style={labelStyle}>¿Cómo hablas al lector?</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 6 }}>
                      {ADDRESSING_OPTIONS.map((opt) => {
                        const active = voicePreset.addressing === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setVoicePreset((v) => ({ ...v, addressing: opt.value }))}
                            style={{
                              padding: '12px 10px',
                              border: `1.5px solid ${active ? '#0F766E' : '#e5e7eb'}`,
                              background: active ? '#f0fdf4' : '#ffffff',
                              cursor: 'pointer',
                              textAlign: 'left',
                            }}
                          >
                            <div style={{ fontFamily: fc, fontWeight: 700, fontSize: 12, textTransform: 'uppercase', color: active ? '#0F766E' : '#111827' }}>
                              {opt.label}
                            </div>
                            <div style={{ fontFamily: f, fontSize: 10, color: '#6b7280', marginTop: 2, fontStyle: 'italic' }}>
                              {opt.example}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Storytelling */}
                  <div>
                    <label style={labelStyle}>Storytelling</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 6 }}>
                      {STORYTELLING_OPTIONS.map((opt) => {
                        const active = voicePreset.storytelling === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setVoicePreset((v) => ({ ...v, storytelling: opt.value }))}
                            style={{
                              padding: '12px 10px',
                              border: `1.5px solid ${active ? '#0F766E' : '#e5e7eb'}`,
                              background: active ? '#f0fdf4' : '#ffffff',
                              cursor: 'pointer',
                              textAlign: 'left',
                            }}
                          >
                            <div style={{ fontFamily: fc, fontWeight: 700, fontSize: 12, textTransform: 'uppercase', color: active ? '#0F766E' : '#111827' }}>
                              {opt.label}
                            </div>
                            <div style={{ fontFamily: f, fontSize: 10, color: '#6b7280', marginTop: 2 }}>
                              {opt.desc}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Optional extra notes */}
                  <div>
                    <label style={labelStyle}>
                      Notas adicionales{' '}
                      <span style={{ color: '#9ca3af', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
                        (opcional)
                      </span>
                    </label>
                    <textarea
                      value={voicePreset.extraNotes}
                      onChange={(e) => setVoicePreset((v) => ({ ...v, extraNotes: e.target.value }))}
                      rows={3}
                      placeholder="Ej: Evitar superlativos. Usar siempre el nombre del barrio."
                      style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6, marginTop: 4 }}
                    />
                  </div>
                </div>
              )}

              {editing === 'publish' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {PUBLISH_MODE_OPTIONS.map(m => (
                    <button key={m.value} onClick={() => setPublishMode(m.value)} style={{
                      padding: '16px', border: `2px solid ${publishMode === m.value ? '#0F766E' : '#e5e7eb'}`,
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

              {editing === 'preferences' && (() => {
                const limits = PLAN_LIMITS[currentPlan];
                const videosPlan = minimumPlanFor('videos');
                const videosLocked = limits.videosPerWeek === 0;
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

                    {/* Plan badge */}
                    <div style={{ padding: '12px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                      <p style={{ fontFamily: fc, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#0F766E', marginBottom: 4 }}>
                        Plan actual · {PLAN_META[currentPlan].label} · {PLAN_META[currentPlan].price}€/mes
                      </p>
                      <p style={{ fontFamily: f, fontSize: 12, color: '#065f46' }}>
                        {limits.postsPerWeek} posts/sem
                        {limits.videosPerWeek > 0 && ` · ${limits.videosPerWeek} vídeos/sem`}
                        {' · '}carruseles hasta {limits.carouselMaxPhotos} fotos
                      </p>
                    </div>

                    {/* Preferred days */}
                    <div>
                      <label style={labelStyle}>Días preferidos para publicar</label>
                      <p style={{ fontFamily: f, fontSize: 11, color: '#9ca3af', marginBottom: 8 }}>
                        {currentPlan === 'starter'
                          ? 'Indicas tu preferencia y tú decides cuándo publicar. En Starter no proponemos días — sólo publicamos cuando tú lo pidas.'
                          : 'Si no seleccionas ninguno, te propondremos contenido el día que suele tener más engagement para tu sector.'}
                      </p>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {DAY_LABELS.map((d, i) => {
                          const active = preferences.preferredDays.includes(i);
                          return (
                            <button
                              key={i}
                              type="button"
                              onClick={() => setPreferences((p) => ({
                                ...p,
                                preferredDays: active
                                  ? p.preferredDays.filter(x => x !== i)
                                  : [...p.preferredDays, i].sort((a, b) => a - b),
                              }))}
                              style={{
                                padding: '8px 14px',
                                border: `1.5px solid ${active ? '#0F766E' : '#e5e7eb'}`,
                                background: active ? '#f0fdf4' : '#ffffff',
                                color: active ? '#0F766E' : '#374151',
                                fontFamily: f,
                                fontWeight: 600,
                                fontSize: 12,
                                cursor: 'pointer',
                              }}
                            >
                              {d}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Preferred publishing window (hours) */}
                    <div>
                      <label style={labelStyle}>
                        Horario preferido: <strong style={{ color: '#111827', fontSize: 14 }}>
                          {String(preferences.preferredHourStart).padStart(2,'0')}:00 – {String(preferences.preferredHourEnd).padStart(2,'0')}:00
                        </strong>
                      </label>
                      <p style={{ fontFamily: f, fontSize: 11, color: '#9ca3af', marginBottom: 8 }}>
                        Ventana de horas en la que te gusta publicar. Elegiremos la mejor hora dentro de este rango.
                      </p>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <select
                          aria-label="Hora de inicio"
                          value={preferences.preferredHourStart}
                          onChange={(e) => setPreferences((p) => {
                            const v = Number(e.target.value);
                            return { ...p, preferredHourStart: v, preferredHourEnd: Math.max(v, p.preferredHourEnd) };
                          })}
                          style={{ ...inputStyle, width: 90, cursor: 'pointer' }}
                        >
                          {Array.from({ length: 24 }, (_, h) => (
                            <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
                          ))}
                        </select>
                        <span style={{ fontFamily: f, fontSize: 13, color: '#9ca3af' }}>a</span>
                        <select
                          aria-label="Hora de fin"
                          value={preferences.preferredHourEnd}
                          onChange={(e) => setPreferences((p) => {
                            const v = Number(e.target.value);
                            return { ...p, preferredHourEnd: v, preferredHourStart: Math.min(v, p.preferredHourStart) };
                          })}
                          style={{ ...inputStyle, width: 90, cursor: 'pointer' }}
                        >
                          {Array.from({ length: 24 }, (_, h) => (
                            <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Posts per week */}
                    <div>
                      <label style={labelStyle}>
                        Posts por semana: <strong style={{ color: '#111827', fontSize: 14 }}>{preferences.postsPerWeek}</strong>
                      </label>
                      <input
                        type="range"
                        min={0}
                        max={limits.postsPerWeek}
                        step={1}
                        value={preferences.postsPerWeek}
                        onChange={(e) => setPreferences((p) => ({ ...p, postsPerWeek: Number(e.target.value) }))}
                        aria-label="Posts por semana"
                        style={{ width: '100%', accentColor: '#0F766E', marginTop: 6 }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: f, fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                        <span>0</span>
                        <span>Máx plan {PLAN_META[currentPlan].label}: {limits.postsPerWeek}</span>
                      </div>
                    </div>

                    {/* Videos (plan-gated) */}
                    <div>
                      <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span>Vídeos por semana</span>
                        {videosLocked && (
                          <span style={{ fontFamily: f, fontSize: 10, color: '#e65100', textTransform: 'none', letterSpacing: 0 }}>
                            🔒 {upgradeLabel(videosPlan)}
                          </span>
                        )}
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: videosLocked ? 'not-allowed' : 'pointer', marginTop: 6, opacity: videosLocked ? 0.5 : 1 }}>
                        <input
                          type="checkbox"
                          disabled={videosLocked}
                          checked={preferences.includeVideos}
                          onChange={(e) => setPreferences((p) => ({ ...p, includeVideos: e.target.checked }))}
                          style={{ width: 18, height: 18, accentColor: '#0F766E' }}
                        />
                        <span style={{ fontFamily: f, fontSize: 13, color: '#374151' }}>
                          Incluir vídeos en la rotación
                        </span>
                      </label>
                      {preferences.includeVideos && !videosLocked && (
                        <>
                          <p style={{ fontFamily: f, fontSize: 12, color: '#6b7280', marginTop: 10 }}>
                            Vídeos por semana: <strong style={{ color: '#111827' }}>{preferences.videosPerWeek}</strong>
                          </p>
                          <input
                            type="range"
                            min={0}
                            max={limits.videosPerWeek}
                            step={1}
                            value={preferences.videosPerWeek}
                            onChange={(e) => setPreferences((p) => ({ ...p, videosPerWeek: Number(e.target.value) }))}
                            aria-label="Vídeos por semana"
                            style={{ width: '100%', accentColor: '#0F766E', marginTop: 4 }}
                          />
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: f, fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                            <span>0</span>
                            <span>Máx plan: {limits.videosPerWeek}</span>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Carousels */}
                    <div>
                      <label style={labelStyle}>Carruseles</label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginTop: 6 }}>
                        <input
                          type="checkbox"
                          checked={preferences.likesCarousels}
                          onChange={(e) => setPreferences((p) => ({ ...p, likesCarousels: e.target.checked }))}
                          style={{ width: 18, height: 18, accentColor: '#0F766E' }}
                        />
                        <span style={{ fontFamily: f, fontSize: 13, color: '#374151' }}>
                          Me gustan los carruseles
                        </span>
                      </label>
                      {preferences.likesCarousels && (
                        <>
                          <p style={{ fontFamily: f, fontSize: 12, color: '#6b7280', marginTop: 10 }}>
                            Fotos por carrusel: <strong style={{ color: '#111827' }}>{preferences.carouselSize}</strong>
                          </p>
                          <input
                            type="range"
                            min={2}
                            max={limits.carouselMaxPhotos}
                            step={1}
                            value={Math.max(2, preferences.carouselSize)}
                            onChange={(e) => setPreferences((p) => ({ ...p, carouselSize: Number(e.target.value) }))}
                            aria-label="Fotos por carrusel"
                            style={{ width: '100%', accentColor: '#0F766E', marginTop: 4 }}
                          />
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: f, fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                            <span>2</span>
                            <span>Máx plan: {limits.carouselMaxPhotos}</span>
                          </div>
                        </>
                      )}
                    </div>

                  </div>
                );
              })()}

              {editing === 'rules' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  {/* No-publish days */}
                  <div>
                    <label style={labelStyle}>Días sin publicar</label>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                      {DAY_LABELS.map((d, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => toggleDay(i)}
                          style={{
                            padding: '8px 14px',
                            border: `1.5px solid ${noPublishDays.includes(i) ? '#0F766E' : '#e5e7eb'}`,
                            background: noPublishDays.includes(i) ? '#f0fdf4' : '#ffffff',
                            color: noPublishDays.includes(i) ? '#0F766E' : '#374151',
                            fontFamily: f,
                            fontWeight: 600,
                            fontSize: 12,
                            cursor: 'pointer',
                          }}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                    {noPublishDays.length > 0 && (
                      <p style={{ fontFamily: f, fontSize: 11, color: '#9ca3af', marginTop: 6 }}>
                        No publicaremos los {noPublishDays.map(d => DAY_LABELS[d]).join(', ')}
                      </p>
                    )}
                  </div>

                  {/* Forbidden words */}
                  <div>
                    <label style={labelStyle}>Palabras prohibidas</label>
                    <div className="tags-input-area" style={{ marginTop: 6 }}>
                      {forbiddenWords.map((w) => (
                        <span key={w} className="tag-chip" style={{ background: '#ffeded' }}>
                          {w}
                          <button type="button" onClick={() => removeTag(forbiddenWords, setForbiddenWords, w)}>×</button>
                        </span>
                      ))}
                      <input
                        value={fwInput}
                        onChange={(e) => setFwInput(e.target.value)}
                        onKeyDown={(e) => handleTagKeyDown(e, forbiddenWords, setForbiddenWords, fwInput, setFwInput)}
                        onBlur={() => { if (fwInput.trim()) { addTag(forbiddenWords, setForbiddenWords, fwInput); setFwInput(''); } }}
                        placeholder="barato, descuento, ofertón..."
                      />
                    </div>
                  </div>

                  {/* Forbidden topics */}
                  <div>
                    <label style={labelStyle}>Temas prohibidos</label>
                    <div className="tags-input-area" style={{ marginTop: 6 }}>
                      {forbiddenTopics.map((topic) => (
                        <span key={topic} className="tag-chip" style={{ background: '#fff3cd' }}>
                          {topic}
                          <button type="button" onClick={() => removeTag(forbiddenTopics, setForbiddenTopics, topic)}>×</button>
                        </span>
                      ))}
                      <input
                        value={ftInput}
                        onChange={(e) => setFtInput(e.target.value)}
                        onKeyDown={(e) => handleTagKeyDown(e, forbiddenTopics, setForbiddenTopics, ftInput, setFtInput)}
                        onBlur={() => { if (ftInput.trim()) { addTag(forbiddenTopics, setForbiddenTopics, ftInput); setFtInput(''); } }}
                        placeholder="política, religión, competencia..."
                      />
                    </div>
                  </div>

                  {/* Toggles */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={noEmojis}
                        onChange={(e) => setNoEmojis(e.target.checked)}
                        style={{ width: 18, height: 18, accentColor: '#0F766E' }}
                      />
                      <div>
                        <span style={{ fontFamily: f, fontWeight: 600, fontSize: 13 }}>Sin emojis</span>
                        <span style={{ fontFamily: f, fontSize: 12, color: '#9ca3af', marginLeft: 8 }}>
                          Los posts no incluirán emojis
                        </span>
                      </div>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={noAutoReplyNegative}
                        onChange={(e) => setNoAutoReplyNegative(e.target.checked)}
                        style={{ width: 18, height: 18, accentColor: '#0F766E' }}
                      />
                      <div>
                        <span style={{ fontFamily: f, fontWeight: 600, fontSize: 13 }}>Sin auto-respuestas negativas</span>
                        <span style={{ fontFamily: f, fontSize: 12, color: '#9ca3af', marginLeft: 8 }}>
                          No responder automáticamente a comentarios negativos
                        </span>
                      </div>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Panel footer */}
            <div style={{ padding: '16px 28px', borderTop: '1px solid #e5e7eb', background: '#ffffff', display: 'flex', gap: 8, flexShrink: 0 }}>
              <button onClick={() => setEditing(null)} style={{ flex: 1, padding: '10px', border: '1px solid #e5e7eb', background: '#ffffff', fontFamily: f, fontSize: 13, fontWeight: 600, color: '#6b7280', cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={save} disabled={saving} style={{
                flex: 2, padding: '10px', background: '#111827', color: '#ffffff', border: 'none',
                fontFamily: fc, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                cursor: 'pointer', opacity: saving ? 0.5 : 1,
              }}>
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>

            <p style={{ fontFamily: f, fontSize: 10, color: '#e65100', textAlign: 'center', padding: '0 28px 16px' }}>
              Los cambios afectarán a tu contenido futuro
            </p>
          </div>
        </>
      )}
    </>
  );
}
