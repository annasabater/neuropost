'use client';

import { useState, useEffect } from 'react';
import { UserCheck }           from 'lucide-react';
import toast                   from 'react-hot-toast';

const f  = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

const C = {
  bg1:     '#f3f4f6',
  card:    '#ffffff',
  border:  '#e5e7eb',
  text:    '#111111',
  muted:   '#6b7280',
  accent:  '#0F766E',
  accent2: '#0D9488',
  red:     '#EF4444',
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min  = Math.floor(diff / 60000);
  if (min < 1) return 'ahora mismo';
  if (min < 60) return `hace ${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h}h`;
  return `hace ${Math.floor(h / 24)}d`;
}

type ClaimedJob = {
  id:         string;
  brand_id:   string;
  agent_type: string;
  action:     string;
  input:      Record<string, unknown>;
  status:     string;
  priority:   number;
  claimed_at: string;
  created_at: string;
  brands?:    { name?: string };
};

export function ReclamadasQueue() {
  const [jobs,       setJobs]       = useState<ClaimedJob[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [selected,   setSelected]   = useState<ClaimedJob | null>(null);
  const [completing, setCompleting] = useState(false);
  const [uploadUrl,  setUploadUrl]  = useState('');
  const [caption,    setCaption]    = useState('');

  useEffect(() => {
    fetch('/api/worker/jobs/claimed')
      .then((r) => r.json())
      .then((d) => { setJobs(d.jobs ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function handleComplete() {
    if (!selected) return;
    setCompleting(true);
    try {
      const isVideo = selected.action.includes('video');
      const body: Record<string, unknown> = { kind: isVideo ? 'video' : 'image', payload: { manual: true, caption } };
      if (isVideo) body.video_url = uploadUrl;
      else         body.image_url = uploadUrl;
      if (caption) body.caption   = caption;

      const res = await fetch(`/api/worker/jobs/${selected.id}/complete`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });
      if (res.ok) {
        toast.success('Tarea completada y enviada al cliente');
        setJobs((prev) => prev.filter((j) => j.id !== selected.id));
        setSelected(null);
        setUploadUrl('');
        setCaption('');
      } else {
        const d = await res.json() as { error?: string };
        toast.error(d.error ?? 'Error');
      }
    } catch { toast.error('Error de conexión'); }
    setCompleting(false);
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: C.muted, fontFamily: f }}>Cargando tareas reclamadas...</div>;

  return (
    <div style={{ padding: 28, color: C.text, fontFamily: f }}>
      <h2 style={{ fontFamily: fc, fontSize: 22, fontWeight: 800, textTransform: 'uppercase', marginBottom: 8 }}>
        Mis tareas reclamadas
      </h2>
      <p style={{ color: C.muted, fontSize: 13, marginBottom: 24 }}>
        Tareas que has reclamado para gestionar manualmente en vez de dejar al agente IA.
      </p>

      {jobs.length === 0 ? (
        <div style={{ padding: 48, textAlign: 'center', border: `1px solid ${C.border}`, background: C.card }}>
          <UserCheck size={32} style={{ color: C.muted, marginBottom: 12 }} />
          <p style={{ color: C.muted, fontSize: 14 }}>No tienes tareas reclamadas</p>
          <p style={{ color: C.muted, fontSize: 12 }}>Ve a la cola y reclama una tarea pending para gestionarla manualmente.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 400px' : '1fr', gap: 20 }}>
          {/* Job list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {jobs.map((j) => {
              const brandName   = (j.brands as { name?: string } | undefined)?.name ?? 'Cliente';
              const actionLabel = j.action.replace(/_/g, ' ');
              return (
                <button key={j.id} type="button" onClick={() => { setSelected(j); setUploadUrl(''); setCaption(''); }} style={{
                  width: '100%', textAlign: 'left', padding: '14px 18px',
                  background: selected?.id === j.id ? 'rgba(15,118,110,0.06)' : C.card,
                  border:     `1px solid ${selected?.id === j.id ? C.accent2 : C.border}`,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14,
                }}>
                  <div style={{ width: 8, height: 8, background: '#6366f1' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{brandName}</div>
                    <div style={{ fontSize: 12, color: C.muted }}>{j.agent_type}: {actionLabel}</div>
                  </div>
                  <div style={{ fontSize: 11, color: C.muted }}>{timeAgo(j.claimed_at)}</div>
                </button>
              );
            })}
          </div>

          {/* Detail panel */}
          {selected && (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, padding: 24, height: 'fit-content', position: 'sticky', top: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 16 }}>Completar tarea</h3>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Agente</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{selected.agent_type}: {selected.action}</div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Descripción del cliente</div>
                <div style={{ fontSize: 13 }}>
                  {String(selected.input?.userPrompt ?? selected.input?.global_description ?? selected.input?.prompt ?? '(sin descripción)')}
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
                  URL del archivo ({selected.action.includes('video') ? 'vídeo' : 'imagen'})
                </div>
                <input
                  value={uploadUrl}
                  onChange={(e) => setUploadUrl(e.target.value)}
                  placeholder="https://... (URL del archivo subido)"
                  style={{ width: '100%', padding: '10px 12px', border: `1px solid ${C.border}`, fontSize: 13, boxSizing: 'border-box', outline: 'none', fontFamily: f }}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Caption (opcional)</div>
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Escribe el caption para el post..."
                  rows={3}
                  style={{ width: '100%', padding: '10px 12px', border: `1px solid ${C.border}`, fontSize: 13, resize: 'vertical', boxSizing: 'border-box', outline: 'none', fontFamily: f }}
                />
              </div>

              <button
                onClick={handleComplete}
                disabled={completing || !uploadUrl.trim()}
                style={{
                  width: '100%', padding: '14px',
                  background: uploadUrl.trim() ? C.accent : C.bg1,
                  color:      uploadUrl.trim() ? '#fff' : C.muted,
                  border: 'none', cursor: uploadUrl.trim() ? 'pointer' : 'default',
                  fontFamily: fc, fontSize: 14, fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.04em',
                  opacity: completing ? 0.6 : 1,
                }}
              >
                {completing ? 'Enviando...' : 'Completar y enviar al cliente'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
