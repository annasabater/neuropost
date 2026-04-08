'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Pencil, X, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppStore } from '@/store/useAppStore';
import type { BrandTone, VisualStyle } from '@/types';

const f = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

const UNS = (id: string, w = 300) => `https://images.unsplash.com/photo-${id}?w=${w}&q=80&auto=format&fit=crop`;

const TONES: { value: BrandTone; label: string; desc: string; example: string }[] = [
  { value: 'cercano', label: 'Cercano', desc: 'Amigable y accesible', example: '¡Buenos días! ☀️ Empezamos el día con energía.' },
  { value: 'profesional', label: 'Profesional', desc: 'Formal y de confianza', example: 'Nos complace presentar nuestra nueva propuesta.' },
  { value: 'divertido', label: 'Divertido', desc: 'Energético y dinámico', example: '¿Quién dijo que los lunes son aburridos? 🎉' },
  { value: 'premium', label: 'Premium', desc: 'Exclusivo y sofisticado', example: 'Donde la artesanía encuentra la elegancia.' },
];

const STYLE_IMGS: Record<string, string> = {
  creative: UNS('1513104890138-7c749659a591'), elegant: UNS('1507003211169-0a1dd7228f2d'),
  warm: UNS('1495474472287-4d71bcdd2085'), dynamic: UNS('1517963879433-6ad2a56fcd15'),
  editorial: UNS('1506126613408-eca07ce68773'), dark: UNS('1510812431401-41d2bd2722f3'),
  fresh: UNS('1416879595882-3373a0480b5b'), vintage: UNS('1509440159596-0249088772ff'),
};

type Section = 'info' | 'visual' | 'tone' | 'hashtags' | 'voice' | null;

