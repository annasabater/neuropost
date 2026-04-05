'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import type { ContentQueue } from '@/types';

const W = { bg: '#0a0a14', card: '#111827', border: '#1e2533', blue: '#3b82f6', text: '#e5e7eb', muted: '#6b7280' };

type QueueItem = ContentQueue & {
  posts?: { image_url: string | null; edited_image_url: string | null; caption: string | null; hashtags: string[]; format: string; platform: string[]; quality_score: number | null; client_notes_for_worker: string | null };
  brands?: { id: string; name: string; sector: string };
};

type RecreationRequest = {
  id: string;
  brand_id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'rejected';
  client_notes: string | null;
  worker_notes: string | null;
  created_at: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  inspiration_references: any | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  brands: any | null;
};

function timeAgo(d: string) {
  const min = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (min < 1) return 'ahora';
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function waitColor(d: string) {
  const h = (Date.now() - new Date(d).getTime()) / 3600000;
  return h < 1 ? '#22c55e' : h < 3 ? '#f59e0b' : '#ef4444';
}

const STATUS_FILTERS = [
  { value: '',                label: 'Todos' },
  { value: 'pending_worker',  label: 'Pendientes' },
  { value: 'worker_rejected', label: 'Rechazados' },
  { value: 'client_rejected', label: 'Rechazados por cliente' },
];

export default function ColaPage() {
  const searchParams = useSearchParams();
  const initialId    = searchParams.get('id');

  const [items, setItems]         = useState<QueueItem[]>([]);
  const [selected, setSelected]   = useState<QueueItem | null>(null);
  const [statusFilter, setStatus] = useState('pending_worker');
  const [workerNotes, setNotes]   = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject]     = useState(false);
  const [loading, setLoading]     = useState(false);

  const [recreations, setRecreations] = useState<RecreationRequest[]>([]);

  useEffect(() => {
    fetch('/api/worker/recreaciones')
      .then((r) => r.json())
      .then((d) => setRecreations(d.recreations ?? []))
      .catch(() => null);
  }, []);

  async function handleRecreationAction(id: string, status: 'in_progress' | 'completed') {
    try {
      const res  = await fetch(`/api/worker/recreaciones/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Error'); return; }
      setRecreations((prev) => prev.map((r) => r.id === id ? data.recreation : r));
      toast.success(status === 'in_progress' ? 'Tarea aceptada' : 'Marcado como completado');
    } catch {
      toast.error('Error de red');
    }
  }

  const fetchQueue = useCallback(async () => {
    const url = statusFilter ? `/api/worker/cola?status=${statusFilter}` : '/api/worker/cola';
    const res = await fetch(url);
    const json = await res.json();
    const q = json.queue ?? [];
    setItems(q);
    if (initialId && !selected) {
      const found = q.find((i: QueueItem) => i.id === initialId);
      if (found) { setSelected(found); setNotes(found.worker_notes ?? ''); }
    }
  }, [statusFilter, initialId, selected]);

  useEffect(() => { fetchQueue(); }, [fetchQueue]);

  async function handleAction(action: 'approve' | 'reject' | 'urgent') {
    if (!selected) return;
    setLoading(true);
    try {
      let newStatus = '';
      if (action === 'approve') newStatus = 'sent_to_client';
      if (action === 'reject')  newStatus = 'worker_rejected';

      if (action === 'urgent') {
        await fetch('/api/worker/cola', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ queueId: selected.id, status: selected.status, priority: 'urgent' }) });
        toast.success('Marcado como urgente');
        setItems((prev) => prev.map((i) => i.id === selected.id ? { ...i, priority: 'urgent' } : i));
        setSelected((s) => s ? { ...s, priority: 'urgent' } : s);
        setLoading(false);
        return;
      }

      await fetch('/api/worker/cola', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queueId: selected.id, status: newStatus, worker_notes: workerNotes }),
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

  const score = selected?.posts?.quality_score ?? null;
  const scoreColor = score == null ? W.muted : score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444';
  const scoreLabel = score == null ? '—' : score >= 80 ? 'Muy bueno' : score >= 60 ? 'Aceptable' : 'Mejorable';

  const pendingRecs    = recreations.filter((r) => r.status === 'pending' || r.status === 'in_progress');
  const statusBadgeColor = (s: RecreationRequest['status']) =>
    s === 'pending' ? '#f59e0b' : s === 'in_progress' ? W.blue : s === 'completed' ? '#22c55e' : '#ef4444';
  const statusLabel = (s: RecreationRequest['status']) =>
    s === 'pending' ? 'Pendiente' : s === 'in_progress' ? 'En progreso' : s === 'completed' ? 'Completado' : 'Rechazado';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', overflow: 'hidden' }}>
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      {/* Left column */}
      <div style={{ width: 320, borderRight: `1px solid ${W.border}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Filters */}
        <div style={{ padding: '20px 16px 12px', borderBottom: `1px solid ${W.border}` }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: W.text, marginBottom: 12 }}>Cola de validación</h2>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {STATUS_FILTERS.map((f) => (
              <button key={f.value} onClick={() => setStatus(f.value)} style={{
                padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                background: statusFilter === f.value ? W.blue : 'transparent',
                color: statusFilter === f.value ? '#fff' : W.muted,
                border: `1px solid ${statusFilter === f.value ? W.blue : W.border}`,
              }}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px' }}>
          {items.length === 0 ? (
            <p style={{ color: W.muted, fontSize: 13, textAlign: 'center', padding: '40px 0' }}>Sin elementos en esta cola</p>
          ) : (
            items.map((item) => (
              <button key={item.id} onClick={() => { setSelected(item); setNotes(item.worker_notes ?? ''); }} style={{
                width: '100%', textAlign: 'left', display: 'flex', gap: 10, padding: 10, borderRadius: 8, marginBottom: 6,
                background: selected?.id === item.id ? 'rgba(59,130,246,0.12)' : W.card,
                border: `1px solid ${selected?.id === item.id ? W.blue : W.border}`,
                cursor: 'pointer',
              }}>
                <div style={{ width: 44, height: 44, borderRadius: 6, background: W.border, overflow: 'hidden', flexShrink: 0 }}>
                  {item.posts?.image_url && <img src={item.posts.edited_image_url ?? item.posts.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: W.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.brands?.name ?? 'Cliente'}
                  </div>
                  <div style={{ fontSize: 11, color: W.muted }}>{item.type === 'edit_request' ? '✏️ Edición' : '🤖 Propuesta IA'}</div>
                  <div style={{ fontSize: 10, color: waitColor(item.created_at), marginTop: 2 }}>
                    ⏱ {timeAgo(item.created_at)}
                    {item.priority === 'urgent' && <span style={{ marginLeft: 4, background: '#ef4444', color: '#fff', fontSize: 9, padding: '1px 4px', borderRadius: 3 }}>URGENTE</span>}
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
            <p style={{ color: W.muted, fontSize: 14 }}>Selecciona un elemento de la lista</p>
          </div>
        ) : (
          <div style={{ maxWidth: 700 }}>
            {/* Header */}
            <div style={{ background: W.card, border: `1px solid ${W.border}`, borderRadius: 12, padding: 20, marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: W.text }}>
                    {selected.brands?.name ?? 'Cliente'}
                  </div>
                  <div style={{ fontSize: 13, color: W.muted, marginTop: 4 }}>
                    {selected.type === 'edit_request' ? 'Edición solicitada por el cliente' : 'Propuesta del equipo IA'}
                    {' · '}{timeAgo(selected.created_at)}
                    {' · '}<span style={{ textTransform: 'capitalize', color: selected.priority === 'urgent' ? '#ef4444' : W.muted }}>{selected.priority}</span>
                  </div>
                  {selected.posts?.client_notes_for_worker && (
                    <div style={{ marginTop: 12, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, padding: '10px 14px' }}>
                      <div style={{ fontSize: 11, color: W.blue, fontWeight: 700, marginBottom: 4 }}>NOTA DEL CLIENTE</div>
                      <div style={{ fontSize: 13, color: W.text, fontStyle: 'italic' }}>"{selected.posts.client_notes_for_worker}"</div>
                    </div>
                  )}
                </div>
                {selected.priority !== 'urgent' && (
                  <button onClick={() => handleAction('urgent')} style={{ fontSize: 12, padding: '6px 12px', borderRadius: 6, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', cursor: 'pointer' }}>
                    🚩 Urgente
                  </button>
                )}
              </div>
            </div>

            {/* Images */}
            {selected.posts?.image_url && (
              <div style={{ background: W.card, border: `1px solid ${W.border}`, borderRadius: 12, padding: 20, marginBottom: 20 }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 14, color: W.muted }}>IMAGEN</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 11, color: W.muted, marginBottom: 6 }}>Original</div>
                    <img src={selected.posts.image_url} alt="original" style={{ width: '100%', borderRadius: 8, objectFit: 'cover', maxHeight: 280 }} />
                  </div>
                  {selected.posts.edited_image_url && (
                    <div>
                      <div style={{ fontSize: 11, color: W.muted, marginBottom: 6 }}>Editada</div>
                      <img src={selected.posts.edited_image_url} alt="edited" style={{ width: '100%', borderRadius: 8, objectFit: 'cover', maxHeight: 280 }} />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Caption */}
            <div style={{ background: W.card, border: `1px solid ${W.border}`, borderRadius: 12, padding: 20, marginBottom: 20 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: W.muted }}>CAPTION Y HASHTAGS</h3>
              <div style={{ fontSize: 13, color: W.text, lineHeight: 1.6, whiteSpace: 'pre-wrap', padding: '12px 14px', background: '#0f172a', borderRadius: 8, border: `1px solid ${W.border}` }}>
                {selected.posts?.caption ?? '—'}
              </div>
              {selected.posts?.hashtags?.length ? (
                <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {selected.posts.hashtags.map((h) => (
                    <span key={h} style={{ fontSize: 12, padding: '3px 8px', background: 'rgba(59,130,246,0.1)', color: W.blue, borderRadius: 20 }}>#{h}</span>
                  ))}
                </div>
              ) : null}
            </div>

            {/* Quality score */}
            {score !== null && (
              <div style={{ background: W.card, border: `1px solid ${W.border}`, borderRadius: 12, padding: 20, marginBottom: 20 }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: W.muted }}>SCORE DE CALIDAD</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1, background: W.border, borderRadius: 99, height: 8, overflow: 'hidden' }}>
                    <div style={{ width: `${score}%`, background: scoreColor, height: '100%', borderRadius: 99, transition: 'width 0.5s' }} />
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: scoreColor }}>{score}/100</div>
                  <div style={{ fontSize: 12, color: W.muted }}>{scoreLabel}</div>
                </div>
              </div>
            )}

            {/* Worker notes */}
            <div style={{ background: W.card, border: `1px solid ${W.border}`, borderRadius: 12, padding: 20, marginBottom: 20 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: W.muted }}>NOTA PARA EL CLIENTE (opcional)</h3>
              <textarea
                value={workerNotes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="El cliente verá esta nota junto al resultado..."
                rows={3}
                style={{
                  width: '100%', background: '#0f172a', border: `1px solid ${W.border}`,
                  borderRadius: 8, padding: '10px 12px', color: W.text, fontSize: 13,
                  resize: 'vertical', outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => handleAction('approve')}
                disabled={loading}
                style={{
                  flex: 1, padding: '14px', borderRadius: 10, fontSize: 14, fontWeight: 700,
                  background: '#22c55e', color: '#fff', border: 'none', cursor: 'pointer',
                  opacity: loading ? 0.6 : 1,
                }}
              >
                ✅ Aprobar — Enviar al cliente
              </button>
              <button
                onClick={() => setShowReject(true)}
                style={{
                  flex: 1, padding: '14px', borderRadius: 10, fontSize: 14, fontWeight: 700,
                  background: 'rgba(239,68,68,0.1)', color: '#ef4444',
                  border: '1px solid rgba(239,68,68,0.3)', cursor: 'pointer',
                }}
              >
                ❌ Rechazar
              </button>
            </div>

            {/* Reject modal */}
            {showReject && (
              <div style={{ marginTop: 16, background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, padding: 20 }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: '#ef4444', marginBottom: 12 }}>Motivo del rechazo</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                  {['Calidad de imagen insuficiente', 'No encaja con el estilo de la marca', 'Pedir al cliente nueva foto', 'Otro motivo'].map((reason) => (
                    <label key={reason} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: W.text }}>
                      <input type="radio" name="reject" value={reason} checked={rejectReason === reason} onChange={() => setRejectReason(reason)} />
                      {reason}
                    </label>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => { setNotes(rejectReason ? `Rechazado: ${rejectReason}` : workerNotes); handleAction('reject'); }} disabled={loading || !rejectReason} style={{ flex: 1, padding: '10px', borderRadius: 8, background: '#ef4444', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, opacity: rejectReason ? 1 : 0.5 }}>
                    Confirmar rechazo
                  </button>
                  <button onClick={() => setShowReject(false)} style={{ padding: '10px 16px', borderRadius: 8, background: 'transparent', border: `1px solid ${W.border}`, color: W.muted, cursor: 'pointer', fontSize: 13 }}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>

    {/* ── Solicitudes de recreación ── */}
    {pendingRecs.length > 0 && (
      <div style={{ borderTop: `1px solid ${W.border}`, padding: '24px 32px', background: W.bg }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 800, color: W.text, margin: 0 }}>Solicitudes de recreación</h2>
          <span style={{ background: W.blue, color: '#fff', borderRadius: 20, fontSize: 11, fontWeight: 800, padding: '2px 8px' }}>
            {pendingRecs.length}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {pendingRecs.map((rec) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const ref = rec.inspiration_references as any;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const brand = rec.brands as any;
            return (
              <div
                key={rec.id}
                style={{ background: W.card, border: `1px solid ${W.border}`, borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'flex-start', gap: 14 }}
              >
                {/* Thumbnail */}
                <div style={{ width: 52, height: 52, borderRadius: 8, background: W.border, overflow: 'hidden', flexShrink: 0 }}>
                  {ref?.thumbnail_url
                    ? <img src={ref.thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🖼</div>
                  }
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: W.text }}>{brand?.name ?? 'Cliente'}</span>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                      color: statusBadgeColor(rec.status),
                      background: `${statusBadgeColor(rec.status)}18`,
                      border: `1px solid ${statusBadgeColor(rec.status)}40`,
                    }}>
                      {statusLabel(rec.status)}
                    </span>
                  </div>
                  {ref?.title && <div style={{ fontSize: 12, color: W.muted, marginBottom: 3 }}>Referencia: {ref.title}</div>}
                  {rec.client_notes && (
                    <div style={{ fontSize: 12, color: W.text, fontStyle: 'italic' }}>"{rec.client_notes}"</div>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center' }}>
                  {ref?.source_url && (
                    <a
                      href={ref.source_url}
                      target="_blank"
                      rel="noreferrer"
                      style={{ padding: '6px 12px', background: 'transparent', border: `1px solid ${W.border}`, borderRadius: 6, color: W.muted, fontSize: 12, fontWeight: 600, textDecoration: 'none', cursor: 'pointer' }}
                    >
                      Ver referencia ↗
                    </a>
                  )}
                  {rec.status === 'pending' && (
                    <button
                      onClick={() => handleRecreationAction(rec.id, 'in_progress')}
                      style={{ padding: '6px 14px', background: `${W.blue}18`, color: W.blue, border: `1px solid ${W.blue}40`, borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}
                    >
                      Aceptar tarea
                    </button>
                  )}
                  {rec.status === 'in_progress' && (
                    <button
                      onClick={() => handleRecreationAction(rec.id, 'completed')}
                      style={{ padding: '6px 14px', background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}
                    >
                      Marcar completado
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    )}
    </div>
  );
}
