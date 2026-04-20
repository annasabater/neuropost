'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams }                   from 'next/navigation';
import toast                                 from 'react-hot-toast';

const f  = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

const C = {
  bg:      '#ffffff',
  bg1:     '#f3f4f6',
  card:    '#ffffff',
  border:  '#e5e7eb',
  text:    '#111111',
  muted:   '#6b7280',
  accent:  '#0F766E',
  accent2: '#0D9488',
  red:     '#EF4444',
  orange:  '#F59E0B',
  green:   '#0F766E',
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'ahora mismo';
  if (min < 60) return `hace ${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h}h`;
  return `hace ${Math.floor(h / 24)}d`;
}

function waitingColor(dateStr: string) {
  const h = (Date.now() - new Date(dateStr).getTime()) / 3600000;
  if (h < 1) return C.green;
  if (h < 3) return C.orange;
  return C.red;
}

type AiReview = {
  score:          number;
  matches_brief:  boolean;
  matches_brand:  boolean;
  issues:         string[];
  recommendation: 'approve' | 'review' | 'regenerate';
  summary:        string;
};

type ContentQueue = {
  id:         string;
  status:     string;
  priority:   string;
  created_at: string;
  posts?:     { image_url?: string };
  brands?:    { name?: string };
};

type QueueItem = ContentQueue & {
  posts?: {
    image_url:                string | null;
    edited_image_url:         string | null;
    caption:                  string | null;
    hashtags:                 string[];
    format:                   string;
    platform:                 string[];
    quality_score:            number | null;
    client_notes_for_worker:  string | null;
  };
  brands?:    { id: string; name: string; sector: string };
  ai_review?: AiReview | null;
};

type RecreationRequest = {
  id:                      string;
  brand_id:                string;
  status:                  'pending' | 'in_progress' | 'completed' | 'rejected';
  client_notes:            string | null;
  worker_notes:            string | null;
  created_at:              string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  inspiration_references:  any | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  brands:                  any | null;
};

const STATUS_FILTERS = [
  { value: '',               label: 'Todos' },
  { value: 'pending_worker', label: 'Pendientes' },
  { value: 'worker_rejected', label: 'Rechazados' },
  { value: 'client_rejected', label: 'Rechazados por cliente' },
];

