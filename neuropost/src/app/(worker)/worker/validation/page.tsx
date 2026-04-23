'use client';

import { useEffect, useState, useCallback } from 'react';
import { Check, X, Edit2, RefreshCw, SkipForward, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { createBrowserClient } from '@/lib/supabase';
import { WeeklyPlansQueue }       from './_components/WeeklyPlansQueue';
import { RetouchQueue }           from './_components/RetouchQueue';
import { ColaQueue }              from './_components/ColaQueue';
import { ReclamadasQueue }        from './_components/ReclamadasQueue';
import { ChangesRequestedQueue }  from './_components/ChangesRequestedQueue';

const C = {
  bg: '#ffffff',
  bg1: '#f5f5f5',
  bg2: '#fafafa',
  card: '#ffffff',
  border: '#E5E7EB',
  text: '#111111',
  muted: '#6B7280',
  accent: '#0F766E',
  accent2: '#3B82F6',
  red: '#EF4444',
  orange: '#F59E0B',
  green: '#14B8A6',
};

interface Proposal {
  id: string;
  brand_id: string;
  tema: string;
  concepto: string;
  categoria: string;
  objetivo: string;
  caption_ig: string | null;
  caption_fb: string | null;
  hashtags: { branded?: string[]; nicho?: string[]; broad?: string[] } | null;
  image_url: string | null;
  quality_score: number | null;
  qc_feedback: Record<string, unknown> | null;
  dia_publicacion: string | null;
  hora_publicacion: string | null;
  status: string;
  retry_count: number;
  brands?: { name: string };
}

type Tab = 'proposals' | 'weekly-plans' | 'retouches' | 'changes-requested' | 'cola' | 'mis-tareas';

export default function ValidationPage() {
  const [tab, setTab] = useState<Tab>('proposals');
  const [changesCount, setChangesCount] = useState(0);

  // Poll the pending counts so the "Cambios pedidos" tab shows a badge.
  useEffect(() => {
    let cancelled = false;
    async function loadCounts() {
      try {
        const res  = await fetch('/api/worker/validation-pending-counts');
        const data = await res.json() as { changes_requested?: number };
        if (!cancelled) setChangesCount(data.changes_requested ?? 0);
      } catch { /* silent */ }
    }
    void loadCounts();
    const iv = setInterval(() => { void loadCounts(); }, 60_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  // ── Proposals state ────────────────────────────────────────────────────────
  const [items, setItems] = useState<Proposal[]>([]);
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [editingCaption, setEditingCaption] = useState(false);
  const [captionDraft, setCaptionDraft] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const sb = createBrowserClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (sb as any)
      .from('proposals')
      .select('*, brands(name)')
      .in('status', ['pending_qc', 'qc_rejected_image', 'qc_rejected_caption', 'failed'])
      .order('created_at', { ascending: true })
      .limit(20);
    setItems(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const current = items[idx];

  const action = useCallback(async (act: 'approve' | 'reject' | 'regen-image' | 'regen-copy' | 'skip') => {
    if (!current) return;
    if (act === 'skip') { setIdx((i) => Math.min(i + 1, items.length - 1)); return; }

    setActing(true);
    const sb = createBrowserClient();
    const updates: Record<string, unknown> = {};

    if (act === 'approve') {
      const scheduled_at = current.dia_publicacion
        ? `${current.dia_publicacion}T${current.hora_publicacion ?? '10:00'}:00`
        : null;
      const res = await fetch('/api/worker/posts', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand_id:      current.brand_id,
          caption:       current.caption_ig,
          hashtags: [
            ...(current.hashtags?.branded ?? []),
            ...(current.hashtags?.nicho ?? []),
            ...(current.hashtags?.broad ?? []),
          ],
          image_url:     current.image_url,
          format:        'image',
          platform:      ['instagram', 'facebook'],
          status:        scheduled_at ? 'scheduled' : 'pending',
          quality_score: current.quality_score,
          scheduled_at,
          proposal_id:   current.id,
        }),
      });
      const json = await res.json() as { post?: { id: string }; error?: string };
      if (!res.ok) {
        toast.error(json.error ?? 'No se pudo aprobar el post');
        setActing(false);
        return;
      }

      updates.status = 'converted_to_post';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (json.post?.id) (updates as any).post_id = json.post.id;
      toast.success('Aprobado y enviado al cliente');
    } else if (act === 'reject') {
      updates.status = 'rejected';
      toast.success('Rechazado');
    } else if (act === 'regen-image') {
      updates.status = 'pending_visual';
      updates.retry_count = (current.retry_count ?? 0) + 1;
      toast.success('Regenerando imagen...');
    } else if (act === 'regen-copy') {
      updates.status = 'pending_copy';
      updates.retry_count = (current.retry_count ?? 0) + 1;
      toast.success('Regenerando copy...');
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (sb as any).from('proposals').update(updates).eq('id', current.id);
    setItems((prev) => prev.filter((_, i) => i !== idx));
    if (idx >= items.length - 1) setIdx(Math.max(0, items.length - 2));
    setActing(false);
  }, [current, idx, items]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (tab !== 'proposals') return;
      if (editingCaption) return;
      if (e.key === 'a' || e.key === 'A') action('approve');
      if (e.key === 'r' || e.key === 'R') action('reject');
      if (e.key === 'n' || e.key === 'N' || e.key === 'ArrowRight') action('skip');
      if (e.key === 'ArrowLeft') setIdx((i) => Math.max(0, i - 1));
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [action, editingCaption, tab]);

  async function saveCaption() {
    if (!current) return;
    const sb = createBrowserClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (sb as any).from('proposals').update({ caption_ig: captionDraft }).eq('id', current.id);
    setItems((prev) => prev.map((p, i) => i === idx ? { ...p, caption_ig: captionDraft } : p));
    setEditingCaption(false);
    toast.success('Caption actualizado');
  }

  return (
    <div style={{ padding: 28, color: C.text }}>
      {/* ── Tabs ── */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 16px' }}>Validación de contenido</h1>
        <div style={{ display: 'flex', borderBottom: `2px solid ${C.border}`, gap: 0 }}>
          {([
            ['proposals',         'Propuestas (pieza individual)'],
            ['weekly-plans',      'Planes semanales'],
            ['retouches',         'Retoques pendientes'],
            ['changes-requested', 'Cambios pedidos'],
            ['cola',              'Cola (pipeline clásico)'],
            ['mis-tareas',        'Mis tareas reclamadas'],
          ] as [Tab, string][]).map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '10px 20px',
                background: 'none',
                border: 'none',
                borderBottom: tab === t ? `2px solid ${C.accent}` : '2px solid transparent',
                marginBottom: -2,
                color: tab === t ? C.accent : C.muted,
                fontWeight: tab === t ? 700 : 400,
                fontSize: 14,
                cursor: 'pointer',
                fontFamily: 'inherit',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {label}
              {t === 'changes-requested' && changesCount > 0 && (
                <span style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '2px 6px',
                  background: '#ef4444',
                  color: '#fff',
                  borderRadius: 0,
                  lineHeight: 1,
                  minWidth: 16,
                  textAlign: 'center',
                }}>
                  {changesCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab: Proposals (original code) ── */}
      {tab === 'proposals' && (
        <>
          {loading ? (
            <div style={{ padding: 40, color: C.muted }}>Cargando cola de validación...</div>
          ) : items.length === 0 ? (
            <div style={{ padding: 60, textAlign: 'center' }}>
              <Check size={48} style={{ color: '#10b981', margin: '0 auto 16px' }} />
              <h2 style={{ color: C.text, fontSize: 20, fontWeight: 700 }}>Cola vacía</h2>
              <p style={{ color: C.muted, fontSize: 13 }}>No hay contenido pendiente de validación.</p>
            </div>
          ) : !current ? null : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <p style={{ color: C.muted, fontSize: 13, margin: 0 }}>
                  {idx + 1} de {items.length} — {current.brands?.name ?? 'Sin marca'}
                </p>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0} style={navBtn}>
                    <ChevronLeft size={14} />
                  </button>
                  <button onClick={() => setIdx((i) => Math.min(items.length - 1, i + 1))} disabled={idx === items.length - 1} style={navBtn}>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>

              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 0, overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr' }}>
                  <div style={{ background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 380 }}>
                    {current.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={current.image_url} alt="" style={{ maxWidth: '100%', maxHeight: 480, objectFit: 'contain' }} />
                    ) : (
                      <span style={{ color: C.muted, fontSize: 12 }}>Sin imagen</span>
                    )}
                  </div>

                  <div style={{ padding: 24, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ marginBottom: 16 }}>
                      <span style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 1 }}>Tema</span>
                      <h2 style={{ fontSize: 18, fontWeight: 700, margin: '4px 0' }}>{current.tema}</h2>
                      <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                        <span style={pill}>{current.categoria}</span>
                        <span style={pill}>{current.objetivo}</span>
                        {current.quality_score && (
                          <span style={{ ...pill, background: '#10b98122', color: '#10b981' }}>
                            QC {current.quality_score}/10
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ marginBottom: 16 }}>
                      <span style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 1 }}>Caption Instagram</span>
                      {editingCaption ? (
                        <>
                          <textarea
                            value={captionDraft}
                            onChange={(e) => setCaptionDraft(e.target.value)}
                            rows={6}
                            style={{
                              width: '100%', padding: 10, marginTop: 4,
                              background: C.bg1, border: `1px solid ${C.border}`, color: C.text,
                              fontSize: 12, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box',
                            }}
                          />
                          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                            <button onClick={saveCaption} style={{ ...primaryBtn, fontSize: 11, padding: '6px 14px' }}>Guardar</button>
                            <button onClick={() => setEditingCaption(false)} style={{ ...secondaryBtn, fontSize: 11, padding: '6px 14px' }}>Cancelar</button>
                          </div>
                        </>
                      ) : (
                        <p style={{ fontSize: 13, lineHeight: 1.6, margin: '4px 0', whiteSpace: 'pre-wrap', color: C.text }}>
                          {current.caption_ig ?? <span style={{ color: C.muted, fontStyle: 'italic' }}>Sin caption</span>}
                        </p>
                      )}
                    </div>

                    {current.hashtags && (
                      <div style={{ marginBottom: 16 }}>
                        <span style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 1 }}>Hashtags</span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                          {[...(current.hashtags.branded ?? []), ...(current.hashtags.nicho ?? []), ...(current.hashtags.broad ?? [])].map((h) => (
                            <span key={h} style={{ fontSize: 10, color: C.accent2, background: '#3b82f622', padding: '2px 6px', borderRadius: 0 }}>
                              #{h.replace(/^#/, '')}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 1, background: C.border, borderTop: `1px solid ${C.border}` }}>
                  <button onClick={() => action('approve')} disabled={acting} style={actBtn('#10b981')}>
                    <Check size={14} /> Aprobar (A)
                  </button>
                  <button onClick={() => { setCaptionDraft(current.caption_ig ?? ''); setEditingCaption(true); }} disabled={acting} style={actBtn(C.accent2)}>
                    <Edit2 size={13} /> Editar caption (E)
                  </button>
                  <button onClick={() => action('regen-image')} disabled={acting} style={actBtn('#f59e0b')}>
                    <RefreshCw size={13} /> Regenerar imagen
                  </button>
                  <button onClick={() => action('regen-copy')} disabled={acting} style={actBtn('#a855f7')}>
                    <RefreshCw size={13} /> Regenerar copy
                  </button>
                  <button onClick={() => action('reject')} disabled={acting} style={actBtn('#ef4444')}>
                    <X size={14} /> Rechazar (R)
                  </button>
                  <button onClick={() => action('skip')} disabled={acting} style={actBtn(C.muted)}>
                    <SkipForward size={13} /> Saltar (N)
                  </button>
                </div>
              </div>

              <p style={{ marginTop: 12, fontSize: 11, color: C.muted, textAlign: 'center' }}>
                Atajos: A = aprobar · R = rechazar · E = editar · N = siguiente · ← → navegar
              </p>
            </>
          )}
        </>
      )}

      {/* ── Tab: Weekly Plans ── */}
      {tab === 'weekly-plans' && <WeeklyPlansQueue />}

      {/* ── Tab: Retoques pendientes ── */}
      {tab === 'retouches' && <RetouchQueue />}

      {/* ── Tab: Cambios pedidos (regenerated variations awaiting worker) ── */}
      {tab === 'changes-requested' && <ChangesRequestedQueue />}

      {/* ── Tab: Cola (pipeline clásico) ── */}
      {tab === 'cola' && <ColaQueue />}

      {/* ── Tab: Mis tareas reclamadas ── */}
      {tab === 'mis-tareas' && <ReclamadasQueue />}
    </div>
  );
}

const navBtn: React.CSSProperties = {
  padding: '6px 10px', background: C.card, border: `1px solid ${C.border}`,
  color: C.text, borderRadius: 0, cursor: 'pointer',
};
const pill: React.CSSProperties = {
  fontSize: 10, padding: '3px 8px', background: C.bg1, color: C.muted,
  borderRadius: 0, textTransform: 'uppercase', letterSpacing: 0.5,
};
const primaryBtn: React.CSSProperties = {
  padding: '8px 16px', background: C.accent2, color: '#fff', border: 'none',
  borderRadius: 0, cursor: 'pointer', fontWeight: 600,
};
const secondaryBtn: React.CSSProperties = {
  padding: '8px 16px', background: 'transparent', color: C.muted,
  border: `1px solid ${C.border}`, borderRadius: 0, cursor: 'pointer',
};
function actBtn(color: string): React.CSSProperties {
  return {
    flex: 1, padding: '14px 8px', background: C.card, border: 'none',
    color, fontSize: 12, fontWeight: 600, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  };
}
