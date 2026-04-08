'use client';

import { useState } from 'react';
import { Pencil, X, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppStore } from '@/store/useAppStore';
import type { BrandTone, VisualStyle, PublishMode } from '@/types';
import { TONE_OPTIONS, PUBLISH_MODE_OPTIONS } from '@/lib/brand-options';

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

type EditSection = 'visual' | 'tone' | 'colors' | 'hashtags' | 'voice' | 'publish' | null;

export default function BrandPage() {
  const brand = useAppStore((s) => s.brand);
  const brandLoading = useAppStore((s) => s.brandLoading);
  const updateBrand = useAppStore((s) => s.updateBrand);
  const [editing, setEditing] = useState<EditSection>(null);
  const [saving, setSaving] = useState(false);

  // Edit state
  const [visualStyle, setVisualStyle] = useState<VisualStyle>(brand?.visual_style ?? 'warm');
  const [tone, setTone] = useState<BrandTone>(brand?.tone ?? 'cercano');
  const [primaryColor, setPrimaryColor] = useState(brand?.colors?.primary ?? '#0F766E');
  const [secondaryColor, setSecondaryColor] = useState(brand?.colors?.secondary ?? '#374151');
  const [hashtags, setHashtags] = useState(brand?.hashtags?.join(' ') ?? '');
  const [slogans, setSlogans] = useState(brand?.slogans?.join('\n') ?? '');
  const [voiceDoc, setVoiceDoc] = useState(brand?.brand_voice_doc ?? '');
  const [publishMode, setPublishMode] = useState<PublishMode>(brand?.publish_mode ?? 'semi');

  async function save() {
    setSaving(true);
    const patch: Record<string, unknown> = {};
    if (editing === 'visual') patch.visual_style = visualStyle;
    if (editing === 'tone') patch.tone = tone;
    if (editing === 'colors') patch.colors = { primary: primaryColor, secondary: secondaryColor, accent: primaryColor };
    if (editing === 'hashtags') { patch.hashtags = hashtags.split(/[\s,]+/).map(h => h.replace(/^#/, '').trim()).filter(Boolean); patch.slogans = slogans.split('\n').map(s => s.trim()).filter(Boolean); }
    if (editing === 'voice') patch.brand_voice_doc = voiceDoc || null;
    if (editing === 'publish') patch.publish_mode = publishMode;
    try {
      const res = await fetch('/api/brands', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
      const json = await res.json();
      if (res.ok && json.brand) { updateBrand(json.brand); toast.success('Guardado'); setEditing(null); }
      else toast.error(json.error ?? 'Error');
    } catch { toast.error('Error de conexión'); }
    setSaving(false);
  }

  if (brandLoading) return <div className="page-content" style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><span className="loading-spinner" /></div>;
  if (!brand) return <div className="page-content" style={{ textAlign: 'center', padding: '80px 20px' }}><p style={{ fontFamily: fc, fontWeight: 900, fontSize: 20, textTransform: 'uppercase', color: '#111827' }}>Completa el onboarding primero</p></div>;

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
      <div className="page-content" style={{ maxWidth: 800 }}>
        <div style={{ padding: '48px 0 40px' }}>
          <h1 style={{ fontFamily: fc, fontWeight: 900, fontSize: 'clamp(2.5rem, 5vw, 3.5rem)', textTransform: 'uppercase', letterSpacing: '0.01em', color: '#111827', lineHeight: 0.95, marginBottom: 8 }}>Brand Kit</h1>
          <p style={{ color: '#6b7280', fontSize: 15, fontFamily: f }}>La identidad de tu marca</p>
        </div>

        <div style={{ border: '1px solid #e5e7eb', background: '#ffffff' }}>
          {/* Info — read only */}
          <div style={{ padding: '16px 24px', borderBottom: '1px solid #f3f4f6' }}>
            <span style={labelStyle}>Negocio</span>
            <p style={{ ...valueStyle, fontSize: 16, fontWeight: 700 }}>{brand.name}</p>
            <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
              <span style={{ fontFamily: f, fontSize: 12, color: '#9ca3af' }}>{brand.sector ?? '—'}</span>
              <span style={{ fontFamily: f, fontSize: 12, color: '#9ca3af' }}>{brand.location ?? '—'}</span>
              <span style={{ fontFamily: f, fontSize: 12, color: '#9ca3af', textTransform: 'capitalize' }}>{brand.plan}</span>
            </div>
          </div>

          {/* Visual style */}
          <Row label="Estilo visual" section="visual" value={
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {STYLE_DATA.find(s => s.value === brand.visual_style) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={STYLE_DATA.find(s => s.value === brand.visual_style)!.img} alt="" style={{ width: 48, height: 48, objectFit: 'cover' }} />
              )}
              <span style={{ ...valueStyle, textTransform: 'capitalize' }}>{brand.visual_style ?? '—'}</span>
            </div>
          } />

          {/* Tone */}
          <Row label="Tono de comunicación" section="tone" value={
            <div>
              <p style={valueStyle}>{TONE_DATA.find(t => t.value === brand.tone)?.label ?? brand.tone ?? '—'}</p>
              <p style={{ fontFamily: f, fontSize: 12, fontStyle: 'italic', color: '#6b7280', marginTop: 4 }}>"{TONE_DATA.find(t => t.value === brand.tone)?.example ?? ''}"</p>
            </div>
          } />

          {/* Colors */}
          <Row label="Colores de marca" section="colors" value={
            <div style={{ display: 'flex', gap: 8 }}>
              {[brand.colors?.primary ?? '#0F766E', brand.colors?.secondary ?? '#374151'].map(c => (
                <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 16, height: 16, background: c, border: '1px solid #e5e7eb' }} />
                  <span style={{ fontFamily: f, fontSize: 11, color: '#6b7280' }}>{c}</span>
                </div>
              ))}
            </div>
          } />

          {/* Hashtags */}
          <Row label="Hashtags y slogans" section="hashtags" value={
            <div>
              <p style={{ fontFamily: f, fontSize: 12, color: '#374151' }}>{brand.hashtags?.length ? brand.hashtags.map(h => `#${h}`).join(' ') : '—'}</p>
              {brand.slogans?.length ? <p style={{ fontFamily: f, fontSize: 11, color: '#9ca3af', marginTop: 4 }}>{brand.slogans.join(' · ')}</p> : null}
            </div>
          } />

          {/* Voice */}
          <Row label="Voz de marca" section="voice" value={
            <p style={{ fontFamily: f, fontSize: 13, color: '#374151', lineHeight: 1.5 }}>{brand.brand_voice_doc?.slice(0, 120) ?? '—'}{brand.brand_voice_doc && brand.brand_voice_doc.length > 120 ? '...' : ''}</p>
          } />

          {/* Publish mode */}
          <Row label="Modo de publicación" section="publish" value={
            <p style={valueStyle}>{PUBLISH_MODE_OPTIONS.find(m => m.value === brand.publish_mode)?.label ?? brand.publish_mode ?? '—'}</p>
          } />
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
                {editing === 'visual' ? 'Estilo visual' : editing === 'tone' ? 'Tono' : editing === 'colors' ? 'Colores' : editing === 'hashtags' ? 'Hashtags' : editing === 'voice' ? 'Voz de marca' : 'Publicación'}
              </h2>
              <button onClick={() => setEditing(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}><X size={20} /></button>
            </div>

            {/* Panel content — onboarding style */}
            <div style={{ flex: 1, padding: '28px', overflowY: 'auto' }}>

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

              {editing === 'hashtags' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div><label style={labelStyle}>Hashtags</label><input value={hashtags} onChange={e => setHashtags(e.target.value)} placeholder="#negocio #local" style={inputStyle} /></div>
                  <div><label style={labelStyle}>Slogans (uno por línea)</label><textarea value={slogans} onChange={e => setSlogans(e.target.value)} rows={4} style={{ ...inputStyle, resize: 'vertical' }} /></div>
                </div>
              )}

              {editing === 'voice' && (
                <div>
                  <label style={labelStyle}>Documento de voz de marca</label>
                  <textarea value={voiceDoc} onChange={e => setVoiceDoc(e.target.value)} rows={8} placeholder="Describe cómo habla tu marca, qué palabras usa, qué evita..."
                    style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }} />
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
