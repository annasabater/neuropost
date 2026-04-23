'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter }                      from 'next/navigation';
import { Check, Edit2, RefreshCw, X, ArrowLeft }     from 'lucide-react';
import toast                                         from 'react-hot-toast';
import type { WeeklyPlan, ContentIdea }              from '@/types';
import { CalendarView }                              from '../_components/CalendarView';

const f  = "var(--font-barlow), 'Barlow', sans-serif";
const fc = "var(--font-barlow-condensed), 'Barlow Condensed', sans-serif";

type IdeaAction = 'approve' | 'edit' | 'request_variation' | 'reject';

const IDEA_STATUS_META: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  pending:                    { label: 'Pendiente',        color: '#374151', bg: '#f3f4f6', dot: '#9ca3af' },
  client_approved:            { label: 'Aprobada',         color: '#0d5c54', bg: '#f0fdfa', dot: '#0F766E' },
  client_edited:              { label: 'Editada',          color: '#1e293b', bg: '#f8fafc', dot: '#475569' },
  client_requested_variation: { label: 'Variación pedida', color: '#3730a3', bg: '#eef2ff', dot: '#4338ca' },
  client_rejected:            { label: 'Rechazada',        color: '#9f1239', bg: '#fff1f2', dot: '#be123c' },
  regenerating:               { label: 'Regenerando…',     color: '#3730a3', bg: '#eef2ff', dot: '#4338ca' },
  replaced_by_variation:      { label: 'Reemplazada',      color: '#6b7280', bg: '#f3f4f6', dot: '#9ca3af' },
};

const STORY_TYPE_META: Record<string, { label: string; color: string; bg: string }> = {
  quote:    { label: 'Frase',     color: '#1e293b', bg: '#f8fafc' },
  promo:    { label: 'Promo',     color: '#3730a3', bg: '#eef2ff' },
  schedule: { label: 'Horario',   color: '#0d5c54', bg: '#f0fdfa' },
  data:     { label: 'Dato',      color: '#4c1d95', bg: '#f5f3ff' },
  photo:    { label: 'Foto',      color: '#374151', bg: '#f3f4f6' },
  custom:   { label: 'Libre',     color: '#0F766E', bg: '#f0fdfa' },
};

