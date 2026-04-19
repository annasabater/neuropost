'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter }                      from 'next/navigation';
import { Check, Edit2, RefreshCw, X, ArrowLeft }     from 'lucide-react';
import toast                                         from 'react-hot-toast';
import type { WeeklyPlan, ContentIdea }              from '@/types';

const C = {
  bg1: '#f5f5f5', card: '#ffffff', border: '#E5E7EB',
  text: '#111111', muted: '#6B7280', accent: '#0F766E',
  red: '#EF4444', amber: '#F59E0B', green: '#10B981',
};

type IdeaAction = 'approve' | 'edit' | 'request_variation' | 'reject';

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  pending:                    { label: 'Pendiente',         color: C.muted,  bg: '#f5f5f5' },
  client_approved:            { label: 'Aprobada',          color: C.green,  bg: '#f0fdf4' },
  client_edited:              { label: 'Editada',           color: '#3b82f6', bg: '#eff6ff' },
  client_requested_variation: { label: 'Variación pedida',  color: C.amber,  bg: '#fef3c7' },
  client_rejected:            { label: 'Rechazada',         color: C.red,    bg: '#fef2f2' },
};

export default function PlanReviewPage() {
  const { week_id } = useParams<{ week_id: string }>();
  const router = useRouter();

  const [plan, setPlan]     = useState<WeeklyPlan | null>(null);
  const [ideas, setIdeas]   = useState<ContentIdea[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [showSkipModal, setShowSkipModal] = useState(false);
  const [skipReason, setSkipReason] = useState('');
  const [skipping, setSkipping] = useState(false);
  const [actingOn, setActingOn] = useState<string | null>(null);

  const debounceRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const res  = await fetch(`/api/client/weekly-plans/${week_id}`);
    const data = await res.json() as { plan?: WeeklyPlan; ideas?: ContentIdea[]; error?: string };
    if (!res.ok || !data.plan) {
      toast.error(data.error ?? 'Plan no encontrado');
      router.push('/planificacion');
      return;
    }
    setPlan(data.plan);
    setIdeas(data.ideas ?? []);
    setLoading(false);
  }, [week_id, router]);

  useEffect(() => { load(); }, [load]);

  const reviewed  = ideas.filter((i) => i.status !== 'pending').length;
  const allReviewed = ideas.length > 0 && reviewed === ideas.length;

  async function doIdeaAction(ideaId: string, action: IdeaAction, extra?: {
    client_edited_copy?: string;
    client_edited_hashtags?: string[];
  }) {
    setActingOn(ideaId);
    const res = await fetch(`/api/client/weekly-plans/${week_id}/ideas/${ideaId}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ action, ...extra }),
    });
    const data = await res.json() as { idea?: ContentIdea; error?: string };
    setActingOn(null);
    if (!res.ok) { toast.error(data.error ?? 'Error'); return; }
    setIdeas((prev) => prev.map((i) => i.id === ideaId ? (data.idea ?? i) : i));
  }

  function scheduleEditSave(ideaId: string, copy: string) {
    clearTimeout(debounceRefs.current[ideaId]);
    debounceRefs.current[ideaId] = setTimeout(() => {
      void doIdeaAction(ideaId, 'edit', { client_edited_copy: copy });
    }, 1200);
  }

  async function handleConfirm() {
    setConfirming(true);
    const res  = await fetch(`/api/client/weekly-plans/${week_id}/confirm`, { method: 'POST' });
    const data = await res.json() as { ok?: boolean; ideas_in_production?: number; error?: string };
    setConfirming(false);
    if (!res.ok) { toast.error(data.error ?? 'Error al confirmar'); return; }
    toast.success(`Plan confirmado — ${data.ideas_in_production ?? 0} ideas en producción`);
    router.push('/planificacion');
  }

  async function handleSkip() {
    if (!skipReason.trim()) { toast.error('El motivo es obligatorio'); return; }
    setSkipping(true);
    const res = await fetch(`/api/client/weekly-plans/${week_id}/skip-week`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ reason: skipReason }),
    });
    setSkipping(false);
    if (!res.ok) { toast.error('Error al cancelar semana'); return; }
    toast.success('Semana cancelada');
    router.push('/planificacion');
  }

  if (loading) return <div style={{ padding: 40, color: C.muted }}>Cargando propuesta...</div>;
  if (!plan)   return null;

  return (
    <div style={{ padding: 28, maxWidth: 760, color: C.text }}>
      {/* Header */}
      <button onClick={() => router.push('/planificacion')} style={backBtn}>
        <ArrowLeft size={14} /> Mis planes
      </button>

      <div style={{ marginTop: 16, marginBottom: 8 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 6px' }}>
          Tu contenido de la semana del {formatWeek(plan.week_start)}
        </h1>
        <p style={{ color: C.muted, fontSize: 13, margin: '0 0 4px' }}>
          Revisa cada propuesta y dinos qué te cuadra. Cuando acabes, confirma el plan.
        </p>
      </div>

      {/* Progress counter */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 10,
        padding: '8px 14px', background: allReviewed ? '#f0fdf4' : C.bg1,
        border: `1px solid ${allReviewed ? '#bbf7d0' : C.border}`,
        marginBottom: 24, fontSize: 13,
      }}>
        <span style={{ fontWeight: 700, fontSize: 20, color: allReviewed ? C.green : C.text }}>{reviewed}</span>
        <span style={{ color: C.muted }}>de {ideas.length} ideas revisadas</span>
        {allReviewed && <Check size={16} style={{ color: C.green }} />}
      </div>

      {/* Ideas */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 100 }}>
        {ideas.map((idea) => {
          const meta    = STATUS_META[idea.status] ?? STATUS_META['pending'];
          const isActing = actingOn === idea.id;

          return (
            <div key={idea.id} style={{ background: C.card, border: `1px solid ${C.border}`, padding: 20 }}>
              {/* Idea header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{idea.angle}</span>
                    <span style={formatPill}>{idea.format}</span>
                  </div>
                  {idea.hook && <p style={{ fontSize: 12, color: C.muted, margin: 0, fontStyle: 'italic' }}>{idea.hook}</p>}
                </div>
                <span style={{
                  fontSize: 10, padding: '3px 8px', background: meta.bg, color: meta.color,
                  borderRadius: 0, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, flexShrink: 0,
                }}>
                  {meta.label}
                </span>
              </div>

              {/* Suggested asset */}
              {idea.suggested_asset_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={idea.suggested_asset_url} alt=""
                  style={{ maxWidth: '100%', maxHeight: 200, display: 'block', marginBottom: 12, border: `1px solid ${C.border}` }}
                />
              )}

              {/* Copy */}
              <label style={fieldLabel}>Texto propuesto</label>
              <textarea
                defaultValue={idea.client_edited_copy ?? idea.copy_draft ?? ''}
                onChange={(e) => {
                  setIdeas((prev) => prev.map((i) => i.id === idea.id ? { ...i, client_edited_copy: e.target.value } : i));
                  scheduleEditSave(idea.id, e.target.value);
                }}
                rows={4}
                style={{ ...textareaStyle, marginBottom: 12 }}
                placeholder="Sin copy aún"
              />

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button
                  onClick={() => doIdeaAction(idea.id, 'approve')}
                  disabled={isActing || idea.status === 'client_approved'}
                  style={actionBtn(C.green, idea.status === 'client_approved')}
                >
                  <Check size={12} /> Aprobar
                </button>
                <button
                  onClick={() => doIdeaAction(idea.id, 'edit', {
                    client_edited_copy: idea.client_edited_copy ?? undefined,
                  })}
                  disabled={isActing || idea.status === 'client_edited'}
                  style={actionBtn('#3b82f6', idea.status === 'client_edited')}
                >
                  <Edit2 size={12} /> Marcar como editada
                </button>
                <button
                  onClick={() => doIdeaAction(idea.id, 'request_variation')}
                  disabled={isActing || idea.status === 'client_requested_variation'}
                  style={actionBtn(C.amber, idea.status === 'client_requested_variation')}
                >
                  <RefreshCw size={12} /> Pedir otra versión
                </button>
                <button
                  onClick={() => doIdeaAction(idea.id, 'reject')}
                  disabled={isActing || idea.status === 'client_rejected'}
                  style={actionBtn(C.red, idea.status === 'client_rejected')}
                >
                  <X size={12} /> Rechazar
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Sticky footer */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: '#fff', borderTop: `2px solid ${C.border}`,
        padding: '14px 28px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        zIndex: 10,
      }}>
        <span style={{ fontSize: 13, color: C.muted }}>
          <strong style={{ color: C.text }}>{reviewed}</strong> de {ideas.length} revisadas
        </span>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={() => setShowSkipModal(true)} style={skipLink}>
            No quiero contenido esta semana
          </button>
          <button
            onClick={handleConfirm}
            disabled={!allReviewed || confirming}
            style={{
              ...confirmBtn,
              opacity: allReviewed ? 1 : 0.4,
              cursor: allReviewed ? 'pointer' : 'not-allowed',
            }}
          >
            {confirming ? 'Confirmando…' : 'Confirmar plan'}
          </button>
        </div>
      </div>

      {/* Skip modal */}
      {showSkipModal && (
        <div style={modalOverlay}>
          <div style={modalBox}>
            <h3 style={{ margin: '0 0 10px', fontSize: 16, fontWeight: 700 }}>¿Saltar esta semana?</h3>
            <p style={{ color: C.muted, fontSize: 13, margin: '0 0 12px' }}>
              Cuéntanos el motivo para que lo tengamos en cuenta.
            </p>
            <textarea
              value={skipReason}
              onChange={(e) => setSkipReason(e.target.value)}
              rows={3}
              style={{ ...textareaStyle, marginBottom: 12 }}
              placeholder="Estoy de vacaciones / No necesito contenido esta semana..."
              autoFocus
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleSkip} disabled={skipping} style={rejectBtnStyle}>
                {skipping ? 'Guardando…' : 'Cancelar semana'}
              </button>
              <button onClick={() => setShowSkipModal(false)} style={cancelBtnStyle}>
                Volver
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatWeek(weekStart: string): string {
  const d = new Date(weekStart + 'T00:00:00Z');
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', timeZone: 'UTC' });
}

const backBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '6px 12px', background: 'transparent', border: '1px solid #E5E7EB',
  color: '#6B7280', borderRadius: 0, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
};
const formatPill: React.CSSProperties = {
  fontSize: 10, padding: '2px 7px', background: '#f5f5f5', color: '#6B7280',
  borderRadius: 0, textTransform: 'uppercase', letterSpacing: 0.5,
};
const fieldLabel: React.CSSProperties = {
  display: 'block', fontSize: 10, color: '#6B7280',
  textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4,
};
const textareaStyle: React.CSSProperties = {
  width: '100%', padding: 10, background: '#f5f5f5', border: '1px solid #E5E7EB',
  color: '#111111', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box',
};
function actionBtn(color: string, active: boolean): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '7px 12px', background: active ? color : 'transparent',
    color: active ? '#fff' : color, border: `1px solid ${color}`,
    borderRadius: 0, cursor: active ? 'default' : 'pointer',
    fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
  };
}
const confirmBtn: React.CSSProperties = {
  padding: '11px 24px', background: '#0F766E', color: '#fff',
  border: 'none', borderRadius: 0, fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
};
const skipLink: React.CSSProperties = {
  background: 'none', border: 'none', color: '#6B7280', fontSize: 12,
  cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit',
};
const modalOverlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
};
const modalBox: React.CSSProperties = {
  background: '#fff', border: '2px solid #111827', padding: 28, width: 460, maxWidth: '90vw',
};
const rejectBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '10px 18px', background: '#EF4444', color: '#fff',
  border: 'none', borderRadius: 0, cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
};
const cancelBtnStyle: React.CSSProperties = {
  padding: '10px 18px', background: 'transparent', color: '#6B7280',
  border: '1px solid #E5E7EB', borderRadius: 0, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit',
};
