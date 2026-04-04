'use client';

import { useState } from 'react';
import { Upload, Sparkles } from 'lucide-react';
import type { NanoBananaQuality } from '@/lib/nanoBanana';
import type { SubscriptionPlan } from '@/types';

interface Props {
  plan:          SubscriptionPlan;
  onFileSelect:  (file: File) => void;
  onGenerate:    (prompt: string, quality: NanoBananaQuality) => Promise<void>;
  generating?:   boolean;
}

type QualityOption = { value: NanoBananaQuality; label: string; time: string; icon: string; minPlan: SubscriptionPlan };

const QUALITY_OPTIONS: QualityOption[] = [
  { value: 'fast',  label: 'Fast',  time: '~5 seg',  icon: '⚡', minPlan: 'starter' },
  { value: 'pro',   label: 'Pro',   time: '~10 seg', icon: '✨', minPlan: 'pro'     },
  { value: 'ultra', label: 'Ultra', time: '~15 seg, 4K', icon: '💎', minPlan: 'agency' },
];

const PLAN_ORDER: SubscriptionPlan[] = ['starter', 'pro', 'total', 'agency'];

function planIndex(p: SubscriptionPlan) { return PLAN_ORDER.indexOf(p); }

// ─── Prompt examples per sector ───────────────────────────────────────────────
const PROMPT_EXAMPLES = [
  'Burger on a neon orange background, ultra saturated, studio lighting, 4K food photography',
  'Artisan coffee cup on white marble, natural side lighting, minimal composition',
  'Ice cream cone with colorful sprinkles, overhead shot, vibrant colors, editorial style',
  'Athletic person in modern gym, dramatic lighting, high contrast, sports photography',
  'Luxury apartment interior with golden hour light, architectural photography',
  'Colorful nail art close-up on pastel background, macro photography, beauty editorial',
  'Fresh bread on wooden board, warm tones, natural light, artisanal food photography',
  'Modern storefront exterior, clean design, blue sky, professional commercial photography',
];

export function ImageSourceSelector({ plan, onFileSelect, onGenerate, generating = false }: Props) {
  const [mode,    setMode]    = useState<'upload' | 'generate'>('upload');
  const [prompt,  setPrompt]  = useState('');
  const [quality, setQuality] = useState<NanoBananaQuality>(
    planIndex(plan) >= 3 ? 'ultra' : planIndex(plan) >= 1 ? 'pro' : 'fast',
  );

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onFileSelect(file);
  }

  const randomExample = PROMPT_EXAMPLES[Math.floor(Math.random() * PROMPT_EXAMPLES.length)];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Mode tabs */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          className={`btn-outline${mode === 'upload' ? ' active' : ''}`}
          style={{ flex: 1, fontSize: '0.85rem', padding: '8px 12px' }}
          onClick={() => setMode('upload')}
        >
          <Upload size={14} /> Puja el teu contingut
        </button>
        <button
          className={`btn-outline${mode === 'generate' ? ' active' : ''}`}
          style={{ flex: 1, fontSize: '0.85rem', padding: '8px 12px' }}
          onClick={() => setMode('generate')}
        >
          <Sparkles size={14} /> Vols que creem les imatges?
        </button>
      </div>

      {mode === 'upload' && (
        <div>
          <label
            style={{
              display:      'flex',
              flexDirection: 'column',
              alignItems:   'center',
              gap:          8,
              padding:      24,
              border:       '2px dashed var(--border)',
              borderRadius: 12,
              cursor:       'pointer',
              textAlign:    'center',
              fontSize:     '0.85rem',
              color:        'var(--muted)',
            }}
          >
            <Upload size={24} style={{ opacity: 0.4 }} />
            <span>Envia&apos;ns les teves fotos i vídeos i els preparem per publicar</span>
            <span style={{ fontSize: '0.75rem' }}>JPG, PNG, WEBP</span>
            <input type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={handleFile} />
          </label>
        </div>
      )}

      {mode === 'generate' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--muted)', margin: 0 }}>
            Si no tens contingut, podem crear imatges i vídeos per al teu negoci. Descriu el que vols i ho fem.
          </p>

          <textarea
            className="editor-textarea"
            rows={3}
            placeholder={`Ex: ${randomExample}`}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />

          {/* Quality selector */}
          <div>
            <p style={{ fontSize: '0.78rem', color: 'var(--muted)', marginBottom: 6 }}>Qualitat:</p>
            <div style={{ display: 'flex', gap: 6 }}>
              {QUALITY_OPTIONS.map((opt) => {
                const available = planIndex(plan) >= planIndex(opt.minPlan);
                const active    = quality === opt.value;
                return (
                  <button
                    key={opt.value}
                    title={available ? `${opt.time}` : `Disponible des del pla ${opt.minPlan} →`}
                    onClick={() => available && setQuality(opt.value)}
                    style={{
                      flex:         1,
                      padding:      '6px 8px',
                      borderRadius: 8,
                      border:       `1.5px solid ${active ? 'var(--orange)' : 'var(--border)'}`,
                      background:   active ? 'var(--orange-light, #fff5f0)' : '#fff',
                      cursor:       available ? 'pointer' : 'not-allowed',
                      opacity:      available ? 1 : 0.45,
                      fontSize:     '0.78rem',
                      fontWeight:   active ? 700 : 400,
                      display:      'flex',
                      flexDirection: 'column',
                      alignItems:   'center',
                      gap:          2,
                    }}
                  >
                    <span>{opt.icon} {opt.label}</span>
                    <span style={{ fontSize: '0.68rem', color: 'var(--muted)', fontWeight: 400 }}>{opt.time}</span>
                    {!available && (
                      <span style={{ fontSize: '0.62rem', color: 'var(--orange)', fontWeight: 700 }}>
                        Pla {opt.minPlan} →
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            className="btn-primary btn-orange"
            disabled={generating || !prompt.trim()}
            onClick={() => onGenerate(prompt, quality)}
            style={{ alignSelf: 'flex-start' }}
          >
            {generating ? <><span className="loading-spinner" /> Creant la imatge...</> : <><Sparkles size={14} /> Crear imatge</>}
          </button>

          <p style={{ fontSize: '0.72rem', color: 'var(--muted)', margin: 0 }}>
            Servei de creació de contingut visual · Inclòs al pla Pro
          </p>
        </div>
      )}
    </div>
  );
}
