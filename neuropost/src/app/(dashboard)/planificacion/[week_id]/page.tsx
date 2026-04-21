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
  client_approved:            { label: 'Aprobada',         color: '#065f46', bg: '#d1fae5', dot: '#10b981' },
  client_edited:              { label: 'Editada',          color: '#1e40af', bg: '#eff6ff', dot: '#3b82f6' },
  client_requested_variation: { label: 'Variación pedida', color: '#92400e', bg: '#fef3c7', dot: '#f59e0b' },
  client_rejected:            { label: 'Rechazada',        color: '#991b1b', bg: '#fee2e2', dot: '#ef4444' },
};

const STORY_TYPE_META: Record<string, { label: string; color: string; bg: string }> = {
  quote:    { label: 'Frase',     color: '#1e40af', bg: '#eff6ff' },
  promo:    { label: 'Promo',     color: '#92400e', bg: '#fef3c7' },
  schedule: { label: 'Horario',   color: '#065f46', bg: '#d1fae5' },
  data:     { label: 'Dato',      color: '#5b21b6', bg: '#ede9fe' },
  photo:    { label: 'Foto',      color: '#374151', bg: '#f3f4f6' },
  custom:   { label: 'Libre',     color: '#0f766e', bg: '#ccfbf1' },
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

  const postIdeas   = ideas.filter((i) => i.content_kind !== 'story');
  const storyIdeas  = ideas.filter((i) => i.content_kind === 'story');
  const reviewed    = postIdeas.filter((i) => i.status !== 'pending').length;
  const allReviewed = postIdeas.length > 0 && reviewed === postIdeas.length;

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

      <div style={{ padding: '24px 28px' }}>
        <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <button type="button" onClick={() => router.push('/planificacion')} style={{ ...backBtn, marginBottom: 12 }}>
              <ArrowLeft size={14} /> Mis planes
            </button>
            <h2 style={{ fontFamily: fc, fontWeight: 900, fontSize: 'clamp(1.4rem, 3vw, 2rem)', textTransform: 'uppercase', letterSpacing: '0.01em', color: 'var(--text-primary)', margin: '0 0 4px', lineHeight: 1 }}>
              Semana del {formatWeek(plan.week_start)}
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, margin: 0 }}>
              Revisa cada propuesta y dinos qué te cuadra. Cuando acabes, confirma el plan.
            </p>
          </div>
          {/* Progress badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: allReviewed ? '#d1fae5' : 'var(--bg-1)', border: `1px solid ${allReviewed ? '#6ee7b7' : 'var(--border)'}`, flexShrink: 0 }}>
            <span style={{ fontFamily: fc, fontWeight: 900, fontSize: 32, lineHeight: 1, color: allReviewed ? '#065f46' : 'var(--text-primary)' }}>
              {reviewed}<span style={{ fontSize: 18, color: 'var(--text-secondary)', fontWeight: 700 }}>/{ideas.length}</span>
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.3, maxWidth: 80 }}>
              {allReviewed ? '✓ Todo revisado' : 'ideas revisadas'}
            </span>
          </div>
        </div>

        {/* Big progress badge */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 20px',
          background: allReviewed ? '#d1fae5' : 'var(--bg-1)',
          border: `1px solid ${allReviewed ? '#6ee7b7' : 'var(--border)'}`,
          flexShrink: 0,
        }}>
          <span style={{
            fontFamily: fc, fontWeight: 900, fontSize: 32, lineHeight: 1,
            color: allReviewed ? '#065f46' : 'var(--text-primary)',
          }}>
            {reviewed}<span style={{ fontSize: 18, color: 'var(--text-secondary)', fontWeight: 700 }}>/{postIdeas.length}</span>
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.3, maxWidth: 80 }}>
            {allReviewed ? '✓ Todo revisado' : 'posts revisados'}
          </span>
        </div>
      </div>

      {/* Post ideas */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: storyIdeas.length > 0 ? 32 : 100 }}>
        {postIdeas.map((idea, ideaIdx) => {
          const meta     = IDEA_STATUS_META[idea.status] ?? IDEA_STATUS_META['pending'];
          const isActing = actingOn === idea.id;
          const isDone   = idea.status !== 'pending';

          return (
            <div key={idea.id} style={{
              background: 'var(--bg)',
              border: `1px solid ${isDone ? meta.dot + '55' : 'var(--border)'}`,
              display: 'grid',
              gridTemplateColumns: '60px 1fr',
              overflow: 'hidden',
            }}>
              {/* Number strip */}
              <div style={{
                background: isDone ? meta.bg : 'var(--bg-1)',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'flex-start',
                paddingTop: 20,
                borderRight: `1px solid ${isDone ? meta.dot + '55' : 'var(--border)'}`,
              }}>
                <span style={{
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
              <div style={{ padding: '20px 20px 16px' }}>
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
                  <span style={{
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

                {/* Copy draft */}
                <label style={fieldLabel}>Texto propuesto</label>
                <textarea
                  defaultValue={idea.client_edited_copy ?? idea.copy_draft ?? ''}
                  onChange={(e) => {
                    setIdeas((prev) => prev.map((i) => i.id === idea.id ? { ...i, client_edited_copy: e.target.value } : i));
                    scheduleEditSave(idea.id, e.target.value);
                  }}
                  rows={4}
                  style={textareaStyle}
                  placeholder="Sin copy aún"
                />

                {/* Action bar */}
                <div style={{
                  display: 'flex', gap: 1, marginTop: 12,
                  background: 'var(--border)',
                  border: '1px solid var(--border)',
                }}>
                  {([
                    { act: 'approve'           as IdeaAction, label: '✓ Aprobar',           color: '#10b981', active: idea.status === 'client_approved' },
                    { act: 'edit'              as IdeaAction, label: '✎ Guardar edición',    color: '#3b82f6', active: idea.status === 'client_edited' },
                    { act: 'request_variation' as IdeaAction, label: '↺ Otra versión',       color: '#f59e0b', active: idea.status === 'client_requested_variation' },
                    { act: 'reject'            as IdeaAction, label: '✕ Rechazar',           color: '#ef4444', active: idea.status === 'client_rejected' },
                  ]).map(({ act, label, color, active }) => (
                    <button
                      key={act}
                      type="button"
                      onClick={() => {
                        if (act === 'edit') {
                          void doIdeaAction(idea.id, 'edit', { client_edited_copy: idea.client_edited_copy ?? undefined });
                        } else {
                          void doIdeaAction(idea.id, act);
                        }
                      }}
                      disabled={isActing || active}
                      style={{
                        flex: 1, padding: '10px 6px',
                        background: active ? color : 'var(--bg)',
                        color: active ? '#fff' : color,
                        border: 'none', cursor: active ? 'default' : 'pointer',
                        fontSize: 11, fontWeight: 700,
                        fontFamily: fc, textTransform: 'uppercase', letterSpacing: '0.03em',
                        opacity: isActing && !active ? 0.5 : 1,
                        transition: 'background 0.1s',
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Stories section */}
      {storyIdeas.length > 0 && (
        <div style={{ marginBottom: 100 }}>
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
                        fontSize: 11, color: '#ef4444', fontFamily: f, lineHeight: 1.3,
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
                    <span style={{
                      display: 'inline-block',
                      fontSize: 9, fontWeight: 700, letterSpacing: 0.5,
                      padding: '2px 7px', textTransform: 'uppercase',
                      background: stMeta.bg, color: stMeta.color,
                      marginBottom: 4,
                    }}>
                      {stMeta.label}
                    </span>
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
      <div style={{
        position: 'fixed', bottom: 0, left: 272, right: 0,
        background: 'var(--bg)', borderTop: '2px solid var(--border)',
        padding: '14px 28px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        zIndex: 10,
      }}>
        <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: f }}>
          <strong style={{ color: 'var(--text-primary)' }}>{reviewed}</strong> de {ideas.length} revisadas
        </span>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button type="button" onClick={() => setShowSkipModal(true)} style={skipLink}>
            No quiero contenido esta semana
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!allReviewed || confirming}
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
  padding: '10px 18px', background: '#ef4444', color: '#fff',
  border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: f,
};
const cancelBtn: React.CSSProperties = {
  padding: '10px 18px', background: 'transparent', color: 'var(--text-secondary)',
  border: '1px solid var(--border)', cursor: 'pointer', fontSize: 13, fontFamily: f,
};