export default function PlanReviewPage() {
  const { week_id } = useParams<{ week_id: string }>();
  const router = useRouter();

  const [plan, setPlan]         = useState<WeeklyPlan | null>(null);
  const [ideas, setIdeas]       = useState<ContentIdea[]>([]);
  const [loading, setLoading]   = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [showSkipModal, setShowSkipModal] = useState(false);
  const [skipReason, setSkipReason] = useState('');
  const [skipping, setSkipping] = useState(false);
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft]   = useState('');

  // Modals for request_variation and reject actions.
  const [variationModal, setVariationModal] = useState<{ ideaId: string; angle: string } | null>(null);
  const [rejectModal, setRejectModal]       = useState<{ ideaId: string; angle: string } | null>(null);
  const [commentDraft, setCommentDraft]     = useState('');
  const [confirmEmpty, setConfirmEmpty]     = useState(false);
  const commentTextareaRef = useRef<HTMLTextAreaElement | null>(null);


  const closeVariationModal = useCallback(() => {
    setVariationModal(null);
    setCommentDraft('');
    setConfirmEmpty(false);
  }, []);

  useEffect(() => {
    if (!variationModal && !rejectModal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (variationModal) closeVariationModal();
      if (rejectModal)    setRejectModal(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [variationModal, rejectModal, closeVariationModal]);

  useEffect(() => {
    if (variationModal && !confirmEmpty) {
      commentTextareaRef.current?.focus();
    }
  }, [variationModal, confirmEmpty]);

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

  // Exponential-backoff poll while any idea is in a transient state:
  //   - status 'regenerating' or awaiting_worker_review (post ideas)
  //   - render_status 'pending_render' or 'rendering' (story render pipeline)
  // Backoff: 5 s → 10 s → 20 s → 40 s → 60 s (cap). Resets to 5 s when
  // all transient states resolve, so the next change starts fresh.
  const pollDelayRef = useRef(5_000);
  useEffect(() => {
    const needsPolling = ideas.some(
      (i) =>
        i.status === 'regenerating'
        || i.awaiting_worker_review === true
        || i.render_status === 'pending_render'
        || i.render_status === 'rendering',
    );
    if (!needsPolling) {
      pollDelayRef.current = 5_000;
      return;
    }
    const delay = pollDelayRef.current;
    const timer = setTimeout(() => {
      pollDelayRef.current = Math.min(pollDelayRef.current * 2, 60_000);
      void load();
    }, delay);
    return () => clearTimeout(timer);
  }, [ideas, load]);

  // Ideas replaced by a variation are hidden from the client — the new one
  // (linked via original_idea_id) already occupies their position.
  // Ideas awaiting worker review are also hidden until the worker clears
  // the gate from /worker/weekly-plans/[id].
  const visibleIdeas = ideas.filter(
    (i) => i.status !== 'replaced_by_variation' && i.awaiting_worker_review !== true,
  );
  const postIdeas    = visibleIdeas.filter((i) => i.content_kind !== 'story');
  const storyIdeas   = visibleIdeas.filter((i) => i.content_kind === 'story');
  const reviewed     = postIdeas.filter((i) => i.status !== 'pending' && i.status !== 'regenerating').length;
  const allReviewed  = postIdeas.length > 0 && reviewed === postIdeas.length;

  async function doIdeaAction(ideaId: string, action: IdeaAction, extra?: {
    client_edited_copy?:     string;
    client_edited_hashtags?: string[];
    comment?:                string;
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

  if (loading) {
    return <div style={{ padding: 40, color: 'var(--text-secondary)', fontFamily: f }}>Cargando propuesta...</div>;
  }
  if (!plan) return null;

  // ── Calendar / completed view ──────────────────────────────────────────────
  if (plan.status === 'calendar_ready' || plan.status === 'completed') {
    return <CalendarView plan={plan} weekId={week_id} />;
  }

  // ── In-progress (not yet ready for client review) ─────────────────────────
  if (plan.status !== 'client_reviewing') {
    const statusLabels: Record<string, string> = {
      generating:    'generando ideas para tu semana',
      ideas_ready:   'listo para revisión del equipo',
      producing:     'en producción — te avisamos cuando esté listo',
      auto_approved: 'auto-aprobado, en producción',
    };
    return (
      <div style={{ color: 'var(--text-primary)', fontFamily: f }}>
        <div style={{ padding: '24px 28px' }}>
          <button type="button" onClick={() => router.push('/planificacion')} style={{ ...backBtn, marginBottom: 16 }}>
            <ArrowLeft size={14} /> Mis planes
          </button>
          <h2 style={{ fontFamily: fc, fontWeight: 900, fontSize: 'clamp(1.4rem, 3vw, 2rem)', textTransform: 'uppercase', letterSpacing: '0.01em', color: 'var(--text-primary)', margin: '0 0 16px', lineHeight: 1 }}>
            Semana del {formatWeek(plan.week_start)}
          </h2>
          <div style={{ maxWidth: 560, padding: '20px 24px', border: '1px solid var(--border)', background: 'var(--bg)' }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5,
              padding: '4px 10px', background: 'var(--bg-1)', color: 'var(--text-secondary)',
              marginBottom: 10,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#9ca3af' }} />
              {IDEA_STATUS_META['pending']?.label ?? plan.status}
            </span>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: 0 }}>
              Este plan está {statusLabels[plan.status] ?? plan.status}.
              Recibirás un correo cuando esté listo para revisar.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Client reviewing ──────────────────────────────────────────────────────
  return (
    <div style={{ color: 'var(--text-primary)', fontFamily: f }}>
      <style>{`@keyframes plan-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      <div className="plan-header-inner" style={{ padding: '24px 28px' }}>
        <div className="plan-header-row" style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <button type="button" onClick={() => router.push('/planificacion')} style={{ ...backBtn, marginBottom: 12 }}>
              <ArrowLeft size={14} /> Mis planes
            </button>
            <h2 style={{ fontFamily: fc, fontWeight: 900, fontSize: 'clamp(1.4rem, 3vw, 2rem)', textTransform: 'uppercase', letterSpacing: '0.01em', color: 'var(--text-primary)', margin: '0 0 4px', lineHeight: 1 }}>
              Semana del {formatWeek(plan.week_start)}
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0 }}>
              Aprueba, ajusta o pide cambios en cada idea. Cuando estés listo, confirma el plan.
            </p>
          </div>
          {/* Progress badge */}
          <div className="plan-progress-badge" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: allReviewed ? '#f0fdfa' : 'var(--bg-1)', border: `1px solid ${allReviewed ? '#0F766E' : 'var(--border)'}`, flexShrink: 0 }}>
            <span style={{ fontFamily: fc, fontWeight: 900, fontSize: 32, lineHeight: 1, color: allReviewed ? '#0F766E' : 'var(--text-primary)' }}>
              {reviewed}<span style={{ fontSize: 18, color: 'var(--text-secondary)', fontWeight: 700 }}>/{postIdeas.length}</span>
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.3, maxWidth: 80 }}>
              {allReviewed ? '✓ Todo revisado' : 'posts revisados'}
            </span>
          </div>
        </div>
      </div>

      {/* Post ideas */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: storyIdeas.length > 0 ? 32 : 100 }}>
        {postIdeas.map((idea, ideaIdx) => {
          const meta     = IDEA_STATUS_META[idea.status] ?? IDEA_STATUS_META['pending'];
          const isActing = actingOn === idea.id;
          const isDone   = idea.status !== 'pending';

          return (
            <div key={idea.id} className="plan-idea-card" style={{
              background: 'var(--bg)',
              border: `1px solid ${isDone ? meta.dot + '55' : 'var(--border)'}`,
              display: 'grid',
              gridTemplateColumns: '60px 1fr',
              overflow: 'hidden',
            }}>
              {/* Number strip */}
              <div style={{
                background: 'var(--bg-1)',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'flex-start',
                paddingTop: 20,
                borderRight: `1px solid ${isDone ? meta.dot + '55' : 'var(--border)'}`,
              }}>
                <span className="plan-idea-number" style={{
                  fontFamily: fc, fontWeight: 900, fontSize: 28,
                  color: isDone ? meta.dot : 'var(--text-secondary)',
                  lineHeight: 1,
                }}>
                  {String(ideaIdx + 1).padStart(2, '0')}
                </span>
                {isDone && (
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: meta.dot, marginTop: 8 }} />
                )}
              </div>

              {/* Content */}
              <div className="plan-idea-content" style={{ padding: '20px 20px 16px' }}>
                {/* Top row: angle + format + status */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                      <span style={{
                        fontFamily: fc, fontWeight: 800, fontSize: 17,
                        textTransform: 'uppercase', letterSpacing: '0.03em',
                        color: 'var(--text-primary)',
                      }}>
                        {idea.angle}
                      </span>
                      <span style={formatPill}>{idea.format}</span>
                    </div>
                    {idea.hook && (
                      <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, fontStyle: 'italic', lineHeight: 1.5 }}>
                        "{idea.hook}"
                      </p>
                    )}
                  </div>
                  <span className="plan-idea-status-badge" style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    fontSize: 10, fontWeight: 700,
                    padding: '3px 9px',
                    background: meta.bg, color: meta.color,
                    textTransform: 'uppercase', letterSpacing: 0.5, flexShrink: 0,
                  }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: meta.dot }} />
                    {meta.label}
                  </span>
                </div>

                {/* Suggested asset */}
                {idea.suggested_asset_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={idea.suggested_asset_url} alt=""
                    style={{ maxWidth: '100%', maxHeight: 180, display: 'block', marginBottom: 12, border: '1px solid var(--border)' }}
                  />
                )}


                {/* Action bar — or regenerating placeholder */}
                {idea.status === 'regenerating' ? (
                  <div style={{
                    marginTop:   12,
                    padding:     '20px 16px',
                    background:  '#eef2ff',
                    border:      '1px dashed #818cf8',
                    color:       '#3730a3',
                    fontSize:    13,
                    fontFamily:  f,
                    textAlign:   'center',
                    display:     'flex',
                    alignItems:  'center',
                    justifyContent: 'center',
                    gap:         10,
                  }}>
                    <RefreshCw size={14} style={{ animation: 'plan-spin 1s linear infinite' }} />
                    <span>Estamos generando una nueva versión, te avisaremos cuando esté lista.</span>
                  </div>
                ) : (
                  <>
                    <div className="plan-idea-actions" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                      {/* Primary: Aprobar */}
                      <button
                        type="button"
                        onClick={() => void doIdeaAction(idea.id, 'approve')}
                        disabled={isActing || idea.status === 'client_approved'}
                        style={{
                          padding: '8px 18px',
                          background: idea.status === 'client_approved' ? '#0F766E' : 'transparent',
                          color: idea.status === 'client_approved' ? '#fff' : '#0F766E',
                          border: '1px solid #0F766E',
                          cursor: idea.status === 'client_approved' ? 'default' : 'pointer',
                          fontSize: 12, fontWeight: 700,
                          fontFamily: fc, textTransform: 'uppercase', letterSpacing: '0.04em',
                          opacity: isActing && idea.status !== 'client_approved' ? 0.5 : 1,
                          transition: 'background 0.1s, color 0.1s',
                          flexShrink: 0,
                        }}
                      >
                        ✓ Aprobar
                      </button>
                      {/* Secondary actions */}
                      <div className="plan-idea-actions-secondary" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {/* Modificar */}
                        <button
                          type="button"
                          onClick={() => {
                            if (editingId === idea.id) { setEditingId(null); }
                            else { setEditDraft(idea.client_edited_copy ?? idea.copy_draft ?? ''); setEditingId(idea.id); }
                          }}
                          disabled={isActing}
                          style={{
                            padding: '6px 12px',
                            background: editingId === idea.id ? '#1E293B' : 'transparent',
                            color: editingId === idea.id ? '#fff' : '#1E293B',
                            border: '1px solid #cbd5e1',
                            cursor: 'pointer', fontSize: 11, fontWeight: 600,
                            fontFamily: f, opacity: isActing ? 0.5 : 1,
                          }}
                        >
                          ✎ Modificar
                        </button>
                        {/* Otra versión */}
                        <button
                          type="button"
                          onClick={() => { setCommentDraft(''); setConfirmEmpty(false); setVariationModal({ ideaId: idea.id, angle: idea.angle }); }}
                          disabled={isActing || idea.status === 'client_requested_variation'}
                          style={{
                            padding: '6px 12px',
                            background: idea.status === 'client_requested_variation' ? '#4338CA' : 'transparent',
                            color: idea.status === 'client_requested_variation' ? '#fff' : '#4338CA',
                            border: '1px solid #c7d2fe',
                            cursor: idea.status === 'client_requested_variation' ? 'default' : 'pointer',
                            fontSize: 11, fontWeight: 600,
                            fontFamily: f, opacity: isActing && idea.status !== 'client_requested_variation' ? 0.5 : 1,
                          }}
                        >
                          ↺ Otra versión
                        </button>
                        {/* Rechazar */}
                        <button
                          type="button"
                          onClick={() => setRejectModal({ ideaId: idea.id, angle: idea.angle })}
                          disabled={isActing || idea.status === 'client_rejected'}
                          style={{
                            padding: '6px 12px',
                            background: idea.status === 'client_rejected' ? '#BE123C' : 'transparent',
                            color: idea.status === 'client_rejected' ? '#fff' : '#BE123C',
                            border: '1px solid #fecdd3',
                            cursor: idea.status === 'client_rejected' ? 'default' : 'pointer',
                            fontSize: 11, fontWeight: 600,
                            fontFamily: f, opacity: isActing && idea.status !== 'client_rejected' ? 0.5 : 1,
                          }}
                        >
                          ✕ Rechazar
                        </button>
                      </div>
                    </div>
                    {editingId === idea.id && (
                      <div style={{ border: '1px solid var(--border)', borderTop: 'none', padding: '14px 16px', background: 'var(--bg-1)' }}>
                        <label style={fieldLabel}>Texto propuesto</label>
                        <textarea
                          value={editDraft}
                          onChange={(e) => setEditDraft(e.target.value)}
                          rows={4}
                          style={textareaStyle}
                          placeholder="Sin copy aún"
                          autoFocus
                        />
                        <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            style={cancelBtn}
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            disabled={isActing}
                            onClick={() => {
                              void doIdeaAction(idea.id, 'edit', { client_edited_copy: editDraft }).then(() => setEditingId(null));
                            }}
                            style={primaryBtn}
                          >
                            Guardar cambios
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Stories section */}
      {storyIdeas.length > 0 && (
        <div style={{ marginBottom: 100, padding: '32px 28px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <h2 style={{
              fontFamily: fc, fontWeight: 900, fontSize: 20,
              textTransform: 'uppercase', letterSpacing: '0.04em',
              color: 'var(--text-primary)', margin: 0, lineHeight: 1,
            }}>
              Historias Programadas
            </h2>
            <span style={{
              fontFamily: fc, fontWeight: 700, fontSize: 12,
              padding: '3px 10px', background: 'var(--bg-1)',
              color: 'var(--text-secondary)', textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}>
              {storyIdeas.length} historias
            </span>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            gap: 8,
          }}>
            {storyIdeas.map((story) => {
              const stype = story.story_type ?? 'custom';
              const stMeta = STORY_TYPE_META[stype] ?? STORY_TYPE_META['custom'];
              const hasImage  = !!story.rendered_image_url;
              const hasError  = !!story.render_error;

              return (
                <div key={story.id} style={{
                  border: '1px solid var(--border)',
                  background: 'var(--bg)',
                  display: 'flex', flexDirection: 'column',
                  overflow: 'hidden',
                }}>
                  {/* 9:16 preview area */}
                  <div style={{
                    aspectRatio: '9/16',
                    background: hasImage ? 'transparent' : 'var(--bg-1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    overflow: 'hidden', position: 'relative',
                  }}>
                    {hasImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={story.rendered_image_url!}
                        alt=""
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      />
                    ) : hasError ? (
                      <div style={{
                        padding: 8, textAlign: 'center',
                        fontSize: 11, color: '#be123c', fontFamily: f, lineHeight: 1.3,
                      }}>
                        Error al renderizar
                      </div>
                    ) : (
                      <div style={{
                        fontSize: 10, color: 'var(--text-secondary)',
                        fontFamily: f, textAlign: 'center', lineHeight: 1.4, padding: 8,
                      }}>
                        Renderizando…
                      </div>
                    )}
                  </div>

                  {/* Meta */}
                  <div style={{ padding: '8px 10px' }}>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
                      <span style={{
                        display: 'inline-block',
                        fontSize: 9, fontWeight: 700, letterSpacing: 0.5,
                        padding: '2px 7px', textTransform: 'uppercase',
                        background: stMeta.bg, color: stMeta.color,
                      }}>
                        {stMeta.label}
                      </span>
                      {story.generation_fallback && (
                        <span style={{
                          display: 'inline-block',
                          fontSize: 9, fontWeight: 700, letterSpacing: 0.5,
                          padding: '2px 7px', textTransform: 'uppercase',
                          background: '#fefce8', color: '#854d0e',
                        }} title="Texto generado con copia de respaldo (la IA no pudo generar contenido original)">
                          Fallback
                        </span>
                      )}
                    </div>
                    {story.copy_draft && (
                      <p style={{
                        fontSize: 11, color: 'var(--text-secondary)',
                        margin: 0, lineHeight: 1.4,
                        display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}>
                        {story.copy_draft}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sticky footer */}
      <div className="plan-sticky-footer">
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button type="button" onClick={() => setShowSkipModal(true)} className="plan-skip-link" style={skipLink}>
            No quiero contenido esta semana
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!allReviewed || confirming}
            className="plan-confirm-btn"
            style={{ ...confirmBtn, opacity: allReviewed ? 1 : 0.4, cursor: allReviewed ? 'pointer' : 'not-allowed' }}
          >
            {confirming ? 'Confirmando…' : 'Confirmar plan'}
          </button>
        </div>
      </div>

      {/* Skip modal */}
      {showSkipModal && (
        <div style={modalOverlay}>
          <div style={modalBox}>
            <h3 style={{ fontFamily: fc, fontWeight: 900, fontSize: 20, textTransform: 'uppercase', letterSpacing: '0.03em', margin: '0 0 10px' }}>
              ¿Saltar esta semana?
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: '0 0 14px' }}>
              Cuéntanos el motivo para que lo tengamos en cuenta.
            </p>
            <textarea
              value={skipReason}
              onChange={(e) => setSkipReason(e.target.value)}
              rows={3}
              style={textareaStyle}
              placeholder="Estoy de vacaciones / No necesito contenido esta semana..."
              autoFocus
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button type="button" onClick={handleSkip} disabled={skipping} style={dangerBtn}>
                {skipping ? 'Guardando…' : 'Cancelar semana'}
              </button>
              <button type="button" onClick={() => setShowSkipModal(false)} style={cancelBtn}>
                Volver
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RequestVariation modal */}
      {variationModal && (
        <div style={modalOverlay} onClick={() => closeVariationModal()}>
          <div style={modalBox} onClick={(e) => e.stopPropagation()}>
            {!confirmEmpty ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                  <div>
                    <h3 style={{ fontFamily: fc, fontWeight: 900, fontSize: 20, textTransform: 'uppercase', letterSpacing: '0.03em', margin: '0 0 4px' }}>
                      ¿Qué te gustaría cambiar?
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 12, margin: 0 }}>
                      {variationModal.angle}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeVariationModal}
                    style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0 }}
                    aria-label="Cerrar"
                  >
                    <X size={20} />
                  </button>
                </div>
                <textarea
                  ref={commentTextareaRef}
                  value={commentDraft}
                  onChange={(e) => setCommentDraft(e.target.value.slice(0, 500))}
                  maxLength={500}
                  rows={4}
                  placeholder="Dinos qué te gustaría cambiar para la nueva versión"
                  style={textareaStyle}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: f }}>
                    {commentDraft.length}/500
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
                  <button type="button" onClick={closeVariationModal} style={cancelBtn}>
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const trimmed = commentDraft.trim();
                      if (!trimmed) { setConfirmEmpty(true); return; }
                      const ideaId = variationModal.ideaId;
                      closeVariationModal();
                      void doIdeaAction(ideaId, 'request_variation', { comment: trimmed });
                    }}
                    style={primaryBtn}
                  >
                    Pedir otra versión
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 style={{ fontFamily: fc, fontWeight: 900, fontSize: 18, textTransform: 'uppercase', letterSpacing: '0.03em', margin: '0 0 10px' }}>
                  ¿Seguro?
                </h3>
                <p style={{ color: 'var(--text-primary)', fontSize: 13, margin: '0 0 14px', lineHeight: 1.5, fontFamily: f }}>
                  Sin comentario, la IA decidirá por su cuenta qué cambiar.
                </p>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmEmpty(false);
                      setTimeout(() => commentTextareaRef.current?.focus(), 0);
                    }}
                    style={cancelBtn}
                  >
                    Escribir algo
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const ideaId = variationModal.ideaId;
                      closeVariationModal();
                      void doIdeaAction(ideaId, 'request_variation');
                    }}
                    style={primaryBtn}
                  >
                    Enviar sin comentario
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Reject confirm modal */}
      {rejectModal && (
        <div style={modalOverlay} onClick={() => setRejectModal(null)}>
          <div style={modalBox} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
              <h3 style={{ fontFamily: fc, fontWeight: 900, fontSize: 20, textTransform: 'uppercase', letterSpacing: '0.03em', margin: 0 }}>
                ¿Seguro que quieres eliminar esta idea?
              </h3>
              <button
                type="button"
                onClick={() => setRejectModal(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0 }}
                aria-label="Cerrar"
              >
                <X size={20} />
              </button>
            </div>
            <p style={{ color: 'var(--text-primary)', fontSize: 13, margin: '0 0 16px', lineHeight: 1.5, fontFamily: f }}>
              Al rechazar esta idea, se eliminará del plan y te quedarás con menos contenido esta semana. ¿Prefieres pedir otra versión?
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => {
                  const ideaId = rejectModal.ideaId;
                  setRejectModal(null);
                  void doIdeaAction(ideaId, 'reject');
                }}
                style={dangerOutlineBtn}
              >
                Sí, eliminar
              </button>
              <button
                type="button"
                onClick={() => {
                  const next = { ideaId: rejectModal.ideaId, angle: rejectModal.angle };
                  setRejectModal(null);
                  setCommentDraft('');
                  setConfirmEmpty(false);
                  setVariationModal(next);
                }}
                style={primaryBtn}
              >
                Mejor pedir otra versión
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatWeek(weekStart: string): string {
  // +7: week_start is the planning week; display the content week (following week)
  const d = new Date(weekStart + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 7);
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', timeZone: 'UTC' });
}

const backBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '6px 12px', background: 'transparent',
  border: '1px solid var(--border)',
  color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12, fontFamily: f,
};
const formatPill: React.CSSProperties = {
  fontSize: 10, padding: '3px 8px',
  background: 'var(--bg-1)', color: 'var(--text-secondary)',
  textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600,
};
const fieldLabel: React.CSSProperties = {
  display: 'block', fontSize: 10, color: 'var(--text-secondary)',
  textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4, fontFamily: f,
};
const textareaStyle: React.CSSProperties = {
  width: '100%', padding: 10, background: 'var(--bg-1)',
  border: '1px solid var(--border)',
  color: 'var(--text-primary)', fontSize: 13, fontFamily: f,
  resize: 'vertical', boxSizing: 'border-box',
};
function actionBtn(color: string, active: boolean): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '7px 12px', background: active ? color : 'transparent',
    color: active ? '#fff' : color, border: `1px solid ${color}`,
    cursor: active ? 'default' : 'pointer',
    fontSize: 12, fontWeight: 600, fontFamily: f,
  };
}
const confirmBtn: React.CSSProperties = {
  padding: '11px 24px', background: 'var(--accent)', color: '#fff',
  border: 'none', fontSize: 14, fontWeight: 700,
  fontFamily: fc, textTransform: 'uppercase', letterSpacing: '0.04em',
};
const skipLink: React.CSSProperties = {
  background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 12,
  cursor: 'pointer', textDecoration: 'underline', fontFamily: f,
};
const modalOverlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
};
const modalBox: React.CSSProperties = {
  background: 'var(--bg)', border: '1px solid var(--border)',
  padding: 28, width: 460, maxWidth: '90vw', fontFamily: f,
};
const dangerBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '10px 18px', background: '#be123c', color: '#fff',
  border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: f,
};
const cancelBtn: React.CSSProperties = {
  padding: '10px 18px', background: 'transparent', color: 'var(--text-secondary)',
  border: '1px solid var(--border)', cursor: 'pointer', fontSize: 13, fontFamily: f,
};
const primaryBtn: React.CSSProperties = {
  padding: '10px 18px', background: '#0F766E', color: '#fff',
  border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700,
  fontFamily: fc, textTransform: 'uppercase', letterSpacing: '0.04em',
};
const dangerOutlineBtn: React.CSSProperties = {
  padding: '10px 18px', background: 'transparent', color: '#be123c',
  border: '1px solid #be123c', cursor: 'pointer', fontSize: 13,
  fontWeight: 700, fontFamily: f,
};