export function ColaQueue() {
  const searchParams = useSearchParams();
  const initialId    = searchParams.get('id');

  const [items,        setItems]        = useState<QueueItem[]>([]);
  const [selected,     setSelected]     = useState<QueueItem | null>(null);
  const [statusFilter, setStatus]       = useState('pending_worker');
  const [workerNotes,  setNotes]        = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showReject,   setShowReject]   = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [recreations,  setRecreations]  = useState<RecreationRequest[]>([]);

  useEffect(() => {
    fetch('/api/worker/recreaciones')
      .then((r) => r.json())
      .then((d) => setRecreations(d.recreations ?? []))
      .catch(() => null);
  }, []);

  const fetchQueue = useCallback(async () => {
    const url = statusFilter ? `/api/worker/cola?status=${statusFilter}` : '/api/worker/cola';
    const res  = await fetch(url);
    const json = await res.json();
    const q    = json.queue ?? [];
    setItems(q);
    if (initialId && !selected) {
      const found = q.find((i: QueueItem) => i.id === initialId);
      if (found) { setSelected(found); setNotes(''); }
    }
  }, [statusFilter, initialId, selected]);

  useEffect(() => { fetchQueue(); }, [fetchQueue]);

  async function handleAction(action: 'approve' | 'reject' | 'urgent') {
    if (!selected) return;
    setLoading(true);
    try {
      if (action === 'urgent') {
        await fetch('/api/worker/cola', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ queueId: selected.id, status: selected.status, priority: 'urgent' }) });
        toast.success('Marcado como urgente');
        setItems((prev) => prev.map((i) => i.id === selected.id ? { ...i, priority: 'urgent' } : i));
        setSelected((s) => s ? { ...s, priority: 'urgent' } : s);
        setLoading(false);
        return;
      }

      const newStatus = action === 'approve' ? 'sent_to_client' : 'worker_rejected';
      await fetch('/api/worker/cola', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ queueId: selected.id, status: newStatus, worker_notes: workerNotes }),
      });
      toast.success(action === 'approve' ? '✅ Enviado al cliente' : '❌ Rechazado');
      setItems((prev) => prev.filter((i) => i.id !== selected.id));
      setSelected(null);
      setNotes('');
      setShowReject(false);
    } catch {
      toast.error('Error al procesar');
    } finally {
      setLoading(false);
    }
  }

  const score      = selected?.posts?.quality_score ?? null;
  const scoreColor = score == null ? C.muted : score >= 80 ? C.green : score >= 60 ? C.orange : C.red;
  const scoreLabel = score == null ? '—' : score >= 80 ? 'Muy bueno' : score >= 60 ? 'Aceptable' : 'Mejorable';

  const pendingRecs = recreations.filter((r) => r.status === 'pending' || r.status === 'in_progress');
  const statusBadgeColor = (s: RecreationRequest['status']) =>
    s === 'pending' ? C.orange : s === 'in_progress' ? C.accent2 : s === 'completed' ? C.green : C.red;
  const statusLabel = (s: RecreationRequest['status']) =>
    s === 'pending' ? 'Pendiente' : s === 'in_progress' ? 'En progreso' : s === 'completed' ? 'Completado' : 'Rechazado';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: f }}>
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left column */}
        <div style={{ width: 320, borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '20px 16px 12px', borderBottom: `1px solid ${C.border}` }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: C.text, marginBottom: 12 }}>Cola de validación</h2>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {STATUS_FILTERS.map((f) => (
                <button key={f.value} onClick={() => setStatus(f.value)} style={{
                  padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  background: statusFilter === f.value ? C.accent2 : 'transparent',
                  color:      statusFilter === f.value ? '#fff' : C.muted,
                  border:     `1px solid ${statusFilter === f.value ? C.accent2 : C.border}`,
                }}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px' }}>
            {items.length === 0 ? (
              <p style={{ color: C.muted, fontSize: 13, textAlign: 'center', padding: '40px 0' }}>Sin elementos en esta cola</p>
            ) : (
              items.map((item) => (
                <button key={item.id} onClick={() => { setSelected(item); setNotes(''); }} style={{
                  width: '100%', textAlign: 'left', display: 'flex', gap: 10, padding: 10, marginBottom: 6,
                  background: selected?.id === item.id ? 'rgba(59,130,246,0.12)' : C.card,
                  border:     `1px solid ${selected?.id === item.id ? C.accent2 : C.border}`,
                  cursor: 'pointer',
                }}>
                  <div style={{ width: 44, height: 44, background: C.border, overflow: 'hidden', flexShrink: 0 }}>
                    {item.posts?.image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={(item as QueueItem).posts?.edited_image_url ?? item.posts.image_url ?? ''} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.brands?.name ?? 'Cliente'}
                    </div>
                    <div style={{ fontSize: 11, color: C.muted }}>✏️ Pendiente de revisar</div>
                    <div style={{ fontSize: 10, color: waitingColor(item.created_at), marginTop: 2 }}>
                      ⏱ {timeAgo(item.created_at)}
                      {item.priority === 'urgent' && (
                        <span style={{ marginLeft: 4, background: C.red, color: '#fff', fontSize: 9, padding: '1px 4px' }}>URGENTE</span>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right panel */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
          {!selected ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <p style={{ color: C.muted, fontSize: 14 }}>Selecciona un elemento de la lista</p>
            </div>
          ) : (
            <div style={{ maxWidth: 700 }}>
              {/* Header */}
              <div style={{ background: C.card, border: `1px solid ${C.border}`, padding: 20, marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: C.text }}>{selected.brands?.name ?? 'Cliente'}</div>
                    <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>
                      Contenido pendiente de validación · {timeAgo(selected.created_at)}
                      {' · '}<span style={{ textTransform: 'capitalize', color: selected.priority === 'urgent' ? C.red : C.muted }}>{selected.priority}</span>
                    </div>
                    {(selected as QueueItem).posts?.client_notes_for_worker && (
                      <div style={{ marginTop: 12, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', padding: '10px 14px' }}>
                        <div style={{ fontSize: 11, color: C.accent2, fontWeight: 700, marginBottom: 4 }}>NOTA DEL CLIENTE</div>
                        <div style={{ fontSize: 13, color: C.text, fontStyle: 'italic' }}>"{(selected as QueueItem).posts!.client_notes_for_worker}"</div>
                      </div>
                    )}
                  </div>
                  {selected.priority !== 'urgent' && (
                    <button onClick={() => handleAction('urgent')} style={{ fontSize: 12, padding: '6px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: C.red, cursor: 'pointer' }}>
                      🚩 Urgente
                    </button>
                  )}
                </div>
              </div>

              {/* Images */}
              {(selected as QueueItem).posts?.image_url && (
                <div style={{ background: C.card, border: `1px solid ${C.border}`, padding: 20, marginBottom: 20 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 14, color: C.muted }}>IMAGEN</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>Original</div>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={(selected as QueueItem).posts!.image_url!} alt="original" style={{ width: '100%', objectFit: 'cover', maxHeight: 280 }} />
                    </div>
                    {(selected as QueueItem).posts?.edited_image_url && (
                      <div>
                        <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>Editada</div>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={(selected as QueueItem).posts!.edited_image_url!} alt="edited" style={{ width: '100%', objectFit: 'cover', maxHeight: 280 }} />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Caption */}
              <div style={{ background: C.card, border: `1px solid ${C.border}`, padding: 20, marginBottom: 20 }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: C.muted }}>CAPTION Y HASHTAGS</h3>
                <div style={{ fontSize: 13, color: C.text, lineHeight: 1.6, whiteSpace: 'pre-wrap', padding: '12px 14px', background: C.bg1, border: `1px solid ${C.border}` }}>
                  {(selected as QueueItem).posts?.caption ?? '—'}
                </div>
                {(selected as QueueItem).posts?.hashtags?.length ? (
                  <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {(selected as QueueItem).posts!.hashtags.map((h) => (
                      <span key={h} style={{ fontSize: 12, padding: '3px 8px', background: 'rgba(59,130,246,0.1)', color: C.accent2 }}>#{h}</span>
                    ))}
                  </div>
                ) : null}
              </div>

              {/* Quality score */}
              {score !== null && (
                <div style={{ background: C.card, border: `1px solid ${C.border}`, padding: 20, marginBottom: 20 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: C.muted }}>SCORE DE CALIDAD</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ flex: 1, background: C.border, height: 8, overflow: 'hidden' }}>
                      <div style={{ width: `${score}%`, background: scoreColor, height: '100%', transition: 'width 0.5s' }} />
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: scoreColor }}>{score}/100</div>
                    <div style={{ fontSize: 12, color: C.muted }}>{scoreLabel}</div>
                  </div>
                </div>
              )}

              {/* AI Brand-kit Review */}
              {(selected as QueueItem).ai_review && (() => {
                const rev      = (selected as QueueItem).ai_review!;
                const revColor = rev.score >= 7 ? '#10b981' : rev.score >= 5 ? '#f59e0b' : '#ef4444';
                const recColor = rev.recommendation === 'approve' ? '#10b981' : rev.recommendation === 'review' ? '#f59e0b' : '#ef4444';
                const recLabel = rev.recommendation === 'approve' ? 'Aprobar' : rev.recommendation === 'review' ? 'Revisar' : 'Regenerar';
                return (
                  <div style={{ background: C.card, border: `1px solid ${C.border}`, padding: 20, marginBottom: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                      <h3 style={{ fontSize: 13, fontWeight: 700, color: C.muted, margin: 0 }}>ANÁLISIS IA — BRAND KIT</h3>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', background: `${recColor}18`, color: recColor, border: `1px solid ${recColor}40` }}>
                        {recLabel}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                      <div style={{ flex: 1, background: C.border, height: 8, overflow: 'hidden' }}>
                        <div style={{ width: `${rev.score * 10}%`, background: revColor, height: '100%', transition: 'width 0.5s' }} />
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: revColor, minWidth: 36 }}>{rev.score}/10</div>
                    </div>
                    <div style={{ display: 'flex', gap: 16, marginBottom: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.text }}>
                        <span style={{ fontSize: 14 }}>{rev.matches_brief ? '✅' : '❌'}</span> Coincide con el brief
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.text }}>
                        <span style={{ fontSize: 14 }}>{rev.matches_brand ? '✅' : '❌'}</span> Coincide con brand kit
                      </div>
                    </div>
                    {rev.issues.length > 0 && (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, marginBottom: 6 }}>PROBLEMAS DETECTADOS</div>
                        <ul style={{ margin: 0, paddingLeft: 18 }}>
                          {rev.issues.map((issue, i) => (
                            <li key={i} style={{ fontSize: 12, color: '#ef4444', marginBottom: 3 }}>{issue}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <div style={{ fontSize: 12, color: C.text, lineHeight: 1.5, fontStyle: 'italic', background: C.bg1, padding: '10px 12px', borderLeft: `3px solid ${revColor}` }}>
                      {rev.summary}
                    </div>
                  </div>
                );
              })()}

              {/* Worker notes */}
              <div style={{ background: C.card, border: `1px solid ${C.border}`, padding: 20, marginBottom: 20 }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: C.muted }}>NOTA PARA EL CLIENTE (opcional)</h3>
                <textarea
                  value={workerNotes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="El cliente verá esta nota junto al resultado..."
                  rows={3}
                  style={{ width: '100%', background: C.bg1, border: `1px solid ${C.border}`, padding: '10px 12px', color: C.text, fontSize: 13, resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={() => handleAction('approve')} disabled={loading} style={{ flex: 1, padding: '14px', fontSize: 14, fontWeight: 700, background: C.green, color: '#fff', border: 'none', cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>
                  ✅ Aprobar — Enviar al cliente
                </button>
                <button onClick={() => setShowReject(true)} style={{ flex: 1, padding: '14px', fontSize: 14, fontWeight: 700, background: 'rgba(239,68,68,0.1)', color: C.red, border: '1px solid rgba(239,68,68,0.3)', cursor: 'pointer' }}>
                  ❌ Rechazar
                </button>
              </div>

              {showReject && (
                <div style={{ marginTop: 16, background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', padding: 20 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 700, color: C.red, marginBottom: 12 }}>Motivo del rechazo</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                    {['Calidad de imagen insuficiente', 'No encaja con el estilo de la marca', 'Pedir al cliente nueva foto', 'Otro motivo'].map((reason) => (
                      <label key={reason} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: C.text }}>
                        <input type="radio" name="reject" value={reason} checked={rejectReason === reason} onChange={() => setRejectReason(reason)} />
                        {reason}
                      </label>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={() => { setNotes(rejectReason ? `Rechazado: ${rejectReason}` : workerNotes); handleAction('reject'); }} disabled={loading || !rejectReason} style={{ flex: 1, padding: '10px', background: C.red, color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, opacity: rejectReason ? 1 : 0.5 }}>
                      Confirmar rechazo
                    </button>
                    <button onClick={() => setShowReject(false)} style={{ padding: '10px 16px', background: 'transparent', border: `1px solid ${C.border}`, color: C.muted, cursor: 'pointer', fontSize: 13 }}>
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Solicitudes de recreación */}
      {pendingRecs.length > 0 && (
        <div style={{ borderTop: `1px solid ${C.border}`, padding: '24px 32px', background: C.bg }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: C.text, margin: 0 }}>Solicitudes de recreación</h2>
            <span style={{ background: C.accent2, color: '#fff', fontSize: 11, fontWeight: 800, padding: '2px 8px' }}>{pendingRecs.length}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pendingRecs.map((rec) => (
              <div key={rec.id} style={{ background: C.card, border: `1px solid ${C.border}`, padding: '14px 18px', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div style={{ width: 52, height: 52, background: C.border, overflow: 'hidden', flexShrink: 0 }}>
                  {rec.inspiration_references?.thumbnail_url
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={rec.inspiration_references.thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🖼</div>
                  }
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{rec.brands?.name ?? 'Cliente'}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', color: statusBadgeColor(rec.status), background: `${statusBadgeColor(rec.status)}18`, border: `1px solid ${statusBadgeColor(rec.status)}40` }}>
                      {statusLabel(rec.status)}
                    </span>
                  </div>
                  {rec.inspiration_references?.title && <div style={{ fontSize: 12, color: C.muted, marginBottom: 3 }}>Referencia: {rec.inspiration_references.title}</div>}
                  {rec.client_notes && <div style={{ fontSize: 12, color: C.text, fontStyle: 'italic' }}>"{rec.client_notes}"</div>}
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center' }}>
                  {rec.inspiration_references?.source_url && (
                    <a href={rec.inspiration_references.source_url} target="_blank" rel="noreferrer"
                      style={{ padding: '6px 12px', background: 'transparent', border: `1px solid ${C.border}`, color: C.muted, fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
                      Ver referencia ↗
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
