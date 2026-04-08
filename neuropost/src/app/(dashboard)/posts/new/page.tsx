'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Zap, Sparkles, Check, X, ArrowRight } from 'lucide-react';
import { PostEditor } from '@/components/posts/PostEditor';
import { useAppStore } from '@/store/useAppStore';
import { PLAN_LIMITS } from '@/types';
import toast from 'react-hot-toast';

const f = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

export default function NewPostPage() {
  const router  = useRouter();
  const brand   = useAppStore((s) => s.brand);
  const addPost = useAppStore((s) => s.addPost);
  const [mode, setMode] = useState<'proposal' | 'instant' | null>(null);
  const [clientNote, setClientNote] = useState('');

  const allowStories = PLAN_LIMITS[brand?.plan ?? 'starter'].storiesPerWeek > 0;

  async function handleSave(data: {
    imageUrl: string | null; caption: string; hashtags: string[];
    platforms: ('instagram' | 'facebook')[]; format: string; goal: string;
    aiExplanation?: string; qualityScore?: number; isStory?: boolean;
  }) {
    const res = await fetch('/api/posts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_url: data.imageUrl, caption: data.caption, hashtags: data.hashtags,
        platform: data.platforms, format: data.format, status: 'generated',
        ai_explanation: data.aiExplanation ?? null, quality_score: data.qualityScore ?? null,
        is_story: data.isStory ?? false, story_type: data.isStory ? 'new' : null,
        versions: [], edit_level: 0, client_edit_mode: mode ?? 'instant',
        client_notes_for_worker: clientNote.trim() || null,
        requires_worker_validation: mode === 'proposal',
      }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Error al guardar');
    addPost(json.post);
    toast.success('Post guardado');
    router.push(`/posts/${json.post.id}`);
  }

  // ── Mode selector ──
  if (!mode) {
    return (
      <div className="page-content" style={{ maxWidth: 800 }}>
        <div style={{ padding: '48px 0 32px' }}>
          <div style={{ fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#9ca3af', marginBottom: 8 }}>
            Nuevo contenido
          </div>
          <h1 style={{ fontFamily: fc, fontWeight: 900, fontSize: 'clamp(2rem, 4vw, 3rem)', textTransform: 'uppercase', letterSpacing: '0.01em', color: '#111827', lineHeight: 0.95, marginBottom: 8 }}>
            Crear nuevo post
          </h1>
          <p style={{ color: '#6b7280', fontSize: 15, fontFamily: f }}>
            Crear contenido debería llevarte menos de 2 minutos
          </p>
        </div>

        {/* Two cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: '#d4d4d8', border: '1px solid #d4d4d8', marginBottom: 32 }}>
          {/* AI / Proposal — recommended */}
          <button
            onClick={() => setMode('proposal')}
            style={{
              padding: '32px 28px', background: '#ffffff', border: 'none',
              cursor: 'pointer', textAlign: 'left', transition: 'background 0.15s',
              display: 'flex', flexDirection: 'column', gap: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <div style={{ width: 36, height: 36, background: '#0F766E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Sparkles size={16} color="#ffffff" />
              </div>
              <span style={{ fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#0F766E', background: '#f0fdf4', padding: '2px 8px' }}>
                Recomendado
              </span>
            </div>
            <p style={{ fontFamily: fc, fontWeight: 800, fontSize: 20, textTransform: 'uppercase', letterSpacing: '0.01em', color: '#111827', marginBottom: 8 }}>
              NeuroPost lo gestiona
            </p>
            <p style={{ fontFamily: f, fontSize: 13, color: '#6b7280', lineHeight: 1.6, marginBottom: 20 }}>
              La IA crea, optimiza y programa tu contenido. Tú solo apruebas.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {['Generación automática de copy', 'Optimización de engagement', 'Programación inteligente', 'Revisión por el equipo'].map((feat) => (
                <div key={feat} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Check size={12} style={{ color: '#0F766E', flexShrink: 0 }} />
                  <span style={{ fontFamily: f, fontSize: 12, color: '#374151' }}>{feat}</span>
                </div>
              ))}
            </div>
            <div style={{
              padding: '10px 20px', background: '#111827', color: '#ffffff', marginTop: 'auto',
              fontFamily: fc, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
              display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
            }}>
              Usar IA <ArrowRight size={13} />
            </div>
          </button>

          {/* Manual / Instant */}
          <button
            onClick={() => setMode('instant')}
            style={{
              padding: '32px 28px', background: '#ffffff', border: 'none',
              cursor: 'pointer', textAlign: 'left', transition: 'background 0.15s',
              display: 'flex', flexDirection: 'column', gap: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <div style={{ width: 36, height: 36, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Zap size={16} color="#6b7280" />
              </div>
            </div>
            <p style={{ fontFamily: fc, fontWeight: 800, fontSize: 20, textTransform: 'uppercase', letterSpacing: '0.01em', color: '#111827', marginBottom: 8 }}>
              Editar manualmente
            </p>
            <p style={{ fontFamily: f, fontSize: 13, color: '#6b7280', lineHeight: 1.6, marginBottom: 20 }}>
              Crea y publica tu contenido con control total. Sin esperas.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {['Edición manual completa', 'Publicación inmediata', 'Control total del contenido'].map((feat) => (
                <div key={feat} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Check size={12} style={{ color: '#9ca3af', flexShrink: 0 }} />
                  <span style={{ fontFamily: f, fontSize: 12, color: '#374151' }}>{feat}</span>
                </div>
              ))}
            </div>
            <div style={{
              padding: '10px 20px', border: '1px solid #d4d4d8', background: '#ffffff', color: '#111827', marginTop: 'auto',
              fontFamily: fc, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
              display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
            }}>
              Crear manualmente <ArrowRight size={13} />
            </div>
          </button>
        </div>

        {/* Comparison table */}
        <div style={{ border: '1px solid #d4d4d8', marginBottom: 32 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', borderBottom: '1px solid #e5e7eb' }}>
            <div style={{ padding: '10px 16px', fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#9ca3af' }}>Característica</div>
            <div style={{ padding: '10px 16px', fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#9ca3af', textAlign: 'center' }}>IA</div>
            <div style={{ padding: '10px 16px', fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#9ca3af', textAlign: 'center' }}>Manual</div>
          </div>
          {[
            { feat: 'Generación automática', ai: true, manual: false },
            { feat: 'Ahorro de tiempo', ai: true, manual: false },
            { feat: 'Optimización de engagement', ai: true, manual: false },
            { feat: 'Control total inmediato', ai: false, manual: true },
            { feat: 'Sin esperas', ai: false, manual: true },
          ].map(({ feat, ai, manual }, i) => (
            <div key={feat} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', borderBottom: i < 4 ? '1px solid #f3f4f6' : 'none', background: '#ffffff' }}>
              <div style={{ padding: '10px 16px', fontFamily: f, fontSize: 13, color: '#374151' }}>{feat}</div>
              <div style={{ padding: '10px 16px', textAlign: 'center' }}>
                {ai ? <Check size={14} style={{ color: '#0F766E' }} /> : <X size={14} style={{ color: '#d1d5db' }} />}
              </div>
              <div style={{ padding: '10px 16px', textAlign: 'center' }}>
                {manual ? <Check size={14} style={{ color: '#0F766E' }} /> : <X size={14} style={{ color: '#d1d5db' }} />}
              </div>
            </div>
          ))}
        </div>

        <p style={{ fontFamily: f, fontSize: 12, color: '#9ca3af', textAlign: 'center' }}>
          La mayoría de negocios usan IA para ahorrar tiempo y mejorar resultados
        </p>
      </div>
    );
  }

  // ── Editor mode ──
  return (
    <div className="page-content" style={{ maxWidth: 1200 }}>
      <div style={{ padding: '32px 0 24px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1 style={{ fontFamily: fc, fontWeight: 900, fontSize: 'clamp(1.5rem, 3vw, 2rem)', textTransform: 'uppercase', letterSpacing: '0.01em', color: '#111827', marginBottom: 4 }}>
            Nuevo post
          </h1>
          <p style={{ color: '#6b7280', fontSize: 13, fontFamily: f }}>
            {mode === 'proposal' ? 'Modo IA — el equipo revisará antes de enviarte el resultado' : 'Modo manual — edita y aprueba tú mismo'}
          </p>
        </div>
        <button onClick={() => setMode(null)} style={{
          fontSize: 12, color: '#6b7280', background: '#ffffff', border: '1px solid #d4d4d8',
          padding: '6px 14px', cursor: 'pointer', fontFamily: f, fontWeight: 500,
        }}>
          ← Cambiar modo
        </button>
      </div>

      {mode === 'proposal' && (
        <div style={{ marginBottom: 20, padding: '16px 20px', background: '#ffffff', border: '1px solid #d4d4d8' }}>
          <label style={{ fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9ca3af', display: 'block', marginBottom: 8 }}>
            Nota para el equipo (opcional)
          </label>
          <textarea
            value={clientNote} onChange={(e) => setClientNote(e.target.value)}
            placeholder="Ej: Hazlo más cálido, que se vea el helado apetecible..."
            rows={2}
            style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', fontSize: 13, resize: 'vertical', outline: 'none', boxSizing: 'border-box', background: '#f7f7f8', fontFamily: f, color: '#111827' }}
          />
        </div>
      )}

      <PostEditor brandName={brand?.name ?? 'Tu negocio'} allowStories={allowStories} onSave={handleSave} />
    </div>
  );
}
