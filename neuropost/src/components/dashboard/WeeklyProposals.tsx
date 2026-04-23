'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, X, Pencil, ChevronRight, Sparkles, Clock } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import toast from 'react-hot-toast';

const f = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

interface Proposal {
  id: string;
  caption: string;
  image_url: string | null;
  format: string;
  status: string;
  quality_score: number | null;
  created_at: string;
  ai_explanation: string | null;
}

/** A proposal counts as "from the team" only if its ai_explanation marker says so. */
function isWorkerProposal(p: Proposal): boolean {
  if (!p.ai_explanation) return false;
  try {
    const parsed = JSON.parse(p.ai_explanation);
    return parsed?.from_worker === true;
  } catch {
    return false;
  }
}

export function WeeklyProposals({ proposals: rawProposals }: { proposals: Proposal[] }) {
  const router = useRouter();
  const updatePostStatus = useAppStore((s) => s.updatePostStatus);
  const [acting, setActing] = useState<string | null>(null);

  // Only show proposals the team (worker) has actually sent.
  const proposals = rawProposals.filter(isWorkerProposal);

  const pending = proposals.filter(p => p.status === 'generated' || p.status === 'pending');
  const approved = proposals.filter(p => p.status === 'approved' || p.status === 'scheduled');

  async function handleAction(id: string, action: 'approve' | 'reject') {
    setActing(id);
    try {
      const newStatus = action === 'approve' ? 'approved' : 'cancelled';
      const res = await fetch(`/api/posts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        updatePostStatus(id, newStatus);
        toast.success(action === 'approve' ? 'Propuesta aprobada' : 'Propuesta descartada');
      }
    } catch { toast.error('Error al actualizar'); }
    setActing(null);
  }

  if (proposals.length === 0) {
    return (
      <div style={{
        border: '1px solid var(--border)', padding: '40px 24px',
        textAlign: 'center', marginBottom: 48,
      }}>
        <p style={{
          fontFamily: fc, fontWeight: 900, fontSize: 18,
          textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: 6,
        }}>
          Propuestas en camino
        </p>
        <p style={{ fontFamily: f, fontSize: 13, color: 'var(--text-tertiary)', maxWidth: 400, margin: '0 auto' }}>
          Cada semana generamos contenido adaptado a tu negocio y tendencias actuales. Las propuestas aparecerán aquí.
        </p>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 48 }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 16,
      }}>
        <div>
          <h2 style={{
            fontFamily: f, fontSize: 10, fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: '0.14em',
            color: 'var(--accent)', margin: 0,
            paddingBottom: 8, borderBottom: '1px solid var(--accent-soft)',
          }}>
            Propuestas de esta semana
          </h2>
        </div>
        {pending.length > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '4px 10px', background: 'var(--accent-soft)',
          }}>
            <Clock size={11} style={{ color: 'var(--accent)' }} />
            <span style={{ fontFamily: f, fontSize: 11, fontWeight: 600, color: 'var(--accent)' }}>
              {pending.length} pendiente{pending.length > 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>

      {/* Proposals grid */}
      <div className="dashboard-weekly-proposals-grid" style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: '1px', background: 'var(--border)', border: '1px solid var(--border)',
      }}>
        {proposals.map((p) => {
          const isPending = p.status === 'generated' || p.status === 'pending';
          const isApproved = p.status === 'approved' || p.status === 'scheduled';
          return (
            <div key={p.id} style={{
              background: 'var(--bg)', padding: 0,
              display: 'flex', flexDirection: 'column',
              opacity: acting === p.id ? 0.5 : 1,
              transition: 'opacity 0.15s',
            }}>
              {/* Image */}
              {p.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.image_url} alt="" style={{
                  width: '100%', height: 180, objectFit: 'cover',
                }} />
              ) : (
                <div style={{
                  width: '100%', height: 180, background: 'var(--bg-1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--text-tertiary)', fontSize: 32,
                }}>
                  <Sparkles size={32} />
                </div>
              )}

              {/* Content */}
              <div style={{ padding: '16px 16px 12px', flex: 1 }}>
                <p style={{
                  fontFamily: f, fontSize: 13, color: 'var(--text-primary)',
                  lineHeight: 1.5, marginBottom: 8,
                  display: '-webkit-box', WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical', overflow: 'hidden',
                }}>
                  {p.caption || 'Contenido pendiente de generar'}
                </p>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <span style={{
                    fontFamily: f, fontSize: 10, fontWeight: 600,
                    textTransform: 'uppercase', letterSpacing: '0.1em',
                    padding: '2px 8px',
                    background: isPending ? 'var(--warning-soft, #fef3c7)' : isApproved ? 'var(--success-soft, #d1fae5)' : 'var(--bg-1)',
                    color: isPending ? 'var(--warning, #d97706)' : isApproved ? 'var(--success, #059669)' : 'var(--text-tertiary)',
                  }}>
                    {isPending ? 'Pendiente' : isApproved ? 'Aprobado' : p.status}
                  </span>
                  <span style={{ fontFamily: f, fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                    {p.format}
                  </span>
                  {p.quality_score != null && (
                    <span style={{
                      fontFamily: f, fontSize: 11, fontWeight: 500,
                      color: p.quality_score >= 8 ? 'var(--success)' : p.quality_score >= 6 ? 'var(--warning)' : 'var(--error)',
                    }}>
                      {p.quality_score}/10
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              {isPending ? (
                <div className="dashboard-proposal-actions" style={{
                  display: 'flex', gap: 0, borderTop: '1px solid var(--border)',
                }}>
                  <button
                    onClick={() => handleAction(p.id, 'approve')}
                    disabled={!!acting}
                    style={{
                      flex: 1, padding: '10px', background: 'none', border: 'none',
                      borderRight: '1px solid var(--border)',
                      cursor: 'pointer', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', gap: 6,
                      fontFamily: f, fontSize: 12, fontWeight: 600,
                      color: 'var(--success, #059669)',
                      transition: 'background 0.15s',
                    }}
                  >
                    <Check size={14} /> Aprobar
                  </button>
                  <button
                    onClick={() => router.push(`/posts/${p.id}`)}
                    style={{
                      flex: 1, padding: '10px', background: 'none', border: 'none',
                      borderRight: '1px solid var(--border)',
                      cursor: 'pointer', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', gap: 6,
                      fontFamily: f, fontSize: 12, fontWeight: 600,
                      color: 'var(--text-secondary)',
                      transition: 'background 0.15s',
                    }}
                  >
                    <Pencil size={13} /> Editar
                  </button>
                  <button
                    onClick={() => handleAction(p.id, 'reject')}
                    disabled={!!acting}
                    style={{
                      flex: 1, padding: '10px', background: 'none', border: 'none',
                      cursor: 'pointer', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', gap: 6,
                      fontFamily: f, fontSize: 12, fontWeight: 600,
                      color: 'var(--error, #dc2626)',
                      transition: 'background 0.15s',
                    }}
                  >
                    <X size={14} /> Descartar
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => router.push(`/posts/${p.id}`)}
                  style={{
                    padding: '10px', background: 'none', border: 'none',
                    borderTop: '1px solid var(--border)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', gap: 6,
                    fontFamily: f, fontSize: 12, fontWeight: 600,
                    color: 'var(--text-secondary)',
                    transition: 'background 0.15s',
                  }}
                >
                  Ver detalle <ChevronRight size={13} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary bar */}
      {approved.length > 0 && (
        <div style={{
          marginTop: 1, padding: '12px 16px',
          border: '1px solid var(--border)', borderTop: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--bg)',
        }}>
          <span style={{ fontFamily: f, fontSize: 12, color: 'var(--text-secondary)' }}>
            {approved.length} propuesta{approved.length > 1 ? 's' : ''} aprobada{approved.length > 1 ? 's' : ''} esta semana
          </span>
          <button
            onClick={() => router.push('/calendar')}
            style={{
              fontFamily: fc, fontSize: 11, fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.08em',
              color: 'var(--accent)', background: 'none', border: 'none',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            Ver calendario <ChevronRight size={12} />
          </button>
        </div>
      )}
    </div>
  );
}
