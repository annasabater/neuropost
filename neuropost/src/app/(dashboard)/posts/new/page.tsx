'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PostEditor } from '@/components/posts/PostEditor';
import { useAppStore } from '@/store/useAppStore';
import { PLAN_LIMITS } from '@/types';
import toast from 'react-hot-toast';

export default function NewPostPage() {
  const router  = useRouter();
  const brand   = useAppStore((s) => s.brand);
  const addPost = useAppStore((s) => s.addPost);
  const [mode, setMode] = useState<'proposal' | 'instant' | null>(null);
  const [clientNote, setClientNote] = useState('');

  const allowStories = PLAN_LIMITS[brand?.plan ?? 'starter'].storiesPerWeek > 0;

  async function handleSave(data: {
    imageUrl:       string | null;
    caption:        string;
    hashtags:       string[];
    platforms:      ('instagram' | 'facebook')[];
    format:         string;
    goal:           string;
    aiExplanation?: string;
    qualityScore?:  number;
    isStory?:       boolean;
  }) {
    const res = await fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_url:                 data.imageUrl,
        caption:                   data.caption,
        hashtags:                  data.hashtags,
        platform:                  data.platforms,
        format:                    data.format,
        status:                    'generated',
        ai_explanation:            data.aiExplanation ?? null,
        quality_score:             data.qualityScore  ?? null,
        is_story:                  data.isStory ?? false,
        story_type:                data.isStory ? 'new' : null,
        versions:                  [],
        edit_level:                0,
        client_edit_mode:          mode ?? 'instant',
        client_notes_for_worker:   clientNote.trim() || null,
        requires_worker_validation: mode === 'proposal',
      }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Error al guardar');
    addPost(json.post);
    toast.success('Post guardado correctamente');
    router.push(`/posts/${json.post.id}`);
  }

  // Mode selector
  if (!mode) {
    return (
      <div className="page-content" style={{ maxWidth: 700 }}>
        <div className="page-header">
          <div className="page-header-text">
            <h1 className="page-title">Nuevo post</h1>
            <p className="page-sub">¿Cómo quieres crear este post?</p>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 8 }}>
          <button
            onClick={() => setMode('proposal')}
            style={{
              padding: '28px 24px', border: '2px solid var(--border)', borderRadius: 14,
              background: 'var(--surface)', cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--orange)')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
          >
            <div style={{ fontSize: 28, marginBottom: 10 }}>📤</div>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Dejar que el equipo lo gestione</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
              Sube el contenido y NeuroPost lo prepara. Pasará por revisión del equipo antes de que lo veas.
            </div>
            <div style={{ marginTop: 12, fontSize: 11, color: 'var(--orange)', fontWeight: 600 }}>
              → Revisión por el equipo NeuroPost
            </div>
          </button>
          <button
            onClick={() => setMode('instant')}
            style={{
              padding: '28px 24px', border: '2px solid var(--border)', borderRadius: 14,
              background: 'var(--surface)', cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--orange)')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
          >
            <div style={{ fontSize: 28, marginBottom: 10 }}>⚡</div>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Editar yo mismo ahora</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
              Quiero ajustar la foto y el caption en este momento. Va directamente sin revisión.
            </div>
            <div style={{ marginTop: 12, fontSize: 11, color: 'var(--orange)', fontWeight: 600 }}>
              → Sin revisión, acceso inmediato
            </div>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content" style={{ maxWidth: 1200 }}>
      <div className="page-header">
        <div className="page-header-text">
          <h1 className="page-title">Nuevo post</h1>
          <p className="page-sub">
            {mode === 'proposal' ? '📤 Modo propuesta — el equipo NeuroPost revisará antes de enviarte el resultado' : '⚡ Modo instantáneo — edita y aprueba tú mismo'}
          </p>
        </div>
        <button onClick={() => setMode(null)} style={{ fontSize: 13, color: 'var(--muted)', background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 14px', cursor: 'pointer' }}>
          ← Cambiar modo
        </button>
      </div>

      {mode === 'proposal' && (
        <div style={{ marginBottom: 20, padding: '16px 20px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 }}>
          <label style={{ fontSize: 13, fontWeight: 700, display: 'block', marginBottom: 8 }}>
            Nota para el equipo (opcional)
          </label>
          <textarea
            value={clientNote}
            onChange={(e) => setClientNote(e.target.value)}
            placeholder="Ej: Hazlo más cálido, que se vea el helado apetecible..."
            rows={2}
            style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, resize: 'vertical', outline: 'none', boxSizing: 'border-box', background: 'var(--bg)' }}
          />
        </div>
      )}

      <PostEditor brandName={brand?.name ?? 'Tu negocio'} allowStories={allowStories} onSave={handleSave} />
    </div>
  );
}
