'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import type { Brand, BrandColors, BrandFonts, BrandTone, SocialSector } from '@/types';
import { useAppStore } from '@/store/useAppStore';

interface Props {
  brand: Brand;
}

const TONES: { value: BrandTone; label: string; desc: string }[] = [
  { value: 'cercano',      label: 'Cercano',      desc: 'Amigable y accesible' },
  { value: 'profesional',  label: 'Profesional',  desc: 'Formal y de confianza' },
  { value: 'divertido',    label: 'Divertido',    desc: 'Energético y dinámico' },
  { value: 'premium',      label: 'Premium',      desc: 'Exclusivo y sofisticado' },
];

export function BrandKitEditor({ brand }: Props) {
  const updateBrand = useAppStore((s) => s.updateBrand);

  const [saving, setSaving]   = useState(false);
  const [colors, setColors]   = useState<BrandColors>(
    brand.colors ?? { primary: '#ff5c1a', secondary: '#0f0e0c', accent: '#1a7a4a' },
  );
  const [fonts,  setFonts]    = useState<BrandFonts>(
    brand.fonts  ?? { heading: 'Cabinet Grotesk', body: 'Literata' },
  );
  const [slogans,  setSlogans]  = useState<string>(brand.slogans?.join('\n') ?? '');
  const [hashtags, setHashtags] = useState<string>(brand.hashtags?.join(' ') ?? '');
  const [voiceDoc, setVoiceDoc] = useState<string>(brand.brand_voice_doc ?? '');
  const [tone, setTone]         = useState<BrandTone>(brand.tone ?? 'cercano');

  async function save() {
    setSaving(true);
    try {
      const patch = {
        colors,
        fonts,
        tone,
        slogans:        slogans.split('\n').map((s) => s.trim()).filter(Boolean),
        hashtags:       hashtags.split(/[\s,]+/).map((h) => h.replace(/^#/, '').trim()).filter(Boolean),
        brand_voice_doc: voiceDoc || null,
      };
      const res  = await fetch('/api/brands', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      updateBrand(patch);
      toast.success('Brand Kit guardado');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {/* Tone */}
      <div className="settings-section">
        <div className="settings-section-title">Tono de comunicación</div>
        <div className="tone-grid">
          {TONES.map((t) => (
            <button
              key={t.value}
              className={`tone-card${tone === t.value ? ' active' : ''}`}
              onClick={() => setTone(t.value)}
            >
              <strong>{t.label}</strong>
              <span>{t.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Colors */}
      <div className="settings-section">
        <div className="settings-section-title">Colores de marca</div>
        <div className="color-pickers">
          {(['primary', 'secondary', 'accent'] as (keyof BrandColors)[]).map((k) => (
            <div key={k} className="color-picker-item">
              <label>{k === 'primary' ? 'Principal' : k === 'secondary' ? 'Secundario' : 'Acento'}</label>
              <div className="color-picker-row">
                <input
                  type="color"
                  value={colors[k]}
                  onChange={(e) => setColors((prev) => ({ ...prev, [k]: e.target.value }))}
                  className="color-swatch-input"
                />
                <input
                  type="text"
                  value={colors[k]}
                  onChange={(e) => setColors((prev) => ({ ...prev, [k]: e.target.value }))}
                  className="color-hex-input"
                  maxLength={7}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Fonts */}
      <div className="settings-section">
        <div className="settings-section-title">Tipografías</div>
        <div className="settings-grid">
          <div className="form-group">
            <label>Titular</label>
            <input
              type="text"
              value={fonts.heading}
              onChange={(e) => setFonts((prev) => ({ ...prev, heading: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label>Cuerpo</label>
            <input
              type="text"
              value={fonts.body}
              onChange={(e) => setFonts((prev) => ({ ...prev, body: e.target.value }))}
            />
          </div>
        </div>
      </div>

      {/* Slogans */}
      <div className="settings-section">
        <div className="settings-section-title">Slogans (uno por línea)</div>
        <textarea
          className="editor-textarea"
          rows={4}
          value={slogans}
          onChange={(e) => setSlogans(e.target.value)}
          placeholder="El sabor de siempre&#10;Calidad sin compromiso"
        />
      </div>

      {/* Hashtags */}
      <div className="settings-section">
        <div className="settings-section-title">Hashtags de marca</div>
        <input
          type="text"
          className="form-group"
          style={{ padding: '12px 16px', borderRadius: 'var(--r)', border: '1.5px solid var(--border)', fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: '0.95rem', outline: 'none', width: '100%' }}
          value={hashtags}
          onChange={(e) => setHashtags(e.target.value)}
          placeholder="#minegocio #sector #ciudad"
        />
      </div>

      {/* Brand voice doc */}
      <div className="settings-section">
        <div className="settings-section-title">Documento de voz de marca</div>
        <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: 12 }}>
          Describe cómo habla tu marca: ejemplos de captions, estilo, lo que se debe y no debe decir.
        </p>
        <textarea
          className="editor-textarea"
          rows={8}
          value={voiceDoc}
          onChange={(e) => setVoiceDoc(e.target.value)}
          placeholder="Nuestra marca habla de forma…"
        />
      </div>

      <button className="btn-primary btn-orange" onClick={save} disabled={saving}>
        {saving ? 'Guardando…' : 'Guardar Brand Kit'}
      </button>
    </div>
  );
}