export default function BrandPage() {
  const searchParams = useSearchParams();
  const initialSection = searchParams.get('section') as Section;
  const brand = useAppStore((s) => s.brand);
  const brandLoading = useAppStore((s) => s.brandLoading);
  const updateBrand = useAppStore((s) => s.updateBrand);
  const [editing, setEditing] = useState<Section>(initialSection);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState(brand?.name ?? '');
  const [tone, setTone] = useState<BrandTone>(brand?.tone ?? 'cercano');
  const [visualStyle, setVisualStyle] = useState<VisualStyle>(brand?.visual_style ?? 'warm');
  const [primaryColor, setPrimaryColor] = useState(brand?.colors?.primary ?? '#0F766E');
  const [secondaryColor, setSecondaryColor] = useState(brand?.colors?.secondary ?? '#374151');
  const [hashtags, setHashtags] = useState(brand?.hashtags?.join(' ') ?? '');
  const [slogans, setSlogans] = useState(brand?.slogans?.join('\n') ?? '');
  const [voiceDoc, setVoiceDoc] = useState(brand?.brand_voice_doc ?? '');

  async function saveSection() {
    setSaving(true);
    const patch: Record<string, unknown> = {};
    if (editing === 'info') patch.name = name;
    if (editing === 'visual') { patch.colors = { primary: primaryColor, secondary: secondaryColor, accent: primaryColor }; patch.visual_style = visualStyle; }
    if (editing === 'tone') patch.tone = tone;
    if (editing === 'hashtags') { patch.hashtags = hashtags.split(/[\s,]+/).map(h => h.replace(/^#/, '').trim()).filter(Boolean); patch.slogans = slogans.split('\n').map(s => s.trim()).filter(Boolean); }
    if (editing === 'voice') patch.brand_voice_doc = voiceDoc || null;
    try {
      const res = await fetch('/api/brands', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
      const json = await res.json();
      if (res.ok && json.brand) { updateBrand(json.brand); toast.success('Guardado. Esto afectará a tu contenido futuro.'); setEditing(null); }
      else toast.error(json.error ?? 'Error');
    } catch { toast.error('Error de conexión'); }
    setSaving(false);
  }

  if (brandLoading) return <div className="page-content" style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><span className="loading-spinner" /></div>;
  if (!brand) return <div className="page-content" style={{ textAlign: 'center', padding: '80px 20px' }}><p style={{ fontFamily: fc, fontWeight: 900, fontSize: 20, textTransform: 'uppercase', color: '#111827' }}>Completa el onboarding primero</p></div>;

  function SectionHeader({ title, section }: { title: string; section: Section }) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#9ca3af', margin: 0 }}>{title}</h2>
        {editing === section ? (
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setEditing(null)} style={{ background: 'none', border: '1px solid #e5e7eb', padding: '4px 10px', cursor: 'pointer', fontFamily: f, fontSize: 11, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4 }}><X size={11} /> Cancelar</button>
            <button onClick={saveSection} disabled={saving} style={{ background: '#111827', color: '#fff', border: 'none', padding: '4px 14px', cursor: 'pointer', fontFamily: f, fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, opacity: saving ? 0.5 : 1 }}><Check size={11} /> {saving ? 'Guardando...' : 'Guardar'}</button>
          </div>
        ) : (
          <button onClick={() => setEditing(section)} style={{ background: 'none', border: '1px solid #e5e7eb', padding: '4px 12px', cursor: 'pointer', fontFamily: f, fontSize: 11, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4 }}><Pencil size={11} /> Editar</button>
        )}
      </div>
    );
  }

  const labelStyle: React.CSSProperties = { fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9ca3af', marginBottom: 4, display: 'block' };
  const valueStyle: React.CSSProperties = { fontFamily: f, fontSize: 14, color: '#111827', fontWeight: 500 };
  const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 14px', border: '1px solid #e5e7eb', fontFamily: f, fontSize: 14, color: '#111827', outline: 'none', boxSizing: 'border-box' };

  return (
    <div className="page-content" style={{ maxWidth: 800 }}>
      <div style={{ padding: '48px 0 40px' }}>
        <h1 style={{ fontFamily: fc, fontWeight: 900, fontSize: 'clamp(2.5rem, 5vw, 3.5rem)', textTransform: 'uppercase', letterSpacing: '0.01em', color: '#111827', lineHeight: 0.95, marginBottom: 8 }}>Brand Kit</h1>
        <p style={{ color: '#6b7280', fontSize: 15, fontFamily: f }}>La identidad de tu marca en un solo lugar</p>
      </div>

      {/* ── Info ── */}
      <div style={{ border: '1px solid #e5e7eb', padding: '20px 24px', marginBottom: 1, background: '#ffffff' }}>
        <SectionHeader title="Información del negocio" section="info" />
        {editing === 'info' ? (
          <div><label style={labelStyle}>Nombre</label><input value={name} onChange={e => setName(e.target.value)} style={inputStyle} /></div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div><span style={labelStyle}>Nombre</span><p style={valueStyle}>{brand.name}</p></div>
            <div><span style={labelStyle}>Sector</span><p style={valueStyle}>{brand.sector ?? '—'}</p></div>
            <div><span style={labelStyle}>Ubicación</span><p style={valueStyle}>{brand.location ?? '—'}</p></div>
            <div><span style={labelStyle}>Plan</span><p style={{ ...valueStyle, textTransform: 'capitalize' }}>{brand.plan}</p></div>
          </div>
        )}
      </div>

      {/* ── Visual — onboarding style with images ── */}
      <div style={{ border: '1px solid #e5e7eb', borderTop: 'none', padding: '20px 24px', marginBottom: 1, background: '#ffffff' }}>
        <SectionHeader title="Identidad visual" section="visual" />
        {editing === 'visual' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Style selector — reuses onboarding aesthetic */}
            <div>
              <label style={labelStyle}>Estilo visual</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px', background: '#e5e7eb', border: '1px solid #e5e7eb' }}>
                {(['creative', 'elegant', 'warm', 'dynamic', 'editorial', 'dark', 'fresh', 'vintage'] as VisualStyle[]).map(s => (
                  <button key={s} onClick={() => setVisualStyle(s)} style={{
                    background: visualStyle === s ? '#111827' : '#ffffff', border: 'none', padding: 0,
                    cursor: 'pointer', textAlign: 'left', overflow: 'hidden',
                  }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={STYLE_IMGS[s]} alt={s} style={{ width: '100%', height: 60, objectFit: 'cover', display: 'block', opacity: visualStyle === s ? 0.6 : 1 }} />
                    <div style={{ padding: '6px 8px' }}>
                      <p style={{ fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'capitalize', color: visualStyle === s ? '#ffffff' : '#111827' }}>{s}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            {/* Colors */}
            <div style={{ display: 'flex', gap: 16 }}>
              {[{ label: 'Principal', value: primaryColor, set: setPrimaryColor }, { label: 'Secundario', value: secondaryColor, set: setSecondaryColor }].map(c => (
                <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input type="color" value={c.value} onChange={e => c.set(e.target.value)} style={{ width: 36, height: 36, border: '1px solid #e5e7eb', cursor: 'pointer', padding: 2, background: 'none' }} />
                  <div><span style={labelStyle}>{c.label}</span><p style={{ ...valueStyle, fontSize: 12 }}>{c.value}</p></div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            {/* Current style preview */}
            {STYLE_IMGS[brand.visual_style ?? 'warm'] && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={STYLE_IMGS[brand.visual_style ?? 'warm']} alt="" style={{ width: 80, height: 80, objectFit: 'cover' }} />
            )}
            <div style={{ flex: 1 }}>
              <span style={labelStyle}>Estilo</span>
              <p style={{ ...valueStyle, textTransform: 'capitalize', marginBottom: 8 }}>{brand.visual_style ?? '—'}</p>
              <div style={{ display: 'flex', gap: 8 }}>
                {[{ label: 'Principal', color: brand.colors?.primary ?? '#0F766E' }, { label: 'Secundario', color: brand.colors?.secondary ?? '#374151' }].map(c => (
                  <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 16, height: 16, background: c.color, border: '1px solid #e5e7eb' }} />
                    <span style={{ fontFamily: f, fontSize: 11, color: '#6b7280' }}>{c.color}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Tone — onboarding style with example quotes ── */}
      <div style={{ border: '1px solid #e5e7eb', borderTop: 'none', padding: '20px 24px', marginBottom: 1, background: '#ffffff' }}>
        <SectionHeader title="Tono de comunicación" section="tone" />
        {editing === 'tone' ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: '#e5e7eb', border: '1px solid #e5e7eb' }}>
            {TONES.map(t => (
              <button key={t.value} onClick={() => setTone(t.value)} style={{
                padding: '16px', background: tone === t.value ? '#111827' : '#ffffff',
                border: 'none', cursor: 'pointer', textAlign: 'left',
              }}>
                <p style={{ fontFamily: fc, fontSize: 14, fontWeight: 700, textTransform: 'uppercase', color: tone === t.value ? '#ffffff' : '#111827', marginBottom: 4 }}>{t.label}</p>
                <p style={{ fontFamily: f, fontSize: 11, color: tone === t.value ? 'rgba(255,255,255,0.5)' : '#9ca3af', marginBottom: 8 }}>{t.desc}</p>
                <p style={{ fontFamily: f, fontSize: 12, fontStyle: 'italic', color: tone === t.value ? 'rgba(255,255,255,0.7)' : '#6b7280', lineHeight: 1.5 }}>"{t.example}"</p>
              </button>
            ))}
          </div>
        ) : (
          <div>
            <p style={valueStyle}>{TONES.find(t => t.value === brand.tone)?.label ?? brand.tone ?? '—'}</p>
            <p style={{ fontFamily: f, fontSize: 12, fontStyle: 'italic', color: '#6b7280', marginTop: 6, lineHeight: 1.5 }}>
              "{TONES.find(t => t.value === brand.tone)?.example ?? ''}"
            </p>
          </div>
        )}
      </div>

      {/* ── Hashtags ── */}
      <div style={{ border: '1px solid #e5e7eb', borderTop: 'none', padding: '20px 24px', marginBottom: 1, background: '#ffffff' }}>
        <SectionHeader title="Hashtags y slogans" section="hashtags" />
        {editing === 'hashtags' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div><label style={labelStyle}>Hashtags</label><input value={hashtags} onChange={e => setHashtags(e.target.value)} placeholder="#negocio #local" style={inputStyle} /></div>
            <div><label style={labelStyle}>Slogans (uno por línea)</label><textarea value={slogans} onChange={e => setSlogans(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' }} /></div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div><span style={labelStyle}>Hashtags</span><p style={{ ...valueStyle, fontSize: 12 }}>{brand.hashtags?.length ? brand.hashtags.map(h => `#${h}`).join(' ') : '—'}</p></div>
            <div><span style={labelStyle}>Slogans</span><p style={{ ...valueStyle, fontSize: 12 }}>{brand.slogans?.length ? brand.slogans.join(' · ') : '—'}</p></div>
          </div>
        )}
      </div>

      {/* ── Voice ── */}
      <div style={{ border: '1px solid #e5e7eb', borderTop: 'none', padding: '20px 24px', background: '#ffffff' }}>
        <SectionHeader title="Voz de marca" section="voice" />
        {editing === 'voice' ? (
          <textarea value={voiceDoc} onChange={e => setVoiceDoc(e.target.value)} rows={5} placeholder="Describe cómo habla tu marca..." style={{ ...inputStyle, resize: 'vertical' }} />
        ) : (
          <p style={{ ...valueStyle, fontSize: 13, lineHeight: 1.6, color: '#374151' }}>{brand.brand_voice_doc ?? '—'}</p>
        )}
      </div>

      {editing && <p style={{ fontFamily: f, fontSize: 11, color: '#e65100', marginTop: 12, textAlign: 'center' }}>Los cambios afectarán a tu contenido futuro</p>}
    </div>
  );
}
