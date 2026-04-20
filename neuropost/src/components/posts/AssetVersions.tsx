'use client';

import { useState, useEffect } from 'react';
import { Check, X, RefreshCw, ChevronLeft, ChevronRight, Sparkles, Edit2, Trash2 } from 'lucide-react';
import type { GeneratedAsset } from '@/types';
import toast from 'react-hot-toast';

const f = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

interface Props {
  postId: string;
  currentImageUrl: string | null;
  onImageChange: (url: string) => void;
  onApprove?: () => void;             // called after approving — parent can move to pending
  onReject?: (action: 'delete' | 'edit') => void;  // called after rejecting — user chose delete or edit
}

export function AssetVersions({ postId, currentImageUrl, onImageChange, onApprove, onReject }: Props) {
  const [assets, setAssets] = useState<GeneratedAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIdx, setActiveIdx] = useState(0);
  const [acting, setActing] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [showRejectChoice, setShowRejectChoice] = useState(false);

  useEffect(() => {
    fetch(`/api/posts/${postId}/assets`)
      .then(r => r.json())
      .then(json => {
        const list = (json.assets ?? []) as GeneratedAsset[];
        setAssets(list);
        const currentIdx = list.findIndex(a => a.is_current);
        if (currentIdx >= 0) setActiveIdx(currentIdx);
      })
      .finally(() => setLoading(false));
  }, [postId]);

  if (loading) return null;
  if (assets.length === 0) return null;

  const active = assets[activeIdx];

  async function doAction(action: 'approve' | 'reject' | 'set_current') {
    if (!active) return;
    setActing(true);
    try {
      const res = await fetch(`/api/posts/${postId}/assets`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset_id: active.id,
          action,
          ...(action === 'reject' ? { rejection_reason: rejectReason } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error); return; }

      // Update local state
      setAssets(prev => prev.map(a => {
        if (action === 'approve' || action === 'set_current') {
          if (a.id === active.id) return { ...a, ...json.asset, is_current: true };
          return { ...a, is_current: false };
        }
        if (action === 'reject' && a.id === active.id) return { ...a, ...json.asset };
        return a;
      }));

      if (action === 'approve') {
        onImageChange(active.asset_url);
        toast.success('Versión aprobada — lista para programar');
        onApprove?.();
      } else if (action === 'reject') {
        toast.success('Versión rechazada');
        setShowReject(false);
        setRejectReason('');
        setShowRejectChoice(true);
      } else {
        onImageChange(active.asset_url);
        toast.success('Versión seleccionada');
      }
    } catch { toast.error('Error'); }
    finally { setActing(false); }
  }

  const statusColor = (s: string) => {
    switch (s) {
      case 'approved': return 'var(--accent)';
      case 'rejected': return 'var(--error)';
      case 'published': return 'var(--accent)';
      default: return 'var(--text-tertiary)';
    }
  };
  const statusLabel = (s: string) => {
    switch (s) {
      case 'generated': return 'Propuesta';
      case 'approved': return 'Aprobada';
      case 'rejected': return 'Rechazada';
      case 'published': return 'Publicada';
      default: return s;
    }
  };

  return (
    <div style={{ marginBottom: 20 }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 20px', background: '#111827',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sparkles size={14} style={{ color: 'var(--accent)' }} />
          <span style={{ fontFamily: fc, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#ffffff' }}>
            Versiones generadas
          </span>
        </div>
        <span style={{ fontFamily: f, fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
          {assets.length} versión{assets.length > 1 ? 'es' : ''}
        </span>
      </div>

      {/* Version strip */}
      <div style={{ display: 'flex', gap: '1px', background: 'var(--border)', border: '1px solid var(--border)', borderTop: 'none' }}>
        {assets.map((a, i) => (
          <button key={a.id} onClick={() => setActiveIdx(i)} style={{
            position: 'relative', width: 72, height: 72, flexShrink: 0,
            padding: 0, border: 'none', cursor: 'pointer',
            outline: i === activeIdx ? '2px solid var(--accent)' : 'none',
            outlineOffset: -2, background: '#000',
          }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={a.asset_url} alt="" style={{
              width: '100%', height: '100%', objectFit: 'cover', display: 'block',
              opacity: a.status === 'rejected' ? 0.3 : i === activeIdx ? 1 : 0.6,
            }} />
            {/* Version number */}
            <div style={{
              position: 'absolute', bottom: 2, left: 2,
              background: i === activeIdx ? 'var(--accent)' : '#111827',
              color: '#ffffff', fontFamily: fc, fontSize: 9, fontWeight: 700,
              width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              v{a.version}
            </div>
            {/* Status indicator */}
            {a.status !== 'generated' && (
              <div style={{
                position: 'absolute', top: 2, right: 2, width: 8, height: 8,
                background: statusColor(a.status),
              }} />
            )}
            {a.is_current && (
              <div style={{
                position: 'absolute', top: 2, left: 2, width: 8, height: 8,
                background: 'var(--accent)',
              }} />
            )}
          </button>
        ))}
      </div>

      {/* Active version detail */}
      {active && (
        <div style={{ border: '1px solid var(--border)', borderTop: 'none' }}>
          {/* Image comparison area */}
          <div style={{ display: 'grid', gridTemplateColumns: active.is_current || !currentImageUrl ? '1fr' : '1fr 1fr', gap: '1px', background: 'var(--border)' }}>
            <div style={{ background: '#000', position: 'relative' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={active.asset_url} alt="" style={{ width: '100%', maxHeight: 400, objectFit: 'contain', display: 'block' }} />
              <div style={{
                position: 'absolute', top: 10, left: 10, padding: '4px 10px',
                background: 'rgba(0,0,0,0.7)',
                fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
                letterSpacing: '0.08em', color: '#ffffff',
              }}>
                v{active.version} — {statusLabel(active.status)}
              </div>
            </div>
            {/* Show current for comparison if viewing a different version */}
            {!active.is_current && currentImageUrl && currentImageUrl !== active.asset_url && (
              <div style={{ background: '#000', position: 'relative' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={currentImageUrl} alt="" style={{ width: '100%', maxHeight: 400, objectFit: 'contain', display: 'block' }} />
                <div style={{
                  position: 'absolute', top: 10, left: 10, padding: '4px 10px',
                  background: 'var(--accent)',
                  fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
                  letterSpacing: '0.08em', color: '#ffffff',
                }}>
                  Actual
                </div>
              </div>
            )}
          </div>

          {/* Metadata */}
          <div style={{ padding: '12px 16px', display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{
              fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
              letterSpacing: '0.08em', padding: '3px 8px',
              background: active.status === 'approved' ? 'var(--accent)' : active.status === 'rejected' ? 'var(--error)' : 'var(--bg-1)',
              color: active.status === 'generated' ? 'var(--text-tertiary)' : '#ffffff',
              border: `1px solid ${statusColor(active.status)}`,
            }}>
              {statusLabel(active.status)}
            </span>
            {active.model && (
              <span style={{ fontFamily: f, fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {active.model}
              </span>
            )}
            {active.quality_score != null && (
              <span style={{ fontFamily: f, fontSize: 11, fontWeight: 500, color: active.quality_score >= 8 ? 'var(--accent)' : active.quality_score >= 6 ? 'var(--warning)' : 'var(--error)' }}>
                {active.quality_score}/10
              </span>
            )}
            <span style={{ fontFamily: f, fontSize: 10, color: 'var(--text-tertiary)' }}>
              {new Date(active.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          {/* Prompt */}
          {active.prompt && (
            <div style={{ padding: '0 16px 12px' }}>
              <p style={{ fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 4 }}>
                Prompt
              </p>
              <p style={{ fontFamily: f, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {active.prompt}
              </p>
            </div>
          )}

          {/* Rejection reason */}
          {active.status === 'rejected' && active.rejection_reason && (
            <div style={{ padding: '0 16px 12px' }}>
              <p style={{ fontFamily: f, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--error)', marginBottom: 4 }}>
                Motivo del rechazo
              </p>
              <p style={{ fontFamily: f, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {active.rejection_reason}
              </p>
            </div>
          )}

          {/* Actions */}
          {active.status === 'generated' && (
            <div style={{ display: 'flex', gap: '1px', background: 'var(--border)', borderTop: '1px solid var(--border)' }}>
              <button onClick={() => doAction('approve')} disabled={acting} style={{
                flex: 1, padding: '12px', background: 'var(--bg)', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                fontFamily: f, fontSize: 12, fontWeight: 600, color: 'var(--accent)',
                transition: 'background 0.15s',
              }}>
                <Check size={14} /> Aprobar esta versión
              </button>
              <button onClick={() => setShowReject(!showReject)} disabled={acting} style={{
                flex: 1, padding: '12px', background: 'var(--bg)', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                fontFamily: f, fontSize: 12, fontWeight: 600, color: 'var(--error)',
                transition: 'background 0.15s',
              }}>
                <X size={14} /> Rechazar
              </button>
            </div>
          )}

          {/* Reject reason form */}
          {showReject && (
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="Qué no te gusta? (opcional)"
                rows={2}
                style={{
                  width: '100%', padding: '10px 12px', border: '1px solid var(--border)',
                  fontFamily: f, fontSize: 13, color: 'var(--text-primary)', outline: 'none',
                  resize: 'vertical', boxSizing: 'border-box', marginBottom: 8,
                }}
              />
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => doAction('reject')} disabled={acting} style={{
                  padding: '8px 16px', background: 'var(--error)', color: '#ffffff', border: 'none',
                  fontFamily: fc, fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.06em', cursor: 'pointer',
                }}>
                  Confirmar rechazo
                </button>
                <button onClick={() => { setShowReject(false); setRejectReason(''); }} style={{
                  padding: '8px 16px', background: 'var(--bg)', border: '1px solid var(--border)',
                  fontFamily: f, fontSize: 11, fontWeight: 600, cursor: 'pointer', color: 'var(--text-tertiary)',
                }}>
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Post-reject choice: delete or edit */}
          {showRejectChoice && (
            <div style={{ padding: '16px', borderTop: '1px solid var(--border)', background: 'var(--bg-1)' }}>
              <p style={{ fontFamily: f, fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>
                Propuesta rechazada. ¿Qué quieres hacer?
              </p>
              <div style={{ display: 'flex', gap: '1px', background: 'var(--border)', border: '1px solid var(--border)' }}>
                <button onClick={() => { setShowRejectChoice(false); onReject?.('edit'); }} style={{
                  flex: 1, padding: '12px', background: 'var(--bg)', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  fontFamily: f, fontSize: 12, fontWeight: 600, color: 'var(--text-primary)',
                }}>
                  <Edit2 size={13} /> Editar y regenerar
                </button>
                <button onClick={() => { setShowRejectChoice(false); onReject?.('delete'); }} style={{
                  flex: 1, padding: '12px', background: 'var(--bg)', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  fontFamily: f, fontSize: 12, fontWeight: 600, color: 'var(--error)',
                }}>
                  <Trash2 size={13} /> Eliminar post
                </button>
              </div>
            </div>
          )}

          {/* Use this version (if not current) */}
          {!active.is_current && active.status !== 'rejected' && (
            <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)' }}>
              <button onClick={() => doAction('set_current')} disabled={acting} style={{
                width: '100%', padding: '10px', background: '#111827', color: '#ffffff', border: 'none',
                fontFamily: fc, fontSize: 12, fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.06em', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
                <RefreshCw size={13} /> Usar esta versión
              </button>
            </div>
          )}

          {/* Navigation */}
          {assets.length > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 16px', borderTop: '1px solid var(--border)' }}>
              <button disabled={activeIdx >= assets.length - 1} onClick={() => setActiveIdx(activeIdx + 1)} style={{
                padding: '4px 10px', background: 'none', border: '1px solid var(--border)',
                cursor: activeIdx >= assets.length - 1 ? 'default' : 'pointer',
                color: activeIdx >= assets.length - 1 ? 'var(--border)' : 'var(--text-secondary)',
                fontFamily: f, fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <ChevronLeft size={12} /> Más antigua
              </button>
              <button disabled={activeIdx <= 0} onClick={() => setActiveIdx(activeIdx - 1)} style={{
                padding: '4px 10px', background: 'none', border: '1px solid var(--border)',
                cursor: activeIdx <= 0 ? 'default' : 'pointer',
                color: activeIdx <= 0 ? 'var(--border)' : 'var(--text-secondary)',
                fontFamily: f, fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4,
              }}>
                Más reciente <ChevronRight size={12} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
